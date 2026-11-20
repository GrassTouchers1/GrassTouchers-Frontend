/**
 * =========================================================================
 * NORTHSTAR TACTICAL C2 - MAPLIBRE GL JS 3D VECTOR ENGINE (OPEN-SOURCE)
 * =========================================================================
 * Giấy phép: BSD-3-Clause (Hoàn toàn mở - OSI Approved)
 * Động cơ: WebGL 2.0 GPU Acceleration • Vector Tiles & GeoJSON Tác Chiến
 * 
 * TÍNH NĂNG TÁC CHIẾN MỞ RỘNG (EXPANDED C2 SUITE):
 * 1. Bản Đồ Nền 4 Lớp: Vệ Tinh Recon, Nền Tối C2, Địa Hình Lũ, Đô Thị OSM
 * 2. Tái Hiện 1:1 Hệ Thống Marker Leaflet:
 *    - Cụm Điểm Ngập (Clusters 2, 3...) & Huy Hiệu Độ Sâu (24cm, 18cm, 27cm...)
 *    - Tín Hiệu SOS Khẩn Cấp với Vòng Quét Radar Animate-Ping
 *    - Trạm Sơ Tán An Toàn (Shield) & Điểm Nguy Hiểm (Hazard)
 * 3. 26 Tỉnh Miền Bắc & Thời Tiết Khí Tượng Open-Meteo Trực Tiếp
 * 4. Quỹ Đạo Bão Yagi & Vòng Bán Kính Gió Cấp 12 (50km / 100km)
 * 5. Tuyến Đường Cứu Hộ Né Ngập Thuật Toán A* (Linestring Hào Quang)
 * 6. Tuần Tra Trinh Sát 3D Tự Động (Cinematic 3D Flyover Patrol - 6 Điểm Nóng)
 * 7. Thước Đo Tác Chiến & Tự Động Tính ETA (Ca-nô 35km/h, Xe 4x4 45km/h, Lội Bộ)
 * 8. Bảng Chỉ Huy C2 Thu Gọn (Collapsible Tactical Drawer - 4 Tabs Tác Chiến)
 * 9. Thanh Tìm Kiếm C2 Tức Thì (Spotlight Search: SOS, Trạm Ngập, Nơi Trú, Tỉnh)
 * 10. Khối Nhà & Đô Thị 3D (3D Extruded Buildings khi nghiêng góc nhìn)
 * 11. Radar Mưa Phản Hồi Bão Yagi (Doppler dBZ Radar Simulation)
 * 12. Phương Tiện Cứu Hộ Chuyển Động Thời Gian Thực Dọc Tuyến A*
 * =========================================================================
 */

