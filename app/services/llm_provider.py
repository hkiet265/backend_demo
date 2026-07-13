"""
Unified LLM provider layer.

Every place in the codebase that needs a chat completion (response
generation, smalltalk, query understanding) goes through `get_llm_chain()`
or `get_structured_provider()` instead of importing a specific SDK
(`groq`, `google.generativeai`, ...) directly. Adding/swapping a provider —
OpenAI, Claude, or a new one entirely — means: implement `LLMProvider`
below, register it in `_build_provider()`, and set env vars. No changes
needed in response_generator.py / query_parser.py / anywhere else that
consumes a provider.

Configure via .env:
    LLM_PROVIDERS=groq,gemini          # ordered fallback chain for chat/generation
    QUERY_UNDERSTANDING_PROVIDER=gemini # provider used for structured JSON parsing
    OPENAI_API_KEY=...      OPENAI_MODEL=gpt-4o-mini
    DEEPSEEK_API_KEY=...    DEEPSEEK_MODEL=deepseek-chat
    ANTHROPIC_API_KEY=...   ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

All three (OpenAI, DeepSeek, Anthropic) call their REST API directly with
`requests` — no provider SDK to install, no image rebuild to enable one.
"""
import logging
from abc import ABC, abstractmethod
from typing import List, Optional, Type

logger = logging.getLogger(__name__)


class LLMProvider(ABC):
    """Common interface every AI provider implements."""

    name: str = "base"

    @abstractmethod
    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> Optional[str]:
        """Return generated text, or None if this provider couldn't answer
        (caller should try the next provider in the chain)."""
        raise NotImplementedError

    def generate_structured(
        self,
        prompt: str,
        schema: Type,
        temperature: float = 0.1,
    ) -> Optional[str]:
        """Return raw JSON text matching `schema`, or None if this provider
        doesn't support structured output / the call failed. Only Gemini and
        OpenAI implement this natively today; other providers simply return
        None so the caller falls back to a plain generate() + manual parse."""
        return None


class GroqProvider(LLMProvider):
    name = "groq"

    def generate(self, system_prompt, user_prompt, temperature=0.7, max_tokens=1024):
        from app.services.groq_service import get_groq_service

        service = get_groq_service()
        if not service:
            return None
        try:
            return service.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except Exception as e:
            logger.warning(f"GroqProvider.generate failed: {e}")
            return None


def _strip_defaults_for_gemini(schema: Type) -> Type:
    """Clone a Pydantic model dropping every field default, so google-
    generativeai's response_schema translator (which errors on any field
    carrying a "default" key) accepts it. Optional[...] with no default is
    still a required-but-nullable key — exactly what the translator expects."""
    from pydantic import BaseModel, create_model

    if not (isinstance(schema, type) and issubclass(schema, BaseModel)):
        return schema
    fields = {name: (f.annotation, ...) for name, f in schema.model_fields.items()}
    return create_model(f"{schema.__name__}ForGemini", **fields)


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self):
        from app.config import settings
        self.model_name = settings.CHAT_MODEL

    def generate(self, system_prompt, user_prompt, temperature=0.7, max_tokens=1024):
        try:
            import google.generativeai as genai
            from app.services.api_key_manager import get_api_key_manager

            key_manager = get_api_key_manager()
            key_manager.configure_genai()
            model = genai.GenerativeModel(self.model_name)
            prompt = f"{system_prompt}\n\n{user_prompt}"

            for attempt in range(2):
                try:
                    response = model.generate_content(
                        prompt,
                        generation_config={
                            'temperature': temperature,
                            'max_output_tokens': max_tokens,
                            'top_p': 0.9,
                        },
                    )
                    answer = response.text.strip()
                    return answer or None
                except Exception as e:
                    error_str = str(e).lower()
                    if ("429" in error_str or "quota" in error_str) and attempt == 0:
                        key_manager.mark_key_quota_exceeded(key_manager.get_current_key(), retry_after_seconds=60)
                        key_manager.configure_genai()
                        model = genai.GenerativeModel(self.model_name)
                        continue
                    logger.warning(f"GeminiProvider.generate failed: {e}")
                    return None
        except Exception as e:
            logger.warning(f"GeminiProvider unavailable: {e}")
            return None

    def generate_structured(self, prompt, schema, temperature=0.1):
        try:
            import json
            import google.generativeai as genai
            from app.services.api_key_manager import get_api_key_manager

            key_manager = get_api_key_manager()
            # Callers give every field a default (= None) so opencode/other
            # providers can omit keys freely without failing our own
            # post-hoc validation — but Gemini's schema translator rejects
            # any field carrying a "default" key ("Unknown field for Schema:
            # default"). Build a default-free clone just for the request;
            # the actual response text is parsed/validated by the caller's
            # original (lenient) schema, not this one.
            gemini_schema = _strip_defaults_for_gemini(schema)

            for attempt in range(2):
                key_manager.configure_genai()
                model = genai.GenerativeModel(self.model_name)
                try:
                    response = model.generate_content(
                        prompt,
                        generation_config=genai.GenerationConfig(
                            response_mime_type="application/json",
                            response_schema=gemini_schema,
                            temperature=temperature,
                        ),
                    )
                    return response.text
                except Exception as e:
                    error_str = str(e).lower()
                    if ("429" in error_str or "quota" in error_str) and attempt == 0:
                        key_manager.mark_key_quota_exceeded(key_manager.get_current_key(), retry_after_seconds=60)
                        continue
                    raise
        except Exception as e:
            logger.warning(f"GeminiProvider.generate_structured failed: {e}")
            return None


