# BÁO CÁO TRIỂN KHAI GIAI ĐOẠN 6 – THỜI TIẾT VÀ CẢNH BÁO THIÊN TAI (`CIT-07`)

**Ngày cập nhật:** 2026-11-25  
**Phân hệ:** NORTHSTAR CITIZEN (`GrassTouchers-Frontend`, nhánh `thuan`)  
**Trạng thái nghiệm thu:** `COMPLETED` *(Toàn bộ nhóm kiểm thử `WT-01..09`, `AL-01..09`, `INT-01..08` đã PASS trên Edge Headless + IndexedDB thật; hồi quy `CIT-01..CIT-06` PASS).*

---

## 1. Hiện trạng trước khi triển khai
- `js/citizen_portal.js` gọi Open-Meteo với tọa độ mặc định Hà Nội, gắn cứng `cache_key: 'hanoi_current'` và `region: 'Hà Nội'`.
- Khi thiếu trường dữ liệu (`null`/`undefined`), `renderWeather()` tự điền giá trị giả (`?? 28`, `?? 80`, `?? 12`).
- Khi API thời tiết lỗi (`renderWeatherFallback()`), giao diện hiển thị dữ liệu mẫu giả (`27°C - 30°C`, `45 - 80 mm`, `85%`).
- Khi `/api/disasters` lỗi, `loadDisasterAlerts()` tự tạo 2 cảnh báo giả với `issued_at: new Date().toISOString()` và gán nguồn `NCHMF`.
- `renderWeatherOffline()` không đọc từ `OfflineDB.weather_cache` / `disaster_cache`, cũng chưa phân loại cảnh báo hết hạn (`expired`), thu hồi (`revoked`), hay tách riêng dự báo mô hình AI/ML (`/api/predictions`).

---

## 2. Danh sách API đã khảo sát & tích hợp
| API / Nguồn | Method & URL | Tham số | Đơn vị & Trường chính | Nguồn dữ liệu |
|---|---|---|---|---|
| **Open-Meteo Weather API** | `GET https://api.open-meteo.com/v1/forecast` | `latitude`, `longitude`, `current=...`, `hourly=...`, `timezone=Asia/Bangkok` | `temperature_2m` (`°C`), `apparent_temperature` (`°C`), `relative_humidity_2m` (`%`), `rain`/`precipitation` (`mm`), `wind_speed_10m` (`km/h`), `weather_code`, `current.time` | Open-Meteo (CC-BY 4.0) |
| **NORTHSTAR Disasters API** | `GET /api/disasters?active_only=false` | `active_only=false` | GeoJSON `FeatureCollection`: `title`, `hazard_type`, `severity`, `status`, `description`, `radius_m`, `start_time`, `end_time`, `created_at` | Backend PostgreSQL / SQLite fallback |
| **NORTHSTAR AI Predictions** | `GET /api/predictions` | `rainfall_mm` (tùy chọn) | `point_id`, `name`, `current_depth_cm`, `threshold_cm`, `forecast_30m.{predicted_depth_cm, risk_score}` | Mô hình Scikit-learn (tham khảo, tách riêng) |

*Lưu ý khảo sát Backend:* `GET /api/weather/hanoi` của Backend hiện chỉ trả về `hourly_forecast` lượng mưa cho Hà Nội (`city`, `coordinates`, `hourly_forecast`), chưa có nhiệt độ/độ ẩm/gió theo tọa độ tùy ý, do đó Citizen tiếp tục dùng Open-Meteo trực tiếp cho tọa độ người dùng chọn hoặc GPS. `GET /api/disasters` hiện chưa trả trường `source` từ DB, nên Citizen ghi trung thực là `"Hệ thống giám sát NORTHSTAR (Backend /api/disasters)"` nếu API không trả `source`.

---

## 3. Phân loại nguồn dữ liệu & Trạng thái cảnh báo
1. **Cảnh báo hệ thống (`/api/disasters`)**:
   - Phân loại vòng đời qua `classifyDisasterStatus(props, nowMs)`: `active` (Đang hiệu lực), `upcoming` (Sắp có hiệu lực), `expired` (`status` là `resolved`/`expired`/`closed` hoặc `end_time <= now`), `revoked` (`status` là `cancelled`/`revoked`/`retracted`).
   - Bản tin `expired` và `revoked` bị ẩn khỏi danh sách đang hiệu lực (chỉ hiển thị số lượng đã ẩn).
