"""
Named Entity Recognition (NER) Service
Trích xuất thực thể từ tin tức: địa danh, tổ chức, nhân vật, thời gian
"""
import re
import logging
from typing import Dict, List, Optional
from app.services.groq_service import get_groq_service

logger = logging.getLogger(__name__)


class NERService:
    """
    Service for extracting named entities from news content
    
    Entity types:
    - LOCATION: Địa danh (tỉnh/thành, quốc gia, địa điểm cụ thể)
    - ORGANIZATION: Tổ chức (công ty, cơ quan, đơn vị)
    - PERSON: Nhân vật (tên người)
    - TIME: Thời gian (ngày, tháng, năm, sự kiện)
    - EVENT: Sự kiện (hội nghị, triển lãm, lễ hội)
    """
    
    def __init__(self):
        self.groq_service = get_groq_service()
        
        # Từ khóa địa danh Việt Nam
        self.vietnam_locations = [
            'Hà Nội', 'Hải Phòng', 'Đà Nẵng', 'TP.HCM', 'Hồ Chí Minh', 'Cần Thơ',
            'Quảng Ninh', 'Bắc Ninh', 'Bắc Giang', 'Hải Dương', 'Hưng Yên',
            'Thái Bình', 'Nam Định', 'Ninh Bình', 'Thanh Hóa', 'Nghệ An',
            'Hà Tĩnh', 'Quảng Bình', 'Quảng Trị', 'Huế', 'Quảng Nam', 'Quảng Ngãi',
            'Bình Định', 'Phú Yên', 'Khánh Hòa', 'Nha Trang', 'Đắk Lắk',
            'Đắk Nông', 'Lâm Đồng', 'Bình Phước', 'Tây Ninh', 'Bình Dương',
            'Đồng Nai', 'Bà Rịa - Vũng Tàu', 'Long An', 'Tiền Giang', 'Bến Tre',
            'Vĩnh Long', 'Trà Vinh', 'Đồng Tháp', 'An Giang', 'Kiên Giang',
            'Hậu Giang', 'Sóc Trăng', 'Bạc Liêu', 'Cà Mau', 'Việt Nam', 'Vietnam'
        ]
        
        # Tổ chức phổ biến
        self.common_orgs = [
            'Bộ', 'Ủy ban', 'Tập đoàn', 'Công ty', 'Ngân hàng', 'Liên đoàn',
            'Hiệp hội', 'Đại học', 'Viện', 'Trung tâm', 'Sở', 'Chi cục',
            'Cục', 'Ban', 'Phòng', 'Văn phòng'
        ]
    
    def extract_locations_rule_based(self, text: str) -> List[str]:
        """
        Trích xuất địa danh bằng rule-based (keywords)
        """
        locations = set()
        
        for location in self.vietnam_locations:
            # Tìm chính xác (word boundary)
            pattern = r'\b' + re.escape(location) + r'\b'
            if re.search(pattern, text, re.IGNORECASE):
                locations.add(location)
        
        return list(locations)
    
    def extract_orgs_rule_based(self, text: str) -> List[str]:
        """
        Trích xuất tổ chức bằng rule-based
        Tìm pattern: [Tên riêng] + [Loại tổ chức]
        VD: "Ngân hàng BIDV", "Tập đoàn FPT", "Bộ Công Thương"
        """
        orgs = set()
        
        for org_type in self.common_orgs:
            # Pattern: [Tên] + [Loại tổ chức]
            # VD: "Tập đoàn FPT", "Ngân hàng BIDV"
            pattern = rf'([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]*\s+)*{org_type}\s+([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][A-Za-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]*)'
            matches = re.findall(pattern, text)
            for match in matches:
                org_name = org_type + ' ' + match[-1].strip()
                if len(org_name) > 5:  # Lọc tên quá ngắn
                    orgs.add(org_name)
            
            # Pattern: [Loại tổ chức] + [Tên]
            # VD: "Bộ Công Thương", "Sở Giáo dục"
            pattern2 = rf'{org_type}\s+([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][A-Za-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]+)'
            matches2 = re.findall(pattern2, text)
            for match in matches2:
                org_name = org_type + ' ' + match.strip()
                if len(org_name) > 5:
                    orgs.add(org_name)
        
        return list(orgs)[:10]  # Giới hạn 10 tổ chức
    
    def extract_persons_rule_based(self, text: str) -> List[str]:
        """
        Trích xuất tên người bằng rule-based
        Pattern: Ông/Bà/Anh/Chị + [Tên riêng in hoa]
        """
        persons = set()
        
        # Pattern: Ông/Bà/Anh/Chị + Tên
        titles = ['Ông', 'Bà', 'Anh', 'Chị', 'Tiến sĩ', 'Giáo sư', 'Thạc sĩ', 'Kỹ sư']
        for title in titles:
            pattern = rf'{title}\s+([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+(?:\s+[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+)*)'
            matches = re.findall(pattern, text)
            for match in matches:
                if len(match) > 3:  # Lọc tên quá ngắn
                    persons.add(match)
        
        return list(persons)[:10]  # Giới hạn 10 người
    
    def extract_time_expressions(self, text: str) -> List[str]:
        """
        Trích xuất biểu thức thời gian
        """
        times = set()
        
        # Patterns thời gian
        patterns = [
            r'\b\d{1,2}/\d{1,2}/\d{4}\b',  # 01/01/2024
            r'\bngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4}\b',
            r'\btháng\s+\d{1,2}\s+năm\s+\d{4}\b',
            r'\bnăm\s+\d{4}\b',
            r'\bquý\s+[1-4]/\d{4}\b',
            r'\bhôm nay\b', r'\bhôm qua\b', r'\bngày mai\b',
            r'\btuần này\b', r'\btuần trước\b', r'\btháng này\b', r'\btháng trước\b',
            r'\bnăm nay\b', r'\bnăm trước\b'
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            times.update(matches)
        
        return list(times)[:5]  # Giới hạn 5 biểu thức thời gian
    
    def extract_entities_with_ai(self, text: str) -> Dict[str, List[str]]:
        """
        Trích xuất thực thể bằng AI (Groq)
        """
        if not self.groq_service or len(text) < 50:
            return {'locations': [], 'organizations': [], 'persons': [], 'times': [], 'events': []}
        
        try:
            system_prompt = """Bạn là chuyên gia trích xuất thực thể từ tin tức tiếng Việt.
Nhiệm vụ: Trích xuất các thực thể quan trọng từ văn bản tin tức.

Định dạng trả về (JSON):
{
  "locations": ["Địa danh 1", "Địa danh 2"],
  "organizations": ["Tổ chức 1", "Tổ chức 2"],
  "persons": ["Người 1", "Người 2"],
  "times": ["Thời gian 1"],
  "events": ["Sự kiện 1"]
}

Lưu ý:
- Chỉ trích xuất thực thể quan trọng, không liệt kê tất cả
- Mỗi loại tối đa 5 thực thể
- Trả về JSON hợp lệ"""

            user_prompt = f"Trích xuất thực thể từ tin tức sau:\n\n{text[:1000]}"
            
            response = self.groq_service.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.3,
                max_tokens=500
            )
            
            if response:
                # Parse JSON response
                import json
                # Tìm JSON trong response
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                if json_match:
                    entities = json.loads(json_match.group())
                    return entities
            
            return {'locations': [], 'organizations': [], 'persons': [], 'times': [], 'events': []}
            
        except Exception as e:
            logger.error(f"AI NER error: {e}")
            return {'locations': [], 'organizations': [], 'persons': [], 'times': [], 'events': []}
    
    def extract_entities(self, text: str, use_ai: bool = False) -> Dict[str, List[str]]:
        """
        Trích xuất toàn bộ thực thể từ văn bản
        
        Args:
            text: Nội dung tin tức
            use_ai: Có sử dụng AI không (tốn API quota)
            
        Returns:
            Dict with entity types as keys
        """
        if not text:
            return {'locations': [], 'organizations': [], 'persons': [], 'times': [], 'events': []}
        
        # Rule-based extraction (luôn chạy, nhanh và miễn phí)
        locations = self.extract_locations_rule_based(text)
        orgs = self.extract_orgs_rule_based(text)
        persons = self.extract_persons_rule_based(text)
        times = self.extract_time_expressions(text)
        
        entities = {
            'locations': locations,
            'organizations': orgs,
            'persons': persons,
            'times': times,
            'events': []
        }
        
        # AI-based extraction (optional, tốn quota)
        if use_ai:
            try:
                ai_entities = self.extract_entities_with_ai(text)
                # Merge với rule-based, ưu tiên AI
                for key in ['locations', 'organizations', 'persons', 'times', 'events']:
                    if ai_entities.get(key):
                        # Combine và deduplicate
                        combined = set(entities.get(key, [])) | set(ai_entities[key])
                        entities[key] = list(combined)[:10]  # Giới hạn 10
            except Exception as e:
                logger.error(f"AI entity extraction failed: {e}")
        
        return entities
    
    def enrich_news_with_entities(self, news_item: Dict) -> Dict:
        """
        Làm giàu tin tức với thực thể
        
        Args:
            news_item: Dict với các trường tin tức
            
        Returns:
            Dict với thêm trường 'thuc_the'
        """
        # Lấy nội dung để extract
        content = ""
        if news_item.get('tieu_de'):
            content += news_item['tieu_de'] + ". "
        if news_item.get('tom_tat'):
            content += news_item['tom_tat'] + ". "
        if news_item.get('noi_dung_gon'):
            content += news_item['noi_dung_gon']
        
        # Extract entities
        entities = self.extract_entities(content, use_ai=False)
        
        # Thêm vào news item
        enriched = news_item.copy()
        enriched['thuc_the'] = entities
        
        return enriched


_ner_service = None

def get_ner_service() -> NERService:
    """Get singleton NER service"""
    global _ner_service
    if _ner_service is None:
        _ner_service = NERService()
    return _ner_service
