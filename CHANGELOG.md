# Changelog

Tất cả các thay đổi đáng chú ý của dự án **NORTHSTAR Frontend (GrassTouchers-Frontend)** sẽ được ghi lại trong tệp này.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/),
và dự án này tuân thủ [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0-olp2026] - 2026-11-25 (Bản nghiệm thu NORTHSTAR Citizen cho OLP 2026)

### Đã thêm (Added)
- **Citizen Offline-First Platform (`CIT-01`..`CIT-13`):**
  - Chuẩn hóa cấu hình API qua `js/config.js` (`NorthStarApi.fetchJson()`), loại bỏ URL hardcode và rò rỉ PII trong log.
  - Định vị GPS thật kèm vòng tròn sai số MapLibre và bắt buộc xác nhận vị trí trước khi gửi SOS.
  - Tầng lưu trữ `IndexedDB` (`northstar_citizen_db`, 7 Object Stores) và `OfflineSyncManager` với `client_event_id`, SHA-256 idempotency, exponential backoff retry.
  - PWA Service Worker (`sw.js`) đa tầng cache + `manifest-citizen.json` cho phép mở lại `citizen.html` khi mất Internet.
  - Thời tiết & Cảnh báo thiên tai phân tách rõ dữ liệu thật, dự báo AI/ML và cảnh báo chính thức.
  - Báo cáo ngập cộng đồng (kèm ảnh `<= 5MB`, nhãn `[Chờ xác minh]`), định tuyến né ngập A* & sơ tán `/api/route/evacuate` không có thông báo an toàn giả.
  - Tra cứu SOS riêng tư qua `/api/sos/track/{tracking_token}` (che PII) và Trợ lý AI Online/Offline (15 chủ đề sinh tồn Việt Nam).
  - Giao thức SOS Relay (`northstar.sos.relay.v1` với SHA-256 + ECDSA-P256) và kiến trúc `SatelliteGatewayAdapter` 7 trạng thái.
  - Bộ tài liệu kiểm toán & nghiệm thu OLP 2026 (`docs/CITIZEN_FINAL_*.md`).

---

## [1.0.0] - 2026-11-19 (Bản nộp chính thức Olympic Tin học Sinh viên - PMNM)

### Đã thêm (Added)
- **Giant WGS84 Provincial Regions Layer**: Bản đồ ranh giới 26 tỉnh thành miền Bắc chuẩn tọa độ WGS84 từ dữ liệu địa lý mở (Natural Earth / GADM). Cho phép tương tác nhấp chuột trực tiếp vào bất kỳ điểm nào trên địa bàn tỉnh để hiển thị popup tác chiến khí tượng Open-Meteo và chỉ số chất lượng không khí US-EPA AQI thời gian thực.
- **Trung tâm Chỉ huy Điều phối Tác chiến (COP - Common Operating Picture)**: Giao diện trực quan tích hợp đa lớp thông tin: trắc quan thủy văn, trạm cứu hộ, điểm sơ tán, cảnh báo ngập lụt, sạt lở đất.
- **Smart Auto-Dispatch Engine**: Hệ thống thuật toán ma trận tự động gán đội cứu hộ/cano gần nhất tới các điểm SOS khẩn cấp dựa trên bán kính khả dụng và mức độ nghiêm trọng.
- **Incident Audit Docket (Sổ nhật ký tác chiến điện tử)**: Ghi nhận minh bạch mọi thao tác điều động, xác nhận cứu hộ, đồng bộ trạng thái thực địa có mã kiểm toán bất biến.
- **Administrative Sitrep A4 Generator**: Xuất báo cáo tình hình tác chiến khẩn cấp định dạng chuẩn hành chính A4 chuẩn in ấn cho ban chỉ đạo phòng chống thiên tai cấp tỉnh.
- **Citizen Live Tracking Portal**: Cổng thông tin công khai cho phép người dân và thân nhân tra cứu tiến độ tiếp cận của đội cứu hộ theo mã định danh SOS thời gian thực.
- **Offline-First Sync Engine**: Tích hợp Service Worker PWA và lưu trữ đệm IndexedDB/LocalStorage, cho phép cán bộ chỉ huy tiếp tục cập nhật dữ liệu ngoại tuyến khi mất sóng Internet và tự động đồng bộ khi có mạng trở lại.
- **Bộ 4 Kịch bản Trình diễn Diễn tập (Demo Suite)**: Kích hoạt nhanh bằng phím tắt `D` mô phỏng các tình huống thực tế bão Yagi đổ bộ, lũ quét sạt lở, cô lập y tế, và sơ tán diện rộng.

### Đã thay đổi (Changed)
- **Loại bỏ hoàn toàn ô con nhộng (Capsule Chips)**: Khắc phục triệt để lỗi xung đột hiển thị đè nhãn lên các trạm thủy văn quan trắc khi phóng to.
- **Tối ưu hóa bảng điều khiển (Decluttering UI)**: Tinh gọn các thanh công cụ, thống nhất bảng thông tin tác chiến góc phải, hỗ trợ chuyển đổi mượt mà chế độ Sáng/Tối (Light/Dark mode).
- **Chuẩn hóa bản quyền**: 100% tệp mã nguồn gắn thẻ bản quyền mở chuẩn OSI `SPDX-License-Identifier: Apache-2.0`.

### Đã sửa (Fixed)
- Sửa lỗi lệch hệ quy chiếu Highcharts SVG sang hệ tọa độ GPS chuẩn WGS84 (EPSG:4326).
- Sửa lỗi hiển thị trùng lặp popup và tooltip khi nhấp chuột vào đa giác tỉnh.
- Bổ sung cơ chế chống lưu đệm trình duyệt (Cache-busting) cho các tệp tài nguyên tĩnh.

---

## [0.4.0] - 2026-11-15

### Đã thêm (Added)
- Tích hợp biểu đồ thống kê Chart.js cho trạm đo lượng mưa và mực nước cảnh báo lũ.
- Thêm lớp mô phỏng hướng di chuyển bão và hoàn lưu áp thấp nhiệt đới.
- Bổ sung hệ thống âm thanh cảnh báo bằng giọng nói (Voice Warning) khi phát hiện nguy cơ ngập lụt cấp độ báo động 3.

---

## [0.1.0] - 2026-10-20

### Đã thêm (Added)
- Bản phát hành khởi đầu (Initial Prototype) hiển thị bản đồ nền OpenStreetMap bằng Leaflet.
- Tích hợp dữ liệu điểm ngập lịch sử và danh mục trạm trú ẩn tạm thời.
