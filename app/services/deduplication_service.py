"""
Business Deduplication Service
Fuzzy matching to detect duplicate businesses
"""
from difflib import SequenceMatcher
import re
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class DeduplicationService:
    """Service for detecting duplicate businesses using fuzzy matching"""
    
    def __init__(self):
        self.similarity_threshold = 0.85
        self.name_threshold = 0.90
        
    def normalize_text(self, text: str) -> str:
        """Normalize text for comparison"""
        if not text:
            return ""

        text = text.lower()

        company_suffixes = [
            'công ty', 'cty', 'tnhh', 'cổ phần', 'cp', 'limited', 'ltd',
            'co.,', 'corp', 'inc', 'joint stock company', 'jsc'
        ]
        for suffix in company_suffixes:
            text = text.replace(suffix, '')

        text = re.sub(r'[^\w\s]', '', text)

        text = ' '.join(text.split())
        
        return text.strip()
    
    def normalize_phone(self, phone: str) -> str:
        """Normalize phone number for comparison"""
        if not phone:
            return ""

        digits = re.sub(r'\D', '', phone)

        if digits.startswith('84'):
            return digits
        elif digits.startswith('0'):
            return '84' + digits[1:]
        else:
            return '84' + digits
    
    def normalize_email(self, email: str) -> str:
        """Normalize email for comparison"""
        if not email:
            return ""
        return email.lower().strip()
    
    def normalize_domain(self, website: str) -> str:
        """Extract and normalize domain from website"""
        if not website:
            return ""

        domain = re.sub(r'https?://', '', website.lower())
        domain = re.sub(r'^www\.', '', domain)
        domain = domain.split('/')[0].split('?')[0]
        domain = domain.split(':')[0]
        
        return domain.strip()
    
    def text_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two texts using SequenceMatcher"""
        if not text1 or not text2:
            return 0.0
        
        norm1 = self.normalize_text(text1)
        norm2 = self.normalize_text(text2)
        
        if not norm1 or not norm2:
            return 0.0
        
        return SequenceMatcher(None, norm1, norm2).ratio()
    
    def is_duplicate(
        self,
        business1: Dict,
        business2: Dict
    ) -> Dict:
        """
        Check if two businesses are duplicates
        
        Returns dict with:
        - is_duplicate: bool
        - confidence: float (0-1)
        - reasons: List[str]
        - matching_fields: List[str]
        """
        reasons = []
        matching_fields = []
        max_confidence = 0.0

        phone1 = self.normalize_phone(business1.get('so_dien_thoai', ''))
        phone2 = self.normalize_phone(business2.get('so_dien_thoai', ''))
        
        if phone1 and phone2 and phone1 == phone2:
            reasons.append(f"Trùng số điện thoại: {business1.get('so_dien_thoai')}")
            matching_fields.append('phone')
            max_confidence = max(max_confidence, 0.95)

        email1 = self.normalize_email(business1.get('email', ''))
        email2 = self.normalize_email(business2.get('email', ''))
        
        if email1 and email2 and email1 == email2:
            reasons.append(f"Trùng email: {email1}")
            matching_fields.append('email')
            max_confidence = max(max_confidence, 0.90)

        domain1 = self.normalize_domain(business1.get('website', ''))
        domain2 = self.normalize_domain(business2.get('website', ''))
        
        if domain1 and domain2 and domain1 == domain2:
            reasons.append(f"Trùng website: {domain1}")
            matching_fields.append('website')
            max_confidence = max(max_confidence, 0.90)

        name1 = business1.get('ten_doanh_nghiep', '')
        name2 = business2.get('ten_doanh_nghiep', '')
        name_similarity = self.text_similarity(name1, name2)
        
        if name_similarity >= self.name_threshold:
            reasons.append(f"Tên tương tự {int(name_similarity * 100)}%: {name1} ≈ {name2}")
            matching_fields.append('name')
            max_confidence = max(max_confidence, name_similarity * 0.85)

        if name_similarity >= 0.70:
            addr1 = business1.get('dia_chi', '')
            addr2 = business2.get('dia_chi', '')
            
            if addr1 and addr2:
                addr_similarity = self.text_similarity(addr1, addr2)
                
                if addr_similarity >= 0.75:
                    reasons.append(f"Địa chỉ tương tự {int(addr_similarity * 100)}%")
                    matching_fields.append('address')
                    combined_confidence = (name_similarity + addr_similarity) / 2
                    max_confidence = max(max_confidence, combined_confidence * 0.95)

        tax1 = business1.get('ma_so_thue', '')
        tax2 = business2.get('ma_so_thue', '')
        
        if tax1 and tax2:
            tax1_clean = re.sub(r'\D', '', tax1)
            tax2_clean = re.sub(r'\D', '', tax2)
            
            if tax1_clean and tax2_clean and tax1_clean == tax2_clean:
                reasons.append(f"Trùng mã số thuế: {tax1}")
                matching_fields.append('tax_code')
                max_confidence = max(max_confidence, 1.0)

        is_duplicate = max_confidence >= self.similarity_threshold
        
        return {
            'is_duplicate': is_duplicate,
            'confidence': round(max_confidence, 2),
            'reasons': reasons,
            'matching_fields': matching_fields
        }
    
    def find_duplicates(
        self,
        business: Dict,
        existing_businesses: List[Dict]
    ) -> List[Dict]:
        """
        Find potential duplicates of a business in a list
        
        Returns list of potential duplicates with metadata
        """
        duplicates = []
        
        for existing in existing_businesses:
            if business.get('id') == existing.get('id'):
                continue
            
            result = self.is_duplicate(business, existing)
            
            if result['is_duplicate']:
                duplicates.append({
                    'business': existing,
                    'confidence': result['confidence'],
                    'reasons': result['reasons'],
                    'matching_fields': result['matching_fields']
                })

        duplicates.sort(key=lambda x: x['confidence'], reverse=True)
        
        return duplicates
_dedup_service = None

def get_deduplication_service() -> DeduplicationService:
    """Get or create deduplication service instance"""
    global _dedup_service
    if _dedup_service is None:
        _dedup_service = DeduplicationService()
    return _dedup_service
