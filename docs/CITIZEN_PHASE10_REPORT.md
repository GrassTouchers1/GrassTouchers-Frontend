# BÁO CÁO TRIỂN KHAI GIAI ĐOẠN 10 – TRỢ LÝ AI ONLINE/OFFLINE & TỐI ƯU UI/UX (`CIT-11`)

**Ngày cập nhật:** 2026-11-25  
**Phân hệ:** NORTHSTAR CITIZEN (`GrassTouchers-Frontend`, nhánh `thuan`)  
**Trạng thái nghiệm thu:** `COMPLETED` *(Đạt toàn bộ 20 kịch bản `AI-01..10` và `UX-01..10` trên Edge Headless + kiểm tra cấu trúc `offline_knowledge_vi.json` và `citizen.html`).*

---

## 1. Các thay đổi đã triển khai
- **Kho tri thức sinh tồn ngoại tuyến ([offline_knowledge_vi.json](file:///d:/OpenSource_2026/GrassTouchers-Frontend/data/offline_knowledge_vi.json) & [offline_knowledge.js](file:///d:/OpenSource_2026/GrassTouchers-Frontend/js/offline_knowledge.js))**:
  - Xây dựng đủ **15 chủ đề** bắt buộc (`storm`, `heavy_rain`, `flood`, `flash_flood`, `landslide`, `evacuation`, `electrical_safety`, `water_food`, `first_aid`, `child_safety`, `elderly_support`, `battery_saving`, `no_signal_comms`, `sos_guide`, `citizen_usage`), mỗi mục có `id`, `topic`, `keywords`, `synonyms`, `answer`, `source`, `reviewed_at`, `version`, `confidence`, `approval_status`.
  - Tìm kiếm chuẩn hóa tiếng Việt không dấu + đồng nghĩa + từ khóa, đồng bộ vào `OfflineDB.knowledge_cache` và precache trong [sw.js](file:///d:/OpenSource_2026/GrassTouchers-Frontend/sw.js).
  - Phân biệt rõ **"Trợ lý tri thức Offline (Kho dữ liệu cục bộ)"**, không nhận là LLM offline; từ chối bịa dữ liệu thời gian thực hoặc hướng dẫn khi ngoài kho tri thức.
- **Trợ lý AI Online/Offline ([ai_assistant.js](file:///d:/OpenSource_2026/GrassTouchers-Frontend/js/ai_assistant.js))**:
  - Khi offline: trả lời ngay từ `OfflineKnowledgeEngine` mà không gọi API hay chờ timeout.
  - Khi online: gọi `/api/ai/chat` với timeout `8000ms`, tối đa 1 lần retry cho lỗi mạng/5xx, fallback an toàn sang `OfflineKnowledgeEngine` khi lỗi/timeout, escape HTML chống XSS, hỗ trợ phím `Escape` đóng hộp thoại.
- **Tối ưu UI/UX & Khả năng tiếp cận ([citizen.html](file:///d:/OpenSource_2026/GrassTouchers-Frontend/citizen.html))**:
  - Bỏ `user-scalable=no` và `maximum-scale=1.0` khỏi `<meta name="viewport">` để hỗ trợ phóng to.
  - Thêm `#citizen-emergency-banner` với nút SOS và `tel:112` nổi bật kèm `role="region"` và `aria-label`.

---

## 2. Kết quả kiểm thử (Thực thi sau chỉnh sửa cuối)
- **[test_phase10_ai_ux.py](file:///d:/OpenSource_2026/GrassTouchers-Frontend/tests/test_phase10_ai_ux.py)**: `AI-01..10` và `UX-01..10` **PASS**.
- **Hồi quy toàn bộ Frontend (`test_phase1`..`test_phase10`)**: **PASS** (chỉ `PWA-21/22` `SKIPPED` do không có thiết bị vật lý Android/iOS).
