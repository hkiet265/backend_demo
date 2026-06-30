"""
Business API Routes
Endpoints for business management with full CRUD + Import/Export + AI Enrichment
"""
from fastapi import APIRouter, HTTPException, Query, File, UploadFile, Depends
from fastapi.responses import StreamingResponse
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime, date
import psycopg2
from app.config import settings
from app.services.ai_enrichment_service import get_enrichment_service
from app.dependencies import get_current_user
import logging
import csv
import io
import hashlib

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/businesses", tags=["business"])
enrichment_service = get_enrichment_service()



class BusinessCreate(BaseModel):
    ten_doanh_nghiep: str = Field(..., description="Tên doanh nghiệp")
    nganh_nghe: Optional[str] = None
    vung_mien: Optional[str] = None
    tinh_thanh: Optional[str] = None
    quan_huyen: Optional[str] = None
    dia_chi: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    so_dien_thoai: Optional[str] = None
    facebook: Optional[str] = None
    zalo: Optional[str] = None
    linkedin: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    quy_mo: Optional[str] = None
    ma_so_thue: Optional[str] = None
    ngay_thanh_lap: Optional[date] = None
    trang_thai: Optional[str] = "Hoat_dong"
    nguon_du_lieu: Optional[str] = "Manual Input"
    do_tin_cay: Optional[int] = Field(50, ge=0, le=100)
    tags: Optional[str] = None
    ghi_chu: Optional[str] = None
    mo_ta: Optional[str] = None


class BusinessUpdate(BaseModel):
    ten_doanh_nghiep: Optional[str] = None
    nganh_nghe: Optional[str] = None
    vung_mien: Optional[str] = None
    tinh_thanh: Optional[str] = None
    quan_huyen: Optional[str] = None
    dia_chi: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    so_dien_thoai: Optional[str] = None
    facebook: Optional[str] = None
    zalo: Optional[str] = None
    linkedin: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    quy_mo: Optional[str] = None
    ma_so_thue: Optional[str] = None
    ngay_thanh_lap: Optional[date] = None
    trang_thai: Optional[str] = None
    nguon_du_lieu: Optional[str] = None
    do_tin_cay: Optional[int] = Field(None, ge=0, le=100)
    tags: Optional[str] = None
    ghi_chu: Optional[str] = None
    mo_ta: Optional[str] = None


class BulkImportRequest(BaseModel):
    records: List[dict]


