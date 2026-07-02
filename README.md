# Em Tư News - AI-Powered News & Business Management Platform

Nền tảng quản lý tin tức và doanh nghiệp được hỗ trợ bởi AI, tích hợp RAG (Retrieval-Augmented Generation) cho chatbot thông minh.

---

## 🐳 Quick Start với Docker (Khuyến nghị)

### Yêu cầu
- Docker & Docker Compose
- Port 8000 (Backend), 5173 (Frontend)

### Khởi động

```bash
# 1. Clone repository
git clone https://github.com/hkiet265/backend_demo.git
cd backend_demo

# 2. Copy environment file
cp .env.docker.example .env
# File .env đã có sẵn Supabase credentials và API keys

# 3. Khởi động containers (Backend + Frontend)
docker-compose up -d --build

# 4. Kiểm tra logs
docker logs emtu_backend --tail 30
docker logs emtu_frontend --tail 30

# 5. Test backend
curl http://localhost:8000/health
```

### URLs

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs

### Database

**Supabase PostgreSQL (Shared):**
- ✅ Database đã có sẵn schema và sample data
- ✅ Mọi người dùng chung 1 database
- Region: Tokyo (aws-1-ap-northeast-1)

### Tài khoản mặc định

**Admin:**
- Email: `admin@emtu.vn`
- Password: `admin123`

---

## 📖 Tổng quan

**Em Tư News** là nền tảng AI bao gồm:

### Core Features

#### 🤖 AI Chatbot thông minh
- Trả lời câu hỏi về tin tức bằng tiếng Việt
- RAG (Retrieval-Augmented Generation) với vector search
- Multi-LLM: Groq (llama-3.3-70b) + Google Gemini với auto-fallback
- Auto key rotation: 10 Gemini + 3 Groq keys

#### 📰 Quản lý tin tức tự động
- Auto-crawling mỗi 30 phút từ VTV, VTC, VOV
- Semantic search với vector embeddings (768 dims)
- Lọc theo danh mục
- Bookmark system

#### 🏢 Quản lý doanh nghiệp
- AI tự động chuẩn hóa: Phone, Email, Website, Address
- Phân loại ngành nghề và vùng miền
- Trust scoring
- Import/Export CSV

#### 👥 Hệ thống người dùng
- JWT authentication
- Role-based: Admin & User
- Profile management

#### 📊 Admin Dashboard
- Logfire monitoring realtime
- User & Business management
- API performance metrics

---

## 🛠️ Tech Stack

### Backend
- FastAPI (Python 3.13)
- Supabase PostgreSQL + pgvector
- Groq + Google Gemini (Multi-LLM)
- JWT authentication
- Logfire monitoring

### Frontend
- React 18 + Vite 8.1.0
- Custom CSS (orange #FF8C42)
- Lucide React icons

### DevOps
- Docker + Docker Compose
- Hot-reload development

---
 
**Full Documentation:** http://localhost:8000/docs
 
---
 
## 🚀 Development

### Backend
```bash
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

## 🐛 Troubleshooting

### Backend không start
```bash
docker logs emtu_backend
# Check: Supabase connection, API keys
```

### Frontend không load
```bash
docker logs emtu_frontend
# Check: Node modules, port 5173
```

### Database connection failed
```bash
# Verify Supabase credentials in .env
# Check DB_HOST, DB_USER, DB_PASSWORD
```
