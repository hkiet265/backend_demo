"""
Encryption Service
Encrypts/decrypts sensitive data (phone, email, address)
"""
from cryptography.fernet import Fernet
import base64
import hashlib
import logging
import os

logger = logging.getLogger(__name__)


class EncryptionService:
    def __init__(self, encryption_key: str = None):
        """
        Initialize encryption service
        
        Args:
            encryption_key: Base64-encoded Fernet key
        """
        if not encryption_key:
            # Try to import settings
            try:
                from app.config import settings
                encryption_key = settings.ENCRYPTION_KEY
            except:
                encryption_key = os.getenv('ENCRYPTION_KEY')
            
            if not encryption_key:
                logger.warning("⚠️  ENCRYPTION_KEY not found in environment!")
                encryption_key = Fernet.generate_key().decode()
                logger.warning(f"⚠️  Generated temporary key (NOT FOR PRODUCTION): {encryption_key}")
                logger.warning("⚠️  Add to .env: ENCRYPTION_KEY=" + encryption_key)
        
        if isinstance(encryption_key, str):
            encryption_key = encryption_key.encode()
        
        try:
            self.cipher = Fernet(encryption_key)
            logger.info("✅ Encryption service initialized")
        except Exception as e:
            logger.error(f"Failed to initialize encryption: {e}")
            raise
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt sensitive data
        
        Args:
            plaintext: Data to encrypt
            
        Returns:
            Base64-encoded encrypted string
        """
        if not plaintext:
            return None
        
        try:
            encrypted = self.cipher.encrypt(plaintext.encode())
            return base64.b64encode(encrypted).decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            return None
    
    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt sensitive data
        
        Args:
            ciphertext: Base64-encoded encrypted string
            
        Returns:
            Decrypted plaintext or placeholder if failed
        """
        if not ciphertext:
            return None
        
        try:
            decoded = base64.b64decode(ciphertext.encode())
            decrypted = self.cipher.decrypt(decoded)
            return decrypted.decode()
        except Exception as e:
            logger.warning(f"Decryption failed (wrong key?): {str(e)[:50]}")
            return None  # Return None instead of placeholder to let caller handle
    
    def encrypt_phone(self, phone: str) -> str:
        """
        Encrypt phone number
        
        Args:
            phone: Phone number
            
        Returns:
            Encrypted phone or None
        """
        if not phone:
            return None
        
        phone = phone.strip()
        if len(phone) < 8:
            return phone
        
        return self.encrypt(phone)
    
    def decrypt_phone(self, encrypted_phone: str) -> str:
        """
        Decrypt phone number
        
        Args:
            encrypted_phone: Encrypted phone
            
        Returns:
            Decrypted phone
        """
        return self.decrypt(encrypted_phone)
    
    def encrypt_email(self, email: str) -> str:
        """
        Encrypt email address
        
        Args:
            email: Email address
            
        Returns:
            Encrypted email or None
        """
        if not email:
            return None
        
        email = email.strip().lower()
        return self.encrypt(email)
    
    def decrypt_email(self, encrypted_email: str) -> str:
        """
        Decrypt email address
        
        Args:
            encrypted_email: Encrypted email
            
        Returns:
            Decrypted email
        """
        return self.decrypt(encrypted_email)
    
    def encrypt_bytes(self, data: bytes) -> bytes:
        """Encrypt raw binary data (e.g. an uploaded CV file) — the
        string-based encrypt() above assumes UTF-8 text and would raise on
        arbitrary binary content."""
        return self.cipher.encrypt(data)

    def decrypt_bytes(self, token: bytes) -> bytes:
        return self.cipher.decrypt(token)

    def hash_for_search(self, value: str) -> str:
        """
        Create one-way hash for search/deduplication
        Cannot be reversed to get original value
        
        Args:
            value: Value to hash
            
        Returns:
            16-char hash string
        """
        if not value:
            return None
        
        value = value.strip().lower()
        return hashlib.sha256(value.encode()).hexdigest()[:16]
    
    def mask_phone(self, phone: str) -> str:
        """
        Mask phone number for display (show last 4 digits only)
        
        Args:
            phone: Phone number
            
        Returns:
            Masked phone (e.g., "***1234")
        """
        if not phone or len(phone) < 8:
            return phone
        
        return "*" * (len(phone) - 4) + phone[-4:]
    
    def mask_email(self, email: str) -> str:
        """
        Mask email for display (show first 2 chars + domain)
        
        Args:
            email: Email address
            
        Returns:
            Masked email (e.g., "ab***@example.com")
        """
        if not email or '@' not in email:
            return email
        
        local, domain = email.split('@', 1)
        if len(local) <= 2:
            return f"**@{domain}"
        
        return f"{local[:2]}***@{domain}"


# Global instance
_encryption_service = None


def get_encryption_service() -> EncryptionService:
    """Get or create encryption service instance"""
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = EncryptionService()
    return _encryption_service