@router.get("")
async def get_all_businesses(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    region: Optional[str] = None,
    industry: Optional[str] = None
):
    """
    Get all businesses with pagination and filters
    
    - **page**: Page number (starts from 1)
    - **page_size**: Number of items per page (max 100)
    - **region**: Filter by region (optional)
    - **industry**: Filter by industry (optional)
    """
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        
        
        conditions = []
        params = []
        
        if region:
            conditions.append("vung_mien ILIKE %s")
            params.append(f"%{region}%")
        
        if industry:
            conditions.append("nganh_nghe ILIKE %s")
            params.append(f"%{industry}%")
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        
        cur.execute(f"SELECT COUNT(*) FROM businesses_demo {where_clause};", params)
        total = cur.fetchone()[0]
        
        
        offset = (page - 1) * page_size
        params.extend([page_size, offset])
        
        query = f"""
            SELECT id, ten_doanh_nghiep, so_dien_thoai, vung_mien, tinh_thanh,
                   email, website, mo_ta, quy_mo, nganh_nghe, trang_thai,
                   do_tin_cay, facebook, zalo, linkedin, dia_chi, tags, created_by_user_id
            FROM businesses_demo
            {where_clause}
            ORDER BY id DESC
            LIMIT %s OFFSET %s;
        """
        
        cur.execute(query, params)
        rows = cur.fetchall()
        
        cur.close()
        conn.close()
        
        businesses = []
        for r in rows:
            businesses.append({
                "id": r[0],
                "name": r[1],
                "phone": r[2],
                "region": r[3],
                "location": r[4],
                "email": r[5],
                "website": r[6],
                "description": r[7],
                "scale": r[8],
                "industry": r[9],
                "status": r[10] or "Hoat_dong",
                "trust_score": r[11],
                "facebook": r[12],
                "zalo": r[13],
                "linkedin": r[14],
                "address": r[15],
                "tags": r[16],
                "created_by_user_id": r[17]
            })
        
        return {
            "status": "success",
            "data": businesses,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
        
    except Exception as e:
        logger.error(f"Get businesses error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-businesses")
async def get_my_businesses(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100)
):
    """
    Get businesses created by the current user
    """
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        
        # Count total businesses created by user
        cur.execute(
            "SELECT COUNT(*) FROM businesses_demo WHERE created_by_user_id = %s;",
            (current_user["id"],)
        )
        total = cur.fetchone()[0]
        
        # Get paginated results
        offset = (page - 1) * page_size
        
        query = """
            SELECT id, ten_doanh_nghiep, so_dien_thoai, vung_mien, tinh_thanh,
                   email, website, mo_ta, quy_mo, nganh_nghe, trang_thai,
                   do_tin_cay, facebook, zalo, linkedin, dia_chi, tags, created_by_user_id,
                   updated_at
            FROM businesses_demo
            WHERE created_by_user_id = %s
            ORDER BY updated_at DESC
            LIMIT %s OFFSET %s;
        """
        
        cur.execute(query, (current_user["id"], page_size, offset))
        rows = cur.fetchall()
        
        cur.close()
        conn.close()
        
        businesses = []
        for r in rows:
            businesses.append({
                "id": r[0],
                "name": r[1],
                "phone": r[2],
                "region": r[3],
                "location": r[4],
                "email": r[5],
                "website": r[6],
                "description": r[7],
                "scale": r[8],
                "industry": r[9],
                "status": r[10] or "Hoat_dong",
                "trust_score": r[11],
                "facebook": r[12],
                "zalo": r[13],
                "linkedin": r[14],
                "address": r[15],
                "tags": r[16],
                "created_by_user_id": r[17],
                "created_at": r[18].isoformat() if r[18] else None,
                "updated_at": r[18].isoformat() if r[18] else None
            })
        
        return {
            "status": "success",
            "data": businesses,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
        
    except Exception as e:
        logger.error(f"Get my businesses error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_businesses(
    q: str = Query("", description="Search query"),
    region: str = Query("", description="Filter by region"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100)
):
    """
    Search businesses by name or description
    """
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        
        conditions = []
        params = []
        
        if q:
            conditions.append("(ten_doanh_nghiep ILIKE %s OR mo_ta ILIKE %s)")
            params.extend([f"%{q}%", f"%{q}%"])
        
        if region:
            conditions.append("vung_mien ILIKE %s")
            params.append(f"%{region}%")
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        
        cur.execute(f"SELECT COUNT(*) FROM businesses_demo {where_clause};", params)
        total = cur.fetchone()[0]
        
        
        offset = (page - 1) * page_size
        params.extend([page_size, offset])
        
        query = f"""
            SELECT id, ten_doanh_nghiep, so_dien_thoai, vung_mien, tinh_thanh,
                   email, website, mo_ta, quy_mo
            FROM businesses_demo
            {where_clause}
            ORDER BY id DESC
            LIMIT %s OFFSET %s;
        """
        
        cur.execute(query, params)
        rows = cur.fetchall()
        
        cur.close()
        conn.close()
        
        businesses = [
            {
                "id": r[0],
                "name": r[1],
                "phone": r[2],
                "region": r[3],
                "location": r[4],
                "email": r[5],
                "website": r[6],
                "description": r[7],
                "scale": r[8],
                "status": "Xem chi tiết"
            }
            for r in rows
        ]
        
        return {
            "status": "success",
            "data": businesses,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) 
        }
        
    except Exception as e:
        logger.error(f"Search businesses error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{business_id}")
