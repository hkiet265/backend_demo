# 🏗️ Real-time Monitoring Architecture

## 📊 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                              │
│                    http://localhost:5173/admin                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP Request
                             │ GET /api/admin/monitoring
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND                               │
│                 http://127.0.0.1:8000                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         /api/admin/monitoring (admin.py)                 │  │
│  │                                                           │  │
│  │  1. Check logfire.is_enabled()                          │  │
│  │  2. If YES → Query Logfire API                          │  │
│  │  3. If NO  → Return fallback data                       │  │
│  │  4. Query PostgreSQL for DB stats                       │  │
│  │  5. Merge & return JSON                                 │  │
│  └──────────────┬───────────────────────┬───────────────────┘  │
│                 │                       │                       │
│                 │                       │                       │
│  ┌──────────────▼─────────────┐  ┌─────▼──────────────────┐   │
│  │  Logfire Service           │  │  PostgreSQL Client     │   │
│  │  (logfire_service.py)      │  │  (psycopg2)            │   │
│  │                            │  │                        │   │
│  │  - get_request_metrics()   │  │  - Get DB size         │   │
│  │  - get_top_endpoints()     │  │  - Get table sizes     │   │
│  │  - get_recent_errors()     │  │  - Get activity logs   │   │
│  │  - get_system_health()     │  │                        │   │
│  └──────────────┬─────────────┘  └─────┬──────────────────┘   │
│                 │                       │                       │
└─────────────────┼───────────────────────┼───────────────────────┘
                  │                       │
                  │ HTTPS                 │ PostgreSQL Protocol
                  │ (with Bearer token)   │ (SSL required)
                  ▼                       ▼
┌─────────────────────────────┐  ┌──────────────────────────────┐
│      LOGFIRE API            │  │    SUPABASE POSTGRESQL       │
│  (logfire-us.pydantic.dev)  │  │                              │
│                             │  │  - station_news              │
│  Tables:                    │  │  - businesses_demo           │
│  - records (logs, traces)   │  │  - app_users                 │
│  - metrics (aggregated)     │  │                              │
│                             │  │  Vector extension (pgvector) │
│  Columns:                   │  │  - news_embeddings           │
│  - start_timestamp          │  │                              │
│  - span_name (endpoint)     │  └──────────────────────────────┘
│  - duration (response time) │
│  - level (error, warning)   │
│  - message                  │
│  - status_code              │
└─────────────────────────────┘
```

## 🔄 Data Flow

### With Logfire Token (Real-time):

```
1. User opens Admin Dashboard
        ↓
2. Frontend auto-refreshes every 30s
        ↓
3. Calls GET /api/admin/monitoring
        ↓
4. Backend checks LOGFIRE_READ_TOKEN exists
        ↓
5. [YES] → logfire_service.query_json(sql, min_timestamp)
        ↓
6. HTTP POST to https://logfire-us.pydantic.dev/v2/query
   Headers: Authorization: Bearer <token>
   Body: {sql: "SELECT ...", min_timestamp: "2026-06-28T00:00:00Z"}
        ↓
7. Logfire executes SQL on records table
        ↓
8. Returns JSON: {schema: {...}, data: [{...}, {...}]}
        ↓
9. Backend parses & formats metrics
        ↓
10. Query PostgreSQL for DB stats
        ↓
11. Merge data & return to frontend
        ↓
12. Frontend displays: ● Connected (green)
```

### Without Token (Fallback):

```
1. User opens Admin Dashboard
        ↓
2. Calls GET /api/admin/monitoring
        ↓
3. Backend checks LOGFIRE_READ_TOKEN exists
        ↓
4. [NO] → Use fallback simulated data
        ↓
5. Query PostgreSQL for DB stats
        ↓
6. Return fallback + DB stats to frontend
        ↓
7. Frontend displays: ● Not Connected (orange)
```

## 📡 API Communication

### Request to Logfire API

```http
POST https://logfire-us.pydantic.dev/v2/query
Authorization: Bearer lfr_xxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "sql": "SELECT COUNT(*) as total FROM records WHERE span_name LIKE 'POST %'",
  "min_timestamp": "2026-06-28T10:30:00Z",
  "limit": 1000
}
```

### Response from Logfire API

```json
{
  "schema": {
    "fields": [
      {"name": "total", "data_type": "Int64", "nullable": false}
    ]
  },
  "data": [
    {"total": 1240}
  ]
}
```

## 🗄️ Database Schema

### Logfire (Remote)

```sql
-- records table (traces & logs)
CREATE TABLE records (
    start_timestamp TIMESTAMP,
    span_name TEXT,              -- e.g., "POST /api/chat/message"
    duration BIGINT,              -- nanoseconds
    level TEXT,                   -- error, warning, info
    message TEXT,
    status_code INTEGER,
    service_name TEXT,
    -- ... more columns
);

