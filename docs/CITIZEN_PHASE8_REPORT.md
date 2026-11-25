# BÁO CÁO TRIỂN KHAI GIAI ĐOẠN 8 – ĐỊNH TUYẾN NÉ NGẬP VÀ SƠ TÁN AN TOÀN (`CIT-09`)

**Ngày cập nhật:** 2026-11-25  
**Phân hệ:** NORTHSTAR CITIZEN (`GrassTouchers-Frontend`, nhánh `thuan`)  
**Trạng thái nghiệm thu:** `COMPLETED` *(Đạt toàn bộ kiểm thử `ROUTE-01..10` và `EVAC-01..10` trên hợp đồng `citizen.html` và Edge Headless + IndexedDB thật).*

---

## 1. Các thay đổi đã triển khai
- **Định tuyến tránh ngập trung thực ([citizen.html](file:///d:/OpenSource_2026/GrassTouchers-Frontend/citizen.html))**:
  - Loại bỏ tọa độ mặc định Hà Nội ở `#citizen-route-origin` và bỏ `resolveLocation(..., 21.0285, 105.8542)`; bổ sung nút `useRouteOriginGPS()`.
  - Triển khai `classifyRouteStatus()` phân biệt rõ 4 trạng thái:
    - `SAFE_VERIFIED`: Tuyến A* Backend (`safe.found === true`), geometry `LineString` hợp lệ (>= 2 điểm), `flood_sources_used > 0`, `flood_warnings.length === 0`.
    - `REFERENCE_ONLY`: Tuyến fallback OSRM hoặc thiếu dữ liệu ngập (`flood_sources_used === 0`) hoặc dữ liệu ngập cũ — **loại bỏ hoàn toàn thông báo giả `"Né Ngập Thành Công"`**.
    - `UNSAFE`: Có `flood_warnings` / đoạn đường bị ảnh hưởng hoặc tuyến `fastest`.
    - `UNAVAILABLE`: Offline / lỗi API / không tìm được đường / geometry không hợp lệ — không vẽ tuyến giả trên MapLibre.
- **Điểm trú ẩn thật & Định tuyến sơ tán (`loadCitizenShelters`, `findEvacuationRoute`)**:
  - Xóa `renderSampleShelters()`, thay bằng `loadCitizenShelters()` gọi `GET /api/shelters`, lưu cache vào `OfflineDB.shelters_cache` và fallback sang IndexedDB khi offline.
  - Hiển thị tên, địa chỉ, tọa độ, trạng thái (`open`, `full`, `closed`, `unknown`), sức chứa/số người hiện tại, nguồn dữ liệu và ghi chú rõ tiêu chí tiếp cận người khuyết tật/trẻ nhỏ chưa có dữ liệu đánh giá.
  - Tích hợp `POST /api/route/evacuate`, vẽ tuyến bằng MapLibre (`citizen-route-line`), cảnh báo nếu điểm đến `full` hoặc `closed`.
- **Đánh giá bản đồ ngoại tuyến**:
  - Khi offline, Citizen hiển thị danh sách điểm trú ẩn đã cache kèm thời điểm tải, **không** tuyên bố có định tuyến offline vì đồ thị mạng đường (`hanoi_drive.graphml`) và thuật toán A* chạy trên Backend.

---

## 2. Kết quả kiểm thử (Thực thi sau chỉnh sửa cuối)
- **[test_phase8_routing_evacuation.py](file:///d:/OpenSource_2026/GrassTouchers-Frontend/tests/test_phase8_routing_evacuation.py)**: `ROUTE-01..10` và `EVAC-01..10` **PASS** (hợp đồng tĩnh `citizen.html` + Edge Headless + IndexedDB `shelters_cache`).
- **Hồi quy toàn bộ Frontend (`test_phase1`..`test_phase8`)**: **32 tests** — **30 PASS, 2 SKIPPED (`PWA-21/22` thiếu thiết bị vật lý Android/iOS), 0 FAILED**.
