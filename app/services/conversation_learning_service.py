"""
Conversation Learning Service
Học hỏi từ lịch sử hội thoại để cải thiện câu trả lời
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class ConversationLearningService:
    """
    Service để phân tích và học từ lịch sử hội thoại
    
    Features:
    - Trích xuất sở thích người dùng (preferences)
    - Phát hiện patterns trong câu hỏi
    - Cá nhân hóa câu trả lời
    - Ghi nhớ context giữa các lượt hỏi
    """
    
    def __init__(self):
        """Initialize learning service"""
        self.preference_keywords = {
            'location': [
                'hà nội', 'ha noi', 'sài gòn', 'sai gon', 'tp.hcm', 'hcm',
                'đà nẵng', 'da nang', 'cần thơ', 'can tho', 'hải phòng',
                'bắc', 'bac', 'nam', 'trung'
            ],
            'industry': [
                'it', 'công nghệ', 'cong nghe', 'phần mềm', 'phan mem',
                'xây dựng', 'xay dung', 'thương mại', 'thuong mai',
                'logistics', 'du lịch', 'du lich', 'nhà hàng', 'nha hang',
                'fintech', 'blockchain', 'ai', 'game'
            ],
            'criteria': {
                'salary': ['lương', 'luong', 'thu nhập', 'thu nhap', 'pay'],
                'stability': ['ổn định', 'on dinh', 'stable', 'lâu dài', 'lau dai'],
                'culture': ['văn hóa', 'van hoa', 'culture', 'môi trường', 'moi truong'],
                'scale': ['lớn', 'lon', 'big', 'quy mô', 'quy mo', 'tập đoàn', 'tap doan'],
                'reputation': ['uy tín', 'uy tin', 'nổi tiếng', 'noi tieng', 'reputation']
            }
        }
        
        logger.info("🧠 ConversationLearningService initialized")
    
    def extract_user_preferences(self, history: List[Dict]) -> Dict:
        """
        Trích xuất sở thích người dùng từ lịch sử hội thoại
        
        Args:
            history: Lịch sử hội thoại [{"role": "user", "content": "..."}, ...]
        
        Returns:
            Dict chứa preferences: {
                'locations': [],
                'industries': [],
                'criteria': {},
                'confidence': float
            }
        """
        preferences = {
            'locations': [],
            'industries': [],
            'criteria': {},
            'patterns': []
        }
        
        # Chỉ phân tích tin nhắn của user
        user_messages = [
            msg['content'].lower()
            for msg in history
            if msg.get('role') == 'user'
        ]
        
        if not user_messages:
            return preferences
        
        # Ghép tất cả tin nhắn để phân tích
        full_text = ' '.join(user_messages)
        
        # Extract locations
        for location in self.preference_keywords['location']:
            if location in full_text:
                preferences['locations'].append(location)
        
        # Extract industries
        for industry in self.preference_keywords['industry']:
            if industry in full_text:
                preferences['industries'].append(industry)
        
        # Extract criteria
        for criterion, keywords in self.preference_keywords['criteria'].items():
            matches = sum(1 for kw in keywords if kw in full_text)
            if matches > 0:
                preferences['criteria'][criterion] = matches
        
        # Detect patterns (e.g., always asks about same industry)
        if len(set(preferences['industries'])) == 1 and len(user_messages) >= 2:
            preferences['patterns'].append(f"focused_on_{preferences['industries'][0]}")
        
        # Sort criteria by importance
        preferences['criteria'] = dict(
            sorted(
                preferences['criteria'].items(),
                key=lambda x: x[1],
                reverse=True
            )
        )
        
        logger.info(f"📊 Extracted preferences: {json.dumps(preferences, ensure_ascii=False)[:200]}")
        return preferences
    
    def get_conversation_context(self, history: List[Dict], max_turns: int = 5) -> Dict:
        """
        Lấy context quan trọng từ N lượt hội thoại gần nhất
        
        Args:
            history: Lịch sử đầy đủ
            max_turns: Số lượt tối đa để xét
        
        Returns:
            Dict chứa context: {
                'topic': str,
                'entities': List[str],
                'last_action': str,
                'unresolved_question': bool
            }
        """
        if not history:
            return {}
        
        # Lấy N lượt gần nhất
        recent_history = history[-max_turns * 2:]  # x2 vì mỗi lượt có user + ai
        
        context = {
            'topic': None,
            'entities': [],
            'last_action': None,
            'unresolved_question': False,
            'mentioned_companies': [],
            'mentioned_news': []
        }
        
        # Phân tích từng tin nhắn
        for msg in recent_history:
            content = msg.get('content', '').lower()
            role = msg.get('role')
            
            if role == 'user':
                # Detect topic
                if any(kw in content for kw in ['công ty', 'doanh nghiệp', 'cong ty', 'doanh nghiep']):
                    context['topic'] = 'business'
                elif any(kw in content for kw in ['tin tức', 'tin tuc', 'news', 'báo', 'bao']):
                    context['topic'] = 'news'
                
                # Detect unresolved questions
                if '?' in content or any(kw in content for kw in ['nào', 'nao', 'gì', 'gi', 'thế nào', 'the nao']):
                    context['unresolved_question'] = True
            
            elif role == 'assistant':
                # Extract mentioned companies from AI response
                # Look for patterns like "**Company Name**"
                import re
                companies = re.findall(r'\*\*([^*]+(?:company|công ty|cong ty)[^*]*)\*\*', content, re.IGNORECASE)
                context['mentioned_companies'].extend(companies[:5])  # Max 5
                
                # If AI answered, question is resolved
                if len(content) > 50:
                    context['unresolved_question'] = False
        
        # Get last user action
        user_messages = [msg for msg in recent_history if msg.get('role') == 'user']
        if user_messages:
            last_user = user_messages[-1]['content'].lower()
            
            if any(kw in last_user for kw in ['chi tiết', 'chi tiet', 'xem', 'detail']):
                context['last_action'] = 'request_detail'
            elif any(kw in last_user for kw in ['so sánh', 'so sanh', 'compare', 'khác', 'khac']):
                context['last_action'] = 'request_comparison'
            elif any(kw in last_user for kw in ['gợi ý', 'goi y', 'recommend', 'suggest', 'tư vấn', 'tu van']):
                context['last_action'] = 'request_suggestion'
        
        # Remove duplicates
        context['mentioned_companies'] = list(set(context['mentioned_companies']))[:5]
        
        logger.info(f"🔍 Conversation context: {json.dumps(context, ensure_ascii=False)[:200]}")
        return context
    
    def should_expand_answer(self, history: List[Dict], current_query: str) -> bool:
        """
        Quyết định có nên mở rộng câu trả lời hay không
        
        Args:
            history: Lịch sử
            current_query: Câu hỏi hiện tại
        
        Returns:
            True nếu nên trả lời chi tiết hơn
        """
        # Luôn mở rộng cho câu hỏi đầu tiên
        if not history or len(history) <= 1:
            return True
        
        # Mở rộng nếu user hỏi "why", "how", "explain"
        expand_keywords = [
            'tại sao', 'tai sao', 'why', 'làm sao', 'lam sao', 'how',
            'giải thích', 'giai thich', 'explain', 'chi tiết', 'chi tiet'
        ]
        
        query_lower = current_query.lower()
        if any(kw in query_lower for kw in expand_keywords):
            return True
        
        # Mở rộng nếu câu hỏi phức tạp (> 10 từ)
        if len(current_query.split()) > 10:
            return True
        
        # Không mở rộng nếu câu hỏi rất ngắn (follow-up đơn giản)
        if len(current_query.split()) <= 3:
            return False
        
        return True
    
    def personalize_response_hints(self, preferences: Dict, context: Dict) -> Dict:
        """
        Tạo gợi ý để cá nhân hóa câu trả lời
        
        Args:
            preferences: User preferences
            context: Conversation context
        
        Returns:
            Dict chứa hints: {
                'focus_on': [],
                'mention_criteria': [],
                'link_to_previous': bool,
                'tone': str
            }
        """
        hints = {
            'focus_on': [],
            'mention_criteria': [],
            'link_to_previous': False,
            'tone': 'friendly'
        }
        
        # Focus on preferred locations
        if preferences.get('locations'):
            hints['focus_on'].append(f"location:{preferences['locations'][0]}")
        
        # Focus on preferred industries
        if preferences.get('industries'):
            hints['focus_on'].append(f"industry:{preferences['industries'][0]}")
        
        # Mention important criteria
        top_criteria = list(preferences.get('criteria', {}).keys())[:2]
        hints['mention_criteria'] = top_criteria
        
        # Link to previous if there's context
        if context.get('mentioned_companies') or context.get('topic'):
            hints['link_to_previous'] = True
        
        # Adjust tone based on conversation length
        history_length = len(preferences.get('patterns', []))
        if history_length > 3:
            hints['tone'] = 'more_casual'  # Người dùng quen thuộc rồi
        
        logger.info(f"💡 Personalization hints: {json.dumps(hints, ensure_ascii=False)}")
        return hints
    
    def format_learning_context(self, history: List[Dict]) -> str:
        """
        Format learning context thành text để inject vào prompt
        
        Args:
            history: Conversation history
        
        Returns:
            Formatted context string
        """
        if not history or len(history) < 2:
            return ""
        
        preferences = self.extract_user_preferences(history)
        context = self.get_conversation_context(history)
        hints = self.personalize_response_hints(preferences, context)
        
        learning_text = "🧠 **LEARNING CONTEXT (Chỉ dành cho AI, KHÔNG hiển thị ra user):**\n\n"
        
        # User preferences
        if preferences.get('locations') or preferences.get('industries'):
            learning_text += "**Sở thích người dùng:**\n"
            if preferences.get('locations'):
                learning_text += f"- Khu vực: {', '.join(preferences['locations'][:3])}\n"
            if preferences.get('industries'):
                learning_text += f"- Ngành nghề: {', '.join(preferences['industries'][:3])}\n"
            if preferences.get('criteria'):
                top_criterion = list(preferences['criteria'].keys())[0]
                learning_text += f"- Ưu tiên: {top_criterion}\n"
            learning_text += "\n"
        
        # Conversation context
        if context.get('topic'):
            learning_text += f"**Chủ đề hiện tại:** {context['topic']}\n"
        
        if context.get('mentioned_companies'):
            learning_text += f"**Công ty đã nhắc:** {', '.join(context['mentioned_companies'][:3])}\n"
        
        if context.get('last_action'):
            learning_text += f"**Hành động gần nhất:** {context['last_action']}\n"
        
        learning_text += "\n"
        
        # Personalization hints
        learning_text += "**Gợi ý cá nhân hóa:**\n"
        if hints.get('focus_on'):
            learning_text += f"- Tập trung: {', '.join(hints['focus_on'])}\n"
        if hints.get('mention_criteria'):
            learning_text += f"- Nhấn mạnh tiêu chí: {', '.join(hints['mention_criteria'])}\n"
        if hints.get('link_to_previous'):
            learning_text += "- Liên kết với câu hỏi trước\n"
        
        learning_text += "\n---\n\n"
        
        return learning_text


# Singleton instance
_learning_service_instance = None


def get_learning_service() -> ConversationLearningService:
    """Get singleton learning service instance"""
    global _learning_service_instance
    if _learning_service_instance is None:
        _learning_service_instance = ConversationLearningService()
    return _learning_service_instance
