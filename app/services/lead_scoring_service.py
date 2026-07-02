"""
Lead Scoring Service
Chấm điểm doanh nghiệp theo tiêu chí ưu tiên
"""
import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)


class LeadScoringService:
    """
    Service for scoring business leads based on various criteria
    
    Scoring criteria:
    - Data completeness (30 points)
    - Industry match (20 points)
    - Region preference (15 points)
    - Company size (15 points)
    - Trust score (10 points)
    - Recency (10 points)
    """
    
    def __init__(self):
        # Các ngành nghề ưu tiên (có thể config từ DB)
        self.priority_industries = {
            "Công Nghệ Thông Tin": 20,
            "Fintech": 20,
            "Thương Mại Điện Tử": 18,
            "Y Tế & Sức Khỏe": 16,
            "Giáo Dục & Đào Tạo": 15,
            "F&B / Thực Phẩm": 14,
            "Du Lịch & Khách Sạn": 12,
            "Logistics & Vận Tải": 10,
            "Xây Dựng": 8,
            "Sản Xuất": 8
        }
        
        # Vùng miền ưu tiên
        self.priority_regions = {
            "Nam": 15,  # TP.HCM và miền Nam
            "Bac": 12,  # Hà Nội và miền Bắc
            "Trung": 10  # Miền Trung
        }
        
        # Quy mô ưu tiên
        self.company_sizes = {
            "500+": 15,
            "200-500": 14,
            "100-200": 13,
            "50-100": 12,
            "30-50": 10,
            "10-30": 8,
            "1-10": 5
        }
    
    def score_completeness(self, business: Dict[str, Any]) -> int:
        """
        Chấm điểm độ đầy đủ thông tin (0-30 điểm)
        
        Required fields:
        - ten_doanh_nghiep (mandatory)
        - so_dien_thoai (8 points)
        - email (8 points)
        - website (6 points)
        - dia_chi (4 points)
        - tinh_thanh (2 points)
        - nganh_nghe (2 points)
        """
        score = 0
        
        # Tên doanh nghiệp luôn có (được validate khi tạo)
        
        if business.get('so_dien_thoai'):
            score += 8
        
        if business.get('email'):
            score += 8
        
        if business.get('website'):
            score += 6
        
        if business.get('dia_chi'):
            score += 4
        
        if business.get('tinh_thanh'):
            score += 2
        
        if business.get('nganh_nghe'):
            score += 2
        
        return min(score, 30)
    
    def score_industry(self, business: Dict[str, Any]) -> int:
        """
        Chấm điểm theo ngành nghề (0-20 điểm)
        """
        industry = business.get('nganh_nghe', '')
        
        if not industry:
            return 0
        
        # Tìm ngành phù hợp nhất
        for priority_ind, points in self.priority_industries.items():
            if priority_ind.lower() in industry.lower() or industry.lower() in priority_ind.lower():
                return points
        
        # Ngành không ưu tiên vẫn được 5 điểm cơ bản
        return 5
    
    def score_region(self, business: Dict[str, Any]) -> int:
        """
        Chấm điểm theo vùng miền (0-15 điểm)
        """
        region = business.get('vung_mien', '')
        
        if not region:
            return 0
        
        return self.priority_regions.get(region, 0)
    
    def score_company_size(self, business: Dict[str, Any]) -> int:
        """
        Chấm điểm theo quy mô (0-15 điểm)
        """
        size = business.get('quy_mo', '')
        
        if not size:
            return 0
        
        # Tìm quy mô phù hợp
        for size_range, points in self.company_sizes.items():
            if size_range in size or size in size_range:
                return points
        
        # Parse số nhân viên nếu có format khác
        import re
        numbers = re.findall(r'\d+', size)
        if numbers:
            max_num = max([int(n) for n in numbers])
            if max_num >= 500:
                return 15
            elif max_num >= 200:
                return 14
            elif max_num >= 100:
                return 13
            elif max_num >= 50:
                return 12
            elif max_num >= 30:
                return 10
            elif max_num >= 10:
                return 8
            else:
                return 5
        
        return 0
    
    def score_trust(self, business: Dict[str, Any]) -> int:
        """
        Chấm điểm độ tin cậy (0-10 điểm)
        Dựa trên do_tin_cay field (0-100)
        """
        trust_score = business.get('do_tin_cay', 0)
        
        # Convert 0-100 thành 0-10
        return int(trust_score / 10)
    
    def score_recency(self, business: Dict[str, Any]) -> int:
        """
        Chấm điểm độ mới (0-10 điểm)
        Doanh nghiệp mới thêm/cập nhật gần đây có điểm cao hơn
        """
        updated_at = business.get('updated_at')
        
        if not updated_at:
            return 5  # Điểm trung bình nếu không có thông tin
        
        try:
            # Parse datetime
            if isinstance(updated_at, str):
                from dateutil import parser
                updated_dt = parser.parse(updated_at)
            else:
                updated_dt = updated_at
            
            now = datetime.now(updated_dt.tzinfo) if updated_dt.tzinfo else datetime.now()
            days_ago = (now - updated_dt).days
            
            # Điểm giảm dần theo thời gian
            if days_ago <= 7:
                return 10
            elif days_ago <= 30:
                return 8
            elif days_ago <= 90:
                return 6
            elif days_ago <= 180:
                return 4
            else:
                return 2
                
        except Exception as e:
            logger.error(f"Recency score error: {e}")
            return 5
    
    def calculate_lead_score(self, business: Dict[str, Any]) -> Dict[str, Any]:
        """
        Tính tổng điểm lead (0-100)
        
        Returns:
            Dict with:
            - total_score (0-100)
            - breakdown: Dict with individual scores
            - grade: A/B/C/D/F
        """
        scores = {
            'completeness': self.score_completeness(business),
            'industry': self.score_industry(business),
            'region': self.score_region(business),
            'company_size': self.score_company_size(business),
            'trust': self.score_trust(business),
            'recency': self.score_recency(business)
        }
        
        total = sum(scores.values())
        
        # Phân loại grade
        if total >= 80:
            grade = 'A'
        elif total >= 65:
            grade = 'B'
        elif total >= 50:
            grade = 'C'
        elif total >= 35:
            grade = 'D'
        else:
            grade = 'F'
        
        return {
            'total_score': total,
            'breakdown': scores,
            'grade': grade
        }
    
    def rank_businesses(self, businesses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Xếp hạng danh sách doanh nghiệp theo lead score
        
        Args:
            businesses: List of business dicts
            
        Returns:
            List of businesses với thêm trường lead_score, sorted by score descending
        """
        scored_businesses = []
        
        for business in businesses:
            score_info = self.calculate_lead_score(business)
            business_with_score = business.copy()
            business_with_score['lead_score'] = score_info['total_score']
            business_with_score['lead_grade'] = score_info['grade']
            business_with_score['score_breakdown'] = score_info['breakdown']
            scored_businesses.append(business_with_score)
        
        # Sắp xếp theo điểm giảm dần
        scored_businesses.sort(key=lambda x: x['lead_score'], reverse=True)
        
        return scored_businesses
    
    def filter_by_score(
        self, 
        businesses: List[Dict[str, Any]], 
        min_score: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Lọc doanh nghiệp theo điểm tối thiểu
        
        Args:
            businesses: List of businesses
            min_score: Minimum lead score (0-100)
            
        Returns:
            Filtered and ranked list
        """
        ranked = self.rank_businesses(businesses)
        return [b for b in ranked if b['lead_score'] >= min_score]


_scoring_service = None

def get_scoring_service() -> LeadScoringService:
    """Get singleton scoring service"""
    global _scoring_service
    if _scoring_service is None:
        _scoring_service = LeadScoringService()
    return _scoring_service
