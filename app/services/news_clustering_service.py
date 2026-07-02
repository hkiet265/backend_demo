"""
News Clustering Service
Gom cụm tin tức tương tự để phát hiện bài trùng lặp và tạo bản tin tổng hợp
"""
import logging
from typing import List, Dict, Any, Optional
from difflib import SequenceMatcher
import re
from collections import defaultdict
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class NewsClusteringService:
    """
    Service for clustering similar news articles
    
    Methods:
    - Similarity scoring (title + summary)
    - Time-based clustering (same event reported by multiple sources)
    - Keyword-based grouping
    """
    
    def __init__(self, similarity_threshold: float = 0.7, time_window_hours: int = 48):
        """
        Args:
            similarity_threshold: Ngưỡng tương đồng (0-1) để gom cụm
            time_window_hours: Cửa sổ thời gian (giờ) để coi là cùng sự kiện
        """
        self.similarity_threshold = similarity_threshold
        self.time_window_hours = time_window_hours
    
    def normalize_text(self, text: str) -> str:
        """
        Chuẩn hóa văn bản để so sánh
        - Lowercase
        - Remove punctuation
        - Remove extra spaces
        """
        if not text:
            return ""
        
        # Lowercase
        text = text.lower()
        
        # Remove punctuation
        text = re.sub(r'[^\w\s]', ' ', text)
        
        # Remove extra spaces
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def calculate_text_similarity(self, text1: str, text2: str) -> float:
        """
        Tính độ tương đồng giữa 2 văn bản (0-1)
        Sử dụng SequenceMatcher
        """
        if not text1 or not text2:
            return 0.0
        
        norm1 = self.normalize_text(text1)
        norm2 = self.normalize_text(text2)
        
        if not norm1 or not norm2:
            return 0.0
        
        return SequenceMatcher(None, norm1, norm2).ratio()
    
    def calculate_news_similarity(self, news1: Dict, news2: Dict) -> float:
        """
        Tính độ tương đồng giữa 2 tin tức
        
        Scoring:
        - Title similarity (60%)
        - Summary similarity (30%)
        - Same category (10%)
        """
        score = 0.0
        
        # Title similarity (60%)
        title1 = news1.get('tieu_de', '') or news1.get('title', '')
        title2 = news2.get('tieu_de', '') or news2.get('title', '')
        title_sim = self.calculate_text_similarity(title1, title2)
        score += title_sim * 0.6
        
        # Summary similarity (30%)
        summary1 = news1.get('tom_tat', '') or news1.get('summary', '')
        summary2 = news2.get('tom_tat', '') or news2.get('summary', '')
        summary_sim = self.calculate_text_similarity(summary1, summary2)
        score += summary_sim * 0.3
        
        # Same category (10%)
        cat1 = news1.get('chuyen_muc', '') or news1.get('category', '')
        cat2 = news2.get('chuyen_muc', '') or news2.get('category', '')
        if cat1 and cat2 and cat1.lower() == cat2.lower():
            score += 0.1
        
        return score
    
    def is_within_time_window(self, news1: Dict, news2: Dict) -> bool:
        """
        Kiểm tra 2 tin có trong cùng cửa sổ thời gian không
        """
        try:
            # Lấy thời gian
            time1 = news1.get('thoi_gian_dang') or news1.get('published_at') or news1.get('created_at')
            time2 = news2.get('thoi_gian_dang') or news2.get('published_at') or news2.get('created_at')
            
            if not time1 or not time2:
                return True  # Không có thông tin thời gian, coi như trong window
            
            # Parse datetime
            from dateutil import parser
            if isinstance(time1, str):
                dt1 = parser.parse(time1)
            else:
                dt1 = time1
            
            if isinstance(time2, str):
                dt2 = parser.parse(time2)
            else:
                dt2 = time2
            
            # Check time difference
            diff_hours = abs((dt1 - dt2).total_seconds()) / 3600
            return diff_hours <= self.time_window_hours
            
        except Exception as e:
            logger.error(f"Time window check error: {e}")
            return True
    
    def find_similar_news(self, target_news: Dict, news_list: List[Dict]) -> List[Dict]:
        """
        Tìm các tin tương tự với tin mục tiêu
        
        Args:
            target_news: Tin tức cần tìm tương tự
            news_list: Danh sách tin để so sánh
            
        Returns:
            List of similar news with similarity scores
        """
        similar = []
        
        target_id = target_news.get('id')
        
        for news in news_list:
            # Bỏ qua chính nó
            if news.get('id') == target_id:
                continue
            
            # Kiểm tra time window
            if not self.is_within_time_window(target_news, news):
                continue
            
            # Tính similarity
            similarity = self.calculate_news_similarity(target_news, news)
            
            if similarity >= self.similarity_threshold:
                similar.append({
                    'news': news,
                    'similarity': similarity
                })
        
        # Sắp xếp theo độ tương đồng giảm dần
        similar.sort(key=lambda x: x['similarity'], reverse=True)
        
        return similar
    
    def cluster_news(self, news_list: List[Dict]) -> List[List[Dict]]:
        """
        Gom cụm toàn bộ danh sách tin tức
        
        Args:
            news_list: Danh sách tin tức
            
        Returns:
            List of clusters, mỗi cluster là list các tin tương tự
        """
        if not news_list:
            return []
        
        clusters = []
        processed = set()
        
        for i, news in enumerate(news_list):
            news_id = news.get('id')
            
            # Đã được xử lý
            if news_id in processed:
                continue
            
            # Tạo cluster mới với tin này là trung tâm
            cluster = [news]
            processed.add(news_id)
            
            # Tìm các tin tương tự
            for j, other_news in enumerate(news_list[i+1:], start=i+1):
                other_id = other_news.get('id')
                
                if other_id in processed:
                    continue
                
                # Check time window
                if not self.is_within_time_window(news, other_news):
                    continue
                
                # Check similarity
                similarity = self.calculate_news_similarity(news, other_news)
                
                if similarity >= self.similarity_threshold:
                    cluster.append(other_news)
                    processed.add(other_id)
            
            # Chỉ thêm cluster nếu có ít nhất 1 tin
            clusters.append(cluster)
        
        # Sắp xếp clusters theo size giảm dần
        clusters.sort(key=lambda c: len(c), reverse=True)
        
        return clusters
    
    def get_duplicate_clusters(self, news_list: List[Dict]) -> List[List[Dict]]:
        """
        Lấy chỉ các cluster có tin trùng lặp (size >= 2)
        """
        all_clusters = self.cluster_news(news_list)
        return [c for c in all_clusters if len(c) >= 2]
    
    def create_cluster_summary(self, cluster: List[Dict]) -> Dict:
        """
        Tạo tóm tắt cho 1 cluster tin tức
        
        Returns:
            Dict with:
            - title: Tiêu đề đại diện
            - summary: Tóm tắt
            - sources: Các nguồn tin
            - count: Số tin trong cluster
            - time_range: Khoảng thời gian
            - articles: Danh sách bài viết
        """
        if not cluster:
            return {}
        
        # Lấy tin đầu tiên làm đại diện
        representative = cluster[0]
        
        # Thu thập nguồn tin
        sources = []
        for news in cluster:
            source = news.get('nha_dai') or news.get('source')
            if source and source not in sources:
                sources.append(source)
        
        # Tìm khoảng thời gian
        times = []
        for news in cluster:
            time_str = news.get('thoi_gian_dang') or news.get('published_at') or news.get('created_at')
            if time_str:
                try:
                    from dateutil import parser
                    if isinstance(time_str, str):
                        dt = parser.parse(time_str)
                    else:
                        dt = time_str
                    times.append(dt)
                except:
                    pass
        
        time_range = None
        if times:
            min_time = min(times)
            max_time = max(times)
            if min_time == max_time:
                time_range = min_time.strftime('%d/%m/%Y %H:%M')
            else:
                time_range = f"{min_time.strftime('%d/%m/%Y %H:%M')} - {max_time.strftime('%d/%m/%Y %H:%M')}"
        
        return {
            'title': representative.get('tieu_de') or representative.get('title'),
            'summary': representative.get('tom_tat') or representative.get('summary'),
            'sources': sources,
            'count': len(cluster),
            'time_range': time_range,
            'articles': cluster
        }
    
    def detect_duplicates(self, news_item: Dict, existing_news: List[Dict]) -> List[Dict]:
        """
        Phát hiện tin trùng lặp khi thêm tin mới
        
        Args:
            news_item: Tin mới cần kiểm tra
            existing_news: Danh sách tin đã có
            
        Returns:
            List of potential duplicates
        """
        return self.find_similar_news(news_item, existing_news)
    
    def get_clustering_stats(self, news_list: List[Dict]) -> Dict:
        """
        Thống kê clustering
        
        Returns:
            Dict with:
            - total_news: Tổng số tin
            - num_clusters: Số cluster
            - num_duplicates: Số tin trùng lặp
            - largest_cluster_size: Cluster lớn nhất
        """
        clusters = self.cluster_news(news_list)
        duplicate_clusters = [c for c in clusters if len(c) >= 2]
        
        num_duplicates = sum(len(c) - 1 for c in duplicate_clusters)
        largest_size = max([len(c) for c in clusters]) if clusters else 0
        
        return {
            'total_news': len(news_list),
            'num_clusters': len(clusters),
            'num_duplicate_groups': len(duplicate_clusters),
            'num_duplicates': num_duplicates,
            'largest_cluster_size': largest_size
        }


_clustering_service = None

def get_clustering_service() -> NewsClusteringService:
    """Get singleton clustering service"""
    global _clustering_service
    if _clustering_service is None:
        _clustering_service = NewsClusteringService(
            similarity_threshold=0.7,
            time_window_hours=48
        )
    return _clustering_service
