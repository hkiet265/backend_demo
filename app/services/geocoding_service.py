"""
Geocoding Service
Automatically infer province/city and region from address
"""
import re
from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)


class GeocodingService:
    """Service for extracting location information from addresses"""
    
    def __init__(self):
        northern_provinces = [
            'Hà Nội', 'Hải Phòng', 'Hải Dương', 'Quảng Ninh', 'Bắc Ninh', 'Bắc Giang',
            'Lạng Sơn', 'Cao Bằng', 'Thái Nguyên', 'Hà Giang', 'Tuyên Quang', 'Lào Cai',
            'Yên Bái', 'Phú Thọ', 'Vĩnh Phúc', 'Hòa Bình', 'Sơn La', 'Điện Biên',
            'Lai Châu', 'Nam Định', 'Hà Nam', 'Thái Bình', 'Ninh Bình', 'Hưng Yên'
        ]

        central_provinces = [
            'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Quảng Bình', 'Quảng Trị', 'Thừa Thiên Huế',
            'Đà Nẵng', 'Quảng Nam', 'Quảng Ngãi', 'Bình Định', 'Phú Yên', 'Khánh Hòa',
            'Ninh Thuận', 'Bình Thuận', 'Kon Tum', 'Gia Lai', 'Đắk Lắk', 'Đắk Nông', 'Lâm Đồng'
        ]

        southern_provinces = [
            'TP.HCM', 'TP. HCM', 'Hồ Chí Minh', 'HCM', 'Sài Gòn',
            'Cần Thơ', 'Đồng Nai', 'Bình Dương', 'Bà Rịa - Vũng Tàu', 'Long An',
            'Tiền Giang', 'Bến Tre', 'Trà Vinh', 'Vĩnh Long', 'Đồng Tháp',
            'An Giang', 'Kiên Giang', 'Hậu Giang', 'Sóc Trăng', 'Bạc Liêu',
            'Cà Mau', 'Tây Ninh', 'Bình Phước'
        ]

        self.location_map = {
            **dict.fromkeys(northern_provinces, 'Bac'),
            **dict.fromkeys(central_provinces, 'Trung'),
            **dict.fromkeys(southern_provinces, 'Nam')
        }

        self.location_patterns = {}
        for location, region in self.location_map.items():

            self.location_patterns[location.lower()] = (location, region)

            variations = [
                location.replace('Đ', 'D').replace('đ', 'd'),
                location.replace('TP.', '').replace('TP. ', '').strip(),
            ]
            
            for var in variations:
                if var:
                    self.location_patterns[var.lower()] = (location, region)
    
    def normalize_address(self, address: str) -> str:
        """Normalize address for processing"""
        if not address:
            return ""

        address = address.replace(',', ' ').replace(';', ' ').replace('  ', ' ')
        return address.strip()
    
    def extract_province(self, address: str) -> Optional[Dict[str, str]]:
        """
        Extract province/city and region from address
        
        Returns dict with:
        - tinh_thanh: str (province/city name)
        - vung_mien: str (Bac/Trung/Nam)
        """
        if not address:
            return None
        
        address_normalized = self.normalize_address(address).lower()

        for pattern, (location, region) in self.location_patterns.items():
            if pattern in address_normalized:
                return {
                    'tinh_thanh': location,
                    'vung_mien': region
                }
        
        return None
    
    def infer_from_phone(self, phone: str) -> Optional[str]:
        """
        Infer region from phone area code (basic heuristic)
        Vietnamese phone area codes roughly correspond to regions
        """
        if not phone:
            return None

        digits = re.sub(r'\D', '', phone)
        
        if not digits:
            return None

        if digits.startswith('84'):
            digits = '0' + digits[2:]
        
        if len(digits) < 3:
            return None

        area_code = digits[1:3]
        

        northern_codes = ['24', '25', '26', '27', '28', '29', '20', '21', '22', '23']
     
        central_codes = ['51', '52', '53', '54', '55', '56', '57', '58', '59']

        southern_codes = ['61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72', '73', '74', '75', '76', '77', '78', '79']
        
        if area_code in northern_codes:
            return 'Bac'
        elif area_code in central_codes:
            return 'Trung'
        elif area_code in southern_codes:
            return 'Nam'
        
        return None
    
    def geocode(self, business_data: Dict) -> Dict:
        """
        Geocode business data - extract and infer location information
        
        Input: business dict with fields like:
        - dia_chi
        - tinh_thanh
        - so_dien_thoai
        - vung_mien
        
        Returns: updated dict with inferred values
        """
        result = business_data.copy()
        

        if business_data.get('dia_chi'):
            location_info = self.extract_province(business_data['dia_chi'])
            
            if location_info:
                if not result.get('tinh_thanh'):
                    result['tinh_thanh'] = location_info['tinh_thanh']

                if not result.get('vung_mien'):
                    result['vung_mien'] = location_info['vung_mien']

        if result.get('tinh_thanh') and not result.get('vung_mien'):
            region = self.location_map.get(result['tinh_thanh'])
            if region:
                result['vung_mien'] = region

        if not result.get('vung_mien') and business_data.get('so_dien_thoai'):
            region = self.infer_from_phone(business_data['so_dien_thoai'])
            if region:
                result['vung_mien'] = region
                logger.info(f"Inferred region from phone: {region}")
        
        return result

_geocoding_service = None

def get_geocoding_service() -> GeocodingService:
    """Get or create geocoding service instance"""
    global _geocoding_service
    if _geocoding_service is None:
        _geocoding_service = GeocodingService()
    return _geocoding_service
