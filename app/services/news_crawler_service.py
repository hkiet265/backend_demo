"""
News Crawler Service - Optimized RSS-based crawler
Tiết kiệm token bằng cách:
1. Ưu tiên RSS feed (miễn phí)
2. Hash checking để tránh trùng lặp
3. Rules-based normalization thay vì AI
4. Chỉ dùng AI khi thực sự cần thiết
"""
import feedparser
import hashlib
import logging
from datetime import datetime
from typing import List, Dict, Optional
import re
import psycopg2
from psycopg2.extras import RealDictCursor
from app.config import settings

logger = logging.getLogger(__name__)


class NewsCrawlerService:
    """RSS-based news crawler with minimal AI usage"""
    
    # Giới hạn số bài viết crawl mỗi lần (tránh quá tải)
    MAX_ENTRIES_PER_RSS = 50  # Chỉ lấy 50 bài mới nhất
    
    # RSS feeds của các nhà đài Việt Nam
    RSS_SOURCES = {
        "VTV": [
            "https://vtv.vn/rss/trong-nuoc.rss",
            "https://vtv.vn/rss/the-gioi.rss",
            "https://vtv.vn/rss/kinh-te.rss",
            "https://vtv.vn/rss/the-thao.rss",
        ],
        "VTC": [
            "https://vtc.vn/rss/thoi-su.rss",
            "https://vtc.vn/rss/kinh-te.rss",
            "https://vtc.vn/rss/the-thao.rss",
        ],
        "VOV": [
            "https://vov.vn/rss/tin-moi.rss",
            "https://vov.vn/rss/kinh-te.rss",
            "https://vov.vn/rss/xa-hoi.rss",
        ]
    }
    
    # Mapping chuyên mục từ RSS sang DB
    CATEGORY_MAP = {
        "trong-nuoc": "Thời sự",
        "thoi-su": "Thời sự",
        "the-gioi": "Quốc tế",
        "kinh-te": "Kinh tế",
        "the-thao": "Thể thao",
        "xa-hoi": "Xã hội",
        "van-hoa": "Văn hóa",
        "giai-tri": "Giải trí",
        "cong-nghe": "Công nghệ",
        "suc-khoe": "Sức khỏe"
    }
    
    # Mapping địa danh -> vùng miền (Rules-based, không tốn token)
    REGION_MAP = {
        # Bắc
        "hà nội": "Bac", "ha noi": "Bac", "hanoi": "Bac",
        "hải phòng": "Bac", "hai phong": "Bac",
        "quảng ninh": "Bac", "quang ninh": "Bac",
        "hải dương": "Bac", "hai duong": "Bac",
        "thái nguyên": "Bac", "thai nguyen": "Bac",
        "bắc ninh": "Bac", "bac ninh": "Bac",
        "bắc giang": "Bac", "bac giang": "Bac",
        
        # Trung
        "đà nẵng": "Trung", "da nang": "Trung", "danang": "Trung",
        "huế": "Trung", "hue": "Trung",
        "quảng nam": "Trung", "quang nam": "Trung",
        "quảng ngãi": "Trung", "quang ngai": "Trung",
        "bình định": "Trung", "binh dinh": "Trung",
        "phú yên": "Trung", "phu yen": "Trung",
        "khánh hòa": "Trung", "khanh hoa": "Trung",
        "nghệ an": "Trung", "nghe an": "Trung",
        "hà tĩnh": "Trung", "ha tinh": "Trung",
        
        # Nam
        "tp.hcm": "Nam", "hồ chí minh": "Nam", "ho chi minh": "Nam", 
        "sài gòn": "Nam", "saigon": "Nam", "sai gon": "Nam",
        "cần thơ": "Nam", "can tho": "Nam",
        "đồng nai": "Nam", "dong nai": "Nam",
        "bình dương": "Nam", "binh duong": "Nam",
        "vũng tàu": "Nam", "vung tau": "Nam",
        "long an": "Nam", "tiền giang": "Nam", "tien giang": "Nam",
        "bến tre": "Nam", "ben tre": "Nam",
        "an giang": "Nam", "kiên giang": "Nam", "kien giang": "Nam"
    }
    
    def __init__(self):
        """Initialize crawler service"""
        logger.info("NewsCrawlerService initialized")
    
    def generate_hash(self, content: str) -> str:
        """
        Tạo hash MD5 từ nội dung để check duplicate
        100% miễn phí, không tốn token
        """
        return hashlib.md5(content.encode('utf-8')).hexdigest()
    
    def check_duplicate(self, url: str, title: str, conn=None) -> bool:
        """
        Kiểm tra tin tức đã tồn tại chưa bằng hash
        Returns True nếu trùng (bỏ qua), False nếu chưa có
        """
        should_close = False
        try:
            # Tạo hash từ URL hoặc title
            content_hash = self.generate_hash(url + title)
            
            # Sử dụng connection được truyền vào hoặc tạo mới
            if conn is None:
                conn = psycopg2.connect(**settings.database_url)
                should_close = True
            
            cur = conn.cursor()
            
            cur.execute(
                "SELECT 1 FROM station_news WHERE hash_noi_dung = %s LIMIT 1;",
                (content_hash,)
            )
            
            exists = cur.fetchone() is not None
            
            cur.close()
            
            if should_close:
                conn.close()
            
            return exists
            
        except Exception as e:
            logger.error(f"Check duplicate error: {e}")
            if should_close and conn:
                try:
                    conn.close()
                except:
                    pass
            return False
    
    def detect_region_from_text(self, text: str) -> Optional[str]:
        """
        Phát hiện vùng miền từ text bằng rules-based
        100% miễn phí, không dùng AI
        """
        if not text:
            return None
        
        text_lower = text.lower()
        
        # Tìm địa danh trong text
        for location, region in self.REGION_MAP.items():
            if location in text_lower:
                return region
        
        return None
    
    def normalize_category(self, rss_category: str) -> str:
        """Chuẩn hóa chuyên mục từ RSS sang format DB"""
        for key, value in self.CATEGORY_MAP.items():
            if key in rss_category.lower():
                return value
        return "Thời sự"  # Default
    
    def clean_text(self, text: str) -> str:
        """Làm sạch text, loại bỏ HTML tags"""
        if not text:
            return ""
        
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def crawl_from_rss(self, source_name: str, rss_url: str, batch_check_duplicates: bool = True) -> List[Dict]:
        """
        Cào tin từ RSS feed
        Miễn phí 100%, không tốn token AI
        
        Args:
            source_name: Tên nguồn (VTV, VTC, VOV)
            rss_url: URL RSS feed
            batch_check_duplicates: Nếu True, check duplicate theo batch (nhanh hơn)
        """
        try:
            logger.info(f"Crawling RSS: {source_name} - {rss_url}")
            
            # Parse RSS
            feed = feedparser.parse(rss_url)
            
            if feed.bozo:  # RSS parsing error
                logger.warning(f"RSS parse error: {rss_url}")
                return []
            
            news_list = []
            total_checked = 0
            duplicates_found = 0
            
            # Mở connection một lần cho toàn bộ batch
            conn = None
            try:
                if batch_check_duplicates:
                    conn = psycopg2.connect(**settings.database_url)
            except Exception as e:
                logger.warning(f"Cannot create DB connection for batch check: {e}")
                conn = None
            
            # Giới hạn số entries để xử lý (lấy mới nhất)
            entries_to_process = feed.entries[:self.MAX_ENTRIES_PER_RSS]
            
            for entry in entries_to_process:
                total_checked += 1
                
                # Lấy thông tin cơ bản từ RSS
                title = self.clean_text(entry.get('title', ''))
                url = entry.get('link', '')
                
                # Skip nếu không có title hoặc url
                if not title or not url:
                    continue
                
                # Check duplicate trước (dùng connection chung)
                if self.check_duplicate(url, title, conn=conn):
                    duplicates_found += 1
                    continue
                
                # Lấy summary (RSS thường có sẵn)
                summary = self.clean_text(entry.get('summary', '') or entry.get('description', ''))
                
                # Chuẩn hóa category từ RSS URL
                category = self.normalize_category(rss_url)
                
                # Phát hiện vùng miền từ title + summary (rules-based)
                region = self.detect_region_from_text(title + " " + summary)
                
                # Published date
                published_at = None
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    try:
                        published_at = datetime(*entry.published_parsed[:6])
                    except:
                        pass
                
                # Tạo hash
                content_hash = self.generate_hash(url + title)
                
                news_item = {
                    'tieu_de': title[:500],  # Giới hạn độ dài
                    'tom_tat': summary[:1000] if summary else None,
                    'url': url,
                    'nha_dai': source_name,
                    'vung_mien': region,
                    'chuyen_muc': category,
                    'thoi_gian_dang': published_at or datetime.now(),
                    'hash_noi_dung': content_hash,
                    'do_tin_cay': 90,  # RSS từ nhà đài chính thống = tin cậy cao
                    'trang_thai': 'Cho_duyet'  # Admin duyệt trước khi publish
                }
                
                news_list.append(news_item)
            
            # Đóng connection nếu đã mở
            if conn:
                try:
                    conn.close()
                except:
                    pass
            
            logger.info(f"RSS {source_name}: Checked {total_checked} entries, found {len(news_list)} new articles ({duplicates_found} duplicates)")
            return news_list
            
        except Exception as e:
            logger.error(f"Crawl RSS error ({rss_url}): {e}")
            if conn:
                try:
                    conn.close()
                except:
                    pass
            return []
    
    def save_news_to_db(self, news_list: List[Dict]) -> Dict:
        """Lưu tin tức vào database với retry logic"""
        if not news_list:
            return {"inserted": 0, "skipped": 0, "errors": []}
        
        max_retries = 3
        retry_delay = 2  # seconds
        
        for attempt in range(max_retries):
            try:
                conn = psycopg2.connect(
                    **settings.database_url,
                    connect_timeout=10  # 10s timeout
                )
                cur = conn.cursor()
                
                inserted = 0
                skipped = 0
                errors = []
                
                for news in news_list:
                    try:
                        cur.execute("""
                            INSERT INTO station_news (
                                tieu_de, tom_tat, url, nha_dai, vung_mien, chuyen_muc,
                                thoi_gian_dang, hash_noi_dung, do_tin_cay,
                                trang_thai, created_at
                            ) VALUES (
                                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
                            )
                            ON CONFLICT (hash_noi_dung) DO NOTHING;
                        """, (
                            news['tieu_de'],
                            news['tom_tat'],
                            news['url'],
                            news['nha_dai'],
                            news['vung_mien'],
                            news['chuyen_muc'],
                            news['thoi_gian_dang'],
                            news['hash_noi_dung'],
                            news['do_tin_cay'],
                            news['trang_thai']
                        ))
                        
                        if cur.rowcount > 0:
                            inserted += 1
                        else:
                            skipped += 1
                            
                    except Exception as e:
                        errors.append(str(e)[:100])
                        skipped += 1
                
                conn.commit()
                cur.close()
                conn.close()
                
                logger.info(f"Saved to DB: {inserted} inserted, {skipped} skipped")
                return {
                    "inserted": inserted,
                    "skipped": skipped,
                    "errors": errors[:5]  # Chỉ lấy 5 lỗi đầu
                }
                
            except psycopg2.OperationalError as e:
                logger.warning(f"DB connection failed (attempt {attempt+1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    import time
                    time.sleep(retry_delay)
                    continue
                else:
                    logger.error(f"Save to DB failed after {max_retries} attempts")
                    return {"inserted": 0, "skipped": 0, "errors": [f"Connection failed: {str(e)[:100]}"]}
                    
            except Exception as e:
                logger.error(f"Save to DB error: {e}")
                return {"inserted": 0, "skipped": 0, "errors": [str(e)[:100]]}
    
    def crawl_all_sources(self) -> Dict:
        """
        Cào tin từ tất cả các nguồn RSS
        Chạy định kỳ bằng cronjob
        """
        import time
        
        total_news = []
        summary = {
            "sources_crawled": 0,
            "total_found": 0,
            "total_inserted": 0,
            "total_skipped": 0,
            "errors": []
        }
        
        for source_name, rss_urls in self.RSS_SOURCES.items():
            for rss_url in rss_urls:
                try:
                    news_list = self.crawl_from_rss(source_name, rss_url)
                    total_news.extend(news_list)
                    summary["sources_crawled"] += 1
                    
                    # Delay 1s giữa mỗi RSS để tránh quá tải
                    time.sleep(1)
                    
                except Exception as e:
                    logger.error(f"Error crawling {source_name} - {rss_url}: {e}")
                    summary["errors"].append(f"{source_name}: {str(e)[:50]}")
        
        # Lưu vào DB
        if total_news:
            result = self.save_news_to_db(total_news)
            summary["total_found"] = len(total_news)
            summary["total_inserted"] = result["inserted"]
            summary["total_skipped"] = result["skipped"]
            summary["errors"].extend(result["errors"])
        
        logger.info(f"✅ Crawl completed - Found: {summary['total_found']}, Inserted: {summary['total_inserted']}, Skipped: {summary['total_skipped']}")
        return summary


# Singleton instance
_crawler_service = None

def get_crawler_service() -> NewsCrawlerService:
    """Get singleton crawler service instance"""
    global _crawler_service
    if _crawler_service is None:
        _crawler_service = NewsCrawlerService()
    return _crawler_service
