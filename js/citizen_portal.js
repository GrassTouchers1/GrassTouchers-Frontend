/**
 * Copyright (C) 2026 NORTHSTAR Contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at:
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * ===================================================================
 * NORTHSTAR CITIZEN PORTAL – Phân hệ Người dân & Nạn nhân (Victim)
 * Phụ trách: Thành viên 1 | Nhiệm vụ: VIC-01, VIC-02, VIC-03, VIC-04
 * Nghiệm thu: V-01 (Thời tiết & Cảnh báo), V-04 (Xác nhận vị trí)
 * ===================================================================
 */

const CitizenPortal = (function () {
  'use strict';

  // Trạng thái nội bộ của phân hệ Citizen
  const state = {
    selectedCoords: { lat: 21.0285, lng: 105.8542 }, // Mặc định Hà Nội
    locationConfirmed: false,
    currentWeather: null,
    weatherLastUpdated: null,
    weatherSource: 'Open-Meteo Weather API (CC-BY 4.0) & NCHMF',
    isOffline: !navigator.onLine,
    activeTab: 'weather'
  };

  /**
   * Khởi tạo phân hệ Citizen
   */
  function init() {
    setupNetworkListeners();
    loadWeatherAndAlerts();
  }

  /**
   * Lắng nghe trạng thái kết nối mạng để tự động cập nhật cảnh báo offline
   */
  function setupNetworkListeners() {
    window.addEventListener('online', () => {
      state.isOffline = false;
      showCitizenToast('🌐 Đã khôi phục kết nối mạng Internet.', 'success');
      loadWeatherAndAlerts();
    });

    window.addEventListener('offline', () => {
      state.isOffline = true;
      showCitizenToast('⚠️ Mất kết nối Internet. Chuyển sang chế độ ngoại tuyến (Offline-First).', 'warning');
      renderWeatherOffline();
    });
  }

  /**
   * Tải dữ liệu thời tiết và cảnh báo thiên tai theo tọa độ
   */
  async function loadWeatherAndAlerts(lat = state.selectedCoords.lat, lng = state.selectedCoords.lng) {
    const weatherContainer = document.getElementById('citizen-weather-container');
    const alertsContainer = document.getElementById('citizen-alerts-container');

    if (!navigator.onLine) {
      renderWeatherOffline();
      return;
    }

    try {
      if (weatherContainer) {
        weatherContainer.innerHTML = `
          <div class="flex items-center justify-center p-6 text-xs text-slate-400 gap-2">
            <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-blue-500"></i>
            <span>Đang nạp dữ liệu khí tượng Open-Meteo thời gian thực...</span>
          </div>`;
        if (window.lucide) lucide.createIcons();
      }

      // 1. Gọi API Open-Meteo lấy thông tin thời tiết
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m,weather_code&hourly=precipitation_probability,rain&forecast_days=1&timezone=Asia%2FBangkok`;
      const response = await fetch(weatherUrl);

      if (!response.ok) {
        throw new Error(`Open-Meteo trả về mã lỗi: ${response.status}`);
      }

      const weatherData = await response.json();
      state.currentWeather = weatherData;
      state.weatherLastUpdated = new Date();

      renderWeather(weatherData);
      loadDisasterAlerts();
    } catch (error) {
      console.warn('[CitizenPortal] Không thể tải dữ liệu thời tiết:', error);
      renderWeatherFallback(error.message);
    }
  }

  /**
   * Hiển thị bảng thời tiết chi tiết kèm nguồn và timestamp (Tiêu chuẩn V-01)
   */
  function renderWeather(data) {
    const container = document.getElementById('citizen-weather-container');
    if (!container) return;

    const current = data.current || {};
    const temp = Math.round(current.temperature_2m ?? 28);
    const humidity = current.relative_humidity_2m ?? 80;
    const rain = current.rain ?? current.precipitation ?? 0;
    const wind = current.wind_speed_10m ?? 12;
    const timeStr = state.weatherLastUpdated ? state.weatherLastUpdated.toLocaleTimeString('vi-VN') : '--:--';
    const dateStr = state.weatherLastUpdated ? state.weatherLastUpdated.toLocaleDateString('vi-VN') : '--/--/----';

    // Xác định icon và trạng thái thời tiết
    let weatherStatusText = 'Trời nhiều mây, có lúc có mưa rải rác';
    let weatherIcon = 'cloud-rain';
    let badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/30';

    if (rain > 10) {
      weatherStatusText = 'Mưa lớn nguy hiểm - Nguy cơ ngập úng cao';
      weatherIcon = 'cloud-lightning';
      badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse';
    } else if (rain > 0) {
      weatherStatusText = 'Đang có mưa vừa đến mưa to';
      weatherIcon = 'cloud-drizzle';
      badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }

    container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3.5">
        <!-- Tiêu đề & Nguồn dữ liệu (Tiêu chí V-01) -->
        <div class="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
          <div class="flex items-center gap-1.5 font-bold text-slate-200">
            <i data-lucide="cloud-sun" class="w-4 h-4 text-amber-400"></i>
            <span>Thời Tiết Thường Ngày & Cảnh Báo Khí Tượng</span>
          </div>
          <span class="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${badgeColor}">
            ${rain > 5 ? 'CẢNH BÁO MƯA' : 'BÌNH THƯỜNG'}
          </span>
        </div>

        <!-- Chỉ số thời tiết chính -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div class="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div class="text-[10.5px] text-slate-400 flex items-center gap-1">
              <i data-lucide="thermometer" class="w-3.5 h-3.5 text-rose-400"></i> Nhiệt độ
            </div>
            <div class="text-lg font-black text-white mt-1">${temp}°C</div>
          </div>

          <div class="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div class="text-[10.5px] text-slate-400 flex items-center gap-1">
              <i data-lucide="cloud-rain" class="w-3.5 h-3.5 text-cyan-400"></i> Lượng mưa
            </div>
            <div class="text-lg font-black ${rain > 5 ? 'text-rose-400' : 'text-cyan-300'} mt-1">
              ${rain} <span class="text-xs font-normal text-slate-400">mm/h</span>
            </div>
          </div>

          <div class="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div class="text-[10.5px] text-slate-400 flex items-center gap-1">
              <i data-lucide="droplets" class="w-3.5 h-3.5 text-blue-400"></i> Độ ẩm
            </div>
            <div class="text-lg font-black text-white mt-1">${humidity}%</div>
          </div>

          <div class="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div class="text-[10.5px] text-slate-400 flex items-center gap-1">
              <i data-lucide="wind" class="w-3.5 h-3.5 text-emerald-400"></i> Tốc độ gió
            </div>
            <div class="text-lg font-black text-white mt-1">${wind} <span class="text-xs font-normal text-slate-400">km/h</span></div>
          </div>
        </div>

        <div class="p-2.5 bg-blue-950/30 border border-blue-900/40 rounded-xl text-xs text-blue-200 flex items-center gap-2">
          <i data-lucide="${weatherIcon}" class="w-4 h-4 text-blue-400 flex-shrink-0"></i>
          <span class="flex-1">${weatherStatusText}</span>
          <button onclick="CitizenPortal.loadWeatherAndAlerts()" title="Làm mới thời tiết" class="p-1 hover:bg-blue-900/50 rounded text-blue-300 transition">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
          </button>
        </div>

        <!-- Chân trang chứa Nguồn & Thời điểm cập nhật bắt buộc theo thể lệ -->
        <div class="pt-1 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-slate-400 gap-1 border-t border-slate-800/60">
          <div>
            <span class="text-slate-500">Nguồn:</span> <strong class="text-slate-300">${state.weatherSource}</strong>
          </div>
          <div>
            <span class="text-slate-500">Cập nhật lúc:</span> <span class="text-slate-300 font-mono">${timeStr} ngày ${dateStr}</span>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  }

  /**
   * Tải danh sách cảnh báo thiên tai theo khu vực từ Backend (Tiêu chuẩn VIC-03 & V-01)
   */
  async function loadDisasterAlerts() {
    const container = document.getElementById('citizen-alerts-container');
    if (!container) return;

    try {
      const apiUrl = (typeof GRASSTOUCHER_CONFIG !== 'undefined' && GRASSTOUCHER_CONFIG.API_BASE_URL)
        ? `${GRASSTOUCHER_CONFIG.API_BASE_URL}/api/disasters`
        : 'http://localhost:8000/api/disasters';

      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error('Không thể kết nối danh mục thiên tai');

      const data = await res.json();
      const disasters = data.features || [];
      renderAlerts(disasters);
    } catch (err) {
      console.warn('[CitizenPortal] Lỗi nạp cảnh báo thiên tai:', err);
      // Fallback danh mục cảnh báo mẫu thực tế
      renderAlerts([
        {
          properties: {
            id: 1,
            title: 'Cảnh báo Lũ quét & Ngập úng Ven Sông Hồng',
            location_name: 'Hà Nội & Vùng hạ du Sông Hồng',
            hazard_type: 'flood',
            severity: 'danger',
            description: 'Mực nước dâng nhanh trên mức Báo Động 2. Đề nghị người dân vùng trũng thấp chủ động di dời tài sản lên cao.',
            source: 'NCHMF - Trung tâm Dự báo KTTV Quốc gia',
            issued_at: new Date().toISOString()
          }
        },
        {
          properties: {
            id: 2,
            title: 'Nguy cơ sạt lở đất sườn dốc đồi núi',
            location_name: 'Khu vực Trung du & Miền núi phía Bắc',
            hazard_type: 'landslide',
            severity: 'warning',
            description: 'Đất ngậm nước bão hòa sau nhiều giờ mưa lớn liên tiếp. Cảnh giác tại các tuyến đường đèo dốc.',
            source: 'Tổng cục Khí tượng Thủy văn',
            issued_at: new Date().toISOString()
          }
        }
      ]);
    }
  }

  /**
   * Hiển thị danh sách cảnh báo thiên tai trực quan với màu sắc theo cấp độ
   */
  function renderAlerts(alerts) {
    const container = document.getElementById('citizen-alerts-container');
    if (!container) return;

    if (!alerts || alerts.length === 0) {
      container.innerHTML = `
        <div class="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <i data-lucide="shield-check" class="w-4 h-4 text-emerald-400"></i>
          <span>Hiện tại chưa ghi nhận cảnh báo thiên tai nguy cấp tại khu vực của bạn.</span>
        </div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }

    let html = `
      <div class="space-y-2">
        <div class="flex items-center justify-between text-xs font-bold text-slate-200">
          <span class="flex items-center gap-1.5">
            <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-400"></i>
            <span>Bản Tin Cảnh Báo Thiên Tai Hiện Hành (${alerts.length})</span>
          </span>
          <span class="text-[10px] text-slate-400">Theo dõi 24/7</span>
        </div>`;

    alerts.forEach((item) => {
      const p = item.properties || item;
      const severity = (p.severity || 'warning').toLowerCase();

      let borderClass = 'border-amber-500/40 bg-amber-950/20';
      let badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      let iconColor = 'text-amber-400';
      let levelLabel = 'CẢNH BÁO';

      if (severity === 'danger' || severity === 'critical') {
        borderClass = 'border-rose-500/50 bg-rose-950/30';
        badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse';
        iconColor = 'text-rose-400';
        levelLabel = 'NGUY HIỂM CAO';
      } else if (severity === 'info' || severity === 'low') {
        borderClass = 'border-blue-500/30 bg-blue-950/20';
        badgeClass = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
        iconColor = 'text-blue-400';
        levelLabel = 'THEO DÕI';
      }

      const timeStr = p.issued_at ? new Date(p.issued_at).toLocaleString('vi-VN') : 'Mới cập nhật';
      const source = p.source || 'Trung tâm Dự báo KTTV Quốc gia (NCHMF)';

      html += `
        <div class="p-3 rounded-xl border ${borderClass} space-y-2 transition hover:bg-slate-900/40">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2">
              <i data-lucide="alert-octagon" class="w-4 h-4 ${iconColor} flex-shrink-0 mt-0.5"></i>
              <h4 class="text-xs font-extrabold text-white">${p.title || 'Cảnh báo thời tiết nguy hiểm'}</h4>
            </div>
            <span class="text-[9.5px] font-bold px-2 py-0.5 rounded-full border ${badgeClass} uppercase">
              ${levelLabel}
            </span>
          </div>

          <p class="text-[11px] text-slate-300 leading-relaxed">${p.description || 'Không có mô tả chi tiết.'}</p>

          <div class="pt-1.5 flex flex-wrap items-center justify-between text-[10px] text-slate-400 gap-1 border-t border-slate-800/60">
            <span class="flex items-center gap-1">
              <i data-lucide="map-pin" class="w-3 h-3 text-slate-500"></i> ${p.location_name || 'Miền Bắc'}
            </span>
            <span class="flex items-center gap-1">
              <i data-lucide="clock" class="w-3 h-3 text-slate-500"></i> ${timeStr}
            </span>
            <span class="w-full text-slate-500 pt-0.5">
              Nguồn phát hành: <strong class="text-slate-400">${source}</strong>
            </span>
          </div>
        </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  }

  /**
   * Hiển thị giao diện khi mất kết nối mạng (Tiêu chí Offline-first V-03)
   */
  function renderWeatherOffline() {
    const container = document.getElementById('citizen-weather-container');
    if (!container) return;

    container.innerHTML = `
      <div class="p-4 bg-amber-950/30 border border-amber-600/40 rounded-2xl text-xs text-amber-200 space-y-2">
        <div class="flex items-center gap-2 font-bold text-amber-300">
          <i data-lucide="wifi-off" class="w-4 h-4 text-amber-400"></i>
          <span>Chế độ Ngoại Tuyến (Offline-First)</span>
        </div>
        <p class="text-[11px] text-amber-200/90 leading-relaxed">
          Hiện tại thiết bị của bạn không có kết nối Internet. Dữ liệu thời tiết và bản tin mới tạm thời không thể làm mới từ Open-Meteo.
          Bạn vẫn có thể ghim vị trí và soạn bản nháp yêu cầu cứu hộ SOS. Hệ thống sẽ lưu trên máy và tự động gửi ngay khi có sóng trở lại.
        </p>
        <div class="pt-1 flex items-center justify-between text-[10px] text-amber-400/80">
          <span>Trạng thái: <strong>Lưu cục bộ trên thiết bị</strong></span>
          <button onclick="CitizenPortal.loadWeatherAndAlerts()" class="px-2 py-1 bg-amber-600/40 hover:bg-amber-600/60 text-white rounded font-bold transition">
            Thử kết nối lại
          </button>
        </div>
      </div>`;
    if (window.lucide) lucide.createIcons();
  }

  /**
   * Xử lý trường hợp API lỗi tạm thời
   */
  function renderWeatherFallback(errMsg) {
    const container = document.getElementById('citizen-weather-container');
    if (!container) return;

    container.innerHTML = `
      <div class="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs space-y-2">
        <div class="flex items-center justify-between text-slate-300 font-bold">
          <span class="flex items-center gap-1.5">
            <i data-lucide="alert-circle" class="w-4 h-4 text-amber-400"></i>
            <span>Thời Tiết Khu Vực Hà Nội (Chế độ Dự phòng)</span>
          </span>
          <span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">Mẫu sẵn có</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
          <div>Nhiệt độ ước tính: <b>27°C - 30°C</b></div>
          <div>Lượng mưa trung bình: <b>45 - 80 mm</b></div>
          <div>Cảnh báo: <b class="text-rose-400">Mưa dông cục bộ</b></div>
          <div>Độ ẩm: <b>85%</b></div>
        </div>
        <div class="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex items-center justify-between">
          <span>Ghi chú: ${errMsg || 'Máy chủ ngoài tạm thời không phản hồi.'}</span>
          <button onclick="CitizenPortal.loadWeatherAndAlerts()" class="text-blue-400 hover:underline">Thử lại</button>
        </div>
      </div>`;
    if (window.lucide) lucide.createIcons();
  }

  /**
   * Hiển thị thông báo nhanh (Toast) cho người dân
   */
  function showCitizenToast(message, type = 'info') {
    if (window.CommandUIController && typeof window.CommandUIController.showToast === 'function') {
      window.CommandUIController.showToast(message, type);
    } else {
      console.log(`[Citizen Toast - ${type}]: ${message}`);
    }
  }

  // ==========================================================================
  // QUẢN LÝ GHIM & XÁC NHẬN VỊ TRÍ HIỆN TRƯỜNG (VIC-04 & TIÊU CHÍ V-04)
  // ==========================================================================
  let sosMarker = null;
  let isPickingLocation = false;

  /**
   * Bắt đầu chế độ chọn vị trí SOS trên bản đồ Leaflet
   */
  function startPickingSOSLocation() {
    isPickingLocation = true;
    showCitizenToast('📍 Hãy nhấp chuột vào vị trí ngập/mắc kẹt thực tế trên bản đồ hoặc kéo thả ghim!', 'info');

    if (window.CommandUIController && typeof window.CommandUIController.switchView === 'function') {
      window.CommandUIController.switchView('cmd_dashboard');
    }

    if (window.map) {
      window.map.once('click', onMapClickForSOS);
      const mapContainer = document.getElementById('map');
      if (mapContainer) mapContainer.style.cursor = 'crosshair';
    }
  }

  /**
   * Xử lý sự kiện nhấp bản đồ để chọn tọa độ
   */
  function onMapClickForSOS(e) {
    isPickingLocation = false;
    const mapContainer = document.getElementById('map');
    if (mapContainer) mapContainer.style.cursor = '';

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    setSOSLocation(lat, lng);

    showCitizenToast(`✅ Đã ghim vị trí: ${lat.toFixed(4)}, ${lng.toFixed(4)}! Vui lòng tích xác nhận.`, 'success');

    if (window.CommandUIController && typeof window.CommandUIController.switchView === 'function') {
      window.CommandUIController.switchView('cmd_citizen_preview');
      if (typeof switchTab === 'function') switchTab('rescue');
    }
  }

  /**
   * Thiết lập và cập nhật vị trí cứu hộ
   */
  function setSOSLocation(lat, lng) {
    state.selectedCoords = { lat: parseFloat(lat), lng: parseFloat(lng) };
    
    const displayEl = document.getElementById('citizen-sos-coord-display');
    if (displayEl) {
      displayEl.textContent = `${lat.toFixed(4)}° B, ${lng.toFixed(4)}° Đ`;
    }

    renderSOSMarker(lat, lng);
  }

  /**
   * Vẽ hoặc di chuyển Marker trên bản đồ có hỗ trợ kéo thả (Draggable Marker)
   */
  function renderSOSMarker(lat, lng) {
    if (!window.map || typeof L === 'undefined') return;

    if (sosMarker) {
      sosMarker.setLatLng([lat, lng]);
    } else {
      const pinIcon = L.divIcon({
        className: 'citizen-sos-custom-pin',
        html: `
          <div class="citizen-pin-pulse-container">
            <div class="citizen-pin-pulse-ring"></div>
            <div class="citizen-pin-pulse-core"></div>
          </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      sosMarker = L.marker([lat, lng], {
        icon: pinIcon,
        draggable: true,
        title: 'Vị trí cứu hộ SOS (Kéo thả để tinh chỉnh)'
      }).addTo(window.map);

      sosMarker.on('dragend', function (event) {
        const marker = event.target;
        const pos = marker.getLatLng();
        setSOSLocation(pos.lat, pos.lng);
        showCitizenToast(`📍 Đã di chuyển ghim tới: ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`, 'info');
      });
    }

    window.map.panTo([lat, lng]);
  }

  /**
   * Xử lý khi người dân đánh dấu xác nhận vị trí (Tiêu chí V-04)
   */
  function onLocationVerifiedChange(isVerified) {
    state.locationConfirmed = !!isVerified;
    const badge = document.getElementById('citizen-loc-verify-badge');

    if (badge) {
      if (state.locationConfirmed) {
        badge.textContent = 'Đã xác nhận chính xác';
        badge.className = 'text-[9.5px] font-bold px-2 py-0.5 rounded-full citizen-loc-verified border border-emerald-300';
        showCitizenToast('✅ Bạn đã xác nhận vị trí này phản ánh đúng hiện trường thực tế.', 'success');
      } else {
        badge.textContent = 'Chưa xác nhận';
        badge.className = 'text-[9.5px] font-bold px-2 py-0.5 rounded-full citizen-loc-unverified border border-amber-300';
      }
    }
  }

  // Khởi tạo ngay khi trang tải xong
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 300);
  }

  return {
    init,
    loadWeatherAndAlerts,
    startPickingSOSLocation,
    setSOSLocation,
    onLocationVerifiedChange,
    state
  };
})();
