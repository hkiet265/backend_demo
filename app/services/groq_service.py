"""
Groq LLM Service - Ultra-fast inference with key rotation
"""
from groq import Groq
import logging
from typing import Optional, List, Dict
from datetime import datetime, timedelta
import time

logger = logging.getLogger(__name__)


class GroqService:
    """Service for Groq LLM API with automatic key rotation and cooldown"""
    
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
        self.api_keys = [key for key in api_keys if key]
        self.model = model
        self.current_key_index = 0
        self.clients: Dict[int, Groq] = {}
        self.key_cooldown: Dict[int, datetime] = {}
        self.failed_keys: set = set()

        for i, key in enumerate(self.api_keys):
            try:
                self.clients[i] = Groq(api_key=key)
                logger.info(f"✅ Groq client #{i+1} initialized ({key[:15]}...)")
            except Exception as e:
                logger.error(f"❌ Failed to init Groq client #{i+1}: {e}")
                self.failed_keys.add(i)
        
        if not self.clients:
            raise ValueError("No valid Groq API keys provided")
        
        logger.info(f"🚀 GroqService initialized: {len(self.clients)} keys, model={model}")
    
    def _get_current_client(self) -> Optional[Groq]:
        """Get current Groq client, skip if in cooldown"""
        if self.current_key_index in self.key_cooldown:
            cooldown_until = self.key_cooldown[self.current_key_index]
            if datetime.now() < cooldown_until:
                logger.warning(f"⏰ Groq key #{self.current_key_index+1} in cooldown, rotating...")
                self._rotate_key()
                return self._get_current_client()
        
        if self.current_key_index in self.failed_keys:
            logger.warning(f"❌ Groq key #{self.current_key_index+1} marked as failed, rotating...")
            self._rotate_key()
            return self._get_current_client()
        
        return self.clients.get(self.current_key_index)
    
    def _rotate_key(self):
        """Rotate to next API key"""
        old_index = self.current_key_index
        attempts = 0
        max_attempts = len(self.clients)
        
        while attempts < max_attempts:
            self.current_key_index = (self.current_key_index + 1) % len(self.clients)
            
            if self.current_key_index in self.failed_keys:
                attempts += 1
                continue
            
            if self.current_key_index in self.key_cooldown:
                cooldown_until = self.key_cooldown[self.current_key_index]
                if datetime.now() < cooldown_until:
                    attempts += 1
                    continue
            
            logger.info(f"🔄 Rotated Groq key: #{old_index+1} → #{self.current_key_index+1}")
            return
        
        logger.error("❌ All Groq keys are in cooldown or failed!")
    
    def _mark_key_quota_exceeded(self, key_index: int, retry_after_seconds: int = 60):
        """Mark key as quota exceeded and set cooldown"""
        cooldown_until = datetime.now() + timedelta(seconds=retry_after_seconds)
        self.key_cooldown[key_index] = cooldown_until
        logger.warning(f"🚫 Groq key #{key_index+1} quota exceeded, cooldown until {cooldown_until.strftime('%H:%M:%S')}")
    
    def _mark_key_failed(self, key_index: int):
        """Mark key as permanently failed"""
        self.failed_keys.add(key_index)
        logger.error(f"❌ Groq key #{key_index+1} marked as FAILED")
    
    def get_stats(self) -> dict:
        """Get Groq service stats"""
        total = len(self.clients)
        in_cooldown = sum(
            1 for idx in range(total) 
            if idx in self.key_cooldown and datetime.now() < self.key_cooldown[idx]
        )
        failed = len(self.failed_keys)
        available = total - in_cooldown - failed
        
        return {
            'total_keys': total,
            'current_index': self.current_key_index + 1,
            'available': available,
            'in_cooldown': in_cooldown,
            'failed': failed,
            'model': self.model
        }
    
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
        max_retries = len(self.clients)
        
        for attempt in range(max_retries):
            try:
                client = self._get_current_client()
                
                if not client:
                    logger.error("❌ No available Groq client")
                    return None
                
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
                error_str = str(e).lower()
                
                if "429" in str(e) or "rate_limit" in error_str or "quota" in error_str or "resource_exhausted" in error_str:
                    logger.warning(f"⚠️ Groq key #{self.current_key_index+1} quota exceeded")
                    
                    retry_after = 60
                    if "retry after" in error_str:
                        try:
                            import re
                            match = re.search(r'retry after (\d+)', error_str)
                            if match:
                                retry_after = int(match.group(1))
                        except:
                            pass
                    
                    self._mark_key_quota_exceeded(self.current_key_index, retry_after)
                    self._rotate_key()
                    
                    if attempt < max_retries - 1:
                        logger.info(f"🔄 Retrying with key #{self.current_key_index+1}...")
                        continue
                
                elif "401" in str(e) or "invalid" in error_str or "unauthorized" in error_str:
                    logger.error(f"❌ Groq key #{self.current_key_index+1} invalid/unauthorized")
                    self._mark_key_failed(self.current_key_index)
                    self._rotate_key()
                    
                    if attempt < max_retries - 1:
                        continue
                else:
                    logger.error(f"❌ Groq error (key #{self.current_key_index+1}): {str(e)[:150]}")
                    return None
        
        logger.error("❌ All Groq keys exhausted!")
        return None
 
_groq_service = None

def get_groq_service() -> Optional[GroqService]:
    """Get or create Groq service singleton"""
    global _groq_service
    if _groq_service is None:
        from app.config import settings

        api_keys = [
            settings.GROQ_API_KEY_1,
            settings.GROQ_API_KEY_2,
            settings.GROQ_API_KEY_3,
        ]

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
