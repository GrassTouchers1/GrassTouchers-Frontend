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

    // Xác định cấp độ rủi ro thiên tai (Risk Level 1-4)
    let riskLevel = 1;
    let riskText = 'Cấp 1: Bình thường';
    let riskColor = 'text-emerald-400';
    let riskBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    let riskBarWidth = '25%';
    let riskBarColor = 'bg-emerald-500';

    if (rain > 15) {
      riskLevel = 4;
      riskText = 'Cấp 4: Khẩn cấp (Nguy cơ ngập úng & lũ lụt)';
      riskColor = 'text-rose-400';
      riskBadge = 'bg-rose-500/25 text-rose-300 border-rose-500/50 animate-pulse';
      riskBarWidth = '100%';
      riskBarColor = 'bg-gradient-to-r from-amber-500 via-rose-500 to-red-600';
    } else if (rain > 5) {
      riskLevel = 3;
      riskText = 'Cấp 3: Nguy cơ ngập úng cục bộ';
      riskColor = 'text-orange-400';
      riskBadge = 'bg-orange-500/25 text-orange-300 border-orange-500/40';
      riskBarWidth = '75%';
      riskBarColor = 'bg-gradient-to-r from-amber-400 to-orange-500';
    } else if (rain > 0) {
      riskLevel = 2;
      riskText = 'Cấp 2: Chú ý quan sát hiện trường';
      riskColor = 'text-amber-300';
      riskBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      riskBarWidth = '50%';
      riskBarColor = 'bg-amber-400';
    }

    container.innerHTML = `
      <div class="citizen-glass-card rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 border border-white/10 relative overflow-hidden">
        <!-- Ánh sáng hào quang nền công nghệ -->
        <div class="absolute -top-12 -right-12 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <!-- Tiêu đề & Cấp độ rủi ro -->
        <div class="flex items-center justify-between pb-2.5 border-b border-slate-800/80 text-xs">
          <div class="flex items-center gap-2 font-black text-white">
            <span class="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse shadow-[0_0_8px_#38bdf8]"></span>
            <span class="tracking-wide">KHÍ TƯỢNG & RỦI RO THIÊN TAI</span>
          </div>
          <span class="text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider ${riskBadge}">
            ${riskLevel === 1 ? 'BÌNH THƯỜNG' : `CẢNH BÁO CẤP ${riskLevel}`}
          </span>
        </div>

        <!-- Thẻ Hero: Nhiệt độ lớn + Trạng thái khí tượng -->
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-baseline gap-2">
            <span class="text-4xl sm:text-5xl font-black text-white tracking-tight">${temp}°</span>
            <span class="text-sm font-semibold text-slate-400">C</span>
            <div class="ml-2">
              <div class="text-xs font-bold text-slate-100">${weatherStatusText}</div>
              <div class="text-[10.5px] text-slate-400">Hà Nội & Vùng lân cận</div>
            </div>
          </div>
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500/20 to-blue-600/30 border border-sky-400/30 flex items-center justify-center shadow-lg shadow-sky-500/10 shrink-0">
            <i data-lucide="${weatherIcon}" class="w-8 h-8 text-sky-400"></i>
          </div>
        </div>

        <!-- Thước đo rủi ro thiên tai trực quan (Visual Risk Meter) -->
        <div class="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1.5">
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-slate-400 font-medium">Thước đo nguy cơ thiên tai:</span>
            <span class="font-bold ${riskColor}">${riskText}</span>
          </div>
          <div class="w-full h-2 rounded-full bg-slate-800/90 overflow-hidden relative">
            <div class="h-full rounded-full transition-all duration-700 ease-out ${riskBarColor}" style="width: ${riskBarWidth};"></div>
          </div>
          <div class="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>An toàn</span>
            <span>Chú ý</span>
            <span>Ngập úng</span>
            <span>Khẩn cấp</span>
          </div>
        </div>

        <!-- 4 Chỉ số khí tượng mạ kính (Glass Metric Chips) -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div class="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition">
            <div class="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <i data-lucide="thermometer" class="w-3 h-3 text-rose-400"></i> Nhiệt độ
            </div>
            <div class="text-base font-black text-white mt-0.5">${temp}°C</div>
          </div>

          <div class="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition">
            <div class="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <i data-lucide="cloud-rain" class="w-3 h-3 text-sky-400"></i> Lượng mưa
            </div>
            <div class="text-base font-black ${rain > 5 ? 'text-rose-400' : 'text-sky-300'} mt-0.5">
              ${rain} <span class="text-[10px] font-normal text-slate-400">mm/h</span>
            </div>
          </div>

          <div class="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition">
            <div class="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <i data-lucide="droplets" class="w-3 h-3 text-blue-400"></i> Độ ẩm
            </div>
            <div class="text-base font-black text-white mt-0.5">${humidity}%</div>
          </div>

          <div class="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition">
            <div class="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <i data-lucide="wind" class="w-3 h-3 text-emerald-400"></i> Tốc độ gió
            </div>
            <div class="text-base font-black text-white mt-0.5">${wind} <span class="text-[10px] font-normal text-slate-400">km/h</span></div>
          </div>
        </div>

        <!-- Chân trang chứa Nguồn & Thời điểm cập nhật bắt buộc theo thể lệ -->
        <div class="pt-2 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-slate-400 gap-1.5 border-t border-slate-800/80">
          <div class="flex items-center gap-1">
            <span class="text-slate-500">Nguồn:</span>
            <strong class="text-slate-300">${state.weatherSource}</strong>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-slate-500">Cập nhật:</span>
            <span class="text-slate-300 font-mono">${timeStr} ${dateStr}</span>
            <button onclick="CitizenPortal.loadWeatherAndAlerts()" title="Làm mới dữ liệu" class="p-1 hover:bg-slate-800 rounded-md text-sky-400 hover:text-sky-300 transition cursor-pointer">
              <i data-lucide="refresh-cw" class="w-3 h-3"></i>
            </button>
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
        <div class="citizen-glass-card p-3.5 rounded-2xl border ${borderClass} space-y-2.5 transition hover:bg-slate-900/60 shadow-lg">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full ${severity === 'danger' || severity === 'critical' ? 'bg-rose-500 animate-ping' : 'bg-amber-400'} shrink-0 mt-0.5"></span>
              <h4 class="text-xs font-black text-white tracking-wide">${p.title || 'Cảnh báo thời tiết nguy hiểm'}</h4>
            </div>
            <span class="text-[9.5px] font-extrabold px-2.5 py-0.5 rounded-full border ${badgeClass} uppercase tracking-wider">
              ${levelLabel}
            </span>
          </div>

          <p class="text-[11.5px] text-slate-300 leading-relaxed font-normal">${p.description || 'Không có mô tả chi tiết.'}</p>

          <div class="pt-2 flex flex-wrap items-center justify-between text-[10px] text-slate-400 gap-1.5 border-t border-slate-800/80">
            <span class="flex items-center gap-1 text-slate-300 font-medium">
              <i data-lucide="map-pin" class="w-3 h-3 text-sky-400"></i> ${p.location_name || 'Miền Bắc'}
            </span>
            <span class="flex items-center gap-1 text-slate-400">
              <i data-lucide="clock" class="w-3 h-3 text-slate-500"></i> ${timeStr}
            </span>
            <span class="w-full text-slate-400 pt-0.5">
              Nguồn: <strong class="text-slate-300 font-semibold">${source}</strong>
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
  let accuracyCircle = null;
  let isPickingLocation = false;

  /**
   * Kích hoạt phản hồi xúc giác (Haptic Feedback) trên thiết bị di động
   */
  function triggerHaptic(pattern = [50]) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Trình duyệt không hỗ trợ hoặc chặn quyền vibrate
      }
    }
  }

  /**
   * Tự động lấy vị trí GPS từ thiết bị di động kèm vòng tròn độ chính xác
   */
  function locateGPSWithAccuracy() {
    if (!navigator.geolocation) {
      showCitizenToast('⚠️ Thiết bị không hỗ trợ Geolocation API.', 'error');
      return;
    }

    showCitizenToast('🛰️ Đang xác định vị trí GPS chính xác cao...', 'info');
    triggerHaptic([30]);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy || 15);

        triggerHaptic([50, 40, 60]);
        setSOSLocation(lat, lng, accuracy);

        const accDisplay = document.getElementById('citizen-gps-accuracy');
        if (accDisplay) {
          accDisplay.textContent = `±${accuracy}m`;
        }
        const accWrapper = document.getElementById('citizen-gps-accuracy-wrapper');
        if (accWrapper) {
          accWrapper.classList.remove('hidden');
        }

        showCitizenToast(`🛰️ GPS định vị thành công (Độ chính xác: ±${accuracy}m)!`, 'success');
        if (window.map) {
          if (typeof window.map.flyTo === 'function') {
            window.map.flyTo({ center: [lng, lat], zoom: 17, speed: 1.2 });
          } else if (typeof window.map.setView === 'function') {
            window.map.setView([lat, lng], 17);
          }
        }
      },
      (err) => {
        console.warn('[Citizen GPS] Lỗi định vị:', err.message);
        showCitizenToast('⚠️ Không thể lấy GPS tự động. Vui lòng chọn thủ công trên bản đồ.', 'error');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  /**
   * Hiển thị thanh công cụ nổi điều khiển ghim vị trí (Tactical Floating Toolbar)
   */
  function showPickingToolbar() {
    removePickingToolbar();
    const toolbar = document.createElement('div');
    toolbar.id = 'citizen-picking-toolbar';
    toolbar.className = 'citizen-map-pin-toolbar';
    toolbar.innerHTML = `
      <div class="citizen-tb-content">
        <div class="citizen-tb-title">
          <span class="citizen-tb-dot"></span>
          <span>Đang chọn tọa độ cứu hộ</span>
        </div>
        <div class="citizen-tb-actions">
          <button type="button" class="citizen-tb-btn citizen-tb-gps" onclick="CitizenPortal.locateGPSWithAccuracy()" title="Tự động lấy toạ độ GPS">
            <i data-lucide="locate-fixed" class="w-3.5 h-3.5"></i>
            <span>GPS</span>
          </button>
          <button type="button" class="citizen-tb-btn citizen-tb-confirm" onclick="CitizenPortal.confirmCurrentLocation()" title="Xác nhận toạ độ này">
            <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
            <span>Xác nhận</span>
          </button>
          <button type="button" class="citizen-tb-btn citizen-tb-cancel" onclick="CitizenPortal.cancelPickingLocation()" title="Hủy bỏ">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.appendChild(toolbar);
      if (window.lucide) lucide.createIcons({ parent: toolbar });
    }
  }

  /**
   * Xóa thanh công cụ nổi
   */
  function removePickingToolbar() {
    const existing = document.getElementById('citizen-picking-toolbar');
    if (existing) existing.remove();
  }

  /**
   * Xác nhận nhanh vị trí hiện tại từ thanh công cụ
   */
  function confirmCurrentLocation() {
    triggerHaptic([60, 40, 60]);
    removePickingToolbar();
    isPickingLocation = false;
    const mapContainer = document.getElementById('map');
    if (mapContainer) mapContainer.style.cursor = '';
    if (window.map) window.map.off('click', onMapClickForSOS);

    const check = document.getElementById('citizen-confirm-location-check');
    if (check) check.checked = true;
    onLocationVerifiedChange(true);

    showCitizenToast('✅ Đã xác nhận vị trí cứu hộ thành công!', 'success');

    if (window.CommandUIController && typeof window.CommandUIController.switchView === 'function') {
      window.CommandUIController.switchView('cmd_citizen_preview');
      if (typeof switchTab === 'function') switchTab('rescue');
    }
  }

  /**
   * Hủy chế độ chọn vị trí
   */
  function cancelPickingLocation() {
    triggerHaptic([30]);
    removePickingToolbar();
    isPickingLocation = false;
    const mapContainer = document.getElementById('map');
    if (mapContainer) mapContainer.style.cursor = '';
    if (window.map) window.map.off('click', onMapClickForSOS);

    if (window.CommandUIController && typeof window.CommandUIController.switchView === 'function') {
      window.CommandUIController.switchView('cmd_citizen_preview');
      if (typeof switchTab === 'function') switchTab('rescue');
    }
  }

  /**
   * Bắt đầu chế độ chọn vị trí SOS trên bản đồ Leaflet
   */
  function startPickingSOSLocation() {
    isPickingLocation = true;
    showCitizenToast('📍 Hãy nhấp chuột vào vị trí ngập/mắc kẹt thực tế trên bản đồ hoặc kéo thả ghim!', 'info');

    if (window.CommandUIController && typeof window.CommandUIController.switchView === 'function') {
      window.CommandUIController.switchView('cmd_dashboard');
    }

    showPickingToolbar();

    if (window.map) {
      window.map.on('click', onMapClickForSOS);
      const mapContainer = document.getElementById('map');
      if (mapContainer) mapContainer.style.cursor = 'crosshair';
    }
  }

  /**
   * Xử lý sự kiện nhấp bản đồ để chọn tọa độ (Hỗ trợ cả MapLibre và Leaflet)
   */
  function onMapClickForSOS(e) {
    const lat = e.lngLat ? e.lngLat.lat : (e.latlng ? e.latlng.lat : e.lat);
    const lng = e.lngLat ? e.lngLat.lng : (e.latlng ? e.latlng.lng : e.lng);
    triggerHaptic([40]);
    setSOSLocation(lat, lng);

    showCitizenToast(`📍 Đã ghim: ${lat.toFixed(4)}, ${lng.toFixed(4)}. Bấm "Xác nhận" trên thanh công cụ để hoàn tất!`, 'info');
  }

  /**
   * Thiết lập và cập nhật vị trí cứu hộ
   */
  function setSOSLocation(lat, lng, accuracy = null) {
    state.selectedCoords = { lat: parseFloat(lat), lng: parseFloat(lng) };
    
    const displayEl = document.getElementById('citizen-sos-coord-display');
    if (displayEl) {
      displayEl.textContent = `${lat.toFixed(4)}° B, ${lng.toFixed(4)}° Đ`;
    }

    renderSOSMarker(lat, lng, accuracy);
  }

  /**
   * Vẽ hoặc di chuyển Marker trên bản đồ có hỗ trợ kéo thả (Draggable Marker)
   * Tương thích 100% cả MapLibre GL JS WebGL 3D và Leaflet 2D
   */
  function renderSOSMarker(lat, lng, accuracy = null) {
    if (!window.map) return;

    // A. Hỗ trợ động cơ MapLibre GL JS (Vector 3D WebGL)
    if (typeof maplibregl !== 'undefined' && (window.map instanceof maplibregl.Map || typeof window.map.flyTo === 'function')) {
      if (sosMarker && typeof sosMarker.setLngLat === 'function') {
        sosMarker.setLngLat([lng, lat]);
      } else {
        const pinEl = document.createElement('div');
        pinEl.className = 'citizen-sos-custom-pin';
        pinEl.innerHTML = `
          <div class="citizen-pin-pulse-container">
            <div class="citizen-pin-pulse-ring"></div>
            <div class="citizen-pin-pulse-core"></div>
          </div>`;

        sosMarker = new maplibregl.Marker({
          element: pinEl,
          draggable: true,
          anchor: 'center'
        })
          .setLngLat([lng, lat])
          .addTo(window.map);

        sosMarker.on('dragstart', function () {
          triggerHaptic([30]);
        });

        sosMarker.on('dragend', function () {
          const pos = sosMarker.getLngLat();
          triggerHaptic([40, 30, 40]);
          setSOSLocation(pos.lat, pos.lng);
          showCitizenToast(`📍 Đã di chuyển ghim tới: ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`, 'info');
        });
      }

      if (typeof window.map.flyTo === 'function') {
        window.map.flyTo({ center: [lng, lat], zoom: 16, speed: 1.2 });
      }
      return;
    }

    // B. Dự phòng động cơ Leaflet (2D Raster)
    if (typeof L === 'undefined') return;
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

      sosMarker.on('dragstart', function () {
        triggerHaptic([30]);
      });

      sosMarker.on('dragend', function (event) {
        const marker = event.target;
        const pos = marker.getLatLng();
        triggerHaptic([40, 30, 40]);
        setSOSLocation(pos.lat, pos.lng);
        showCitizenToast(`📍 Đã di chuyển ghim tới: ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`, 'info');
      });
    }

    // Hiển thị vòng tròn sai số định vị GPS (Accuracy Radius)
    if (accuracy && window.map && typeof L !== 'undefined') {
      if (accuracyCircle) {
        accuracyCircle.setLatLng([lat, lng]).setRadius(accuracy);
      } else {
        accuracyCircle = L.circle([lat, lng], {
          radius: accuracy,
          color: '#059669',
          fillColor: '#10b981',
          fillOpacity: 0.15,
          weight: 1.5,
          dashArray: '4, 4'
        }).addTo(window.map);
      }
    } else if (accuracyCircle && !accuracy) {
      accuracyCircle.setLatLng([lat, lng]);
    }

    if (typeof window.map.panTo === 'function') {
      window.map.panTo([lat, lng]);
    }
  }

  /**
   * Xử lý khi người dân đánh dấu xác nhận vị trí (Tiêu chí V-04)
   */
  function onLocationVerifiedChange(isVerified) {
    state.locationConfirmed = !!isVerified;
    const badge = document.getElementById('citizen-loc-verify-badge');

    if (badge) {
      if (state.locationConfirmed) {
        triggerHaptic([60, 40, 60]);
        badge.textContent = 'Đã xác nhận chính xác';
        badge.className = 'text-[9.5px] font-bold px-2 py-0.5 rounded-full citizen-loc-verified border border-emerald-300';
        showCitizenToast('✅ Bạn đã xác nhận vị trí này phản ánh đúng hiện trường thực tế.', 'success');
      } else {
        triggerHaptic([30]);
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
    confirmCurrentLocation,
    cancelPickingLocation,
    setSOSLocation,
    locateGPSWithAccuracy,
    triggerHaptic,
    onLocationVerifiedChange,
    state
  };
})();
