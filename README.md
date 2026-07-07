# Company News - AI-Powered News & Business Management Platform

Nền tảng quản lý tin tức và doanh nghiệp được hỗ trợ bởi AI, tích hợp RAG (Retrieval-Augmented Generation) cho chatbot thông minh.

---

## 🐳 Quick Start với Docker (Khuyến nghị)

### Yêu cầu
- Docker Desktop (Windows/Mac) hoặc Docker Engine + Docker Compose (Linux)
- Port 8000 (Backend) và 5173 (Frontend) phải trống
- Git để clone repository

### Khởi động

```bash
git clone https://github.com/hkiet265/backend_demo.git
cd backend_demo
cp .env.docker.example .env
docker-compose up -d --build
```

Chờ 30-60 giây để containers khởi động, sau đó truy cập:

### URLs

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs

### Database

**Supabase PostgreSQL (Shared):**
- ✅ Database đã có sẵn schema và sample data (939 tin tức)
- ✅ Tất cả cộng tác viên dùng chung 1 database
- ✅ Không cần setup database riêng
- Region: Tokyo (aws-1-ap-northeast-1)

### Tài khoản đăng nhập

**Admin:**
- Email: `admin@emtu.vn`
- Password: `admin123`

---

## 📖 Tổng quan

**Company News** là nền tảng AI bao gồm:

### Core Features

#### 🤖 AI Chatbot thông minh
- Trả lời câu hỏi về tin tức bằng tiếng Việt
- RAG (Retrieval-Augmented Generation) với vector search (768 dims)
- Multi-LLM: Groq (llama-3.3-70b) + Google Gemini với auto-fallback
- Auto key rotation: 10 Gemini + 3 Groq keys

#### 📰 Quản lý tin tức tự động
- Auto-crawling RSS feeds mỗi 30 phút (VTV, VTC, VOV)
- Semantic search với vector embeddings
- Lọc theo: Danh mục, Vùng miền, Thời gian
- Bookmark/Favorite system
- Duplicate detection

#### 🏢 Quản lý doanh nghiệp
- AI tự động chuẩn hóa: Phone, Email, Website, Address
- Phân loại ngành nghề và vùng miền tự động
- Trust scoring (độ tin cậy 0-10)
- Import/Export CSV
- Smart search với NER

#### 👥 Hệ thống người dùng
- JWT authentication (30 days expiration)
- SHA256 password hashing
- Role-based: Admin & User
- Profile management

#### 📊 Admin Dashboard
- Logfire monitoring realtime
- User & Business management
- News moderation
- System metrics

---

## 🛠️ Tech Stack

### Backend
- FastAPI (Python 3.13)
- Supabase PostgreSQL + pgvector
- Groq + Google Gemini (Multi-LLM)
- JWT authentication + SHA256
- Logfire monitoring

### Frontend
- React 18 + Vite 8.1.0
- Custom CSS (Orange #FF8C42)
- Lucide React icons

### DevOps
- Docker + Docker Compose
- Hot-reload development

---

## 🚀 Development Mode (Không dùng Docker)

### Backend
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

### Frontend
```bash
cd chatbox-news-fe
npm install
npm run dev
```

---

## 📝 Lệnh Docker hữu ích

```bash
docker-compose ps              # Xem trạng thái containers
docker logs emtu_backend       # Xem logs backend
docker logs emtu_frontend      # Xem logs frontend
docker-compose restart         # Restart containers
docker-compose down            # Stop và xóa containers
docker-compose up -d --build   # Rebuild containers
```

---

## 🐛 Troubleshooting

### Backend không start
- Xem logs: `docker logs emtu_backend`
- Kiểm tra Supabase credentials trong .env
- Kiểm tra port 8000 có bị chiếm không

### Frontend không load
- Xem logs: `docker logs emtu_frontend`
- Kiểm tra backend đã chạy: `curl http://localhost:8000/health`
- Kiểm tra port 5173 có bị chiếm không

### Database connection failed
- Verify DB_HOST, DB_USER, DB_PASSWORD trong .env
- Test connection: `telnet [DB_HOST] 6543`

### Rebuild hoàn toàn
```bash
docker-compose down
docker-compose up -d --build
```

---

## 📚 Documentation

Xem đầy đủ API documentation tại: http://localhost:8000/docs

---
