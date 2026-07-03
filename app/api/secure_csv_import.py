"""
Secure CSV Import Endpoint
Validates, sanitizes, and encrypts CSV data before storing
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Request
from app.services.csv_security_service import get_csv_security_service
from app.services.encryption_service import get_encryption_service
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

csv_security = get_csv_security_service()
encryption_service = get_encryption_service()
geocoding_service = get_geocoding_service()


@router.post("/import-csv")
@limiter.limit("5/hour")  # Max 5 uploads per hour per user
async def import_csv_secure(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Secure CSV import with validation, sanitization, and encryption
    
    - **Rate limited**: 5 uploads per hour
    - **Max file size**: 10MB
    - **Max rows**: 10,000
    - **Validates**: File type, size, malicious content
    - **Sanitizes**: Removes formulas, XSS, scripts
    - **Encrypts**: Phone, email, address
    
    Required CSV columns:
    - ten_doanh_nghiep (required)
    - so_dien_thoai (optional, will be encrypted)
    - email (optional, will be encrypted)
    - dia_chi (optional, will be encrypted)
    - nganh_nghe, tinh_thanh, vung_mien, website, etc.
    """
    
    try:
        # 1. Validate file
        logger.info(f"User {current_user['email']} uploading CSV: {file.filename}")
        
        try:
            validation_result = csv_security.validate_csv_file(file.file, file.filename)
        except ValueError as e:
            logger.warning(f"CSV validation failed: {e}")
            raise HTTPException(status_code=400, detail=str(e))
        
        # 2. Parse CSV
        content = await file.read()
        csv_text = content.decode('utf-8', errors='ignore')
        
        reader = csv.DictReader(io.StringIO(csv_text))
        
        # 3. Process each record
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor()
        
        inserted = 0
        skipped = 0
        errors = []
        
        for row_no, row in enumerate(reader, start=2):  # Start from 2 (header is row 1)
            try:
                # Sanitize all fields
                sanitized_row = csv_security.sanitize_csv_row(row)
                
                # Validate required fields
                name = sanitized_row.get('ten_doanh_nghiep', '').strip()
                if not name:
                    skipped += 1
                    logger.debug(f"Row {row_no}: Skipped - missing name")
                    continue
                
                # Get sensitive fields
                phone = sanitized_row.get('so_dien_thoai', '').strip()
                email = sanitized_row.get('email', '').strip()
                address = sanitized_row.get('dia_chi', '').strip()
                
                # Check for duplicates using hash
                phone_hash = encryption_service.hash_for_search(phone) if phone else None
                email_hash = encryption_service.hash_for_search(email) if email else None
                
                if phone_hash or email_hash:
                    check_conditions = []
                    check_params = []
                    
                    if phone_hash:
                        check_conditions.append("phone_hash = %s")
                        check_params.append(phone_hash)
                    if email_hash:
                        check_conditions.append("email_hash = %s")
                        check_params.append(email_hash)
                    
                    cur.execute(f"""
                        SELECT id FROM businesses_demo 
                        WHERE {' OR '.join(check_conditions)}
                        LIMIT 1
                    """, check_params)
                    
                    if cur.fetchone():
                        skipped += 1
                        logger.debug(f"Row {row_no}: Skipped - duplicate")
                        continue
                
                # Encrypt sensitive data
                phone_encrypted = encryption_service.encrypt_phone(phone) if phone else None
                email_encrypted = encryption_service.encrypt_email(email) if email else None
                address_encrypted = encryption_service.encrypt(address) if address else None
                
                # Geocode for location inference
                geocoded = geocoding_service.geocode(sanitized_row)
                tinh_thanh = sanitized_row.get('tinh_thanh') or geocoded.get('tinh_thanh')
                vung_mien = sanitized_row.get('vung_mien') or geocoded.get('vung_mien')
                
                # Insert with encrypted data
                cur.execute("""
                    INSERT INTO businesses_demo (
                        ten_doanh_nghiep, nganh_nghe, vung_mien, tinh_thanh, quan_huyen,
                        dia_chi_encrypted,
                        website, email_encrypted, email_hash,
                        so_dien_thoai_encrypted, phone_hash,
                        facebook, zalo, linkedin,
                        quy_mo, ma_so_thue,
                        trang_thai, nguon_du_lieu, do_tin_cay,
                        data_source, consent_obtained,
                        created_by_user_id, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        %s,
                        %s, %s, %s,
                        %s, %s,
                        %s, %s, %s,
                        %s, %s,
                        %s, %s, %s,
                        %s, %s,
                        %s, NOW()
                    )
                """, (
                    name,
                    sanitized_row.get('nganh_nghe'),
                    vung_mien,
                    tinh_thanh,
                    sanitized_row.get('quan_huyen'),
                    address_encrypted,
                    sanitized_row.get('website'),
                    email_encrypted,
                    email_hash,
                    phone_encrypted,
                    phone_hash,
                    sanitized_row.get('facebook'),
                    sanitized_row.get('zalo'),
                    sanitized_row.get('linkedin'),
                    sanitized_row.get('quy_mo'),
                    sanitized_row.get('ma_so_thue'),
                    sanitized_row.get('trang_thai', 'Hoat_dong'),
                    'CSV Import',
                    int(sanitized_row.get('do_tin_cay', 50)),
                    'CSV Import - Secure',
                    False,  # consent_obtained - need user confirmation
                    current_user['user_id']
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
        
        logger.info(f"CSV import completed: inserted={inserted}, skipped={skipped}, errors={len(errors)}")
        
        return {
            "success": True,
            "inserted": inserted,
            "skipped": skipped,
            "errors": errors[:10],  # Return first 10 errors only
            "total_errors": len(errors),
            "validation": validation_result,
            "message": f"✅ Import thành công: {inserted} doanh nghiệp mới, {skipped} bị bỏ qua"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CSV import failed: {e}")
        raise HTTPException(status_code=500, detail=f"Import thất bại: {str(e)}")