def _openai_compatible_chat(
    base_url: str,
    api_key: str,
    model: str,
    messages: list,
    temperature: float,
    max_tokens: Optional[int] = None,
    response_format: Optional[dict] = None,
    provider_label: str = "provider",
) -> Optional[str]:
    """Plain HTTP call against an OpenAI-compatible /chat/completions endpoint
    (OpenAI, DeepSeek, and most other providers all speak this same shape).
    Uses `requests` — already a dependency — instead of each provider's SDK,
    so enabling a new one is just an API key + base URL, no install/rebuild."""
    import requests

    payload = {"model": model, "messages": messages, "temperature": temperature}
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens
    if response_format is not None:
        payload["response_format"] = response_format

    try:
        resp = requests.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    except Exception as e:
        logger.warning(f"{provider_label} chat completion failed: {e}")
        return None


class OpenAIProvider(LLMProvider):
    """OpenAI Chat Completions API, via plain HTTP (no `openai` SDK needed)."""

    name = "openai"

    def __init__(self):
        from app.config import settings
        self.api_key = settings.OPENAI_API_KEY
        self.model = settings.OPENAI_MODEL
        self.base_url = "https://api.openai.com/v1"

    def generate(self, system_prompt, user_prompt, temperature=0.7, max_tokens=1024):
        if not self.api_key:
            return None
        return _openai_compatible_chat(
            self.base_url, self.api_key, self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature, max_tokens=max_tokens, provider_label="OpenAIProvider",
        )

    def generate_structured(self, prompt, schema, temperature=0.1):
        if not self.api_key:
            return None
        return _openai_compatible_chat(
            self.base_url, self.api_key, self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature, response_format={"type": "json_object"},
            provider_label="OpenAIProvider",
        )


class DeepSeekProvider(LLMProvider):
    """DeepSeek Chat Completions API — OpenAI-compatible, via plain HTTP.
    Configure DEEPSEEK_API_KEY / DEEPSEEK_MODEL / DEEPSEEK_BASE_URL in .env."""

    name = "deepseek"

    def __init__(self):
        from app.config import settings
        self.api_key = settings.DEEPSEEK_API_KEY
        self.model = settings.DEEPSEEK_MODEL
        self.base_url = settings.DEEPSEEK_BASE_URL

    def generate(self, system_prompt, user_prompt, temperature=0.7, max_tokens=1024):
        if not self.api_key:
            return None
        return _openai_compatible_chat(
            self.base_url, self.api_key, self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature, max_tokens=max_tokens, provider_label="DeepSeekProvider",
        )

    def generate_structured(self, prompt, schema, temperature=0.1):
        if not self.api_key:
            return None
        return _openai_compatible_chat(
            self.base_url, self.api_key, self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature, response_format={"type": "json_object"},
            provider_label="DeepSeekProvider",
        )


