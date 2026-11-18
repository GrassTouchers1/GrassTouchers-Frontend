# NORTHSTAR COMMAND – UI & INTEGRATION TEST REPORT
**Mã tài liệu:** `COMMAND_UI_TEST_REPORT`  
**Phiên bản:** `2.7-ENTERPRISE-RBAC`  
**Hệ thống:** NORTHSTAR COMMAND (Unified Disaster Intelligence & Emergency Response Coordination Center)  
**Ngày thực hiện:** 18/11/2026  
**Môi trường thử nghiệm:** Localhost (Frontend port 3000, Backend port 8000, Python 3.12, Leaflet 1.9.4)  
**Chi nhánh:** `dev`  

---

## 1. TỔNG QUAN NÂNG CẤP & YÊU CẦU NGHIỆP VỤ

Theo chỉ đạo trong phiên làm việc mới nhất:
> *"Từng vai trò hoạt động ở đây thì việc họ có thể bao quát và quyền có thể sử dụng các tính năng ở đây khác nhau chứ, và tiếp tục chỉnh sửa, trau chuốt lại tất cả các tính năng đang có trong bài."*

Hệ thống **NORTHSTAR COMMAND** đã được hoàn thiện kiến trúc **Phân quyền Tác chiến Đa vai trò (6-Role Operational RBAC Matrix)** kết hợp sâu giữa:
1. **Phạm vi Bao quát (Operational Perspective & Scope):** Mỗi vai trò khi trực ban chỉ thấy những dữ liệu, góc nhìn và dòng thông tin trọng tâm thuộc thẩm quyền và phân khu trách nhiệm của mình.
2. **Quyền hạn Hành động (Action Rights):** Kiểm soát nghiêm ngặt 7 năng lực tác chiến chính (`canDispatch`, `canVerify`, `canManageFleet`, `canManageShelters`, `canSimulateStorm`, `canExportSitRep`, `canAdminSystem`). Mọi nút thao tác (xuất quân, duyệt tin, đổi trạng thái xe, điều chỉnh sức chứa điểm sơ tán, kéo thanh mưa bão) đều tự động khóa/mở tương ứng với vai trò.
3. **Trau chuốt Toàn diện 14 Phân hệ:** Tinh chỉnh thiết kế đồ họa tác chiến chuẩn phòng chỉ huy, bố cục bản đồ Leaflet 100% full-canvas không bị che khuất hay đè nút, tích hợp thanh điều hướng và cảnh báo vi phạm thẩm quyền tác chiến.

---

## 2. MA TRẬN 6 VAI TRÒ TÁC CHIẾN (RBAC MATRIX)

| Mã Vai Trò | Tên Hiển Thị | Phạm Vi Bao Quát (Overview Scope) | Xuất Quân | Thẩm Định | Xe/Tàu | Trú Ẩn | Giả Lập Bão | SitRep | Quản Trị RBAC |
|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `director` | ⭐ Chỉ huy trưởng | Toàn chiến dịch 7 tỉnh Miền Bắc, ban bố tình trạng khẩn cấp, xuất quân lực lượng và duyệt SitRep Bộ Chỉ Huy | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** |
| `dispatcher` | 🛡️ Điều phối viên | Tiếp nhận SOS, lập lệnh xuất quân, phân bổ ca-nô/xe 4x4, tính toán lộ trình né ngập cứu nạn TSP | **✓** | **✓** | **✓** | **✓** | ✗ | **✓** | ✗ |
| `verifier` | 🔍 Xác minh viên | Thẩm định tin báo dân sự, kiểm tra ảnh hiện trường, lọc trùng 50m, đối soát 114 (KHÔNG tự ý xuất quân) | ✗ | **✓** | ✗ | ✗ | ✗ | ✗ | ✗ |
| `analyst` | 📊 Chuyên viên dữ liệu | Giám sát 130 trạm thủy văn IoT, radar mưa Open-Meteo, viễn thám Sentinel-1 SAR, chạy mô phỏng bão lũ | ✗ | ✗ | ✗ | ✗ | **✓** | **✓** | ✗ |
| `rescue_coordinator` | 🚒 Đ/p Cứu hộ | Chỉ huy 5 đơn vị cơ động (Ca-nô 150HP, Xuồng phao, Xe 4x4, Thợ lặn, Trực thăng Mi-17), theo dõi cứu nạn P1 | **✓** | ✗ | **✓** | ✗ | ✗ | ✗ | ✗ |
| `relief_coordinator` | 📦 Đ/p Cứu trợ | Quản lý 15 điểm sơ tán an toàn (420/600 người), điều phối gạo, nước sạch, thuốc men, áo phao, đoàn thiện nguyện | ✗ | ✗ | ✗ | **✓** | ✗ | **✓** | ✗ |

