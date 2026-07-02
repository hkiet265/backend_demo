"""
Website Scraper Service
Thu thập thông tin từ website doanh nghiệp với respect robots.txt
"""
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
from urllib.robotparser import RobotFileParser
import re
import logging
from typing import Optional, Dict, List
import time

logger = logging.getLogger(__name__)


class WebsiteScraperService:
    """Service for scraping business website information"""
    
    def __init__(self, timeout: int = 10, max_retries: int = 2):
        self.timeout = timeout
        self.max_retries = max_retries
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'EmTuNewsBot/1.0 (Business Information Enrichment; +https://emtunews.vn)'
        })
    
    def check_robots_txt(self, url: str, user_agent: str = '*') -> bool:
        """
        Kiểm tra robots.txt xem có được phép crawl không
        
        Args:
            url: Website URL
            user_agent: User agent name
            
        Returns:
            True nếu được phép crawl
        """
        try:
            parsed = urlparse(url)
            robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
            
            rp = RobotFileParser()
            rp.set_url(robots_url)
            rp.read()
            
            return rp.can_fetch(user_agent, url)
            
        except Exception as e:
            logger.warning(f"Robots.txt check failed for {url}: {e}")
            # Nếu không đọc được robots.txt, cho phép crawl
            return True
    
    def extract_emails(self, soup: BeautifulSoup, url: str) -> List[str]:
        """
        Trích xuất email từ trang web
        
        Args:
            soup: BeautifulSoup object
            url: Base URL
            
        Returns:
            List of email addresses
        """
        emails = set()
        
        # Tìm trong text
        text = soup.get_text()
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        found_emails = re.findall(email_pattern, text)
        emails.update(found_emails)
        
        # Tìm trong mailto links
        for link in soup.find_all('a', href=True):
            href = link['href']
            if href.startswith('mailto:'):
                email = href.replace('mailto:', '').split('?')[0]
                emails.add(email)
        
        # Lọc email spam/tracking
        valid_emails = []
        for email in emails:
            email_lower = email.lower()
            # Bỏ qua các email tracking phổ biến
            if any(spam in email_lower for spam in ['noreply', 'no-reply', 'example.com', 'test@', 'tracking@']):
                continue
            valid_emails.append(email)
        
        return valid_emails[:3]  # Chỉ lấy tối đa 3 email
    
    def extract_phones(self, soup: BeautifulSoup) -> List[str]:
        """
        Trích xuất số điện thoại từ trang web
        
        Returns:
            List of phone numbers
        """
        phones = set()
        text = soup.get_text()
        
        # Pattern cho số điện thoại Việt Nam
        phone_patterns = [
            r'\+84\s*\d{1,3}\s*\d{3}\s*\d{4}',  # +84 xx xxx xxxx
            r'0\d{9,10}',  # 09xxxxxxxx hoặc 01xxxxxxxxx
            r'\(\d{2,3}\)\s*\d{3,4}\s*\d{4}',  # (024) 1234 5678
        ]
        
        for pattern in phone_patterns:
            found = re.findall(pattern, text)
            phones.update(found)
        
        # Chuẩn hóa và lọc
        valid_phones = []
        for phone in phones:
            cleaned = re.sub(r'[^\d+]', '', phone)
            if len(cleaned) >= 10:
                valid_phones.append(phone)
        
        return valid_phones[:2]  # Chỉ lấy tối đa 2 số
    
    def extract_social_links(self, soup: BeautifulSoup) -> Dict[str, Optional[str]]:
        """
        Trích xuất link mạng xã hội
        
        Returns:
            Dict with facebook, zalo, linkedin links
        """
        social = {
            'facebook': None,
            'zalo': None,
            'linkedin': None
        }
        
        for link in soup.find_all('a', href=True):
            href = link['href'].lower()
            
            if 'facebook.com' in href and not social['facebook']:
                social['facebook'] = link['href']
            elif 'zalo.me' in href and not social['zalo']:
                social['zalo'] = link['href']
            elif 'linkedin.com' in href and not social['linkedin']:
                social['linkedin'] = link['href']
        
        return social
    
    def extract_meta_info(self, soup: BeautifulSoup) -> Dict[str, Optional[str]]:
        """
        Trích xuất thông tin meta (title, description)
        
        Returns:
            Dict with title and description
        """
        info = {
            'title': None,
            'description': None,
            'keywords': None
        }
        
        # Title
        title_tag = soup.find('title')
        if title_tag:
            info['title'] = title_tag.get_text().strip()
        
        # Meta description
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if not meta_desc:
            meta_desc = soup.find('meta', attrs={'property': 'og:description'})
        if meta_desc and meta_desc.get('content'):
            info['description'] = meta_desc['content'].strip()
        
        # Meta keywords
        meta_keywords = soup.find('meta', attrs={'name': 'keywords'})
        if meta_keywords and meta_keywords.get('content'):
            info['keywords'] = meta_keywords['content'].strip()
        
        return info
    
    def scrape_contact_page(self, base_url: str) -> Dict:
        """
        Tìm và scrape trang liên hệ
        
        Returns:
            Dict with contact information
        """
        try:
            parsed = urlparse(base_url)
            base = f"{parsed.scheme}://{parsed.netloc}"
            
            # Các URL liên hệ phổ biến
            contact_paths = [
                '/lien-he', '/contact', '/contact-us', '/lienhe',
                '/ve-chung-toi', '/about', '/about-us'
            ]
            
            for path in contact_paths:
                contact_url = urljoin(base, path)
                
                try:
                    response = self.session.get(contact_url, timeout=self.timeout)
                    if response.status_code == 200:
                        soup = BeautifulSoup(response.content, 'html.parser')
                        
                        emails = self.extract_emails(soup, contact_url)
                        phones = self.extract_phones(soup)
                        
                        if emails or phones:
                            return {
                                'emails': emails,
                                'phones': phones,
                                'contact_page': contact_url
                            }
                except Exception:
                    continue
            
            return {'emails': [], 'phones': [], 'contact_page': None}
            
        except Exception as e:
            logger.error(f"Contact page scrape error: {e}")
            return {'emails': [], 'phones': [], 'contact_page': None}
    
    def scrape_website(self, url: str) -> Dict:
        """
        Thu thập đầy đủ thông tin từ website
        
        Args:
            url: Website URL
            
        Returns:
            Dict with enriched data:
            - title: Website title
            - description: Meta description
            - keywords: Meta keywords
            - emails: List of emails found
            - phones: List of phones found
            - facebook: Facebook link
            - zalo: Zalo link
            - linkedin: LinkedIn link
            - success: Boolean
            - error: Error message if failed
        """
        result = {
            'success': False,
            'title': None,
            'description': None,
            'keywords': None,
            'emails': [],
            'phones': [],
            'facebook': None,
            'zalo': None,
            'linkedin': None,
            'error': None
        }
        
        try:
            # Chuẩn hóa URL
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url
            
            # Kiểm tra robots.txt
            if not self.check_robots_txt(url):
                result['error'] = "Blocked by robots.txt"
                logger.warning(f"Blocked by robots.txt: {url}")
                return result
            
            # Request trang chủ
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Trích xuất thông tin meta
            meta_info = self.extract_meta_info(soup)
            result.update(meta_info)
            
            # Trích xuất email và phone từ trang chủ
            result['emails'] = self.extract_emails(soup, url)
            result['phones'] = self.extract_phones(soup)
            
            # Trích xuất social links
            social = self.extract_social_links(soup)
            result.update(social)
            
            # Nếu chưa có email/phone, thử trang liên hệ
            if not result['emails'] or not result['phones']:
                contact_info = self.scrape_contact_page(url)
                if contact_info['emails'] and not result['emails']:
                    result['emails'] = contact_info['emails']
                if contact_info['phones'] and not result['phones']:
                    result['phones'] = contact_info['phones']
            
            result['success'] = True
            logger.info(f"✅ Scraped {url}: {len(result['emails'])} emails, {len(result['phones'])} phones")
            
        except requests.Timeout:
            result['error'] = "Request timeout"
            logger.warning(f"Timeout scraping {url}")
        except requests.RequestException as e:
            result['error'] = f"Request failed: {str(e)[:100]}"
            logger.error(f"Request error for {url}: {e}")
        except Exception as e:
            result['error'] = f"Scraping error: {str(e)[:100]}"
            logger.error(f"Scrape error for {url}: {e}")
        
        return result


_scraper_service = None

def get_scraper_service() -> WebsiteScraperService:
    """Get singleton scraper service"""
    global _scraper_service
    if _scraper_service is None:
        _scraper_service = WebsiteScraperService(timeout=10, max_retries=2)
    return _scraper_service
