"""
NLP Search Service
Advanced search using Natural Language Processing
"""
import logging
from typing import Dict, Any, Optional, List
import re
from app.services.groq_service import get_groq_service

logger = logging.getLogger(__name__)


class NLPSearchService:
    """
    Service for intelligent NLP-powered search
    
    Features:
    - Intent detection (tìm doanh nghiệp vs tìm tin tức)
    - Entity extraction (tên, địa điểm, ngành nghề)
    - Semantic search with embeddings
    - Query expansion
    - Natural language to SQL
    """
    
    def __init__(self):
        self.groq_service = get_groq_service()
        
        # Intent patterns
        self.intent_patterns = {
            'find_business': [
                r'tìm.*doanh nghiệp',
                r'tìm.*công ty',
                r'có.*công ty.*nào',
                r'danh sách.*doanh nghiệp'
            ],
            'find_news': [
                r'tin tức.*về',
                r'có tin.*gì',
                r'tìm.*bài viết',
                r'tìm.*tin'
            ],
            'compare': [
                r'so sánh',
                r'khác nhau',
                r'tốt hơn'
            ]
        }
    
    def detect_intent(self, query: str) -> str:
        """
        Phát hiện intent của câu hỏi
        
        Returns:
            'find_business', 'find_news', 'compare', or 'unknown'
        """
        query_lower = query.lower()
        
        for intent, patterns in self.intent_patterns.items():
            for pattern in patterns:
                if re.search(pattern, query_lower):
                    return intent
        
        # Default fallback
        if any(kw in query_lower for kw in ['doanh nghiệp', 'công ty', 'shop', 'cửa hàng']):
            return 'find_business'
        elif any(kw in query_lower for kw in ['tin', 'bài', 'news', 'article']):
            return 'find_news'
        
        return 'unknown'
    
    def extract_entities(self, query: str) -> Dict[str, Any]:
        """
        Trích xuất thực thể từ query
        
        Returns:
            {
                'location': 'Hà Nội',
                'industry': 'Công nghệ',
                'keywords': ['fintech', 'startup']
            }
        """
        entities = {
            'location': None,
            'industry': None,
            'region': None,
            'keywords': []
        }
        
        query_lower = query.lower()
        
        # Extract location
        locations = [
            'hà nội', 'hải phòng', 'đà nẵng', 'tp.hcm', 'hồ chí minh',
            'cần thơ', 'huế', 'nha trang', 'vũng tàu'
        ]
        for loc in locations:
            if loc in query_lower:
                entities['location'] = loc.title()
                break
        
        # Extract region
        if any(r in query_lower for r in ['miền bắc', 'bắc', 'phía bắc']):
            entities['region'] = 'Bac'
        elif any(r in query_lower for r in ['miền trung', 'trung', 'miền trung']):
            entities['region'] = 'Trung'
        elif any(r in query_lower for r in ['miền nam', 'nam', 'phía nam']):
            entities['region'] = 'Nam'
        
        # Extract industry
        industries = {
            'công nghệ': 'Công Nghệ Thông Tin',
            'it': 'Công Nghệ Thông Tin',
            'fintech': 'Fintech',
            'f&b': 'F&B / Thực Phẩm',
            'thực phẩm': 'F&B / Thực Phẩm',
            'xây dựng': 'Xây Dựng',
            'logistics': 'Logistics & Vận Tải'
        }
        
        for keyword, industry in industries.items():
            if keyword in query_lower:
                entities['industry'] = industry
                break
        
        # Extract general keywords
        # Remove common words
        stop_words = ['tìm', 'cho', 'tôi', 'về', 'có', 'gì', 'nào', 'là', 'ở']
        words = query_lower.split()
        keywords = [w for w in words if w not in stop_words and len(w) > 2]
        entities['keywords'] = keywords[:5]  # Top 5 keywords
        
        return entities
    
    async def build_search_query(self, query: str, intent: str, entities: Dict) -> Dict:
        """
        Xây dựng search query từ NLP analysis
        
        Returns:
            {
                'filters': {...},
                'search_text': '...',
                'sort': '...'
            }
        """
        search_params = {
            'filters': {},
            'search_text': None,
            'sort': 'relevance'
        }
        
        if intent == 'find_business':
            # Build business filters
            if entities['location']:
                search_params['filters']['location'] = entities['location']
            if entities['region']:
                search_params['filters']['region'] = entities['region']
            if entities['industry']:
                search_params['filters']['industry'] = entities['industry']
            if entities['keywords']:
                search_params['search_text'] = ' '.join(entities['keywords'])
        
        elif intent == 'find_news':
            # Build news filters
            if entities['location']:
                search_params['search_text'] = entities['location']
            if entities['keywords']:
                if search_params['search_text']:
                    search_params['search_text'] += ' ' + ' '.join(entities['keywords'])
                else:
                    search_params['search_text'] = ' '.join(entities['keywords'])
        
        return search_params
    
    async def semantic_search_businesses(
        self,
        conn,
        query: str,
        limit: int = 10
    ) -> List[Dict]:
        """
        Semantic search for businesses using embeddings
        NOTE: Requires embeddings in database
        """
        try:
            # For now, use simple text search
            # TODO: Implement embedding-based search when embeddings are available
            logger.warning("Semantic search not fully implemented, falling back to text search")
            
            cur = conn.cursor()
            
            cur.execute("""
                SELECT 
                    id, ten_doanh_nghiep, nganh_nghe, tinh_thanh, vung_mien,
                    so_dien_thoai, email, website, mo_ta
                FROM businesses_demo
                WHERE ten_doanh_nghiep ILIKE %s OR mo_ta ILIKE %s
                LIMIT %s;
            """, (f"%{query}%", f"%{query}%", limit))
            
            rows = cur.fetchall()
            cur.close()
            
            results = []
            for row in rows:
                results.append({
                    'id': row[0],
                    'name': row[1],
                    'industry': row[2],
                    'location': row[3],
                    'region': row[4],
                    'phone': row[5],
                    'email': row[6],
                    'website': row[7],
                    'description': row[8],
                    'similarity': 0.8  # Placeholder
                })
            
            logger.info(f"✅ Text search found {len(results)} businesses")
            return results
            
        except Exception as e:
            logger.error(f"Search error: {e}")
            return []
    
    async def nlp_search(
        self,
        conn,
        query: str,
        use_semantic: bool = True
    ) -> Dict:
        """
        Main NLP search function
        
        Returns:
            {
                'intent': '...',
                'entities': {...},
                'results': [...],
                'suggestions': [...]
            }
        """
        # Step 1: Detect intent
        intent = self.detect_intent(query)
        
        # Step 2: Extract entities
        entities = self.extract_entities(query)
        
        # Step 3: Build search query
        search_params = await self.build_search_query(query, intent, entities)
        
        # Step 4: Execute search
        results = []
        
        if use_semantic and intent == 'find_business':
            # Use semantic search
            results = await self.semantic_search_businesses(conn, query, limit=20)
        else:
            # Use traditional search with filters
            results = await self._traditional_search(conn, intent, search_params)
        
        # Step 5: Generate suggestions
        suggestions = self._generate_suggestions(query, intent, entities)
        
        return {
            'intent': intent,
            'entities': entities,
            'results': results,
            'suggestions': suggestions,
            'count': len(results)
        }
    
    async def _traditional_search(
        self,
        conn,
        intent: str,
        search_params: Dict
    ) -> List[Dict]:
        """
        Traditional keyword-based search
        """
        try:
            cur = conn.cursor()
            
            if intent == 'find_business':
                conditions = []
                params = []
                
                if search_params['filters'].get('region'):
                    conditions.append("vung_mien = %s")
                    params.append(search_params['filters']['region'])
                
                if search_params['filters'].get('industry'):
                    conditions.append("nganh_nghe ILIKE %s")
                    params.append(f"%{search_params['filters']['industry']}%")
                
                if search_params['search_text']:
                    conditions.append("(ten_doanh_nghiep ILIKE %s OR mo_ta ILIKE %s)")
                    params.extend([
                        f"%{search_params['search_text']}%",
                        f"%{search_params['search_text']}%"
                    ])
                
                where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
                
                query = f"""
                    SELECT id, ten_doanh_nghiep, nganh_nghe, tinh_thanh, vung_mien
                    FROM businesses_demo
                    {where_clause}
                    LIMIT 20;
                """
                
                cur.execute(query, params)
                rows = cur.fetchall()
                
                results = []
                for row in rows:
                    results.append({
                        'id': row[0],
                        'name': row[1],
                        'industry': row[2],
                        'location': row[3],
                        'region': row[4]
                    })
                
                cur.close()
                return results
            
            return []
            
        except Exception as e:
            logger.error(f"Traditional search error: {e}")
            return []
    
    def _generate_suggestions(
        self,
        query: str,
        intent: str,
        entities: Dict
    ) -> List[str]:
        """
        Tạo gợi ý search tương tự
        """
        suggestions = []
        
        if intent == 'find_business':
            if entities['industry']:
                suggestions.append(f"Doanh nghiệp {entities['industry']} ở Hà Nội")
                suggestions.append(f"Top công ty {entities['industry']} uy tín")
            if entities['location']:
                suggestions.append(f"Công ty công nghệ ở {entities['location']}")
        
        elif intent == 'find_news':
            if entities['keywords']:
                kw = entities['keywords'][0]
                suggestions.append(f"Tin tức mới nhất về {kw}")
                suggestions.append(f"{kw} hôm nay")
        
        return suggestions[:3]


_nlp_search_service = None

def get_nlp_search_service() -> NLPSearchService:
    """Get singleton NLP search service"""
    global _nlp_search_service
    if _nlp_search_service is None:
        _nlp_search_service = NLPSearchService()
    return _nlp_search_service