2. **Dự báo mô hình AI/ML (`/api/predictions`)**:
   - Hiển thị ở vùng riêng `#citizen-ai-forecast-container` với nhãn `MODEL ESTIMATE` và cảnh báo rõ: *"Không phải cảnh báo thiên tai chính thức"*.
3. **Khi API thất bại / Offline**:
   - Tuyệt đối không tạo dữ liệu giả hoặc cảnh báo giả. Chỉ đọc cache hợp lệ từ IndexedDB kèm nhãn ngoại tuyến và thời điểm tải/ban hành gốc; nếu không có cache hoặc cache hết hạn, hiển thị thông báo lỗi trung thực.

---

## 4. Danh sách file đã sửa / thêm
- [citizen_portal.js](file:///d:/OpenSource_2026/GrassTouchers-Frontend/js/citizen_portal.js): Viết lại luồng thời tiết, chọn vị trí thủ công/GPS, phân loại cảnh báo, tách AI forecast, xử lý `toFiniteOrNull()` tránh biến `null` thành `0`, loại bỏ toàn bộ dữ liệu mẫu giả.
- [offline_db.js](file:///d:/OpenSource_2026/GrassTouchers-Frontend/js/offline_db.js): Bổ sung `coordinates` & `getAllWeatherCache()` cho `weather_cache`; lưu `status`, `start_time`, `end_time`, `cache_expires_at` trong `disaster_cache`.
- [citizen.html](file:///d:/OpenSource_2026/GrassTouchers-Frontend/citizen.html): Thêm bộ chọn địa điểm `#citizen-weather-location-select`, nút làm mới `#btn-citizen-weather-refresh` và vùng `#citizen-ai-forecast-container`.
- [test_phase6_weather_alerts.py](file:///d:/OpenSource_2026/GrassTouchers-Frontend/tests/test_phase6_weather_alerts.py): Bộ kiểm thử 26 kịch bản `WT-01..09`, `AL-01..09`, `INT-01..08` trên Edge Headless + IndexedDB.

---

## 5. Kiến trúc Cache & Quy tắc hết hạn
- **Service Worker (`WEATHER_CACHE` trong `sw.js`)**: Cache HTTP response mức mạng theo chiến lược Network First.
- **IndexedDB (`weather_cache` & `disaster_cache` trong `OfflineDB`)**:
  - `weather_cache`: Khóa theo khu vực/tọa độ (`hanoi`, `haiphong`, `gps_...`), TTL `30 phút` (`expires_at`), phân biệt `data_updated_at` (giờ quan trắc của Open-Meteo) và `fetched_at` (giờ thiết bị tải). Cache hết hạn bị từ chối, không hiển thị như dữ liệu thời gian thực.
  - `disaster_cache`: TTL `60 phút` (`cache_expires_at`), bảo toàn `issued_at` và `end_time` gốc.
  - Không làm ảnh hưởng `sos_queue`, `flood_reports` hoặc `sync_metadata`.

---

## 6. Kết quả kiểm thử (Thực thi sau chỉnh sửa cuối)
- **Nhóm WT (`WT-01..WT-09`)**: **9/9 PASS** trên Edge Headless + IndexedDB thật.
- **Nhóm AL (`AL-01..AL-09`)**: **9/9 PASS** trên Edge Headless + IndexedDB thật.
- **Nhóm INT (`INT-01..INT-08`)**: **8/8 PASS** (bao gồm `INT-03` khởi động lại trình duyệt đọc lại cache từ IndexedDB, `INT-05/06` không ảnh hưởng SOS/Sync, `INT-07` Command không bị ảnh hưởng, `INT-08` mobile `390px`).
- **Hồi quy toàn bộ Frontend (`test_phase5_pwa`, `test_phase4_offline_sync`, `test_offline_db`, `test_phase2_gps_sos`, `test_phase1_config_api`, `test_compliance_audit`, `test_citizen_workflow`)**: **28 tests — 26 PASS, 2 SKIPPED (`PWA-21/22` thiếu thiết bị Android/iOS thật), 0 FAILED**.

---

## 7. Hạn chế & Đề xuất giai đoạn tiếp theo
- Backend `/api/disasters` chưa lưu cột `source` chi tiết từng cơ quan ban hành trong DB; có thể bổ sung ở vòng nâng cấp Backend sau.
- Đề xuất giai đoạn tiếp theo (**CIT-08 – Báo ngập cộng đồng & Chuẩn hóa bản đồ sơ tán**): tiếp tục hoàn thiện quy trình báo ngập và lớp bản đồ cộng đồng theo đúng lộ trình.