async def get_business(business_id: int):
    """Get single business by ID"""
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        
        cur.execute("""
            SELECT id, ten_doanh_nghiep, so_dien_thoai, vung_mien, tinh_thanh,
                   email, website, mo_ta, quy_mo, nganh_nghe, trang_thai,
                   do_tin_cay, facebook, zalo, linkedin, dia_chi, tags
            FROM businesses_demo
            WHERE id = %s;
        """, (business_id,))
        
        row = cur.fetchone()
        cur.close()
        conn.close()
        
        if not row:
            raise HTTPException(status_code=404, detail="Business not found")
        
        return {
            "status": "success",
            "data": {
                "id": row[0],
                "name": row[1],
                "phone": row[2],
                "region": row[3],
                "location": row[4],
                "email": row[5],
                "website": row[6],
                "description": row[7],
                "scale": row[8],
                "industry": row[9],
                "status": row[10] or "Hoat_dong",
                "trust_score": row[11],
                "facebook": row[12],
                "zalo": row[13],
                "linkedin": row[14],
                "address": row[15],
                "tags": row[16]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get business error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check for business API"""
    return {"status": "healthy", "service": "business"}


@router.post("")
async def create_business(business: BusinessCreate, current_user: dict = Depends(get_current_user)):
    """Create new business"""
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO businesses_demo (
                ten_doanh_nghiep, nganh_nghe, vung_mien, tinh_thanh, quan_huyen,
                dia_chi, website, email, so_dien_thoai, facebook, zalo, linkedin,
                lat, lng, quy_mo, ma_so_thue, ngay_thanh_lap, trang_thai,
                nguon_du_lieu, do_tin_cay, tags, ghi_chu, mo_ta, created_by_user_id, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
            ) RETURNING id;
        """, (
            business.ten_doanh_nghiep, business.nganh_nghe, business.vung_mien,
            business.tinh_thanh, business.quan_huyen, business.dia_chi,
            business.website, business.email, business.so_dien_thoai,
            business.facebook, business.zalo, business.linkedin,
            business.lat, business.lng, business.quy_mo, business.ma_so_thue,
            business.ngay_thanh_lap, business.trang_thai, business.nguon_du_lieu,
            business.do_tin_cay, business.tags, business.ghi_chu, business.mo_ta,
            current_user["id"]  # Save user who created this business
        ))
        
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            "status": "success",
            "message": "Tạo doanh nghiệp thành công",
            "id": new_id
        }
        
    except Exception as e:
        logger.error(f"Create business error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{business_id}")
async def update_business(business_id: int, business: BusinessUpdate):
    """Update existing business"""
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()

        update_fields = []
        params = []
        
        for field, value in business.dict(exclude_unset=True).items():
            update_fields.append(f"{field} = %s")
            params.append(value)
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        params.append(business_id)
        query = f"""
            UPDATE businesses_demo 
            SET {', '.join(update_fields)}, updated_at = NOW()
            WHERE id = %s
            RETURNING id;
        """
        
        cur.execute(query, params)
        result = cur.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Business not found")
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            "status": "success",
            "message": "Cập nhật thành công",
            "id": result[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update business error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{business_id}")
async def delete_business(business_id: int, current_user: dict = Depends(get_current_user)):
    """Delete business - users can delete their own businesses, admins can delete any"""
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        
        # First check if business exists and get owner
        cur.execute("SELECT created_by_user_id FROM businesses_demo WHERE id = %s;", (business_id,))
        result = cur.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Doanh nghiệp không tồn tại")
        
        created_by_user_id = result[0]
        
        # Check permission: user can delete their own business OR admin can delete any
        is_admin = current_user.get("role") == "admin"
        is_owner = created_by_user_id == current_user["id"]
        
        if not (is_admin or is_owner):
            raise HTTPException(
                status_code=403, 
                detail="Bạn không có quyền xóa doanh nghiệp này. Chỉ người tạo hoặc admin mới có quyền xóa."
            )
        
        # Delete the business
        cur.execute("DELETE FROM businesses_demo WHERE id = %s RETURNING id;", (business_id,))
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            "status": "success",
            "message": "Xóa doanh nghiệp thành công"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete business error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/csv")
async def export_csv(
    region: Optional[str] = None,
    industry: Optional[str] = None
):
    """Export businesses to CSV"""
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()

        conditions = []
        params = []
        
        if region:
            conditions.append("vung_mien ILIKE %s")
            params.append(f"%{region}%")
        
        if industry:
            conditions.append("nganh_nghe ILIKE %s")
            params.append(f"%{industry}%")
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

        cur.execute(f"""
            SELECT id, ten_doanh_nghiep, nganh_nghe, vung_mien, tinh_thanh, quan_huyen,
                   dia_chi, website, email, so_dien_thoai, facebook, zalo, linkedin,
                   lat, lng, quy_mo, ma_so_thue, ngay_thanh_lap, trang_thai,
                   nguon_du_lieu, do_tin_cay, tags, ghi_chu, mo_ta
            FROM businesses_demo
            {where_clause}
            ORDER BY id;
        """, params)
        
        rows = cur.fetchall()
        cur.close()
        conn.close()

        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            'id', 'ten_doanh_nghiep', 'nganh_nghe', 'vung_mien', 'tinh_thanh', 'quan_huyen',
            'dia_chi', 'website', 'email', 'so_dien_thoai', 'facebook', 'zalo', 'linkedin',
            'lat', 'lng', 'quy_mo', 'ma_so_thue', 'ngay_thanh_lap', 'trang_thai',
            'nguon_du_lieu', 'do_tin_cay', 'tags', 'ghi_chu', 'mo_ta'
        ])

        writer.writerows(rows)
        
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=businesses_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
        
    except Exception as e:
        logger.error(f"Export CSV error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-import")
