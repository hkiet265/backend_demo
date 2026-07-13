"""
Business Listing Crawler Service
Thu thập dữ liệu doanh nghiệp thật (tên, website, logo, ngành nghề, địa chỉ...)
từ các trang tuyển dụng uy tín (ITviec, TopCV, VietnamWorks) để thay thế dữ
liệu mẫu/dỏm hiện có trong businesses_demo.

Kiến trúc theo cùng convention với news_crawler_service.py /
website_scraper_service.py trong project: requests + BeautifulSoup,
respect robots.txt, psycopg2 raw SQL, không dùng thư viện mới.

LƯU Ý: CSS selector của từng trang có thể thay đổi theo thời gian (các trang
tuyển dụng update giao diện thường xuyên). Trước khi crawl số lượng lớn, nên
chạy thử `crawl_source(..., max_companies=3)` và kiểm tra vài bản ghi đầu ra
xem có đúng không, rồi mới tăng số lượng.
"""
import json
import logging
import re
import time
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup

from app.database import get_db_connection
from app.services.ai_enrichment_service import get_enrichment_service, looks_non_vietnamese

logger = logging.getLogger(__name__)

USER_AGENT = "CompanyResearchBot/1.0 (Business Directory Demo Data; contact: admin@company.local)"
REQUEST_TIMEOUT = 10
DELAY_BETWEEN_REQUESTS_SEC = 2  # be polite — don't hammer these sites


# Each source: where to find the list of company links, and how to read a
# single company's detail page once we're on it.
SOURCE_CONFIGS = {
    # ITviec's own /companies listing page ignores ?page=N (always returns
    # the same first page), so pagination doesn't work — but itviec.com
    # publishes a full sitemap with every company detail page (12k+ URLs),
    # which is what we use instead to get real volume.
    "itviec": {
        "display_name": "ITviec",
        "sitemap_url": "https://itviec.com/twinnings_companies_vn.xml",
        "detail_url_pattern": r"^https://itviec\.com/nha-tuyen-dung/[^/?]+/?$",
        "base_url": "https://itviec.com",
        "supported": True,
    },
    # TopCV serves a Cloudflare JS challenge ("Just a moment...") to plain
    # HTTP clients — confirmed by a direct request returning a challenge
    # page instead of listing HTML. Not scrapable with requests alone;
    # would need a real/headless browser (Playwright), which isn't an
    # installed dependency in this project.
    "topcv": {
        "display_name": "TopCV",
        "listing_urls": [],
        "link_selector": None,
        "base_url": "https://www.topcv.vn",
        "supported": False,
        "unsupported_reason": (
            "TopCV chặn request bằng Cloudflare challenge (\"Just a moment...\"), "
            "cần trình duyệt thật/headless browser (Playwright) để vượt qua — "
            "chưa có trong dependencies hiện tại."
        ),
    },
    # VietnamWorks' /companies listing is rendered client-side (Next.js) —
    # confirmed the initial HTML response contains no company links at all,
    # only an embedded __NEXT_DATA__ blob and a client-side data fetch.
    # Would need to reverse-engineer the underlying API call or use a
    # headless browser; not implemented here.
    "vietnamworks": {
        "display_name": "VietnamWorks",
        "listing_urls": [],
        "link_selector": None,
        "base_url": "https://www.vietnamworks.com",
        "supported": False,
        "unsupported_reason": (
            "Trang danh sách công ty của VietnamWorks render bằng JavaScript, "
            "không có link công ty nào trong HTML tĩnh trả về — cần gọi API "
            "ẩn phía sau hoặc dùng headless browser, chưa hỗ trợ."
        ),
    },
}


