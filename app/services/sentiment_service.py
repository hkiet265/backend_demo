import logging
from typing import Dict, Optional
from enum import Enum

logger = logging.getLogger(__name__)


class Sentiment(str, Enum):
    """Sentiment categories"""
    POSITIVE = "positive"      
    NEUTRAL = "neutral"     
    NEGATIVE = "negative"      
    FRUSTRATED = "frustrated" 


class SentimentService:
    """
    Analyze user sentiment using Groq AI
    Fast, free, và accurate cho tiếng Việt
    """
    
    def __init__(self):
        """Initialize sentiment service"""
        self.groq_service = None
        logger.info("✅ SentimentService initialized")
    
    def analyze(self, message: str, history: list = None) -> Dict:
        """
        Phân tích cảm xúc từ message của user
        
        Args:
            message: User message
            history: Conversation history (optional, for context)
            
        Returns:
            {
                'sentiment': 'positive' | 'neutral' | 'negative' | 'frustrated',
                'confidence': 0.0-1.0,
                'keywords': [...],
                'suggestion': 'empathetic' | 'neutral' | 'solution-focused'
            }
        """
        try:
            quick_result = self._quick_sentiment_detection(message)

            # NEGATIVE (unlike FRUSTRATED, which needs an explicit swear/
            # complaint word) can fire off a single ambiguous keyword — that
            # only means anything in the context of a prior bad turn. On the
            # very first message there's nothing to be sorry about yet, so
            # don't let adjust_tone() open with an apology out of nowhere.
            if quick_result['sentiment'] == Sentiment.NEGATIVE and not history:
                quick_result = {**quick_result, 'confidence': 0.0}

            if quick_result['confidence'] >= 0.85:
                return quick_result

            if self._is_groq_available():
                return self._ai_sentiment_analysis(message, history)
            return quick_result
            
        except Exception as e:
            logger.error(f"Sentiment analysis error: {e}")
            return self._default_sentiment()
    
    def _quick_sentiment_detection(self, message: str) -> Dict:
        """
        Keyword-based sentiment detection (very fast)
        Good for clear cases
        """
        message_lower = message.lower()

        frustrated_keywords = [
            'shit', 'fuck', 'damn', 'đéo', 'vãi', 'đm', 'vcl', 'cc',
            'tệ quá', 'te qua', 'quá tệ', 'qua te', 'ngớ ngẩn', 'ngo ngan',
            'vô dụng', 'vo dung', 'không dùng được', 'khong dung duoc',
            'lỗi hoài', 'loi hoai', 'sai hoài', 'sai hoai'
        ]

        # Deliberately excludes bare negation particles ("không", "chẳng",
        # "chả") — they're grammatically neutral in Vietnamese and show up
        # in totally ordinary requests ("không cần gấp", "cho tôi xem không
        # phải tin cũ"), which was misfiring NEGATIVE sentiment (and an
        # unwarranted apology from adjust_tone) on completely normal first
        # messages. Only count actual negative-sentiment phrases.
        negative_keywords = [
            'tệ', 'te', 'kém', 'kem', 'xấu', 'xau', 'thất vọng', 'that vong',
            'buồn', 'buon', 'thất bại', 'that bai', 'sai rồi', 'sai roi',
            'lỗi', 'loi',
            'không thấy', 'khong thay', 'không tìm', 'khong tim',
            'không ra', 'khong ra', 'không có', 'khong co'
        ]

        positive_keywords = [
            'tốt', 'tot', 'hay', 'đẹp', 'dep', 'tuyệt', 'tuyet',
            'cảm ơn', 'cam on', 'thank', 'tks', 'thanks', 'cám ơn', 'cam on',
            'ok', 'được', 'duoc', 'ổn', 'on', 'ngon', 'xuất sắc', 'xuat sac',
            'hài lòng', 'hai long', 'vui', 'tuyệt vời', 'tuyet voi'
        ]

        frustrated_count = sum(1 for kw in frustrated_keywords if kw in message_lower)
        negative_count = sum(1 for kw in negative_keywords if kw in message_lower)
        positive_count = sum(1 for kw in positive_keywords if kw in message_lower)

        if frustrated_count > 0:
            return {
                'sentiment': Sentiment.FRUSTRATED,
                'confidence': min(0.95, 0.7 + frustrated_count * 0.1),
                'keywords': [kw for kw in frustrated_keywords if kw in message_lower],
                'suggestion': 'empathetic',
                'method': 'keyword'
            }
        
        if negative_count >= 2 or (negative_count == 1 and len(message.split()) <= 10):
            return {
                'sentiment': Sentiment.NEGATIVE,
                'confidence': 0.75 + negative_count * 0.05,
                'keywords': [kw for kw in negative_keywords if kw in message_lower],
                'suggestion': 'solution-focused',
                'method': 'keyword'
            }
        
        if positive_count >= 2:
            return {
                'sentiment': Sentiment.POSITIVE,
                'confidence': 0.8 + positive_count * 0.05,
                'keywords': [kw for kw in positive_keywords if kw in message_lower],
                'suggestion': 'friendly',
                'method': 'keyword'
            }

        return {
            'sentiment': Sentiment.NEUTRAL,
            'confidence': 0.5,
            'keywords': [],
            'suggestion': 'neutral',
            'method': 'keyword'
        }
    
    def _ai_sentiment_analysis(self, message: str, history: list = None) -> Dict:
        """
        AI-powered sentiment analysis using Groq
        More accurate but slower
        """
        try:
            if not self.groq_service:
                from app.services.groq_service import get_groq_service
                self.groq_service = get_groq_service()
            
            if not self.groq_service:
                logger.warning("Groq service not available")
                return self._quick_sentiment_detection(message)
            context_text = ""
            if history and len(history) > 0:
                recent = history[-3:]
                context_text = "\n".join([
                    f"{msg.get('role')}: {msg.get('content')[:100]}"
                    for msg in recent
                ])
            
            prompt = f"""Phân tích cảm xúc của user từ tin nhắn sau:

Tin nhắn: "{message}"

{f'Context (3 tin nhắn trước):\\n{context_text}\\n' if context_text else ''}

Trả lời CHÍNH XÁC theo format JSON sau (KHÔNG thêm text nào khác):
{{
    "sentiment": "positive/neutral/negative/frustrated",
    "confidence": 0.0-1.0,
    "reason": "Lý do ngắn gọn"
}}

Định nghĩa:
- positive: Vui vẻ, hài lòng, cảm ơn
- neutral: Bình thường, hỏi đáp
- negative: Thất vọng, không hài lòng
- frustrated: Rất bực tức, tức giận, chửi thề"""
            
            response = self.groq_service.generate(
                system_prompt="Bạn là chuyên gia phân tích cảm xúc. Trả lời chỉ bằng JSON, không thêm text.",
                user_prompt=prompt,
                temperature=0.3,
                max_tokens=100
            )
            
            if not response:
                return self._quick_sentiment_detection(message)
            
            # Parse JSON response
            import json
            result = json.loads(response)
            
            # Map to enum and add suggestion
            sentiment = result.get('sentiment', 'neutral')
            confidence = float(result.get('confidence', 0.7))
            
            suggestion = 'neutral'
            if sentiment == 'frustrated':
                suggestion = 'empathetic'
            elif sentiment == 'negative':
                suggestion = 'solution-focused'
            elif sentiment == 'positive':
                suggestion = 'friendly'
            
            return {
                'sentiment': sentiment,
                'confidence': confidence,
                'keywords': [],
                'suggestion': suggestion,
                'method': 'ai',
                'reason': result.get('reason', '')
            }
            
        except Exception as e:
            logger.error(f"AI sentiment analysis failed: {e}")
            return self._quick_sentiment_detection(message)
    
    def _is_groq_available(self) -> bool:
        """Check if Groq service is available"""
        try:
            if not self.groq_service:
                from app.services.groq_service import get_groq_service
                self.groq_service = get_groq_service()
            return self.groq_service is not None
        except:
            return False
    
    def _default_sentiment(self) -> Dict:
        """Default neutral sentiment"""
        return {
            'sentiment': Sentiment.NEUTRAL,
            'confidence': 0.5,
            'keywords': [],
            'suggestion': 'neutral',
            'method': 'default'
        }
    
    def adjust_tone(self, base_answer: str, sentiment_result: Dict) -> str:
        """
        Điều chỉnh tone của câu trả lời dựa vào sentiment
        
        Args:
            base_answer: Câu trả lời gốc
            sentiment_result: Kết quả phân tích sentiment
            
        Returns:
            Adjusted answer with appropriate tone
        """
        sentiment = sentiment_result['sentiment']
        suggestion = sentiment_result['suggestion']

        if sentiment == Sentiment.FRUSTRATED or suggestion == 'empathetic':
            prefix = "Em xin lỗi vì trải nghiệm không tốt. "
            return prefix + base_answer

        elif sentiment == Sentiment.NEGATIVE or suggestion == 'solution-focused':
            prefix = "Em hiểu bạn đang gặp khó khăn. "
            return prefix + base_answer

        elif sentiment == Sentiment.POSITIVE or suggestion == 'friendly':
            suffix = " 😊"
            return base_answer + suffix

        return base_answer

_sentiment_service = None


def get_sentiment_service() -> SentimentService:
    """Get or create sentiment service singleton"""
    global _sentiment_service
    if _sentiment_service is None:
        _sentiment_service = SentimentService()
    return _sentiment_service
