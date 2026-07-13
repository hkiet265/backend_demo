"""
Direct SQL retriever for exact lookups (phone number, exact/near-exact
company name). Extracted from HybridChatService._handle_simple_query so it
can be reused and tested independently of the routing/formatting logic.
"""
import logging
import re
from typing import Dict, List, Optional

import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import settings

logger = logging.getLogger(__name__)

FAMOUS_COMPANIES = ['fpt', 'viettel', 'vng', 'vingroup', 'grab', 'shopee', 'lazada', 'tiki']

_BUSINESS_COLUMNS = """
    id, ten_doanh_nghiep, so_dien_thoai, tinh_thanh,
    vung_mien, nganh_nghe, website, email, dia_chi, mo_ta, quy_mo,
    do_tin_cay, nhan_su, dang_tuyen, tags, ghi_chu
"""


def _row_to_business(row: Dict) -> Dict:
    return {
        'id': row.get('id'),
        'name': row.get('ten_doanh_nghiep', 'N/A'),
        'phone': row.get('so_dien_thoai', 'Chưa có'),
        'location': row.get('tinh_thanh', ''),
        'region': row.get('vung_mien', ''),
        'industry': row.get('nganh_nghe', ''),
        'website': row.get('website', ''),
        'email': row.get('email', ''),
        'address': row.get('dia_chi', ''),
        'description': row.get('mo_ta', ''),
        'scale': row.get('quy_mo', ''),
        # Added so compare/evaluate questions have real substance to work
        # with instead of just name/industry/location/phone/website.
        'trust_score': row.get('do_tin_cay'),
        'staff_count': row.get('nhan_su'),
        'open_positions': row.get('dang_tuyen'),
        'skills_required': row.get('tags'),
        'benefits': row.get('ghi_chu'),
    }


def _phone_variants(phone_raw: str) -> List[str]:
    phone_clean = re.sub(r'[\s\.\-]', '', phone_raw)
    variants = [phone_clean]
    if phone_clean.startswith('0'):
        variants.append('84' + phone_clean[1:])
    elif phone_clean.startswith('+84'):
        normalized = phone_clean.replace('+', '')
        variants.append(normalized)
        variants.append('0' + normalized[2:])
    elif phone_clean.startswith('84') and len(phone_clean) >= 10:
        variants.append('0' + phone_clean[2:])
    return variants


class SQLBusinessRetriever:
    """Exact-match business lookups via direct SQL (no embeddings)."""

    def lookup_by_phone(self, phone_raw: str, limit: int = 10) -> List[Dict]:
        variants = _phone_variants(phone_raw)
        conn = psycopg2.connect(**settings.database_url)
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            where = " OR ".join([
                "REPLACE(REPLACE(REPLACE(REPLACE(so_dien_thoai, ' ', ''), '.', ''), '-', ''), '+', '') LIKE %s"
                for _ in variants
            ])
            sql = f"SELECT {_BUSINESS_COLUMNS} FROM businesses_demo WHERE {where} ORDER BY updated_at DESC LIMIT %s"
            params = [f'%{v}%' for v in variants] + [limit]
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [_row_to_business(r) for r in rows]
        finally:
            conn.close()

    def list_by_filters(self, region: Optional[str] = None, industry: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """
        Plain attribute filter, no embeddings — for queries like "liệt kê
        công ty ở miền Nam" that have no industry/quality signal for
        semantic ranking to work with (every business would score similarly
        low, so a similarity threshold filters everything out). Mirrors the
        legacy "fallback to simple SQL when semantic search returns nothing"
        behavior from HybridChatService._handle_semantic_query.
        """
        conditions, params = [], []
        if region:
            conditions.append("vung_mien = %s")
            params.append(region)
        if industry:
            conditions.append("nganh_nghe ILIKE %s")
            params.append(f"%{industry}%")

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        conn = psycopg2.connect(**settings.database_url)
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            sql = f"""
                SELECT {_BUSINESS_COLUMNS} FROM businesses_demo
                {where}
                ORDER BY do_tin_cay DESC NULLS LAST, updated_at DESC
                LIMIT %s
            """
            params.append(limit)
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [_row_to_business(r) for r in rows]
        finally:
            conn.close()

    def lookup_by_name(self, name: str, exact_hint: bool = False, limit: int = 10) -> List[Dict]:
        """
        name: extracted company name (or full famous-company keyword)
        exact_hint: True when the caller is confident this is a specific,
            long company name (try exact match first, then partial)
        """
        conn = psycopg2.connect(**settings.database_url)
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            if exact_hint and len(name.split()) >= 4:
                sql = f"""
                    SELECT {_BUSINESS_COLUMNS} FROM businesses_demo
                    WHERE ten_doanh_nghiep ILIKE %s OR ten_doanh_nghiep ILIKE %s
                    ORDER BY updated_at DESC LIMIT %s
                """
                params = [name, f'%{name}%', limit]
            else:
                sql = f"""
                    SELECT {_BUSINESS_COLUMNS} FROM businesses_demo
                    WHERE ten_doanh_nghiep ILIKE %s
                    ORDER BY updated_at DESC LIMIT %s
                """
                params = [f'%{name}%', limit]
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [_row_to_business(r) for r in rows]
        finally:
            conn.close()


_sql_business_retriever: Optional[SQLBusinessRetriever] = None


def get_sql_business_retriever() -> SQLBusinessRetriever:
    global _sql_business_retriever
    if _sql_business_retriever is None:
        _sql_business_retriever = SQLBusinessRetriever()
    return _sql_business_retriever