async def bulk_import(data: BulkImportRequest):
    """Bulk import businesses from CSV"""
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        
        inserted = 0
        skipped = 0
        errors = []
        
        for record in data.records:
            try:

                name = record.get('ten_doanh_nghiep', '').strip()
                if not name:
                    skipped += 1
                    continue
                
                phone = record.get('so_dien_thoai', '').strip()
                email = record.get('email', '').strip()

                if phone or email:
                    check_conditions = ["ten_doanh_nghiep ILIKE %s"]
                    check_params = [f"%{name}%"]
                    
                    if phone:
                        check_conditions.append("so_dien_thoai = %s")
                        check_params.append(phone)
                    if email:
                        check_conditions.append("email = %s")
                        check_params.append(email)
                    
                    cur.execute(f"""
                        SELECT id FROM businesses_demo 
                        WHERE {' OR '.join(check_conditions)}
                        LIMIT 1;
                    """, check_params)
                    
                    if cur.fetchone():
                        skipped += 1
                        continue

                cur.execute("""
                    INSERT INTO businesses_demo (
                        ten_doanh_nghiep, nganh_nghe, vung_mien, tinh_thanh, quan_huyen,
                        dia_chi, website, email, so_dien_thoai, facebook, zalo, linkedin,
                        lat, lng, quy_mo, ma_so_thue, ngay_thanh_lap, trang_thai,
                        nguon_du_lieu, do_tin_cay, tags, ghi_chu, mo_ta, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, NOW()
                    );
                """, (
                    name,
                    record.get('nganh_nghe'),
                    record.get('vung_mien'),
                    record.get('tinh_thanh'),
                    record.get('quan_huyen'),
                    record.get('dia_chi'),
                    record.get('website'),
                    email or None,
                    phone or None,
                    record.get('facebook'),
                    record.get('zalo'),
                    record.get('linkedin'),
                    record.get('lat'),
                    record.get('lng'),
                    record.get('quy_mo'),
                    record.get('ma_so_thue'),
                    record.get('ngay_thanh_lap'),
                    record.get('trang_thai', 'Hoat_dong'),
                    record.get('nguon_du_lieu', 'CSV Import'),
                    record.get('do_tin_cay', 50),
                    record.get('tags'),
                    record.get('ghi_chu'),
                    record.get('mo_ta')
                ))
                inserted += 1
                
            except Exception as e:
                errors.append(f"Row error: {str(e)[:50]}")
                skipped += 1
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            "status": "success",
            "inserted": inserted,
            "skipped": skipped,
            "errors": errors[:10]
        }
        
    except Exception as e:
        logger.error(f"Bulk import error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/normalize")
async def normalize_business_data(data: dict):
    """
    AI: Chuẩn hóa dữ liệu doanh nghiệp
    - Chuẩn số điện thoại, email, website
    - Suy luận vùng miền từ địa điểm
    - Tự động phân loại ngành nghề
    - Tính điểm tin cậy
    """
    try:
        normalized = enrichment_service.normalize_business_data(data)
        return {
            "status": "success",
            "original": data,
            "normalized": normalized
        }
    except Exception as e:
        logger.error(f"Normalize error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/check-duplicate")
