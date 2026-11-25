# HƯỚNG DẪN KHO TRI THỨC NGOẠI TUYẾN NORTHSTAR CITIZEN

- **Tệp dữ liệu:** `data/offline_knowledge_vi.json`
- **Mô-đun truy vấn:** `js/offline_knowledge.js` (`OfflineKnowledgeEngine`)
- **Cache:** Precache trong `sw.js` (`STATIC_CACHE`) và lưu bản sao vào IndexedDB (`northstar_citizen_db` → `knowledge_cache`).

## Cấu trúc mỗi mục tri thức
Mỗi phần tử trong `entries[]` bắt buộc có:
- `id`, `topic`, `title`
- `keywords[]`, `synonyms[]`
- `answer` (nội dung hướng dẫn ngắn gọn, thực tế)
- `source` (cơ quan/tổ chức chuyên môn), `reviewed_at`, `version`, `confidence`, `approval_status`

## Nguyên tắc an toàn
1. Chỉ dùng cơ chế tìm kiếm từ khóa/đồng nghĩa trên JSON cục bộ; **không** phải mô hình LLM offline.
2. Không tự bịa hướng dẫn y tế/sơ cứu khi không có mục phù hợp — luôn thừa nhận thiếu dữ liệu và hướng dẫn gọi `112`, `114`, `115`.
3. Không trả lời dữ liệu thời gian thực (thời tiết hiện tại, mực nước, tuyến đường an toàn) khi đang offline.
