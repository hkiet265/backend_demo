"""
API Key Manager với Auto-Rotation
Tự động đổi key khi hết quota
"""
import os
import logging
from typing import List, Optional
from datetime import datetime, timedelta
import google.generativeai as genai

logger = logging.getLogger(__name__)


class APIKeyManager:
    """Quản lý và rotate API keys tự động"""
    
    def __init__(self):
        """Initialize với danh sách keys từ .env"""
        # Load .env trực tiếp (không qua Pydantic Settings)
        from dotenv import load_dotenv
        load_dotenv(override=True)
        
        self.keys: List[str] = []
        self.current_index: int = 0
        self.failed_keys: set = set()  # Lưu keys đã fail
        self.key_cooldown: dict = {}  # Lưu thời gian cooldown của mỗi key
        
        # Load tất cả keys từ environment
        for i in range(1, 11):  # GEMINI_API_KEY_1 đến GEMINI_API_KEY_10
            key = os.getenv(f"GEMINI_API_KEY_{i}", "").strip()
            if key:
                self.keys.append(key)
                logger.info(f"✅ Loaded API Key {i}: {key[:20]}...")
        
        if not self.keys:
            logger.error("❌ No API keys found! Please add keys to .env")
            raise ValueError("No Gemini API keys configured")
        
        logger.info(f"🔑 API Key Manager initialized with {len(self.keys)} keys")
    
    def get_current_key(self) -> str:
        """Lấy key hiện tại đang dùng"""
        # Kiểm tra xem key hiện tại có trong cooldown không
        current_key = self.keys[self.current_index]
        
        if current_key in self.key_cooldown:
            cooldown_until = self.key_cooldown[current_key]
            if datetime.now() < cooldown_until:
                # Key vẫn đang cooldown, đổi sang key khác
                logger.warning(f"⏰ Key {self.current_index + 1} still in cooldown, rotating...")
                return self.rotate_key()
        
        return current_key
    
    def rotate_key(self, reason: str = "manual") -> str:
        """
        Đổi sang key tiếp theo
        
        Args:
            reason: Lý do rotate (manual, quota_exceeded, error)
        
        Returns:
            Key mới
        """
        old_index = self.current_index
        attempts = 0
        max_attempts = len(self.keys)
        
        while attempts < max_attempts:
            # Đổi sang key tiếp theo (circular)
            self.current_index = (self.current_index + 1) % len(self.keys)
            new_key = self.keys[self.current_index]
            
            # Kiểm tra xem key mới có trong cooldown không
            if new_key in self.key_cooldown:
                cooldown_until = self.key_cooldown[new_key]
                if datetime.now() < cooldown_until:
                    logger.warning(f"⏰ Key {self.current_index + 1} in cooldown until {cooldown_until}")
                    attempts += 1
                    continue
            
            # Key này OK, dùng được
            logger.info(f"🔄 Rotated from Key {old_index + 1} to Key {self.current_index + 1} (reason: {reason})")
            return new_key
        
        # Tất cả keys đều trong cooldown
        logger.error("❌ All API keys are in cooldown or failed!")
        # Trả về key hiện tại và hy vọng nó đã hết cooldown
        return self.keys[self.current_index]
    
    def mark_key_quota_exceeded(self, key: str, retry_after_seconds: int = 60):
        """
        Đánh dấu key bị quota exceeded và set cooldown
        
        Args:
            key: API key bị lỗi
            retry_after_seconds: Số giây phải đợi (từ error response)
        """
        cooldown_until = datetime.now() + timedelta(seconds=retry_after_seconds)
        self.key_cooldown[key] = cooldown_until
        logger.warning(f"🚫 Key {key[:20]}... quota exceeded, cooldown until {cooldown_until}")
        
        # Tự động rotate sang key khác
        self.rotate_key(reason="quota_exceeded")
    
    def mark_key_failed(self, key: str):
        """Đánh dấu key bị lỗi vĩnh viễn (invalid, revoked)"""
        self.failed_keys.add(key)
        logger.error(f"❌ Key {key[:20]}... marked as FAILED (invalid/revoked)")
        
        # Rotate sang key khác
        self.rotate_key(reason="key_failed")
    
    def get_stats(self) -> dict:
        """Lấy thống kê về keys"""
        total = len(self.keys)
        in_cooldown = sum(1 for k in self.keys if k in self.key_cooldown and datetime.now() < self.key_cooldown[k])
        failed = len(self.failed_keys)
        available = total - in_cooldown - failed
        
        return {
            'total_keys': total,
            'current_index': self.current_index + 1,
            'available': available,
            'in_cooldown': in_cooldown,
            'failed': failed,
            'cooldown_details': {
                k[:20] + '...': v.isoformat()
                for k, v in self.key_cooldown.items()
                if datetime.now() < v
            }
        }
    
    def configure_genai(self) -> bool:
        """
        Configure google.generativeai với key hiện tại
        
        Returns:
            True nếu thành công
        """
        try:
            current_key = self.get_current_key()
            genai.configure(api_key=current_key)
            logger.info(f"✅ Configured Gemini API with Key {self.current_index + 1}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to configure Gemini API: {e}")
            return False


# Singleton instance
_api_key_manager: Optional[APIKeyManager] = None


def get_api_key_manager() -> APIKeyManager:
    """Get singleton instance của API Key Manager"""
    global _api_key_manager
    if _api_key_manager is None:
        _api_key_manager = APIKeyManager()
    return _api_key_manager
