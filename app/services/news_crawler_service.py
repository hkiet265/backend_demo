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
from app.database import get_db_connection

logger = logging.getLogger(__name__)


class NewsCrawlerService:
    """RSS-based news crawler with minimal AI usage"""

    MAX_ENTRIES_PER_RSS = 50

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

    REGION_MAP = {

        "hà nội": "Bac", "ha noi": "Bac", "hanoi": "Bac",
        "hải phòng": "Bac", "hai phong": "Bac",
        "quảng ninh": "Bac", "quang ninh": "Bac",
        "hải dương": "Bac", "hai duong": "Bac",
        "thái nguyên": "Bac", "thai nguyen": "Bac",
        "bắc ninh": "Bac", "bac ninh": "Bac",
        "bắc giang": "Bac", "bac giang": "Bac",

        "đà nẵng": "Trung", "da nang": "Trung", "danang": "Trung",
        "huế": "Trung", "hue": "Trung",
        "quảng nam": "Trung", "quang nam": "Trung",
        "quảng ngãi": "Trung", "quang ngai": "Trung",
        "bình định": "Trung", "binh dinh": "Trung",
        "phú yên": "Trung", "phu yen": "Trung",
        "khánh hòa": "Trung", "khanh hoa": "Trung",
        "nghệ an": "Trung", "nghe an": "Trung",
        "hà tĩnh": "Trung", "ha tinh": "Trung",

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
    
    def check_duplicate(self, url: str, title: str) -> bool:
        """
        Kiểm tra tin tức đã tồn tại chưa bằng hash
        Returns True nếu trùng (bỏ qua), False nếu chưa có
        """
        try:
            content_hash = self.generate_hash(url + title)
            
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    "SELECT 1 FROM station_news WHERE hash_noi_dung = %s LIMIT 1;",
                    (content_hash,)
                )
                exists = cur.fetchone() is not None
                cur.close()
                return exists
            
        except Exception as e:
            logger.error(f"Check duplicate error: {e}")
            return False
    
    def detect_region_from_text(self, text: str) -> Optional[str]:
        """
        Phát hiện vùng miền từ text bằng rules-based
        100% miễn phí, không dùng AI
        """
        if not text:
            return None
        
        text_lower = text.lower()

        for location, region in self.REGION_MAP.items():
            if location in text_lower:
                return region
        
        return None
    
    def normalize_category(self, rss_category: str) -> str:
        """Chuẩn hóa chuyên mục từ RSS sang format DB"""
        for key, value in self.CATEGORY_MAP.items():
            if key in rss_category.lower():
                return value
        return "Thời sự"
    
    def clean_text(self, text: str) -> str:
        """Làm sạch text, loại bỏ HTML tags"""
        if not text:
            return ""

        text = re.sub(r'<[^>]+>', '', text)

        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def crawl_from_rss(self, source_name: str, rss_url: str) -> List[Dict]:
        """
        Cào tin từ RSS feed
        Miễn phí 100%, không tốn token AI
        
        Args:
            source_name: Tên nguồn (VTV, VTC, VOV)
            rss_url: URL RSS feed
        """
        try:
            logger.info(f"Crawling RSS: {source_name} - {rss_url}")

            feed = feedparser.parse(rss_url)
            
            if feed.bozo: 
                logger.warning(f"RSS parse error: {rss_url}")
                return []
            
            news_list = []
            total_checked = 0
            duplicates_found = 0

            entries_to_process = feed.entries[:self.MAX_ENTRIES_PER_RSS]
            
            for entry in entries_to_process:
                total_checked += 1

                title = self.clean_text(entry.get('title', ''))
                url = entry.get('link', '')

                if not title or not url:
                    continue

                if self.check_duplicate(url, title):
                    duplicates_found += 1
                    continue

                summary = self.clean_text(entry.get('summary', '') or entry.get('description', ''))

                category = self.normalize_category(rss_url)

                region = self.detect_region_from_text(title + " " + summary)

                published_at = None
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    try:
                        published_at = datetime(*entry.published_parsed[:6])
                    except:
                        pass

                content_hash = self.generate_hash(url + title)
                
                news_item = {
                    'tieu_de': title[:500],
                    'tom_tat': summary[:1000] if summary else None,
                    'url': url,
                    'nha_dai': source_name,
                    'vung_mien': region,
                    'chuyen_muc': category,
                    'thoi_gian_dang': published_at or datetime.now(),
                    'hash_noi_dung': content_hash,
                    'do_tin_cay': 90,
                    'trang_thai': 'Cho_duyet'
                }
                
                news_list.append(news_item)
            
            logger.info(f"RSS {source_name}: Checked {total_checked} entries, found {len(news_list)} new articles ({duplicates_found} duplicates)")
            return news_list
            
        except Exception as e:
            logger.error(f"Crawl RSS error ({rss_url}): {e}")
            return []
    
    def save_news_to_db(self, news_list: List[Dict]) -> Dict:
        """Lưu tin tức vào database sử dụng connection pool"""
        if not news_list:
            return {"inserted": 0, "skipped": 0, "errors": []}
        
        try:
            with get_db_connection() as conn:
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
                
                logger.info(f"Saved to DB: {inserted} inserted, {skipped} skipped")
                return {
                    "inserted": inserted,
                    "skipped": skipped,
                    "errors": errors[:5]
                }
                    
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

                    time.sleep(1)
                    
                except Exception as e:
                    logger.error(f"Error crawling {source_name} - {rss_url}: {e}")
                    summary["errors"].append(f"{source_name}: {str(e)[:50]}")

        if total_news:
            result = self.save_news_to_db(total_news)
            summary["total_found"] = len(total_news)
            summary["total_inserted"] = result["inserted"]
            summary["total_skipped"] = result["skipped"]
            summary["errors"].extend(result["errors"])
        
        logger.info(f"✅ Crawl completed - Found: {summary['total_found']}, Inserted: {summary['total_inserted']}, Skipped: {summary['total_skipped']}")
        return summary
 
_crawler_service = None

def get_crawler_service() -> NewsCrawlerService:
    """Get singleton crawler service instance"""
    global _crawler_service
    if _crawler_service is None:
        _crawler_service = NewsCrawlerService()
    return _crawler_service
