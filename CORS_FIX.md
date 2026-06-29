# ✅ CORS Issue Fixed

## Vấn đề

Frontend không thể gọi API từ backend:
```
Access to fetch at 'http://127.0.0.1:8000/api/auth/login' 
from origin 'http://localhost:5173' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Nguyên nhân

1. ❌ Logfire `instrument_fastapi()` gây conflict với FastAPI router
2. ❌ Missing `expose_headers` trong CORS config
3. ❌ Thiếu alternate ports (5174)

## Giải pháp đã áp dụng

### 1. Tắt Logfire FastAPI Instrumentation

```python
# app/main.py
try:
    if settings.LOGFIRE_TOKEN:
        logfire.configure(token=settings.LOGFIRE_TOKEN)
        # Temporarily disable instrumentation due to compatibility issue
        # logfire.instrument_fastapi(app)
        logger.info("🔥 Logfire monitoring enabled (instrumentation disabled)")
```

**Lý do**: 
- OpenTelemetry FastAPI instrumentation có bug với `_IncludedRouter`
- Error: `AttributeError: '_IncludedRouter' object has no attribute 'path'`
- Tạm thời disable để fix CORS, vẫn có thể query Logfire API bình thường

### 2. Cập nhật CORS Middleware

```python
# app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",  # Vite sometimes uses this
        "http://127.0.0.1:5174"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]  # ← Added this
)
```

**Changes**:
- ✅ Thêm `expose_headers=["*"]`
- ✅ Thêm ports 5174 (Vite alternate port)
- ✅ Giữ nguyên `allow_credentials=True`

## Kiểm tra kết quả

### Test CORS Preflight (OPTIONS)

```bash
curl -X OPTIONS http://127.0.0.1:8000/api/auth/login \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  -i
```

**Response** (✅ Success):
```
HTTP/1.1 200 OK
access-control-allow-origin: http://localhost:5173
access-control-allow-credentials: true
access-control-allow-methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT
access-control-allow-headers: content-type
access-control-max-age: 600
```

### Test Actual Request (POST)

```bash
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"email":"admin@emtu.vn","password":"admin123"}' \
  -i
```

**Response Headers** (✅ Success):
```
access-control-allow-origin: http://localhost:5173
access-control-allow-credentials: true
access-control-expose-headers: *
```

## Frontend Usage

Bây giờ frontend có thể gọi API bình thường:

```javascript
// AuthView.jsx
const response = await fetch('http://127.0.0.1:8000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',  // Important for cookies
  body: JSON.stringify({ email, password })
});
```

**CORS headers sẽ được tự động include trong response!**

## CORS Flow

### Preflight Request (Browser automatically sends)

```
Browser → OPTIONS /api/auth/login
Headers:
  Origin: http://localhost:5173
  Access-Control-Request-Method: POST
  Access-Control-Request-Headers: content-type
```

### Preflight Response (Backend)

```
Backend → 200 OK
Headers:
  Access-Control-Allow-Origin: http://localhost:5173
  Access-Control-Allow-Methods: POST
  Access-Control-Allow-Headers: content-type
  Access-Control-Allow-Credentials: true
```

### Actual Request (After preflight passes)

```
Browser → POST /api/auth/login
Headers:
  Origin: http://localhost:5173
  Content-Type: application/json
Body: {"email":"admin@emtu.vn","password":"admin123"}
```

### Actual Response

```
Backend → 200 OK
Headers:
  Access-Control-Allow-Origin: http://localhost:5173
  Access-Control-Allow-Credentials: true
  Access-Control-Expose-Headers: *
Body: {"status":"success","user":{...},"token":"..."}
```

## Allowed Origins

Frontend có thể gọi từ:
- ✅ `http://localhost:5173`
- ✅ `http://127.0.0.1:5173`
- ✅ `http://localhost:5174`
- ✅ `http://127.0.0.1:5174`

Nếu chạy frontend ở port khác, thêm vào `allow_origins` array.

## Impact of Disabling Logfire Instrumentation

### ❌ Lost Features:
- Automatic HTTP request tracing in Logfire UI
- Automatic span creation for each endpoint
- Request/response logging to Logfire

### ✅ Still Working:
- Manual logging with `logfire.info()`, `logfire.error()`
- Logfire Query API (đã implement)
- Custom metrics tracking
- Admin dashboard monitoring

### 🔄 Future Fix:

Đợi update từ:
- `opentelemetry-instrumentation-fastapi` package
- Hoặc downgrade FastAPI version
- Hoặc use manual instrumentation thay vì automatic

## Configuration Summary

| Setting | Value |
|---------|-------|
| CORS Middleware | ✅ Enabled |
| Allowed Origins | 4 origins (localhost + 127.0.0.1, ports 5173 + 5174) |
| Allow Credentials | ✅ True |
| Allow Methods | ✅ All (*) |
| Allow Headers | ✅ All (*) |
| Expose Headers | ✅ All (*) |
| Logfire Instrumentation | ❌ Disabled (temp) |
| Logfire Query API | ✅ Working |

## Testing Checklist

- [x] OPTIONS preflight works
- [x] POST requests work
- [x] CORS headers present
- [x] Credentials allowed
- [x] Frontend can call backend
- [x] Login works
- [x] Admin dashboard accessible
- [x] No 500 errors
- [x] Logfire query API still works

## Troubleshooting

### Issue: Still getting CORS error

**Solution**:
1. Check frontend is running on allowed origin
2. Hard refresh browser (Ctrl+Shift+R)
3. Clear browser cache
4. Check server logs for errors

### Issue: Credentials not working

**Solution**:
- Ensure `credentials: 'include'` in fetch
- Ensure `allow_credentials=True` in backend
- Check cookies are being sent

### Issue: 500 Internal Server Error

**Solution**:
- Check server logs: `get_process_output`
- Logfire instrumentation might be causing issues
- Verify it's disabled in `main.py`

## Files Modified

1. `app/main.py`
   - Updated CORS middleware config
   - Disabled Logfire FastAPI instrumentation
   - Added more allowed origins

## Next Steps (Optional)

1. Monitor for Logfire/OpenTelemetry updates
2. Re-enable instrumentation when fixed
3. Consider adding rate limiting per origin
4. Add production domain to allowed origins

---

**Status**: ✅ CORS Fixed & Working  
**Date**: 2026-06-29  
**Impact**: Frontend can now call backend APIs without CORS errors
