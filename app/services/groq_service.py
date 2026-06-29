"""
Groq LLM Service - Ultra-fast inference with key rotation
"""
from groq import Groq
import logging
from typing import Optional, List
import time

logger = logging.getLogger(__name__)


class GroqService:
    """Service for Groq LLM API with automatic key rotation"""
    
    def __init__(self, api_keys: List[str], model: str = "llama-3.3-70b-versatile"):
        """
        Initialize Groq service with multiple API keys for rotation
        
        Args:
            api_keys: List of Groq API keys
            model: Model name
                - llama-3.3-70b-versatile (Best for Vietnamese)
                - mixtral-8x7b-32768 (Long context)
                - gemma2-9b-it (Fast)
        """
        self.api_keys = [key for key in api_keys if key]  # Filter empty keys
        self.model = model
        self.current_key_index = 0
        self.clients = {}
        
        # Initialize clients for each key
        for i, key in enumerate(self.api_keys):
            try:
                self.clients[i] = Groq(api_key=key)
                logger.info(f"✅ Groq client #{i+1} initialized")
            except Exception as e:
                logger.error(f"❌ Failed to init Groq client #{i+1}: {e}")
        
        if not self.clients:
            raise ValueError("No valid Groq API keys provided")
        
        logger.info(f"🚀 GroqService initialized: {len(self.clients)} keys, model={model}")
    
    def _get_current_client(self) -> Groq:
        """Get current Groq client"""
        return self.clients[self.current_key_index]
    
    def _rotate_key(self):
        """Rotate to next API key"""
        old_index = self.current_key_index
        self.current_key_index = (self.current_key_index + 1) % len(self.clients)
        logger.warning(f"🔄 Rotated Groq key: #{old_index+1} → #{self.current_key_index+1}")
    
    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048
    ) -> Optional[str]:
        """
        Generate text using Groq with automatic key rotation on quota exceeded
        
        Args:
            system_prompt: System instructions
            user_prompt: User input
            temperature: Creativity (0-1)
            max_tokens: Max response length
        
        Returns:
            Generated text or None if all keys failed
        """
        max_retries = len(self.clients)  # Try all keys
        
        for attempt in range(max_retries):
            try:
                client = self._get_current_client()
                
                start_time = time.time()
                response = client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=temperature,
                    max_tokens=max_tokens,
                    top_p=0.9,
                )
                
                elapsed = (time.time() - start_time) * 1000
                answer = response.choices[0].message.content
                
                logger.info(f"✅ Groq key #{self.current_key_index+1}: {len(answer)} chars in {elapsed:.0f}ms")
                return answer
                
            except Exception as e:
                error_str = str(e)
                
                # Check if quota exceeded (429 or rate limit)
                if "429" in error_str or "rate_limit" in error_str.lower() or "quota" in error_str.lower():
                    logger.warning(f"⚠️ Groq key #{self.current_key_index+1} quota exceeded, rotating...")
                    self._rotate_key()
                    
                    if attempt < max_retries - 1:
                        continue  # Try next key
                else:
                    # Other errors
                    logger.error(f"❌ Groq error (key #{self.current_key_index+1}): {error_str[:100]}")
                    return None
        
        # All keys failed
        logger.error("❌ All Groq keys exhausted!")
        return None


# Singleton
_groq_service = None

def get_groq_service() -> Optional[GroqService]:
    """Get or create Groq service singleton"""
    global _groq_service
    if _groq_service is None:
        from app.config import settings
        
        # Collect all Groq API keys
        api_keys = [
            settings.GROQ_API_KEY_1,
            settings.GROQ_API_KEY_2,
            settings.GROQ_API_KEY_3,
        ]
        
        # Filter out empty keys
        valid_keys = [key for key in api_keys if key]
        
        if not valid_keys:
            logger.warning("⚠️ No Groq API keys found, Groq service disabled")
            return None
        
        try:
            _groq_service = GroqService(
                api_keys=valid_keys,
                model=settings.GROQ_MODEL
            )
        except Exception as e:
            logger.error(f"❌ Failed to initialize Groq service: {e}")
            return None
    
    return _groq_service