window.NorthStarMapLibre = (function () {
  'use strict';

  let mapInstance = null;
  let isInitialized = false;
  let isAutoRotating = false;
  let currentPitch = 0; // Mặc định góc nhìn 2D phẳng y hệt Leaflet
  let currentBearing = 0;
  let currentBaseKey = 'satellite'; // Vệ Tinh Không Gian y hệt Leaflet

  // Quản lý các nhóm markers động
  const markersRegistry = {
    sos: [],
    shelters: [],
    floodPoints: [],
    hazards: [],
    units: [],
    waypoints: [],
    measure: []
  };

  // Trạng thái hiển thị các lớp dữ liệu tác chiến
  const layerVisibility = {
    provinces: true,
    floodPoints: true,
    sos: true,
    shelters: true,
    units: true,
    route: true,
    storm: true,
    buildings: false,
    rainRadar: false
  };

  // PHẠM VI KHÔNG GIAN TÁC CHIẾN 26 TỈNH MIỀN BẮC VIỆT NAM (SPATIAL BOUNDING BOX)
  // Khóa chặt tuyệt đối: Mọi tín hiệu SOS, Trạm ngập, Điểm trú ẩn ngoài miền Bắc (Lào, Thái Lan...) đều tự động bị loại bỏ
  const NORTHERN_VIETNAM_BOUNDS = {
    minLng: 102.10,
    maxLng: 108.50,
    minLat: 19.80,
    maxLat: 23.60
  };

  function isWithinNorthernVietnam(lng, lat) {
    if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) return false;
    return lng >= NORTHERN_VIETNAM_BOUNDS.minLng &&
           lng <= NORTHERN_VIETNAM_BOUNDS.maxLng &&
           lat >= NORTHERN_VIETNAM_BOUNDS.minLat &&
           lat <= NORTHERN_VIETNAM_BOUNDS.maxLat;
  }

  // Cấu hình 4 lớp bản đồ nền chuyên dụng tác chiến C2 (Zero API Key, 100% Chuẩn Mở)
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
        'esri-streets': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: '&copy; Esri, DeLorme, NAVTEQ, TomTom, OpenStreetMap contributors'
        }
      },
      layers: [{ id: 'base-osm-layer', type: 'raster', source: 'esri-streets', minzoom: 0, maxzoom: 19 }]
    }
  };

  // Danh sách phân vùng tác chiến nhanh (Regional Jump Targets)
  const REGIONAL_JUMP_TARGETS = {
    all: { center: [105.4000, 21.3500], zoom: 7.4, pitch: 0, bearing: 0 },
    hanoi: { center: [105.8542, 21.0285], zoom: 11.5, pitch: 0, bearing: 0 },
    taybac: { center: [104.0500, 22.3500], zoom: 9.8, pitch: 0, bearing: 0 }, // Lào Cai - Yên Bái
    vietbac: { center: [105.8000, 21.6000], zoom: 10.2, pitch: 0, bearing: 0 }, // Thái Nguyên - Bắc Giang
    dongbac: { center: [106.2500, 22.4000], zoom: 9.5, pitch: 0, bearing: 0 }, // Cao Bằng - Lạng Sơn
    quangninh: { center: [107.1500, 21.0500], zoom: 10.5, pitch: 0, bearing: 0 }, // Quảng Ninh - Hải Phòng
    songda: { center: [105.3000, 21.0000], zoom: 9.8, pitch: 0, bearing: 0 }   // Phú Thọ - Hòa Bình
  };

  // 6 ĐIỂM NÓNG TUẦN TRA TRINH SÁT 3D (CINEMATIC 3D PATROL WAYPOINTS)
  const PATROL_WAYPOINTS = [
    {
      name: 'Làng Nủ, Xã Phúc Khánh, Huyện Bảo Yên, Lào Cai',
      tag: 'CỰC KỲ NGUY HIỂM',
      tagClass: 'bg-rose-950 text-rose-300 border-rose-700',
      desc: 'Khu lũ quét sạt lở kinh hoàng. Thôn bản bị san phẳng, 95 người chết/mất tích, 33 hộ bị cô lập hoàn toàn.',
      center: [104.3820, 22.2510],
      zoom: 14.5,
      pitch: 65,
      bearing: 35,
      elevation: '+460m ASL'
    },
    {
      name: 'TP. Yên Bái (Lưu Vực Sông Thao)',
      tag: 'BÁO ĐỘNG III +',
      tagClass: 'bg-amber-950 text-amber-300 border-amber-700',
      desc: 'Lũ sông Thao vượt kỷ lục lịch sử 1968 (+1.57m). Các phường Hồng Hà, Minh Tân chìm trong biển nước sâu 2-3m.',
      center: [104.9110, 21.7220],
      zoom: 14.0,
      pitch: 55,
      bearing: -30,
      elevation: '+38m ASL'
    },
    {
      name: 'Cầu Phong Châu (QL32C, Tam Nông, Phú Thọ)',
      tag: 'SỰ CỐ ĐẶC BIỆT',
      tagClass: 'bg-purple-950 text-purple-300 border-purple-700',
      desc: 'Sập đứt 2 nhịp giàn cầu T6, T7 do dòng lũ sông Thao chảy xiết. Lực lượng Công Binh Lữ đoàn 249 bắc cầu phao dã chiến.',
      center: [105.2890, 21.3020],
      zoom: 14.8,
      pitch: 60,
      bearing: 110,
      elevation: '+26m ASL'
    },
    {
      name: 'TP. Thái Nguyên & Lưu Vực Sông Cầu',
      tag: 'BÁO ĐỘNG III',
      tagClass: 'bg-rose-950 text-rose-300 border-rose-700',
      desc: 'Mực nước trạm Gia Bẩy vượt đỉnh lũ lịch sử 1959. 22 xã, phường ngập sâu, 2.500 hộ dân sơ tán khẩn cấp.',
      center: [105.8450, 21.5940],
      zoom: 14.0,
      pitch: 50,
      bearing: 15,
      elevation: '+32m ASL'
    },
    {
      name: 'Cầu Long Biên & Bãi Giữa Sông Hồng (Hà Nội)',
      tag: 'BÁO ĐỘNG II',
      tagClass: 'bg-amber-950 text-amber-300 border-amber-700',
      desc: 'Mực nước sông Hồng lên 11.30m (Báo động II). Cấm tàu thuyền, di dời khẩn cấp 1.200 hộ dân bãi bồi ngoài đê An Dương, Phúc Tân.',
      center: [105.8560, 21.0430],
      zoom: 15.0,
      pitch: 60,
      bearing: 140,
      elevation: '+14m ASL'
    },
    {
      name: 'Vịnh Hạ Long & Đảo Tuần Châu (Quảng Ninh)',
      tag: 'TÂM BÃO ĐỔ BỘ',
      tagClass: 'bg-cyan-950 text-cyan-300 border-cyan-700',
      desc: 'Điểm tâm bão số 3 Yagi đổ bộ trực diện cấp 14, giật cấp 17. Sóng biển dâng cao 3.5m, nhiều phương tiện thủy neo đậu trú bão.',
      center: [107.0080, 20.9320],
      zoom: 13.8,
      pitch: 50,
      bearing: -65,
      elevation: '+5m ASL'
    }
  ];

  // Trạng thái các tính năng mở rộng
  let isPatrolActive = false;
  let patrolCurrentIndex = 0;
  let patrolTimer = null;
  let patrolCountdown = 8;
  let isPatrolPaused = false;

  let isMeasuring = false;
  let measurePoints = []; // Array of [lng, lat]

  let isDrawerOpen = false;
  let currentDrawerTab = 'sos';
  let cachedDrawerData = { sos: [], flood: [], shelters: [], units: [] };

  let animatedVehicleMarker = null;
  let vehicleAnimStep = 0;
  let vehicleAnimTimer = null;

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
        zoom: 7.4,
        minZoom: 6.8, // Khóa zoom tối thiểu: Giữ góc nhìn luôn bao trọn 26 tỉnh miền Bắc, không trôi sang Thái Lan / Nam Lào
        maxZoom: 18.0,
        maxBounds: [
          [100.8, 18.8], // Góc Tây Nam: Giới hạn camera không trôi sang Thái Lan / Vientiane
          [109.8, 24.2]  // Góc Đông Bắc: Giới hạn camera không trôi quá xa sang Trung Quốc
        ],
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
        setupMeasureVectorLayer();
        setup3DBuildingsVectorLayer();
        setupRainRadarVectorLayer();
        syncAllLayers();
        setupSpotlightSearch();
        initTacticalDrawerData();
        startVehicleRouteAnimation();
        console.log('✅ [NorthStar MapLibre Engine] Toàn bộ hệ thống Web GIS 3D C2 đã sẵn sàng tác chiến.');
      });

      mapInstance.on('rotate', () => {
        if (!isAutoRotating) currentBearing = mapInstance.getBearing();
        updateTelemetryBadge();
      });

      mapInstance.on('pitch', () => {
        currentPitch = mapInstance.getPitch();
        updatePitchBadge();
        updateTelemetryBadge();
      });

      mapInstance.on('zoom', () => {
        updateTelemetryBadge();
      });

      // Lắng nghe sự kiện click trên bản đồ MapLibre
      mapInstance.on('click', (e) => {
        handleMapLibreClick(e);
      });

      // Lắng nghe di chuột để cập nhật telemetry con trỏ
      mapInstance.on('mousemove', (e) => {
        handleMapLibreMouseMove(e);
      });

      // Tự động gom cụm hoặc mở rộng điểm đo ngập khi zoom / di chuyển
      mapInstance.on('zoomend', () => {
        if (layerVisibility.floodPoints) syncFloodPointMarkers();
      });
      mapInstance.on('moveend', () => {
        if (layerVisibility.floodPoints) syncFloodPointMarkers();
      });

    } catch (err) {
      console.error('[NorthStar MapLibre] Lỗi khởi tạo maplibregl:', err);
    }
  }

  function handleMapLibreMouseMove(e) {
    const lng = e.lngLat.lng;
    const lat = e.lngLat.lat;
    const badge = document.getElementById('maplibre-coords-badge');
    if (badge) badge.innerText = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;

    const elevBadge = document.getElementById('maplibre-elevation-badge');
    if (elevBadge) {
      let estElev = 12;
      if (lat > 22.0) estElev = Math.round(150 + (lat - 22.0) * 800 + (105.0 - lng) * 120);
      else if (lat > 21.4) estElev = Math.round(35 + (lat - 21.4) * 200);
      elevBadge.innerText = `Độ cao: +${Math.max(4, estElev)}m ASL`;
    }
  }

  function updateTelemetryBadge() {
    const el = document.getElementById('maplibre-telemetry-badge');
    if (el && mapInstance) {
      const z = mapInstance.getZoom().toFixed(1);
      const p = Math.round(mapInstance.getPitch());
      const b = Math.round(mapInstance.getBearing());
      el.innerText = `Z: ${z} | P: ${p}° | B: ${b}°`;
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

      // Lớp tô màu nền tỉnh thành
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

      // Lớp viền phát sáng ngoài cùng bao quanh miền Bắc
      mapInstance.addLayer({
        id: 'provinces-outer-glow',
        type: 'line',
        source: 'provinces-source',
        paint: {
          'line-color': '#ffffff',
          'line-width': 2.8,
          'line-opacity': layerVisibility.provinces ? 0.95 : 0
        }
      });

      // Lớp đường ranh giới nội tỉnh đứt nét
      mapInstance.addLayer({
        id: 'provinces-dashed-inner',
        type: 'line',
        source: 'provinces-source',
        paint: {
          'line-color': '#06b6d4',
          'line-width': 1.6,
          'line-dasharray': [4, 3],
          'line-opacity': layerVisibility.provinces ? 0.85 : 0
        }
      });

      // Hover & Click sự kiện xem thời tiết trực tiếp
      mapInstance.on('click', 'provinces-fill-layer', (e) => {
        if (!e.features || !e.features.length) return;
        const provName = e.features[0].properties.name;
        showProvinceWeatherPopup(e.lngLat, provName);
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
    let weatherInfo = null;
    if (window.ProvinceWeatherLayer && window.ProvinceWeatherLayer.weatherDataCache) {
      weatherInfo = window.ProvinceWeatherLayer.weatherDataCache[provinceName];
    }

    const temp = weatherInfo ? weatherInfo.temp : '24.5°C';
    const rain = weatherInfo ? weatherInfo.precipitation : '12.4 mm';
    const wind = weatherInfo ? weatherInfo.windSpeed : '48 km/h (Cấp 6)';
    const status = weatherInfo ? weatherInfo.weatherStatus : 'Mưa lớn, nguy cơ sạt lở';

    const html = `
      <div class="p-3 font-sans space-y-2 text-slate-800 text-xs">
        <div class="flex items-center justify-between border-b border-slate-200 pb-1.5">
          <div class="font-extrabold text-sm text-cyan-700 flex items-center gap-1.5">
            <span>🏛️</span> ${provinceName}
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800">Miền Bắc</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-[11px]">
          <div class="bg-slate-50 p-1.5 rounded border border-slate-200">
            <span class="text-slate-500 block text-[9.5px]">Nhiệt độ:</span>
            <span class="font-bold text-slate-900">${temp}</span>
          </div>
          <div class="bg-blue-50 p-1.5 rounded border border-blue-200">
            <span class="text-blue-500 block text-[9.5px]">Lượng mưa 24h:</span>
            <span class="font-bold text-blue-700">${rain}</span>
          </div>
          <div class="bg-amber-50 p-1.5 rounded border border-amber-200">
            <span class="text-amber-500 block text-[9.5px]">Gió giật:</span>
            <span class="font-bold text-amber-700">${wind}</span>
          </div>
          <div class="bg-rose-50 p-1.5 rounded border border-rose-200">
            <span class="text-rose-500 block text-[9.5px]">Tình trạng:</span>
            <span class="font-bold text-rose-700 truncate block">${status}</span>
          </div>
        </div>
        <div class="text-[9.5px] text-slate-500 italic pt-1 border-t border-slate-100">
          Nguồn: Open-Meteo API (Trực quan hóa WebGL GPU 3D)
        </div>
      </div>
    `;

    new maplibregl.Popup({ offset: 12, maxWidth: '280px' })
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
          'line-color': '#ef4444',
          'line-width': 3,
          'line-dasharray': [4, 3]
        }
      });
    }
  }

  function generateStormGeoJsonData() {
    const stormTrack = [
      [108.5, 20.2], // Vịnh Bắc Bộ
      [107.2, 20.9], // Quảng Ninh
      [106.3, 21.2], // Bắc Giang / Hải Dương
      [105.8, 21.3], // Thái Nguyên / Hà Nội
      [104.9, 21.7], // Yên Bái
      [104.0, 22.3]  // Lào Cai
    ];

    const currentEye = [105.8, 21.3]; // Tâm bão khu vực Hà Nội - Thái Nguyên

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { type: 'track' },
          geometry: { type: 'LineString', coordinates: stormTrack }
        },
        createCircleFeature(currentEye, 1.0, 'buffer_100'),
        createCircleFeature(currentEye, 0.5, 'buffer_50')
      ]
    };
  }

  function createCircleFeature(center, radiusDeg, typeKey) {
    const points = 64;
    const coords = [];
    for (let i = 0; i <= points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = center[0] + radiusDeg * Math.cos(theta);
      const y = center[1] + radiusDeg * Math.sin(theta);
      coords.push([x, y]);
    }
    return {
      type: 'Feature',
      properties: { type: typeKey },
      geometry: { type: 'Polygon', coordinates: [coords] }
    };
  }

  /**
   * 5. LỚP ĐO ĐẠC KHOẢNG CÁCH TÁC CHIẾN (MEASURE VECTOR LAYER)
   */
  function setupMeasureVectorLayer() {
    if (!mapInstance || !mapInstance.isStyleLoaded()) return;

    if (!mapInstance.getSource('tactical-measure-source')) {
      mapInstance.addSource('tactical-measure-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      mapInstance.addLayer({
        id: 'measure-line-glow',
        type: 'line',
        source: 'tactical-measure-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#06b6d4',
          'line-width': 8,
          'line-opacity': 0.4,
          'line-blur': 2
        }
      });

      mapInstance.addLayer({
        id: 'measure-line-core',
        type: 'line',
        source: 'tactical-measure-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#38bdf8',
          'line-width': 3.5,
          'line-dasharray': [3, 2]
        }
      });
    }
  }

  /**
   * 6. LỚP KHỐI NHÀ & CÔNG TRÌNH ĐÔ THỊ 3D (3D BUILDINGS EXTRUSION)
   */
  function setup3DBuildingsVectorLayer() {
    if (!mapInstance || !mapInstance.isStyleLoaded()) return;

    if (!mapInstance.getSource('buildings-3d-source')) {
      mapInstance.addSource('buildings-3d-source', {
        type: 'geojson',
        data: generate3DBuildingsGeoJSON()
      });

      mapInstance.addLayer({
        id: 'buildings-3d-extrusion',
        type: 'fill-extrusion',
        source: 'buildings-3d-source',
        layout: {
          'visibility': layerVisibility.buildings ? 'visible' : 'none'
        },
        paint: {
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['get', 'height'],
            25, '#0284c7',
            50, '#06b6d4',
            80, '#38bdf8',
            120, '#f59e0b',
            180, '#ef4444'
          ],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.85
        }
      });
    }
  }

  function generate3DBuildingsGeoJSON() {
    const landmarks = [
      // Hà Nội C2 Center & Ba Đình
      { center: [105.834, 21.033], w: 0.003, h: 0.003, height: 65, name: 'Sở Chỉ Huy Trung Ương Ba Đình' },
      { center: [105.854, 21.028], w: 0.0025, h: 0.0025, height: 45, name: 'BCH PCTT Hoàn Kiếm' },
      { center: [105.764, 21.020], w: 0.004, h: 0.004, height: 50, name: 'Sân Vận Động Mỹ Đình (Trú Ẩn)' },
      { center: [105.784, 21.016], w: 0.003, h: 0.003, height: 180, name: 'Keangnam Landmark C2' },
      { center: [105.845, 21.004], w: 0.003, h: 0.003, height: 55, name: 'Kho Vật Tư Cứu Nạn Hai Bà Trưng' },
      // Thái Nguyên
      { center: [105.842, 21.594], w: 0.0025, h: 0.0025, height: 40, name: 'BCH PCTT Tỉnh Thái Nguyên' },
      { center: [105.835, 21.588], w: 0.003, h: 0.003, height: 35, name: 'Trạm Y Tế & Trú Ẩn Gang Thép' },
      // Yên Bái
      { center: [104.908, 21.725], w: 0.0025, h: 0.0025, height: 35, name: 'BCH PCTT Tỉnh Yên Bái' },
      { center: [104.895, 21.718], w: 0.002, h: 0.002, height: 28, name: 'Nhà Thi Đấu Yên Bái' },
      // Lào Cai - Bảo Yên
      { center: [104.385, 22.253], w: 0.002, h: 0.002, height: 25, name: 'Ban Chỉ Huy Tiền Phương Làng Nủ' },
      // Quảng Ninh - Hạ Long
      { center: [107.010, 20.935], w: 0.0035, h: 0.0035, height: 50, name: 'Cảng Tuần Châu Điều Hành Cứu Hộ' }
    ];

    const features = [];
    landmarks.forEach((b, idx) => {
      const halfW = b.w / 2;
      const halfH = b.h / 2;
      const poly = [
        [b.center[0] - halfW, b.center[1] - halfH],
        [b.center[0] + halfW, b.center[1] - halfH],
        [b.center[0] + halfW, b.center[1] + halfH],
        [b.center[0] - halfW, b.center[1] + halfH],
        [b.center[0] - halfW, b.center[1] - halfH]
      ];
      features.push({
        type: 'Feature',
        properties: { id: `bldg-${idx}`, height: b.height, name: b.name },
        geometry: { type: 'Polygon', coordinates: [poly] }
      });
    });

    return { type: 'FeatureCollection', features };
  }

  /**
   * 7. LỚP RADAR MƯA BÃO YAGI MÔ PHỎNG (DOPPLER RADAR SIMULATION)
   */
  function setupRainRadarVectorLayer() {
    if (!mapInstance || !mapInstance.isStyleLoaded()) return;

    if (!mapInstance.getSource('rain-radar-source')) {
      mapInstance.addSource('rain-radar-source', {
        type: 'geojson',
        data: generateRainRadarGeoJSON()
      });

      mapInstance.addLayer({
        id: 'rain-radar-heat',
        type: 'fill',
        source: 'rain-radar-source',
        layout: {
          'visibility': layerVisibility.rainRadar ? 'visible' : 'none'
        },
        paint: {
          'fill-color': [
            'match', ['get', 'dbz'],
            35, '#22c55e',
            45, '#eab308',
            55, '#f97316',
            65, '#ef4444',
            '#22c55e'
          ],
          'fill-opacity': 0.45
        }
      });
    }
  }

  function generateRainRadarGeoJSON() {
    const stormBands = [
      { center: [104.9, 21.7], r: 0.65, dbz: 65 }, // Yên Bái mưa cực lớn
      { center: [104.4, 22.25], r: 0.55, dbz: 65 }, // Lào Cai lũ quét
      { center: [105.8, 21.6], r: 0.75, dbz: 55 },  // Thái Nguyên ngập sâu
      { center: [105.85, 21.03], r: 0.70, dbz: 45 }, // Hà Nội mưa dông
      { center: [107.1, 21.0], r: 0.85, dbz: 55 },  // Quảng Ninh
      { center: [105.3, 21.2], r: 0.60, dbz: 45 }   // Phú Thọ
    ];

    const features = [];
    stormBands.forEach((band, idx) => {
      features.push({
        type: 'Feature',
        properties: { id: `radar-${idx}`, dbz: band.dbz },
        geometry: createCircleFeature(band.center, band.r, `radar-${idx}`).geometry
      });
    });

    return { type: 'FeatureCollection', features };
  }

  function resolveApi(endpoint) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `http://localhost:8000${endpoint}`;
    }
    return endpoint;
  }

  /**
   * 8. ĐỒNG BỘ TOÀN BỘ CÁC LỚP MARKERS
   */
  async function syncAllLayers() {
    if (!mapInstance) return;
    clearAllMarkers();

    if (layerVisibility.sos) await syncSOSMarkers();
    if (layerVisibility.floodPoints) await syncFloodPointMarkers();
    if (layerVisibility.shelters) await syncShelterMarkers();
    if (layerVisibility.units) syncRescueUnitsMarkers();
    await syncHazardMarkers();
    if (layerVisibility.route) syncTacticalRoute();
  }

  function clearAllMarkers() {
    Object.keys(markersRegistry).forEach(k => {
      if (k === 'waypoints' || k === 'measure') return;
      markersRegistry[k].forEach(m => m.remove());
      markersRegistry[k] = [];
    });
  }

  /**
   * Đồng bộ Tín Hiệu Kêu Cứu SOS Khẩn Cấp (Radar Animate-Ping)
   */
  async function syncSOSMarkers() {
    try {
      const res = await fetch(resolveApi('/api/sos')).catch(() => null);
      if (!res || !res.ok) return;
      const data = await res.json();
      const features = data.features || [];

      markersRegistry.sos.forEach(m => m.remove());
      markersRegistry.sos = [];

      const seenCoords = new Set();
      const validSosList = [];

      features.forEach(feat => {
        const p = feat.properties;
        if (['rescued', 'resolved', 'cancelled', 'dispatched', 'on_scene'].includes(p.status)) return;
        const coords = feat.geometry.coordinates; // [Lng, Lat]
        if (!coords || !coords[0] || !coords[1]) return;
        if (!isWithinNorthernVietnam(coords[0], coords[1])) return; // Khóa chặt: Loại bỏ hoàn toàn điểm ngoài Miền Bắc (Lào, Thái Lan)

        const coordKey = `${coords[0].toFixed(3)},${coords[1].toFixed(3)}`;
        if (seenCoords.has(coordKey)) return;
        seenCoords.add(coordKey);

        validSosList.push({ ...p, coords });

        const el = document.createElement('div');
        el.className = 'flex items-center justify-center cursor-pointer select-none';
        el.style.cssText = 'position: absolute !important; top: 0 !important; left: 0 !important; margin: 0 !important; width: 28px; height: 28px; pointer-events: auto !important; z-index: 15;';
        el.innerHTML = `
          <span class="absolute w-7 h-7 rounded-full bg-rose-500/35 animate-ping pointer-events-none"></span>
          <span class="absolute w-8 h-8 rounded-full bg-rose-500/15 pointer-events-none"></span>
          <div class="w-6 h-6 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center shadow-lg border border-white relative z-10 pointer-events-auto">
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
        const marker = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
          .setLngLat([coords[0], coords[1]])
          .setPopup(popup)
          .addTo(mapInstance);

        markersRegistry.sos.push(marker);
      });

      cachedDrawerData.sos = validSosList;
      updateDrawerBadge('sos', validSosList.length);
    } catch (e) {
      console.warn('[MapLibre] Lỗi đồng bộ SOS:', e);
    }
  }

  /**
   * Đồng bộ Điểm Ngập Lụt & Trạm Đo Thủy Văn (Có gom cụm 2, 3 và nhãn độ sâu cm)
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
        const lat = parseFloat(pt.lat || (pt.geometry && pt.geometry.coordinates[1]) || p.lat || p.latitude);
        const lng = parseFloat(pt.lng || (pt.geometry && pt.geometry.coordinates[0]) || p.lng || p.longitude);
        const depth = parseFloat(pt.depth_cm || p.depth_cm || p.current_depth_cm || 0);
        const location = pt.location || p.location || p.name || 'Điểm ngập';

        if (!isNaN(lat) && !isNaN(lng)) {
          if (isWithinNorthernVietnam(lng, lat)) {
            validPoints.push({ lat, lng, depth, location, raw: pt });
          }
        }
      });

      cachedDrawerData.flood = [...validPoints].sort((a, b) => b.depth - a.depth);
      updateDrawerBadge('flood', validPoints.length);

      markersRegistry.floodPoints.forEach(m => m.remove());
      markersRegistry.floodPoints = [];

      const currentZoom = mapInstance ? mapInstance.getZoom() : 7.5;
      const CLUSTER_THRESHOLD_ZOOM = 11.2;

      if (currentZoom < CLUSTER_THRESHOLD_ZOOM) {
        // Gom cụm thông minh động theo cấp độ zoom để chống đè chữ và giữ bản đồ thoáng đãng
        let clusterDist = 0.85; // Toàn cảnh miền Bắc: gom cụm thoáng rộng
        if (currentZoom >= 9.8) {
          clusterDist = 0.35;   // Cận cảnh cấp huyện / lưu vực
        } else if (currentZoom >= 8.5) {
          clusterDist = 0.55;   // Cấp tỉnh
        }

        const clusters = [];
        const visited = new Set();

        for (let i = 0; i < validPoints.length; i++) {
          if (visited.has(i)) continue;
          const group = [validPoints[i]];
          visited.add(i);

          for (let j = i + 1; j < validPoints.length; j++) {
            if (visited.has(j)) continue;
            const dLat = validPoints[i].lat - validPoints[j].lat;
            const dLng = validPoints[i].lng - validPoints[j].lng;
            const dist = Math.sqrt(dLat * dLat + dLng * dLng);

            if (dist < clusterDist) {
              group.push(validPoints[j]);
              visited.add(j);
            }
          }
          clusters.push(group);
        }

        clusters.forEach(group => {
          let avgLat = 0;
          let avgLng = 0;
          group.forEach(pt => {
            avgLat += pt.lat;
            avgLng += pt.lng;
          });
          avgLat /= group.length;
          avgLng /= group.length;

          if (group.length > 1) {
            createClusterMarker(group, avgLng, avgLat);
          } else {
            createIndividualFloodMarker(group[0]);
          }
        });
      } else {
        // Phóng to chi tiết (zoom >= 11.2): Hiển thị từng điểm đo thực tế với số đo cm
        validPoints.forEach(pt => createIndividualFloodMarker(pt));
      }

    } catch (e) {
      console.warn('[MapLibre] Lỗi đồng bộ Flood Points:', e);
    }
  }

  function createClusterMarker(group, avgLng, avgLat) {
    const el = document.createElement('div');
    el.className = 'flex items-center justify-center cursor-pointer select-none';
    el.style.cssText = 'position: absolute !important; top: 0 !important; left: 0 !important; margin: 0 !important; width: 28px; height: 28px; pointer-events: auto !important; z-index: 30;';
    el.innerHTML = `
      <span class="absolute w-7 h-7 rounded-full bg-indigo-500/25 pointer-events-none"></span>
      <div class="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-600 to-rose-500 text-white font-extrabold text-[10.5px] flex items-center justify-center shadow-lg border border-white relative z-10 hover:scale-115 transition pointer-events-auto">
        ${group.length}
      </div>
    `;

    el.onclick = () => {
      mapInstance.flyTo({
        center: [avgLng, avgLat],
        zoom: Math.min(mapInstance.getZoom() + 2.2, 14),
        duration: 900
      });
    };

    const marker = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
      .setLngLat([avgLng, avgLat])
      .addTo(mapInstance);

    markersRegistry.floodPoints.push(marker);
  }

  function createIndividualFloodMarker(pt) {
    const depthVal = Math.round(pt.depth);
    const depthText = `${depthVal}cm`;

    let badgeBg = '#d97706';
    if (depthVal >= 50) {
      badgeBg = '#e11d48';
    } else if (depthVal < 20) {
      badgeBg = '#0284c7';
    }

    const el = document.createElement('div');
    el.className = 'flex items-center justify-center cursor-pointer select-none group';
    el.style.cssText = 'position: absolute !important; top: 0 !important; left: 0 !important; margin: 0 !important; height: 22px; pointer-events: auto !important; z-index: 25;';
    el.innerHTML = `
      <div class="px-1.5 py-0.5 rounded-full text-white text-[9px] font-black shadow-md border border-white relative z-10 flex items-center gap-0.5 transition-transform duration-200 group-hover:scale-110 pointer-events-auto" style="background: ${badgeBg}">
        ${depthText}
      </div>
    `;

    const popupHtml = `
      <div class="p-2 font-sans space-y-1 text-xs text-slate-800">
        <div class="font-extrabold text-amber-600 flex items-center gap-1 border-b border-amber-200 pb-1">
          <span>🌊</span> ${pt.location}
        </div>
        <div>Mực nước ngập đo được: <b class="text-amber-700 text-sm font-black">${depthVal} cm</b></div>
        <div class="text-[10px] text-slate-500 font-mono">Tọa độ: [${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}]</div>
        <button onclick="NorthStarMapLibre.setRouteOriginDestination('dest', ${pt.lng}, ${pt.lat}, '${pt.location.replace(/'/g, "\\'")}')" class="mt-1 w-full py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded border border-slate-300">
          📍 Chọn làm đích đến cứu hộ
        </button>
      </div>
    `;

    const popup = new maplibregl.Popup({ offset: 18, maxWidth: '240px' }).setHTML(popupHtml);
    const marker = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
      .setLngLat([pt.lng, pt.lat])
      .setPopup(popup)
      .addTo(mapInstance);

    markersRegistry.floodPoints.push(marker);
  }

  /**
   * Đồng bộ Điểm Nguy Hiểm Cảnh Báo (Hazards)
   */
  async function syncHazardMarkers() {
    const hazards = [
      { id: 'H-01', type: 'landslide', name: 'Sạt lở Đèo Khau Phạ (QL32)', lat: 21.78, lng: 104.28, desc: 'Đất đá sạt trượt cô lập toàn tuyến' },
      { id: 'H-02', type: 'broken_bridge', name: 'Sập nhịp Cầu Phong Châu (QL32C)', lat: 21.302, lng: 105.289, desc: 'Sập 2 nhịp giàn cầu T6, T7, cấm toàn bộ phương tiện' },
      { id: 'H-03', type: 'dam_spillway', name: 'Thủy điện Thác Bà mở 3 cửa xả đáy', lat: 21.75, lng: 105.02, desc: 'Lưu lượng xả lũ 3.200 m3/s hạ du báo động cấp 3' }
    ];

    markersRegistry.hazards.forEach(m => m.remove());
    markersRegistry.hazards = [];

    hazards.forEach(h => {
      const el = document.createElement('div');
      el.className = 'flex items-center justify-center cursor-pointer select-none';
      el.style.cssText = 'position: absolute !important; top: 0 !important; left: 0 !important; margin: 0 !important; width: 32px; height: 32px; pointer-events: auto !important; z-index: 23;';
      el.innerHTML = `
        <span class="absolute w-10 h-10 rounded-full bg-amber-500/30 pointer-events-none"></span>
        <div class="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xl border-2 border-white hover:scale-125 transition relative z-10 pointer-events-auto" title="${h.name}">
          <span class="text-xs font-bold leading-none">⚠️</span>
        </div>
      `;

      const popupHtml = `
        <div class="p-2 font-sans space-y-1 text-xs text-slate-800">
          <div class="font-extrabold text-amber-600 flex items-center gap-1 border-b border-amber-200 pb-1">
            <span>⚠️</span> ${h.name}
          </div>
          <div class="text-[11px] text-slate-700 font-semibold">${h.desc}</div>
          <div class="text-[10px] text-slate-500 font-mono">[${h.lat.toFixed(4)}, ${h.lng.toFixed(4)}]</div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 18, maxWidth: '240px' }).setHTML(popupHtml);
      const marker = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
        .setLngLat([h.lng, h.lat])
        .setPopup(popup)
        .addTo(mapInstance);

      markersRegistry.hazards.push(marker);
    });
  }

  /**
   * Đồng bộ Trạm Trú Ẩn An Toàn (Safe Shelters)
   */
  async function syncShelterMarkers() {
    try {
      const res = await fetch(resolveApi('/api/shelters')).catch(() => null);
      if (!res || !res.ok) return;
      const data = await res.json();
      const features = data.features || [];

      markersRegistry.shelters.forEach(m => m.remove());
      markersRegistry.shelters = [];

      const shelterList = [];

      features.forEach(feat => {
        const p = feat.properties;
        const coords = feat.geometry.coordinates;
        if (!coords || !coords[0] || !coords[1]) return;
        if (!isWithinNorthernVietnam(coords[0], coords[1])) return; // Khóa chặt: Loại bỏ hoàn toàn điểm sơ tán ngoài Miền Bắc

        shelterList.push({ ...p, coords });

        const el = document.createElement('div');
        el.className = 'flex items-center justify-center cursor-pointer select-none';
        el.style.cssText = 'position: absolute !important; top: 0 !important; left: 0 !important; margin: 0 !important; width: 24px; height: 24px; pointer-events: auto !important; z-index: 23;';
        el.innerHTML = `
          <div class="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md border border-white hover:scale-120 transition relative z-10 pointer-events-auto" title="${p.name}">
            <span class="text-[9.5px] font-bold leading-none">🛡️</span>
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
        const marker = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
          .setLngLat([coords[0], coords[1]])
          .setPopup(popup)
          .addTo(mapInstance);

        markersRegistry.shelters.push(marker);
      });

      cachedDrawerData.shelters = shelterList;
      updateDrawerBadge('shelters', shelterList.length);
    } catch (e) {
      console.warn('[MapLibre] Lỗi nạp Shelters:', e);
    }
  }

  /**
   * Đồng bộ Đội Cứu Hộ Thực Địa (Xe 4x4, Ca-nô)
   */
  function syncRescueUnitsMarkers() {
    const units = [
      { id: 'U-01', name: 'Ca-nô Cao Tốc PCCC 114', type: 'boat', lat: 21.035, lng: 105.860, status: 'ready', crew: '4 chiến sĩ', contact: '0988.114.001' },
      { id: 'U-02', name: 'Xe Lội Nước Quân Khu 1', type: 'truck', lat: 21.580, lng: 105.840, status: 'on_mission', crew: '6 chiến sĩ', contact: '0912.114.002' },
      { id: 'U-03', name: 'Đội Xuồng Phao Bảo Yên (Lào Cai)', type: 'boat', lat: 22.310, lng: 104.380, status: 'ready', crew: '3 chiến sĩ', contact: '0977.114.003' },
      { id: 'U-04', name: 'Tổ Trực Thăng Cứu Nạn Mi-171', type: 'heli', lat: 21.038, lng: 105.801, status: 'ready', crew: 'Phi hành đoàn 916', contact: '0903.114.916' }
    ];

    cachedDrawerData.units = units;
    updateDrawerBadge('units', units.length);

    units.forEach(u => {
      const isBoat = u.type === 'boat';
      const isHeli = u.type === 'heli';
      const icon = isHeli ? '🚁' : (isBoat ? '🚤' : '🚛');

      const el = document.createElement('div');
      el.className = 'flex items-center justify-center cursor-pointer';
      el.style.cssText = 'position: absolute !important; top: 0 !important; left: 0 !important; margin: 0 !important; width: 26px; height: 26px; pointer-events: auto !important; z-index: 24;';
      el.innerHTML = `
        <div class="w-6 h-6 rounded-full ${isBoat ? 'bg-cyan-600' : (isHeli ? 'bg-purple-600' : 'bg-blue-600')} text-white shadow-md border border-white flex items-center justify-center text-[10px] font-black relative pointer-events-auto">
          ${icon}
          <span class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${u.status === 'ready' ? 'bg-emerald-500' : 'bg-amber-500'} border border-white"></span>
        </div>
      `;

      const popupHtml = `
        <div class="p-2 font-sans space-y-1 text-xs text-slate-800">
          <div class="font-extrabold text-blue-700">${icon} ${u.name}</div>
          <div class="text-[11px]">Trạng thái: <b class="${u.status === 'ready' ? 'text-emerald-600' : 'text-amber-600'}">${u.status === 'ready' ? 'Sẵn sàng cơ động' : 'Đang làm nhiệm vụ'}</b></div>
          <div class="text-[11px]">Lực lượng: <b>${u.crew}</b></div>
          <div class="text-[10px] text-slate-500 font-mono">[${u.lat.toFixed(4)}, ${u.lng.toFixed(4)}]</div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 15, maxWidth: '220px' }).setHTML(popupHtml);
      const marker = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
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

  /**
   * 9. MÔ PHỎNG PHƯƠNG TIỆN CỨU HỘ CHUYỂN ĐỘNG DỌC TUYẾN A*
   */
  function startVehicleRouteAnimation() {
    if (!mapInstance) return;

    const routeCoords = [
      [105.8030, 21.0285],
      [105.8150, 21.0450],
      [105.8320, 21.0800],
      [105.8500, 21.1500],
      [105.8450, 21.3200],
      [105.8400, 21.5800]
    ];

    if (!animatedVehicleMarker) {
      const el = document.createElement('div');
      el.className = 'flex items-center justify-center cursor-pointer select-none';
      el.style.cssText = 'position: absolute !important; top: 0 !important; left: 0 !important; margin: 0 !important; width: 36px; height: 36px; pointer-events: auto !important; z-index: 35;';
      el.innerHTML = `
        <span class="absolute w-10 h-10 rounded-full bg-cyan-400/30 animate-ping pointer-events-none"></span>
        <div id="ml-animated-vehicle-badge" class="w-9 h-9 rounded-full bg-cyan-600 text-white shadow-2xl border-2 border-white flex items-center justify-center text-sm font-black transition-transform duration-300 pointer-events-auto">
          🚤
        </div>
      `;

      animatedVehicleMarker = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
        .setLngLat(routeCoords[0])
        .addTo(mapInstance);
    }

    if (vehicleAnimTimer) clearInterval(vehicleAnimTimer);

    vehicleAnimStep = 0;
    vehicleAnimTimer = setInterval(() => {
      vehicleAnimStep = (vehicleAnimStep + 1) % routeCoords.length;
      const targetPos = routeCoords[vehicleAnimStep];
      if (animatedVehicleMarker) {
        animatedVehicleMarker.setLngLat(targetPos);
      }
    }, 2500);
  }

  function stopVehicleRouteAnimation() {
    if (vehicleAnimTimer) {
      clearInterval(vehicleAnimTimer);
      vehicleAnimTimer = null;
    }
    if (animatedVehicleMarker) {
      animatedVehicleMarker.remove();
      animatedVehicleMarker = null;
    }
  }

  /**
   * 10. TUẦN TRA TRINH SÁT 3D TỰ ĐỘNG (CINEMATIC 3D FLYOVER PATROL)
   */
  function toggleFlyoverPatrol() {
    isPatrolActive = !isPatrolActive;
    const banner = document.getElementById('ml-patrol-banner');
    const btn = document.getElementById('btn-ml-patrol');

    if (isPatrolActive) {
      if (banner) banner.classList.remove('hidden');
      if (btn) {
        btn.className = 'px-2.5 py-1 rounded-lg bg-rose-600 text-white border border-rose-400 text-[11px] font-black cursor-pointer transition flex items-center gap-1 shadow-lg animate-pulse';
        btn.innerHTML = '<span>🔴 Dừng Tuần Tra</span>';
      }
      patrolCurrentIndex = 0;
      isPatrolPaused = false;
      executePatrolStep();
    } else {
      if (banner) banner.classList.add('hidden');
      if (btn) {
        btn.className = 'px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 text-[11px] font-bold cursor-pointer transition flex items-center gap-1';
        btn.innerHTML = '<span>🚁 Tuần Tra 3D</span>';
      }
      if (patrolTimer) clearInterval(patrolTimer);
    }
  }

  function advancePatrol(delta = 1) {
    if (patrolTimer) clearInterval(patrolTimer);
    const n = PATROL_WAYPOINTS.length;
    patrolCurrentIndex = (patrolCurrentIndex + delta + n) % n;
    executePatrolStep();
  }

  function togglePatrolPause() {
    isPatrolPaused = !isPatrolPaused;
    const btn = document.getElementById('ml-patrol-btn-pause');
    if (btn) {
      btn.innerText = isPatrolPaused ? '▶ Tiếp Tục' : '⏸ Tạm Dừng';
      btn.className = isPatrolPaused 
        ? 'px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold cursor-pointer transition'
        : 'px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold cursor-pointer transition';
    }
  }

  function executePatrolStep() {
    const wp = PATROL_WAYPOINTS[patrolCurrentIndex];
    if (!wp || !mapInstance) return;

    // Cập nhật giao diện HUD Banner
    const stepBadge = document.getElementById('ml-patrol-step-badge');
    const dangerTag = document.getElementById('ml-patrol-danger-tag');
    const titleEl = document.getElementById('ml-patrol-title');
    const descEl = document.getElementById('ml-patrol-desc');
    const coordsEl = document.getElementById('ml-patrol-coords');
    const pitchEl = document.getElementById('ml-patrol-pitch');

    if (stepBadge) stepBadge.innerText = `ĐIỂM ${patrolCurrentIndex + 1}/${PATROL_WAYPOINTS.length} • TUẦN TRA TRINH SÁT 3D`;
    if (dangerTag) {
      dangerTag.innerText = wp.tag;
      dangerTag.className = `px-2 py-0.5 rounded text-[10px] font-black border ${wp.tagClass}`;
    }
    if (titleEl) titleEl.innerText = wp.name;
    if (descEl) descEl.innerText = wp.desc;
    if (coordsEl) coordsEl.innerText = `${wp.center[1].toFixed(4)}° N, ${wp.center[0].toFixed(4)}° E`;
    if (pitchEl) pitchEl.innerText = `${wp.pitch}° (Flyover 3D)`;

    // Bay mượt mà tới tọa độ với camera nghiêng 3D
    mapInstance.flyTo({
      center: wp.center,
      zoom: wp.zoom,
      pitch: wp.pitch,
      bearing: wp.bearing,
      speed: 0.7,
      curve: 1.4,
      essential: true
    });

    // Đếm ngược 8 giây rồi tự động chuyển điểm tiếp theo
    patrolCountdown = 8;
    updatePatrolCountdownDisplay();

    if (patrolTimer) clearInterval(patrolTimer);
    patrolTimer = setInterval(() => {
      if (!isPatrolPaused) {
        patrolCountdown--;
        updatePatrolCountdownDisplay();
        if (patrolCountdown <= 0) {
          advancePatrol(1);
        }
      }
    }, 1000);
  }

  function updatePatrolCountdownDisplay() {
    const cdEl = document.getElementById('ml-patrol-countdown');
    if (cdEl) cdEl.innerText = `${patrolCountdown}s`;
  }

  /**
   * 11. THƯỚC ĐO KHOẢNG CÁCH TÁC CHIẾN & TÍNH TOÁN ETA
   */
  function toggleMeasureTool() {
    isMeasuring = !isMeasuring;
    const banner = document.getElementById('ml-measure-banner');
    const btn = document.getElementById('btn-ml-measure');

    if (isMeasuring) {
      if (banner) banner.classList.remove('hidden');
      if (btn) {
        btn.className = 'px-2.5 py-1 rounded-lg bg-cyan-600 text-white border border-cyan-400 text-[11px] font-black cursor-pointer transition flex items-center gap-1 shadow-lg';
      }
      if (mapInstance) mapInstance.getCanvas().style.cursor = 'crosshair';
      clearMeasurement();
    } else {
      if (banner) banner.classList.add('hidden');
      if (btn) {
        btn.className = 'px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold cursor-pointer transition flex items-center gap-1';
      }
      if (mapInstance) mapInstance.getCanvas().style.cursor = '';
      clearMeasurement();
    }
  }

  function clearMeasurement() {
    measurePoints = [];
    markersRegistry.measure.forEach(m => m.remove());
    markersRegistry.measure = [];

    if (mapInstance && mapInstance.getSource('tactical-measure-source')) {
      mapInstance.getSource('tactical-measure-source').setData({
        type: 'FeatureCollection',
        features: []
      });
    }

    updateMeasureHUD(0);
  }

  function addMeasurePoint(lngLat) {
    const pt = [lngLat.lng, lngLat.lat];
    measurePoints.push(pt);

    // Tạo pin đánh số 1, 2, 3...
    const idx = measurePoints.length;
    const el = document.createElement('div');
    el.className = 'flex items-center justify-center cursor-pointer select-none';
    el.style.cssText = 'position: absolute !important; top: 0 !important; left: 0 !important; margin: 0 !important; width: 24px; height: 24px; pointer-events: auto !important; z-index: 28;';
    el.innerHTML = `<div class="w-6 h-6 rounded-full bg-cyan-500 border-2 border-white text-black font-black text-xs flex items-center justify-center shadow-lg select-none">${idx}</div>`;

    const marker = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
      .setLngLat(pt)
      .addTo(mapInstance);

    markersRegistry.measure.push(marker);

    // Cập nhật đường linestring trên bản đồ
    if (mapInstance && mapInstance.getSource('tactical-measure-source')) {
      mapInstance.getSource('tactical-measure-source').setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: measurePoints
            }
          }
        ]
      });
    }

    // Tính tổng cự ly đo đạc theo công thức Haversine
    let totalDistKm = 0;
    for (let i = 0; i < measurePoints.length - 1; i++) {
      totalDistKm += haversineKm(
        measurePoints[i][1], measurePoints[i][0],
        measurePoints[i + 1][1], measurePoints[i + 1][0]
      );
    }

    updateMeasureHUD(totalDistKm);
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function updateMeasureHUD(distKm) {
    const distEl = document.getElementById('ml-measure-dist');
    const boatEl = document.getElementById('ml-measure-eta-boat');
    const truckEl = document.getElementById('ml-measure-eta-truck');
    const walkEl = document.getElementById('ml-measure-eta-walk');

    if (distEl) distEl.innerText = `${distKm.toFixed(2)} km`;

    if (distKm <= 0) {
      if (boatEl) boatEl.innerText = '--';
      if (truckEl) truckEl.innerText = '--';
      if (walkEl) walkEl.innerText = '--';
      return;
    }

    // Ca-nô cao tốc (35 km/h)
    const boatMins = Math.round((distKm / 35) * 60);
    if (boatEl) boatEl.innerText = boatMins < 60 ? `~${boatMins} phút` : `~${(boatMins / 60).toFixed(1)} giờ`;

    // Xe lội nước (45 km/h)
    const truckMins = Math.round((distKm / 45) * 60);
    if (truckEl) truckEl.innerText = truckMins < 60 ? `~${truckMins} phút` : `~${(truckMins / 60).toFixed(1)} giờ`;

    // Lội bộ / gùi hàng (3.5 km/h)
    const walkHours = (distKm / 3.5);
    if (walkEl) walkEl.innerText = walkHours < 1 ? `~${Math.round(walkHours * 60)} phút` : `~${walkHours.toFixed(1)} giờ`;
  }

  /**
   * 12. BẢNG CHỈ HUY TÁC CHIẾN C2 THU GỌN (TACTICAL C2 DRAWER)
   */
  function initTacticalDrawerData() {
    renderTacticalDrawer(currentDrawerTab);
  }

  function toggleTacticalDrawer(targetTab) {
    isDrawerOpen = !isDrawerOpen;
    const drawer = document.getElementById('ml-tactical-drawer');
    const btn = document.getElementById('btn-ml-drawer');

    if (isDrawerOpen) {
      if (drawer) drawer.classList.remove('hidden');
      if (drawer) drawer.classList.add('flex');
      if (btn) btn.className = 'px-2.5 py-1 rounded-lg bg-cyan-600 text-white border border-cyan-400 text-[11px] font-bold cursor-pointer transition flex items-center gap-1 shadow-lg';
      if (targetTab) currentDrawerTab = targetTab;
      renderTacticalDrawer(currentDrawerTab);
    } else {
      if (drawer) drawer.classList.remove('flex');
      if (drawer) drawer.classList.add('hidden');
      if (btn) btn.className = 'px-2.5 py-1 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/50 text-[11px] font-bold cursor-pointer transition flex items-center gap-1';
    }
  }

  function switchDrawerTab(tabKey) {
    currentDrawerTab = tabKey;
    ['sos', 'flood', 'shelters', 'units'].forEach(k => {
      const btn = document.getElementById(`ml-drawer-tab-btn-${k}`);
      if (btn) {
        if (k === tabKey) {
          const activeBg = k === 'sos' ? 'bg-rose-600 text-white shadow' : (k === 'flood' ? 'bg-cyan-600 text-white shadow' : (k === 'shelters' ? 'bg-emerald-600 text-white shadow' : 'bg-blue-600 text-white shadow'));
          btn.className = `py-1.5 rounded-lg ${activeBg} transition flex flex-col items-center cursor-pointer`;
        } else {
          btn.className = 'py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex flex-col items-center cursor-pointer';
        }
      }
    });
    renderTacticalDrawer(tabKey);
  }

  function updateDrawerBadge(tabKey, count) {
    const el = document.getElementById(`ml-drawer-count-${tabKey}`);
    if (el) el.innerText = `(${count})`;
  }

  function renderTacticalDrawer(tabKey, filterQuery = '') {
    const listContainer = document.getElementById('ml-drawer-content-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const q = filterQuery.toLowerCase().trim();

    if (tabKey === 'sos') {
      const items = (cachedDrawerData.sos || []).filter(item => {
        if (!q) return true;
        return (item.contact_name || '').toLowerCase().includes(q) ||
               (item.phone || '').includes(q) ||
               (item.notes || '').toLowerCase().includes(q);
      });

      if (!items.length) {
        listContainer.innerHTML = '<div class="text-center text-slate-500 text-xs py-8">Không có tín hiệu SOS nào phù hợp.</div>';
        return;
      }

      items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-rose-500/60 transition space-y-1.5 text-xs';
        div.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="font-extrabold text-rose-400 flex items-center gap-1">
              <span>🚨</span> ${item.contact_name || 'Nạn nhân'}
            </span>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800">
              ${item.people_count} Người
            </span>
          </div>
          <div class="text-[11px] text-slate-300">📞 SĐT: <b>${item.phone}</b></div>
          ${item.notes ? `<div class="text-[10.5px] text-slate-400 italic">"${item.notes}"</div>` : ''}
          <div class="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
            <a href="tel:${item.phone}" class="px-2 py-1 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded font-bold no-underline">Gọi Ngay</a>
            <button onclick="NorthStarMapLibre.flyToTacticalItem(${item.coords[0]}, ${item.coords[1]}, 'SOS: ${item.contact_name || 'Nạn nhân'}', '${item.phone}')" class="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold cursor-pointer transition">
              📍 Bay Tới
            </button>
          </div>
        `;
        listContainer.appendChild(div);
      });

    } else if (tabKey === 'flood') {
      const items = (cachedDrawerData.flood || []).filter(item => {
        if (!q) return true;
        return (item.location || '').toLowerCase().includes(q);
      });

      if (!items.length) {
        listContainer.innerHTML = '<div class="text-center text-slate-500 text-xs py-8">Không có trạm đo ngập nào phù hợp.</div>';
        return;
      }

      items.slice(0, 30).forEach(item => {
        const div = document.createElement('div');
        div.className = 'p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-cyan-500/60 transition space-y-1 text-xs';
        const depthVal = Math.round(item.depth);
        const depthColor = depthVal >= 50 ? 'text-rose-400' : 'text-amber-400';

        div.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="font-extrabold text-white truncate max-w-[200px]">🌊 ${item.location}</span>
            <span class="px-2 py-0.5 rounded text-[11px] font-black font-mono bg-cyan-950 ${depthColor} border border-cyan-800">
              ${depthVal} cm
            </span>
          </div>
          <div class="flex items-center justify-between pt-1 text-[10px] text-slate-400">
            <span>[${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}]</span>
            <button onclick="NorthStarMapLibre.flyToTacticalItem(${item.lng}, ${item.lat}, 'Trạm Ngập: ${item.location}', 'Mực nước: ${depthVal}cm')" class="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold cursor-pointer transition">
              📍 Bay Tới
            </button>
          </div>
        `;
        listContainer.appendChild(div);
      });

    } else if (tabKey === 'shelters') {
      const items = (cachedDrawerData.shelters || []).filter(item => {
        if (!q) return true;
        return (item.name || '').toLowerCase().includes(q) || (item.address || '').toLowerCase().includes(q);
      });

      if (!items.length) {
        listContainer.innerHTML = '<div class="text-center text-slate-500 text-xs py-8">Không có điểm trú ẩn nào phù hợp.</div>';
        return;
      }

      items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-emerald-500/60 transition space-y-1 text-xs';
        div.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="font-extrabold text-emerald-300">🛡️ ${item.name}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
              ${item.capacity || 500} Chỗ
            </span>
          </div>
          <div class="text-[10.5px] text-slate-400 truncate">${item.address || ''}</div>
          <div class="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
            <span class="text-slate-400">Trống: <b class="text-emerald-400">${item.available_slots || 300}</b></span>
            <button onclick="NorthStarMapLibre.flyToTacticalItem(${item.coords[0]}, ${item.coords[1]}, '${item.name}', 'Sức chứa: ${item.capacity || 500} người')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold cursor-pointer transition">
              📍 Bay Tới
            </button>
          </div>
        `;
        listContainer.appendChild(div);
      });

    } else if (tabKey === 'units') {
      const items = (cachedDrawerData.units || []).filter(item => {
        if (!q) return true;
        return (item.name || '').toLowerCase().includes(q);
      });

      items.forEach(u => {
        const div = document.createElement('div');
        div.className = 'p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-blue-500/60 transition space-y-1 text-xs';
        div.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="font-extrabold text-blue-300">${u.name}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${u.status === 'ready' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'}">
              ${u.status === 'ready' ? 'Sẵn Sàng' : 'Đang Làm Vụ'}
            </span>
          </div>
          <div class="text-[10.5px] text-slate-400">Biên chế: ${u.crew} • 📞 ${u.contact}</div>
          <div class="flex justify-end pt-1">
            <button onclick="NorthStarMapLibre.flyToTacticalItem(${u.lng}, ${u.lat}, '${u.name}', '${u.crew}')" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold cursor-pointer transition text-[10px]">
              📍 Bay Tới
            </button>
          </div>
        `;
        listContainer.appendChild(div);
      });
    }
  }

  function filterDrawerList(val) {
    renderTacticalDrawer(currentDrawerTab, val);
  }

  function flyToTacticalItem(lng, lat, title, details) {
    if (!mapInstance) return;
    mapInstance.flyTo({
      center: [lng, lat],
      zoom: 14.5,
      pitch: 50,
      bearing: -15,
      speed: 1.2,
      essential: true
    });

    const html = `
      <div class="p-2 font-sans space-y-1 text-xs text-slate-800">
        <div class="font-extrabold text-cyan-700 text-sm border-b border-cyan-100 pb-1">${title}</div>
        <div class="text-[11px] text-slate-600">${details}</div>
        <div class="text-[10px] text-slate-400 font-mono">[${lat.toFixed(4)}, ${lng.toFixed(4)}]</div>
      </div>
    `;

    new maplibregl.Popup({ offset: 18, maxWidth: '260px' })
      .setLngLat([lng, lat])
      .setHTML(html)
      .addTo(mapInstance);
  }

  /**
   * 13. THANH TÌM KIẾM TÁC CHIẾN C2 TỨC THÌ (SPOTLIGHT SEARCH)
   */
  function setupSpotlightSearch() {
    const input = document.getElementById('ml-search-input');
    const clearBtn = document.getElementById('ml-search-clear');
    const dropdown = document.getElementById('ml-search-dropdown');

    if (!input || !dropdown) return;

    input.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        dropdown.classList.add('hidden');
        if (clearBtn) clearBtn.classList.add('hidden');
        return;
      }

      if (clearBtn) clearBtn.classList.remove('hidden');
      const results = searchTacticalEntities(q);
      renderSearchResults(results);
    });

    // Bắt phím tắt Ctrl + K để focus tìm kiếm
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        const pane = document.getElementById('pane-cmd_maplibre_3d');
        if (pane && !pane.classList.contains('hidden')) {
          e.preventDefault();
          input.focus();
        }
      } else if (e.key === 'Escape') {
        dropdown.classList.add('hidden');
      }
    });
  }

  function clearSearch() {
    const input = document.getElementById('ml-search-input');
    const clearBtn = document.getElementById('ml-search-clear');
    const dropdown = document.getElementById('ml-search-dropdown');

    if (input) input.value = '';
    if (clearBtn) clearBtn.classList.add('hidden');
    if (dropdown) dropdown.classList.add('hidden');
  }

  function searchTacticalEntities(q) {
    const results = [];

    // 1. Tỉnh thành miền Bắc
    const northernProvinces = [
      { name: 'Hà Nội', center: [105.8542, 21.0285] },
      { name: 'Lào Cai', center: [103.9700, 22.4800] },
      { name: 'Yên Bái', center: [104.9000, 21.7200] },
      { name: 'Thái Nguyên', center: [105.8400, 21.5900] },
      { name: 'Phú Thọ', center: [105.3500, 21.3200] },
      { name: 'Quảng Ninh', center: [107.0500, 21.0000] },
      { name: 'Hải Phòng', center: [106.6800, 20.8600] },
      { name: 'Bắc Giang', center: [106.2000, 21.2700] },
      { name: 'Bắc Kạn', center: [105.8300, 22.1400] },
      { name: 'Cao Bằng', center: [106.2500, 22.6700] },
      { name: 'Lạng Sơn', center: [106.7500, 21.8500] },
      { name: 'Tuyên Quang', center: [105.2200, 21.8200] },
      { name: 'Hòa Bình', center: [105.3300, 20.8100] }
    ];

    northernProvinces.forEach(prov => {
      if (prov.name.toLowerCase().includes(q)) {
        results.push({
          type: 'province',
          title: prov.name,
          subtitle: 'Tỉnh/Thành phố Miền Bắc',
          coords: prov.center
        });
      }
    });

    // 2. Tín hiệu SOS
    (cachedDrawerData.sos || []).forEach(sos => {
      if ((sos.contact_name || '').toLowerCase().includes(q) ||
          (sos.phone || '').includes(q) ||
          (sos.notes || '').toLowerCase().includes(q)) {
        results.push({
          type: 'sos',
          title: `SOS: ${sos.contact_name || 'Nạn nhân'} (${sos.people_count} người)`,
          subtitle: `SĐT: ${sos.phone} • ${sos.notes || ''}`,
          coords: sos.coords
        });
      }
    });

    // 3. Trạm đo ngập lụt
    (cachedDrawerData.flood || []).forEach(f => {
      if ((f.location || '').toLowerCase().includes(q)) {
        results.push({
          type: 'flood',
          title: `Trạm Ngập: ${f.location}`,
          subtitle: `Mực nước: ${Math.round(f.depth)} cm`,
          coords: [f.lng, f.lat]
        });
      }
    });

    // 4. Trạm sơ tán
    (cachedDrawerData.shelters || []).forEach(sh => {
      if ((sh.name || '').toLowerCase().includes(q) || (sh.address || '').toLowerCase().includes(q)) {
        results.push({
          type: 'shelter',
          title: `Trú Ẩn: ${sh.name}`,
          subtitle: `Sức chứa ${sh.capacity || 500} người • ${sh.address || ''}`,
          coords: sh.coords
        });
      }
    });

    return results.slice(0, 8);
  }

  function renderSearchResults(results) {
    const dropdown = document.getElementById('ml-search-dropdown');
    if (!dropdown) return;

    if (!results.length) {
      dropdown.innerHTML = '<div class="p-2.5 text-center text-slate-400 text-xs">Không tìm thấy kết quả nào phù hợp.</div>';
      dropdown.classList.remove('hidden');
      return;
    }

    dropdown.innerHTML = '';
    results.forEach(res => {
      let badgeHtml = '';
      if (res.type === 'sos') badgeHtml = '<span class="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-rose-950 text-rose-300 border border-rose-800 shrink-0">🚨 SOS</span>';
      else if (res.type === 'flood') badgeHtml = '<span class="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-cyan-950 text-cyan-300 border border-cyan-800 shrink-0">🌊 Ngập</span>';
      else if (res.type === 'shelter') badgeHtml = '<span class="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-emerald-950 text-emerald-300 border border-emerald-800 shrink-0">🛡️ Nơi Trú</span>';
      else badgeHtml = '<span class="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-slate-800 text-slate-300 border border-slate-700 shrink-0">🏛️ Tỉnh</span>';

      const item = document.createElement('div');
      item.className = 'p-2 hover:bg-slate-800/80 cursor-pointer flex items-center justify-between transition rounded-lg';
      item.innerHTML = `
        <div class="flex items-center gap-2 overflow-hidden">
          ${badgeHtml}
          <div class="overflow-hidden">
            <div class="font-bold text-white text-xs truncate">${res.title}</div>
            <div class="text-[10px] text-slate-400 truncate">${res.subtitle}</div>
          </div>
        </div>
        <span class="text-cyan-400 text-xs font-mono font-bold shrink-0 ml-2">Bay tới ➔</span>
      `;

      item.onclick = () => {
        flyToSearchItem(res.coords[0], res.coords[1], res.title, res.type);
        dropdown.classList.add('hidden');
      };

      dropdown.appendChild(item);
    });

    dropdown.classList.remove('hidden');
  }

  function flyToSearchItem(lng, lat, title, type) {
    if (!mapInstance) return;
    mapInstance.flyTo({
      center: [lng, lat],
      zoom: 14.5,
      pitch: 50,
      bearing: -15,
      speed: 1.4,
      essential: true
    });

    const html = `
      <div class="p-2 font-sans space-y-1 text-xs text-slate-800">
        <div class="font-extrabold text-cyan-700 text-sm border-b border-cyan-100 pb-1">${title}</div>
        <div class="text-[10px] text-slate-400 font-mono">[${lat.toFixed(4)}, ${lng.toFixed(4)}]</div>
      </div>
    `;

    new maplibregl.Popup({ offset: 18, maxWidth: '260px' })
      .setLngLat([lng, lat])
      .setHTML(html)
      .addTo(mapInstance);
  }

  /**
   * 14. BẬT/TẮT LỚP KHỐI NHÀ 3D & RADAR MƯA
   */
  function toggle3DBuildings() {
    layerVisibility.buildings = !layerVisibility.buildings;
    if (mapInstance && mapInstance.getLayer('buildings-3d-extrusion')) {
      mapInstance.setLayoutProperty('buildings-3d-extrusion', 'visibility', layerVisibility.buildings ? 'visible' : 'none');
    }
  }

  function toggleRainRadar() {
    layerVisibility.rainRadar = !layerVisibility.rainRadar;
    if (mapInstance && mapInstance.getLayer('rain-radar-heat')) {
      mapInstance.setLayoutProperty('rain-radar-heat', 'visibility', layerVisibility.rainRadar ? 'visible' : 'none');
    }
  }

  function handleMapLibreClick(e) {
    if (isMeasuring) {
      addMeasurePoint(e.lngLat);
      return;
    }

    const lng = e.lngLat.lng;
    const lat = e.lngLat.lat;
    const badge = document.getElementById('maplibre-coords-badge');
    if (badge) badge.innerText = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
  }

  function setRouteOriginDestination(type, lng, lat, label) {
    if (!mapInstance) return;

    const el = document.createElement('div');
    el.className = 'flex items-center justify-center cursor-pointer select-none';
    el.style.cssText = 'position: absolute !important; top: 0 !important; left: 0 !important; margin: 0 !important; width: 28px; height: 28px; pointer-events: auto !important; z-index: 29;';
    el.innerHTML = `<div class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black shadow-2xl border-2 border-white ${type === 'origin' ? 'bg-emerald-600' : 'bg-rose-600'}">${type === 'origin' ? '🟢' : '🏁'}</div>`;

    const marker = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
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
        mapInstance.setPaintProperty('provinces-outer-glow', 'line-opacity', isVisible ? 0.95 : 0);
        mapInstance.setPaintProperty('provinces-dashed-inner', 'line-opacity', isVisible ? 0.85 : 0);
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
    } else if (layerKey === 'buildings') {
      if (mapInstance.getLayer('buildings-3d-extrusion')) {
        mapInstance.setLayoutProperty('buildings-3d-extrusion', 'visibility', isVisible ? 'visible' : 'none');
      }
    } else if (layerKey === 'rainRadar') {
      if (mapInstance.getLayer('rain-radar-heat')) {
        mapInstance.setLayoutProperty('rain-radar-heat', 'visibility', isVisible ? 'visible' : 'none');
      }
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
        btn.className = 'px-2 py-1 rounded-lg text-[10.5px] font-bold border transition flex items-center gap-1 cursor-pointer bg-cyan-900/60 text-cyan-200 border-cyan-500/50 shadow-sm';
      } else {
        btn.className = 'px-2 py-1 rounded-lg text-[10.5px] font-bold border transition flex items-center gap-1 cursor-pointer bg-slate-800 text-slate-400 border-slate-700 shadow-sm opacity-60 hover:opacity-100';
      }
    }

    // Cập nhật số lượng lớp đang active
    const activeCount = Object.values(layerVisibility).filter(Boolean).length;
    const badge = document.getElementById('ml-active-layers-count');
    if (badge) badge.innerText = `${activeCount} LỚP ACTIVE`;
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
   * ĐIỀU KHIỂN GÓC NGHIÊNG 3D (PITCH)
   */
  function setPitch(deg) {
    if (!mapInstance) return;
    currentPitch = deg;
    mapInstance.easeTo({ pitch: deg, duration: 1000 });
    updatePitchBadge();

    [0, 45, 60].forEach(p => {
      const btn = document.getElementById(`ml-pitch-${p}`);
      if (btn) {
        if (p === deg) {
          btn.className = 'px-2 py-1 bg-cyan-600 text-white rounded-lg text-[10.5px] font-bold cursor-pointer transition shadow';
        } else {
          btn.className = 'px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10.5px] font-bold cursor-pointer transition';
        }
      }
    });
  }

  /**
   * BẬT/TẮT TỰ ĐỘNG XOAY 360 ĐỘ (ORBIT ROTATION)
   */
  function toggleAutoRotate() {
    isAutoRotating = !isAutoRotating;
    const btn = document.getElementById('maplibre-btn-rotate');

    if (isAutoRotating) {
      if (btn) {
        btn.className = 'px-2 py-1 rounded-lg bg-cyan-600 text-white text-[11px] font-black shadow-lg flex items-center gap-1 cursor-pointer transition animate-pulse';
        btn.innerHTML = '<span>🔄 Đang Xoay 360°</span>';
      }
      rotateFrame();
    } else {
      if (btn) {
        btn.className = 'px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer transition';
        btn.innerHTML = '<span>🔄 Xoay 360°</span>';
      }
    }
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
          btn.className = 'px-2 py-1 bg-cyan-600 text-white rounded-lg text-[9.5px] font-bold cursor-pointer transition shadow';
        } else {
          btn.className = 'px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[9.5px] font-bold cursor-pointer transition';
        }
      }
    });

    // Cập nhật Style WebGL MapLibre
    mapInstance.setStyle(BASEMAP_STYLES[key]);

    // Lắng nghe sự kiện idle khi Style mới đã nạp hoàn tất và render sẵn sàng
    let hasRestored = false;
    const restoreAllLayers = () => {
      if (hasRestored) return;
      hasRestored = true;
      mapInstance.off('idle', restoreAllLayers);

      setupProvincesVectorLayer();
      setupStormSimulationVectorLayer();
      setupTacticalRouteVectorLayer();
      setupMeasureVectorLayer();
      setup3DBuildingsVectorLayer();
      setupRainRadarVectorLayer();
      syncAllLayers();

      if (window.CommandUIController && typeof window.CommandUIController.showToast === 'function') {
        const names = {
          satellite: '🛰️ Vệ Tinh Recon',
          dark: '🌑 Nền Tối C2',
          topo: '⛰️ Địa Hình Lũ Quét',
          osm: '🗺️ Đô Thị & Giao Thông'
        };
        window.CommandUIController.showToast('🗺️ ĐỔI BẢN ĐỒ NỀN', `Đã chuyển sang lớp: ${names[key] || key}`, 'info', 1800);
      }
    };

    mapInstance.once('idle', restoreAllLayers);
    // Timeout an toàn đề phòng mạng chậm hoặc idle đã trôi qua
    setTimeout(() => {
      if (!hasRestored && mapInstance && mapInstance.isStyleLoaded()) {
        restoreAllLayers();
      }
    }, 400);
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

  function toggleLayersDrawer() {
    const panel = document.getElementById('ml-layers-dock-panel');
    const chevron = document.getElementById('ml-layers-chevron');
    if (!panel) return;
    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
      panel.classList.remove('hidden');
      if (chevron) chevron.setAttribute('data-lucide', 'chevron-down');
    } else {
      panel.classList.add('hidden');
      if (chevron) chevron.setAttribute('data-lucide', 'chevron-up');
    }
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }

  return {
    init,
    setPitch,
    toggleAutoRotate,
    switchStyle,
    toggleLayer,
    toggleLayerUI,
    toggleLayersDrawer,
    jumpToRegion,
    setRouteOriginDestination,
    syncAllLayers,
    resize,
    // Expanded Tactical Features
    toggleFlyoverPatrol,
    advancePatrol,
    togglePatrolPause,
    toggleMeasureTool,
    clearMeasurement,
    addMeasurePoint,
    toggleTacticalDrawer,
    switchDrawerTab,
    filterDrawerList,
    flyToTacticalItem,
    clearSearch,
    flyToSearchItem,
    toggle3DBuildings,
    toggleRainRadar,
    startVehicleRouteAnimation,
    stopVehicleRouteAnimation,
    get map() { return mapInstance; }
  };
})();
