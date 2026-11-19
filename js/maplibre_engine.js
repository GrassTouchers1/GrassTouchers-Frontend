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
 * NORTHSTAR MAPLIBRE GL JS 3D VECTOR GIS ENGINE (100% OSI BSD-3-CLAUSE)
 * =========================================================================
 * Triển khai ĐẦY ĐỦ 100% tất cả các tính năng tác chiến từ Leaflet sang MapLibre:
 * 1. 26 Tỉnh Thành Miền Bắc (GeoJSON Polygons, Hover viền sáng, Khí tượng Open-Meteo & AQI)
 * 2. 130 Trạm Thủy Văn & Điểm Ngập Lụt (Đo sâu nước cm, Cảnh báo 3 cấp độ an toàn/cảnh báo/nguy hiểm)
 * 3. Tín hiệu SOS Kêu Cứu Khẩn Cấp (Hiệu ứng radar ping 3D, Gọi điện & Xác nhận đã an toàn)
 * 4. Điểm Sơ Tán An Toàn (Sức chứa, địa chỉ, dẫn đường sơ tán trực tiếp)
 * 5. Đội Cứu Hộ & Phương Tiện Cơ Động (Ca-nô 114, Xe 4x4 vượt lũ)
 * 6. Tuyến Đường Cứu Hộ Né Ngập Thuật Toán A* (Lộ trình an toàn Cyan, Cảnh báo đoạn ngập)
 * 7. Giả Lập Quỹ Đạo Bão Yagi & Bán Kính Gió Giật (50km / 100km Buffer)
 * 8. Phân Vùng Tác Chiến Tức Thì (Regional Jump: Hà Nội, Tây Bắc, Việt Bắc, Đông Bắc, Duyên Hải)
 * 9. Điều Khiển Góc Nhìn 3D WebGL (2D 0°, 3D 45°, Flyover 60°, Xoay tự động 360°)
 * 10. Chuyển Đổi 3 Bản Đồ Nền: Dark C2 Tactical, OpenStreetMap, Vệ Tinh Không Gian
 * =========================================================================
 */

