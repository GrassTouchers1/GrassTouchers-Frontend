# BÁO CÁO TRIỂN KHAI GIAI ĐOẠN 4 – OFFLINE SYNC, RETRY & IDEMPOTENCY (`CIT-05`)

**Ngày cập nhật:** 2026-11-25  
**Phân hệ:** NORTHSTAR CITIZEN (`GrassTouchers-Frontend` & `GrassToucher-backend`, nhánh `thuan`)  
**Trạng thái nghiệm thu:** `TESTING` *(Đạt toàn bộ kiểm thử Frontend Edge Headless IndexedDB và Backend SQLite Fallback + Alembic `--sql`; kiểm thử trực tiếp trên PostgreSQL live đang `SKIPPED` do thông tin xác thực `.env` cục bộ chưa kết nối được PostgreSQL).*

---

## 1. Tóm tắt kiến trúc đã triển khai

### 1.1. Backend Idempotency (`GrassToucher-backend`)
- **Schema (`app/schemas.py`)**: Bổ sung `client_event_id: Optional[str] = Field(default=None, min_length=8, max_length=100)` cho `ReportCreate` và `SOSCreate`.
- **Alembic Migration (`db/alembic/versions/0004_idempotency_client_event_id.py`)**:
  - `down_revision = '0003_nullable_sos_geom'`.
  - Thêm cột `client_event_id TEXT` và `payload_hash TEXT` vào `community_sos` và `reports`.
  - Tạo partial unique index `uq_community_sos_client_event_id` và `uq_reports_client_event_id` (`WHERE client_event_id IS NOT NULL`), kèm `downgrade()` an toàn.
- **PostgreSQL & SQLite Fallback (`app/routers/sos.py`, `app/routers/reports.py`, `app/fallback_storage.py`)**:
  - Tính `payload_hash` (SHA-256) trên payload chuẩn tắc (`compute_sos_payload_hash`, `compute_report_payload_hash`).
  - Trùng `client_event_id` + cùng `payload_hash`: trả về bản ghi hiện có với `idempotent_replay: true` (không tạo bản ghi trùng).
  - Trùng `client_event_id` + khác `payload_hash`: trả về `HTTP 409 Conflict` (`IdempotencyConflictError`), giữ nguyên bản ghi gốc.
  - Bắt `UniqueViolation` trên PostgreSQL và khóa luồng `_FALLBACK_WRITE_LOCK` trên SQLite khi nhiều request đồng thời gửi cùng `client_event_id`.

### 1.2. Frontend Outbox & Sync Engine (`GrassTouchers-Frontend`)
- **Unified Outbox (`js/offline_sync_manager.js`)**:
  - Sử dụng `OfflineDB` (`northstar_citizen_db`: `sos_queue`, `flood_reports`, `sync_metadata`) làm nguồn dữ liệu duy nhất; di chuyển hàng đợi cũ từ `localStorage` (`northstar_offline_sync_queue`) sang IndexedDB và xóa khóa cũ.
  - Sinh `client_event_id` ổn định một lần (`crypto.randomUUID()` với fallback), giữ nguyên qua reload/timeout/retry.
  - Phân loại lỗi: thử lại (`NETWORK`, `TIMEOUT`, `ABORTED`, `408`, `429` tôn trọng `Retry-After`, `5xx`) theo backoff lũy tiến + jitter (`2s, 5s, 15s, 30s, 60s`, tối đa 5 lần); dừng ngay và chuyển `FAILED` đối với lỗi vĩnh viễn (`400`, `401`, `403`, `404`, `409`, `422`).
  - Phục hồi bản ghi kẹt `SENDING` quá `30s` (`recoverStuckSending`) khi khởi động về `PENDING_OFFLINE` mà không đổi `client_event_id`.
  - Chống gửi trùng trong tab (in-tab mutex `_syncPromise`) và giữa các tab (`localStorage` `northstar_sync_tab_lock` có TTL `20s`).
  - Chỉ chuyển `ACKNOWLEDGED` khi máy chủ trả về `id` số hợp lệ; lưu `server_id`, `acknowledged_at`, không xóa bản ghi SOS.
- **Tích hợp Citizen UI & Flow (`citizen.html`, `js/rescue_manager.js`)**:
  - Cập nhật trạng thái đồng bộ trên header Citizen (`#citizen-network-status`, `#citizen-sync-pending-badge`, `#citizen-sync-status-text`, `#btn-citizen-manual-sync`).
  - `submitSOSBeacon()` và `submitFloodReport()` gắn `client_event_id`, ghi nhận `ACKNOWLEDGED` vào `OfflineDB` khi gửi online thành công, hoặc đưa vào hàng đợi `PENDING_OFFLINE` khi ngoại tuyến/lỗi tạm thời.

---

## 2. Kết quả kiểm thử (Thực thi sau chỉnh sửa cuối)

### 2.1. Alembic Migration `--sql`
- `.\venv\Scripts\alembic.exe upgrade 0003_nullable_sos_geom:0004_idempotency_client_event_id --sql`: **PASS** (exit code 0).
- `.\venv\Scripts\alembic.exe downgrade 0004_idempotency_client_event_id:0003_nullable_sos_geom --sql`: **PASS** (exit code 0).

### 2.2. Backend (`tests/test_phase4_idempotency.py`, `tests/test_all_endpoints.py`, `tests/test_postgis_sos.py`)
- Tổng cộng **31 tests** trong `8.629s`: **28 PASS, 3 SKIPPED, 0 FAILED**.
  - `test_phase4_idempotency.py` (SQLite Fallback): **5/5 PASS** (idempotent replay, 409 conflict, concurrent `ThreadPoolExecutor` 6 luồng cho `/api/sos` và `/api/reports`).
  - `test_postgres_live_idempotency`: **SKIPPED** (`PostgreSQL live DB is unavailable in local environment (.env auth/connection)`).
  - `test_all_endpoints.py` + `test_postgis_sos.py`: **23 PASS, 2 SKIPPED** (PG live tests skipped).

### 2.3. Frontend (`tests/test_phase4_offline_sync.py` & toàn bộ hồi quy)
- Tổng cộng **21 tests** trong `8.800s`: **21/21 PASS, 0 FAILED**:
  - `test_phase4_offline_sync.py` (`SYNC-01..SYNC-22` trên IndexedDB thật của Edge Headless): **PASS**.
  - `test_phase1_config_api.py` (4/4): **PASS**.
  - `test_phase2_gps_sos.py` (3/3): **PASS**.
  - `test_offline_db.py` (`DB-01..DB-20`): **PASS**.
  - `test_compliance_audit.py` (4/4): **PASS**.
  - `test_citizen_workflow.py` (8/8): **PASS**.

---

## 3. Hạng mục chờ nghiệm thu bổ sung trước khi đóng `COMPLETED`
- Chạy `alembic upgrade head` và thực thi `TestPhase4PostgresLiveIdempotency` trên môi trường PostgreSQL/PostGIS có thông tin xác thực hợp lệ để xác nhận `uq_community_sos_client_event_id` và `uq_reports_client_event_id` trực tiếp trên PostgreSQL live.
