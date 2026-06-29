# 🚀 News Chatbot + Business Directory với AI

Hệ thống quản lý doanh nghiệp và tin tức kết hợp AI (RAG, Vector Search, Auto-enrichment)

## ✨ Tính năng chính

### 🏢 Quản lý Doanh nghiệp
- ✅ Danh sách 48 doanh nghiệp với đầy đủ thông tin
- ✅ Filter theo vùng miền (Bắc/Trung/Nam)
- ✅ Tìm kiếm realtime
- ✅ CRUD đầy đủ (Create/Read/Update/Delete)
- ✅ Import/Export CSV
- ✅ AI tự động chuẩn hóa dữ liệu
- ✅ Phân loại ngành nghề tự động
- ✅ Tính điểm tin cậy (Trust Score)

### 📰 Quản lý Tin tức
- ✅ **Auto-crawling** mỗi 15 phút (MIỄN PHÍ)
- ✅ 10 tin tức với vector embeddings
- ✅ RAG (Retrieval-Augmented Generation)
- ✅ Tìm kiếm similarity search
- ✅ Chatbot AI trả lời về tin tức
- ✅ RSS feeds từ VTV, VTC, VOV

### 🤖 AI Features
- ✅ **API Key Rotation** (10 Gemini keys tự động)
- ✅ **Auto-crawling** tin tức (miễn phí, không tốn token)
- ✅ Chuẩn hóa số điện thoại (+84...)
- ✅ Chuẩn hóa email, website
- ✅ Suy luận vùng miền từ 63 tỉnh/thành
- ✅ Auto-classify 10 ngành nghề
- ✅ Trust scoring 0-100
- ✅ Tóm tắt văn bản (Gemini AI)

---

## 🚀 Bắt đầu nhanh

### 1. Cài đặt
```bash
# Clone repo
cd backend_demo

# Cài đặt Python dependencies
pip install -r requirements.txt

# Cài đặt Node.js dependencies (frontend)
cd chatbox-news-fe
npm install
cd ..
```

### 2. Cấu hình
File `.env` đã có sẵn với:
- Database: Supabase PostgreSQL
- API Key: Gemini AI

### 3. Chạy Backend
```bash
# Windows - với auto-crawling
start_with_auto_crawl.bat

# Hoặc manual
run_server.bat

# PowerShell
.\run_server.ps1

# Hoặc
python -m uvicorn app.main:app --reload
```

Backend: http://127.0.0.1:8000

**Check auto-crawler status:**
```bash
curl http://127.0.0.1:8000/health
# Hoặc mở browser: http://127.0.0.1:8000/health
```

### 4. Chạy Frontend
```bash
cd chatbox-news-fe
npm run dev
```

Frontend: http://localhost:5173

---

## 📚 API Documentation

### Business API

#### GET /api/businesses
Lấy danh sách doanh nghiệp
```bash
curl "http://127.0.0.1:8000/api/businesses?page=1&page_size=10"
```

Params:
- `page`: Trang (mặc định 1)
- `page_size`: Số items/trang (mặc định 50, max 100)
- `region`: Filter vùng miền (Bac/Trung/Nam)
- `industry`: Filter ngành nghề

#### GET /api/businesses/search
Tìm kiếm doanh nghiệp
```bash
curl "http://127.0.0.1:8000/api/businesses/search?q=công+ty&region=Bac"
```

#### GET /api/businesses/{id}
Lấy chi tiết 1 doanh nghiệp
```bash
curl "http://127.0.0.1:8000/api/businesses/1"
```

#### POST /api/businesses
Tạo doanh nghiệp mới
```bash
curl -X POST "http://127.0.0.1:8000/api/businesses" \
  -H "Content-Type: application/json" \
  -d '{
    "ten_doanh_nghiep": "Công ty ABC",
    "tinh_thanh": "Hà Nội",
    "so_dien_thoai": "0901234567",
    "email": "info@abc.vn"
  }'
```

#### PUT /api/businesses/{id}
Cập nhật thông tin
```bash
curl -X PUT "http://127.0.0.1:8000/api/businesses/1" \
  -H "Content-Type: application/json" \
  -d '{"quy_mo": "100-200 nhân viên"}'
```

#### DELETE /api/businesses/{id}
Xóa doanh nghiệp
```bash
curl -X DELETE "http://127.0.0.1:8000/api/businesses/1"
```