async def check_duplicate(
    name: str = Query(..., description="Tên doanh nghiệp"),
    phone: Optional[str] = None,
    email: Optional[str] = None
):
    """
    AI: Kiểm tra trùng lặp doanh nghiệp
    """
    try:
        result = await enrichment_service.detect_duplicates(name, phone, email)
        return {
            "status": "success",
            "data": result
        }
    except Exception as e:
        logger.error(f"Check duplicate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{business_id}/enrich")
async def enrich_business(business_id: int):
    """
    AI: Làm giàu dữ liệu từ website và AI
    - Chuẩn hóa thông tin
    - Lấy info từ website
    - Tóm tắt mô tả
    - Cập nhật điểm tin cậy
    """
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()

        cur.execute("""
            SELECT id, ten_doanh_nghiep, website, mo_ta, so_dien_thoai, 
                   email, tinh_thanh, vung_mien, nganh_nghe
            FROM businesses_demo WHERE id = %s;
        """, (business_id,))
        
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Business not found")
        
        business_data = {
            "id": row[0],
            "ten_doanh_nghiep": row[1],
            "website": row[2],
            "mo_ta": row[3],
            "so_dien_thoai": row[4],
            "email": row[5],
            "tinh_thanh": row[6],
            "vung_mien": row[7],
            "nganh_nghe": row[8]
        }

        normalized = enrichment_service.normalize_business_data(business_data)
    
        if normalized.get('mo_ta') and len(normalized['mo_ta']) > 200:
            normalized['mo_ta_summary'] = await enrichment_service.summarize_description(normalized['mo_ta'])

        cur.execute("""
            UPDATE businesses_demo 
            SET so_dien_thoai = %s, email = %s, website = %s, 
                vung_mien = %s, nganh_nghe = %s, do_tin_cay = %s,
                updated_at = NOW()
            WHERE id = %s;
        """, (
            normalized.get('so_dien_thoai'),
            normalized.get('email'),
            normalized.get('website'),
            normalized.get('vung_mien'),
            normalized.get('nganh_nghe'),
            normalized.get('do_tin_cay'),
            business_id
        ))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            "status": "success",
            "message": "Làm giàu dữ liệu thành công",
            "data": normalized
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Enrich business error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/enrich-all")
async def enrich_all_businesses(
    limit: int = Query(100, description="Số lượng doanh nghiệp cần xử lý")
):
    """
    AI: Làm giàu dữ liệu hàng loạt
    Chuẩn hóa và làm sạch dữ liệu cho nhiều doanh nghiệp
    """
    try:
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()

        cur.execute("""
            SELECT id, ten_doanh_nghiep, website, mo_ta, so_dien_thoai, 
                   email, tinh_thanh, vung_mien, nganh_nghe
            FROM businesses_demo 
            WHERE do_tin_cay IS NULL OR do_tin_cay < 50
            LIMIT %s;
        """, (limit,))
        
        rows = cur.fetchall()
        enriched_count = 0
        
        for row in rows:
            try:
                business_data = {
                    "ten_doanh_nghiep": row[1],
                    "website": row[2],
                    "mo_ta": row[3],
                    "so_dien_thoai": row[4],
                    "email": row[5],
                    "tinh_thanh": row[6],
                    "vung_mien": row[7],
                    "nganh_nghe": row[8]
                }
                
                normalized = enrichment_service.normalize_business_data(business_data)
                
                cur.execute("""
                    UPDATE businesses_demo 
                    SET so_dien_thoai = %s, email = %s, website = %s, 
                        vung_mien = %s, nganh_nghe = %s, do_tin_cay = %s,
                        updated_at = NOW()
                    WHERE id = %s;
                """, (
                    normalized.get('so_dien_thoai'),
                    normalized.get('email'),
                    normalized.get('website'),
                    normalized.get('vung_mien'),
                    normalized.get('nganh_nghe'),
                    normalized.get('do_tin_cay'),
                    row[0]
                ))
                
                enriched_count += 1
                
            except Exception as e:
                logger.error(f"Error enriching business {row[0]}: {e}")
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            "status": "success",
            "message": f"Đã làm giàu {enriched_count}/{len(rows)} doanh nghiệp",
            "enriched_count": enriched_count,
            "total_processed": len(rows)
        }
        
    except Exception as e:
        logger.error(f"Enrich all error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
