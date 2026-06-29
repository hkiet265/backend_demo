Em Tư News - AI Chatbot & Business Management

Nền tảng quản lý tin tức và doanh nghiệp được hỗ trợ bởi AI, tích hợp RAG (Retrieval-Augmented Generation) cho chatbot thông minh.

Tổng quan

**Em Tư News** là hệ thống kết hợp:
- **AI Chatbot** trả lời về tin tức với công nghệ RAG
- **Quản lý tin tức** tự động crawl từ các nguồn VTV, VTC, VOV
- **Quản lý doanh nghiệp** với AI tự động chuẩn hóa dữ liệu
- **Hệ thống người dùng** với phân quyền Admin/User
- **Admin Dashboard** giám sát hệ thống realtime

---

Tính năng chính

AI Chatbot thông minh
- Trả lời câu hỏi về tin tức bằng tiếng Việt
- RAG (Retrieval-Augmented Generation) với vector search
- Gợi ý hành động thông minh dựa trên ngữ cảnh
- Tích hợp Groq (llama-3.3-70b) và Google Gemini

Tin tức tự động
- Auto-crawling mỗi 15 phút từ các nguồn tin uy tín
- Hỗ trợ tìm kiếm semantic search với embeddings
- Lọc theo danh mục: Thời sự, Kinh tế, Xã hội, Thể thao,...
- Lưu trữ và quản lý tin tức trong database

Quản lý doanh nghiệp
- AI tự động chuẩn hóa: SĐT, email, website, địa chỉ
- Phân loại ngành nghề và vùng miền tự động
- Import/Export dữ liệu CSV
- Tính điểm tin cậy (Trust Score)

Quản lý người dùng
- Đăng ký/Đăng nhập
- Phân quyền: Admin & User
- Quản lý profile cá nhân

Admin Dashboard
- Giám sát hệ thống realtime với Logfire
- Thống kê users, request metrics
- Theo dõi lỗi và hiệu suất
- Quản lý users và phân quyền

---

🚀 Cài đặt & Chạy

1. Backend (FastAPI)

```bash
# Clone và cài đặt dependencies
cd backend_demo
pip install -r requirements.txt

# Chạy server với auto-crawling
start_with_auto_crawl.bat

# Hoặc chạy manual
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Backend URL:** http://127.0.0.1:8000

2. Frontend (React + Vite)

```bash
# Vào thư mục frontend
cd chatbox-news-fe

# Cài đặt dependencies
npm install

# Chạy dev server
npm run dev
```

**Frontend URL:** http://localhost:5173

3. Tài khoản test

**Admin:**
- Email: `admin@emtu.vn`
- Password: `admin123`

**User:**
- Đăng ký tài khoản mới qua giao diện web

---

## 🎨 Giao diện

Trang chủ
- Tìm kiếm tin tức thông minh
- Lọc theo danh mục
- Xem chi tiết tin tức

Chat với AI
- Hỏi đáp về tin tức
- Gợi ý hành động thông minh
- Hiển thị nguồn tin tham khảo

Quản lý doanh nghiệp
- Danh sách doanh nghiệp
- Tìm kiếm và lọc
- Import/Export CSV

Admin Portal
- Dashboard: Tổng quan hệ thống
- Users: Quản lý người dùng
- Logfire Monitoring:Giám sát realtime

---

🛠️ Tech Stack

Backend
- Framework: FastAPI (Python 3.13)
- Database: PostgreSQL + pgvector (Supabase)
- AI/LLM:
  - Groq (llama-3.3-70b-versatile)
  - Google Gemini (embedding + fallback generation)
- Authentication: JWT
- Rate Limiting: slowapi
- Monitoring: Logfire

Frontend
- Framework: React 18 + Vite
- Styling: Custom CSS
- Icons: Lucide React
- HTTP Client: Fetch API

### AI Features
- RAG: Retrieval-Augmented Generation
- Vector Search: pgvector (3072 dimensions)
- Embeddings: Gemini embedding-001
- Generation: Groq + Gemini với auto-fallback
- API Key Rotation: 3 Groq keys tự động

---

📁 Cấu trúc dự án

```
backend_demo/
├── app/
│   ├── main.py                      # FastAPI entry point
│   ├── config.py                    # Configuration
│   ├── api/                         # API endpoints
│   │   ├── auth.py                  # Authentication
│   │   ├── business.py              # Business API
│   │   ├── chat.py                  # Chat API
│   │   ├── news.py                  # News API
│   │   ├── crawler.py               # Crawler API
│   │   └── admin.py                 # Admin API
│   ├── models/                      # Database models
│   ├── services/                    # Business logic
│   │   ├── chat_service.py
│   │   ├── rag_service.py
│   │   ├── embedding_service.py
│   │   ├── groq_service.py
│   │   ├── vector_service.py
│   │   ├── news_crawler_service.py
│   │   └── ai_enrichment_service.py
│   └── middleware/                  # Middleware
│       └── rate_limiter.py
├── chatbox-news-fe/                 # React frontend
│   ├── src/
│   │   ├── App.jsx                  # Main app
│   │   ├── components/              # UI components
│   │   │   ├── ChatControlView.jsx
│   │   │   ├── NewsStorageView.jsx
│   │   │   ├── BusinessManagementView.jsx
│   │   │   ├── AuthView.jsx
│   │   │   └── EditProfileView.jsx
│   │   └── pages/
│   │       └── AdminPortal.jsx      # Admin dashboard
│   └── package.json
├── .env                             # Environment variables
├── requirements.txt                 # Python dependencies
└── README.md
```

---

🔑 API Endpoints

 Authentication
- `POST /api/auth/register` - Đăng ký tài khoản
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/me` - Thông tin user hiện tại
- `PUT /api/auth/me` - Cập nhật profile

