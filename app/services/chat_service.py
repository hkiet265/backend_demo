"""
Chat Service
High-level chat logic with query routing and response formatting
"""
import re
import logging
from typing import Dict, List
from .rag_service import RAGService
from app.config import settings

logger = logging.getLogger(__name__)


class ChatService:
    """High-level chat service with intelligent routing"""
    
    def __init__(self, rag_service: RAGService):
        """
        Initialize chat service
        
        Args:
            rag_service: RAG service instance
        """
        self.rag_service = rag_service
        logger.info("ChatService initialized")
    
    def process_message(
        self,
        message: str,
        action_button_id: str = None
    ) -> Dict:
        """
        Process user message and route to appropriate handler
        
        Args:
            message: User message
            action_button_id: Optional action button ID
        
        Returns:
            Response dict with answer and suggestions
        """
        logger.info(f"🎯 PROCESS MESSAGE: {message}")
        
        if action_button_id:
            return self._handle_action_button(action_button_id)
        
        
        query_type = self._detect_query_type(message)
        logger.info(f"🔍 DETECTED QUERY TYPE: {query_type}")
        
        if query_type == "greeting":
            return self._handle_greeting(message)
        elif query_type == "news":
            return self._handle_news_query(message)
        elif query_type == "business":
            return self._handle_business_query(message)
        else:
            return self._handle_general_query(message)
    
    def _detect_query_type(self, message: str) -> str:
        """
        Detect query type from message
        
        Args:
            message: User message
        
        Returns:
            Query type: "greeting", "news", "business", "general"
        """
        message_lower = message.lower()
        
        
        greeting_patterns = [
            r'\bhello\b', r'\bhi\b', r'\bchào\b', r'\bxin chào\b',
            r'\bhey\b', r'\bem tên gì\b', r'\bem là ai\b'
        ]
        if any(re.search(p, message_lower) for p in greeting_patterns):
            return "greeting"
    
        business_keywords = [
            'công ty', 'cong ty', 'doanh nghiệp', 'doanh nghiep',
            'việc làm', 'viec lam', 'tuyển dụng', 'tuyen dung',
            'công ty tnhh', 'tập đoàn', 'tap doan', 'tìm công ty',
            'tim cong ty', 'tìm doanh', 'tim doanh'
        ]
        if any(kw in message_lower for kw in business_keywords):
            return "business"

        news_keywords = ['tin', 'news', 'báo', 'bài viết', 'thông tin về', 'tin tức', 'tin tuc']
        if any(kw in message_lower for kw in news_keywords):
            return "news"
        
        return "general"
    
    def _handle_greeting(self, message: str) -> Dict:
        """Handle greeting messages"""
        greeting_responses = {
            r'\bhello\b': 'Hello! Em Tư đây. Bạn muốn tìm tin gì không? 📰',
            r'\bhi\b': 'Hi! Em là Em Tư, có gì em giúp được không? 😊',
            r'\bchào\b': 'Chào bạn! Em Tư đây, hỏi em về tin tức gì cũng được nha.',
        }
        
        answer = 'Chào bạn! Em Tư đây. Có gì em giúp được không? 😊'
        for pattern, response in greeting_responses.items():
            if re.search(pattern, message.lower()):
                answer = response
                break
        
        return {
            'answer': answer,
            'documents': [],
            'action_buttons': self._get_default_action_buttons(),
            'rag_used': False
        }
    
    def _handle_news_query(self, message: str) -> Dict:
        """
        Handle news-related queries with AI-powered semantic search
        Dùng RAG Service với vector embeddings để tìm kiếm thông minh
        """
        try:
            logger.info(f"News query with AI: {message}")

            result = self.rag_service.chat(
                query=message,
                top_k=10,
                threshold=0.1
            )

            if not result.get('documents'):
                logger.warning("No results from vector search, fallback to SQL")
                return self._handle_news_query_fallback(message)

            documents = []
            for doc in result['documents']:
                documents.append({
                    'title': doc.get('title', ''),
                    'summary': doc.get('summary', ''),
                    'category': doc.get('category', ''),
                    'source': doc.get('source', ''),
                    'similarity': doc.get('similarity', 0)
                })
            
            return {
                'answer': result['answer'],
                'documents': documents,
                'rag_used': True,
                'tokens_saved': result.get('tokens_saved', 0),
                'response_time_ms': result.get('response_time_ms', 0)
            }
            
        except Exception as e:
            logger.error(f"AI news query failed: {e}, fallback to SQL")
            return self._handle_news_query_fallback(message)
    
    def _handle_news_query_fallback(self, message: str) -> Dict:
        """Fallback SQL-based search when AI search fails"""
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            from app.config import settings
            
            conn = psycopg2.connect(**settings.database_url)
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            message_lower = message.lower()

            sql = "SELECT * FROM station_news WHERE 1=1"
            params = []

            if 'bắc' in message_lower or 'ha noi' in message_lower or 'hà nội' in message_lower:
                sql += " AND vung_mien = %s"
                params.append('Bac')
            elif 'trung' in message_lower or 'da nang' in message_lower or 'đà nẵng' in message_lower:
                sql += " AND vung_mien = %s"
                params.append('Trung')
            elif 'nam' in message_lower or 'sai gon' in message_lower or 'tp.hcm' in message_lower:
                sql += " AND vung_mien = %s"
                params.append('Nam')

            if 'thể thao' in message_lower or 'bóng đá' in message_lower:
                sql += " AND chuyen_muc ILIKE %s"
                params.append('%thể thao%')
            elif 'kinh tế' in message_lower:
                sql += " AND chuyen_muc ILIKE %s"
                params.append('%kinh tế%')
            elif 'công nghệ' in message_lower:
                sql += " AND chuyen_muc ILIKE %s"
                params.append('%công nghệ%')
            
            sql += " ORDER BY created_at DESC LIMIT 10"
            
            cur.execute(sql, params)
            news_list = cur.fetchall()
            
            cur.close()
            conn.close()
            
            if not news_list:
                return {
                    'answer': "Em Tư không tìm thấy tin tức nào phù hợp. Bạn thử mô tả rõ hơn nhé! 📰",
                    'documents': [],
                    'rag_used': False
                }
            
            documents = []
            for news in news_list:
                documents.append({
                    'title': news.get('tieu_de', ''),
                    'summary': news.get('tom_tat', ''),
                    'category': news.get('chuyen_muc', ''),
                    'source': news.get('nha_dai', ''),
                    'similarity': None
                })
            
            return {
                'answer': "Dưới đây là thông tin bạn muốn tìm kiếm:",
                'documents': documents,
                'rag_used': False
            }
            
        except Exception as e:
            logger.error(f"Fallback SQL search also failed: {e}")
            return {
                'answer': "Em Tư đang gặp chút vấn đề khi tìm tin tức. Bạn thử lại sau nhé! 😅",
                'documents': [],
                'rag_used': False
            }
    
    def _handle_business_query(self, message: str) -> Dict:
        """Handle business-related queries - NO ENCRYPTION"""
        logger.info(f"🏢 BUSINESS QUERY HANDLER CALLED with message: {message}")
        try: 
            import psycopg2
            from psycopg2.extras import RealDictCursor
            from app.config import settings

            conn = psycopg2.connect(**settings.database_url)
            cur = conn.cursor(cursor_factory=RealDictCursor)

            message_lower = message.lower()

            # Simple query - plain text columns
            sql = """
                SELECT id, ten_doanh_nghiep, so_dien_thoai, tinh_thanh, 
                       vung_mien, nganh_nghe, website, email, dia_chi, updated_at 
                FROM businesses_demo 
                WHERE 1=1
            """
            params = []

            # Detect region
            region_detected = None
            if any(kw in message_lower for kw in ['bắc', 'bac', 'hà nội', 'ha noi', 'hải phòng', 'hai phong', 'miền bắc', 'mien bac']):
                region_detected = 'Bắc'
                sql += " AND (vung_mien = %s OR vung_mien = 'Bac')"
                params.append(region_detected)
            elif any(kw in message_lower for kw in ['trung', 'đà nẵng', 'da nang', 'huế', 'hue', 'miền trung', 'mien trung']):
                region_detected = 'Trung'
                sql += " AND vung_mien = %s"
                params.append(region_detected)
            elif any(kw in message_lower for kw in ['nam', 'sài gòn', 'sai gon', 'hồ chí minh', 'ho chi minh', 'tp.hcm', 'tphcm', 'miền nam', 'mien nam']):
                region_detected = 'Nam'
                sql += " AND vung_mien = %s"
                params.append(region_detected)
            
            if region_detected:
                logger.info(f"🔍 Searching businesses in region: {region_detected}")
            else:
                logger.info(f"🔍 Searching ALL businesses")

            sql += " ORDER BY updated_at DESC LIMIT 20"

            logger.info(f"📝 Executing SQL: {sql}")
            logger.info(f"📝 Params: {params}")

            cur.execute(sql, params)
            businesses = cur.fetchall()
            
            logger.info(f"📊 Found {len(businesses)} businesses")
            
            # Fallback if no results with region filter
            if not businesses and region_detected:
                logger.info(f"⚠️ No results with region, trying all...")
                sql_fallback = """
                    SELECT id, ten_doanh_nghiep, so_dien_thoai, tinh_thanh, 
                           vung_mien, nganh_nghe, website, email, dia_chi, updated_at 
                    FROM businesses_demo 
                    ORDER BY updated_at DESC LIMIT 20
                """
                cur.execute(sql_fallback)
                businesses = cur.fetchall()
                logger.info(f"📊 Fallback found {len(businesses)} businesses")
            
            cur.close()
            conn.close()
            
            if not businesses:
                return {
                    'answer': "Em Tư không tìm thấy doanh nghiệp nào. Hãy thêm doanh nghiệp mới ở trang Quản Lý! 🏢",
                    'suggested_businesses': [],
                    'rag_used': False
                }

            suggested_businesses = []
            for biz in businesses[:10]:
                suggested_businesses.append({
                    'id': biz.get('id', 0),
                    'name': biz.get('ten_doanh_nghiep', 'N/A'),
                    'phone': biz.get('so_dien_thoai', 'Chưa có'),
                    'location': biz.get('tinh_thanh', ''),
                    'region': biz.get('vung_mien', ''),
                    'industry': biz.get('nganh_nghe', ''),
                    'website': biz.get('website', ''),
                    'email': biz.get('email', '')
                })
            
            answer = f"Em tìm thấy {len(suggested_businesses)} doanh nghiệp"
            if region_detected:
                answer += f" ở miền {region_detected}"
            answer += " cho bạn:"
            
            logger.info(f"✅ Returning {len(suggested_businesses)} businesses")
            
            return {
                'answer': answer,
                'suggested_businesses': suggested_businesses,
                'rag_used': True
            }
            
        except Exception as e:
            logger.error(f"❌ Business query failed: {e}", exc_info=True)
            return {
                'answer': "Em Tư đang gặp chút vấn đề khi tìm doanh nghiệp. Bạn thử lại sau nhé! 😅",
                'suggested_businesses': [],
                'rag_used': False
            }
    
    def _handle_general_query(self, message: str) -> Dict:
        """
        Handle general queries - casual conversation
        Dùng AI nhẹ cho trải nghiệm tự nhiên
        """
        try:
            message_lower = message.lower()

            quick_responses = {
                
                'em tên gì': "Em là Em Tư đây! Em giúp bạn tìm tin tức và thông tin doanh nghiệp nha 😊",
                'em là ai': "Em là Em Tư, trợ lý AI thông minh! Em có thể giúp bạn tìm tin tức mới nhất và thông tin doanh nghiệp 📰",
                'em làm được gì': "Em giúp bạn tìm tin tức nhanh chóng và thông tin doanh nghiệp đấy! Hỏi em về tin thời sự, kinh tế, thể thao... gì cũng được nha ⚡",
                
                
                'em giỏi quá': "Cảm ơn bạn! Em sẽ cố gắng giúp bạn tốt hơn nữa nha 🥰",
                'em thông minh': "Hehe, cảm ơn bạn! Có gì cứ hỏi em nhé 😊",
                'dễ thương': "Aww, bạn cũng dễ thương lắm! 💕",
                
                
                'khỏe không': "Em khỏe! Cảm ơn bạn đã hỏi thăm. Bạn thì sao? 😊",
                'bạn thế nào': "Em vẫn ổn! Đang sẵn sàng giúp bạn tìm tin tức nè 📰",
                
                
                'cảm ơn': "Không có gì đâu! Em luôn sẵn sàng giúp bạn 🤗",
                'thank': "You're welcome! Anything else I can help? 😊",
                'thanks': "Happy to help! 🎉",
                
                
                'bye': "Tạm biệt bạn! Hẹn gặp lại nhé 👋",
                'tạm biệt': "Bye bye! Nhớ quay lại hỏi em nha 💕",
                'see you': "See you soon! 👋",
            }
            
            
            for pattern, response in quick_responses.items():
                if pattern in message_lower:
                    return {
                        'answer': response,
                        'documents': [],
                        'rag_used': False
                    }

            casual_keywords = [
                'vui', 'buồn', 'hôm nay', 'thế nào', 'sao', 'tâm trạng',
                'yêu', 'thích', 'ghét', 'funny', 'joke', 'laugh',
                'weather', 'thời tiết', 'ăn gì', 'làm gì', 'đi đâu'
            ]

            if settings.ENABLE_CASUAL_CHAT_AI and len(message.split()) <= settings.MAX_CASUAL_MESSAGE_LENGTH:
                return self._handle_casual_chat_with_ai(message)

            return {
                'answer': "Em Tư chuyên giúp bạn tìm tin tức và thông tin doanh nghiệp nha! 📰\n\n"
                         "Bạn có thể hỏi em:\n"
                         "• \"tin về bóng đá\"\n"
                         "• \"có gì mới về kinh tế?\"\n"
                         "• \"tìm công ty ở Hà Nội\"\n\n"
                         "Hoặc nói chuyện vui với em cũng được! 😊",
                'documents': [],
                'action_buttons': self._get_default_action_buttons(),
                'rag_used': False
            }
            
        except Exception as e:
            logger.error(f"General query error: {e}")
            return {
                'answer': "Em Tư hơi bối rối một chút... Bạn thử hỏi em về tin tức hoặc doanh nghiệp nhé! 😅",
                'documents': [],
                'rag_used': False
            }
    
    def _handle_casual_chat_with_ai(self, message: str) -> Dict:
        """
        Handle casual conversation with lightweight AI
        AUTO-RETRY: Groq (fast) → Gemini (fallback)
        """
        system_prompt = """Bạn là Em Tư, trợ lý AI thân thiện và vui vẻ.

Quy tắc:
- Trả lời ngắn gọn (1-2 câu), thân thiện
- Dùng emoji phù hợp
- Nếu hỏi về tin tức/doanh nghiệp, khuyên user hỏi rõ hơn
- Không bịa thông tin
- Giữ giọng điệu nhẹ nhàng, vui vẻ"""

        try:
            from app.services.groq_service import get_groq_service
            groq_service = get_groq_service()
            
            if groq_service:
                logger.info("🚀 Using Groq for casual chat...")
                answer = groq_service.generate(
                    system_prompt=system_prompt,
                    user_prompt=message,
                    temperature=0.9,
                    max_tokens=512
                )
                
                if answer:
                    return {
                        'answer': answer,
                        'documents': [],
                        'rag_used': True,
                        'is_casual': True,
                        'llm_used': 'groq'
                    }
                
                logger.warning("⚠️ Groq failed, falling back to Gemini...")
        except Exception as e:
            logger.error(f"Groq casual chat error: {e}")

        logger.info("🐢 Using Gemini for casual chat...")
        max_retries = 3
        
        for attempt in range(max_retries):
            try:
               
                import google.generativeai as genai
                from app.config import settings
                from app.services.api_key_manager import get_api_key_manager

                api_key_manager = get_api_key_manager()
                api_key_manager.configure_genai()
                
                model = genai.GenerativeModel(settings.CHAT_MODEL)
                
                response = model.generate_content(
                    [system_prompt, message],
                    generation_config={
                        'temperature': 0.9,
                        'max_output_tokens': 2048,
                        'top_p': 0.95,
                    }
                )
                
                answer = response.text.strip()
                logger.info(f"🤖 Gemini response (attempt {attempt + 1}): {answer[:100]}... (length: {len(answer)})")

                if not answer or len(answer) < 5:
                    return {
                        'answer': "Hehe, em không biết trả lời sao nữa... Bạn hỏi em về tin tức đi! 😅",
                        'documents': [],
                        'rag_used': False
                    }
                
                return {
                    'answer': answer,
                    'documents': [],
                    'rag_used': True,
                    'is_casual': True,
                    'llm_used': 'gemini'
                }
                
            except Exception as e:
                error_str = str(e)
                logger.error(f"Casual chat AI error (attempt {attempt + 1}/{max_retries}): {e}")

                if "429" in error_str or "quota" in error_str.lower():
                    logger.warning(f"⚠️ Quota exceeded, rotating key...")

                    retry_after = 60
                    try:
                        import re
                        match = re.search(r'(\d+\.?\d*)s', error_str)
                        if match:
                            retry_after = int(float(match.group(1)))
                    except:
                        pass

                    from app.services.api_key_manager import get_api_key_manager
                    api_key_manager = get_api_key_manager()
                    current_key = api_key_manager.get_current_key()
                    api_key_manager.mark_key_quota_exceeded(current_key, retry_after)
                    
                    if attempt < max_retries - 1:
                        logger.info(f"🔄 Retrying with new key...")
                        continue

                return {
                    'answer': "Hehe, em hơi lú... Bạn hỏi em về tin tức hoặc doanh nghiệp nhé! 😊",
                    'documents': [],
                    'rag_used': False
                }

        return {
            'answer': "Hehe, em hơi lú... Bạn hỏi em về tin tức hoặc doanh nghiệp nhé! 😊",
            'documents': [],
            'rag_used': False
        }
    
    def _handle_action_button(self, button_id: str) -> Dict:
        """Handle action button clicks"""

        return {
            'answer': "Em Tư lắng nghe! Bạn cần tìm gì nào? 😊",
            'documents': [],
            'action_buttons': [],
            'rag_used': False
        }
    
    def _get_default_action_buttons(self) -> List[Dict]:
        """Get default action buttons - Trả về rỗng"""
        return []
