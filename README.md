# Em Tư News - AI-Powered News & Business Management Platform

Nền tảng quản lý tin tức và doanh nghiệp được hỗ trợ bởi AI, tích hợp RAG (Retrieval-Augmented Generation) cho chatbot thông minh.

---

## 🐳 Quick Start với Docker (Khuyến nghị)

### Yêu cầu
- Docker & Docker Compose
- Port 5432 (PostgreSQL), 8000 (Backend), 5173 (Frontend)

### Khởi động

```bash
# 1. Clone repository
git clone <repo-url>
cd backend_demo

# 2. Copy và cấu hình environment variables
cp .env.docker.example .env

# 3. Khởi động toàn bộ hệ thống (PostgreSQL + Backend + Frontend)
docker-compose up -d --build

# 4. Khởi tạo database và dữ liệu mẫu
docker exec -i emtu_postgres psql -U postgres -d emtu_db < scripts/init_database.sql


### URLs

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs

**Admin Account:**
- Email: `admin@emtu.vn`
- Password: `admin123`

## 📖 Tổng quan

**Em Tư News** là nền tảng AI bao gồm:

### Core Features

AI Chatbot thông minh
- Trả lời câu hỏi về tin tức bằng tiếng Việt
- RAG (Retrieval-Augmented Generation) với vector search
- Multi-LLM: Groq (llama-3.3-70b) + Google Gemini với auto-fallback

#### 📰 Quản lý tin tức tự động
- Auto-crawling mỗi 30 phút từ VTV, VTC, VOV
- Semantic search với vector embeddings (768 dims)
- Lọc theo danh mục: Thời sự, Kinh tế, Xã hội, Thể thao, Giải trí, Công nghệ
- Dedupe thông minh với content hashing
- Bookmark và favorite system

#### 🏢 Quản lý doanh nghiệp
- AI tự động chuẩn hóa: Phone (+84), Email, Website, Address
- Phân loại ngành nghề và vùng miền tự động
- Trust scoring system
- Import/Export CSV
- User-specific business management

#### 👥 Hệ thống người dùng
- Authentication với JWT (30 ngày expiry)
- Role-based access: Admin & User
- Profile management

#### 📊 Admin Dashboard
- System monitoring realtime với Logfire
- User management
- Business & News management
- Database statistics & health checks
- API performance metrics

---

## 🛠️ Tech Stack

### Backend
- **Framework:** FastAPI (Python 3.13)
- **Database:** PostgreSQL 16 + pgvector
- **AI/LLM:**
  - Groq API (llama-3.3-70b-versatile) - Primary generation
  - Google Gemini (text-embedding-004 + gemini-1.5-flash)
  - Auto key rotation: 10 Gemini keys + 3 Groq keys
- **Authentication:** JWT with HS256
- **Rate Limiting:** slowapi
- **Monitoring:** Logfire (Pydantic)
- **Vector Search:** pgvector (768 dimensions)

### Frontend
- **Framework:** React 18 + Vite 8.1.0
- **Styling:** Custom CSS (orange theme #FF8C42)
- **Icons:** Lucide React
- **Router:** React Router v6

### DevOps
- **Containerization:** Docker + Docker Compose
- **Development:** Hot-reload (Vite + Uvicorn)

---

## 🚀 Development

### Backend Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run with hot-reload
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend Development

```bash

cd chatbox-news-fe

# Install dependencies
npm install

# Run dev server
npm run dev
```

### Database Management

```bash
# Access PostgreSQL
docker exec -it emtu_postgres psql -U postgres -d emtu_db

# Run migration
docker exec -i emtu_postgres psql -U postgres -d emtu_db < scripts/init_database.sql

# Backup database
docker exec emtu_postgres pg_dump -U postgres emtu_db > backup.sql
```