Chat
- `POST /api/chat/message` - Chat với AI

News
- `GET /api/news` - Danh sách tin tức
- `GET /api/news/search` - Tìm kiếm tin tức
- `GET /api/news/{id}` - Chi tiết tin tức
- `GET /api/news/categories` - Danh mục tin tức

Business
- `GET /api/businesses` - Danh sách doanh nghiệp
- `GET /api/businesses/search` - Tìm kiếm doanh nghiệp
- `POST /api/businesses` - Tạo doanh nghiệp
- `PUT /api/businesses/{id}` - Cập nhật doanh nghiệp
- `DELETE /api/businesses/{id}` - Xóa doanh nghiệp
- `GET /api/businesses/export/csv` - Export CSV

Crawler
- `POST /api/crawler/start` - Chạy crawler
- `GET /api/crawler/stats` - Thống kê crawler

Admin
- `GET /api/admin/users` - Danh sách users
- `GET /api/admin/stats` - Thống kê hệ thống
- `GET /api/admin/monitoring` - Logfire metrics

API Documentation: http://127.0.0.1:8000/docs

---

🔐 Bảo mật

- JWT authentication với token expiry
- Password hashing với bcrypt
- Rate limiting cho API endpoints
- CORS configuration cho frontend
- Input validation với Pydantic
- SQL injection protection với parameterized queries

---

📊 Database Schema

Users
- Quản lý tài khoản người dùng
- Role-based access control (Admin/User)
- Profile information

Station_news
- Lưu trữ tin tức từ crawler
- Vector embeddings (3072 dims)
- Metadata: nguồn, danh mục, thời gian

Businesses_demo
- Thông tin doanh nghiệp
- AI-enriched data
- Trust score & classification

---

🎯 Tính năng nổi bật
1. Auto-crawling thông minh
- Chạy tự động mỗi 15 phút
- Tránh duplicate với hash checking
- Generate embeddings tự động
- Tiết kiệm 100% token cho crawling

2. RAG Chat System
- Tìm kiếm tin tức liên quan với vector similarity
- Tổng hợp thông tin từ nhiều nguồn
- Trả lời bằng ngôn ngữ tự nhiên
- Cite nguồn tin chính xác

3. AI Data Enrichment
- Chuẩn hóa số điện thoại (+84 format)
- Normalize email & website
- Tự động phân loại ngành nghề
- Suy luận vùng miền từ địa chỉ

4. Admin Dashboard
- Real-time monitoring với Logfire
- User management
- System health check
- Performance metrics