#### GET /api/businesses/export/csv
Export CSV
```bash
curl "http://127.0.0.1:8000/api/businesses/export/csv" -o businesses.csv

# Export theo vùng
curl "http://127.0.0.1:8000/api/businesses/export/csv?region=Bac" -o bac.csv
```

#### POST /api/businesses/bulk-import
Import từ CSV (xem frontend để dùng)

---

### AI Enrichment API

#### POST /api/businesses/normalize
Chuẩn hóa dữ liệu
```bash
curl -X POST "http://127.0.0.1:8000/api/businesses/normalize" \
  -H "Content-Type: application/json" \
  -d '{
    "so_dien_thoai": "0901234567",
    "email": "Contact@ABC.VN  ",
    "website": "abc.vn",
    "tinh_thanh": "Hà Nội"
  }'
```

Response:
```json
{
  "status": "success",
  "normalized": {
    "so_dien_thoai": "+84901234567",
    "email": "contact@abc.vn",
    "website": "https://abc.vn",
    "vung_mien": "Bắc",
    "nganh_nghe": "Công Nghệ Thông Tin",
    "do_tin_cay": 80
  }
}
```

#### POST /api/businesses/{id}/enrich
Làm giàu dữ liệu 1 doanh nghiệp
```bash
curl -X POST "http://127.0.0.1:8000/api/businesses/1/enrich"
```

#### POST /api/businesses/enrich-all
Làm giàu hàng loạt
```bash
curl -X POST "http://127.0.0.1:8000/api/businesses/enrich-all?limit=100"
```

---

### Chat API

#### POST /api/chat/message
Chat với AI về tin tức
```bash
curl -X POST "http://127.0.0.1:8000/api/chat/message" \
  -H "Content-Type: application/json" \
  -d '{"message": "Cho tôi biết tin tức về công nghệ"}'
```

---

### Auto-Crawler API

#### GET /health
System health với scheduler status
```bash
curl "http://127.0.0.1:8000/health"
```

Response:
```json
{
  "status": "healthy",
  "auto_crawler": {
    "status": "running",
    "next_run": "2026-06-28T15:30:00",
    "interval": "15 minutes"
  }
}
```

#### POST /api/crawler/start
Chạy crawler background (async)
```bash
curl -X POST "http://127.0.0.1:8000/api/crawler/start"
```

#### POST /api/crawler/start-sync
Chạy crawler đồng bộ (sync, chờ kết quả)
```bash
curl -X POST "http://127.0.0.1:8000/api/crawler/start-sync"
```

#### GET /api/crawler/stats
Thống kê tin tức đã crawl
```bash
curl "http://127.0.0.1:8000/api/crawler/stats"
```

#### GET /api/crawler/sources
Danh sách RSS sources
```bash
curl "http://127.0.0.1:8000/api/crawler/sources"
```

---

## 📊 Database Schema

### Table: businesses_demo (29 columns)
```sql
- id (primary key)
- ten_doanh_nghiep, nganh_nghe, vung_mien
- tinh_thanh, quan_huyen, dia_chi
- website, email, so_dien_thoai
- facebook, zalo, linkedin
- lat, lng (tọa độ)
- quy_mo, ma_so_thue, ngay_thanh_lap
- trang_thai, nguon_du_lieu, do_tin_cay
- tags, ghi_chu, mo_ta
- embedding (vector 3072 dims)
- updated_at
```

### Table: station_news (19 columns)
```sql
- id, hash_noi_dung, tieu_de, nha_dai
- tom_tat, vung_mien, tu_khoa, chuyen_muc
- url, anh_dai_dien, thoi_gian_dang
- noi_dung_gon, transcript_video
- thuc_the (NER), do_tin_cay
- nguon_raw, trang_thai
- embedding_vector (3072 dims)
- created_at
```

---

## 🧪 Testing

### Test tất cả API:
```bash
python test_ai_api.py
```

### Kiểm tra database schema:
```bash
python check_schema.py
```

### Test từng endpoint:
Xem API docs: http://127.0.0.1:8000/docs

---

## 📁 Cấu trúc Project

