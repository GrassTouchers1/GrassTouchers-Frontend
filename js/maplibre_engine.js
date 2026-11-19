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
 * =========================================================================
 * NORTHSTAR DUAL-ENGINE: MAPLIBRE GL JS 3D VECTOR ENGINE (OSI BSD-3-CLAUSE)
 * =========================================================================
 * Engine hiển thị bản đồ 3D Vector WebGL song song với Leaflet 2D.
 * Chứng minh hệ thống làm chủ cả 2 công nghệ bản đồ nguồn mở hàng đầu thế giới.
 */

window.NorthStarMapLibre = (function () {
  'use strict';

  let mapInstance = null;
  let isInitialized = false;
  let isAutoRotating = false;
  let activeMarkers = [];
  let currentPitch = 45;
  let currentBearing = -15;

  // Cấu hình Base Styles (100% Open Data & Open Standards, Zero API Key)
  const STYLES = {
    dark: {
      version: 8,
      sources: {
        'esri-dark': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: '&copy; Esri &copy; OpenStreetMap contributors'
        }
      },
      layers: [
        {
          id: 'esri-dark-layer',
          type: 'raster',
          source: 'esri-dark',
          minzoom: 0,
          maxzoom: 19
        }
      ]
    },
    osm: {
      version: 8,
      sources: {
        'osm-standard': {
          type: 'raster',
          tiles: [
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
      },
      layers: [
        {
          id: 'osm-standard-layer',
          type: 'raster',
          source: 'osm-standard',
          minzoom: 0,
          maxzoom: 19
        }
      ]
    }
  };

  let currentStyleKey = 'dark';

  /**
   * Khởi tạo MapLibre GL JS Map
   */
  function init(containerId = 'maplibre-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (mapInstance) {
      mapInstance.resize();
      syncDataLayers();
      return;
    }

    if (typeof maplibregl === 'undefined') {
      console.warn('[MapLibre Engine] Thư viện maplibregl chưa nạp xong.');
      return;
    }

    try {
      mapInstance = new maplibregl.Map({
        container: containerId,
        style: STYLES[currentStyleKey],
        center: [105.8542, 21.0285], // Hà Nội [Lng, Lat]
        zoom: 7.2,
        pitch: currentPitch,     // Góc nghiêng 3D
        bearing: currentBearing, // Góc xoay la bàn
        antialias: true
      });

      // Thêm thanh điều hướng 3D (Compass + Zoom + Tilt)
      mapInstance.addControl(
        new maplibregl.NavigationControl({
          visualizePitch: true,
          showZoom: true,
          showCompass: true
        }),
        'top-right'
      );

      mapInstance.on('load', () => {
        isInitialized = true;
        syncDataLayers();
        console.log('✅ [NorthStar MapLibre Engine] Bản đồ Vector 3D đã khởi tạo thành công (BSD-3-Clause).');
      });

      mapInstance.on('rotate', () => {
        if (!isAutoRotating) {
          currentBearing = mapInstance.getBearing();
        }
      });

      mapInstance.on('pitch', () => {
        currentPitch = mapInstance.getPitch();
        updatePitchBadge();
      });

    } catch (err) {
      console.error('[MapLibre Engine] Lỗi khi tạo bản đồ:', err);
    }
  }

  /**
   * Đồng bộ các điểm SOS và Trạm Sơ tán lên bản đồ MapLibre 3D
   */
  async function syncDataLayers() {
    if (!mapInstance || !isInitialized) return;

    // Xóa các marker cũ
    activeMarkers.forEach(m => m.remove());
    activeMarkers = [];

    // 1. Nạp SOS Beacons
    try {
      const sosRes = await fetch('/api/sos').catch(() => null);
      if (sosRes && sosRes.ok) {
        const data = await sosRes.json();
        const features = data.features || [];

        features.forEach(feat => {
          const p = feat.properties;
          if (['rescued', 'resolved', 'cancelled'].includes(p.status)) return;
          const coords = feat.geometry.coordinates; // [Lng, Lat]

          // Tạo phần tử DOM động cho marker 3D với hiệu ứng radar ping
          const el = document.createElement('div');
          el.className = 'relative flex items-center justify-center cursor-pointer';
          el.innerHTML = `
            <span class="absolute w-8 h-8 rounded-full bg-rose-500 opacity-75 animate-ping"></span>
            <div class="w-7 h-7 rounded-full bg-rose-600 text-white font-black text-[10px] flex items-center justify-center shadow-2xl border-2 border-white">
              SOS
            </div>
          `;

          const popupContent = `
            <div class="p-2.5 font-sans space-y-1.5 text-xs text-slate-800">
              <div class="font-extrabold text-rose-600 flex items-center gap-1">
                <span>🚨</span> YÊU CẦU CỨU HỘ KHẨN CẤP
              </div>
              <div class="font-bold text-slate-900">${p.contact_name || 'Nạn nhân'} - ${p.phone}</div>
              <div>Số người mắc kẹt: <b>${p.people_count} người</b></div>
              ${p.notes ? `<div class="italic text-[11px] text-slate-600">"${p.notes}"</div>` : ''}
              <div class="pt-1.5 border-t border-slate-200 flex justify-between items-center gap-2">
                <a href="tel:${p.phone}" class="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold no-underline">📞 Gọi điện</a>
                <button onclick="window.NorthStarRescue && window.NorthStarRescue.resolveSOS(${p.id})" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold border border-slate-300">✓ Đã an toàn</button>
              </div>
            </div>
          `;

          const popup = new maplibregl.Popup({ offset: 25, maxWidth: '280px' }).setHTML(popupContent);

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([coords[0], coords[1]])
            .setPopup(popup)
            .addTo(mapInstance);

          activeMarkers.push(marker);
        });
      }
    } catch (e) {
      console.warn('[MapLibre Engine] Lỗi nạp SOS:', e);
    }

    // 2. Nạp Điểm Sơ tán (Shelters)
    try {
      const shRes = await fetch('/api/shelters').catch(() => null);
      if (shRes && shRes.ok) {
        const data = await shRes.json();
        const features = data.features || [];

        features.forEach(feat => {
          const p = feat.properties;
          const coords = feat.geometry.coordinates; // [Lng, Lat]

          const el = document.createElement('div');
          el.className = 'w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg border border-white text-xs cursor-pointer hover:scale-110 transition';
          el.innerHTML = '⛺';

          const popupContent = `
            <div class="p-2 font-sans space-y-1 text-xs text-slate-800">
              <div class="font-bold text-emerald-700 flex items-center gap-1">⛺ ${p.name}</div>
              <div class="text-[11px] text-slate-600">${p.address || ''}</div>
              <div class="text-[11px]">Sức chứa: <b>${p.capacity || 500} người</b></div>
            </div>
          `;

          const popup = new maplibregl.Popup({ offset: 20, maxWidth: '240px' }).setHTML(popupContent);

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([coords[0], coords[1]])
            .setPopup(popup)
            .addTo(mapInstance);

          activeMarkers.push(marker);
        });
      }
    } catch (e) {
      console.warn('[MapLibre Engine] Lỗi nạp Shelters:', e);
    }
  }

  /**
   * Điều chỉnh độ nghiêng 3D
   */
  function setPitch(deg) {
    if (!mapInstance) return;
    currentPitch = deg;
    mapInstance.easeTo({ pitch: deg, duration: 1200 });
    updatePitchBadge();
  }

  /**
   * Đặt lại góc nhìn mặc định (2D hoặc 3D nghiêng 45)
   */
  function resetView(is3D = true) {
    if (!mapInstance) return;
    mapInstance.easeTo({
      center: [105.8542, 21.0285],
      zoom: 7.5,
      pitch: is3D ? 45 : 0,
      bearing: is3D ? -15 : 0,
      duration: 1500
    });
  }

  /**
   * Bật/Tắt chế độ tự động xoay 360 độ (Auto-Rotate Flyover)
   */
  function toggleAutoRotate() {
    if (!mapInstance) return;
    isAutoRotating = !isAutoRotating;

    const btn = document.getElementById('maplibre-btn-rotate');
    if (btn) {
      if (isAutoRotating) {
        btn.classList.add('bg-cyan-600', 'text-white');
        btn.classList.remove('bg-slate-800', 'text-slate-300');
        btn.innerHTML = '<span>⏸ Dừng xoay 360°</span>';
      } else {
        btn.classList.remove('bg-cyan-600', 'text-white');
        btn.classList.add('bg-slate-800', 'text-slate-300');
        btn.innerHTML = '<span>🔄 Tự động xoay 360°</span>';
      }
    }

    if (isAutoRotating) {
      rotateFrame();
    }
  }

  function rotateFrame() {
    if (!isAutoRotating || !mapInstance) return;
    const currentBearing = mapInstance.getBearing();
    mapInstance.setBearing(currentBearing + 0.3);
    requestAnimationFrame(rotateFrame);
  }

  /**
   * Chuyển đổi Style bản đồ nền (Dark C2 vs OSM)
   */
  function switchStyle(key) {
    if (!mapInstance || !STYLES[key]) return;
    currentStyleKey = key;
    mapInstance.setStyle(STYLES[key]);
    mapInstance.once('style.load', () => {
      syncDataLayers();
    });
  }

  function updatePitchBadge() {
    const el = document.getElementById('maplibre-pitch-badge');
    if (el) el.innerText = `${Math.round(currentPitch)}°`;
  }

  function resize() {
    if (mapInstance) {
      setTimeout(() => mapInstance.resize(), 150);
    }
  }

  return {
    init,
    setPitch,
    resetView,
    toggleAutoRotate,
    switchStyle,
    syncDataLayers,
    resize,
    get map() { return mapInstance; }
  };
})();