class OpenCodeZenProvider(LLMProvider):
    """OpenCode Zen (opencode.ai) — OpenAI-compatible gateway to many
    underlying models (GPT/Claude/Gemini/DeepSeek/...) through a single API
    key, via plain HTTP (no SDK). Configure OPENCODE_API_KEY / OPENCODE_MODEL
    in .env — model id is the bare id (e.g. "gpt-5.4-mini"), NOT the
    "opencode/gpt-5.4-mini" form used in the opencode CLI's own config file.
    See https://opencode.ai/docs/zen/"""

    name = "opencode"

    def __init__(self):
        from app.config import settings
        self.api_key = settings.OPENCODE_API_KEY
        self.model = settings.OPENCODE_MODEL
        self.base_url = settings.OPENCODE_BASE_URL

    def generate(self, system_prompt, user_prompt, temperature=0.7, max_tokens=1024):
        if not self.api_key:
            return None
        return _openai_compatible_chat(
            self.base_url, self.api_key, self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature, max_tokens=max_tokens, provider_label="OpenCodeZenProvider",
        )

    def generate_structured(self, prompt, schema, temperature=0.1):
        if not self.api_key:
            return None
        return _openai_compatible_chat(
            self.base_url, self.api_key, self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature, response_format={"type": "json_object"},
            provider_label="OpenCodeZenProvider",
        )


class ClaudeProvider(LLMProvider):
    """Anthropic Messages API, via plain HTTP (no `anthropic` SDK needed)."""

    name = "claude"

    def __init__(self):
        from app.config import settings
        self.api_key = settings.ANTHROPIC_API_KEY
        self.model = settings.ANTHROPIC_MODEL

    def generate(self, system_prompt, user_prompt, temperature=0.7, max_tokens=1024):
        if not self.api_key:
            return None
        import requests

        try:
            resp = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()["content"][0]["text"]
        except Exception as e:
            logger.warning(f"ClaudeProvider.generate failed: {e}")
            return None


_PROVIDER_REGISTRY = {
    "groq": GroqProvider,
    "gemini": GeminiProvider,
    "openai": OpenAIProvider,
    "deepseek": DeepSeekProvider,
    "claude": ClaudeProvider,
    "opencode": OpenCodeZenProvider,
}

_chain_cache: Optional[List[LLMProvider]] = None
_structured_cache: Optional[LLMProvider] = None


def _build_provider(key: str) -> Optional[LLMProvider]:
    provider_cls = _PROVIDER_REGISTRY.get(key.strip().lower())
    if not provider_cls:
        logger.warning(f"Unknown LLM provider '{key}' in config, skipping")
        return None
    try:
        return provider_cls()
    except Exception as e:
        logger.warning(f"Failed to init provider '{key}': {e}")
        return None


def get_llm_chain() -> List[LLMProvider]:
    """Ordered list of providers to try for a chat completion, per
    settings.LLM_PROVIDERS (e.g. "groq,gemini"). Cached — provider objects
    are cheap/stateless wrappers around the underlying singletons."""
    global _chain_cache
    if _chain_cache is None:
        from app.config import settings
        keys = [k for k in settings.LLM_PROVIDERS.split(",") if k.strip()]
        _chain_cache = [p for p in (_build_provider(k) for k in keys) if p is not None]
    return _chain_cache


def get_structured_provider() -> Optional[LLMProvider]:
    """Provider used for schema-constrained JSON output (query understanding),
    per settings.QUERY_UNDERSTANDING_PROVIDER."""
    global _structured_cache
    if _structured_cache is None:
        from app.config import settings
        _structured_cache = _build_provider(settings.QUERY_UNDERSTANDING_PROVIDER)
    return _structured_cache


def generate_with_fallback(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> Optional[str]:
    """Try each provider in the configured chain until one answers."""
    for provider in get_llm_chain():
        answer = provider.generate(system_prompt, user_prompt, temperature, max_tokens)
        if answer:
            return answer
    return None
