"""
Auth API Routes
User authentication endpoints with rate limiting
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
import psycopg2
from psycopg2.extras import RealDictCursor
import hashlib
import jwt
from datetime import datetime, timedelta
import logging
from app.config import settings
from app.middleware.rate_limiter import limiter, AUTH_RATE_LIMIT

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


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password


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
        
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        
        cur.execute("SELECT id FROM app_users WHERE email = %s", (register_request.email,))
        existing_user = cur.fetchone()
        
        if existing_user:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail="Email đã được sử dụng")
        
        
        password_hash = hash_password(register_request.password)
        
        
        cur.execute("""
            INSERT INTO app_users (email, password_hash, full_name, phone, role, created_at)
            VALUES (%s, %s, %s, %s, 'user', NOW())
            RETURNING id, email, full_name, phone, role, created_at
        """, (register_request.email, password_hash, register_request.full_name, register_request.phone))
        
        user = cur.fetchone()
        conn.commit()
        
        
        token = generate_jwt_token(user)
        
        
        cur.close()
        conn.close()
        
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
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT id, email, full_name, phone, role, created_at, password_hash
            FROM app_users
            WHERE email = %s
        """, (login_request.email,))
        
        user = cur.fetchone()
        
        if not user:
            cur.close()
            conn.close()
            raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")
        
        if not verify_password(login_request.password, user['password_hash']):
            cur.close()
            conn.close()
            raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")
        
        user_dict = dict(user)
        user_dict.pop('password_hash', None)
        
        token = generate_jwt_token(user_dict)

        cur.close()
        conn.close()
        
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
        conn = psycopg2.connect(**settings.database_url)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        
        cur.execute("SELECT id, email, full_name, password_hash, role FROM app_users WHERE email = %s", (request.email,))
        user = cur.fetchone()
        
        if not user:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Người dùng không tồn tại")
        
        
        if request.new_password:
            if not request.current_password:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail="Cần nhập mật khẩu hiện tại")
            
            if not verify_password(request.current_password, user['password_hash']):
                cur.close()
                conn.close()
                raise HTTPException(status_code=401, detail="Mật khẩu hiện tại không đúng")

            new_password_hash = hash_password(request.new_password)
            cur.execute("""
                UPDATE app_users
                SET full_name = %s, password_hash = %s
                WHERE id = %s
                RETURNING id, email, full_name, phone, role, created_at
            """, (request.full_name, new_password_hash, user['id']))
        else:
            
            cur.execute("""
                UPDATE app_users
                SET full_name = %s
                WHERE id = %s
                RETURNING id, email, full_name, phone, role, created_at
            """, (request.full_name, user['id']))
        
        updated_user = cur.fetchone()
        conn.commit()
        
        
        token = generate_jwt_token(user)
        
        cur.close()
        conn.close()
        
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


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "auth"
    }
