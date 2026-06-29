# 🔥 Logfire Real-Time Monitoring Setup

## Bước 1: Tạo Read Token từ Logfire

### Via Web Interface (Recommended)

1. Mở Logfire web interface: https://logfire.pydantic.dev/
2. Chọn project **kiethk/emtu** từ Projects section bên trái
3. Click vào **⚙️ Settings** tab ở góc trên bên phải
4. Chọn **Read tokens** tab từ menu bên trái
5. Click **Create read token** button
6. Copy token value (chỉ hiển thị 1 lần duy nhất!)

### Via CLI (Alternative)

```bash
logfire read-tokens --project kiethk/emtu create
```

## Bước 2: Thêm Token vào `.env`

Mở file `.env` và thêm:

```env
LOGFIRE_READ_TOKEN=your_read_token_here
```

## Bước 3: Cài đặt dependencies

```bash
pip install httpx>=0.25.0
```

Hoặc:

```bash
pip install -r requirements.txt
```

## Bước 4: Khởi động lại server

```bash
python -m uvicorn app.main:app --reload
```

## Bước 5: Kiểm tra

1. Login vào admin portal: http://localhost:5173/admin
2. Vào tab **Logfire Monitoring**
3. Kiểm tra status:
   - ✅ **● Connected** = Real-time data từ Logfire
   - ⚠️ **● Not Connected** = Fallback data (cần cấu hình token)

## Metrics hiển thị (Real-time từ Logfire)

### API Metrics
- Total requests hôm nay
- Average response time (ms)
- Error rate (%)
- Top 5 endpoints với số lượng requests

### Recent Errors & Warnings
- Timestamp
- Error level (ERROR, WARNING, INFO)
- Message
- Endpoint gây lỗi

### System Health
- Database status
- Groq API status
- Crawler status
- System uptime

### Database Info
- Database size (PostgreSQL)
- Table sizes (station_news, businesses_demo, app_users)

## Lưu ý

- **Auto-refresh**: Metrics tự động làm mới mỗi 30 giây
- **Time range**: Mặc định lấy data 24h gần nhất
- **Query limit**: Tối đa 1000 rows/query
- **Fallback**: Nếu không có token, vẫn hiển thị database metrics + simulated data

## Troubleshooting

### ❌ "Logfire read token not configured"
→ Chưa thêm `LOGFIRE_READ_TOKEN` vào `.env`

### ❌ "API error: 401"
→ Token không hợp lệ hoặc đã expire

### ❌ "API error: 403"
→ Token không có quyền đọc project `kiethk/emtu`

### ❌ Connection timeout
→ Kiểm tra network connection hoặc Logfire service status

## SQL Queries được sử dụng

### Request Metrics
```sql
SELECT 
    COUNT(*) as total_requests,
    AVG(duration) / 1000000 as avg_response_ms,
    SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
FROM records
WHERE span_name LIKE 'GET %' OR span_name LIKE 'POST %'
```

### Top Endpoints
```sql
SELECT 
    span_name as endpoint,
    COUNT(*) as count,
    AVG(duration) / 1000000 as avg_time_ms
FROM records
WHERE span_name LIKE 'GET %' OR span_name LIKE 'POST %'
GROUP BY span_name
ORDER BY count DESC
LIMIT 5
```

### Recent Errors
```sql
SELECT 
    start_timestamp,
    level,
    message,
    span_name as endpoint
FROM records
WHERE level IN ('error', 'warning')
ORDER BY start_timestamp DESC
LIMIT 10
```

## API Documentation

- Logfire Query API: https://logfire.pydantic.dev/docs/how-to-guides/query-api/
- SQL Reference: https://logfire.pydantic.dev/docs/reference/sql/
- Python Query Client: https://pydantic.dev/docs/logfire/api/query_client/

---

**Created**: 2026-06-29  
**Project**: EMTU News Chatbot Admin Dashboard
