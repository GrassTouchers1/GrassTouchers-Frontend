# BÁO CÁO TRIỂN KHAI GIAI ĐOẠN 9 – THEO DÕI SOS VÀ BẢO VỆ THÔNG TIN CÁ NHÂN (`CIT-10`)

**Ngày cập nhật:** 2026-11-25  
**Phân hệ:** NORTHSTAR CITIZEN (`GrassTouchers-Frontend` & `GrassToucher-backend`, nhánh `thuan`)  
**Trạng thái nghiệm thu:** `TESTING` *(Đạt toàn bộ kiểm thử bảo mật Backend `TRACK-01..10` trên SQLite fallback + `TestClient`, Alembic `0005 --sql`, và Frontend `TRACK-11..14`; kiểm thử trực tiếp trên PostgreSQL live đang `SKIPPED` do `.env` cục bộ chưa xác thực được PostgreSQL).*

---

## 1. Các thay đổi đã triển khai

### Backend (`GrassToucher-backend`)
- **[0005_sos_tracking_token.py](file:///d:/OpenSource_2026/GrassToucher-backend/db/alembic/versions/0005_sos_tracking_token.py)**: Migration thêm `tracking_token_hash TEXT`, `tracking_token_expires_at TIMESTAMPTZ`, `tracking_token_revoked INTEGER DEFAULT 0` và partial unique index `uq_community_sos_tracking_token_hash` vào `community_sos`.
- **[fallback_storage.py](file:///d:/OpenSource_2026/GrassToucher-backend/app/fallback_storage.py)**: Đồng bộ các cột tracking token trên SQLite fallback + hàm `get_fallback_sos_by_token_hash()`, `revoke_fallback_sos_token()`.
- **[sos.py](file:///d:/OpenSource_2026/GrassToucher-backend/app/routers/sos.py)**:
  - `POST /api/sos` sinh `tracking_token = secrets.token_urlsafe(24)`, chỉ lưu `SHA-256` hash (`tracking_token_hash`) kèm hạn sử dụng 7 ngày (`tracking_token_expires_at`), trả `tracking_token` một lần khi tạo mới.
  - `GET /api/sos/track/{tracking_token}`: rate limit (`20` req/`60s` -> `429`), kiểm tra hết hạn (`410`) và thu hồi/không hợp lệ (`404` thống nhất), chuẩn hóa trạng thái (`RECEIVED`, `VERIFIED`, `DISPATCHED`, `RESCUED`, `CANCELLED`) và **chỉ trả thông tin tối thiểu** (`ticket_code`, `status`, `guidance`, `progress_confirmed`, `received_at`, `updated_at`, `source`) — tuyệt đối không trả `phone`, `contact_name`, `lat`, `lng`, `notes`, `people_count` hay dữ liệu nạn nhân khác.
  - `POST /api/sos/track/{tracking_token}/revoke`: cho phép thu hồi token.
  - `GET /api/sos`: chặn request từ Citizen (`X-NorthStar-Client: citizen` -> `HTTP 403 Forbidden`).

### Frontend (`GrassTouchers-Frontend`)
- **[rescue_manager.js](file:///d:/OpenSource_2026/GrassTouchers-Frontend/js/rescue_manager.js)**: Lưu `tracking_token` vào IndexedDB (`OfflineDB.sos_queue`) thay vì `localStorage`.
- **[citizen.html](file:///d:/OpenSource_2026/GrassTouchers-Frontend/citizen.html)**: Loại bỏ `#SOS-2026-0001` và trạng thái giả `ĐANG ĐIỀU PHỐI ĐỘI CỨU HỘ`; `trackTicket()` gọi `GET /api/sos/track/{tracking_token}`, hỗ trợ thu hồi token (`revokeCurrentTrackingToken()`), và khi offline chỉ hiển thị cache cũ kèm nhãn `CACHE NGOẠI TUYẾN`.

---

## 2. Kết quả kiểm thử (Thực thi sau chỉnh sửa cuối)
- **Alembic `0005` `--sql`**: **PASS** (exit code 0).
- **Backend (`test_phase9_sos_tracking.py` + hồi quy)**: **PASS** toàn bộ `TRACK-01..10` trên SQLite fallback + `TestClient` (PostgreSQL live tests `SKIPPED` do `.env` cục bộ).
- **Frontend (`test_phase9_sos_tracking.py` + hồi quy)**: **PASS** toàn bộ `TRACK-11..14` và hồi quy `CIT-01..CIT-09` (`PWA-21/22` `SKIPPED` thiếu thiết bị vật lý).
