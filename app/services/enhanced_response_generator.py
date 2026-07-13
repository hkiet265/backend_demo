"""
Enhanced Response Generator
Tạo câu trả lời chi tiết, thân thiện hơn sử dụng AI prompts + learning
"""
import logging
from typing import Dict, List, Optional
import re

logger = logging.getLogger(__name__)


class EnhancedResponseGenerator:
    """
    Service để tạo câu trả lời cải tiến
    
    Features:
    - Trả lời dài hơn, chi tiết hơn
    - Thân thiện, có cảm xúc
    - Cá nhân hóa dựa trên learning
    - Gợi ý follow-up thông minh
    """
    
    def __init__(self):
        """Initialize enhanced response generator"""
        logger.info("✨ EnhancedResponseGenerator initialized")
    
    def enhance_business_response(
        self,
        businesses: List[Dict],
        original_query: str,
        learning_hints: Dict = None,
        search_method: str = "semantic"
    ) -> str:
        """
        Tạo câu trả lời nâng cao cho business search
        
        Args:
            businesses: Danh sách công ty tìm được
            original_query: Câu hỏi gốc
            learning_hints: Gợi ý từ learning service
            search_method: Phương pháp tìm kiếm
        
        Returns:
            Enhanced answer string
        """
        if not businesses:
            return self._generate_no_results_response(original_query)
        
        # Greeting
        greeting = "Chào bạn! 👋\n\n"
        
        # Context understanding
        query_lower = original_query.lower()
        context_line = ""
        
        if any(kw in query_lower for kw in ['gợi ý', 'tư vấn', 'giới thiệu']):
            context_line = f"Em hiểu bạn đang tìm gợi ý công ty "
        elif any(kw in query_lower for kw in ['tốt', 'uy tín', 'chất lượng']):
            context_line = f"Em tìm thấy các công ty uy tín "
        elif any(kw in query_lower for kw in ['tìm', 'search', 'có']):
            context_line = f"Em tìm thấy "
        else:
            context_line = f"Về câu hỏi của bạn, em tìm thấy "
        
        # Industry/location context
        industry_mentioned = self._extract_industry(original_query)
        location_mentioned = self._extract_location(original_query)
        
        if industry_mentioned and location_mentioned:
            context_line += f"trong lĩnh vực {industry_mentioned} ở {location_mentioned}:\n\n"
        elif industry_mentioned:
            context_line += f"trong lĩnh vực {industry_mentioned}:\n\n"
        elif location_mentioned:
            context_line += f"tại {location_mentioned}:\n\n"
        else:
            context_line += "phù hợp với yêu cầu:\n\n"
        
        # Main results (Top 3-5 với phân tích)
        results_section = self._format_business_list_detailed(
            businesses[:5],  # Top 5
            learning_hints
        )
        
        # Analysis section
        analysis = self._generate_business_analysis(
            businesses[:5],
            original_query,
            learning_hints
        )
        
        # Suggestions
        suggestions = self._generate_business_suggestions(
            businesses,
            original_query
        )
        
        # Follow-up question
        followup = self._generate_followup_question(original_query)
        
        # Combine all
        full_answer = (
            f"{greeting}"
            f"{context_line}"
            f"{results_section}\n\n"
            f"{analysis}\n\n"
            f"{suggestions}\n\n"
            f"{followup}"
        )
        
        return full_answer
    
    def _format_business_list_detailed(
        self,
        businesses: List[Dict],
        learning_hints: Dict = None
    ) -> str:
        """
        Format danh sách công ty với thông tin chi tiết
        
        Returns:
            Formatted markdown string
        """
        result = "📊 Danh sách công ty:\n\n"
        
        for idx, biz in enumerate(businesses, 1):
            name = biz.get('name', 'N/A')
            industry = biz.get('industry', '')
            location = biz.get('location', '')
            region = biz.get('region', '')
            phone = biz.get('phone', 'Chưa có')
            website = biz.get('website', '')
            
            # Icon based on index
            icon = "🥇" if idx == 1 else "🥈" if idx == 2 else "🥉" if idx == 3 else f"{idx}."
            
            result += f"{icon} {name}\n"
            
            # Industry
            if industry:
                result += f"   • Ngành nghề: {industry}\n"
            
            # Location
            if location or region:
                loc_str = f"{location}" if location else ""
                reg_str = f"({region})" if region else ""
                result += f"   • Vị trí: {loc_str} {reg_str}\n"
            
            # Phone
            if phone and phone != 'Chưa có':
                result += f"   • SĐT: {phone}\n"
            
            # Website
            if website:
                result += f"   • Website: {website}\n"
            
            # Highlight (dựa trên learning_hints nếu có)
            if learning_hints and idx <= 2:
                highlight = self._generate_company_highlight(biz, learning_hints)
                if highlight:
                    result += f"   • ✨ {highlight}\n"
            
            result += "\n"
        
        return result.strip()
    
    def _generate_company_highlight(
        self,
        company: Dict,
        learning_hints: Dict
    ) -> Optional[str]:
        """
        Tạo highlight cho công ty dựa trên learning hints
        """
        highlights = []
        
        # Check criteria matches
        criteria = learning_hints.get('mention_criteria', [])
        
        if 'scale' in criteria:
            highlights.append("Quy mô lớn, ổn định")
        
        if 'reputation' in criteria:
            highlights.append("Uy tín cao")
        
        if 'salary' in criteria:
            highlights.append("Thu nhập cạnh tranh")
        
        # Focus matches
        focus_on = learning_hints.get('focus_on', [])
        for focus in focus_on:
            if focus.startswith('location:'):
                loc = focus.split(':')[1]
                if loc in company.get('location', '').lower():
                    highlights.append(f"Đúng khu vực yêu cầu ({loc})")
        
        if highlights:
            return highlights[0]  # Return first highlight
        
        return None
    
    def _generate_business_analysis(
        self,
        businesses: List[Dict],
        original_query: str,
        learning_hints: Dict = None
    ) -> str:
        """
        Tạo phần phân tích và so sánh các công ty
        """
        if len(businesses) < 2:
            return ""
        
        analysis = "💡 Phân tích của em:\n\n"
        
        # Phân loại theo industry
        industries = {}
        for biz in businesses:
            ind = biz.get('industry', 'Khác')
            industries[ind] = industries.get(ind, 0) + 1
        
        if len(industries) > 1:
            top_industry = max(industries, key=industries.get)
            analysis += f"• Chủ yếu là các công ty {top_industry} ({industries[top_industry]} công ty)\n"
        
        # Phân loại theo region
        regions = {}
        for biz in businesses:
            reg = biz.get('region', 'Khác')
            regions[reg] = regions.get(reg, 0) + 1
        
        if len(regions) > 1:
            analysis += f"• Phân bố: "
            analysis += ", ".join([f"{reg}: {count}" for reg, count in regions.items()])
            analysis += "\n"
        
        # Gợi ý công ty nổi bật
        if businesses[0]:
            analysis += f"• {businesses[0].get('name')} nổi bật nhất trong danh sách\n"
        
        return analysis
    
    def _generate_business_suggestions(
        self,
        businesses: List[Dict],
        original_query: str
    ) -> str:
        """
        Tạo phần gợi ý cho người dùng
        """
        suggestions = "📌 Gợi ý thêm:\n\n"
        
        query_lower = original_query.lower()
        
        # Suggest detail view
        if len(businesses) >= 1:
            suggestions += f"• Xem chi tiết {businesses[0].get('name')}?\n"
        
        # Suggest comparison
        if len(businesses) >= 2:
            suggestions += f"• So sánh {businesses[0].get('name')} và {businesses[1].get('name')}?\n"
        
        # Suggest more search
        if 'tìm' not in query_lower and 'search' not in query_lower:
            suggestions += "• Tìm thêm công ty tương tự?\n"
        
        # Suggest related news
        if any(businesses):
            first_industry = businesses[0].get('industry', '')
            if first_industry:
                suggestions += f"• Xem tin tức về {first_industry}?\n"
        
        return suggestions
    
    def _generate_followup_question(self, original_query: str) -> str:
        """
        Tạo câu hỏi follow-up thông minh
        """
        query_lower = original_query.lower()
        
        questions = [
            "❓ Bạn muốn:",
        ]
        
        # Tailor questions based on query type
        if any(kw in query_lower for kw in ['tìm', 'có', 'search']):
            questions.append("• Xem chi tiết công ty nào?")
            questions.append("• Tìm thêm công ty khác?")
        
        if any(kw in query_lower for kw in ['gợi ý', 'tư vấn']):
            questions.append("• Em phân tích ưu/nhược điểm từng công ty?")
            questions.append("• So sánh các lựa chọn?")
        
        if len(questions) == 1:  # No specific questions added
            questions.append("• Tìm hiểu thêm về công ty nào?")
            questions.append("• Có câu hỏi gì khác không?")
        
        return "\n".join(questions)
    
    def _generate_no_results_response(self, query: str) -> str:
        """
        Tạo câu trả lời khi không tìm thấy kết quả
        """
        response = "Chào bạn! 👋\n\n"
        response += "Em rất tiếc là chưa tìm thấy công ty phù hợp với yêu cầu. 😔\n\n"
        
        response += "💡 Em có thể giúp bạn:\n\n"
        response += "1. Mở rộng tìm kiếm:\n"
        response += "   • Thử tìm ở khu vực khác?\n"
        response += "   • Tìm ngành nghề liên quan?\n\n"
        
        response += "2. Tìm theo cách khác:\n"
        response += "   • Tìm theo tên công ty cụ thể?\n"
        response += "   • Tìm theo số điện thoại?\n\n"
        
        response += "❓ Bạn muốn em tìm kiếm theo hướng nào?"
        
        return response
    
    def _extract_industry(self, text: str) -> Optional[str]:
        """Extract industry from text"""
        text_lower = text.lower()
        
        industries = {
            'it': ['it', 'công nghệ', 'cong nghe', 'phần mềm', 'phan mem', 'software'],
            'xây dựng': ['xây dựng', 'xay dung', 'construction'],
            'thương mại': ['thương mại', 'thuong mai', 'trade', 'bán hàng', 'ban hang'],
            'logistics': ['logistics', 'vận tải', 'van tai', 'giao nhận', 'giao nhan'],
            'du lịch': ['du lịch', 'du lich', 'travel', 'tour'],
            'nhà hàng': ['nhà hàng', 'nha hang', 'restaurant', 'ăn uống', 'an uong'],
            'fintech': ['fintech', 'tài chính', 'tai chinh', 'finance', 'ngân hàng', 'ngan hang'],
        }
        
        for industry, keywords in industries.items():
            if any(kw in text_lower for kw in keywords):
                return industry
        
        return None
    
    def _extract_location(self, text: str) -> Optional[str]:
        """Extract location from text"""
        text_lower = text.lower()
        
        locations = [
            ('Hà Nội', ['hà nội', 'ha noi', 'hanoi']),
            ('TP.HCM', ['sài gòn', 'sai gon', 'hồ chí minh', 'ho chi minh', 'hcm', 'tp.hcm']),
            ('Đà Nẵng', ['đà nẵng', 'da nang', 'danang']),
            ('Cần Thơ', ['cần thơ', 'can tho']),
            ('Hải Phòng', ['hải phòng', 'hai phong']),
        ]
        
        for location, keywords in locations:
            if any(kw in text_lower for kw in keywords):
                return location
        
        return None
    
    def enhance_news_response(
        self,
        answer: str,
        documents: List[Dict],
        original_query: str
    ) -> str:
        """
        Enhance news RAG response with more detail and personality
        
        Args:
            answer: Original RAG answer
            documents: Retrieved documents
            original_query: User's question
        
        Returns:
            Enhanced answer
        """
        # If answer is already good (> 100 chars), just add greeting + followup
        if len(answer) > 100:
            enhanced = f"Chào bạn! 📰\n\n{answer}\n\n"
            
            # Add document links
            if documents:
                enhanced += "📎 Nguồn tin:\n"
                for idx, doc in enumerate(documents[:3], 1):
                    enhanced += f"{idx}. {doc.get('title', 'N/A')} - {doc.get('source', 'N/A')}\n"
                enhanced += "\n"
            
            # Add followup
            enhanced += "❓ Bạn muốn tìm hiểu thêm về tin nào không?"
            
            return enhanced
        
        # If answer too short, expand it
        else:
            return self._expand_news_answer(answer, documents, original_query)
    
    def _expand_news_answer(
        self,
        short_answer: str,
        documents: List[Dict],
        original_query: str
    ) -> str:
        """Expand short news answer"""
        if not documents:
            return short_answer
        
        response = "Chào bạn! 📰\n\n"
        response += f"Em tìm thấy một số tin tức liên quan đến \"{original_query}\":\n\n"
        
        # Summarize top 3 news
        for idx, doc in enumerate(documents[:3], 1):
            title = doc.get('title', 'N/A')
            summary = doc.get('summary', '')[:150]
            source = doc.get('source', 'N/A')
            
            response += f"{idx}. {title}\n"
            if summary:
                response += f"   {summary}...\n"
            response += f"   _(Nguồn: {source})_\n\n"
        
        response += "💡 Bạn muốn xem chi tiết tin nào không?"
        
        return response


# Singleton instance
_generator_instance = None


def get_enhanced_response_generator() -> EnhancedResponseGenerator:
    """Get singleton instance"""
    global _generator_instance
    if _generator_instance is None:
        _generator_instance = EnhancedResponseGenerator()
    return _generator_instance