---

## 3. CƠ CHẾ HIỂN THỊ & THỰC THI TRÊN GIAO DIỆN (UI ENFORCEMENT)

### 3.1. Thanh Trạng Thái Thẩm Quyền & Phạm Vi Tác Chiến (`#cmd-role-scope-banner`)
- Được bố trí cố định ngay dưới Header, hiển thị:
  - Huy hiệu vai trò với màu sắc định danh:
    - `⭐ Chỉ huy trưởng`: Màu Vàng Hổ Phách (Amber)
    - `🛡️ Điều phối viên`: Màu Xanh Dương (Blue)
    - `🔍 Xác minh viên`: Màu Xanh Ngọc (Teal)
    - `📊 Chuyên viên dữ liệu`: Màu Tím (Purple)
    - `🚒 Điều phối Cứu hộ`: Màu Đỏ Hồng (Rose)
    - `📦 Điều phối Cứu trợ`: Màu Xanh Lá (Emerald)
  - Thẻ phạm vi địa lý và nhiệm vụ: `Phạm vi: [Scope Tag]`.
  - 7 thẻ năng lực tác chiến thời gian thực:
    - Nếu được cấp quyền: Thẻ nền xanh ngọc đậm, viền sáng, có dấu `✓ [Tên quyền]`.
    - Nếu bị giới hạn: Thẻ nền tối, chữ xám mờ, gạch ngang và có icon `🔒 [Tên quyền]`.

### 3.2. Khối Góc Nhìn Bao Quát & Hành Động Nhanh (`#cmd-role-focus-callout`)
- Nằm nổi bật trên Bảng Điều Hành COP, tóm tắt trực quan bức tranh thảm họa từ lăng kính của vai trò đang đăng nhập.
- Cung cấp 3 nút hành động nhanh độc quyền cho từng vai trò:
  - **Chỉ huy trưởng:** `[📢 Ban Bố Báo Động Đỏ]`, `[📋 Xuất SitRep Bộ Chỉ Huy]`, `[⚡ Điều Phối Cấp Tốc]`.
  - **Điều phối viên:** `[⚡ Xem Hàng Đợi SOS P1]`, `[🚑 Điều Động Ca-nô]`, `[📍 Lập Tuyến Né Ngập TSP]`.
  - **Xác minh viên:** `[✓ Mở Hàng Đợi Xác Minh]`, `[🔗 Gộp 2 Cụm Trùng 50m]`, `[📞 Đối Soát Báo Cáo Dân Sự]`.
  - **Chuyên viên dữ liệu:** `[🌧️ Bộ Giả Lập Mưa Bão]`, `[🌊 130 Trạm Thủy Văn IoT]`, `[🛰️ Bản Đồ Radar Viễn Thám]`.
  - **Điều phối cứu hộ:** `[🚒 Quản Lý Đội Ca-nô & Xe]`, `[⚡ Tiếp Nhận Ca SOS P1]`, `[🗺️ Giám Sát Tuyến Trên Bản Đồ]`.
  - **Điều phối cứu trợ:** `[🏕️ Quản Lý 15 Điểm Sơ Tán]`, `[📦 Kiểm Kê Nhu Yếu Phẩm]`, `[📋 Báo Cáo Hậu Cần SitRep]`.

