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

  // Trạng thái nội bộ của phân hệ Citizen (CIT-02: Không khởi tạo tọa độ mặc định)
  const GPS_STATES = {
    UNKNOWN: 'UNKNOWN',
    LOCATING: 'LOCATING',
    GPS_DETECTED: 'GPS_DETECTED',
    MANUAL_SELECTED: 'MANUAL_SELECTED',
    USER_CONFIRMED: 'USER_CONFIRMED',
    LOCATION_ERROR: 'LOCATION_ERROR'
  };

  const WEATHER_TTL_MS = 30 * 60 * 1000; // 30 phút
  const DISASTER_TTL_MS = 60 * 60 * 1000; // 60 phút
  const REFRESH_COOLDOWN_MS = 15 * 1000; // 15 giây chống spam request

  const WEATHER_PRESETS = {
    hanoi: { key: 'hanoi', name: 'Hà Nội', lat: 21.0285, lng: 105.8542 },
    haiphong: { key: 'haiphong', name: 'Hải Phòng', lat: 20.8449, lng: 106.6881 },
    thainguyen: { key: 'thainguyen', name: 'Thái Nguyên', lat: 21.5942, lng: 105.8482 },
    yenbai: { key: 'yenbai', name: 'Yên Bái', lat: 21.7168, lng: 104.8986 },
    laocai: { key: 'laocai', name: 'Lào Cai', lat: 22.4809, lng: 103.9755 }
  };

  const state = {
    selectedCoords: null, // Không dùng tọa độ mặc định làm vị trí nạn nhân
    locationStatus: GPS_STATES.UNKNOWN,
    locationSource: null, // 'gps' | 'manual' | 'approximate' | 'unknown' | null
    locationAccuracy: null, // mét thực tế từ Geolocation API hoặc null
    locationCapturedAt: null, // ISO string
    locationError: null,
    locationConfirmed: false,
    weatherLocationKey: 'hanoi',
    currentWeather: null,
    weatherLastUpdated: null,
    lastWeatherFetchAtMs: 0,
    weatherSource: 'Open-Meteo Weather API (CC-BY 4.0)',
    isOffline: !navigator.onLine,
    activeTab: 'weather'
  };

  /**
   * Khởi tạo phân hệ Citizen
   */
  async function init() {
    setupNetworkListeners();
    await restoreSavedWeatherLocation();
    updateLocationStatusUI();
    loadWeatherAndAlerts();
  }

  async function restoreSavedWeatherLocation() {
    try {
      if (window.OfflineDB && typeof window.OfflineDB.getMetadata === 'function') {
        const saved = await window.OfflineDB.getMetadata('weather_selected_location');
        if (saved && typeof saved === 'string' && (WEATHER_PRESETS[saved] || saved === 'gps')) {
          state.weatherLocationKey = saved;
          const sel = document.getElementById('citizen-weather-location-select');
          if (sel && sel.querySelector(`option[value="${saved}"]`)) {
            sel.value = saved;
          }
        }
      }
    } catch (_) { }
  }

  function getActiveWeatherTarget(explicitLat, explicitLng) {
    if (typeof explicitLat === 'number' && typeof explicitLng === 'number' && Number.isFinite(explicitLat) && Number.isFinite(explicitLng)) {
      return {
        key: `coords_${explicitLat.toFixed(2)}_${explicitLng.toFixed(2)}`,
        name: state.selectedCoords ? 'Vị trí đã chọn' : 'Tọa độ chỉ định',
        lat: explicitLat,
        lng: explicitLng
      };
    }
    if (state.weatherLocationKey === 'gps' && isValidCoordinate(state.selectedCoords)) {
      return {
        key: `gps_${state.selectedCoords.lat.toFixed(2)}_${state.selectedCoords.lng.toFixed(2)}`,
        name: 'Vị trí GPS của bạn',
        lat: state.selectedCoords.lat,
        lng: state.selectedCoords.lng
      };
    }
    const preset = WEATHER_PRESETS[state.weatherLocationKey] || WEATHER_PRESETS.hanoi;
    return {
      key: preset.key,
      name: preset.name,
      lat: preset.lat,
      lng: preset.lng
    };
  }

  function onWeatherLocationChange(key) {
    if (key === 'gps' && !isValidCoordinate(state.selectedCoords)) {
      showCitizenToast('Chưa có tọa độ GPS. Vui lòng lấy GPS ở tab Gửi SOS hoặc chọn tỉnh/thành phố.', 'warning');
      return;
    }
    state.weatherLocationKey = WEATHER_PRESETS[key] || key === 'gps' ? key : 'hanoi';
    if (window.OfflineDB && typeof window.OfflineDB.saveMetadata === 'function') {
      window.OfflineDB.saveMetadata('weather_selected_location', state.weatherLocationKey).catch(() => { });
    }
    loadWeatherAndAlerts(undefined, undefined, { force: true });
  }

  /**
   * Lắng nghe trạng thái kết nối mạng để tự động cập nhật cảnh báo offline
   */
  function setupNetworkListeners() {
    window.addEventListener('online', () => {
      state.isOffline = false;
      showCitizenToast('🌐 Đã khôi phục kết nối mạng Internet.', 'success');
      loadWeatherAndAlerts(undefined, undefined, { force: true });
    });

    window.addEventListener('offline', () => {
      state.isOffline = true;
      showCitizenToast('⚠️ Mất kết nối Internet. Chuyển sang chế độ ngoại tuyến (Offline-First).', 'warning');
      const target = getActiveWeatherTarget();
      renderWeatherFromCacheOrError(target, 'Thiết bị đang ngoại tuyến.');
      loadAlertsFromCacheOrError('Thiết bị đang ngoại tuyến.');
    });
  }

  function formatDisplayTime(isoOrDate) {
    if (!isoOrDate) return 'Không rõ';
    const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return String(isoOrDate);
    return d.toLocaleString('vi-VN');
  }

  function describeWmoWeatherCode(code) {
    const c = Number(code);
    if (!Number.isFinite(c)) return { text: 'Không có dữ liệu trạng thái', icon: 'cloud' };
    if (c === 0) return { text: 'Trời quang, ít mây', icon: 'sun' };
    if (c >= 1 && c <= 3) return { text: 'Có mây, nắng gián đoạn', icon: 'cloud-sun' };
    if (c === 45 || c === 48) return { text: 'Có sương mù', icon: 'cloud' };
    if ((c >= 51 && c <= 57) || (c >= 61 && c <= 63) || (c >= 80 && c <= 81)) return { text: 'Có mưa rào / mưa vừa', icon: 'cloud-drizzle' };
    if ((c >= 65 && c <= 67) || c === 82) return { text: 'Mưa to đến rất to', icon: 'cloud-rain' };
    if (c >= 95) return { text: 'Mưa dông nguy hiểm', icon: 'cloud-lightning' };
    return { text: `Mã thời tiết WMO ${c}`, icon: 'cloud' };
  }

  /**
   * Tải dữ liệu thời tiết và cảnh báo thiên tai theo tọa độ (CIT-07)
   */
  async function loadWeatherAndAlerts(explicitLat, explicitLng, options = {}) {
    const weatherContainer = document.getElementById('citizen-weather-container');
    const target = getActiveWeatherTarget(explicitLat, explicitLng);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await renderWeatherFromCacheOrError(target, 'Thiết bị đang ngoại tuyến.');
      await loadAlertsFromCacheOrError('Thiết bị đang ngoại tuyến.');
      return;
    }

    const nowMs = Date.now();
    if (!options.force && state.lastWeatherFetchAtMs && (nowMs - state.lastWeatherFetchAtMs < REFRESH_COOLDOWN_MS) && state.currentWeather) {
      return;
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

    try {
      if (weatherContainer) {
        weatherContainer.innerHTML = `
          <div class="flex items-center justify-center p-6 text-xs text-slate-400 gap-2 bg-slate-900/70 rounded-2xl border border-slate-800">
            <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-blue-500"></i>
            <span>Đang nạp dữ liệu khí tượng (${target.name})...</span>
          </div>`;
        if (window.lucide) lucide.createIcons();
      }

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${target.lat}&longitude=${target.lng}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,wind_speed_10m,weather_code&hourly=temperature_2m,precipitation_probability,precipitation,rain&forecast_days=1&timezone=Asia%2FBangkok`;
      const response = await fetch(weatherUrl, controller ? { signal: controller.signal } : undefined);
      if (timeoutId) clearTimeout(timeoutId);

      if (!response || !response.ok) {
        throw new Error(`Open-Meteo trả về mã lỗi HTTP ${response ? response.status : 'unknown'}`);
      }

      const weatherData = await response.json();
      if (!weatherData || !weatherData.current) {
        throw new Error('Phản hồi khí tượng thiếu dữ liệu hiện tại (current).');
      }

      const fetchedAt = new Date();
      state.currentWeather = weatherData;
      state.weatherLastUpdated = fetchedAt;
      state.lastWeatherFetchAtMs = fetchedAt.getTime();

      const dataUpdatedAt = weatherData.current.time || null;

      if (typeof window !== 'undefined' && window.OfflineDB && typeof window.OfflineDB.saveWeatherCache === 'function') {
        await window.OfflineDB.saveWeatherCache({
          cache_key: target.key,
          data: weatherData,
          source: state.weatherSource,
          region: target.name,
          coordinates: { lat: target.lat, lng: target.lng },
          data_updated_at: dataUpdatedAt,
          fetched_at: fetchedAt.toISOString(),
          expires_at: fetchedAt.getTime() + WEATHER_TTL_MS
        }).catch(() => { });
      }

      renderWeather(weatherData, {
        isCached: false,
        isExpired: false,
        region: target.name,
        coordinates: { lat: target.lat, lng: target.lng },
        source: state.weatherSource,
        dataUpdatedAt,
        fetchedAt: fetchedAt.toISOString()
      });
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      const errMsg = (error && error.name === 'AbortError') ? 'Hết thời gian chờ kết nối máy chủ thời tiết (Timeout).' : (error && error.message ? error.message : 'Lỗi kết nối API thời tiết.');
      console.warn('[CitizenPortal] Không thể tải dữ liệu thời tiết:', errMsg);
      await renderWeatherFromCacheOrError(target, errMsg);
    }

    await loadDisasterAlerts();
    await loadAIFloodForecast();
  }

  async function renderWeatherFromCacheOrError(target, reason) {
    let cached = null;
    try {
      if (window.OfflineDB && typeof window.OfflineDB.getWeatherCache === 'function') {
        cached = await window.OfflineDB.getWeatherCache(target.key);
        if (!cached && typeof window.OfflineDB.getAllWeatherCache === 'function') {
          const all = await window.OfflineDB.getAllWeatherCache();
          if (Array.isArray(all) && all.length > 0) {
            all.sort((a, b) => Date.parse(b.fetched_at || 0) - Date.parse(a.fetched_at || 0));
            cached = all[0];
          }
        }
      }
    } catch (_) { }

    if (cached && cached.data && cached.data.current) {
      const isExpired = Number.isFinite(cached.expires_at) && Date.now() > cached.expires_at;
      if (!isExpired) {
        renderWeather(cached.data, {
          isCached: true,
          isExpired: false,
          region: cached.region || target.name,
          coordinates: cached.coordinates || { lat: target.lat, lng: target.lng },
          source: cached.source || state.weatherSource,
          dataUpdatedAt: cached.data_updated_at || (cached.data.current && cached.data.current.time) || null,
          fetchedAt: cached.fetched_at || null,
          reason
        });
        return;
      }
      renderWeatherError(
        `Dữ liệu thời tiết đã lưu cho ${cached.region || target.name} đã hết hạn (cập nhật lúc ${formatDisplayTime(cached.fetched_at)}). Không hiển thị dữ liệu cũ như dữ liệu thời gian thực.`,
        true
      );
      return;
    }

    renderWeatherError(reason || 'Không thể lấy dữ liệu thời tiết và chưa có bản lưu ngoại tuyến hợp lệ.', false);
  }

  function renderWeatherError(message, hadExpiredCache) {
    const container = document.getElementById('citizen-weather-container');
    if (!container) return;
    container.innerHTML = `
      <div class="p-4 bg-slate-900/90 border ${hadExpiredCache ? 'border-amber-500/50' : 'border-rose-500/40'} rounded-2xl text-xs space-y-2.5">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 font-bold ${hadExpiredCache ? 'text-amber-300' : 'text-rose-300'}">
            <i data-lucide="cloud-off" class="w-4 h-4 shrink-0"></i>
            <span>${hadExpiredCache ? 'Dữ liệu thời tiết đã hết hạn' : 'Không thể lấy dữ liệu thời tiết'}</span>
          </div>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">NO LIVE DATA</span>
        </div>
        <p class="text-[11px] text-slate-300 leading-relaxed">${message}</p>
        <div class="pt-1 flex items-center justify-between text-[10px] text-slate-400">
          <span>Hệ thống không tạo số liệu giả thay thế.</span>
          <button onclick="CitizenPortal.loadWeatherAndAlerts(undefined, undefined, { force: true })"
            class="px-2.5 py-1 rounded-lg bg-sky-600/80 hover:bg-sky-500 text-white font-bold cursor-pointer">
            Thử lại
          </button>
        </div>
      </div>`;
    if (window.lucide) lucide.createIcons();
  }

  function toFiniteOrNull(val) {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Hiển thị bảng thời tiết chi tiết kèm nguồn, đơn vị và timestamp (CIT-07)
   */
  function renderWeather(data, meta = {}) {
    const container = document.getElementById('citizen-weather-container');
    if (!container) return;

    const current = (data && data.current) ? data.current : {};
    const rawTemp = toFiniteOrNull(current.temperature_2m);
    const tempVal = rawTemp !== null ? Math.round(rawTemp * 10) / 10 : null;
    const rawApparent = toFiniteOrNull(current.apparent_temperature);
    const apparentVal = rawApparent !== null ? Math.round(rawApparent * 10) / 10 : null;
    const humidityVal = toFiniteOrNull(current.relative_humidity_2m);
    const rainRaw = current.rain !== undefined && current.rain !== null ? current.rain : current.precipitation;
    const rainVal = toFiniteOrNull(rainRaw);
    const windVal = toFiniteOrNull(current.wind_speed_10m);

    const wmo = describeWmoWeatherCode(current.weather_code);
    const regionLabel = meta.region || 'Khu vực đã chọn';
    const coordsLabel = meta.coordinates ? `${Number(meta.coordinates.lat).toFixed(4)}, ${Number(meta.coordinates.lng).toFixed(4)}` : '--';

    // Xác định cấp độ rủi ro mưa hiện tại (chỉ tính nếu có rainVal thực)
    let riskBadgeText = 'KHÔNG RÕ LƯỢNG MƯA';
    let riskBadge = 'bg-slate-700/60 text-slate-300 border-slate-600';
    let riskText = 'Chưa có dữ liệu lượng mưa';
    let riskColor = 'text-slate-400';
    let riskBarWidth = '0%';
    let riskBarColor = 'bg-slate-600';

    if (rainVal !== null) {
      if (rainVal > 15) {
        riskBadgeText = 'CẢNH BÁO CẤP 4';
        riskBadge = 'bg-rose-500/25 text-rose-300 border-rose-500/50 animate-pulse';
        riskText = 'Cấp 4: Mưa rất lớn (Nguy cơ ngập úng cao)';
        riskColor = 'text-rose-400';
        riskBarWidth = '100%';
        riskBarColor = 'bg-gradient-to-r from-amber-500 via-rose-500 to-red-600';
      } else if (rainVal > 5) {
        riskBadgeText = 'CẢNH BÁO CẤP 3';
        riskBadge = 'bg-orange-500/25 text-orange-300 border-orange-500/40';
        riskText = 'Cấp 3: Mưa vừa đến to (Theo dõi ngập cục bộ)';
        riskColor = 'text-orange-400';
        riskBarWidth = '75%';
        riskBarColor = 'bg-gradient-to-r from-amber-400 to-orange-500';
      } else if (rainVal > 0) {
        riskBadgeText = 'CẢNH BÁO CẤP 2';
        riskBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
        riskText = 'Cấp 2: Đang có mưa';
        riskColor = 'text-amber-300';
        riskBarWidth = '50%';
        riskBarColor = 'bg-amber-400';
      } else {
        riskBadgeText = 'BÌNH THƯỜNG';
        riskBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
        riskText = 'Cấp 1: Không mưa';
        riskColor = 'text-emerald-400';
        riskBarWidth = '25%';
        riskBarColor = 'bg-emerald-500';
      }
    }

    // Dự báo theo giờ (tối đa 4 mốc sắp tới)
    let hourlyHtml = '';
    const hourly = data && data.hourly ? data.hourly : null;
    if (hourly && Array.isArray(hourly.time) && hourly.time.length > 0) {
      const nowIsoHour = new Date().toISOString().slice(0, 13);
      const items = [];
      for (let i = 0; i < hourly.time.length && items.length < 4; i++) {
        const t = String(hourly.time[i]);
        if (t.slice(0, 13) >= nowIsoHour) {
          const hTemp = hourly.temperature_2m && hourly.temperature_2m[i] !== undefined && hourly.temperature_2m[i] !== null ? `${Math.round(hourly.temperature_2m[i])}°C` : '--';
          const hRain = hourly.precipitation && hourly.precipitation[i] !== undefined && hourly.precipitation[i] !== null ? `${hourly.precipitation[i]} mm` : '--';
          const hProb = hourly.precipitation_probability && hourly.precipitation_probability[i] !== undefined && hourly.precipitation_probability[i] !== null ? `${hourly.precipitation_probability[i]}%` : '--';
          items.push(`
            <div class="p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 text-center">
              <div class="text-[10px] font-mono text-slate-400">${t.slice(11, 16) || t}</div>
              <div class="text-xs font-black text-white mt-0.5">${hTemp}</div>
              <div class="text-[9.5px] text-sky-300">${hRain} (${hProb})</div>
            </div>`);
        }
      }
      if (items.length > 0) {
        hourlyHtml = `
          <div class="space-y-1.5">
            <div class="text-[10.5px] font-bold text-slate-400">Dự báo theo giờ sắp tới:</div>
            <div class="grid grid-cols-4 gap-1.5">${items.join('')}</div>
          </div>`;
      }
    }

    const cacheBanner = meta.isCached ? `
      <div class="px-3 py-1.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-[11px] flex items-center justify-between gap-2">
        <span class="font-bold flex items-center gap-1.5">
          <i data-lucide="archive" class="w-3.5 h-3.5 text-amber-400"></i>
          Dữ liệu ngoại tuyến (Cache)
        </span>
        <span class="text-[10px] font-mono text-amber-300">Tải lúc: ${formatDisplayTime(meta.fetchedAt)}</span>
      </div>` : '';

    container.innerHTML = `
      <div class="citizen-glass-card rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3.5 border border-white/10 relative overflow-hidden">
        ${cacheBanner}
        <div class="flex items-center justify-between pb-2 border-b border-slate-800/80 text-xs">
          <div class="flex items-center gap-2 font-black text-white">
            <span class="w-2.5 h-2.5 rounded-full ${meta.isCached ? 'bg-amber-400' : 'bg-sky-400 animate-pulse'}"></span>
            <span class="tracking-wide">THỜI TIẾT HIỆN TẠI</span>
          </div>
          <span class="text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider border ${riskBadge}">
            ${riskBadgeText}
          </span>
        </div>

        <div class="flex items-center justify-between gap-3">
          <div class="flex items-baseline gap-2">
            <span class="text-4xl sm:text-5xl font-black text-white tracking-tight">${tempVal !== null ? `${tempVal}°` : '--'}</span>
            <span class="text-sm font-semibold text-slate-400">${tempVal !== null ? 'C' : ''}</span>
            <div class="ml-2">
              <div class="text-xs font-bold text-slate-100">${wmo.text}</div>
              <div class="text-[10.5px] text-slate-400">${regionLabel} (${coordsLabel})</div>
              <div class="text-[10px] text-slate-400">Cảm giác như: <strong class="text-slate-200">${apparentVal !== null ? `${apparentVal}°C` : '--'}</strong></div>
            </div>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500/20 to-blue-600/30 border border-sky-400/30 flex items-center justify-center shrink-0">
            <i data-lucide="${wmo.icon}" class="w-7 h-7 text-sky-400"></i>
          </div>
        </div>

        <div class="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1.5">
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-slate-400 font-medium">Đánh giá mưa hiện tại:</span>
            <span class="font-bold ${riskColor}">${riskText}</span>
          </div>
          <div class="w-full h-2 rounded-full bg-slate-800/90 overflow-hidden relative">
            <div class="h-full rounded-full transition-all duration-700 ease-out ${riskBarColor}" style="width: ${riskBarWidth};"></div>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div class="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
            <div class="text-[10px] text-slate-400 font-medium flex items-center gap-1"><i data-lucide="thermometer" class="w-3 h-3 text-rose-400"></i> Nhiệt độ</div>
            <div class="text-base font-black text-white mt-0.5">${tempVal !== null ? `${tempVal}°C` : '--'}</div>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
            <div class="text-[10px] text-slate-400 font-medium flex items-center gap-1"><i data-lucide="cloud-rain" class="w-3 h-3 text-sky-400"></i> Lượng mưa</div>
            <div class="text-base font-black text-sky-300 mt-0.5">${rainVal !== null ? `${rainVal} <span class="text-[10px] font-normal text-slate-400">mm</span>` : '--'}</div>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
            <div class="text-[10px] text-slate-400 font-medium flex items-center gap-1"><i data-lucide="droplets" class="w-3 h-3 text-blue-400"></i> Độ ẩm</div>
            <div class="text-base font-black text-white mt-0.5">${humidityVal !== null ? `${humidityVal}%` : '--'}</div>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
            <div class="text-[10px] text-slate-400 font-medium flex items-center gap-1"><i data-lucide="wind" class="w-3 h-3 text-emerald-400"></i> Tốc độ gió</div>
            <div class="text-base font-black text-white mt-0.5">${windVal !== null ? `${windVal} <span class="text-[10px] font-normal text-slate-400">km/h</span>` : '--'}</div>
          </div>
        </div>

        ${hourlyHtml}

        <div class="pt-2 flex flex-col gap-1 text-[10px] text-slate-400 border-t border-slate-800/80">
          <div class="flex items-center justify-between gap-2">
            <span>Nguồn: <strong class="text-slate-300">${meta.source || state.weatherSource}</strong></span>
            <span>Hiệu lực dữ liệu: <strong class="text-slate-300 font-mono">${meta.dataUpdatedAt || 'Không rõ'}</strong></span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span>Lấy dữ liệu lúc: <span class="text-slate-300 font-mono">${formatDisplayTime(meta.fetchedAt)}</span></span>
            <button onclick="CitizenPortal.loadWeatherAndAlerts(undefined, undefined, { force: true })" class="text-sky-400 hover:underline cursor-pointer">Làm mới</button>
          </div>
        </div>
      </div>`;

    if (window.lucide) lucide.createIcons();
  }

  function classifyDisasterStatus(props, nowMs = Date.now()) {
    const rawStatus = String((props && props.status) || 'active').toLowerCase();
    if (rawStatus === 'cancelled' || rawStatus === 'revoked' || rawStatus === 'retracted') {
      return 'revoked';
    }
    if (rawStatus === 'resolved' || rawStatus === 'expired' || rawStatus === 'closed') {
      return 'expired';
    }
    if (props && props.end_time) {
      const endMs = Date.parse(props.end_time);
      if (!Number.isNaN(endMs) && endMs <= nowMs) {
        return 'expired';
      }
    }
    if (props && props.start_time) {
      const startMs = Date.parse(props.start_time);
      if (!Number.isNaN(startMs) && startMs > nowMs) {
        return 'upcoming';
      }
    }
    return 'active';
  }

  /**
   * Tải danh sách cảnh báo thiên tai từ Backend (/api/disasters?active_only=false)
   */
  async function loadDisasterAlerts() {
    const container = document.getElementById('citizen-alerts-container');
    if (!container) return;

    try {
      const data = (typeof NorthStarApi !== 'undefined' && typeof NorthStarApi.fetchJson === 'function')
        ? await NorthStarApi.fetchJson('/api/disasters?active_only=false', { timeoutMs: 8000 })
        : await (await fetch(getApiUrl('/api/disasters?active_only=false'))).json();
      const rawFeatures = (data && Array.isArray(data.features)) ? data.features : [];
      const fetchedAt = new Date().toISOString();

      const normalized = rawFeatures.map((f) => {
        const p = f.properties || f;
        const coords = f.geometry && Array.isArray(f.geometry.coordinates) ? f.geometry.coordinates : null;
        return {
          ...p,
          id: p.id !== undefined ? p.id : f.id,
          coordinates: coords,
          source: p.source || 'Hệ thống giám sát NORTHSTAR (Backend /api/disasters)',
          issued_at: p.issued_at || p.start_time || p.created_at || null,
          fetched_at: fetchedAt
        };
      });

      if (normalized.length > 0 && typeof window !== 'undefined' && window.OfflineDB && typeof window.OfflineDB.saveDisasterCache === 'function') {
        await window.OfflineDB.saveDisasterCache(normalized).catch(() => { });
      }
      renderAlerts(normalized, { isCached: false, fetchedAt });
    } catch (err) {
      console.warn('[CitizenPortal] Lỗi nạp cảnh báo thiên tai:', err && err.message ? err.message : err);
      await loadAlertsFromCacheOrError(err && err.message ? err.message : 'Không thể kết nối máy chủ cảnh báo.');
    }
  }

  async function loadAlertsFromCacheOrError(reason) {
    const container = document.getElementById('citizen-alerts-container');
    if (!container) return;

    let cachedList = [];
    try {
      if (window.OfflineDB && typeof window.OfflineDB.getAllDisasterCache === 'function') {
        cachedList = await window.OfflineDB.getAllDisasterCache();
      }
    } catch (_) { }

    const nowMs = Date.now();
    const validCached = (cachedList || []).filter((item) => {
      if (Number.isFinite(item.cache_expires_at) && item.cache_expires_at <= nowMs) return false;
      return true;
    });

    if (validCached.length > 0) {
      renderAlerts(validCached, {
        isCached: true,
        fetchedAt: validCached[0].fetched_at || null,
        reason
      });
      return;
    }

    container.innerHTML = `
      <div class="p-3.5 bg-slate-900/90 border border-rose-500/40 rounded-2xl text-xs space-y-2">
        <div class="flex items-center gap-2 font-bold text-rose-300">
          <i data-lucide="alert-octagon" class="w-4 h-4 text-rose-400"></i>
          <span>Không thể tải bản tin cảnh báo thiên tai</span>
        </div>
        <p class="text-[11px] text-slate-300">${reason || 'Máy chủ không phản hồi và chưa có bản lưu ngoại tuyến hợp lệ.'}</p>
        <p class="text-[10px] text-slate-400">Hệ thống không tạo cảnh báo giả khi mất kết nối.</p>
      </div>`;
    if (window.lucide) lucide.createIcons();
  }

  /**
   * Hiển thị danh sách cảnh báo thiên tai, lọc bỏ bản tin hết hiệu lực / thu hồi
   */
  function renderAlerts(alerts, meta = {}) {
    const container = document.getElementById('citizen-alerts-container');
    if (!container) return;

    const nowMs = Date.now();
    const activeOrUpcoming = [];
    let expiredOrRevokedCount = 0;

    (alerts || []).forEach((item) => {
      const p = item.properties || item;
      const lifecycle = classifyDisasterStatus(p, nowMs);
      if (lifecycle === 'expired' || lifecycle === 'revoked') {
        expiredOrRevokedCount += 1;
      } else {
        activeOrUpcoming.push({ ...p, _lifecycle: lifecycle });
      }
    });

    if (activeOrUpcoming.length === 0) {
      container.innerHTML = `
        <div class="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-xl text-xs text-emerald-300 space-y-1">
          <div class="flex items-center gap-2 font-semibold">
            <i data-lucide="shield-check" class="w-4 h-4 text-emerald-400"></i>
            <span>Hiện tại không có cảnh báo thiên tai đang hiệu lực.</span>
          </div>
          ${expiredOrRevokedCount > 0 ? `<div class="text-[10px] text-slate-400">Đã ẩn ${expiredOrRevokedCount} bản tin hết hiệu lực hoặc đã thu hồi.</div>` : ''}
        </div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }

    const cacheNotice = meta.isCached ? `
      <div class="px-3 py-1.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-[11px] flex items-center justify-between gap-2">
        <span class="font-bold">Bản tin đã lưu (Ngoại tuyến / Dữ liệu cũ)</span>
        <span class="text-[10px] font-mono text-amber-300">Lưu lúc: ${formatDisplayTime(meta.fetchedAt)}</span>
      </div>` : '';

    let html = `
      <div class="space-y-2">
        ${cacheNotice}
        <div class="flex items-center justify-between text-xs font-bold text-slate-200">
          <span class="flex items-center gap-1.5">
            <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-400"></i>
            <span>Cảnh Báo Thiên Tai Từ Hệ Thống (${activeOrUpcoming.length})</span>
          </span>
          ${expiredOrRevokedCount > 0 ? `<span class="text-[10px] text-slate-400">Đã ẩn ${expiredOrRevokedCount} tin hết hạn/thu hồi</span>` : ''}
        </div>`;

    activeOrUpcoming.forEach((p) => {
      const severity = (p.severity || 'warning').toLowerCase();
      let borderClass = 'border-amber-500/40 bg-amber-950/20';
      let badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      let levelLabel = 'CẢNH BÁO';

      if (severity === 'danger' || severity === 'critical' || severity === 'high') {
        borderClass = 'border-rose-500/50 bg-rose-950/30';
        badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/50';
        levelLabel = 'NGUY HIỂM CAO';
      } else if (severity === 'info' || severity === 'low') {
        borderClass = 'border-blue-500/30 bg-blue-950/20';
        badgeClass = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
        levelLabel = 'THEO DÕI';
      }

      const lifecycleTag = p._lifecycle === 'upcoming' ? 'SẮP CÓ HIỆU LỰC' : 'ĐANG HIỆU LỰC';
      const issuedStr = p.issued_at ? formatDisplayTime(p.issued_at) : 'Không rõ thời gian ban hành';
      const endStr = p.end_time ? formatDisplayTime(p.end_time) : 'Chưa ấn định';
      const source = p.source || 'Hệ thống giám sát NORTHSTAR (Backend /api/disasters)';
      const regionText = p.region || p.location_name || (p.coordinates ? `${Number(p.coordinates[1]).toFixed(3)}, ${Number(p.coordinates[0]).toFixed(3)}` : 'Khu vực giám sát');

      html += `
        <div class="citizen-glass-card p-3.5 rounded-2xl border ${borderClass} space-y-2 shadow-lg">
          <div class="flex items-start justify-between gap-2">
            <h4 class="text-xs font-black text-white tracking-wide">${p.title || 'Cảnh báo thiên tai'}</h4>
            <div class="flex flex-col items-end gap-1 shrink-0">
              <span class="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full border ${badgeClass} uppercase">${levelLabel}</span>
              <span class="text-[9px] font-mono text-slate-300">${lifecycleTag}</span>
            </div>
          </div>
          <p class="text-[11.5px] text-slate-300 leading-relaxed">${p.content || p.description || 'Không có mô tả chi tiết.'}</p>
          <div class="pt-2 flex flex-col gap-1 text-[10px] text-slate-400 border-t border-slate-800/80">
            <div class="flex flex-wrap items-center justify-between gap-1.5">
              <span class="text-slate-300 font-medium">Khu vực: ${regionText}</span>
              <span>Ban hành: <span class="font-mono text-slate-300">${issuedStr}</span></span>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-1.5">
              <span>Nguồn: <strong class="text-slate-300">${source}</strong></span>
              <span>Hết hạn: <span class="font-mono">${endStr}</span></span>
            </div>
          </div>
        </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  }

  /**
   * Tải dự báo tham khảo từ mô hình AI/ML (/api/predictions) — tách biệt hoàn toàn khỏi Cảnh báo chính thức
   */
  async function loadAIFloodForecast() {
    const container = document.getElementById('citizen-ai-forecast-container');
    if (!container) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      container.innerHTML = '';
      return;
    }

    try {
      const preds = (typeof NorthStarApi !== 'undefined' && typeof NorthStarApi.fetchJson === 'function')
        ? await NorthStarApi.fetchJson('/api/predictions', { timeoutMs: 8000 })
        : await (await fetch(getApiUrl('/api/predictions'))).json();
      if (!Array.isArray(preds) || preds.length === 0) {
        container.innerHTML = '';
        return;
      }

      const topRisk = preds.slice(0, 3);
      container.innerHTML = `
        <div class="p-3.5 rounded-2xl bg-indigo-950/25 border border-indigo-500/30 space-y-2 text-xs">
          <div class="flex items-center justify-between gap-2">
            <span class="font-bold text-indigo-300 flex items-center gap-1.5">
              <i data-lucide="cpu" class="w-4 h-4 text-indigo-400"></i>
              Dự báo tham khảo từ mô hình AI/ML
            </span>
            <span class="text-[9.5px] px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 font-mono">MODEL ESTIMATE</span>
          </div>
          <p class="text-[10.5px] text-indigo-200/80 leading-relaxed">
            Ước lượng mực nước 30-60 phút từ mô hình Scikit-learn tại một số điểm trạm. <strong>Không phải cảnh báo thiên tai chính thức.</strong>
          </p>
          <div class="space-y-1.5">
            ${topRisk.map((pt) => {
        const f30 = pt.forecast_30m || {};
        const riskPct = Number.isFinite(Number(f30.risk_score)) ? Math.round(Number(f30.risk_score) * 100) : null;
        return `
                <div class="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span class="text-slate-200 font-medium">${pt.name || 'Điểm quan trắc'}</span>
                  <span class="font-mono text-indigo-300">30p: ${f30.predicted_depth_cm ?? '--'} cm ${riskPct !== null ? `(nguy cơ ${riskPct}%)` : ''}</span>
                </div>`;
      }).join('')}
          </div>
        </div>`;
      if (window.lucide) lucide.createIcons();
    } catch (_) {
      container.innerHTML = '';
    }
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
  // QUẢN LÝ GHIM & XÁC NHẬN VỊ TRÍ HIỆN TRƯỜNG (VIC-04 & TIÊU CHÍ V-04 / CIT-02)
  // ==========================================================================
  let sosMarker = null;
  let accuracyCircle = null;
  let isPickingLocation = false;
  const MAPLIBRE_ACC_SOURCE = 'citizen-gps-accuracy-source';
  const MAPLIBRE_ACC_FILL = 'citizen-gps-accuracy-fill';
  const MAPLIBRE_ACC_STROKE = 'citizen-gps-accuracy-stroke';

  function isValidCoordinate(lat, lng) {
    return typeof lat === 'number' && typeof lng === 'number'
      && Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  /**
   * Tạo đa giác GeoJSON hình tròn theo bán kính mét thực tế trên WGS84
   */
  function createGeoJsonCircle(lng, lat, radiusMeters, steps = 48) {
    const coords = [];
    const latRad = (lat * Math.PI) / 180;
    const degLat = radiusMeters / 111320;
    const cosLat = Math.max(0.01, Math.cos(latRad));
    const degLng = radiusMeters / (111320 * cosLat);

    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * 2 * Math.PI;
      const pLng = lng + degLng * Math.cos(theta);
      const pLat = lat + degLat * Math.sin(theta);
      coords.push([pLng, pLat]);
    }
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { radius_m: radiusMeters },
        geometry: { type: 'Polygon', coordinates: [coords] }
      }]
    };
  }

  /**
   * Vẽ hoặc xóa vòng tròn sai số GPS trên MapLibre GL JS (tính theo mét thực tế)
   */
  function renderMapLibreAccuracyCircle(lng, lat, accuracyMeters) {
    if (!window.map || typeof window.map.getSource !== 'function') return;
    const map = window.map;

    const emptyFc = { type: 'FeatureCollection', features: [] };
    const data = (isValidCoordinate(lat, lng) && typeof accuracyMeters === 'number' && Number.isFinite(accuracyMeters) && accuracyMeters > 0)
      ? createGeoJsonCircle(lng, lat, accuracyMeters, 48)
      : emptyFc;

    try {
      const existingSource = map.getSource(MAPLIBRE_ACC_SOURCE);
      if (existingSource) {
        existingSource.setData(data);
        return;
      }
      if (!data.features.length) return;

      const addLayers = () => {
        if (map.getSource(MAPLIBRE_ACC_SOURCE)) {
          map.getSource(MAPLIBRE_ACC_SOURCE).setData(data);
          return;
        }
        map.addSource(MAPLIBRE_ACC_SOURCE, { type: 'geojson', data });
        map.addLayer({
          id: MAPLIBRE_ACC_FILL,
          type: 'fill',
          source: MAPLIBRE_ACC_SOURCE,
          paint: { 'fill-color': '#10b981', 'fill-opacity': 0.16 }
        });
        map.addLayer({
          id: MAPLIBRE_ACC_STROKE,
          type: 'line',
          source: MAPLIBRE_ACC_SOURCE,
          paint: { 'line-color': '#34d399', 'line-width': 1.5, 'line-dasharray': [3, 2] }
        });
      };

      if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) {
        map.once('styledata', addLayers);
      } else {
        addLayers();
      }
    } catch (e) {
      console.warn('[Citizen GPS] Không thể cập nhật vòng tròn sai số MapLibre:', e.message || e);
    }
  }

  /**
   * Đồng bộ giao diện trạng thái GPS & xác nhận vị trí từ state thực tế
   */
  function updateLocationStatusUI() {
    const statusEl = document.getElementById('citizen-gps-status-text');
    const timeEl = document.getElementById('citizen-gps-time-display');
    const coordEl = document.getElementById('citizen-sos-coord-display');
    const accWrapper = document.getElementById('citizen-gps-accuracy-wrapper');
    const accEl = document.getElementById('citizen-gps-accuracy');
    const errBox = document.getElementById('citizen-gps-error-box');
    const errMsgEl = document.getElementById('citizen-gps-error-msg');
    const badgeEl = document.getElementById('citizen-loc-verify-badge');
    const checkEl = document.getElementById('citizen-confirm-location-check');

    const statusLabels = {
      UNKNOWN: 'Trạng thái: <b>UNKNOWN</b> – Chưa xác định vị trí',
      LOCATING: 'Trạng thái: <b>LOCATING</b> – Đang định vị GPS...',
      GPS_DETECTED: 'Trạng thái: <b>GPS_DETECTED</b> – Đã lấy vị trí từ GPS',
      MANUAL_SELECTED: 'Trạng thái: <b>MANUAL_SELECTED</b> – Đã chọn thủ công trên bản đồ',
      USER_CONFIRMED: 'Trạng thái: <b>USER_CONFIRMED</b> – Người dân đã xác nhận vị trí',
      LOCATION_ERROR: 'Trạng thái: <b>LOCATION_ERROR</b> – Không thể lấy GPS tự động'
    };

    if (statusEl) {
      const span = statusEl.querySelector('span');
      if (span) span.innerHTML = statusLabels[state.locationStatus] || statusLabels.UNKNOWN;
    }

    if (timeEl) {
      timeEl.textContent = state.locationCapturedAt
        ? new Date(state.locationCapturedAt).toLocaleTimeString('vi-VN')
        : '';
    }

    if (coordEl) {
      if (state.selectedCoords && isValidCoordinate(state.selectedCoords.lat, state.selectedCoords.lng)) {
        const srcTag = state.locationSource === 'gps' ? 'GPS' : 'Thủ công';
        coordEl.textContent = `${state.selectedCoords.lat.toFixed(5)}° B, ${state.selectedCoords.lng.toFixed(5)}° Đ (${srcTag})`;
        coordEl.className = 'flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono text-[11px] truncate';
      } else {
        coordEl.textContent = 'Chưa xác định tọa độ';
        coordEl.className = 'flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 font-mono text-[11px] truncate';
      }
    }

    if (accWrapper && accEl) {
      if (state.locationSource === 'gps' && typeof state.locationAccuracy === 'number' && Number.isFinite(state.locationAccuracy)) {
        accEl.textContent = `±${state.locationAccuracy}m`;
        accWrapper.classList.remove('hidden');
      } else {
        accEl.textContent = '--';
        accWrapper.classList.add('hidden');
      }
    }

    if (errBox && errMsgEl) {
      if (state.locationStatus === GPS_STATES.LOCATION_ERROR && state.locationError) {
        errMsgEl.textContent = state.locationError;
        errBox.classList.remove('hidden');
      } else {
        errBox.classList.add('hidden');
      }
    }

    if (checkEl) {
      checkEl.checked = !!state.locationConfirmed;
    }

    if (badgeEl) {
      if (state.locationConfirmed) {
        badgeEl.textContent = 'Đã xác nhận';
        badgeEl.className = 'text-[9.5px] font-bold px-2 py-0.5 rounded-full citizen-loc-verified border border-emerald-300';
      } else if (state.selectedCoords) {
        badgeEl.textContent = 'Chưa xác nhận';
        badgeEl.className = 'text-[9.5px] font-bold px-2 py-0.5 rounded-full citizen-loc-unverified border border-amber-300';
      } else {
        badgeEl.textContent = 'Chưa xác định';
        badgeEl.className = 'text-[9.5px] font-bold px-2 py-0.5 rounded-full citizen-loc-unverified border border-amber-300';
      }
    }
  }

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
   * Tự động lấy vị trí GPS từ thiết bị di động kèm vòng tròn độ chính xác thực tế
   */
  function locateGPSWithAccuracy() {
    if (!navigator.geolocation) {
      state.locationStatus = GPS_STATES.LOCATION_ERROR;
      state.locationError = 'Thiết bị hoặc trình duyệt không hỗ trợ Geolocation API. Vui lòng chọn trên bản đồ hoặc nhập mô tả địa điểm.';
      updateLocationStatusUI();
      showCitizenToast('⚠️ Thiết bị không hỗ trợ Geolocation API.', 'error');
      return;
    }

    state.locationStatus = GPS_STATES.LOCATING;
    state.locationError = null;
    updateLocationStatusUI();
    showCitizenToast('🛰️ Đang xác định vị trí GPS chính xác cao...', 'info');
    triggerHaptic([30]);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos?.coords?.latitude;
        const lng = pos?.coords?.longitude;
        if (!isValidCoordinate(lat, lng)) {
          state.locationStatus = GPS_STATES.LOCATION_ERROR;
          state.locationError = 'Dữ liệu tọa độ từ GPS không hợp lệ. Vui lòng thử lại hoặc ghim thủ công trên bản đồ.';
          updateLocationStatusUI();
          return;
        }

        const rawAcc = pos?.coords?.accuracy;
        const accuracy = (typeof rawAcc === 'number' && Number.isFinite(rawAcc) && rawAcc >= 0)
          ? Math.round(rawAcc)
          : null;

        triggerHaptic([50, 40, 60]);
        setSOSLocation(lat, lng, accuracy, 'gps');

        const accInfo = accuracy !== null ? ` (Sai số thực tế: ±${accuracy}m)` : ' (Thiết bị không cung cấp sai số)';
        showCitizenToast(`🛰️ GPS định vị thành công${accInfo}! Vui lòng kiểm tra và xác nhận vị trí.`, 'success');

        if (window.map) {
          if (typeof window.map.flyTo === 'function') {
            window.map.flyTo({ center: [lng, lat], zoom: 17, speed: 1.2 });
          } else if (typeof window.map.setView === 'function') {
            window.map.setView([lat, lng], 17);
          }
        }
      },
      (err) => {
        let friendlyErr = 'Không thể lấy GPS tự động. Vui lòng ghim vị trí trên bản đồ hoặc nhập mô tả địa điểm.';
        if (err) {
          if (err.code === 1) {
            friendlyErr = 'Bạn đã từ chối quyền truy cập vị trí (Permission Denied). Hãy cấp quyền GPS hoặc chọn vị trí thủ công trên bản đồ.';
          } else if (err.code === 2) {
            friendlyErr = 'Tín hiệu GPS không khả dụng tại khu vực hiện tại (Position Unavailable). Hãy chọn vị trí trên bản đồ hoặc nhập mô tả địa điểm.';
          } else if (err.code === 3) {
            friendlyErr = 'Hết thời gian chờ tín hiệu GPS (Timeout). Vui lòng thử lại ở nơi thoáng hoặc ghim thủ công trên bản đồ.';
          }
        }
        state.locationStatus = GPS_STATES.LOCATION_ERROR;
        state.locationError = friendlyErr;
        updateLocationStatusUI();
        console.warn('[Citizen GPS] Lỗi định vị:', err?.code || 'unknown');
        showCitizenToast('⚠️ ' + friendlyErr, 'error');
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
    setSOSLocation(lat, lng, null, 'manual');

    showCitizenToast(`📍 Đã ghim: ${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}. Bấm "Xác nhận" để hoàn tất!`, 'info');
  }

  /**
   * Thiết lập và cập nhật vị trí cứu hộ (tự động xóa trạng thái xác nhận cũ khi tọa độ thay đổi)
   */
  function setSOSLocation(lat, lng, accuracy = null, source = 'manual') {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!isValidCoordinate(latNum, lngNum)) {
      state.locationStatus = GPS_STATES.LOCATION_ERROR;
      state.locationError = 'Tọa độ không hợp lệ.';
      updateLocationStatusUI();
      return;
    }

    state.selectedCoords = { lat: latNum, lng: lngNum };
    state.locationSource = source === 'gps' ? 'gps' : 'manual';
    state.locationAccuracy = (source === 'gps' && typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0)
      ? Math.round(accuracy)
      : null;
    state.locationCapturedAt = new Date().toISOString();
    state.locationError = null;
    // Khi tọa độ thay đổi: xóa trạng thái USER_CONFIRMED cũ, bắt buộc xác nhận lại
    state.locationConfirmed = false;
    state.locationStatus = source === 'gps' ? GPS_STATES.GPS_DETECTED : GPS_STATES.MANUAL_SELECTED;

    updateLocationStatusUI();
    renderSOSMarker(latNum, lngNum, state.locationAccuracy);
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
          setSOSLocation(pos.lat, pos.lng, null, 'manual');
          showCitizenToast(`📍 Đã di chuyển ghim tới: ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}. Vui lòng xác nhận lại vị trí!`, 'info');
        });
      }

      // Cập nhật hoặc xóa vòng tròn sai số GPS trên MapLibre
      renderMapLibreAccuracyCircle(lng, lat, accuracy);

      if (typeof window.map.flyTo === 'function') {
        window.map.flyTo({ center: [lng, lat], zoom: 16, speed: 1.2 });
      }
      return;
    }
  }

  /**
   * Xử lý khi người dân đánh dấu xác nhận vị trí (Tiêu chí V-04 / CIT-02)
   */
  function onLocationVerifiedChange(isVerified) {
    const descVal = document.getElementById('sos-location-description')?.value?.trim() || '';
    const landmarkVal = document.getElementById('sos-location-landmark')?.value?.trim() || '';
    const hasCoords = !!(state.selectedCoords && isValidCoordinate(state.selectedCoords.lat, state.selectedCoords.lng));
    const hasTextLocation = descVal.length >= 3 || landmarkVal.length >= 3;

    if (isVerified && !hasCoords && !hasTextLocation) {
      state.locationConfirmed = false;
      updateLocationStatusUI();
      showCitizenToast('⚠️ Vui lòng bấm GPS, ghim bản đồ hoặc nhập mô tả địa điểm trước khi xác nhận!', 'warning');
      return;
    }

    state.locationConfirmed = !!isVerified;
    if (state.locationConfirmed) {
      triggerHaptic([60, 40, 60]);
      if (hasCoords) {
        state.locationStatus = GPS_STATES.USER_CONFIRMED;
      }
      showCitizenToast('✅ Bạn đã xác nhận vị trí này phản ánh đúng hiện trường thực tế.', 'success');
    } else {
      triggerHaptic([30]);
      if (hasCoords) {
        state.locationStatus = state.locationSource === 'gps' ? GPS_STATES.GPS_DETECTED : GPS_STATES.MANUAL_SELECTED;
      } else {
        state.locationStatus = state.locationError ? GPS_STATES.LOCATION_ERROR : GPS_STATES.UNKNOWN;
      }
    }
    updateLocationStatusUI();
  }

  // Khởi tạo ngay khi trang tải xong
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 300);
  }

  return {
    init,
    GPS_STATES,
    isValidCoordinate,
    createGeoJsonCircle,
    updateLocationStatusUI,
    loadWeatherAndAlerts,
    loadDisasterAlerts,
    loadAIFloodForecast,
    onWeatherLocationChange,
    classifyDisasterStatus,
    WEATHER_PRESETS,
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

if (typeof window !== 'undefined') {
  window.CitizenPortal = CitizenPortal;
}
