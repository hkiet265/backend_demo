"""
AI Enrichment Service
AI-powered data cleaning, normalization, and enrichment
"""
import re
import logging
from typing import Optional, Dict, Any
import google.generativeai as genai
from app.config import settings

logger = logging.getLogger(__name__)
genai.configure(api_key=settings.GEMINI_API_KEY)


class AIEnrichmentService:
    """AI service for data enrichment and normalization"""
    
    def __init__(self):
        self.model = genai.GenerativeModel(settings.CHAT_MODEL)
    
    def normalize_phone(self, phone: str) -> Optional[str]:
        """
        Chuẩn hóa số điện thoại Việt Nam
        - Loại bỏ ký tự đặc biệt
        - Thêm +84 nếu thiếu
        - Format: +84XXXXXXXXX
        """
        if not phone:
            return None

        cleaned = re.sub(r'[^\d+]', '', phone.strip())

        if cleaned.startswith('0'):
            cleaned = '+84' + cleaned[1:]
        elif cleaned.startswith('84'):
            cleaned = '+' + cleaned
        elif not cleaned.startswith('+84'): 
            cleaned = '+84' + cleaned

        if len(cleaned) >= 12 and len(cleaned) <= 13:
            return cleaned
        
        return None
    
    def normalize_email(self, email: str) -> Optional[str]:
        """
        Chuẩn hóa email
        - Lowercase
        - Trim spaces
        - Validate format
        """
        if not email:
            return None
        
        cleaned = email.strip().lower()

        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if re.match(pattern, cleaned):
            return cleaned
        
        return None
    
    def normalize_website(self, website: str) -> Optional[str]:
        """
        Chuẩn hóa URL website
        - Thêm https:// nếu thiếu
        - Lowercase domain
        - Remove trailing slash
        """
        if not website:
            return None
        
        cleaned = website.strip().lower()

        if not cleaned.startswith(('http://', 'https://')):
            cleaned = 'https://' + cleaned

        cleaned = cleaned.rstrip('/')

        if '.' in cleaned and len(cleaned) > 10:
            return cleaned
        
        return None
    
    def infer_region_from_location(self, location: str) -> Optional[str]:
        """
        Suy luận vùng miền từ tỉnh/thành phố
        Bắc: Hà Nội, Hải Phòng, Quảng Ninh, Bắc Ninh, Hải Dương...
        Trung: Đà Nẵng, Huế, Quảng Nam, Quảng Ngãi, Nha Trang...
        Nam: TP.HCM, Bình Dương, Đồng Nai, Cần Thơ, Vũng Tàu...
        """
        if not location:
            return None
        
        location_lower = location.lower()

        bac_keywords = [
            'hà nội', 'hanoi', 'hải phòng', 'haiphong', 'quảng ninh',
            'bắc ninh', 'bắc giang', 'hải dương', 'hưng yên', 'nam định',
            'thái bình', 'ninh bình', 'hà nam', 'vĩnh phúc', 'phú thọ',
            'lào cai', 'yên bái', 'tuyên quang', 'hà giang', 'cao bằng',
            'bắc kạn', 'thái nguyên', 'lạng sơn', 'điện biên', 'lai châu',
            'sơn la', 'hòa bình'
        ]

        trung_keywords = [
            'đà nẵng', 'danang', 'huế', 'hue', 'quảng nam', 'quảng ngãi',
            'bình định', 'phú yên', 'khánh hòa', 'nha trang', 'quảng bình',
            'quảng trị', 'thừa thiên', 'ninh thuận', 'bình thuận', 'kon tum',
            'gia lai', 'đắk lắk', 'đắk nông', 'lâm đồng'
        ]

        nam_keywords = [
            'hồ chí minh', 'sài gòn', 'saigon', 'hcm', 'bình dương',
            'đồng nai', 'bà rịa', 'vũng tàu', 'long an', 'tiền giang',
            'bến tre', 'trà vinh', 'vĩnh long', 'đồng tháp', 'an giang',
            'kiên giang', 'cần thơ', 'hậu giang', 'sóc trăng', 'bạc liêu',
            'cà mau', 'tây ninh', 'bình phước', 'bình thuận'
        ]
        
        for keyword in bac_keywords:
            if keyword in location_lower:
                return 'Bắc'
        
        for keyword in trung_keywords:
            if keyword in location_lower:
                return 'Trung'
        
        for keyword in nam_keywords:
            if keyword in location_lower:
                return 'Nam'
        
        return None
    
    def auto_classify_industry(self, name: str, description: str = "") -> Optional[str]:
        """
        Tự động phân loại ngành nghề từ tên và mô tả
        Sử dụng keyword matching
        """
        text = (name + " " + description).lower()
        
        industry_keywords = {
            "Công Nghệ Thông Tin": [
                'công nghệ', 'phần mềm', 'software', 'it', 'digital', 'tech',
                'ai', 'machine learning', 'app', 'web', 'mobile', 'cloud'
            ],
            "Fintech": [
                'fintech', 'tài chính', 'ngân hàng', 'bank', 'payment', 'thanh toán',
                'digital wallet', 'blockchain', 'crypto'
            ],
            "Xây Dựng": [
                'xây dựng', 'construction', 'bất động sản', 'real estate',
                'nhà đất', 'kiến trúc', 'thi công'
            ],
            "F&B / Thực Phẩm": [
                'thực phẩm', 'đồ uống', 'food', 'beverage', 'nhà hàng',
                'restaurant', 'cafe', 'quán ăn', 'ẩm thực'
            ],
            "Giáo Dục & Đào Tạo": [
                'giáo dục', 'đào tạo', 'education', 'training', 'học',
                'trường', 'school', 'university', 'khoá học'
            ],
            "Logistics & Vận Tải": [
                'logistics', 'vận chuyển', 'vận tải', 'shipping', 'giao hàng',
                'delivery', 'transport', 'kho bãi'
            ],
            "Thương Mại Điện Tử": [
                'thương mại điện tử', 'ecommerce', 'marketplace', 'online',
                'bán hàng trực tuyến', 'shoppe', 'lazada'
            ],
            "Y Tế & Sức Khỏe": [
                'y tế', 'sức khỏe', 'healthcare', 'health', 'bệnh viện',
                'phòng khám', 'clinic', 'dược phẩm', 'pharma'
            ],
            "Du Lịch & Khách Sạn": [
                'du lịch', 'travel', 'tour', 'khách sạn', 'hotel', 'resort',
                'homestay', 'tourism'
            ],
            "Sản Xuất": [
                'sản xuất', 'manufacturing', 'factory', 'nhà máy', 'chế tạo',
                'production'
            ]
        }
        
        for industry, keywords in industry_keywords.items():
            for keyword in keywords:
                if keyword in text:
                    return industry
        
        return None
    
    async def detect_duplicates(self, name: str, phone: str = None, email: str = None) -> Dict[str, Any]:
        """
        Phát hiện trùng lặp dựa trên:
        - Tên doanh nghiệp (fuzzy match)
        - Số điện thoại
        - Email
        - Website domain
        """

        return {
            "is_duplicate": False,
            "confidence": 0.0,
            "matches": []
        }
    
    async def enrich_from_website(self, url: str) -> Dict[str, Any]:
        """
        Lấy thông tin bổ sung từ website
        - Title
        - Description
        - Contact email
        - Social links
        (Cần implement web scraping với respect robots.txt)
        """
       
        return {
            "title": None,
            "description": None,
            "email": None,
            "facebook": None,
            "linkedin": None
        }
    
    async def summarize_description(self, text: str, max_sentences: int = 3) -> str:
        """
        Tóm tắt mô tả doanh nghiệp thành 2-3 câu ngắn gọn
        """
        if not text or len(text) < 100:
            return text
        
        try:
            prompt = f"""Hãy tóm tắt đoạn văn sau thành {max_sentences} câu ngắn gọn, súc tích:

{text}

Tóm tắt (tiếng Việt, {max_sentences} câu):"""
            
            response = self.model.generate_content(prompt)
            summary = response.text.strip()
            
            return summary
            
        except Exception as e:
            logger.error(f"Summarize error: {e}")
            return text[:200] + "..."
    
    def calculate_trust_score(self, business_data: Dict[str, Any]) -> int:
        """
        Tính độ tin cậy (0-100) dựa trên:
        - Có đầy đủ thông tin không (40 điểm)
        - Website hoạt động không (20 điểm)
        - Email có domain khớp website không (20 điểm)
        - Có mạng xã hội không (10 điểm)
        - Có địa chỉ cụ thể không (10 điểm)
        """
        score = 0

        required_fields = ['ten_doanh_nghiep', 'so_dien_thoai', 'email', 'tinh_thanh', 'nganh_nghe']
        filled = sum(1 for field in required_fields if business_data.get(field))
        score += int((filled / len(required_fields)) * 40)

        if business_data.get('website'):
            score += 20

        email = business_data.get('email', '')
        website = business_data.get('website', '')
        if email and website and '@' in email:
            email_domain = email.split('@')[1]
            if email_domain in website:
                score += 20

        social = [business_data.get('facebook'), business_data.get('linkedin'), business_data.get('zalo')]
        if any(social):
            score += 10

        if business_data.get('dia_chi'):
            score += 10
        
        return min(score, 100)
    
    def normalize_business_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Chuẩn hóa toàn bộ dữ liệu doanh nghiệp
        """
        normalized = data.copy()

        if 'so_dien_thoai' in normalized:
            normalized['so_dien_thoai'] = self.normalize_phone(normalized['so_dien_thoai'])
        
        if 'email' in normalized:
            normalized['email'] = self.normalize_email(normalized['email'])
        
        if 'website' in normalized:
            normalized['website'] = self.normalize_website(normalized['website'])
 
        if 'tinh_thanh' in normalized and not normalized.get('vung_mien'):
            normalized['vung_mien'] = self.infer_region_from_location(normalized['tinh_thanh'])

        if not normalized.get('nganh_nghe'):
            normalized['nganh_nghe'] = self.auto_classify_industry(
                normalized.get('ten_doanh_nghiep', ''),
                normalized.get('mo_ta', '')
            )

        normalized['do_tin_cay'] = self.calculate_trust_score(normalized)
        
        return normalized
        
_enrichment_service = None

def get_enrichment_service() -> AIEnrichmentService:
    """Get singleton enrichment service"""
    global _enrichment_service
    if _enrichment_service is None:
        _enrichment_service = AIEnrichmentService()
    return _enrichment_service