class BusinessListingCrawlerService:
    """Crawls public company-listing pages on recruitment sites into businesses_demo rows."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})

    def check_robots_txt(self, url: str) -> bool:
        try:
            parsed = urlparse(url)
            robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"

            # RobotFileParser.read() fetches with Python's default User-Agent
            # header, which some sites (e.g. itviec.com) block with a 403 —
            # and robotparser silently treats any 401/403 as "disallow all".
            # Fetch it ourselves with our real UA and hand robotparser the
            # text directly instead.
            resp = self.session.get(robots_url, timeout=REQUEST_TIMEOUT)
            if resp.status_code >= 400:
                return True  # no robots.txt (or unreadable) → assume allowed

            rp = RobotFileParser()
            rp.parse(resp.text.splitlines())
            return rp.can_fetch(USER_AGENT, url)
        except Exception as e:
            logger.warning(f"Robots.txt check failed for {url}: {e}")
            return True

    def _get_soup(self, url: str) -> Optional[BeautifulSoup]:
        try:
            resp = self.session.get(url, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            return BeautifulSoup(resp.content, "html.parser")
        except requests.RequestException as e:
            logger.warning(f"Failed to fetch {url}: {e}")
            return None

    def collect_company_links(self, source_key: str, max_companies: int) -> List[Dict]:
        """Return up to max_companies {"url": ...} dicts for individual
        company detail pages, sourced from the site's sitemap (only ITviec
        is supported this way today)."""
        config = SOURCE_CONFIGS[source_key]
        sitemap_url = config.get("sitemap_url")
        if not sitemap_url:
            return []

        if not self.check_robots_txt(sitemap_url):
            logger.warning(f"Blocked by robots.txt, skipping sitemap: {sitemap_url}")
            return []

        try:
            resp = self.session.get(sitemap_url, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
        except requests.RequestException as e:
            logger.warning(f"Failed to fetch sitemap {sitemap_url}: {e}")
            return []

        pattern = re.compile(config["detail_url_pattern"])
        urls = re.findall(r"<loc>([^<]+)</loc>", resp.text)
        matching = [u for u in urls if pattern.match(u)]
        return [{"url": u} for u in matching[:max_companies]]

    def parse_company_page(self, source_key: str, link_info: Dict) -> Optional[Dict]:
        """Extract business fields from a single company detail page."""
        url = link_info["url"]
        if not self.check_robots_txt(url):
            logger.warning(f"Blocked by robots.txt, skipping: {url}")
            return None

        soup = self._get_soup(url)
        if soup is None:
            return None

        name = None
        h1 = soup.find("h1")
        if h1:
            name = h1.get_text(strip=True)
        if not name:
            return None

        # Prefer the actual square company logo (div.logo img, lazy-loaded
        # via data-src) over og:image — og:image is a wide banner/cover
        # photo meant for social-share previews, which looks stretched/odd
        # when displayed at small card-thumbnail size.
        logo_url = None
        logo_container = soup.select_one("div.logo img")
        if logo_container:
            logo_url = logo_container.get("data-src") or logo_container.get("src")
            if logo_url:
                logo_url = logo_url.strip()
        if not logo_url:
            og_image = soup.find("meta", attrs={"property": "og:image"})
            if og_image and og_image.get("content"):
                logo_url = og_image["content"].strip()

        description = None
        og_desc = soup.find("meta", attrs={"property": "og:description"}) or soup.find(
            "meta", attrs={"name": "description"}
        )
        if og_desc and og_desc.get("content"):
            description = og_desc["content"].strip()[:500]

        page_text = soup.get_text(" ", strip=True)
        industry = self._extract_between(page_text, "Lĩnh vực công ty", "Quy mô công ty")
        staff_count = self._extract_staff_count(page_text)

        company_slug = url.rstrip("/").rsplit("/", 1)[-1]
        skills, benefits, open_positions, job_url = self._enrich_from_job_posting(
            soup, config_base_url=SOURCE_CONFIGS[source_key]["base_url"], company_slug=company_slug
        )

        return {
            "ten_doanh_nghiep": name,
            "website": None,  # ITviec company pages don't list the company's own website
            "logo_url": logo_url,
            "mo_ta": description,
            "dia_chi": None,
            "nganh_nghe": industry,
            "quy_mo": f"{staff_count[0]}-{staff_count[1]} nhân viên" if staff_count else None,
            "nhan_su": staff_count[1] if staff_count else None,
            "tags": skills,
            "ghi_chu": benefits,
            "dang_tuyen": open_positions,
            "job_url": job_url,
            "nguon_du_lieu": SOURCE_CONFIGS[source_key]["display_name"],
            "source_url": url,
        }

    def _enrich_from_job_posting(self, company_soup: BeautifulSoup, config_base_url: str, company_slug: str) -> tuple:
        """Company pages link out to their own open job postings (job slugs
        end with "-<company-slug>-<id>") — count them for an actual open-
        positions number, then visit the first one to pull "Yêu cầu công
        việc" (skills/requirements) and "Tại sao bạn sẽ yêu thích làm việc
        tại đây" (benefits/perks), which aren't on the company profile page
        itself. Returns (skills, benefits, open_positions_count, job_url).
        The page also links to "similar jobs" at OTHER companies (used as
        filler when this company has nothing open) and nav category links
        like /viec-lam-it/java — both must be filtered out by requiring the
        company's own slug in the job URL.
        Best-effort: returns (None, None) if nothing matches or parses."""
        job_links = company_soup.select("a[href^='/viec-lam-it/']")
        own_job_hrefs = []
        seen_hrefs = set()
        for a in job_links:
            href = a["href"]
            if re.search(rf"-{re.escape(company_slug)}-\d+", href) and href not in seen_hrefs:
                seen_hrefs.add(href)
                own_job_hrefs.append(href)

        open_positions = len(own_job_hrefs)
        if not own_job_hrefs:
            return None, None, 0, None

        job_href = own_job_hrefs[0]
        job_url = urljoin(config_base_url, job_href)
        time.sleep(DELAY_BETWEEN_REQUESTS_SEC)
        if not self.check_robots_txt(job_url):
            return None, None, open_positions, None

        job_soup = self._get_soup(job_url)
        if job_soup is None:
            return None, None, open_positions, None

        skills = self._bullets_after_heading(job_soup, "yêu cầu công việc", max_items=6, max_len=400)
        benefits = self._bullets_after_heading(job_soup, "yêu thích làm việc", max_items=6, max_len=500)
        return skills, benefits, open_positions, job_url

    def _bullets_after_heading(self, soup: BeautifulSoup, heading_contains: str, max_items: int, max_len: int) -> Optional[str]:
        for h2 in soup.find_all("h2"):
            if heading_contains in h2.get_text(strip=True).lower():
                container = h2.find_parent()
                if not container:
                    continue
                items = [li.get_text(strip=True) for li in container.find_all("li")][:max_items]
                items = [i for i in items if i]
                if items:
                    return "; ".join(items)[:max_len]
        return None

    def _extract_between(self, page_text: str, start_label: str, end_label: str) -> Optional[str]:
        match = re.search(rf"{re.escape(start_label)}\s+(.+?)\s+{re.escape(end_label)}", page_text)
        if match:
            value = match.group(1).strip()
            return value[:100] if value else None
        return None

    def _extract_staff_count(self, page_text: str) -> Optional[tuple]:
        """"Quy mô công ty 151-300 nhân viên" -> (151, 300); "1000+ nhân viên" -> (1000, 1000)."""
        match = re.search(r"Quy mô công ty\s+(\d+)(?:-(\d+))?\+?\s+nhân viên", page_text)
        if not match:
            return None
        low = int(match.group(1))
        high = int(match.group(2)) if match.group(2) else low
        return (low, high)

    def crawl_source(self, source_key: str, max_companies: int = 15) -> Dict:
        if source_key not in SOURCE_CONFIGS:
            raise ValueError(f"Unknown source: {source_key}")

        config = SOURCE_CONFIGS[source_key]
        if not config.get("supported", True):
            return {
                "source": source_key,
                "found_links": 0,
                "companies": [],
                "error": config.get("unsupported_reason", "Nguồn này chưa được hỗ trợ."),
            }

        links = self.collect_company_links(source_key, max_companies)
        logger.info(f"[{source_key}] found {len(links)} company links")

        results = []
        for link_info in links:
            record = self.parse_company_page(source_key, link_info)
            if record:
                results.append(record)
            time.sleep(DELAY_BETWEEN_REQUESTS_SEC)

        return {"source": source_key, "found_links": len(links), "companies": results}

    def crawl_all(self, max_per_source: int = 15) -> Dict:
        summary = {}
        for source_key in SOURCE_CONFIGS:
            try:
                summary[source_key] = self.crawl_source(source_key, max_per_source)
            except Exception as e:
                logger.error(f"Crawl failed for {source_key}: {e}")
                summary[source_key] = {"source": source_key, "error": str(e), "companies": []}
        return summary

    def save_companies_to_db(self, companies: List[Dict]) -> Dict:
        """Insert new businesses, skipping ones that already exist by name."""
        inserted, skipped, errors = 0, 0, 0

        with get_db_connection() as conn:
            cur = conn.cursor()
            for company in companies:
                try:
                    cur.execute(
                        "SELECT id FROM businesses_demo WHERE ten_doanh_nghiep = %s",
                        (company["ten_doanh_nghiep"],),
                    )
                    if cur.fetchone():
                        skipped += 1
                        continue

                    cur.execute(
                        """
                        INSERT INTO businesses_demo (
                            ten_doanh_nghiep, nganh_nghe, dia_chi, website,
                            quy_mo, nhan_su, dang_tuyen, mo_ta, logo_url, tags, ghi_chu,
                            trang_thai, nguon_du_lieu, do_tin_cay, updated_at
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
                        )
                        """,
                        (
                            company["ten_doanh_nghiep"],
                            company.get("nganh_nghe"),
                            company.get("dia_chi"),
                            company.get("website"),
                            company.get("quy_mo"),
                            company.get("nhan_su"),
                            company.get("dang_tuyen"),
                            company.get("mo_ta"),
                            company.get("logo_url"),
                            company.get("tags"),
                            company.get("ghi_chu"),
                            "Hoat_dong",
                            company.get("nguon_du_lieu", "Recruitment Site Crawl"),
                            70,
                        ),
                    )
                    inserted += 1
                except Exception as e:
                    logger.error(f"Insert failed for {company.get('ten_doanh_nghiep')}: {e}")
                    errors += 1

            conn.commit()
            cur.close()

        return {"inserted": inserted, "skipped": skipped, "errors": errors}

    def backfill_logos(self, source_key: str, max_companies: int) -> Dict:
        """Re-visit the same detail pages (sitemap order is stable/deterministic)
        and update just logo_url for rows already in the DB, matched by name.
        Used to fix rows inserted before the logo extraction was corrected
        from the wide og:image banner to the actual square company logo."""
        links = self.collect_company_links(source_key, max_companies)
        display_name = SOURCE_CONFIGS[source_key]["display_name"]

        updated, not_found, errors = 0, 0, 0
        with get_db_connection() as conn:
            cur = conn.cursor()
            for link_info in links:
                try:
                    record = self.parse_company_page(source_key, link_info)
                    if not record or not record.get("logo_url"):
                        errors += 1
                        continue

                    cur.execute(
                        "UPDATE businesses_demo SET logo_url = %s "
                        "WHERE ten_doanh_nghiep = %s AND nguon_du_lieu = %s",
                        (record["logo_url"], record["ten_doanh_nghiep"], display_name),
                    )
                    if cur.rowcount > 0:
                        updated += 1
                    else:
                        not_found += 1
                except Exception as e:
                    logger.error(f"Logo backfill failed for {link_info.get('url')}: {e}")
                    errors += 1

                time.sleep(DELAY_BETWEEN_REQUESTS_SEC)

            conn.commit()
            cur.close()

        return {"updated": updated, "not_found": not_found, "errors": errors}

    def extract_job_detail(self, job_url: str) -> Optional[Dict]:
        """Fetch-and-parse wrapper around _parse_job_ld_json, for callers
        (the logo/detail backfill scripts) that don't already have the page
        soup in hand. The live crawl loop below already fetches each job
        page once for title/skills/benefits — it calls _parse_job_ld_json
        directly on that same soup instead of fetching again."""
        if not self.check_robots_txt(job_url):
            return None
        soup = self._get_soup(job_url)
        if soup is None:
            return None
        return self._parse_job_ld_json(soup)

    def _parse_job_ld_json(self, soup: BeautifulSoup) -> Optional[Dict]:
        """Every ITviec job page embeds a schema.org JobPosting as JSON-LD —
        far richer and more reliable than scraping the visible HTML, and
        doesn't require login (unlike the actual salary figure, which
        ITviec replaces with the literal placeholder string "You'll love
        it" in this same structured data on every job checked — confirmed
        not crawlable, not a parsing gap).

        Returns a dict with description (plain text, HTML tags stripped),
        location (formatted address string), employment_type, months_of_experience,
        date_posted, valid_through — any field can be None if ITviec omitted it
        for that particular posting."""
        for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
            try:
                data = json.loads(script.string)
            except (TypeError, ValueError):
                continue
            if data.get("@type") != "JobPosting":
                continue

            description = None
            if data.get("description"):
                description = BeautifulSoup(data["description"], "html.parser").get_text("\n", strip=True)

            location = None
            job_locations = data.get("jobLocation") or []
            if job_locations:
                addr = job_locations[0].get("address") or {}
                parts = [addr.get("streetAddress"), addr.get("addressLocality"), addr.get("addressRegion")]
                location = ", ".join(p for p in parts if p) or None

            months_of_experience = None
            experience = data.get("experienceRequirements")
            if isinstance(experience, dict):
                months_of_experience = experience.get("monthsOfExperience")

            return {
                "description": description,
                "location": location,
                "employment_type": data.get("employmentType"),
                "months_of_experience": months_of_experience,
                "date_posted": data.get("datePosted"),
                "valid_through": data.get("validThrough"),
            }
        return None

    def logo_from_job_page(self, job_url: str) -> Optional[str]:
        """Fallback logo source for businesses created straight from a job
        posting (no company profile page URL on file) — the job page itself
        has no `div.logo img` (that's a company-profile-page-only element),
        but its og:image meta tag is the company's own logo (ITviec resizes
        it to 300x300), same fallback parse_company_page already uses."""
        if not self.check_robots_txt(job_url):
            return None
        soup = self._get_soup(job_url)
        if soup is None:
            return None
        og_image = soup.find("meta", attrs={"property": "og:image"})
        if og_image and og_image.get("content"):
            return og_image["content"].strip()
        return None

    def enrich_skills_benefits(self, source_key: str, max_companies: int) -> Dict:
        """Re-visit the same detail pages (sitemap order is stable/deterministic)
        and update tags (skill requirements) + ghi_chu (benefits/perks) for
        rows already in the DB, matched by name — pulled from each company's
        own open job posting, which isn't on the company profile page itself."""
        links = self.collect_company_links(source_key, max_companies)
        display_name = SOURCE_CONFIGS[source_key]["display_name"]

        updated, no_job_found, not_found, errors = 0, 0, 0, 0
        with get_db_connection() as conn:
            cur = conn.cursor()
            for link_info in links:
                try:
                    record = self.parse_company_page(source_key, link_info)
                    if not record:
                        errors += 1
                        continue
                    if not record.get("tags") and not record.get("ghi_chu") and not record.get("dang_tuyen"):
                        no_job_found += 1
                        continue

                    cur.execute(
                        "UPDATE businesses_demo SET tags = %s, ghi_chu = %s, dang_tuyen = %s "
                        "WHERE ten_doanh_nghiep = %s AND nguon_du_lieu = %s",
                        (
                            record.get("tags"), record.get("ghi_chu"), record.get("dang_tuyen"),
                            record["ten_doanh_nghiep"], display_name,
                        ),
                    )
                    if cur.rowcount > 0:
                        updated += 1
                    else:
                        not_found += 1
                except Exception as e:
                    logger.error(f"Skills/benefits enrich failed for {link_info.get('url')}: {e}")
                    errors += 1

            conn.commit()
            cur.close()

        return {"updated": updated, "no_job_found": no_job_found, "not_found": not_found, "errors": errors}

    def crawl_and_save_jobs(self, source_key: str, max_companies: int, max_jobs_per_company: int = 8) -> Dict:
        """Re-visit company pages and, this time, save EVERY one of the
        company's own open job postings into job_listings (the earlier
        enrichment passes only looked at the first one, to backfill
        tags/ghi_chu/dang_tuyen on businesses_demo). This is what actually
        powers a browsable "Việc làm" listing instead of just a count."""
        config = SOURCE_CONFIGS[source_key]
        if not config.get("supported", True):
            return {"error": config.get("unsupported_reason"), "companies_visited": 0, "jobs_saved": 0}

        links = self.collect_company_links(source_key, max_companies)
        display_name = config["display_name"]

        companies_visited, jobs_found, jobs_saved, errors = 0, 0, 0, 0
        # One connection acquired per company (committed immediately after),
        # not one held for the whole run — a multi-minute open transaction
        # here would lock job_listings and block unrelated DDL/queries
        # elsewhere for the entire crawl duration.
        for link_info in links:
            company_url = link_info["url"]
            if not self.check_robots_txt(company_url):
                continue
            company_soup = self._get_soup(company_url)
            if company_soup is None:
                errors += 1
                continue

            h1 = company_soup.find("h1")
            company_name = h1.get_text(strip=True) if h1 else None
            if not company_name:
                continue
            companies_visited += 1

            company_slug = company_url.rstrip("/").rsplit("/", 1)[-1]
            job_links = company_soup.select("a[href^='/viec-lam-it/']")
            seen_hrefs = set()
            own_job_hrefs = []
            for a in job_links:
                href = a["href"]
                if re.search(rf"-{re.escape(company_slug)}-\d+", href) and href not in seen_hrefs:
                    seen_hrefs.add(href)
                    own_job_hrefs.append(href)

            jobs_for_company = []
            for href in own_job_hrefs[:max_jobs_per_company]:
                job_url = urljoin(config["base_url"], href)
                time.sleep(DELAY_BETWEEN_REQUESTS_SEC)
                if not self.check_robots_txt(job_url):
                    continue
                job_soup = self._get_soup(job_url)
                if job_soup is None:
                    errors += 1
                    continue

                job_h1 = job_soup.find("h1")
                job_title = job_h1.get_text(strip=True) if job_h1 else None
                if not job_title:
                    continue
                jobs_found += 1

                skills = self._bullets_after_heading(job_soup, "yêu cầu công việc", max_items=6, max_len=400)
                benefits = self._bullets_after_heading(job_soup, "yêu thích làm việc", max_items=6, max_len=500)
                detail = self._parse_job_ld_json(job_soup) or {}
                jobs_for_company.append((job_title, job_url, skills, benefits, detail))

            if jobs_for_company:
                with get_db_connection() as conn:
                    cur = conn.cursor()
                    cur.execute(
                        "SELECT id FROM businesses_demo WHERE ten_doanh_nghiep = %s AND nguon_du_lieu = %s",
                        (company_name, display_name),
                    )
                    row = cur.fetchone()
                    business_id = row[0] if row else None

                    # Company never crawled into businesses_demo (business_id
                    # NULL) means the job would otherwise show no industry
                    # tag at all — classify once per company via AI instead
                    # of per job, since it's the same answer for every job
                    # of theirs in this batch.
                    ai_industry = None
                    if business_id is None and jobs_for_company:
                        first_title = jobs_for_company[0][0]
                        try:
                            ai_industry = get_enrichment_service().classify_job_industry(company_name, first_title)
                        except Exception as e:
                            logger.warning(f"classify_job_industry failed for {company_name}: {e}")

                    for job_title, job_url, skills, benefits, detail in jobs_for_company:
                        # Foreign-owned companies post entirely in English on
                        # ITviec — translate so "Yêu cầu công việc"/"Phúc lợi"
                        # aren't a mix of languages across the job list.
                        # looks_non_vietnamese pre-filters out the (majority)
                        # already-Vietnamese postings to save LLM quota.
                        enrichment_service = get_enrichment_service()
                        if looks_non_vietnamese(skills):
                            skills = enrichment_service.translate_job_text_to_vietnamese(skills)
                        if looks_non_vietnamese(benefits):
                            benefits = enrichment_service.translate_job_text_to_vietnamese(benefits)

                        description = detail.get("description")
                        if looks_non_vietnamese(description):
                            description = enrichment_service.translate_job_description_to_vietnamese(description)

                        try:
                            cur.execute(
                                """
                                INSERT INTO job_listings (
                                    business_id, ten_doanh_nghiep, tieu_de, url, ky_nang, phuc_loi, nguon, ai_industry,
                                    mo_ta_cong_viec, dia_diem, hinh_thuc_lam_viec, kinh_nghiem_thang, ngay_dang, han_nop
                                )
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                ON CONFLICT (url) DO NOTHING
                                """,
                                (
                                    business_id, company_name, job_title, job_url, skills, benefits, display_name, ai_industry,
                                    description, detail.get("location"), detail.get("employment_type"),
                                    detail.get("months_of_experience"), detail.get("date_posted"), detail.get("valid_through"),
                                ),
                            )
                            if cur.rowcount > 0:
                                jobs_saved += 1
                        except Exception as e:
                            logger.error(f"Job insert failed for {job_url}: {e}")
                            errors += 1

                    conn.commit()
                    cur.close()

            time.sleep(DELAY_BETWEEN_REQUESTS_SEC)

        return {
            "companies_visited": companies_visited,
            "jobs_found": jobs_found,
            "jobs_saved": jobs_saved,
            "errors": errors,
        }


_crawler_service = None


def get_business_listing_crawler_service() -> BusinessListingCrawlerService:
    global _crawler_service
    if _crawler_service is None:
        _crawler_service = BusinessListingCrawlerService()
    return _crawler_service
