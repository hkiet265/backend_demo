"""
Auth API Routes
User authentication endpoints with rate limiting
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, EmailStr
import psycopg2
from psycopg2.extras import RealDictCursor
import hashlib
import hmac
import jwt
import os
import secrets
from datetime import datetime, timedelta
import logging
from app.config import settings
from app.middleware.rate_limiter import limiter, AUTH_RATE_LIMIT
from app.database import get_db_connection
from app.services.email_service import send_password_reset_email
from app.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    user: dict


# Was plain unsalted hashlib.sha256(password) — vulnerable to rainbow-table
# attacks since every user with the same password gets the identical hash,
# and no per-user secret (salt) makes precomputed-hash lookups feasible.
# New passwords (register/reset) get a self-describing salted PBKDF2 hash;
# hash_password() below never produces the old bare-hex format again.
# verify_password() still accepts the legacy format so existing accounts'
# passwords keep working without a forced reset — it just never MINTS
# more of that format going forward.
_PBKDF2_ITERATIONS = 260_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), _PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hashed_password.startswith("pbkdf2_sha256$"):
        try:
            _, iterations, salt, expected_hex = hashed_password.split("$")
            digest = hashlib.pbkdf2_hmac(
                "sha256", plain_password.encode(), bytes.fromhex(salt), int(iterations)
            )
            return hmac.compare_digest(digest.hex(), expected_hex)
        except (ValueError, IndexError):
            return False
    # Legacy unsalted SHA-256 hash (accounts created/reset before this change).
    return hmac.compare_digest(hashlib.sha256(plain_password.encode()).hexdigest(), hashed_password)


def generate_jwt_token(user: dict) -> str:
    """Generate JWT token for user"""
    payload = {
        "user_id": user['id'],
        "email": user['email'],
        "full_name": user['full_name'],
        "role": user.get('role', 'user'),
        "exp": datetime.utcnow() + timedelta(days=settings.JWT_EXPIRATION_DAYS)
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


@router.post("/register", response_model=AuthResponse)
@limiter.limit(AUTH_RATE_LIMIT)
async def register(request: Request, register_request: RegisterRequest):
    """
    Register new user
    
    - **email**: User email (unique)
    - **password**: User password (min 6 chars)
    - **full_name**: User full name
    - **phone**: User phone (optional)
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Check if email exists
            cur.execute("SELECT id FROM app_users WHERE email = %s", (register_request.email,))
            existing_user = cur.fetchone()
            
            if existing_user:
                raise HTTPException(status_code=400, detail="Email đã được sử dụng")
            
            # Hash password
            password_hash = hash_password(register_request.password)
            
            # Insert user
            cur.execute("""
                INSERT INTO app_users (email, password_hash, full_name, phone, role, created_at)
                VALUES (%s, %s, %s, %s, 'user', NOW())
                RETURNING id, email, full_name, phone, role, created_at
            """, (register_request.email, password_hash, register_request.full_name, register_request.phone))
            
            user = cur.fetchone()
            conn.commit()
            
            # Generate JWT
            token = generate_jwt_token(user)
            
            cur.close()
            
            logger.info(f"User registered: {user['email']}")
            
            return AuthResponse(
                access_token=token,
                user={
                    'id': user['id'],
                    'email': user['email'],
                    'full_name': user['full_name'],
                    'phone': user['phone'],
                    'role': user.get('role', 'user'),
                    'created_at': str(user['created_at'])
                }
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        raise HTTPException(status_code=500, detail=f"Đăng ký thất bại: {str(e)}")


@router.post("/login", response_model=AuthResponse)
@limiter.limit(AUTH_RATE_LIMIT)  
async def login(request: Request, login_request: LoginRequest):
    """
    Login user
    
    - **email**: User email
    - **password**: User password
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            cur.execute("""
                SELECT id, email, full_name, phone, role, created_at, password_hash, status
                FROM app_users
                WHERE email = %s
            """, (login_request.email,))

            user = cur.fetchone()

            if not user:
                raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")

            if not verify_password(login_request.password, user['password_hash']):
                raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")

            if user.get('status') == 'locked':
                raise HTTPException(status_code=403, detail="Tài khoản của bạn đã bị khóa")

            user_dict = dict(user)
            user_dict.pop('password_hash', None)

            token = generate_jwt_token(user_dict)

            cur.execute("UPDATE app_users SET last_login = NOW() WHERE id = %s", (user['id'],))
            conn.commit()
            cur.close()

            logger.info(f"User logged in: {user['email']}")
            
            return AuthResponse(
                access_token=token,
                user={
                    'id': user['id'],
                    'email': user['email'],
                    'full_name': user['full_name'],
                    'phone': user['phone'],
                    'role': user.get('role', 'user'),
                    'created_at': str(user['created_at'])
                }
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(status_code=500, detail=f"Đăng nhập thất bại: {str(e)}")


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password")
@limiter.limit(AUTH_RATE_LIMIT)
async def forgot_password(request: Request, forgot_request: ForgotPasswordRequest):
    """
    Request a password reset link. Always returns a generic success message
    (even if the email doesn't exist) to avoid leaking which emails are registered.
    """
    generic_response = {
        "status": "success",
        "message": "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi."
    }
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("SELECT id, email FROM app_users WHERE email = %s", (forgot_request.email,))
            user = cur.fetchone()

            if not user:
                return generic_response

            reset_token = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(hours=1)

            cur.execute("""
                UPDATE app_users SET reset_token = %s, reset_token_expires = %s WHERE id = %s
            """, (reset_token, expires_at, user['id']))
            conn.commit()
            cur.close()

            send_password_reset_email(user['email'], reset_token)
            logger.info(f"Password reset requested for: {user['email']}")

            return generic_response

    except Exception as e:
        logger.error(f"Forgot password failed: {e}")
        raise HTTPException(status_code=500, detail="Không thể xử lý yêu cầu, vui lòng thử lại")


@router.post("/reset-password")
@limiter.limit(AUTH_RATE_LIMIT)
async def reset_password(request: Request, reset_request: ResetPasswordRequest):
    """Set a new password using a valid, non-expired reset token"""
    if len(reset_request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu phải có ít nhất 6 ký tự")

    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("""
                SELECT id, email, reset_token_expires FROM app_users WHERE reset_token = %s
            """, (reset_request.token,))
            user = cur.fetchone()

            if not user or not user['reset_token_expires'] or user['reset_token_expires'] < datetime.utcnow():
                raise HTTPException(status_code=400, detail="Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn")

            new_password_hash = hash_password(reset_request.new_password)
            cur.execute("""
                UPDATE app_users SET password_hash = %s, reset_token = NULL, reset_token_expires = NULL
                WHERE id = %s
            """, (new_password_hash, user['id']))
            conn.commit()
            cur.close()

            logger.info(f"Password reset completed for: {user['email']}")

            return {"status": "success", "message": "Đặt lại mật khẩu thành công, vui lòng đăng nhập lại"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset password failed: {e}")
        raise HTTPException(status_code=500, detail="Không thể đặt lại mật khẩu, vui lòng thử lại")


class UpdateProfileRequest(BaseModel):
    email: EmailStr
    full_name: str
    current_password: str = None
    new_password: str = None


@router.put("/update-profile", response_model=AuthResponse)
async def update_profile(request: UpdateProfileRequest):
    """
    Update user profile (name and/or password)
    
    - **email**: User email (for identification)
    - **full_name**: New full name
    - **current_password**: Current password (required if changing password)
    - **new_password**: New password (optional)
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Get current user
            cur.execute("SELECT id, email, full_name, password_hash, role FROM app_users WHERE email = %s", (request.email,))
            user = cur.fetchone()
            
            if not user:
                raise HTTPException(status_code=404, detail="Người dùng không tồn tại")
            
            # If changing password, verify current password
            if request.new_password:
                if not request.current_password:
                    raise HTTPException(status_code=400, detail="Cần nhập mật khẩu hiện tại")
                
                if not verify_password(request.current_password, user['password_hash']):
                    raise HTTPException(status_code=401, detail="Mật khẩu hiện tại không đúng")

                new_password_hash = hash_password(request.new_password)
                cur.execute("""
                    UPDATE app_users
                    SET full_name = %s, password_hash = %s
                    WHERE id = %s
                    RETURNING id, email, full_name, phone, role, created_at
                """, (request.full_name, new_password_hash, user['id']))
            else:
                # Update name only
                cur.execute("""
                    UPDATE app_users
                    SET full_name = %s
                    WHERE id = %s
                    RETURNING id, email, full_name, phone, role, created_at
                """, (request.full_name, user['id']))
            
            updated_user = cur.fetchone()
            conn.commit()
            
            # Generate new JWT
            token = generate_jwt_token(user)
            
            cur.close()
            
            logger.info(f"User profile updated: {updated_user['email']}")
            
            return AuthResponse(
                access_token=token,
                user={
                    'id': updated_user['id'],
                    'email': updated_user['email'],
                    'full_name': updated_user['full_name'],
                    'phone': updated_user['phone'],
                    'role': updated_user.get('role', 'user'),
                    'created_at': str(updated_user['created_at'])
                }
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update profile failed: {e}")
        raise HTTPException(status_code=500, detail=f"Cập nhật thất bại: {str(e)}")


class DeleteAccountRequest(BaseModel):
    password: str


@router.delete("/me")
async def delete_my_account(request: DeleteAccountRequest, current_user: dict = Depends(get_current_user)):
    """
    GDPR "right to be forgotten" — a user deletes their own account and
    all data tied to it. Requires re-entering the password so a hijacked
    session token alone can't wipe an account. Cascades via FK constraints
    already in place (candidate_profiles, job_applications, saved_jobs,
    job_messages, bookmarks — all ON DELETE CASCADE from app_users;
    job_listings.created_by_user_id is ON DELETE SET NULL so a posted job
    other people applied to isn't deleted out from under them).
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT password_hash, role FROM app_users WHERE id = %s", (current_user["id"],))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Tài khoản không tồn tại")
            password_hash, role = row

            if not verify_password(request.password, password_hash):
                raise HTTPException(status_code=401, detail="Mật khẩu không đúng")
            if role == "admin":
                raise HTTPException(status_code=403, detail="Tài khoản admin không thể tự xóa qua endpoint này")

            # Remove the CV file from disk before the DB row (and its
            # cv_file_path) disappears via cascade — otherwise it's an
            # orphaned file nobody can ever clean up again.
            cur.execute("SELECT cv_file_path FROM candidate_profiles WHERE user_id = %s", (current_user["id"],))
            profile = cur.fetchone()
            cv_path = profile[0] if profile else None

            cur.execute("DELETE FROM app_users WHERE id = %s", (current_user["id"],))
            conn.commit()
            cur.close()

        if cv_path and os.path.isfile(cv_path):
            try:
                os.remove(cv_path)
            except OSError as e:
                logger.warning(f"Could not remove CV file on account deletion: {e}")

        logger.info(f"User {current_user['id']} ({current_user['email']}) deleted their own account")
        return {"status": "success", "message": "Đã xóa tài khoản và toàn bộ dữ liệu liên quan"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete own account error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "auth"
    }
