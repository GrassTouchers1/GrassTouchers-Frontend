/**
 * GrassToucher Frontend - Cấu hình Endpoint Backend API & WebSocket.
 * 100% Mã nguồn mở (Apache-2.0 License).
 */
const GRASSTOUCHER_CONFIG = {
    // Địa chỉ Backend REST API
    API_BASE_URL: window.location.port === "8000" ? "" : "http://localhost:8000",
    
    // Địa chỉ WebSocket Server
    WS_BASE_URL: window.location.port === "8000" 
        ? ((window.location.protocol === "https:" ? "wss://" : "ws://") + window.location.host + "/ws/navigation")
        : "ws://localhost:8000/ws/navigation",
        
    // Cấu hình bản đồ OpenStreetMap
    DEFAULT_CENTER: [21.0285, 105.8030], // Hà Nội
    DEFAULT_ZOOM: 13,
};
