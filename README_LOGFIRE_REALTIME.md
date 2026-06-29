# 🔥 Logfire Real-time Monitoring - Quick Start

## ✅ Đã hoàn thành

Đã tích hợp **Logfire Query API** để admin dashboard hiển thị **metrics thực** thay vì dữ liệu mô phỏng.

## 🎯 BẠN CẦN LÀM (3 bước đơn giản)

### 1️⃣ Tạo Read Token từ Logfire

**Cách làm:**
1. Vào https://logfire.pydantic.dev/
2. Login → Chọn project **kiethk/emtu**
3. Click **⚙️ Settings** → **Read tokens** → **Create read token**
4. **Copy token** (chỉ hiển thị 1 lần!)

### 2️⃣ Thêm token vào `.env`

Mở file `.env` và điền token:

```env
LOGFIRE_READ_TOKEN=lfr_your_copied_token_here
```

### 3️⃣ Restart server & kiểm tra

```bash
# Test connection
python test_logfire_connection.py

# Restart server
python -m uvicorn app.main:app --reload
```

## ✨ Kết quả

Mở http://localhost:5173/admin → Tab **Logfire Monitoring**

**Trước:**
```
🔥 Logfire Monitoring
Real-time system monitoring & performance analytics
● Not Connected (Using fallback data)
```

**Sau (khi có token):**
```
🔥 Logfire Monitoring  
Real-time system monitoring & performance analytics
● Connected
```

## 📊 Metrics Real-time

Khi connected, bạn sẽ thấy:
- ✅ **Total Requests**: Số request thực từ Logfire logs (không phải mô phỏng)
- ✅ **Avg Response Time**: Thời gian phản hồi thực tế
- ✅ **Error Rate**: Tỷ lệ lỗi thực từ production
- ✅ **Top Endpoints**: 5 API được gọi nhiều nhất
- ✅ **Recent Errors**: Lỗi mới nhất với timestamp chính xác
- ✅ **System Health**: Status dựa trên error count thực

## 📖 Chi tiết hơn

- **Setup Guide**: `LOGFIRE_SETUP.md`
- **Implementation Summary**: `REALTIME_MONITORING_SUMMARY.md`
- **Next Steps**: `NEXT_STEPS.md`

## ❓ Troubleshooting

```bash
# Test xem token có hoạt động không
python test_logfire_connection.py
```

**Nếu lỗi:**
- ❌ "Token not found" → Chưa thêm vào `.env`
- ❌ "401 Unauthorized" → Token không hợp lệ
- ❌ "403 Forbidden" → Token không có quyền project

## 🎉 Auto-refresh

Metrics tự động cập nhật mỗi **30 giây** khi bạn mở tab Logfire Monitoring!

---

**Quick Summary**: Tạo token → Thêm vào .env → Restart → Done! ✅
