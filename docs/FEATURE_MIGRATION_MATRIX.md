# MA TRẬN CHUYỂN ĐỔI CHỨC NĂNG GIAO DIỆN
## FEATURE MIGRATION MATRIX (PHASE 2)

**Hệ thống:** NORTHSTAR COMMAND  
**Mục tiêu:** Ánh xạ 100% chức năng từ phiên bản tiền nhiệm sang hệ sinh thái NORTHSTAR COMMAND, phân định rõ phạm vi điều hành trung tâm và các module dùng chung bảo toàn.  

---

## 1. MA TRẬN CHI TIẾT TỪNG CHỨC NĂNG

| STT | Tính năng giao diện cũ | Nhóm phân loại | Vị trí mới trong NORTHSTAR COMMAND | Cách thức chuyển đổi & Nâng cấp nghiệp vụ | Bảo toàn cho CITIZEN / RESPONSE |
|---|---|---|---|---|---|
| **1** | Màn hình bản đồ ngập lụt ban đầu | **Group B (Redesign)** | **Command Dashboard (COP)** & **Disaster Map** | Chuyển đổi thành Bản đồ Tác chiến Tổng hợp (COP). Tích hợp đồng thời SOS khẩn cấp, vị trí đội cứu hộ, điểm sơ tán an toàn, đa giác ngập viễn thám Sentinel-1 SAR. | Vẫn có thể xem dạng bản đồ công cộng khi chuyển sang chế độ `Citizen Preview`. |
| **2** | Thanh Header tìm đường dân sinh | **Group B (Redesign)** | **Enterprise Command Header** | Thay thế bằng thanh tiêu đề điều hành chuyên nghiệp: Nhận diện thương hiệu NorthStar Command, trạng thái trực ban 24/7, đồng bộ thời gian thực, bộ chọn vùng giám sát, tìm kiếm nhanh sự cố, chuyển đổi vai trò. | Menu tìm đường dân sinh được đưa vào mục Shared Module. |
| **3** | Tabs Tìm đường / Điểm ngập / Báo ngập | **Group B (Redesign)** | **8 Khối Nghiệp vụ Tactical Sidebar** | Tái cấu trúc thành Sidebar 8 nhóm chuẩn Emergency Operations Center (Overview, Information, Monitoring, GIS, Resources, Operations, Reports, System). | Các form nhập liệu của người dân được tách thành modal độc lập. |
| **4** | Bảng danh sách 130 trạm quan trắc | **Group A (Keep & Reuse)** | **DISASTER MONITORING -> Flood Intelligence** | Giữ nguyên danh mục 130 trạm, bổ sung thông tin cấp báo động lũ (Báo động 1, 2, 3) và lịch sử mực nước dâng theo kịch bản thời tiết thực tế. | Dữ liệu trạm đo phục vụ cả 3 phân hệ. |
| **5** | Form Báo ngập của người dân | **Group C (Shared Module)** | **INFORMATION CENTER -> Disaster Reports** | Chuyển thành nguồn tin đến (Incoming Feed) tại Information Hub. Điều phối viên có công cụ xác minh thực tế, khử trùng lặp 50m và kiểm tra chéo cảm biến lân cận. | Form gửi báo cáo của người dân được giữ nguyên trong shared modal để người dân tiếp tục sử dụng. |
| **6** | Form Gửi tín hiệu SOS 1-Click | **Group C (Shared Module)** | **INFORMATION CENTER -> SOS Requests** | Trở thành hàng đợi tiếp nhận khẩn cấp ưu tiên cao nhất (P1) trong Command. Cho phép điều phối viên mở hồ sơ nạn nhân, gọi điện thoại và điều động lực lượng ứng cứu. | Form gửi SOS cho người dân được bảo toàn nguyên vẹn trên cổng Mobile/Web công cộng. |
| **7** | Trợ lý Cấp cứu Giọng nói AI Whisper | **Group A (Keep & Reuse)** | **INFORMATION CENTER -> Verification Queue** | Tích hợp thành luồng tiếp nhận âm thanh: giọng nói người dân được AI bóc tách tự động và đẩy vào bảng tiếp nhận của điều phối viên với nhãn "Voice AI SOS". | Người dân tiếp tục sử dụng tính năng bấm mic kêu cứu khi tay ướt hoặc gặp nguy hiểm. |
| **8** | Thuật toán Tìm đường né ngập $A^*$ | **Group C (Shared Module)** | **COMMAND OPERATIONS -> Evacuation Support** | Tái sử dụng để tính toán lộ trình sơ tán an toàn cho người dân và tính toán hành trình cho đoàn xe cứu trợ tránh các đoạn đường ngập vượt giới hạn gầm xe. | Giữ nguyên cho người tham gia giao thông tìm lộ trình tránh ngập. |
| **9** | Thuật toán Tối ưu hóa Cứu nạn TSP | **Group A (Keep & Reuse)** | **COMMAND OPERATIONS -> Rescue Missions** | Nâng cấp thành công cụ gợi ý lộ trình cứu nạn tuần tự tối ưu cho các đoàn xuồng máy và xe tải cứu hộ đa điểm. | Cung cấp lộ trình cho đội phản ứng (Response Portal). |
| **10** | Giả lập Kịch bản Mưa bão | **Group A (Keep & Reuse)** | **DISASTER MONITORING -> Storm Tracking** | Tích hợp vào phân hệ Giám sát thiên tai, cho phép ban chỉ huy kích hoạt mô phỏng mưa lớn để xem trước vùng có nguy cơ ngập và lên phương án trực chiến. | Dùng chung cho huấn luyện và diễn tập PCTT. |
| **11** | Mô phỏng Timeline Lũ T+0h -> T+24h | **Group A (Keep & Reuse)** | **DISASTER MONITORING -> River Water Levels** | Thanh trượt mô phỏng dòng thời gian ngập lũ theo dự báo thủy văn và xả lũ thủy điện. | Giúp điều phối viên ra quyết định sơ tán sớm trước 6 - 12 giờ. |
| **12** | Xuất Báo cáo Tác chiến PCTT (SitRep) | **Group A (Keep & Reuse)** | **REPORTS -> Situation Reports** | Trở thành công cụ báo cáo tác chiến chính thống: tự động trích xuất các chỉ số thiệt hại, số ca giải cứu, năng lực trạm sơ tán để gửi cơ quan thẩm quyền. | Dùng riêng cho cấp chỉ huy và điều hành. |
| **13** | Dashboard Thống kê Đô thị | **Group B (Redesign)** | **REPORTS -> Operational Statistics** | Thiết kế lại theo dạng biểu đồ phân tích tác chiến: biểu đồ tỷ lệ giải cứu, biểu đồ mực nước trạm đo, biểu đồ phân bố địa bàn cô lập. | Dùng cho chuyên viên phân tích dữ liệu (Data Analyst). |
| **14** | Danh mục Điểm Sơ tán An toàn | **Group B (Redesign)** | **RESOURCE MANAGEMENT -> Safe Zones** | Hiển thị bảng quản lý sức chứa, số người đang tạm trú, nhu yếu phẩm dự phòng và số điện thoại liên hệ trực tiếp. | Người dân tiếp tục tra cứu trạm sơ tán gần nhất trên bản đồ. |
| **15** | Danh bạ Lực lượng Đội Cứu nạn | **Group B (Redesign)** | **RESOURCE MANAGEMENT -> Rescue Teams** | Xây dựng bảng quản lý danh bạ các đội Ca nô 114, Xuồng phao Chữ thập đỏ, Xe 4x4, Tổ cấp cứu 115 kèm trạng thái trực ban. | Đội cứu hộ sử dụng để cập nhật trạng thái sẵn sàng của đội mình. |

---

## 2. CAM KẾT BẢO TOÀN DỮ LIỆU VÀ TƯƠNG THÍCH MÃ NGUỒN

1. **Không thay đổi Schema Database:** Toàn bộ bảng cơ sở dữ liệu (`community_sos`, `reports`, `shelters`, `disasters`, `flood_points`, `water_readings`) được giữ nguyên vẹn 100%, không phát sinh lỗi phá vỡ tương thích.
2. **Không thay đổi Hợp đồng API (API Contracts):** Tất cả các endpoint backend hiện tại tiếp tục phản hồi chính xác theo định dạng GeoJSON chuẩn mở.
3. **Phân tách Route rõ ràng:** Giao diện COMMAND hoạt động như một hệ điều hành tác chiến thống nhất, trong khi các route dành cho Citizen và Response được bảo toàn trong các shared components để sẵn sàng triển khai thành các ứng dụng độc lập khi cần.

---
*Ma trận chuyển đổi chức năng NORTHSTAR COMMAND v2.0.*