-- metrics table (aggregated)
CREATE TABLE metrics (
    recorded_timestamp TIMESTAMP,
    metric_name TEXT,
    value DOUBLE,
    -- ... more columns
);
```

### PostgreSQL (Supabase)

```sql
-- app_users table
CREATE TABLE app_users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE,
    full_name TEXT,
    phone TEXT,
    role TEXT,                    -- 'admin' or 'user'
    password_hash TEXT,
    created_at TIMESTAMP
);

-- station_news table
CREATE TABLE station_news (
    id SERIAL PRIMARY KEY,
    tieu_de TEXT,
    nha_dai TEXT,
    chuyen_muc TEXT,
    vung_mien TEXT,
    embedding vector(3072),       -- Gemini embeddings
    created_at TIMESTAMP
);

-- businesses_demo table
CREATE TABLE businesses_demo (
    id SERIAL PRIMARY KEY,
    ten_doanh_nghiep TEXT,
    vung_mien TEXT,
    embedding vector(3072),
    created_at TIMESTAMP
);
```

## 🔐 Security

### Token Types

1. **LOGFIRE_TOKEN** (Write token)
   - Purpose: Send traces/logs TO Logfire
   - Used by: `logfire.configure(token=...)`
   - Scope: Write-only

2. **LOGFIRE_READ_TOKEN** (Read token)
   - Purpose: Query metrics FROM Logfire
   - Used by: `LogfireQueryService`
   - Scope: Read-only
   - **Required for real-time monitoring**

### Authentication Flow

```
Backend → Logfire API
  Headers: {
    "Authorization": "Bearer lfr_xxxxxxxxxxxxx"
  }
  
  ✅ Valid token   → 200 OK + data
  ❌ Missing token → 401 Unauthorized
  ❌ Invalid token → 401 Unauthorized
  ❌ No permission → 403 Forbidden
```

## 🎯 Components

### Backend

| File | Purpose |
|------|---------|
| `app/services/logfire_service.py` | Query Logfire API |
| `app/api/admin.py` | Admin endpoints |
| `app/config.py` | Settings & env vars |
| `app/main.py` | FastAPI app + Logfire instrumentation |

### Frontend

| File | Purpose |
|------|---------|
| `src/components/LogfireView.jsx` | Monitoring dashboard UI |
| `src/pages/AdminPortal.jsx` | Admin portal layout |
| `src/App.jsx` | Router + routes |

### Configuration

| File | Purpose |
|------|---------|
| `.env` | Environment variables |
| `requirements.txt` | Python dependencies |

### Documentation

| File | Purpose |
|------|---------|
| `LOGFIRE_SETUP.md` | Setup instructions |
| `NEXT_STEPS.md` | What to do next |
| `REALTIME_MONITORING_SUMMARY.md` | Implementation details |
| `README_LOGFIRE_REALTIME.md` | Quick start guide |
| `test_logfire_connection.py` | Connection test script |

## 📦 Dependencies

```
fastapi         # Web framework
uvicorn         # ASGI server
logfire         # Monitoring SDK (write traces)
httpx           # HTTP client (query Logfire API) ← NEW
psycopg2-binary # PostgreSQL client
pydantic        # Data validation
slowapi         # Rate limiting
```

## 🔄 Auto-refresh Mechanism

```javascript
// Frontend (LogfireView.jsx)
useEffect(() => {
  fetchMonitoring();  // Initial fetch
  
  const interval = setInterval(
    fetchMonitoring,   // Repeat every 30s
    30000
  );
  
  return () => clearInterval(interval);
}, []);
```

## 📈 Metrics Pipeline

```
Production Traffic
       ↓
FastAPI endpoints
       ↓
Logfire instrumentation
       ↓
Traces sent to Logfire (via LOGFIRE_TOKEN)
       ↓
Stored in Logfire records table
       ↓
Admin queries via Read Token (via LOGFIRE_READ_TOKEN)
       ↓
SQL aggregation (COUNT, AVG, SUM)
       ↓
Return metrics to dashboard
       ↓
Display in real-time
```

## 🎨 UI States

### Connected State
```
┌─────────────────────────────────────────┐
│ 🔥 Logfire Monitoring                   │
│ Real-time system monitoring             │
│ ● Connected                       🔄    │
├─────────────────────────────────────────┤
│ ✅ Total Requests: 1,240                │
│ ✅ Avg Response: 450ms                  │
│ ✅ Error Rate: 2.0%                     │
│ ✅ Database: 156 MB                     │
└─────────────────────────────────────────┘
```

### Not Connected State
```
┌─────────────────────────────────────────┐
│ 🔥 Logfire Monitoring                   │
│ Real-time system monitoring             │
│ ● Not Connected (Using fallback data)  │
├─────────────────────────────────────────┤
│ ⚠️  Total Requests: 0                   │
│ ⚠️  Avg Response: 0ms                   │
│ ⚠️  Configure LOGFIRE_READ_TOKEN        │
└─────────────────────────────────────────┘
```

---

**Architecture Type**: Client-Server with External Monitoring Service  
**Data Source**: Dual (Logfire API + PostgreSQL)  
**Update Frequency**: 30 seconds (auto-refresh)  
**Fallback Strategy**: Graceful degradation to simulated data
