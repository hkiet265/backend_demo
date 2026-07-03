"""
CSV Import Endpoint - SIMPLIFIED (No Encryption)
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Request
from app.services.geocoding_service import get_geocoding_service
from app.dependencies import get_current_user
from app.middleware.rate_limiter import limiter
from app.config import settings
import logging
import csv
import io
import psycopg2

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/secure", tags=["secure-import"])

geocoding_service = get_geocoding_service()


@router.post("/import-csv")
@limiter.limit("10/hour")
async def import_csv_simple(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Simple CSV import - NO encryption
    
    Required CSV columns:
    - ten_doanh_nghiep (required)
    - so_dien_thoai, email, dia_chi (optional)
    - nganh_nghe, tinh_thanh, vung_mien, website, etc.
    """
    
    try:
        logger.info(f"📤 User {current_user['email']} uploading CSV: {file.filename}")
        
        # Check file extension
        if not file.filename.lower().endswith(('.csv', '.txt')):
            raise HTTPException(status_code=400, detail="Chỉ chấp nhận file .csv hoặc .txt")
        
        # Read & parse CSV
        content = await file.read()
        
        if len(content) > 10 * 1024 * 1024:  # 10MB max
            raise HTTPException(status_code=400, detail="File quá lớn (tối đa 10MB)")
        
        csv_text = content.decode('utf-8', errors='ignore')
        reader = csv.DictReader(io.StringIO(csv_text))
        
        # Process records
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        
        inserted = 0
        skipped = 0
        errors = []
        
        for row_no, row in enumerate(reader, start=2):
            try:
                # Get required field
                name = row.get('ten_doanh_nghiep', '').strip()
                if not name:
                    skipped += 1
                    continue
                
                # Get optional fields - PLAIN TEXT
                phone = row.get('so_dien_thoai', '').strip() or None
                email = row.get('email', '').strip() or None
                address = row.get('dia_chi', '').strip() or None
                
                # Check duplicates by name
                cur.execute(
                    "SELECT id FROM businesses_demo WHERE ten_doanh_nghiep = %s LIMIT 1",
                    (name,)
                )
                if cur.fetchone():
                    skipped += 1
                    continue
                
                # Geocode for location
                geocoded = geocoding_service.geocode(row)
                tinh_thanh = row.get('tinh_thanh') or geocoded.get('tinh_thanh')
                vung_mien = row.get('vung_mien') or geocoded.get('vung_mien')
                
                # Insert - PLAIN TEXT
                cur.execute("""
                    INSERT INTO businesses_demo (
                        ten_doanh_nghiep, nganh_nghe, vung_mien, tinh_thanh, quan_huyen,
                        dia_chi, website, email, so_dien_thoai,
                        facebook, zalo, linkedin, quy_mo, ma_so_thue,
                        trang_thai, nguon_du_lieu, do_tin_cay,
                        data_source, consent_obtained,
                        created_by_user_id, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s,
                        %s, NOW()
                    )
                """, (
                    name,
                    row.get('nganh_nghe'),
                    vung_mien,
                    tinh_thanh,
                    row.get('quan_huyen'),
                    address,
                    row.get('website'),
                    email,
                    phone,
                    row.get('facebook'),
                    row.get('zalo'),
                    row.get('linkedin'),
                    row.get('quy_mo'),
                    row.get('ma_so_thue'),
                    row.get('trang_thai', 'Hoat_dong'),
                    'CSV Import',
                    int(row.get('do_tin_cay', 50)),
                    'CSV Import - Simple',
                    False,
                    current_user['id']
                ))
                
                inserted += 1
                
            except Exception as e:
                errors.append({
                    'row': row_no,
                    'error': str(e),
                    'data': {k: v[:50] if isinstance(v, str) else v for k, v in row.items()}
                })
                logger.error(f"Row {row_no} failed: {e}")
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"✅ CSV import: inserted={inserted}, skipped={skipped}, errors={len(errors)}")
        
        return {
            "success": True,
            "inserted": inserted,
            "skipped": skipped,
            "errors": errors[:10],
            "total_errors": len(errors),
            "message": f"✅ Import thành công: {inserted} doanh nghiệp mới, {skipped} bị bỏ qua"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ CSV import failed: {e}")
        raise HTTPException(status_code=500, detail=f"Import thất bại: {str(e)}")
