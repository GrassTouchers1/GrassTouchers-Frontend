<!--
  Copyright (C) 2026 NORTHSTAR Contributors
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at:
      http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->

# BÁO CÁO NGHIỆM THU GIAI ĐOẠN 3 – INDEXEDDB & LƯU TRỮ NGOẠI TUYẾN (`CIT-04`)

## 1. Kiểm toán `localStorage` trước khi sửa
| Khóa | Mô-đun sử dụng | Loại dữ liệu | Migration sang IndexedDB? |
| :--- | :--- | :--- | :--- |
| `northstar_sos_drafts` | `js/offline_sync_manager.js` | Mảng JSON bản nháp SOS | **Có** $\rightarrow$ `sos_queue` |
| `northstar_offline_outbox` | `js/offline_sync_manager.js` | Mảng JSON hàng đợi tổng (`SOS_BEACON_DISPATCH`) | **Có** (chống trùng theo `local_id`) $\rightarrow$ `sos_queue` |
| `offline_flood_reports` | `citizen.html` | Mảng JSON báo ngập cộng đồng offline | **Có** $\rightarrow$ `flood_reports` |
| `northstar_last_sos_ticket` | `citizen.html`, `rescue_manager.js`, `offline_sync_manager.js` | Chuỗi mã ticket gần nhất | Giữ tương thích UI |
| `northstar_api_base_url` | `js/config.js` | Chuỗi Base URL cấu hình runtime | Giữ nguyên cấu hình |
| `floodnav_tour_seen` | `js/map_core.js` | Cờ UI tour Command | Không thuộc Citizen |

## 2. Kiến trúc Database (`northstar_citizen_db`, Version 1)
Tệp triển khai: `GrassTouchers-Frontend/js/offline_db.js`.
- Quản lý kết nối singleton (`dbInstance` / `openPromise`), xử lý đầy đủ `onupgradeneeded`, `onerror`, `onblocked`, `onversionchange` (tự đóng kết nối và phát sự kiện `northstar:db_versionchange`), phân loại lỗi `QUOTA_EXCEEDED` và `NOT_SUPPORTED`.
- **Lưu ý bảo mật:** IndexedDB không tự mã hóa dữ liệu; tuyệt đối không lưu mật khẩu, API key hay thông tin xác thực nhạy cảm.

### Bảy Object Stores
1. **`sos_queue`** (`keyPath: 'local_id'`, indexes: `sync_status`, `created_at`, `client_event_id`)
2. **`flood_reports`** (`keyPath: 'local_id'`, indexes: `sync_status`, `created_at`) — giới hạn Blob ảnh tối đa 5MB.
3. **`weather_cache`** (`keyPath: 'cache_key'`, indexes: `expires_at`, `fetched_at`) — từ chối dữ liệu mẫu giả (`is_sample: true`).
4. **`disaster_cache`** (`keyPath: 'id'`, indexes: `issued_at`, `expires_at`) — giữ nguyên `issued_at` gốc.
5. **`shelters_cache`** (`keyPath: 'id'`, indexes: `status`, `updated_at`) — giữ nguyên trạng thái `status` thực tế.
6. **`knowledge_cache`** (`keyPath: 'id'`, indexes: `topic`, `verified`) — chỉ lưu và tìm kiếm bản ghi đã duyệt (`verified: true`, `moderation_status: 'approved'`).
7. **`sync_metadata`** (`keyPath: 'key'`) — lưu `database_version` và báo cáo `localstorage_migration_v1`.

## 3. Các hàm API đã xây dựng (`window.OfflineDB`)
- **Database:** `openDatabase()`, `closeDatabase()`, `deleteDatabase()`, `getDatabaseVersion()`, `getStorageEstimate()`, `requestPersistence()`.
- **SOS:** `saveSOS()`, `getSOS()`, `getAllSOS()`, `updateSOS()`, `deleteSOS()`, `countPendingSOS()`.
- **Flood Reports:** `saveFloodReport()`, `getFloodReport()`, `getAllFloodReports()`, `updateFloodReport()`, `deleteFloodReport()`.
- **Weather:** `saveWeatherCache()`, `getWeatherCache()`, `clearExpiredWeatherCache()`.
- **Disaster:** `saveDisasterCache()`, `getDisasterCache()`, `getAllDisasterCache()`.
- **Shelters:** `saveShelterCache()`, `getShelterCache()`, `getAllShelterCache()`.
- **Knowledge:** `saveKnowledge()`, `searchKnowledge()`, `getAllKnowledge()`.
- **Metadata & Migration & Cleanup:** `saveMetadata()`, `getMetadata()`, `migrateFromLocalStorage()`, `cleanupExpiredNonEssentialCache()`.

## 4. Những mô-đun đã tích hợp & Migration
- `citizen.html`: Nạp `js/offline_db.js`, chạy `OfflineDB.migrateFromLocalStorage()` khi khởi động, ghi báo ngập offline vào `flood_reports` bằng `OfflineDB.saveFloodReport()`.
- `js/offline_sync_manager.js`: Khi lưu bản nháp SOS (`enqueueSOSDraft`), ghi song song vào `sos_queue` bằng `OfflineDB.saveSOS()`.
- `js/citizen_portal.js`: Cache dữ liệu thời tiết thật bằng `OfflineDB.saveWeatherCache()` và cảnh báo thật từ `/api/disasters` bằng `OfflineDB.saveDisasterCache()`.
- `js/rescue_manager.js`: Cache điểm sơ tán thật từ `/api/shelters` bằng `OfflineDB.saveShelterCache()`.
- **Migration an toàn:** Kiểm tra JSON, chống trùng theo `local_id`, ghi nguyên tử, **đọc lại từ IndexedDB để xác minh** trước khi ghi `sync_metadata`, giữ lại bản `localStorage` cũ trong giai đoạn chuyển tiếp để tương thích ngược.

## 5. Kết quả Kiểm thử thực tế trên Microsoft Edge Headless (`tests/test_offline_db.py`)
- **20/20 kịch bản `DB-01` đến `DB-20` đều PASS** trên IndexedDB thật của Edge Headless (bao gồm `DB-15` đóng và mở lại trình duyệt mới trên cùng `user-data-dir` vẫn đọc được nguyên vẹn SOS & Báo ngập đã lưu).
- **Toàn bộ bộ test Frontend (`python -m unittest discover -s tests -v`):** **20/20 tests PASS** (`6.847s`).

## 6. Những lỗi còn lại & Chức năng chưa triển khai (thuộc Giai đoạn sau)
- Cơ chế đồng bộ đầy đủ hai chiều, retry backoff và `client_event_id` idempotency thuộc **Giai đoạn 4 (`CIT-05`)** — chưa triển khai trong Giai đoạn 3.
- Giao diện hiển thị dữ liệu thời tiết/cảnh báo từ cache khi mất mạng thuộc **Giai đoạn 6 (`CIT-07`)**, kho tri thức AI ngoại tuyến hoàn chỉnh thuộc **Giai đoạn 10 (`CIT-11`)**.