### 3.3. Bảo Vệ Điều Hướng Sidebar & Màn Hình Hạn Chế Thẩm Quyền (`renderAccessRestrictedScreen`)
- Mọi nút trên Sidebar thuộc phân hệ ngoài quyền hạn của vai trò đang dùng đều được gắn icon khóa `🔒`, làm mờ (`opacity-40`) và cập nhật tooltip cảnh báo.
- Nếu người dùng bấm vào phân hệ bị khóa hoặc truy cập qua URL:
  - Hệ thống hiển thị Màn hình Cảnh báo Thẩm quyền quân sự: Biểu tượng khiên khóa, thông báo phân hệ này chỉ dành cho vai trò nào, và cung cấp nút 1-chạm `[Chuyển sang vai trò có quyền]` để trải nghiệm ngay lập tức.

### 3.4. Kiểm Soát Nút Thao Tác Nghiệp Vụ Tại Hiện Trường
- **Nút Phát Lệnh Điều Phối SOS (`openDispatchModal`):**
  - Chỉ huy trưởng, Điều phối viên, Đ/p Cứu hộ: Nút đỏ nổi bật `[⚡ Lập Lệnh Cứu Nạn]` / `[⚡ Điều phối]`.
  - Xác minh viên, Chuyên viên dữ liệu, Đ/p Cứu trợ: Nút bị vô hiệu hóa với nhãn `[🔒 Chờ lệnh]`.
- **Nút Thẩm Định & Duyệt Tin Báo (`verifyIncident`, `rejectIncident`):**
  - Xác minh viên, Điều phối viên, Chỉ huy trưởng: Nút xanh `[✓ Duyệt]`, `[Bác bỏ]`.
  - Các vai trò khác: Chuyển thành nhãn `[🔒 Chỉ xem]`.
- **Nút Đổi Trạng Thái Phương Tiện Cơ Động (`toggleUnitStatus`):**
  - Chỉ Đ/p Cứu hộ, Điều phối viên, Chỉ huy trưởng mới có quyền chuyển trạng thái: Sẵn sàng 🟢 / Đang điều phối 🚑 / Tại hiện trường 🎯 / Bảo dưỡng ⚪.
- **Nút Điều Chỉnh Sức Chứa Điểm Sơ Tán (`updateShelterCapacity`):**
  - Chỉ Đ/p Cứu trợ, Điều phối viên, Chỉ huy trưởng có quyền thao tác `[+10 Người]`, `[-10 Người]`.
- **Thanh Kéo Giả Lập Mưa Bão (0-100mm):**
  - Chỉ Chuyên viên Dữ liệu & Chỉ huy trưởng có quyền kéo trượt mô phỏng; các vai trò khác thanh trượt bị khóa (`disabled`).

---

## 4. KẾT QUẢ THỬ NGHIỆM TỔNG HỢP

1. **Khởi Động Hệ Thống:** Không bị modal giới thiệu che khuất bản đồ khi tải trang; màn hình mặc định là Bảng Điều Hành Tác Chiến COP với bản đồ 100% full-canvas.
2. **Khả Năng Chuyển Đổi Vai Trò:** Hỗ trợ chuyển đổi tức thì qua Header Dropdown, Ma trận RBAC hoặc qua tham số URL (`?role=verifier`, `?role=analyst`, v.v.).
3. **Hiệu Năng Backend:** 28/28 bài kiểm thử đơn vị & tích hợp đạt chuẩn (OK trong 21.5s), thuật toán A* tìm đường né ngập hoàn thành trong 141.49ms.
4. **Bảo Toàn Dự Án:** 100% các tính năng cũ (tìm đường A*, voice SOS, báo ngập dân cư) được bảo toàn nguyên vẹn trong module dùng chung và xem trước tại `cmd_citizen_preview`.