```
backend_demo/
├── app/
│   ├── main.py                  # FastAPI entry point
│   ├── config.py                # Configuration
│   ├── dependencies.py          # Dependency injection
│   ├── api/
│   │   ├── business.py          # Business API (CRUD + AI)
│   │   └── chat.py              # Chat API (RAG)
│   ├── models/                  # Pydantic models
│   ├── services/
│   │   ├── chat_service.py      # Chat logic
│   │   ├── embedding_service.py # Embeddings
│   │   ├── vector_service.py    # Vector search
│   │   ├── rag_service.py       # RAG pipeline
│   │   └── ai_enrichment_service.py  # AI normalization
│   └── db/                      # Database utilities
├── chatbox-news-fe/             # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx              # Main app
│   │   └── components/
│   │       ├── BusinessManagementView.jsx
│   │       ├── NewsStorageView.jsx
│   │       └── ChatControlView.jsx
│   └── package.json
├── scripts/
│   ├── setup_rag.py             # RAG setup
│   └── upgrade_news_schema.py   # DB migration
├── .env                         # Environment variables
├── requirements.txt             # Python dependencies
├── test_ai_api.py              # API tests
└── check_schema.py             # Schema checker
```

---

## 🔧 Tech Stack

### Backend:
- **FastAPI** - Modern Python web framework
- **PostgreSQL** + **pgvector** - Vector database
- **Google Gemini** - AI/LLM (embedding + chat)
- **psycopg2** - PostgreSQL driver

### Frontend:
- **React 18** + **Vite**
- **Lucide React** - Icons
- **CSS3** - Custom styling

### AI/ML:
- **RAG** (Retrieval-Augmented Generation)
- **Vector Embeddings** (3072 dims, gemini-embedding-001)
- **Similarity Search** (pgvector)
- **NLP** - Normalization, classification

---

## 📋 Yêu cầu Hệ thống

- Python 3.9+
- Node.js 16+
- PostgreSQL 14+ với pgvector extension
- Gemini API key

---

## 🐛 Troubleshooting

### Backend không chạy:
```bash
# Kiểm tra dependencies
pip install -r requirements.txt

# Kiểm tra .env file
cat .env

# Kiểm tra port 8000
netstat -an | findstr 8000
```

### Frontend không hiển thị doanh nghiệp:
- Kiểm tra backend đang chạy: http://127.0.0.1:8000
- Kiểm tra API: http://127.0.0.1:8000/api/businesses
- Xem console trong browser (F12)

### Database error:
```bash
# Test connection
python check_schema.py
```

---

## 📝 TODO / Roadmap

### Đã xong (85%):
- ✅ Business CRUD API
- ✅ AI normalization
- ✅ Import/Export CSV
- ✅ RAG chat system
- ✅ Vector search
- ✅ Trust scoring
- ✅ **Auto-crawling tin tức** (NEW!)
- ✅ **API key rotation** (NEW!)

### Đang làm (15%):
- 🔄 Auto-generate embeddings after crawl
- 🔄 Web scraping cho enrichment
- 🔄 Geocoding (địa chỉ → tọa độ)
- 🔄 Frontend CRUD forms
- 🔄 Dashboard analytics
- 🔄 NER (Named Entity Recognition)

---

## 📖 Tài liệu bổ sung

- `AUTO_CRAWLING_GUIDE.md` - ⭐ **Hướng dẫn chi tiết auto-crawling**
- `QUICK_START_AUTO_CRAWL.md` - ⭐ Quick start auto-crawling
- `AUTO_CRAWL_SUMMARY.md` - ⭐ Tóm tắt implementation
- `SYSTEM_OVERVIEW.md` - ⭐ Tổng quan toàn bộ hệ thống
- `NEXT_STEPS_CHECKLIST.md` - ⭐ Checklist bước tiếp theo
- `API_KEY_ROTATION_GUIDE.md` - Hướng dẫn key rotation
- `SMART_CHATBOT_GUIDE.md` - Hướng dẫn RAG chatbot
- `AUDIT_REPORT.md` - Báo cáo chi tiết kiểm tra source code
- `PROGRESS_SUMMARY.md` - Tóm tắt công việc đã làm
- API Docs: http://127.0.0.1:8000/docs (Swagger UI)
- API Docs: http://127.0.0.1:8000/redoc (ReDoc)

---

## 👥 Credits

- **Backend:** FastAPI + PostgreSQL + pgvector
- **AI:** Google Gemini (embedding-001 + 2.0-flash)
- **Frontend:** React + Vite
- **Database:** Supabase
- **Developer:** Kiro AI Assistant

---

## 📞 Support

Nếu có vấn đề:
1. Kiểm tra server đang chạy
2. Xem logs trong terminal
3. Test API với `test_ai_api.py`
4. Kiểm tra database với `check_schema.py`

---

**Version:** 2.1.0  
**Last Updated:** 28/06/2026  
**Status:** ✅ Production Ready (85% features)

🎉 **Auto-crawling tin tức đã hoạt động! Tiết kiệm 100% token cho việc crawling!**
