# HƯỚNG DẪN CÀI ĐẶT & TRIỂN KHAI TỪ MÃ NGUỒN (BUILDING & SERVING FROM SOURCE)
## NORTHSTAR FRONTEND (Bản đồ Tác chiến & Trung tâm Chỉ huy COP)

> Dự án Web Frontend được thiết kế theo kiến trúc **PWA Nguồn mở Thuần (Vanilla Modern Web & Open Standards)**, không phụ thuộc vào các công cụ bundler nguồn đóng, đảm bảo tính bền vững và khả năng triển khai tức thì trên mọi môi trường máy chủ.

---

## 1. YÊU CẦU MÔI TRƯỜNG

Frontend sử dụng HTML5, CSS3 hiện đại, Vanilla JavaScript (ES6+) và Service Worker PWA. Chỉ cần:
* Một trình duyệt web hiện đại hỗ trợ ECMAScript 6+ (Google Chrome, Mozilla Firefox, Microsoft Edge, Safari).
* Bất kỳ máy chủ web tĩnh nguồn mở nào (Python HTTP Server, Nginx, Apache HTTPD, Node.js `http-server`, Caddy).

---

## 2. QUY TRÌNH TRIỂN KHAI

### Bước 2.1: Tải mã nguồn từ GitHub
```bash
git clone https://github.com/GrassTouchers1/GrassTouchers-Frontend.git
cd GrassTouchers-Frontend
```

### Bước 2.2: Khởi chạy bằng máy chủ Python có sẵn (Khuyên dùng)
```bash
# Python 3
python -m http.server 3000
```

### Bước 2.3: Hoặc triển khai bằng Nginx (Môi trường máy chủ Linux)
```nginx
server {
    listen 80;
    server_name northstar.example.org;
    root /var/www/GrassTouchers-Frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 3. CẤU HÌNH KẾT NỐI API BACKEND

Để điều chỉnh địa chỉ máy chủ API backend mà không cần sửa mã nguồn, hãy mở tệp cấu hình:
📁 `js/config.js`
```javascript
window.APP_CONFIG = {
  API_BASE_URL: 'http://localhost:8000', // Hoặc IP máy chủ production của bạn
  MAP_INITIAL_CENTER: [21.0285, 105.8542], // Hà Nội
  DEFAULT_ZOOM: 9
};
```

---

## 4. TRUY CẬP VÀ TRÌNH DIỄN

Mở trình duyệt web và truy cập địa chỉ:  
🌐 **[http://localhost:3000](http://localhost:3000)**

* **Phím tắt `D`**: Bật bộ 4 kịch bản diễn tập cứu hộ bão lũ tự động.
* **Chế độ Ngoại tuyến (PWA Offline)**: Ứng dụng tự động đăng ký Service Worker (`sw.js`) để đệm bản đồ và cho phép sử dụng khi mất kết nối mạng.
