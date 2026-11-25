# BÁO CÁO TRIỂN KHAI GIAI ĐOẠN 7 – BÁO CÁO NGẬP LỤT TỪ CỘNG ĐỒNG (`CIT-08`)

**Ngày cập nhật:** 2026-11-25  
**Phân hệ:** NORTHSTAR CITIZEN (`GrassTouchers-Frontend` & `GrassToucher-backend`, nhánh `thuan`)  
**Trạng thái nghiệm thu:** `COMPLETED` *(Đạt toàn bộ 15 kịch bản `FLOOD-01..FLOOD-15` trên Edge Headless + IndexedDB thật, hồi quy Frontend & Backend; ghi nhận rõ giới hạn Backend chưa có endpoint upload file ảnh nhị phân).*

---

## 1. Các thay đổi đã triển khai
- **Loại bỏ tọa độ mặc định trong báo cáo ngập (`citizen.html`)**:
  - Xóa `value="21.0285"` / `value="105.8030"` ở `#citizen-report-lat`, `#citizen-report-lng` và bỏ fallback `|| 21.0285`, `|| 105.8030` trong `submitFloodReport()`.
  - Hỗ trợ lấy GPS (`useReportCurrentLocation()`) và chọn thủ công trên bản đồ (`startPickingReportLocation()`), ghi nhận `location_source` (`gps` | `manual`).
- **Biểu mẫu chi tiết & Tùy chọn linh hoạt (`citizen.html`)**:
  - Phân loại mức độ cộng đồng (`light`, `medium`, `heavy`) kèm mô tả rõ đây là báo cáo cộng đồng (`[Chờ xác minh]`), không phải kết luận chính thức.
  - Các trường ngữ cảnh tùy chọn (`#citizen-report-flow`, `#citizen-report-mobility`, `#citizen-report-vehicle`, `#citizen-report-desc`) không bắt buộc khi người dân đang trong tình huống khẩn cấp.
- **Kiểm tra & Lưu cục bộ ảnh hiện trường (`handleReportPhotoSelected`)**:
  - Kiểm tra định dạng (`JPEG`, `PNG`, `WEBP`) và dung lượng tối đa `5 MB`, nén ảnh qua `<canvas>` (tối đa `800px` JPEG) và lưu Blob cục bộ trong IndexedDB (`flood_reports`).
  - Thông báo trung thực giới hạn: Backend `/api/reports` hiện chỉ nhận `photo_url` (`max_length=500`), chưa có endpoint upload ảnh nhị phân, nên không gửi URL ảnh giả.
- **Thống nhất Outbox & Trạng thái báo cáo (`OfflineSyncManager` + `OfflineDB.flood_reports`)**:
  - Đưa báo cáo offline vào `flood_reports` với `local_id`, `client_event_id`, `sync_status: PENDING_OFFLINE`, đồng bộ tự động qua `OfflineSyncManager`.
  - Hiển thị lịch sử báo cáo với các trạng thái: `PENDING`, `SYNCING`, `PENDING_VERIFICATION`, `VERIFIED`, `REJECTED`.
- **Bản đồ cộng đồng & Bảo vệ người gửi (`loadCommunityReports`, `reports.py`)**:
  - Sửa marker bản đồ từ nhãn `SOS` sang `NGẬP` (phân biệt màu cam `[Chờ xác minh]` và xanh lục `[Đã xác minh]`), hiển thị rõ `"Nguồn: Báo cáo do người dân gửi"` và thời gian ghi nhận `created_at`.
  - Sửa fallback trong `app/routers/reports.py` (`bool(r.get("confirmed", False))`) để không mặc định `confirmed=True`.
  - Không thu thập số điện thoại hoặc gắn thông tin SOS vào báo cáo ngập.

---

## 2. Kết quả kiểm thử (Thực thi sau chỉnh sửa cuối)
- **Frontend (`tests/test_phase7_flood_reports.py` & toàn bộ hồi quy)**:
  - `FLOOD-01..FLOOD-15`: **PASS** trên Edge Headless + IndexedDB thật + kiểm tra DOM `citizen.html` (bao gồm reload trình duyệt giữ nguyên báo cáo offline, từ chối thiếu tọa độ, kiểm tra giới hạn ảnh 5MB, idempotency, không lộ PII SĐT).
  - Hồi quy `CIT-01..CIT-07`: **PASS** (chỉ `PWA-21/22` `SKIPPED` do không có thiết bị Android/iOS thật).
- **Backend (`tests/test_phase4_idempotency.py`, `tests/test_all_endpoints.py`)**: **PASS** trên SQLite fallback & API endpoints (`TestPhase4PostgresLiveIdempotency` `SKIPPED` do `.env` cục bộ chưa xác thực được PostgreSQL).