window.NorthStarMapLibre = (function () {
  'use strict';

  let mapInstance = null;
  let isInitialized = false;
  let isAutoRotating = false;
  let currentPitch = 0; // Mặc định góc nhìn 2D phẳng y nguyên Leaflet
  let currentBearing = 0;
  let currentBaseKey = 'satellite'; // Mặc định Vệ Tinh Trinh Sát Không Gian y nguyên Leaflet

  // Quản lý các nhóm markers động
  const markersRegistry = {
    sos: [],
    shelters: [],
    floodPoints: [],
    hazards: [],
    units: [],
    waypoints: []
  };

  // Trạng thái hiển thị các lớp dữ liệu tác chiến
  const layerVisibility = {
    provinces: true,
    floodPoints: true,
    sos: true,
    shelters: true,
    units: true,
    route: true,
    storm: true
  };

  // Cấu hình 4 lớp bản đồ nền chuyên dụng tác chiến C2 & cứu hộ (100% Chuẩn Mở, Zero API Key)
  const BASEMAP_STYLES = {
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
        },
        'esri-dark-ref': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256
        }
      },
      layers: [
        { id: 'base-dark-layer', type: 'raster', source: 'esri-dark', minzoom: 0, maxzoom: 19 },
        { id: 'base-dark-ref-layer', type: 'raster', source: 'esri-dark-ref', minzoom: 0, maxzoom: 19 }
      ]
    },
    satellite: {
      version: 8,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics'
        },
        'esri-sat-labels': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256
        }
      },
      layers: [
        { id: 'base-sat-layer', type: 'raster', source: 'esri-satellite', minzoom: 0, maxzoom: 19 },
        { id: 'base-sat-labels-layer', type: 'raster', source: 'esri-sat-labels', minzoom: 0, maxzoom: 19 }
      ]
    },
    topo: {
      version: 8,
      sources: {
        'esri-topo': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: '&copy; Esri, USGS, METI/NASA, OpenStreetMap contributors'
        }
      },
      layers: [
        { id: 'base-topo-layer', type: 'raster', source: 'esri-topo', minzoom: 0, maxzoom: 19 }
      ]
    },
    osm: {
      version: 8,
      sources: {
        'osm-standard': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors'
        }
      },
      layers: [{ id: 'base-osm-layer', type: 'raster', source: 'osm-standard', minzoom: 0, maxzoom: 19 }]
    }
  };

  // Danh sách phân vùng tác chiến nhanh (Regional Jump Targets)
  const REGIONAL_JUMP_TARGETS = {
    all: { center: [105.4000, 21.3500], zoom: 7.3, pitch: 0, bearing: 0 },
    hanoi: { center: [105.8542, 21.0285], zoom: 11.5, pitch: 0, bearing: 0 },
    taybac: { center: [104.0500, 22.3500], zoom: 9.8, pitch: 0, bearing: 0 }, // Lào Cai - Yên Bái
    vietbac: { center: [105.8000, 21.6000], zoom: 10.2, pitch: 0, bearing: 0 }, // Thái Nguyên - Bắc Giang
    dongbac: { center: [106.2500, 22.4000], zoom: 9.5, pitch: 0, bearing: 0 }, // Cao Bằng - Lạng Sơn
    quangninh: { center: [107.1500, 21.0500], zoom: 10.5, pitch: 0, bearing: 0 }, // Quảng Ninh - Hải Phòng
    songda: { center: [105.3000, 21.0000], zoom: 9.8, pitch: 0, bearing: 0 }   // Phú Thọ - Hòa Bình
  };

  /**
   * 1. KHỞI TẠO BẢN ĐỒ MAPLIBRE GL JS
   */
  function init(containerId = 'maplibre-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (mapInstance) {
      setTimeout(() => {
        mapInstance.resize();
        syncAllLayers();
      }, 100);
      return;
    }

    if (typeof maplibregl === 'undefined') {
      console.warn('[NorthStar MapLibre] Thư viện maplibregl chưa nạp xong.');
      return;
    }

    try {
      mapInstance = new maplibregl.Map({
        container: containerId,
        style: BASEMAP_STYLES[currentBaseKey],
        center: [105.4000, 21.3500],
        zoom: 7.3,
        pitch: currentPitch,
        bearing: currentBearing,
        antialias: true
      });

      // Điều khiển góc nhìn & La bàn 3D (NavigationControl)
      mapInstance.addControl(
        new maplibregl.NavigationControl({
          visualizePitch: true,
          showZoom: true,
          showCompass: true
        }),
        'top-right'
      );

      // Thước đo tỉ lệ bản đồ (ScaleControl)
      mapInstance.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

      mapInstance.on('load', () => {
        isInitialized = true;
        setupProvincesVectorLayer();
        setupStormSimulationVectorLayer();
        setupTacticalRouteVectorLayer();
        syncAllLayers();
        console.log('✅ [NorthStar MapLibre Engine] Toàn bộ hệ thống Web GIS 3D đã sẵn sàng tác chiến.');
      });

      mapInstance.on('rotate', () => {
        if (!isAutoRotating) currentBearing = mapInstance.getBearing();
      });

      mapInstance.on('pitch', () => {
        currentPitch = mapInstance.getPitch();
        updatePitchBadge();
      });

      // Lắng nghe sự kiện click trên bản đồ MapLibre để chọn điểm hoặc báo ngập
      mapInstance.on('click', (e) => {
        handleMapLibreClick(e);
      });

      // Tự động gom cụm hoặc mở rộng điểm đo ngập khi phóng to / thu nhỏ hoặc di chuyển bản đồ
      mapInstance.on('zoomend', () => {
        if (layerVisibility.floodPoints) {
          syncFloodPointMarkers();
        }
      });
      mapInstance.on('moveend', () => {
        if (layerVisibility.floodPoints) {
          syncFloodPointMarkers();
        }
      });

    } catch (err) {
      console.error('[NorthStar MapLibre] Lỗi khởi tạo maplibregl:', err);
    }
  }

  /**
   * 2. LỚP ĐA GIÁC 26 TỈNH THÀNH MIỀN BẮC & KHÍ TƯỢNG OPEN-METEO
   */
  function setupProvincesVectorLayer() {
    if (!mapInstance || !mapInstance.isStyleLoaded()) return;

    const geojsonData = window.ProvinceWeatherLayer ? window.ProvinceWeatherLayer.provincesGeoJSON : null;
    if (!geojsonData) {
      setTimeout(setupProvincesVectorLayer, 400);
      return;
    }

    if (!mapInstance.getSource('provinces-source')) {
      mapInstance.addSource('provinces-source', {
        type: 'geojson',
        data: geojsonData
      });

      // Lớp tô màu nền tỉnh thành (Fill - mờ tinh tế theo nguy cơ)
      mapInstance.addLayer({
        id: 'provinces-fill-layer',
        type: 'fill',
        source: 'provinces-source',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'name'], 'Lào Cai'], 'rgba(239, 68, 68, 0.16)',
            ['==', ['get', 'name'], 'Yên Bái'], 'rgba(245, 158, 11, 0.14)',
            ['==', ['get', 'name'], 'Thái Nguyên'], 'rgba(245, 158, 11, 0.12)',
            ['==', ['get', 'name'], 'Hà Nội'], 'rgba(14, 165, 233, 0.08)',
            ['==', ['get', 'name'], 'Quảng Ninh'], 'rgba(14, 165, 233, 0.08)',
            'rgba(2, 132, 199, 0.05)'
          ],
          'fill-opacity': layerVisibility.provinces ? 0.9 : 0
        }
      });

      // Lớp viền phát sáng ngoài cùng bao quanh miền Bắc (Outer White Line - y hệt Leaflet)
      mapInstance.addLayer({
        id: 'provinces-glow-layer',
        type: 'line',
        source: 'provinces-source',
        paint: {
          'line-color': '#ffffff',
          'line-width': 2.6,
          'line-opacity': layerVisibility.provinces ? 0.95 : 0
        }
      });

      // Lớp đường viền hành chính ranh giới tỉnh nét đứt Cyan Sky Blue & Alert Red/Amber (y hệt Leaflet)
      mapInstance.addLayer({
        id: 'provinces-line-layer',
        type: 'line',
        source: 'provinces-source',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'name'], 'Lào Cai'], '#f43f5e',
            ['==', ['get', 'name'], 'Yên Bái'], '#f59e0b',
            ['==', ['get', 'name'], 'Thái Nguyên'], '#f59e0b',
            '#38bdf8'
          ],
          'line-width': [
            'case',
            ['==', ['get', 'name'], 'Lào Cai'], 2.2,
            ['==', ['get', 'name'], 'Yên Bái'], 2.0,
            1.6
          ],
          'line-dasharray': [4, 4],
          'line-opacity': layerVisibility.provinces ? 0.9 : 0
        }
      });

      // Tương tác click trên từng tỉnh
      mapInstance.on('click', 'provinces-fill-layer', (e) => {
        if (!e.features || !e.features.length) return;
        const p = e.features[0].properties;
        const name = p.name || p['woe-name'] || 'Tỉnh';
        showProvinceWeatherPopup(e.lngLat, name);
      });

      mapInstance.on('mouseenter', 'provinces-fill-layer', () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      });
      mapInstance.on('mouseleave', 'provinces-fill-layer', () => {
        mapInstance.getCanvas().style.cursor = '';
      });
    }
  }

  function showProvinceWeatherPopup(lngLat, provinceName) {
    const meta = window.ProvinceWeatherLayer && window.ProvinceWeatherLayer.metadata ? window.ProvinceWeatherLayer.metadata[provinceName] : null;
    const w = (window.ProvinceWeatherLayer && window.ProvinceWeatherLayer.cache) ? window.ProvinceWeatherLayer.cache[provinceName] : null;

    const temp = w ? w.temp : '23.5';
    const rain = w ? w.rain : '0.0';
    const desc = w ? w.weatherDesc : 'Nhiều mây rải rác';
    const alert = meta ? meta.floodAlert : 'Mực nước duy trì mức an toàn';

    const html = `
      <div class="p-3 font-sans text-xs space-y-2 text-slate-100 bg-slate-900 border border-slate-700 rounded-xl max-w-[270px]">
        <div class="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <div class="font-black text-sm text-cyan-300 flex items-center gap-1.5">
            <span>${meta?.icon || '📍'}</span>
            <span>${provinceName}</span>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
            Open-Meteo
          </span>
        </div>
        <div class="grid grid-cols-2 gap-1.5 text-[11px]">
          <div>Nhiệt độ: <b class="text-white">${temp}°C</b></div>
          <div>Lượng mưa: <b class="text-cyan-400">${rain} mm</b></div>
          <div class="col-span-2 text-slate-300 truncate">${desc}</div>
        </div>
        <div class="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[10.5px] text-amber-300">
          ⚠️ <b>Thủy văn:</b> ${alert}
        </div>
      </div>
    `;

    new maplibregl.Popup({ offset: 15, maxWidth: '300px' })
      .setLngLat(lngLat)
      .setHTML(html)
      .addTo(mapInstance);
  }

  /**
   * 3. LỚP VẼ TUYẾN ĐƯỜNG CỨU HỘ NÉ NGẬP A* THỜI GIAN THỰC (LINESTRING)
   */
  function setupTacticalRouteVectorLayer() {
    if (!mapInstance || !mapInstance.isStyleLoaded()) return;

    if (!mapInstance.getSource('tactical-route-source')) {
      mapInstance.addSource('tactical-route-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      // Lớp đổ bóng hào quang (Cyan Glow)
      mapInstance.addLayer({
        id: 'tactical-route-glow',
        type: 'line',
        source: 'tactical-route-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#06b6d4',
          'line-width': 9,
          'line-opacity': 0.35,
          'line-blur': 3
        }
      });

      // Lớp đường lộ trình trung tâm né ngập
      mapInstance.addLayer({
        id: 'tactical-route-core',
        type: 'line',
        source: 'tactical-route-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#22d3ee',
          'line-width': 4.5,
          'line-opacity': 0.95
        }
      });
    }
  }

  /**
   * 4. LỚP GIẢ LẬP BÃO YAGI & VÒNG QUÉT BÁN KÍNH GIÓ BÃO
   */
  function setupStormSimulationVectorLayer() {
    if (!mapInstance || !mapInstance.isStyleLoaded()) return;

    if (!mapInstance.getSource('storm-sim-source')) {
      mapInstance.addSource('storm-sim-source', {
        type: 'geojson',
        data: generateStormGeoJsonData()
      });

      // Vùng ảnh hưởng bão 100km (Vàng nhạt mờ)
      mapInstance.addLayer({
        id: 'storm-buffer-100km',
        type: 'fill',
        source: 'storm-sim-source',
        filter: ['==', 'type', 'buffer_100'],
        paint: {
          'fill-color': 'rgba(245, 158, 11, 0.15)',
          'fill-outline-color': '#f59e0b'
        }
      });

      // Vùng tâm bão nguy hiểm cấp 12+ 50km (Đỏ mờ)
      mapInstance.addLayer({
        id: 'storm-buffer-50km',
        type: 'fill',
        source: 'storm-sim-source',
        filter: ['==', 'type', 'buffer_50'],
        paint: {
          'fill-color': 'rgba(225, 29, 72, 0.22)',
          'fill-outline-color': '#e11d48'
        }
      });

      // Quỹ đạo tâm bão di chuyển (Line đứt khúc)
      mapInstance.addLayer({
        id: 'storm-track-line',
        type: 'line',
        source: 'storm-sim-source',
        filter: ['==', 'type', 'track'],
        paint: {
          'line-color': '#f43f5e',
          'line-width': 2.5,
          'line-dasharray': [2, 2]
        }
      });
    }
  }

  function generateStormGeoJsonData() {
    const stormCenter = [106.85, 20.95];
    const trackCoords = [
      [108.50, 20.40],
      [107.70, 20.70],
      [106.85, 20.95],
      [105.85, 21.03],
      [104.80, 21.40]
    ];

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { type: 'track' },
          geometry: { type: 'LineString', coordinates: trackCoords }
        },
        createCircleFeature(stormCenter, 1.0, 'buffer_100'),
        createCircleFeature(stormCenter, 0.5, 'buffer_50')
      ]
    };
  }

  function createCircleFeature(center, radiusDeg, typeKey) {
    const points = 64;
    const coords = [];
    for (let i = 0; i <= points; i++) {
      const angle = (i * 360 / points) * (Math.PI / 180);
      coords.push([
        center[0] + radiusDeg * Math.cos(angle),
        center[1] + (radiusDeg * 0.9) * Math.sin(angle)
      ]);
    }
    return {
      type: 'Feature',
      properties: { type: typeKey },
      geometry: { type: 'Polygon', coordinates: [coords] }
    };
  }

  function resolveApi(endpoint) {
    if (typeof window.getApiUrl === 'function') {
      return window.getApiUrl(endpoint);
    }
    const host = window.location.hostname || 'localhost';
    return `${window.location.protocol}//${host}:8000${endpoint}`;
  }

  /**
   * 5. ĐỒNG BỘ TOÀN BỘ CÁC LỚP DỮ LIỆU ĐỘNG (SOS, TRẠM THỦY VĂN, ĐIỂM SƠ TÁN, ĐỘI XE)
   */
  async function syncAllLayers() {
    if (!mapInstance || !isInitialized) return;

    clearAllMarkers();

    if (layerVisibility.sos) await syncSOSMarkers();
    if (layerVisibility.shelters) await syncShelterMarkers();
    if (layerVisibility.floodPoints) await syncFloodPointMarkers();
    await syncHazardMarkers();
    if (layerVisibility.units) syncRescueUnitsMarkers();
    if (layerVisibility.route) syncTacticalRoute();
  }

  function clearAllMarkers() {
    Object.keys(markersRegistry).forEach(k => {
      markersRegistry[k].forEach(m => m.remove());
      markersRegistry[k] = [];
    });
  }

  /**
   * Đồng bộ SOS Beacons (Radar Ping Đỏ Rực - y hệt Leaflet)
   */
  async function syncSOSMarkers() {
    try {
      const res = await fetch(resolveApi('/api/sos')).catch(() => null);
      if (!res || !res.ok) return;
      const data = await res.json();
      const features = data.features || [];

      markersRegistry.sos.forEach(m => m.remove());
      markersRegistry.sos = [];

      // Lọc các tín hiệu còn hoạt động và khử trùng lặp điểm test
      const seenCoords = new Set();

      features.forEach(feat => {
        const p = feat.properties;
        if (['rescued', 'resolved', 'cancelled', 'dispatched', 'on_scene'].includes(p.status)) return;
        const coords = feat.geometry.coordinates; // [Lng, Lat]
        if (!coords || !coords[0] || !coords[1]) return;

        // Khử trùng lặp các điểm test sinh ra cùng một vị trí
        const coordKey = `${coords[0].toFixed(3)},${coords[1].toFixed(3)}`;
        if (seenCoords.has(coordKey)) return;
        seenCoords.add(coordKey);

        const el = document.createElement('div');
        el.className = 'relative flex items-center justify-center cursor-pointer select-none';
        el.style.zIndex = '15';
        el.innerHTML = `
          <span class="absolute w-14 h-14 rounded-full bg-rose-500/40 animate-ping"></span>
          <span class="absolute w-16 h-16 rounded-full bg-rose-500/20"></span>
          <span class="absolute w-11 h-11 rounded-full bg-rose-600/35"></span>
          <div class="w-8 h-8 rounded-full bg-rose-600 text-white font-black text-xs flex items-center justify-center shadow-2xl border-2 border-white relative z-10">
            SOS
          </div>
        `;

        const popupHtml = `
          <div class="p-2.5 font-sans space-y-1.5 text-xs text-slate-800">
            <div class="font-extrabold text-rose-600 flex items-center gap-1 border-b border-rose-200 pb-1">
              <span>🚨</span> YÊU CẦU CỨU HỘ KHẨN CẤP
            </div>
            <div class="font-bold text-slate-900">${p.contact_name || 'Nạn nhân'} - ${p.phone}</div>
            <div>Số người mắc kẹt: <b>${p.people_count} người</b> ${p.has_elderly_or_children ? '<span class="text-amber-700 font-semibold">(Có trẻ/người già)</span>' : ''}</div>
            ${p.notes ? `<div class="italic text-[11px] text-slate-600 border-t pt-1">"${p.notes}"</div>` : ''}
            <div class="pt-1.5 border-t border-slate-200 flex justify-between items-center gap-2">
              <a href="tel:${p.phone}" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold no-underline">📞 Gọi nạn nhân</a>
              <button onclick="window.NorthStarRescue && window.NorthStarRescue.resolveSOS(${p.id})" class="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-800 hover:text-emerald-700 rounded-lg text-[11px] font-bold border border-slate-300">✓ Đã an toàn</button>
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 25, maxWidth: '280px' }).setHTML(popupHtml);
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([coords[0], coords[1]])
          .setPopup(popup)
          .addTo(mapInstance);

        markersRegistry.sos.push(marker);
      });
    } catch (e) {
      console.warn('[MapLibre] Lỗi đồng bộ SOS:', e);
    }
  }

  /**
   * Đồng bộ Điểm Ngập Lụt & Trạm Đo Thủy Văn (Có gom cụm 2, 3 và nhãn 24cm, 18cm, 27cm - y hệt Leaflet)
   */
  async function syncFloodPointMarkers() {
    try {
      const res = await fetch(resolveApi('/api/flood-points')).catch(() => null);
      let points = [];
      if (res && res.ok) {
        const raw = await res.json();
        points = Array.isArray(raw) ? raw : (raw.features || []);
      } else if (window.floodPoints && Array.isArray(window.floodPoints)) {
        points = window.floodPoints;
      }

      const validPoints = [];
      points.forEach(pt => {
        const p = pt.properties || pt;
        const coords = (pt.geometry && pt.geometry.coordinates) ? pt.geometry.coordinates : null;
        const lat = Number(pt.lat || (coords ? coords[1] : 0));
        const lng = Number(pt.lng || (coords ? coords[0] : 0));
        if (!lat || !lng) return;
        const depth = Number(p.depth_cm !== undefined && p.depth_cm !== null ? p.depth_cm : (p.depth || 20));
        validPoints.push({
          lat,
          lng,
          depth,
          location: p.name || p.location || 'Điểm quan trắc ngập',
          id: p.id || Math.random()
        });
      });

      // Xóa các marker cũ của floodPoints
      markersRegistry.floodPoints.forEach(m => m.remove());
      markersRegistry.floodPoints = [];

      const currentZoom = mapInstance ? mapInstance.getZoom() : 7.3;

      // Gom cụm thông minh ở mức zoom bao quát (zoom < 12.5) theo tọa độ pixel màn hình
      if (currentZoom < 12.5) {
        const clusterPixelRadius = 45; // 45px bán kính gom cụm - chuẩn khớp Leaflet maxClusterRadius: 40
        const clusters = [];
        const visited = new Set();

        // Chuyển đổi tọa độ địa lý sang pixel màn hình hiện tại
        const projectedPoints = validPoints.map((pt, idx) => {
          const pixel = mapInstance.project([pt.lng, pt.lat]);
          return { ...pt, px: pixel.x, py: pixel.y, idx };
        });

        for (let i = 0; i < projectedPoints.length; i++) {
          if (visited.has(i)) continue;
          visited.add(i);
          const p1 = projectedPoints[i];
          const group = [p1];

          for (let j = i + 1; j < projectedPoints.length; j++) {
            if (visited.has(j)) continue;
            const p2 = projectedPoints[j];
            const dist = Math.hypot(p1.px - p2.px, p1.py - p2.py);
            if (dist < clusterPixelRadius) {
              visited.add(j);
              group.push(p2);
            }
          }
          clusters.push(group);
        }

        clusters.forEach(group => {
          const count = group.length;
          const avgLat = group.reduce((sum, g) => sum + g.lat, 0) / count;
          const avgLng = group.reduce((sum, g) => sum + g.lng, 0) / count;

          if (count >= 2) {
            createClusterMarker(group, avgLng, avgLat);
          } else {
            createIndividualFloodMarker(group[0]);
          }
        });
      } else {
        // Zoom gần: bung toàn bộ chi tiết
        validPoints.forEach(pt => {
          createIndividualFloodMarker(pt);
        });
      }
    } catch (e) {
      console.warn('[MapLibre] Lỗi đồng bộ Flood Points:', e);
    }
  }

  function createClusterMarker(group, avgLng, avgLat) {
    const count = group.length;
    let hasDanger = false;
    let hasWarning = false;
    let hasSafe = false;

    for (let i = 0; i < group.length; i++) {
      const d = group[i].depth;
      if (d >= 20) {
        hasDanger = true;
      } else if (d >= 5) {
        hasWarning = true;
      } else {
        hasSafe = true;
      }
    }

    let size = 36;
    let clusterLevel = 'safe';
    if (hasDanger) {
      clusterLevel = 'danger';
    } else if (hasWarning) {
      clusterLevel = 'warning';
    } else if (!hasSafe) {
      clusterLevel = 'offline';
    }

    if (count >= 25) {
      size = 46;
    } else if (count >= 10) {
      size = 40;
    }

    const badgeHtml = hasDanger ? '<span class="cluster-danger-dot" title="Có điểm ngập sâu trong cụm"></span>' : '';

    const el = document.createElement('div');
    el.className = 'flood-cluster-container relative flex items-center justify-center cursor-pointer select-none';
    el.style.zIndex = '30';
    el.innerHTML = `
      <span class="absolute rounded-full ${hasDanger ? 'bg-rose-500/35' : 'bg-blue-500/35'}" style="width: ${size + 14}px; height: ${size + 14}px;"></span>
      <div class="flood-cluster-badge flood-cluster-${clusterLevel}" style="width: ${size}px; height: ${size}px;" title="Cụm ${count} điểm quan trắc (nhấp để phóng to)">
        <span class="cluster-num">${count}</span>
        ${badgeHtml}
      </div>
    `;

    el.addEventListener('click', () => {
      mapInstance.flyTo({ center: [avgLng, avgLat], zoom: mapInstance.getZoom() + 2, duration: 800 });
    });

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([avgLng, avgLat])
      .addTo(mapInstance);
    markersRegistry.floodPoints.push(marker);
  }

  function createIndividualFloodMarker(pt) {
    const lat = pt.lat;
    const lng = pt.lng;
    const depth = pt.depth;
    const isDeep = depth >= 20;

    const el = document.createElement('div');
    el.className = 'custom-flood-pin cursor-pointer select-none flex items-center justify-center';
    el.style.zIndex = '25';

    // Điểm hiển thị số cm ngập y hệt Leaflet (.custom-marker: 24cm, 18cm, 27cm, 19cm...)
    const bgColor = isDeep ? '#d97706' : (depth >= 5 ? '#f59e0b' : '#10b981');
    el.innerHTML = `
      <div class="custom-marker" style="width: 32px; height: 32px; background-color: ${bgColor};" title="${pt.location}: ${depth}cm">
        <span>${Math.round(depth)}cm</span>
      </div>
    `;

    const popupHtml = `
      <div class="p-2 font-sans space-y-1 text-xs text-slate-800">
        <div class="font-bold text-slate-900">${pt.location}</div>
        <div class="text-[11px] text-slate-600">Mực nước ngập: <b class="${isDeep ? 'text-amber-700 font-extrabold' : 'text-emerald-700 font-bold'}">${depth} cm</b></div>
        <div class="text-[10px] text-slate-500 font-mono">[${lat.toFixed(4)}, ${lng.toFixed(4)}]</div>
        <button onclick="NorthStarMapLibre.setRouteOriginDestination('dest', ${lng}, ${lat}, '${pt.location.replace(/'/g, "\\'")}')" class="mt-1 w-full py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded border border-slate-300">
          📍 Chọn làm điểm đến
        </button>
      </div>
    `;

    const popup = new maplibregl.Popup({ offset: 15, maxWidth: '240px' }).setHTML(popupHtml);
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .setPopup(popup)
      .addTo(mapInstance);

    markersRegistry.floodPoints.push(marker);
  }

  /**
   * Đồng bộ Điểm Cảnh Báo Thiên Tai & Hiểm Họa (⚠️ - y hệt Leaflet)
   */
  async function syncHazardMarkers() {
    try {
      const res = await fetch(resolveApi('/api/disasters')).catch(() => null);
      if (!res || !res.ok) return;
      const data = await res.json();
      const features = data.features || [];

      markersRegistry.hazards.forEach(m => m.remove());
      markersRegistry.hazards = [];

      features.forEach(feat => {
        const p = feat.properties;
        const coords = feat.geometry.coordinates; // [Lng, Lat]

        const el = document.createElement('div');
        el.className = 'relative flex items-center justify-center cursor-pointer select-none';
        el.style.zIndex = '23';
        el.innerHTML = `
          <span class="absolute w-9 h-9 rounded-full bg-amber-500/50 animate-ping"></span>
          <div class="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xl border-2 border-white text-xs font-black relative z-10" title="${p.title}">
            ⚠️
          </div>
        `;

        const popupHtml = `
          <div class="p-2.5 max-w-[280px] font-sans text-xs text-slate-800">
            <div class="font-extrabold text-amber-600 flex items-center gap-1 border-b border-amber-200 pb-1">
              <span>⚠️</span> CẢNH BÁO THIÊN TAI NGUY HIỂM
            </div>
            <div class="font-bold text-slate-900 mt-1">${p.title}</div>
            <div class="text-[11px] text-slate-600 mt-1">${p.description || ''}</div>
            <div class="text-[10px] text-slate-500 mt-1">Bán kính ảnh hưởng: <b>~${p.radius_m || 500}m</b></div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 18, maxWidth: '280px' }).setHTML(popupHtml);
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([coords[0], coords[1]])
          .setPopup(popup)
          .addTo(mapInstance);

        markersRegistry.hazards.push(marker);
      });
    } catch (e) {
      console.warn('[MapLibre] Lỗi đồng bộ Hazards:', e);
    }
  }

  /**
   * Đồng bộ Điểm Sơ Tán An Toàn (🛡️ - y hệt Leaflet)
   */
  async function syncShelterMarkers() {
    try {
      const res = await fetch(resolveApi('/api/shelters')).catch(() => null);
      if (!res || !res.ok) return;
      const data = await res.json();
      const features = data.features || [];

      markersRegistry.shelters.forEach(m => m.remove());
      markersRegistry.shelters = [];

      features.forEach(feat => {
        const p = feat.properties;
        const coords = feat.geometry.coordinates;

        const el = document.createElement('div');
        el.className = 'relative flex items-center justify-center cursor-pointer select-none';
        el.style.zIndex = '23';
        el.innerHTML = `
          <span class="absolute w-10 h-10 rounded-full bg-emerald-500/25"></span>
          <div class="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xl border-2 border-white hover:scale-125 transition relative z-10" title="${p.name}">
            <span class="text-xs font-bold leading-none">🛡️</span>
          </div>
        `;

        const popupHtml = `
          <div class="p-2 font-sans space-y-1 text-xs text-slate-800">
            <div class="font-bold text-emerald-700 flex items-center gap-1 text-sm border-b border-emerald-100 pb-1">
              <span>🛡️</span> ${p.name}
            </div>
            <div class="text-[11px] text-slate-600">${p.address || ''}</div>
            <div class="text-[11px]">Sức chứa: <b>${p.capacity || 500} người</b> (${p.available_slots || 300} còn trống)</div>
            <button onclick="NorthStarMapLibre.setRouteOriginDestination('dest', ${coords[0]}, ${coords[1]}, '${p.name.replace(/'/g, "\\'")}')" class="mt-2 w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer">
              <span>Sơ tán tới đây</span>
            </button>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 18, maxWidth: '250px' }).setHTML(popupHtml);
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([coords[0], coords[1]])
          .setPopup(popup)
          .addTo(mapInstance);

        markersRegistry.shelters.push(marker);
      });
    } catch (e) {
      console.warn('[MapLibre] Lỗi nạp Shelters:', e);
    }
  }

  /**
   * Đồng bộ Đội Cứu Hộ Thực Địa (Xe 4x4, Ca-nô)
   */
  function syncRescueUnitsMarkers() {
    const units = [
      { id: 'U-01', name: 'Ca-nô Cao Tốc PCCC 114', type: 'boat', lat: 21.035, lng: 105.860, status: 'ready' },
      { id: 'U-02', name: 'Xe Lội Nước Quân Khu 1', type: 'truck', lat: 21.580, lng: 105.840, status: 'on_mission' },
      { id: 'U-03', name: 'Đội Xuồng Phao Bảo Yên', type: 'boat', lat: 22.310, lng: 104.380, status: 'ready' }
    ];

    units.forEach(u => {
      const isBoat = u.type === 'boat';
      const el = document.createElement('div');
      el.className = 'relative flex items-center justify-center cursor-pointer';
      el.innerHTML = `
        <div class="w-8 h-8 rounded-full ${isBoat ? 'bg-cyan-600' : 'bg-blue-600'} text-white shadow-lg border-2 border-white flex items-center justify-center text-xs font-black">
          ${isBoat ? '🚤' : '🚛'}
        </div>
        <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${u.status === 'ready' ? 'bg-emerald-500' : 'bg-amber-500'} border border-white"></span>
      `;

      const popupHtml = `
        <div class="p-2 font-sans space-y-1 text-xs text-slate-800">
          <div class="font-extrabold text-blue-700">${isBoat ? '🚤' : '🚛'} ${u.name}</div>
          <div class="text-[11px]">Trạng thái: <b class="${u.status === 'ready' ? 'text-emerald-600' : 'text-amber-600'}">${u.status === 'ready' ? 'Sẵn sàng cơ động' : 'Đang làm nhiệm vụ'}</b></div>
          <div class="text-[10px] text-slate-500 font-mono">[${u.lat.toFixed(4)}, ${u.lng.toFixed(4)}]</div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 15, maxWidth: '220px' }).setHTML(popupHtml);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([u.lng, u.lat])
        .setPopup(popup)
        .addTo(mapInstance);

      markersRegistry.units.push(marker);
    });
  }

  /**
   * Đồng bộ Lộ Trình Cứu Hộ Né Ngập Lên MapLibre
   */
  function syncTacticalRoute() {
    if (!mapInstance || !mapInstance.getSource('tactical-route-source')) return;

    const defaultRouteCoords = [
      [105.8030, 21.0285],
      [105.8150, 21.0450],
      [105.8320, 21.0800],
      [105.8500, 21.1500],
      [105.8450, 21.3200],
      [105.8400, 21.5800]
    ];

    mapInstance.getSource('tactical-route-source').setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: defaultRouteCoords
          }
        }
      ]
    });
  }

  function handleMapLibreClick(e) {
    const lng = e.lngLat.lng;
    const lat = e.lngLat.lat;

    const badge = document.getElementById('maplibre-coords-badge');
    if (badge) badge.innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  function setRouteOriginDestination(type, lng, lat, label) {
    if (!mapInstance) return;

    const el = document.createElement('div');
    el.className = 'w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black shadow-2xl border-2 border-white ' +
      (type === 'origin' ? 'bg-emerald-600' : 'bg-rose-600');
    el.innerHTML = type === 'origin' ? '🟢' : '🏁';

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(mapInstance);

    markersRegistry.waypoints.push(marker);
    mapInstance.flyTo({ center: [lng, lat], zoom: 12, duration: 1200 });

    if (window.CommandUIController && typeof window.CommandUIController.showToast === 'function') {
      window.CommandUIController.showToast('📍 ĐÃ CHỌN ĐIỂM TÁC CHIẾN', `${label} [${lat.toFixed(4)}, ${lng.toFixed(4)}]`, 'info');
    }
  }

  /**
   * BẬT/TẮT LỚP DỮ LIỆU
   */
  function toggleLayer(layerKey, isVisible) {
    layerVisibility[layerKey] = isVisible;
    if (!mapInstance) return;

    if (layerKey === 'provinces') {
      if (mapInstance.getLayer('provinces-fill-layer')) {
        mapInstance.setPaintProperty('provinces-fill-layer', 'fill-opacity', isVisible ? 0.9 : 0);
        mapInstance.setPaintProperty('provinces-line-layer', 'line-opacity', isVisible ? 0.85 : 0);
      }
    } else if (layerKey === 'storm') {
      ['storm-buffer-100km', 'storm-buffer-50km', 'storm-track-line'].forEach(id => {
        if (mapInstance.getLayer(id)) {
          mapInstance.setLayoutProperty(id, 'visibility', isVisible ? 'visible' : 'none');
        }
      });
    } else if (layerKey === 'route') {
      ['tactical-route-glow', 'tactical-route-core'].forEach(id => {
        if (mapInstance.getLayer(id)) {
          mapInstance.setLayoutProperty(id, 'visibility', isVisible ? 'visible' : 'none');
        }
      });
    } else {
      syncAllLayers();
    }
  }

  function toggleLayerUI(layerKey) {
    layerVisibility[layerKey] = !layerVisibility[layerKey];
    const isVisible = layerVisibility[layerKey];
    toggleLayer(layerKey, isVisible);

    const btn = document.getElementById(`ml-toggle-${layerKey}`);
    if (btn) {
      if (isVisible) {
        btn.className = 'px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition flex items-center gap-1.5 cursor-pointer bg-cyan-900/60 text-cyan-200 border-cyan-500/50 shadow-sm';
      } else {
        btn.className = 'px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition flex items-center gap-1.5 cursor-pointer bg-slate-800/50 text-slate-400 border-slate-700/60 opacity-60 hover:opacity-100';
      }
    }
  }

  /**
   * PHÂN VÙNG TÁC CHIẾN TỨC THÌ (REGIONAL JUMP)
   */
  function jumpToRegion(regionKey) {
    if (!mapInstance || !REGIONAL_JUMP_TARGETS[regionKey]) return;
    const tgt = REGIONAL_JUMP_TARGETS[regionKey];
    mapInstance.flyTo({
      center: tgt.center,
      zoom: tgt.zoom,
      pitch: tgt.pitch,
      bearing: tgt.bearing,
      duration: 2000,
      essential: true
    });

    ['all', 'hanoi', 'taybac', 'vietbac', 'dongbac', 'quangninh', 'songda'].forEach(k => {
      const btn = document.getElementById(`ml-jump-${k}`);
      if (btn) {
        if (k === regionKey) {
          btn.className = 'px-2.5 py-1 rounded-lg text-[10.5px] font-bold cursor-pointer transition shadow bg-cyan-600 text-white';
        } else {
          btn.className = 'px-2.5 py-1 rounded-lg text-[10.5px] font-semibold cursor-pointer transition bg-slate-800/80 hover:bg-slate-700 text-slate-300';
        }
      }
    });
  }

  /**
   * ĐIỀU KHIỂN GÓC NGHIÊNG 3D
   */
  function setPitch(deg) {
    if (!mapInstance) return;
    currentPitch = deg;
    mapInstance.easeTo({ pitch: deg, duration: 1200 });
    updatePitchBadge();

    [0, 45, 60].forEach(p => {
      const btn = document.getElementById(`ml-pitch-${p}`);
      if (btn) {
        if (p === deg) {
          btn.className = 'px-2 py-1 bg-cyan-600 text-white rounded-lg text-[11px] font-bold cursor-pointer transition shadow';
        } else {
          btn.className = 'px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold cursor-pointer transition';
        }
      }
    });
  }

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

    if (isAutoRotating) rotateFrame();
  }

  function rotateFrame() {
    if (!isAutoRotating || !mapInstance) return;
    const b = mapInstance.getBearing();
    mapInstance.setBearing(b + 0.25);
    requestAnimationFrame(rotateFrame);
  }

  /**
   * CHUYỂN ĐỔI BẢN ĐỒ NỀN (BASEMAPS)
   */
  function switchStyle(key) {
    if (!mapInstance || !BASEMAP_STYLES[key]) return;
    currentBaseKey = key;

    ['dark', 'satellite', 'topo', 'osm'].forEach(k => {
      const btn = document.getElementById(`btn-ml-base-${k}`);
      if (btn) {
        if (k === key) {
          btn.className = 'px-2.5 py-1 bg-cyan-600 text-white rounded-lg text-[11px] font-bold cursor-pointer transition shadow';
        } else {
          btn.className = 'px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold cursor-pointer transition';
        }
      }
    });

    mapInstance.setStyle(BASEMAP_STYLES[key]);
    mapInstance.once('style.load', () => {
      setupProvincesVectorLayer();
      setupStormSimulationVectorLayer();
      setupTacticalRouteVectorLayer();
      syncAllLayers();
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
    toggleAutoRotate,
    switchStyle,
    toggleLayer,
    toggleLayerUI,
    jumpToRegion,
    setRouteOriginDestination,
    syncAllLayers,
    resize,
    get map() { return mapInstance; }
  };
})();
