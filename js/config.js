/**
 * Copyright 2026 GrassTouchers Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NorthStar / GrassToucher Frontend - Cấu hình Endpoint Backend API & WebSocket.
 * 100% Mã nguồn mở (Apache-2.0 License).
 */
const GRASSTOUCHER_CONFIG = {
    // Địa chỉ Backend REST API
    API_BASE_URL: (window.location.port === "8000" || window.location.hostname === "backend") 
        ? "" 
        : "http://localhost:8000",
    
    // Địa chỉ WebSocket Server
    WS_BASE_URL: (window.location.port === "8000" || window.location.hostname === "backend") 
        ? ((window.location.protocol === "https:" ? "wss://" : "ws://") + window.location.host + "/ws/navigation")
        : "ws://localhost:8000/ws/navigation",
        
    // Cấu hình bản đồ OpenStreetMap
    DEFAULT_CENTER: [21.0285, 105.8030], // Hà Nội
    DEFAULT_ZOOM: 13,

    // Helper tạo URL API thống nhất
    getApiUrl(path) {
        const base = this.API_BASE_URL || "";
        const cleanPath = path.startsWith("/") ? path : "/" + path;
        return `${base}${cleanPath}`;
    }
};

const NORTHSTAR_CONFIG = GRASSTOUCHER_CONFIG;

function getApiUrl(path) {
    return GRASSTOUCHER_CONFIG.getApiUrl(path);
}
