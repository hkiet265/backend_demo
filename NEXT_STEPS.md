# 🎯 Các bước tiếp theo để enable Real-time Logfire Monitoring

## ✅ Đã hoàn thành

1. ✅ Tạo `logfire_service.py` - Service query Logfire API
2. ✅ Cập nhật `config.py` - Thêm `LOGFIRE_READ_TOKEN` setting
3. ✅ Cập nhật `admin.py` - Sử dụng Logfire service thực
4. ✅ Cập nhật `LogfireView.jsx` - Hiển thị status connected/not connected
5. ✅ Cài đặt `httpx` - HTTP client cho Logfire API
6. ✅ Tạo documentation - `LOGFIRE_SETUP.md`

## 🔥 Bước tiếp theo (BẠN CẦN LÀM)

### 1. Tạo Read Token từ Logfire

**Option A: Via Web Interface (Dễ nhất)**

1. Mở https://logfire.pydantic.dev/
2. Login vào account của bạn
3. Chọn project **kiethk/emtu** từ sidebar trái
4. Click **⚙️ Settings** (góc trên bên phải)
5. Click **Read tokens** trong menu trái
6. Click **Create read token**
7. **Copy token** (chỉ hiển thị 1 lần!)

**Option B: Via CLI**

```bash
logfire read-tokens --project kiethk/emtu create
```

### 2. Thêm token vào `.env`

Mở file `.env` và thêm dòng sau:

```env
LOGFIRE_READ_TOKEN=lfr_1234567890abcdefghijklmnopqrstuvwxyz
```

### 3. Restart server

```bash
# Stop server hiện tại (Ctrl+C)
# Sau đó chạy lại:
python -m uvicorn app.main:app --reload
```

### 4. Kiểm tra kết quả

1. Mở http://localhost:5173/admin
2. Login với **admin@emtu.vn** / **admin123**
3. Vào tab **Logfire Monitoring**
4. Xem status:
   - ✅ **● Connected** = Đã kết nối, data real-time từ Logfire
   - ⚠️ **● Not Connected** = Chưa có token, đang dùng fallback data

## 📊 Metrics Real-time từ Logfire

Khi đã connected, bạn sẽ thấy:

### API Performance
- **Total Requests**: Số request thực từ Logfire logs
- **Avg Response Time**: Thời gian phản hồi trung bình (ms)
- **Error Rate**: Tỷ lệ lỗi (%)
- **Top Endpoints**: 5 endpoints được gọi nhiều nhất

### Error Tracking
- **Recent Errors**: Lỗi mới nhất từ Logfire
- **Warning**: Cảnh báo từ system
- **Timestamp**: Thời gian chính xác
- **Endpoint**: API nào gây lỗi

### System Health
- **Database**: Healthy/Warning
- **Groq API**: Healthy/Disabled
- **Crawler**: Active/Stopped
- **Uptime**: System uptime

## 🔍 Debug Issues

### Issue 1: "Logfire read token not configured"
**Solution**: Chưa thêm `LOGFIRE_READ_TOKEN` vào `.env`

### Issue 2: "API error: 401 Unauthorized"
**Solution**: Token không hợp lệ, tạo token mới từ Logfire

### Issue 3: "API error: 403 Forbidden"
**Solution**: Token không có quyền đọc project `kiethk/emtu`

### Issue 4: Connection timeout
**Solution**: 
- Kiểm tra internet connection
- Kiểm tra Logfire service status
- Thử lại sau vài phút

## 📖 Tài liệu tham khảo

- **Setup Guide**: `LOGFIRE_SETUP.md`
- **Logfire API Docs**: https://logfire.pydantic.dev/docs/how-to-guides/query-api/
- **SQL Reference**: https://logfire.pydantic.dev/docs/reference/sql/

## 🎉 Khi hoàn thành

Sau khi setup xong, bạn sẽ có:

1. ✅ **Real-time monitoring** - Metrics thực từ Logfire, không phải simulated
2. ✅ **Auto-refresh** - Tự động cập nhật mỗi 30 giây
3. ✅ **Error tracking** - Xem lỗi thực tế từ production
4. ✅ **Performance analytics** - Response time, request count thực
5. ✅ **Fallback support** - Nếu Logfire down, vẫn hiển thị database metrics

---

**Next**: Sau khi có token, restart server và kiểm tra admin dashboard!
