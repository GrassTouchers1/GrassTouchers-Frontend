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
  let currentPitch = 0; // Mặc định góc nhìn 2D phẳng
  let currentBearing = 0;
  let currentBaseKey = 'dark'; // Nền Tối C2 Dark Canvas sang trọng, sắc nét, không rối địa hình

  // Quản lý các nhóm markers động
  const markersRegistry = {
    sos: [],
    intake: [],
    shelters: [],
    floodPoints: [],
    hazards: [],
    units: [],
    waypoints: [],
    measure: []
  };

  // Tra cứu nhanh marker tiếp nhận theo ID sự cố
  const intakeMarkersMap = new Map();

  // Trạng thái hiển thị các lớp dữ liệu tác chiến
  const layerVisibility = {
    provinces: true,
    floodPoints: true,
    sos: true,
    shelters: true,
    units: true,
    route: true,
    storm: true,
    terrain: true,     // Bật Địa hình 3D thực tế (DEM) nổi khối núi non
    buildings: true,   // Bật Khối nhà đô thị 3D (3D Buildings Extrusion)
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
        { id: 'base-dark-layer', type: 'raster', source: 'esri-dark', minzoom: 0, maxzoom: 20 },
        { id: 'base-dark-ref-layer', type: 'raster', source: 'esri-dark-ref', minzoom: 0, maxzoom: 20 }
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
        { id: 'base-sat-layer', type: 'raster', source: 'esri-satellite', minzoom: 0, maxzoom: 20 },
        { id: 'base-sat-labels-layer', type: 'raster', source: 'esri-sat-labels', minzoom: 0, maxzoom: 20 }
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
        { id: 'base-topo-layer', type: 'raster', source: 'esri-topo', minzoom: 0, maxzoom: 20 }
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
      layers: [{ id: 'base-osm-layer', type: 'raster', source: 'esri-streets', minzoom: 0, maxzoom: 20 }]
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
        maxZoom: 20.0,
        maxBounds: [
          [100.8, 18.8], // Góc Tây Nam: Giới hạn camera không trôi sang Thái Lan / Vientiane
          [109.8, 24.2]  // Góc Đông Bắc: Giới hạn camera không trôi quá xa sang Trung Quốc
        ],
        pitch: currentPitch,
        bearing: currentBearing,
        antialias: true,
        attributionControl: false
      });

      // Gắn toàn cục window.map và các hàm tương thích
      window.map = mapInstance;
      window.jumpToRegion = jumpToRegion;
      window.setAsRouteTarget = setRouteOriginDestination;

      mapInstance.invalidateSize = function() {
        resize();
      };
      mapInstance.closePopup = function() {
        closeCurrentPopup();
      };
      mapInstance.hasLayer = function() {
        return false;
      };

      const nativeFlyTo = mapInstance.flyTo.bind(mapInstance);
      mapInstance.flyTo = function(target, zoom, options) {
        if (Array.isArray(target)) {
          let lng = target[1];
          let lat = target[0];
          if (target[0] > 90 && target[1] < 30) {
            lng = target[0];
            lat = target[1];
          }
          return nativeFlyTo({
            center: [lng, lat],
            zoom: zoom !== undefined ? zoom : mapInstance.getZoom(),
            duration: (options && options.duration) ? options.duration * 1000 : 1200
          });
        } else if (target && typeof target === 'object' && target.lat !== undefined && target.lng !== undefined) {
          return nativeFlyTo({
            center: [target.lng, target.lat],
            zoom: zoom !== undefined ? zoom : mapInstance.getZoom(),
            duration: (options && options.duration) ? options.duration * 1000 : 1200
          });
        } else if (target && typeof target === 'object' && target.center) {
          return nativeFlyTo(target);
        } else {
          return nativeFlyTo.apply(mapInstance, arguments);
        }
      };

      // Điều khiển góc nhìn & La bàn 3D (NavigationControl)
      mapInstance.addControl(
        new maplibregl.NavigationControl({
          visualizePitch: true,
          showZoom: true,
          showCompass: true
        }),
        'top-right'
      );

      // Đảm bảo tuyệt đối NavigationControl nằm an toàn dưới thanh Top HUD (không bao giờ che nút Toàn Màn Hình)
      const enforceNavCtrlPosition = () => {
        try {
          const ctrlTopRight = document.querySelector('.maplibregl-ctrl-top-right');
          if (ctrlTopRight) {
            ctrlTopRight.style.setProperty('top', '72px', 'important');
            ctrlTopRight.style.setProperty('right', '14px', 'important');
            ctrlTopRight.style.setProperty('margin', '0', 'important');
            ctrlTopRight.style.setProperty('z-index', '25', 'important');
          }
        } catch (_) {}
      };
      mapInstance.on('load', enforceNavCtrlPosition);
      mapInstance.on('resize', enforceNavCtrlPosition);
      setTimeout(enforceNavCtrlPosition, 50);
      setTimeout(enforceNavCtrlPosition, 300);
      setTimeout(enforceNavCtrlPosition, 1000);

      // Thước đo tỉ lệ bản đồ (ScaleControl)
      mapInstance.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

      // Triệt tiêu tuyệt đối thanh attribution của MapLibre để bảo toàn không gian hiển thị cho HUD Bar
      function stripMapLibreAttribution() {
        try {
          const els = document.querySelectorAll('.maplibregl-ctrl-attrib, .maplibregl-ctrl-bottom-right, .maplibregl-compact, .maplibregl-ctrl-attrib-button');
          els.forEach(el => el.remove());
        } catch (e) {}
      }
      stripMapLibreAttribution();
      mapInstance.on('load', stripMapLibreAttribution);
      mapInstance.on('idle', stripMapLibreAttribution);
      mapInstance.on('render', stripMapLibreAttribution);
      const stripTimer = setInterval(stripMapLibreAttribution, 300);
      setTimeout(() => clearInterval(stripTimer), 5000);

      mapInstance.on('load', () => {
        isInitialized = true;
        setup3DTerrainDEM();
        setupProvincesVectorLayer();
        setupStormSimulationVectorLayer();
        setupTacticalRouteVectorLayer();
        setupMeasureVectorLayer();
        setup3DBuildingsVectorLayer();
        setupRainRadarVectorLayer();
        setupFloodCirclesVectorLayer();
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
        updateDeepZoomHUD();
      });

      // Lắng nghe sự kiện click trên bản đồ MapLibre
      mapInstance.on('click', (e) => {
        if (e.originalEvent && !e.originalEvent.defaultPrevented) {
          closeCurrentPopup();
        }
        handleMapLibreClick(e);
      });

      // Lắng nghe di chuột để cập nhật telemetry con trỏ
      mapInstance.on('mousemove', (e) => {
        handleMapLibreMouseMove(e);
      });

      // Tự động gom cụm hoặc mở rộng điểm đo ngập khi zoom / di chuyển
      mapInstance.on('zoomend', () => {
        updateDeepZoomHUD();
        if (layerVisibility.floodPoints) {
          if (cachedRawFloodPoints && cachedRawFloodPoints.length > 0) {
            renderClusteredFloodMarkers();
          } else {
            syncFloodPointMarkers();
          }
        }
        syncFloodCirclesData();
        updateMapLibreViewportAlert();
        renderHanoiDistrictMarkers();
      });
      mapInstance.on('moveend', () => {
        if (layerVisibility.floodPoints) {
          if (cachedRawFloodPoints && cachedRawFloodPoints.length > 0) {
            renderClusteredFloodMarkers();
          } else {
            syncFloodPointMarkers();
          }
        }
        syncFloodCirclesData();
        updateMapLibreViewportAlert();
        renderHanoiDistrictMarkers();
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
            ['==', ['get', 'name'], 'Lào Cai'], 'rgba(239, 68, 68, 0.12)',
            ['==', ['get', 'name'], 'Yên Bái'], 'rgba(245, 158, 11, 0.10)',
            ['==', ['get', 'name'], 'Thái Nguyên'], 'rgba(245, 158, 11, 0.09)',
            ['==', ['get', 'name'], 'Hà Nội'], 'rgba(14, 165, 233, 0.05)',
            ['==', ['get', 'name'], 'Quảng Ninh'], 'rgba(14, 165, 233, 0.05)',
            'rgba(2, 132, 199, 0.025)'
          ],
          'fill-opacity': layerVisibility.provinces ? 0.85 : 0
        }
      });

      // Lớp viền ranh giới tỉnh tinh tế, thanh thoát chuẩn C2 Tactical
      mapInstance.addLayer({
        id: 'provinces-outer-glow',
        type: 'line',
        source: 'provinces-source',
        paint: {
          'line-color': '#0ea5e9',
          'line-width': 1.4,
          'line-opacity': layerVisibility.provinces ? 0.65 : 0
        }
      });

      // Lớp đường ranh giới nội tỉnh đứt nét nhẹ nhàng
      mapInstance.addLayer({
        id: 'provinces-dashed-inner',
        type: 'line',
        source: 'provinces-source',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 0.8,
          'line-dasharray': [4, 4],
          'line-opacity': layerVisibility.provinces ? 0.45 : 0
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
    if (window.ProvinceWeatherLayer) {
      if (typeof window.ProvinceWeatherLayer.getCache === 'function') {
        const cache = window.ProvinceWeatherLayer.getCache();
        if (cache && cache[provinceName]) weatherInfo = cache[provinceName];
      }
      if (!weatherInfo && window.ProvinceWeatherLayer.weatherDataCache) {
        weatherInfo = window.ProvinceWeatherLayer.weatherDataCache[provinceName];
      }
    }

    const temp = weatherInfo ? (weatherInfo.temp !== undefined ? `${weatherInfo.temp}°C` : '24.5°C') : '24.5°C';
    const rain = weatherInfo ? (weatherInfo.rain !== undefined ? `${weatherInfo.rain} mm` : (weatherInfo.precipitation || '12.4 mm')) : '12.4 mm';
    const wind = weatherInfo ? (weatherInfo.windSpeed !== undefined ? `${weatherInfo.windSpeed} km/h` : '48 km/h (Cấp 6)') : '48 km/h (Cấp 6)';
    const status = weatherInfo ? (weatherInfo.weatherDesc || weatherInfo.weatherStatus || 'Mưa lớn, nguy cơ sạt lở') : 'Mưa lớn, nguy cơ sạt lở';
    const aqi = weatherInfo ? weatherInfo.aqi : 48;
    const pm25 = weatherInfo ? weatherInfo.pm25 : 18;

    const html = `
      <div style="padding: 14px; font-family: 'Be Vietnam Pro', 'Inter', -apple-system, sans-serif; min-width: 300px; max-width: 330px; background: #0b0f19; color: #f8fafc; border-radius: 14px; box-shadow: 0 20px 45px rgba(0,0,0,0.8), 0 0 20px rgba(14,165,233,0.15); border: 1px solid rgba(56,189,248,0.3); user-select: none;">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(51,65,85,0.7); padding-bottom: 10px; margin-bottom: 12px; padding-right: 24px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">🏛️</span>
            <span style="font-size: 15px; font-weight: 900; color: #38bdf8; letter-spacing: -0.01em;">${provinceName}</span>
          </div>
          <span style="font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 9999px; background: rgba(8,47,73,0.9); color: #38bdf8; border: 1px solid rgba(14,165,233,0.6);">Miền Bắc</span>
        </div>

        <!-- 4 Grid Indicators: C2 Dark Glass with Bulletproof Inline Colors -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 10px;">
          <!-- Nhiệt độ -->
          <div style="background: rgba(2,6,23,0.85); padding: 10px; border-radius: 10px; border: 1px solid rgba(30,41,59,0.9); display: flex; flex-direction: column; justify-content: space-between;">
            <span style="color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Nhiệt độ:</span>
            <span style="color: #fde047; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 18px; font-weight: 900; line-height: 1; display: block;">${temp}</span>
          </div>
          <!-- Lượng mưa 24h -->
          <div style="background: rgba(2,6,23,0.85); padding: 10px; border-radius: 10px; border: 1px solid rgba(30,41,59,0.9); display: flex; flex-direction: column; justify-content: space-between;">
            <span style="color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Lượng mưa 24h:</span>
            <span style="color: #38bdf8; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 18px; font-weight: 900; line-height: 1; display: block;">${rain}</span>
          </div>
          <!-- Gió giật -->
          <div style="background: rgba(2,6,23,0.85); padding: 10px; border-radius: 10px; border: 1px solid rgba(30,41,59,0.9); display: flex; flex-direction: column; justify-content: space-between;">
            <span style="color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Gió giật:</span>
            <span style="color: #34d399; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; font-weight: 800; line-height: 1.2; display: block;">${wind}</span>
          </div>
          <!-- Tình trạng -->
          <div style="background: rgba(2,6,23,0.85); padding: 10px; border-radius: 10px; border: 1px solid rgba(30,41,59,0.9); display: flex; flex-direction: column; justify-content: space-between;">
            <span style="color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Tình trạng:</span>
            <span style="color: #f87171; font-size: 12px; font-weight: 800; line-height: 1.2; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${status}">${status}</span>
          </div>
        </div>

        <!-- Chất lượng không khí OpenAQ -->
        <div style="background: rgba(2,6,23,0.7); padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(30,41,59,0.8); display: flex; align-items: center; justify-content: space-between; font-size: 11px; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 13px;">🍃</span>
            <span style="color: #cbd5e1; font-weight: 600;">Không khí:</span>
            <span style="font-family: monospace; font-weight: 900; color: #34d399;">AQI ${aqi}</span>
          </div>
          <span style="font-size: 10px; font-family: monospace; color: #94a3b8;">PM2.5: ${pm25} µg/m³</span>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 8px; border-top: 1px solid rgba(51,65,85,0.7); padding-top: 10px; margin-bottom: 8px;">
          <button type="button" onclick="window.NorthStarMapLibre && window.NorthStarMapLibre.zoomToProvince('${provinceName}')" style="flex: 1; padding: 7px 10px; border-radius: 8px; background: rgba(2,132,199,0.25); color: #38bdf8; border: 1px solid rgba(14,165,233,0.5); font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.2s;">
            <span>🔍 Phóng to</span>
          </button>
          <button type="button" onclick="window.NorthStarMapLibre && window.NorthStarMapLibre.focusProvinceRegion('${provinceName}')" style="flex: 1; padding: 7px 10px; border-radius: 8px; background: rgba(5,150,105,0.25); color: #34d399; border: 1px solid rgba(16,185,129,0.5); font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.2s;">
            <span>🎯 Trọng tâm</span>
          </button>
        </div>

        <!-- Footer -->
        <div style="font-size: 9.5px; color: #64748b; font-style: italic; border-top: 1px solid rgba(30,41,59,0.7); padding-top: 6px; display: flex; align-items: center; justify-content: space-between;">
          <span>Nguồn: Open-Meteo & OpenAQ</span>
          <span style="color: #38bdf8; font-family: monospace; font-weight: 800;">WebGL 3D GPU</span>
        </div>
      </div>
    `;

    const popup = new maplibregl.Popup({ offset: 12, maxWidth: '340px' })
      .setHTML(html);
    openActivePopup(popup, lngLat);

    // Đồng bộ giá trị Dropdown Chọn Tỉnh Thành Miền Bắc
    try {
      const provSel = document.getElementById('ml-province-selector');
      if (provSel && provinceName && provSel.value !== provinceName) {
        if (Array.from(provSel.options).some(o => o.value === provinceName)) {
          provSel.value = provinceName;
        }
      }
    } catch (e) {}
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
   * 6. LỚP CAO ĐỘ ĐỊA HÌNH 3D NỔI KHỐI (3D TERRAIN DIGITAL ELEVATION MODEL - DEM)
   * Nguồn mở toàn cầu: AWS Open Data Terrarium DEM (Phủ kín toàn bộ 26 tỉnh miền Bắc, Fansipan, Sa Pa, Ba Vì...)
   */
  function setup3DTerrainDEM() {
    if (!mapInstance || !mapInstance.isStyleLoaded()) return;

    if (!mapInstance.getSource('terrain-dem-source')) {
      try {
        mapInstance.addSource('terrain-dem-source', {
          type: 'raster-dem',
          tiles: [
            'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
          ],
          encoding: 'terrarium',
          tileSize: 256,
          maxzoom: 14
        });
      } catch (e) {
        console.warn('[MapLibre 3D Terrain] Lỗi addSource:', e);
      }
    }

    if (layerVisibility.terrain) {
      try {
        mapInstance.setTerrain({ source: 'terrain-dem-source', exaggeration: 1.6 });
      } catch (e) {
        console.warn('[MapLibre 3D Terrain] Lỗi setTerrain:', e);
      }
    } else {
      try {
        mapInstance.setTerrain(null);
      } catch (_) {}
    }
  }

  /**
   * 7. LỚP KHỐI NHÀ & CÔNG TRÌNH ĐÔ THỊ 3D (3D BUILDINGS EXTRUSION)
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
            140, '#f59e0b',
            220, '#f43f5e',
            350, '#ef4444'
          ],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.88
        }
      });
    }
  }

  function generate3DBuildingsGeoJSON() {
    const landmarks = [
      // === HÀ NỘI: Cụm Landmark & Trung tâm Đô thị Cao tầng ===
      { center: [105.7840, 21.0165], w: 0.0028, h: 0.0028, height: 350, name: 'Keangnam Hanoi Landmark 72 (Tòa tháp cao nhất Hà Nội)' },
      { center: [105.7825, 21.0155], w: 0.0020, h: 0.0020, height: 212, name: 'Keangnam Residential Tower A (48 tầng)' },
      { center: [105.7850, 21.0155], w: 0.0020, h: 0.0020, height: 212, name: 'Keangnam Residential Tower B (48 tầng)' },
      { center: [105.8130, 21.0330], w: 0.0030, h: 0.0025, height: 272, name: 'Lotte Center Hà Nội (65 tầng, Liễu Giai)' },
      { center: [105.8150, 21.0320], w: 0.0025, h: 0.0025, height: 160, name: 'Vinhomes Metropolis Liễu Giai (3 tháp 45 tầng)' },
      { center: [105.8030, 21.0080], w: 0.0022, h: 0.0022, height: 177, name: 'Diamond Flower Tower (Lê Văn Lương)' },
      { center: [105.7940, 21.0050], w: 0.0035, h: 0.0030, height: 145, name: 'Tổ hợp D\'.Capitale Trần Duy Hưng (6 tòa 39 tầng)' },
      { center: [105.7900, 21.0260], w: 0.0025, h: 0.0025, height: 135, name: 'Viettel Telecom Headquarters (Cầu Giấy)' },
      { center: [105.7820, 21.0310], w: 0.0022, h: 0.0022, height: 95, name: 'FPT Tower (Khu Công Nghệ Duy Tân)' },
      { center: [105.7805, 21.0325], w: 0.0020, h: 0.0020, height: 85, name: 'CMC Tower Duy Tân' },
      { center: [105.7640, 21.0205], w: 0.0045, h: 0.0045, height: 50, name: 'Sân Vận Động Quốc Gia Mỹ Đình (Điểm Trú Ẩn Khẩn Cấp)' },
      { center: [105.7880, 21.0060], w: 0.0040, h: 0.0035, height: 42, name: 'Trung Tâm Hội Nghị Quốc Gia NCC' },
      { center: [105.8360, 21.0360], w: 0.0030, h: 0.0030, height: 45, name: 'Tòa Nhà Quốc Hội Việt Nam (Ba Đình)' },
      { center: [105.8335, 21.0340], w: 0.0030, h: 0.0030, height: 55, name: 'Sở Chỉ Huy PCTT & TKCN Trung Ương' },
      { center: [105.8420, 21.0430], w: 0.0025, h: 0.0025, height: 147, name: 'EVN Twin Towers Cửa Bắc (Điều Độ Lưới Điện Quốc Gia)' },
      { center: [105.8540, 21.0280], w: 0.0025, h: 0.0025, height: 40, name: 'UBND TP Hà Nội & BCH PCTT Thủ Đô' },
      { center: [105.8470, 21.0240], w: 0.0022, h: 0.0022, height: 85, name: 'Meliá Tower (Lý Thường Kiệt)' },
      { center: [105.8670, 20.9950], w: 0.0045, h: 0.0040, height: 120, name: 'Khu Đô Thị Times City & Park Hill (12 Tòa Tháp)' },
      { center: [105.8150, 21.0020], w: 0.0045, h: 0.0040, height: 130, name: 'Khu Đô Thị Royal City (6 Tòa Tháp 35 Tầng)' },
      { center: [105.8690, 21.0460], w: 0.0030, h: 0.0025, height: 135, name: 'Mipec Riverside Long Biên (Ven Sông Hồng)' },
      { center: [105.8080, 21.0600], w: 0.0040, h: 0.0040, height: 110, name: 'Khu Đô Thị Ciputra Nam Thăng Long' },
      { center: [105.7950, 21.0550], w: 0.0040, h: 0.0035, height: 125, name: 'Khu Ngoại Giao Đoàn & StarLake Tây Hồ Tây' },

      // === HẢI PHÒNG: Cảng biển & Tháp biểu tượng ===
      { center: [106.6620, 20.8650], w: 0.0030, h: 0.0030, height: 148, name: 'Vinpearl Imperia Hải Phòng (45 tầng - Cao nhất Hải Phòng)' },
      { center: [106.6850, 20.8580], w: 0.0030, h: 0.0030, height: 45, name: 'Trung Tâm Hành Chính TP Hải Phòng' },
      { center: [106.7500, 20.8400], w: 0.0050, h: 0.0040, height: 35, name: 'Cụm Cảng Quốc Tế Tân Vũ - Lạch Huyện' },

      // === QUẢNG NINH: Cảng tàu, Tháp khách sạn, Vịnh Hạ Long ===
      { center: [107.0850, 20.9480], w: 0.0035, h: 0.0030, height: 110, name: 'FLC Grand Hotel Hạ Long' },
      { center: [107.0750, 20.9520], w: 0.0030, h: 0.0030, height: 55, name: 'Trụ Sở Tỉnh Ủy & UBND Tỉnh Quảng Ninh' },
      { center: [107.0100, 20.9350], w: 0.0040, h: 0.0040, height: 50, name: 'Cảng Tàu Khách Quốc Tế Tuần Châu - Điều Hành Cứu Nạn' },
      { center: [107.0600, 20.9550], w: 0.0030, h: 0.0025, height: 45, name: 'Vincom Plaza Hạ Long' },

      // === THÁI NGUYÊN: Khu công nghiệp & Trung tâm tỉnh ===
      { center: [105.8420, 21.5940], w: 0.0028, h: 0.0028, height: 48, name: 'BCH PCTT & TKCN Tỉnh Thái Nguyên' },
      { center: [105.8350, 21.5880], w: 0.0035, h: 0.0035, height: 38, name: 'Tổ Hợp Công Nghiệp Gang Thép Thái Nguyên' },
      { center: [105.8900, 21.4350], w: 0.0060, h: 0.0050, height: 45, name: 'Tổ Hợp Samsung Electronics Thái Nguyên (SEVT Phổ Yên)' },

      // === LÀO CAI & YÊN BÁI: Trạm cứu nạn & Cáp treo Fansipan ===
      { center: [103.7760, 22.3030], w: 0.0030, h: 0.0030, height: 65, name: 'Ga Cáp Treo Fansipan Legend & Quần Thể Tâm Linh Fansipan' },
      { center: [104.3850, 22.2530], w: 0.0025, h: 0.0025, height: 30, name: 'Ban Chỉ Huy Tiền Phương Cứu Hộ Làng Nủ (Bảo Yên)' },
      { center: [103.9650, 22.4900], w: 0.0025, h: 0.0025, height: 55, name: 'Tổ Hợp Aristo & Trung Tâm Hành Chính Lào Cai' },
      { center: [104.9080, 21.7250], w: 0.0028, h: 0.0028, height: 45, name: 'Trụ Sở BCH PCTT Tỉnh Yên Bái' },
      { center: [104.8950, 21.7180], w: 0.0025, h: 0.0025, height: 32, name: 'Nhà Thi Đấu Yên Bái (Điểm Sơ Tán Lũ Sông Thao)' },

      // === PHÚ THỌ & HÒA BÌNH ===
      { center: [105.2890, 21.3020], w: 0.0025, h: 0.0025, height: 35, name: 'Trạm Điều Phối Cầu Phong Châu & Cứu Hộ Sông Hồng' },
      { center: [105.3300, 20.8150], w: 0.0035, h: 0.0035, height: 55, name: 'Ban Quản Lý & Đập Thủy Điện Hòa Bình (Sông Đà)' }
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
   * 7B. VÒNG SÓNG NGẬP VECTOR (GeoJSON ĐỒNG TÂM - TƯƠNG ĐỒNG LEAFLET)
   * QUY TẮC HIỂN THỊ CHỐNG RỐI MẮT: Chỉ hiển thị khi zoom >= 13.0 để bản đồ thoáng đãng
   */
  function createGeoJsonCircle(centerLng, centerLat, radiusInMeters, points = 32) {
    const km = radiusInMeters / 1000;
    const coords = [];
    const distanceX = km / (111.320 * Math.cos((centerLat * Math.PI) / 180));
    const distanceY = km / 110.574;

    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = distanceX * Math.cos(theta);
      const y = distanceY * Math.sin(theta);
      coords.push([centerLng + x, centerLat + y]);
    }
    coords.push(coords[0]);
    return coords;
  }

  function setupFloodCirclesVectorLayer() {
    if (!mapInstance || !mapInstance.isStyleLoaded()) return;

    if (!mapInstance.getSource('flood-circles-source')) {
      mapInstance.addSource('flood-circles-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      mapInstance.addLayer({
        id: 'flood-circles-fill',
        type: 'fill',
        source: 'flood-circles-source',
        layout: {
          'visibility': layerVisibility.floodPoints ? 'visible' : 'none'
        },
        paint: {
          'fill-color': ['get', 'fillColor'],
          'fill-opacity': ['get', 'fillOpacity']
        }
      });

      mapInstance.addLayer({
        id: 'flood-circles-line',
        type: 'line',
        source: 'flood-circles-source',
        layout: {
          'visibility': layerVisibility.floodPoints ? 'visible' : 'none'
        },
        paint: {
          'line-color': ['get', 'lineColor'],
          'line-width': ['get', 'lineWidth'],
          'line-dasharray': [3, 2],
          'line-opacity': 0.85
        }
      });
    }
  }

  function syncFloodCirclesData() {
    if (!mapInstance || !mapInstance.getSource('flood-circles-source')) return;

    // Chỉ vẽ vòng sóng khi zoom >= 13.0 để chống rối mắt
    const currentZ = mapInstance.getZoom();
    if (!layerVisibility.floodPoints || currentZ < 13.0) {
      mapInstance.getSource('flood-circles-source').setData({
        type: 'FeatureCollection',
        features: []
      });
      return;
    }

    const features = [];
    cachedRawFloodPoints.forEach(pt => {
      if (pt.depth >= 5 && pt.status !== 'no_data' && pt.status !== 'offline' && pt.status !== 'invalid') {
        const radiusMeters = Math.min(100 + pt.depth * 2.5, 300);
        const isDanger = (pt.depth >= 20 || pt.status === 'danger');
        const color = isDanger ? '#ef4444' : (pt.status === 'stale' ? '#d97706' : '#f59e0b');
        const fillOpacity = isDanger ? 0.22 : 0.14;

        // Vòng ngoài nét đứt
        features.push({
          type: 'Feature',
          properties: {
            fillColor: color,
            fillOpacity: fillOpacity,
            lineColor: color,
            lineWidth: isDanger ? 2.0 : 1.2
          },
          geometry: {
            type: 'Polygon',
            coordinates: [createGeoJsonCircle(pt.lng, pt.lat, radiusMeters, 32)]
          }
        });

        // Vòng tâm trong
        features.push({
          type: 'Feature',
          properties: {
            fillColor: color,
            fillOpacity: 0.32,
            lineColor: color,
            lineWidth: 1.0
          },
          geometry: {
            type: 'Polygon',
            coordinates: [createGeoJsonCircle(pt.lng, pt.lat, Math.max(30, radiusMeters * 0.38), 24)]
          }
        });
      }
    });

    mapInstance.getSource('flood-circles-source').setData({
      type: 'FeatureCollection',
      features
    });
  }

  /**
   * 7C. NHÃN ĐỊA DANH QUẬN/HUYỆN THỦ ĐÔ HÀ NỘI (ĐỒNG BỘ LEAFLET)
   */
  const HANOI_DISTRICTS_DATA = [
    { name: 'Quận Cầu Giấy', coords: [105.794, 21.031] },
    { name: 'Quận Đống Đa', coords: [105.824, 21.014] },
    { name: 'Quận Ba Đình', coords: [105.823, 21.034] },
    { name: 'Quận Hoàn Kiếm', coords: [105.854, 21.028] },
    { name: 'Quận Tây Hồ', coords: [105.819, 21.069] },
    { name: 'Quận Long Biên', coords: [105.895, 21.036] },
    { name: 'Quận Hai Bà Trưng', coords: [105.855, 21.007] },
    { name: 'Quận Hoàng Mai', coords: [105.845, 20.975] },
    { name: 'Quận Thanh Xuân', coords: [105.814, 20.993] },
    { name: 'Quận Nam Từ Liêm', coords: [105.765, 21.015] },
    { name: 'Quận Bắc Từ Liêm', coords: [105.758, 21.059] },
    { name: 'Quận Hà Đông', coords: [105.774, 20.972] },
    { name: 'Huyện Gia Lâm', coords: [105.932, 21.018] },
    { name: 'Huyện Đông Anh', coords: [105.847, 21.137] },
    { name: 'Huyện Thanh Trì', coords: [105.848, 20.938] },
    { name: 'Huyện Hoài Đức', coords: [105.706, 21.025] },
    { name: 'Huyện Đan Phượng', coords: [105.672, 21.098] },
    { name: 'Huyện Thường Tín', coords: [105.867, 20.871] },
    { name: 'Huyện Chương Mỹ', coords: [105.656, 20.916] }
  ];

  let hanoiDistrictMarkers = [];

  function renderHanoiDistrictMarkers() {
    hanoiDistrictMarkers.forEach(m => m.remove());
    hanoiDistrictMarkers = [];

    if (!mapInstance) return;
    const zoom = mapInstance.getZoom();
    if (zoom < 10.2 || zoom > 16.0) return;

    HANOI_DISTRICTS_DATA.forEach(d => {
      const el = document.createElement('div');
      el.className = 'text-[11px] font-bold text-slate-300 pointer-events-none select-none whitespace-nowrap px-1.5 py-0.5 rounded';
      el.style.cssText = 'text-shadow: 0 0 5px #020617, 0 0 8px #020617; letter-spacing: 0.3px; color: rgba(226, 232, 240, 0.85);';
      el.textContent = d.name;

      const marker = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
        .setLngLat(d.coords)
        .addTo(mapInstance);

      hanoiDistrictMarkers.push(marker);
    });
  }

  let currentActivePopup = null;

  function closeCurrentPopup() {
    if (currentActivePopup) {
      try { currentActivePopup.remove(); } catch (e) {}
      currentActivePopup = null;
    }
    document.querySelectorAll('.maplibregl-popup, .leaflet-popup, .flood-custom-popup, .province-weather-leaflet-popup').forEach(p => {
      try { p.remove(); } catch (e) {}
    });
  }

  function openActivePopup(popup, lngLat) {
    closeCurrentPopup();
    currentActivePopup = popup;
    popup.on('close', () => {
      if (currentActivePopup === popup) currentActivePopup = null;
    });
    if (lngLat) popup.setLngLat(lngLat);
    popup.addTo(mapInstance);
    return popup;
  }

  function getStationDistrictHelper(name, lat, lng) {
    if (typeof window.getStationLocationDisplay === 'function') {
      try {
        const d = window.getStationLocationDisplay(name, lat, lng);
        if (d) return d;
      } catch (err) {}
    }
    if (!name) return 'Hà Nội';
    const match = name.match(/\((.*?)\)/);
    if (match && match[1]) {
      const inner = match[1].trim();
      if (!inner.toLowerCase().startsWith('quận') && !inner.toLowerCase().startsWith('huyện')) {
        return `Quận ${inner}`;
      }
      return inner;
    }
    return 'Hà Nội';
  }

  let aiPredictionsData = {};
  let aiPredictionsLoaded = false;

  async function ensureAiPredictionsLoaded() {
    if (aiPredictionsLoaded && Object.keys(aiPredictionsData).length > 0) return aiPredictionsData;
    if (window.aiPredictionsCache && Object.keys(window.aiPredictionsCache).length > 0) {
      aiPredictionsData = window.aiPredictionsCache;
      aiPredictionsLoaded = true;
      return aiPredictionsData;
    }
    try {
      const res = await fetch(resolveApi('/api/predictions')).catch(() => null);
      if (res && res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          list.forEach(item => {
            if (item && item.point_id !== undefined) {
              aiPredictionsData[item.point_id] = item;
            }
          });
          window.aiPredictionsCache = aiPredictionsData;
          aiPredictionsLoaded = true;
        }
      }
    } catch (e) {
      console.warn('[MapLibre] Lỗi nạp AI Predictions:', e);
    }
    return aiPredictionsData;
  }

  let isViewportAlertDismissed = false;

  function dismissViewportAlert() {
    isViewportAlertDismissed = true;
    const alertEl = document.getElementById('maplibre-viewport-alert');
    if (alertEl) alertEl.classList.add('hidden');
  }

  function updateMapLibreViewportAlert() {
    if (isViewportAlertDismissed) return;
    if (!mapInstance || !cachedRawFloodPoints.length) return;
    const alertEl = document.getElementById('maplibre-viewport-alert');
    const alertText = document.getElementById('maplibre-viewport-alert-text');
    const alertDot = document.getElementById('maplibre-alert-dot');
    if (!alertEl || !alertText) return;

    if (!layerVisibility.floodPoints) {
      alertEl.classList.add('hidden');
      return;
    }

    const bounds = mapInstance.getBounds();
    const inView = cachedRawFloodPoints.filter(p => bounds.contains([p.lng, p.lat]));
    if (!inView.length) {
      alertEl.classList.add('hidden');
      return;
    }

    const dangerCount = inView.filter(p => p.depth >= 20 || p.status === 'danger').length;
    const warningCount = inView.filter(p => (p.depth >= 5 && p.depth < 20) || p.status === 'warning').length;
    const safeCount = inView.filter(p => p.depth < 5 && p.status !== 'offline' && p.status !== 'no_data').length;

    if (dangerCount === 0 && warningCount === 0) {
      alertEl.classList.add('hidden');
      return;
    }

    alertEl.classList.remove('hidden');

    if (dangerCount > 0) {
      if (alertDot) alertDot.className = 'w-2 h-2 rounded-full bg-rose-500 flex-shrink-0 animate-ping';
      alertText.innerHTML = `⚠️ <b>${inView.length} trạm trong vùng</b>: <span class="text-rose-400 font-bold">${dangerCount} điểm ngập sâu</span>, <span class="text-amber-400 font-semibold">${warningCount} cảnh báo</span>`;
    } else {
      if (alertDot) alertDot.className = 'w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 animate-pulse';
      alertText.innerHTML = `<b>${inView.length} trạm trong vùng</b>: <span class="text-amber-400 font-semibold">${warningCount} điểm cảnh báo ngập nhẹ</span>`;
    }
  }

  function buildStationPopupHtml(pt) {
    const depthVal = Math.round(pt.depth);
    const status = pt.status;
    const threshold_cm = pt.threshold_cm || 20;
    const location = pt.location || 'Điểm quan trắc';
    const districtName = pt.district || getStationDistrictHelper(location, pt.lat, pt.lng);
    const sensor_id = pt.sensor_id || 'SENSOR-001';
    const sourceDisplay = pt.source === 'sensor' || sensor_id ? `Cảm biến IoT (${sensor_id})` : 'Cảm biến quan trắc';

    let statusLabel = 'An toàn';
    let centerBoxHtml = '';

    if (status === 'danger' || depthVal >= 20) {
      statusLabel = 'Nguy hiểm';
      centerBoxHtml = `
        <div style="background: #1a080d; border: 1px solid #991b1b; border-radius: 10px; padding: 10px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #fca5a5; font-size: 10px; font-weight: 800; text-transform: uppercase;">🚨 Mực Nước Báo Động</span>
            <span style="color: #f87171; background: #450a0a; border: 1px solid #7f1d1d; border-radius: 4px; padding: 1px 6px; font-size: 10px; font-family: monospace; font-weight: 800;">Vượt ngưỡng</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px;">
            <div style="display: flex; align-items: baseline; gap: 4px;">
              <span style="color: #f87171; font-size: 26px; font-weight: 900; font-family: monospace; line-height: 1;">${depthVal}</span>
              <span style="color: #94a3b8; font-size: 12px; font-weight: 700;">cm</span>
            </div>
            <span style="color: #cbd5e1; font-size: 11px;">Ngưỡng: <b style="color: #ffffff;">${threshold_cm} cm</b></span>
          </div>
          <p style="color: #fca5a5; font-size: 10px; font-style: italic; margin-top: 4px;">Mực nước ngập sâu, phương tiện gầm thấp không thể qua lại.</p>
        </div>
      `;
    } else if (status === 'warning' || depthVal >= 5) {
      statusLabel = 'Chú ý';
      centerBoxHtml = `
        <div style="background: #1a1204; border: 1px solid #92400e; border-radius: 10px; padding: 10px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #fde68a; font-size: 10px; font-weight: 800; text-transform: uppercase;">⚠️ Mực Nước Cảnh Báo</span>
            <span style="color: #fbbf24; background: #451a03; border: 1px solid #78350f; border-radius: 4px; padding: 1px 6px; font-size: 10px; font-family: monospace; font-weight: 800;">Cần theo dõi</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px;">
            <div style="display: flex; align-items: baseline; gap: 4px;">
              <span style="color: #fbbf24; font-size: 26px; font-weight: 900; font-family: monospace; line-height: 1;">${depthVal}</span>
              <span style="color: #94a3b8; font-size: 12px; font-weight: 700;">cm</span>
            </div>
            <span style="color: #cbd5e1; font-size: 11px;">Ngưỡng: <b style="color: #ffffff;">${threshold_cm} cm</b></span>
          </div>
          <p style="color: #fde68a; font-size: 10px; font-style: italic; margin-top: 4px;">Mực nước xấp xỉ ngưỡng, di chuyển cẩn thận.</p>
        </div>
      `;
    } else if (status === 'offline') {
      statusLabel = 'Mất kết nối';
      centerBoxHtml = `
        <div style="background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 10px; margin-bottom: 8px;">
          <span style="color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase;">Trạng thái trạm</span>
          <div style="color: #cbd5e1; font-weight: 700; font-size: 12px; margin-top: 4px;">📡 Cảm biến mất kết nối</div>
          <p style="color: #94a3b8; font-size: 10.5px; margin-top: 4px;">Số đo gần nhất: <b style="color: #fbbf24;">${depthVal} cm</b></p>
        </div>
      `;
    } else if (status === 'stale') {
      statusLabel = 'Dữ liệu cũ';
      centerBoxHtml = `
        <div style="background: #1a1204; border: 1px solid #78350f; border-radius: 10px; padding: 10px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #fde68a; font-size: 10px; font-weight: 800;">🕒 Dữ liệu quá 24h</span>
            <span style="color: #fbbf24; font-size: 18px; font-weight: 900; font-family: monospace;">${depthVal} cm</span>
          </div>
          <p style="color: #94a3b8; font-size: 10px; margin-top: 4px;">Chưa nhận bản ghi đo mới nhất trong ngày.</p>
        </div>
      `;
    } else {
      statusLabel = 'An toàn';
      centerBoxHtml = `
        <div style="background: #04190e; border: 1px solid #065f46; border-radius: 10px; padding: 10px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #6ee7b7; font-size: 10px; font-weight: 800; text-transform: uppercase;">✓ Tuyến Đường An Toàn</span>
            <div style="display: flex; align-items: baseline; gap: 4px;">
              <span style="color: #34d399; font-size: 26px; font-weight: 900; font-family: monospace; line-height: 1;">${depthVal}</span>
              <span style="color: #94a3b8; font-size: 12px; font-weight: 700;">cm</span>
            </div>
          </div>
          <p style="color: #a7f3d0; font-size: 10.5px; margin-top: 4px;">Phương tiện lưu thông hoàn toàn bình thường.</p>
        </div>
      `;
    }

    const aiPred = (aiPredictionsData && aiPredictionsData[pt.id]) ? aiPredictionsData[pt.id] : null;
    let aiHtml = '';
    if (aiPred && aiPred.forecast_30m && aiPred.forecast_60m) {
      const f30 = aiPred.forecast_30m;
      const f60 = aiPred.forecast_60m;
      const d30 = Math.round(f30.predicted_depth_cm);
      const d60 = Math.round(f60.predicted_depth_cm);
      const r30Color = d30 >= 20 ? '#f87171' : (d30 >= 5 ? '#fbbf24' : '#34d399');
      const r60Color = d60 >= 20 ? '#f87171' : (d60 >= 5 ? '#fbbf24' : '#34d399');

      aiHtml = `
        <div style="background: #0b0f2a; border: 1px solid rgba(99,102,241,0.4); border-radius: 10px; padding: 8px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(99,102,241,0.3); padding-bottom: 4px; margin-bottom: 6px;">
            <span style="color: #a5b4fc; font-size: 10px; font-weight: 800; text-transform: uppercase;">🤖 DỰ BÁO NGẬP BẰNG AI</span>
            <span style="color: #c7d2fe; font-size: 9px; font-family: monospace; background: rgba(67,56,202,0.6); padding: 1px 6px; border-radius: 4px;">Tự động</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; text-align: center;">
            <div style="background: rgba(15,23,42,0.8); border: 1px solid rgba(51,65,85,0.7); border-radius: 8px; padding: 6px;">
              <span style="color: #94a3b8; font-size: 9.5px; display: block;">Sau 30 phút</span>
              <span style="color: ${r30Color}; font-size: 16px; font-weight: 900; font-family: monospace; display: block; margin: 2px 0;">${d30} cm</span>
              <span style="color: #94a3b8; font-size: 9px; display: block;">${d30 >= 20 ? 'Nguy hiểm' : d30 >= 5 ? 'Chú ý' : 'An toàn'}</span>
            </div>
            <div style="background: rgba(15,23,42,0.8); border: 1px solid rgba(51,65,85,0.7); border-radius: 8px; padding: 6px;">
              <span style="color: #94a3b8; font-size: 9.5px; display: block;">Sau 60 phút</span>
              <span style="color: ${r60Color}; font-size: 16px; font-weight: 900; font-family: monospace; display: block; margin: 2px 0;">${d60} cm</span>
              <span style="color: #94a3b8; font-size: 9px; display: block;">${d60 >= 20 ? 'Nguy hiểm' : d60 >= 5 ? 'Chú ý' : 'An toàn'}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      const est30 = Math.max(0, Math.round(depthVal + (pt.water_trend === 'rising' ? 3 : -2)));
      const est60 = Math.max(0, Math.round(depthVal + (pt.water_trend === 'rising' ? 5 : -4)));
      const r30Color = est30 >= 20 ? '#f87171' : (est30 >= 5 ? '#fbbf24' : '#34d399');
      const r60Color = est60 >= 20 ? '#f87171' : (est60 >= 5 ? '#fbbf24' : '#34d399');

      aiHtml = `
        <div style="background: #0b0f2a; border: 1px solid rgba(99,102,241,0.4); border-radius: 10px; padding: 8px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(99,102,241,0.3); padding-bottom: 4px; margin-bottom: 6px;">
            <span style="color: #a5b4fc; font-size: 10px; font-weight: 800; text-transform: uppercase;">🤖 DỰ BÁO NGẬP BẰNG AI</span>
            <span style="color: #c7d2fe; font-size: 9px; font-family: monospace; background: rgba(67,56,202,0.6); padding: 1px 6px; border-radius: 4px;">Hồi quy</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; text-align: center;">
            <div style="background: rgba(15,23,42,0.8); border: 1px solid rgba(51,65,85,0.7); border-radius: 8px; padding: 6px;">
              <span style="color: #94a3b8; font-size: 9.5px; display: block;">Sau 30 phút</span>
              <span style="color: ${r30Color}; font-size: 16px; font-weight: 900; font-family: monospace; display: block; margin: 2px 0;">~${est30} cm</span>
              <span style="color: #94a3b8; font-size: 9px; display: block;">${est30 >= 20 ? 'Nguy hiểm' : est30 >= 5 ? 'Chú ý' : 'An toàn'}</span>
            </div>
            <div style="background: rgba(15,23,42,0.8); border: 1px solid rgba(51,65,85,0.7); border-radius: 8px; padding: 6px;">
              <span style="color: #94a3b8; font-size: 9.5px; display: block;">Sau 60 phút</span>
              <span style="color: ${r60Color}; font-size: 16px; font-weight: 900; font-family: monospace; display: block; margin: 2px 0;">~${est60} cm</span>
              <span style="color: #94a3b8; font-size: 9px; display: block;">${est60 >= 20 ? 'Nguy hiểm' : est60 >= 5 ? 'Chú ý' : 'An toàn'}</span>
            </div>
          </div>
        </div>
      `;
    }

    const trendText = pt.water_trend === 'rising' ? 'Nước đang dâng 📈' : (pt.water_trend === 'falling' ? 'Nước đang rút 📉' : 'Mực nước ổn định ➡️');
    const drainEst = pt.estimated_drainage_time || (depthVal >= 20 ? '~ 2 - 3 giờ' : (depthVal >= 5 ? '~ 1 - 1.5 giờ' : 'Đã cạn / Bình thường'));
    const safeLocationName = location.replace(/'/g, "\\'");

    return `
      <div style="padding: 12px; background: #0b0f19; color: #f8fafc; border-radius: 14px; border: 1px solid rgba(56,189,248,0.3); box-shadow: 0 16px 36px rgba(0,0,0,0.8); min-width: 295px; max-width: 340px; font-family: 'Be Vietnam Pro', 'Inter', sans-serif; user-select: none;">
        <!-- Header -->
        <div style="border-bottom: 1px solid rgba(51,65,85,0.7); padding-bottom: 8px; margin-bottom: 8px; padding-right: 20px;">
          <div style="display: flex; align-items: start; justify-content: space-between; gap: 6px;">
            <h4 style="font-weight: 800; color: #ffffff; font-size: 13px; line-height: 1.3; margin: 0; flex: 1;">🌊 ${location}</h4>
            <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 800; border: 1px solid ${status === 'danger' || depthVal >= 20 ? 'rgba(239,68,68,0.6)' : (status === 'warning' || depthVal >= 5 ? 'rgba(245,158,11,0.6)' : 'rgba(16,185,129,0.6)')}; background: ${status === 'danger' || depthVal >= 20 ? 'rgba(69,10,10,0.8)' : (status === 'warning' || depthVal >= 5 ? 'rgba(69,26,3,0.8)' : 'rgba(4,25,14,0.8)')}; color: ${status === 'danger' || depthVal >= 20 ? '#fca5a5' : (status === 'warning' || depthVal >= 5 ? '#fde68a' : '#6ee7b7')}; flex-shrink: 0;">
              ${statusLabel}
            </span>
          </div>
          <div style="font-size: 11px; color: #94a3b8; display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-top: 4px;">
            <span style="color: #38bdf8; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📍 ${districtName}</span>
            <span style="font-family: monospace; color: #64748b; font-size: 10px; flex-shrink: 0;">${pt.lat.toFixed(4)}°B, ${pt.lng.toFixed(4)}°Đ</span>
          </div>
        </div>

        <!-- Khối hiển thị trung tâm -->
        ${centerBoxHtml}

        <!-- Thông tin cập nhật & nguồn -->
        <div style="font-size: 10.5px; color: #cbd5e1; border-bottom: 1px solid rgba(51,65,85,0.7); padding-bottom: 6px; margin-bottom: 6px; line-height: 1.6;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #94a3b8;">Nguồn trạm:</span>
            <span style="font-family: monospace; color: #38bdf8; font-weight: 700;">${sourceDisplay}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #94a3b8;">Xu hướng:</span>
            <span style="font-weight: 700; color: #ffffff;">${trendText}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #94a3b8;">Dự kiến cạn:</span>
            <span style="font-weight: 600; color: #fde047; font-family: monospace;">${drainEst}</span>
          </div>
        </div>

        <!-- Dự báo AI -->
        ${aiHtml}

        <!-- 2 Nút thao tác lộ trình cứu hộ -->
        <div style="padding-top: 8px; display: flex; gap: 8px; border-top: 1px solid rgba(51,65,85,0.7);">
          <button onclick="NorthStarMapLibre.setRouteOriginDestination('origin', ${pt.lng}, ${pt.lat}, '${safeLocationName}')" style="flex: 1; padding: 7px 10px; background: linear-gradient(135deg, #059669, #0d9488); color: #ffffff; border: 1px solid rgba(16,185,129,0.5); border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; box-shadow: 0 4px 12px rgba(5,150,105,0.3);">
            <span>🟢</span> Điểm Đi
          </button>
          <button onclick="NorthStarMapLibre.setRouteOriginDestination('dest', ${pt.lng}, ${pt.lat}, '${safeLocationName}')" style="flex: 1; padding: 7px 10px; background: linear-gradient(135deg, #2563eb, #4f46e5); color: #ffffff; border: 1px solid rgba(59,130,246,0.5); border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
            <span>🏁</span> Điểm Đến
          </button>
        </div>

        <!-- Nút Trinh Sát Hình Ảnh Thực Địa & 3D Cận Cảnh -->
        <button onclick="NorthStarMapLibre.openGroundReconViewer(${pt.lng}, ${pt.lat}, '${safeLocationName}')" style="width: 100%; margin-top: 6px; padding: 7px 10px; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #ffffff; border: 1px solid rgba(167,139,250,0.5); border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 12px rgba(124,58,237,0.35);">
          <span>📸</span> Xem Ảnh Hiện Trường & 3D Thực Địa
        </button>
      </div>
    `;
  }

  /**
   * 8. ĐỒNG BỘ TOÀN BỘ CÁC LỚP MARKERS TÁC CHIẾN
   */
  async function syncAllLayers() {
    if (!mapInstance) return;
    clearAllMarkers();

    if (layerVisibility.sos) await syncIntakeMarkers();
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
    if (intakeMarkersMap) intakeMarkersMap.clear();
  }

  /**
   * ĐỒNG BỘ 1:1 TOÀN BỘ DÒNG TIN TIẾP NHẬN ĐA NGUỒN (INTAKE FEED) LÊN BẢN ĐỒ MAPLIBRE
   * Hợp nhất tuyệt đối giữa Bảng Tiếp Nhận (#pane-cmd_intake) và Bản Đồ COP:
   * 1. 🆘 SOS Cứu nạn khẩn cấp (Radar animate-ping đỏ)
   * 2. 📢 Báo cáo thực địa người dân (REP-* Animate-ping vàng cam)
   * 3. ☎️ Điều phối Hotline 114 (Animate-ping xanh dương tác chiến)
   * 4. 🌊 Cảm biến thủy văn IoT viễn trắc (Cyan Telemetry)
   * 5. 🛰️ Viễn thám vệ tinh Radar SAR Sentinel-1 (Tím vũ trụ)
   */
  async function syncIntakeMarkers() {
    if (!mapInstance) return;

    // Dọn sạch markers cũ
    markersRegistry.sos.forEach(m => m.remove());
    markersRegistry.sos = [];
    if (markersRegistry.intake) {
      markersRegistry.intake.forEach(m => m.remove());
      markersRegistry.intake = [];
    }
    intakeMarkersMap.clear();

    // 1. Lấy dữ liệu trực tiếp từ CommandUIController để đồng bộ 100% với Bảng Tiếp Nhận
    let intakeItems = [];
    if (window.CommandUIController && typeof window.CommandUIController.getIntakeData === 'function') {
      intakeItems = window.CommandUIController.getIntakeData();
    }

    // 2. Dự phòng nạp qua API nếu Controller chưa sẵn sàng
    if (!intakeItems || intakeItems.length === 0) {
      try {
        const [sosRes, repRes] = await Promise.all([
          fetch(resolveApi('/api/sos')).catch(() => null),
          fetch(resolveApi('/api/reports')).catch(() => null)
        ]);

        if (sosRes && sosRes.ok) {
          const sosGeo = await sosRes.json();
          (sosGeo.features || []).forEach(feat => {
            const p = feat.properties;
            const c = feat.geometry.coordinates;
            intakeItems.push({
              id: `SOS-${p.id}`,
              raw_id: p.id,
              source: 'sos_beacon',
              source_label: '🆘 Tín Hiệu SOS',
              source_badge_color: 'bg-rose-600 text-white',
              contact_name: p.contact_name || 'Người dân kêu cứu',
              phone: p.phone || '098xxxxxxx',
              people_count: Number(p.people_count || 1),
              has_vulnerable: !!p.has_elderly_or_children,
              water_level_cm: Number(p.water_level_cm || 0),
              priority: p.priority || 'critical',
              status: p.status || 'pending',
              lat: Number(c[1]),
              lng: Number(c[0]),
              description: p.notes || 'Cần cứu trợ khẩn cấp, đang bị cô lập.',
              created_at: p.created_at || new Date().toISOString(),
              is_verified: p.priority === 'critical' || p.status !== 'pending'
            });
          });
        }

        let repFeatures = [];
        if (repRes && repRes.ok) {
          try {
            const repGeo = await repRes.json();
            repFeatures = repGeo.features || [];
          } catch (_) {}
        }

        if (repFeatures.length > 0) {
          repFeatures.forEach(feat => {
            const p = feat.properties || {};
            const c = (feat.geometry && feat.geometry.coordinates) || [105.85, 21.02];
            intakeItems.push({
              id: `REP-${p.id}`,
              raw_id: p.id,
              source: 'citizen_report',
              source_label: '📢 Dân Báo Ngập',
              source_badge_color: 'bg-amber-600 text-white',
              contact_name: `Báo cáo thực địa #${p.id}`,
              phone: 'GPS Đối soát tự động',
              people_count: 0,
              has_vulnerable: false,
              water_level_cm: Number(p.estimated_depth_cm || 25),
              priority: p.level === 'heavy' ? 'high' : 'medium',
              status: p.confirmed ? 'verified' : 'pending',
              lat: Number(c[1]),
              lng: Number(c[0]),
              description: p.description || 'Báo cáo sự cố ngập úng hoặc sạt lở.',
              created_at: p.created_at || new Date().toISOString(),
              is_verified: !!p.confirmed
            });
          });
        } else {
          // Hạt giống 8 điểm báo cáo thực địa miền Bắc đồng bộ 100% với CommandUIController
          const seedReps = [
            { id: 'REP-HN-101', raw_id: 101, lat: 20.9850, lng: 105.8180, contact_name: 'Báo cáo: Ngõ 207 Bùi Xương Trạch, Thanh Xuân, Hà Nội', depth: 35, confirmed: true, desc: 'Nước ngập tràn vào nhà dân ~35cm, xe máy không thể di chuyển, rác tràn nghẽn cống tiêu thoát nước.' },
            { id: 'REP-LC-102', raw_id: 102, lat: 22.3150, lng: 104.3820, contact_name: 'Báo cáo: Km 78 Quốc lộ 4D, Đèo Ô Quy Hồ, Sa Pa, Lào Cai', depth: 90, confirmed: false, desc: 'Sạt lở vách núi đất đá dài 40m chia cắt hoàn toàn tuyến Sa Pa - Lai Châu. 2 xe tải kẹt giữa đoạn sạt lở nguy hiểm.' },
            { id: 'REP-YB-103', raw_id: 103, lat: 21.7230, lng: 104.8980, contact_name: 'Báo cáo: Phường Hồng Hà, TP. Yên Bái (Ven sông Thao)', depth: 80, confirmed: true, desc: 'Nước sông Thao dâng vượt báo động 3, tràn qua mặt đê tràn vào tầng 1 các hộ dân khu phố Thanh Niên.' },
            { id: 'REP-TN-104', raw_id: 104, lat: 21.5930, lng: 105.8450, contact_name: 'Báo cáo: Đường Hoàng Văn Thụ, TP. Thái Nguyên', depth: 65, confirmed: false, desc: 'Mưa to xối xả ngập sâu 65cm, 1 cây phượng vĩ bật gốc đè vào đường dây điện trung thế, nguy cơ rò điện.' },
            { id: 'REP-HN-105', raw_id: 105, lat: 20.8935, lng: 105.6590, contact_name: 'Báo cáo: Thôn Nhân Lý, Xã Nam Phương Tiến, Chương Mỹ, Hà Nội', depth: 120, confirmed: true, desc: 'Nước sông Bùi tràn đê Bùi 2, toàn thôn ngập sâu 1.2m đến 1.5m, 120 hộ dân bị cô lập cần thuyền tiếp tế.' },
            { id: 'REP-QN-106', raw_id: 106, lat: 20.9510, lng: 107.0850, contact_name: 'Báo cáo: Khu vực Cột 5, Phường Hồng Hà, TP. Hạ Long, Quảng Ninh', depth: 30, confirmed: false, desc: 'Triều cường dâng kết hợp mưa lớn làm ngập cục bộ 30cm tuyến bao biểu, các xe ô tô gầm thấp phải quay đầu.' },
            { id: 'REP-HG-107', raw_id: 107, lat: 22.7520, lng: 104.9850, contact_name: 'Báo cáo: Km 12 Quốc lộ 2, Huyện Vị Xuyên, Hà Giang', depth: 75, confirmed: false, desc: 'Lũ ống quét qua ngầm tràn cuốn trôi 1 phần kè taluy âm, đất đá đang sạt trượt tiếp, khuyến cáo không đi qua.' },
            { id: 'REP-CB-108', raw_id: 108, lat: 22.8250, lng: 106.5280, contact_name: 'Báo cáo: Thị trấn Trùng Khánh, Tỉnh Cao Bằng', depth: 40, confirmed: true, desc: 'Nước sông Quây Sơn dâng nhanh làm ngập 40cm các diện tích lúa và hoa màu ven bãi bồi.' }
          ];
          seedReps.forEach(s => {
            intakeItems.push({
              id: s.id,
              raw_id: s.raw_id,
              source: 'citizen_report',
              source_label: '📢 Dân Báo Ngập',
              source_badge_color: 'bg-amber-600 text-white',
              contact_name: s.contact_name,
              phone: 'GPS Đối soát tự động',
              people_count: 0,
              has_vulnerable: false,
              water_level_cm: s.depth,
              priority: s.depth >= 60 ? 'high' : 'medium',
              status: s.confirmed ? 'verified' : 'pending',
              lat: s.lat,
              lng: s.lng,
              description: s.desc,
              created_at: new Date(Date.now() - 30 * 60000).toISOString(),
              is_verified: s.confirmed
            });
          });
        }

        intakeItems.push(
          {
            id: 'HOTLINE-114',
            raw_id: 114,
            source: 'hotline_114',
            source_label: '☎️ Hotline 114',
            source_badge_color: 'bg-blue-600 text-white',
            contact_name: 'Trực ban PCCC & CNCH Hà Nội',
            phone: '114 (Đường dây nóng)',
            people_count: 4,
            has_vulnerable: true,
            water_level_cm: 65,
            priority: 'critical',
            status: 'pending',
            lat: 20.8940,
            lng: 105.6595,
            description: 'Người dân thôn Nhân Lý báo nước tràn vào ngõ sâu 1.2m, xe máy và máy phát điện đã ngập, có người già 82 tuổi.',
            created_at: new Date(Date.now() - 15 * 60000).toISOString(),
            is_verified: true
          },
          {
            id: 'IOT-201',
            raw_id: 201,
            source: 'iot_sensor',
            source_label: '🌊 Trạm Quan Trắc',
            source_badge_color: 'bg-cyan-700 text-white',
            contact_name: 'Trạm Quan Trắc Tự Động Sông Bùi',
            phone: 'Telemetry IoT Sensor',
            people_count: 0,
            has_vulnerable: false,
            water_level_cm: 145,
            priority: 'critical',
            status: 'verified',
            lat: 20.8930,
            lng: 105.6590,
            description: 'Mực nước dâng 1.45m trong 2 giờ qua, đê Bùi 2 có nguy cơ tràn bãi tả ngạn Nam Phương Tiến.',
            created_at: new Date(Date.now() - 20 * 60000).toISOString(),
            is_verified: true
          },
          {
            id: 'SAR-S1-01',
            raw_id: 501,
            source: 'satellite_sar',
            source_label: '🛰️ Vệ Tinh Sentinel-1',
            source_badge_color: 'bg-purple-700 text-white',
            contact_name: 'Viễn thám Radar Khẩu độ Tổng hợp ESA',
            phone: 'Copernicus SAR Feed',
            people_count: 0,
            has_vulnerable: false,
            water_level_cm: 100,
            priority: 'high',
            status: 'verified',
            lat: 22.3120,
            lng: 104.3800,
            description: 'Ảnh viễn thám radar xuyên mây phát hiện mặt nước mở rộng 4.2 km² tại thung lũng sông Chảy, Bảo Yên.',
            created_at: new Date(Date.now() - 45 * 60000).toISOString(),
            is_verified: true
          }
        );
      } catch (err) {
        console.warn('[MapLibre] Lỗi tự nạp Intake dự phòng:', err);
      }
    }

    const validDrawerSosList = [];
    const usedCoords = new Map(); // Xử lý vi phân tán ~25m nếu 2 tin trùng khít tọa độ

    intakeItems.forEach(item => {
      let lat = Number(item.lat);
      let lng = Number(item.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      // Khóa chặt phạm vi tác chiến 26 Tỉnh Miền Bắc
      if (!isWithinNorthernVietnam(lng, lat)) return;

      // Vi phân tán (Micro-offset) nếu trùng tọa độ chuẩn xác để người dùng click chọn được cả 2 tin
      const exactKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      const overlapCount = usedCoords.get(exactKey) || 0;
      usedCoords.set(exactKey, overlapCount + 1);
      if (overlapCount > 0) {
        const angle = (overlapCount * 60) * Math.PI / 180;
        const offsetDist = 0.00035 * Math.min(overlapCount, 3);
        lng += Math.cos(angle) * offsetDist;
        lat += Math.sin(angle) * offsetDist;
      }

      const isResolved = item.status === 'resolved' || item.status === 'rescued';
      const isDispatched = item.status === 'dispatched' || item.status === 'on_scene';
      const isCritical = item.priority === 'critical';

      // Thiết lập định dạng Icon & Màu sắc Tác chiến theo Nguồn Tiếp Nhận
      let markerHtml = '';
      let accentBorderColor = 'rgba(239, 68, 68, 0.5)';
      let accentTextColor = '#f87171';
      let accentDotColor = '#ef4444';

      if (item.source === 'citizen_report' || (item.id && String(item.id).startsWith('REP-'))) {
        accentBorderColor = 'rgba(245, 158, 11, 0.6)';
        accentTextColor = '#fbbf24';
        accentDotColor = '#f59e0b';
        markerHtml = `
          <span class="absolute w-7 h-7 rounded-full bg-amber-500/35 animate-ping pointer-events-none"></span>
          <span class="absolute w-8 h-8 rounded-full bg-amber-500/15 pointer-events-none"></span>
          <div class="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 font-black text-[9px] flex items-center justify-center shadow-lg border border-amber-200 relative z-10 pointer-events-auto">
            📢
          </div>
        `;
      } else if (item.source === 'hotline_114' || (item.id && String(item.id).startsWith('HOTLINE'))) {
        accentBorderColor = 'rgba(59, 130, 246, 0.6)';
        accentTextColor = '#60a5fa';
        accentDotColor = '#3b82f6';
        markerHtml = `
          <span class="absolute w-7 h-7 rounded-full bg-blue-500/35 animate-ping pointer-events-none"></span>
          <span class="absolute w-8 h-8 rounded-full bg-blue-500/15 pointer-events-none"></span>
          <div class="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-[9px] flex items-center justify-center shadow-lg border border-blue-200 relative z-10 pointer-events-auto">
            ☎️
          </div>
        `;
      } else if (item.source === 'iot_sensor' || (item.id && String(item.id).startsWith('IOT'))) {
        accentBorderColor = 'rgba(6, 182, 212, 0.6)';
        accentTextColor = '#22d3ee';
        accentDotColor = '#06b6d4';
        markerHtml = `
          <span class="absolute w-6 h-6 rounded-full bg-cyan-400/20 animate-ping pointer-events-none"></span>
          <div class="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-600 to-teal-700 text-slate-950 font-black text-[9px] flex items-center justify-center shadow-lg border border-cyan-200 relative z-10 pointer-events-auto">
            🌊
          </div>
        `;
      } else if (item.source === 'satellite_sar' || (item.id && String(item.id).startsWith('SAR'))) {
        accentBorderColor = 'rgba(168, 85, 247, 0.6)';
        accentTextColor = '#c084fc';
        accentDotColor = '#a855f7';
        markerHtml = `
          <span class="absolute w-6 h-6 rounded-full bg-purple-400/20 animate-ping pointer-events-none"></span>
          <div class="w-6 h-6 rounded-full bg-gradient-to-br from-purple-600 to-violet-800 text-white font-black text-[9px] flex items-center justify-center shadow-lg border border-purple-200 relative z-10 pointer-events-auto">
            🛰️
          </div>
        `;
      } else {
        // Mặc định: SOS Cứu nạn
        if (isDispatched) {
          accentBorderColor = 'rgba(59, 130, 246, 0.7)';
          accentTextColor = '#93c5fd';
          accentDotColor = '#3b82f6';
          markerHtml = `
            <span class="absolute w-7 h-7 rounded-full bg-blue-500/35 animate-ping pointer-events-none"></span>
            <div class="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-[9px] flex items-center justify-center shadow-lg border border-white relative z-10 pointer-events-auto">
              🚑
            </div>
          `;
        } else if (isResolved) {
          accentBorderColor = 'rgba(16, 185, 129, 0.5)';
          accentTextColor = '#34d399';
          accentDotColor = '#10b981';
          markerHtml = `
            <div class="w-5 h-5 rounded-full bg-emerald-800 text-emerald-200 font-black text-[9px] flex items-center justify-center shadow-md border border-emerald-400 opacity-70 pointer-events-auto">
              ✓
            </div>
          `;
        } else {
          markerHtml = `
            <span class="absolute w-7 h-7 rounded-full bg-rose-500/35 animate-ping pointer-events-none"></span>
            <span class="absolute w-8 h-8 rounded-full bg-rose-500/15 pointer-events-none"></span>
            <div class="w-6 h-6 rounded-full bg-gradient-to-br from-rose-600 to-red-700 text-white font-black text-[9px] flex items-center justify-center shadow-lg border border-white relative z-10 pointer-events-auto">
              SOS
            </div>
          `;
        }
      }

      // Tạo DOM Marker Element
      const el = document.createElement('div');
      el.className = 'flex items-center justify-center cursor-pointer select-none';
      el.style.cssText = 'position: absolute !important; top: 0 !important; left: 0 !important; margin: 0 !important; width: 28px; height: 28px; pointer-events: auto !important; z-index: 15;';
      el.innerHTML = markerHtml;
      el.setAttribute('data-incident-id', String(item.id));

      // Badges Popup
      const priorityBadgeHtml = isCritical
        ? '<span style="font-size: 10px; font-weight: 900; background: rgba(159,18,57,0.85); color: #fda4af; border: 1px solid #e11d48; border-radius: 4px; padding: 2px 7px;">🔴 P1 Khẩn Cấp</span>'
        : (item.priority === 'high'
          ? '<span style="font-size: 10px; font-weight: 800; background: rgba(120,53,15,0.85); color: #fde68a; border: 1px solid #d97706; border-radius: 4px; padding: 2px 7px;">🟠 P2 Ưu Tiên</span>'
          : '<span style="font-size: 10px; font-weight: 700; background: rgba(30,41,59,0.85); color: #cbd5e1; border: 1px solid #475569; border-radius: 4px; padding: 2px 7px;">⚪ Bình Thường</span>');

      const statusBadgeHtml = isResolved
        ? '<span style="font-size: 10px; font-weight: 800; background: rgba(6,78,59,0.85); color: #6ee7b7; border: 1px solid #059669; border-radius: 4px; padding: 2px 7px;">✅ Đã Hoàn Tất</span>'
        : (isDispatched
          ? '<span style="font-size: 10px; font-weight: 800; background: rgba(30,58,138,0.85); color: #93c5fd; border: 1px solid #2563eb; border-radius: 4px; padding: 2px 7px;">🚑 Đang Ứng Cứu</span>'
          : (item.is_verified
            ? '<span style="font-size: 10px; font-weight: 800; background: rgba(19,78,74,0.85); color: #5eead4; border: 1px solid #0d9488; border-radius: 4px; padding: 2px 7px;">✓ Đã Xác Minh</span>'
            : '<span style="font-size: 10px; font-weight: 800; background: rgba(120,53,15,0.85); color: #fde68a; border: 1px solid #d97706; border-radius: 4px; padding: 2px 7px;">⏳ Chờ Duyệt</span>'));

      const safeLatStr = lat.toFixed(4);
      const safeLngStr = lng.toFixed(4);
      const safeContactName = String(item.contact_name || 'Nạn nhân').replace(/'/g, "\\'");

      const popupHtml = `
        <div style="padding: 12px; background: #0b0f19; color: #f8fafc; border-radius: 14px; border: 1px solid ${accentBorderColor}; box-shadow: 0 16px 36px rgba(0,0,0,0.85); min-width: 290px; max-width: 325px; font-family: 'Be Vietnam Pro', 'Inter', sans-serif; user-select: none;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 8px; margin-bottom: 8px; padding-right: 20px;">
            <span style="font-weight: 900; color: ${accentTextColor}; font-size: 12px; display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${accentDotColor};"></span> ${item.source_label || 'SỰ CỐ TIẾP NHẬN'}
            </span>
            <span style="font-size: 10px; font-family: monospace; font-weight: 800; color: #cbd5e1; background: rgba(30,41,59,0.8); border: 1px solid #475569; border-radius: 4px; padding: 1px 6px;">#${item.id}</span>
          </div>

          <div style="margin-bottom: 8px;">
            <h4 style="font-weight: 800; color: #ffffff; font-size: 13px; margin: 0; line-height: 1.35;">${item.contact_name || 'Người dân'}</h4>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 3px;">
              <span style="font-size: 11px; font-family: monospace; font-weight: 700; color: #fbbf24;">📞 ${item.phone || 'Chưa có SĐT'}</span>
              <span style="font-size: 10px; font-family: monospace; color: #94a3b8;">[${safeLatStr}, ${safeLngStr}]</span>
            </div>
          </div>

          <div style="display: flex; gap: 6px; margin-bottom: 8px;">
            ${priorityBadgeHtml}
            ${statusBadgeHtml}
          </div>

          <div style="background: rgba(2,6,23,0.85); border: 1px solid rgba(51,65,85,0.7); border-radius: 10px; padding: 8px 10px; font-size: 11px; margin-bottom: 8px; line-height: 1.6;">
            ${item.people_count > 0 ? `<div style="display: flex; justify-content: space-between;"><span style="color: #94a3b8;">Số người:</span><span style="font-weight: 800; color: #ffffff; font-family: monospace;">${item.people_count} người</span></div>` : ''}
            ${item.has_vulnerable ? '<div style="color: #fbbf24; font-weight: 800; font-size: 10.5px;">⚠️ Có trẻ nhỏ / người cao tuổi</div>' : ''}
            ${item.water_level_cm > 0 ? `<div style="display: flex; justify-content: space-between;"><span style="color: #94a3b8;">Mực nước:</span><span style="font-weight: 800; color: #38bdf8; font-family: monospace;">~${item.water_level_cm} cm</span></div>` : ''}
            ${item.description ? `<div style="font-style: italic; color: #cbd5e1; font-size: 11px; border-top: 1px solid rgba(51,65,85,0.6); padding-top: 5px; margin-top: 5px; line-height: 1.4;">"${item.description}"</div>` : ''}
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px; border-top: 1px solid rgba(51,65,85,0.7); padding-top: 8px;">
            <div style="display: flex; gap: 6px;">
              ${(item.phone && String(item.phone).match(/\d/)) ? `<a href="tel:${item.phone}" style="flex: 1; padding: 6px 8px; background: #059669; color: #ffffff; border-radius: 7px; font-size: 11px; font-weight: 800; text-align: center; text-decoration: none; display: block;">📞 Gọi điện</a>` : ''}
              <button onclick="CommandUIController.openIncidentDocket('${item.id}')" style="flex: 1; padding: 6px 8px; background: #1e293b; color: #38bdf8; border: 1px solid #334155; border-radius: 7px; font-size: 11px; font-weight: 800; cursor: pointer;">📋 Hồ Sơ</button>
              <button onclick="CommandUIController.openDispatchModal('${item.id}')" style="flex: 1; padding: 6px 8px; background: #dc2626; color: #ffffff; border: none; border-radius: 7px; font-size: 11px; font-weight: 800; cursor: pointer;">⚡ Lệnh</button>
            </div>
            <button onclick="NorthStarMapLibre.openGroundReconViewer(${lng}, ${lat}, '${safeContactName}')" style="width: 100%; padding: 6px 10px; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #ffffff; border: 1px solid rgba(167,139,250,0.5); border-radius: 7px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 12px rgba(124,58,237,0.35);">
              <span>📸</span> Trinh Sát Hiện Trường & 3D
            </button>
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 25, maxWidth: '320px' }).setHTML(popupHtml);
      el.onclick = (e) => {
        e.stopPropagation();
        openActivePopup(popup, [lng, lat]);
      };

      const marker = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
        .setLngLat([lng, lat])
        .addTo(mapInstance);

      markersRegistry.sos.push(marker);
      if (markersRegistry.intake) markersRegistry.intake.push(marker);
      intakeMarkersMap.set(String(item.id), { marker, popup, item, el, lat, lng });

      if (!isResolved) {
        validDrawerSosList.push({ ...item, coords: [lng, lat] });
      }
    });

    cachedDrawerData.sos = validDrawerSosList;
    updateDrawerBadge('sos', validDrawerSosList.length);
  }

  /**
   * Tương thích ngược: Đồng bộ SOS gọi trực tiếp syncIntakeMarkers
   */
  async function syncSOSMarkers() {
    return await syncIntakeMarkers();
  }

  /**
   * ĐỊNH VỊ TỨC THÌ SỰ CỐ TỪ BẢNG TIẾP NHẬN TRÊN BẢN ĐỒ MAPLIBRE (C2 FOCUS INCIDENT)
   * Lia camera mượt mà, bật popup chi tiết và tạo hiệu ứng vòng xung điện quang
   */
  function focusIncident(id, lng, lat, itemData) {
    if (!mapInstance) return;

    closeCurrentPopup();

    const targetLng = Number(lng);
    const targetLat = Number(lat);
    if (isNaN(targetLng) || isNaN(targetLat)) return;

    // Lia góc nhìn chiến thuật
    mapInstance.flyTo({
      center: [targetLng, targetLat],
      zoom: 15.8,
      pitch: 45,
      bearing: -10,
      duration: 1200,
      essential: true
    });

    // Mở popup và tạo hiệu ứng nhấp nháy tiêu điểm tác chiến
    setTimeout(() => {
      const rec = intakeMarkersMap.get(String(id));
      if (rec && rec.popup) {
        openActivePopup(rec.popup, [rec.lng || targetLng, rec.lat || targetLat]);
        if (rec.el) {
          rec.el.classList.add('tactical-focus-pulse');
          setTimeout(() => rec.el.classList.remove('tactical-focus-pulse'), 3500);
        }
      } else {
        const title = itemData ? (itemData.contact_name || itemData.source_label) : `Sự cố #${id}`;
        flyToTacticalItem(targetLng, targetLat, `🎯 ${title}`, `Mã sự cố: #${id}`);
      }
    }, 400);
  }

  let cachedRawFloodPoints = [];

  /**
   * Đồng bộ Điểm Ngập Lụt & Trạm Đo Thủy Văn (Tích hợp AI, Vòng Sóng Vector & Gom Cụm Thông Minh)
   */
  async function syncFloodPointMarkers() {
    try {
      const [resPoints] = await Promise.all([
        fetch(resolveApi('/api/flood-points')).catch(() => null),
        ensureAiPredictionsLoaded()
      ]);

      let points = [];
      if (resPoints && resPoints.ok) {
        const raw = await resPoints.json();
        points = Array.isArray(raw) ? raw : (raw.features || []);
      } else if (window.floodPoints && Array.isArray(window.floodPoints)) {
        points = window.floodPoints;
      }

      const validPoints = [];
      points.forEach(pt => {
        const p = pt.properties || pt;
        const lat = parseFloat(pt.lat || (pt.geometry && pt.geometry.coordinates[1]) || p.lat || p.latitude);
        const lng = parseFloat(pt.lng || (pt.geometry && pt.geometry.coordinates[0]) || p.lng || p.longitude);
        const depth = parseFloat(pt.depth_cm !== undefined ? pt.depth_cm : (p.depth_cm !== undefined ? p.depth_cm : (p.current_depth_cm || 0)));
        const location = pt.location || p.location || p.name || 'Điểm ngập';
        const id = pt.id || p.id || Math.floor(Math.random() * 100000);
        const sensor_id = pt.sensor_id || p.sensor_id || '';
        const source = pt.source || p.source || (sensor_id ? 'sensor' : 'sensor');
        const status = pt.status || p.status || (depth >= 20 ? 'danger' : (depth >= 5 ? 'warning' : 'safe'));
        const threshold_cm = pt.threshold_cm || p.threshold_cm || 20;
        const last_reading_at = pt.last_reading_at || p.last_reading_at;
        const water_trend = pt.water_trend || p.water_trend || 'falling';
        const estimated_drainage_time = pt.estimated_drainage_time || p.estimated_drainage_time;

        if (!isNaN(lat) && !isNaN(lng)) {
          if (isWithinNorthernVietnam(lng, lat)) {
            validPoints.push({
              id,
              lat,
              lng,
              depth,
              location,
              sensor_id,
              source,
              status,
              threshold_cm,
              last_reading_at,
              water_trend,
              estimated_drainage_time,
              district: getStationDistrictHelper(location, lat, lng),
              raw: pt
            });
          }
        }
      });

      cachedRawFloodPoints = validPoints;
      cachedDrawerData.flood = [...validPoints].sort((a, b) => b.depth - a.depth);
      updateDrawerBadge('flood', validPoints.length);

      // Cập nhật số điểm ngập động vào Dropdown 26 Tỉnh Thành Miền Bắc
      updateProvinceDropdownCounts();

      renderClusteredFloodMarkers();
      syncFloodCirclesData();
      updateMapLibreViewportAlert();
      renderHanoiDistrictMarkers();

    } catch (e) {
      console.warn('[MapLibre] Lỗi đồng bộ Flood Points:', e);
    }
  }

  // =========================================================================
  // BỘ NHẬN DIỆN VÀ PHÂN VÙNG TỈNH THÀNH (26 TỈNH MIỀN BẮC)
  // =========================================================================
  const PROVINCE_KEYWORD_MAP = {
    'Lào Cai': ['lào cai', 'bảo yên', 'bảo hà', 'làng nủ', 'sa pa', 'lao cai', 'bát xát'],
    'Yên Bái': ['yên bái', 'yen bai', 'sông thao', 'mù cang chải', 'văn yên', 'trấn yên'],
    'Thái Nguyên': ['thái nguyên', 'thai nguyen', 'phổ yên', 'đê chã', 'sông cầu', 'gia bẩy', 'sông công'],
    'Bắc Giang': ['bắc giang', 'bac giang', 'phủ lạng thương', 'hiệp hòa', 'sông thương', 'lục ngạn'],
    'Phú Thọ': ['phú thọ', 'phu tho', 'việt trì', 'phong châu', 'sông lô', 'đoan hùng', 'thanh sơn'],
    'Cao Bằng': ['cao bằng', 'cao bang', 'pia oắc', 'bằng giang', 'trùng khánh', 'bảo lạc'],
    'Quảng Ninh': ['quảng ninh', 'quang ninh', 'bãi cháy', 'cẩm phả', 'hạ long', 'uông bí', 'móng cái', 'vân đồn'],
    'Hải Phòng': ['hải phòng', 'hai phong', 'hòn dáu', 'đồ sơn', 'cát hải', 'bạch long vĩ', 'thủy nguyên'],
    'Tuyên Quang': ['tuyên quang', 'tuyen quang', 'chiêm hóa', 'na hang', 'sơn dương'],
    'Hòa Bình': ['hòa bình', 'hoa binh', 'lương sơn', 'sông đà', 'mai châu', 'kỳ sơn', 'kim bôi'],
    'Bắc Ninh': ['bắc ninh', 'bac ninh', 'bến hồ', 'sông đuống', 'từ sơn', 'thuận thành'],
    'Lạng Sơn': ['lạng sơn', 'lang son', 'thất khê', 'sông kỳ cùng', 'đồng đăng', 'hữu lũng'],
    'Ninh Bình': ['ninh bình', 'ninh binh', 'sông đáy', 'hoa lư', 'tam điệp', 'nho quan'],
    'Hà Nam': ['hà nam', 'ha nam', 'phủ lý', 'đồng văn', 'kim bảng'],
    'Nam Định': ['nam định', 'nam dinh', 'sông đào', 'giao thủy', 'hải hậu'],
    'Thái Bình': ['thái bình', 'thai binh', 'diêm điền', 'kiến xương', 'tiền hải'],
    'Hưng Yên': ['hưng yên', 'hung yen', 'khoái châu', 'kim động', 'mỹ hào'],
    'Hải Dương': ['hải dương', 'hai duong', 'chí linh', 'kinh môn', 'nam sách'],
    'Vĩnh Phúc': ['vĩnh phúc', 'vinh phuc', 'vĩnh yên', 'phúc yên', 'tam đảo', 'bình xuyên'],
    'Bắc Kạn': ['bắc kạn', 'bac kan', 'ba bể', 'chợ đồn', 'ngân sơn'],
    'Hà Giang': ['hà giang', 'ha giang', 'đồng văn', 'mèo vạc', 'vị xuyên', 'quản bạ'],
    'Sơn La': ['sơn la', 'son la', 'mộc châu', 'mường la', 'thuận châu'],
    'Điện Biên': ['điện biên', 'dien bien', 'mường thanh', 'tuần giáo', 'mường nhé'],
    'Lai Châu': ['lai châu', 'lai chau', 'phong thổ', 'mường tè', 'tam đường'],
    'Thanh Hóa': ['thanh hóa', 'thanh hoa', 'sầm sơn', 'bỉm sơn', 'mường lát']
  };

  function getProvinceForFloodPoint(pt) {
    const loc = (pt.location || pt.name || '').toLowerCase();
    for (const [prov, kws] of Object.entries(PROVINCE_KEYWORD_MAP)) {
      if (kws.some(kw => loc.includes(kw))) {
        return prov;
      }
    }
    // Tọa độ bao phủ toàn bộ thủ đô Hà Nội (cả nội thành và ngoại thành Ba Vì, Sơn Tây, Mỹ Đức, Mê Linh...)
    if (pt.lat >= 20.50 && pt.lat <= 21.40 && pt.lng >= 105.30 && pt.lng <= 106.10) {
      return 'Hà Nội';
    }
    // Tìm trung tâm tỉnh gần nhất
    let nearestProv = 'Hà Nội';
    let minDist = Infinity;
    for (const [prov, info] of Object.entries(NORTHERN_PROVINCE_TARGETS)) {
      const pCenter = info.center || [105.85, 21.03];
      const d = Math.hypot(pt.lng - pCenter[0], pt.lat - pCenter[1]);
      if (d < minDist) {
        minDist = d;
        nearestProv = prov;
      }
    }
    return nearestProv;
  }

  function updateProvinceDropdownCounts() {
    const provSel = document.getElementById('ml-province-selector');
    if (!provSel || !cachedRawFloodPoints.length) return;

    const counts = {};
    cachedRawFloodPoints.forEach(pt => {
      const prov = getProvinceForFloodPoint(pt);
      counts[prov] = (counts[prov] || 0) + 1;
    });

    for (let opt of provSel.options) {
      const provVal = opt.value;
      if (provVal && provVal !== 'all') {
        const c = counts[provVal] || 0;
        const cleanText = opt.text.replace(/\s*\(\d+\s*vùng ngập\)/g, '').replace(/\s*\(\d+\s*điểm ngập\)/g, '');
        if (c > 0) {
          opt.text = `${cleanText} (${c} điểm ngập)`;
        } else {
          opt.text = cleanText;
        }
      }
    }
  }

  /**
   * HIỂN THỊ CỤM ĐIỂM NGẬP THÔNG MINH (LEAFLET-STYLE MAPLIBRE CLUSTERING)
   * - Zoom < 11.2 (Toàn cảnh / Cấp tỉnh): Huy hiệu tổng hợp số điểm ngập từng Tỉnh/Thành (VD: 🏛️ Hà Nội [130])
   * - Nhấp vào huy hiệu: Camera flyTo/fitBounds phóng to mượt mà vào trung tâm tỉnh.
   * - Zoom >= 11.2 (Chi tiết đô thị / quận huyện): Tự động bung toàn bộ các điểm ngập chi tiết kèm mực nước (cm) & sóng radar.
   */
  function renderClusteredFloodMarkers() {
    if (!mapInstance || !layerVisibility.floodPoints) return;

    markersRegistry.floodPoints.forEach(m => m.remove());
    markersRegistry.floodPoints = [];

    const validPoints = cachedRawFloodPoints;
    if (!validPoints.length) return;

    const currentZoom = mapInstance.getZoom();
    const CLUSTER_THRESHOLD_ZOOM = 11.0;

    if (currentZoom < CLUSTER_THRESHOLD_ZOOM) {
      // CẤP ĐỘ 1: TOÀN CẢNH MIỀN BẮC / TỈNH THÀNH (ZOOM < 11.0)
      // Gom nhóm điểm ngập theo từng Tỉnh Thành để hiển thị số lượng cụm (như Leaflet MarkerCluster)
      const provGroups = {};
      validPoints.forEach(pt => {
        const prov = getProvinceForFloodPoint(pt);
        if (!provGroups[prov]) provGroups[prov] = [];
        provGroups[prov].push(pt);
      });

      Object.entries(provGroups).forEach(([provName, groupPts]) => {
        createProvinceClusterMarker(provName, groupPts);
      });
    } else {
      // CẤP ĐỘ 2: PHÓNG TO CHI TIẾT ĐÔ THỊ / QUẬN HUYỆN (ZOOM >= 11.0)
      // Tự động bung toàn bộ các điểm đo riêng lẻ kèm mực nước cm, sóng phản xạ radar và popup cứu hộ
      validPoints.forEach(pt => createIndividualFloodMarker(pt));
    }
  }

  /**
   * TẠO HUY HIỆU CỤM ĐIỂM NGẬP CẤP TỈNH THÀNH (PROVINCE FLOOD CLUSTER BADGE)
   * Hiển thị biểu tượng, tên tỉnh, số lượng vùng ngập, viền phát sáng cảnh báo, nhấp để phóng to bung điểm.
   */
  function createProvinceClusterMarker(provName, group) {
    const count = group.length;
    const hasDanger = group.some(pt => pt.depth >= 20 || pt.status === 'danger');
    const hasWarning = group.some(pt => pt.depth >= 5 || pt.status === 'warning');

    let threatClass = 'safe';
    if (hasDanger) threatClass = 'danger';
    else if (hasWarning) threatClass = 'warning';

    const meta = (window.ProvinceWeatherLayer && window.ProvinceWeatherLayer.metadata && window.ProvinceWeatherLayer.metadata[provName]) || {};
    const icon = meta.icon || (provName === 'Hà Nội' ? '🏛️' : '📍');

    // Tính tọa độ trung tâm cụm điểm ngập
    let avgLat = 0, avgLng = 0;
    group.forEach(pt => {
      avgLat += pt.lat;
      avgLng += pt.lng;
    });
    avgLat /= count;
    avgLng /= count;

    // Định vị tối ưu
    const provTarget = NORTHERN_PROVINCE_TARGETS[provName];
    if (count <= 2 && provTarget) {
      avgLng = provTarget.center[0];
      avgLat = provTarget.center[1];
    } else if (provName === 'Hà Nội') {
      avgLng = 105.825;
      avgLat = 21.025;
    }

    const el = document.createElement('div');
    el.className = 'c2-province-cluster-badge group';
    el.title = `${icon} ${provName}: ${count} vùng ngập lụt. Nhấp để phóng to chi tiết!`;
    el.innerHTML = `
      <span class="c2-province-cluster-pulse ${threatClass}"></span>
      <div class="c2-province-cluster-inner">
        <span class="c2-province-cluster-icon">${icon}</span>
        <span class="c2-province-cluster-name">${provName}</span>
        <span class="c2-province-cluster-count ${threatClass}">${count}</span>
      </div>
    `;

    // Nhấp huy hiệu: Phóng to mượt mà bay vào tỉnh thành (zoom 12.8), tự động bung toàn bộ các điểm ngập chi tiết ra!
    el.onclick = (e) => {
      e.stopPropagation();
      closeCurrentPopup();

      const targetZoom = provName === 'Hà Nội' ? 12.8 : (count > 1 ? 12.5 : 12.2);
      mapInstance.flyTo({
        center: [avgLng, avgLat],
        zoom: targetZoom,
        duration: 800,
        essential: true
      });

      // Đồng bộ vào dropdown tỉnh thành
      const provSel = document.getElementById('ml-province-selector');
      if (provSel) {
        for (let i = 0; i < provSel.options.length; i++) {
          if (provSel.options[i].value === provName) {
            provSel.selectedIndex = i;
            break;
          }
        }
      }

      if (typeof window.showNorthStarToast === 'function') {
        window.showNorthStarToast(`🔍 Phóng to tiêu điểm ${icon} ${provName} (${count} điểm ngập)`, 'info', 2000);
      }
    };

    const marker = new maplibregl.Marker({
      element: el,
      anchor: 'center',
      rotationAlignment: 'viewport',
      pitchAlignment: 'viewport'
    })
      .setLngLat([avgLng, avgLat])
      .addTo(mapInstance);

    markersRegistry.floodPoints.push(marker);
  }

  function createIndividualFloodMarker(pt) {
    const depthVal = Math.round(pt.depth);
    const depthText = (pt.status === 'offline') ? 'OFF' : (pt.status === 'no_data' || isNaN(depthVal) ? '--' : `${depthVal}cm`);

    let badgeBg = '#10b981'; // Xanh lá: an toàn
    let pulseHtml = '';
    if (pt.status === 'danger' || depthVal >= 20) {
      badgeBg = '#ef4444'; // Đỏ: nguy hiểm
      pulseHtml = '<span class="absolute w-8 h-8 rounded-full bg-rose-500/35 animated-marker-pulse pointer-events-none"></span>';
    } else if (pt.status === 'warning' || depthVal >= 5) {
      badgeBg = '#f59e0b'; // Vàng cam
    } else if (pt.status === 'stale') {
      badgeBg = '#d97706'; // Vàng cam hổ phách
    } else if (pt.status === 'offline' || pt.status === 'no_data') {
      badgeBg = '#64748b'; // Xám
    }

    const el = document.createElement('div');
    el.className = 'c2-maplibre-pin flex items-center justify-center cursor-pointer select-none group';
    el.style.cssText = 'position: absolute !important; top: 0 !important; left: 0 !important; margin: 0 !important; width: 32px; height: 32px; pointer-events: auto !important; z-index: 25;';
    el.innerHTML = `
      ${pulseHtml}
      <div class="px-2 py-0.5 rounded-full text-white text-[10px] font-mono font-black shadow-lg border border-white/60 relative z-10 flex items-center justify-center transition-transform duration-200 group-hover:scale-120 pointer-events-auto backdrop-blur-xs" style="background: ${badgeBg}; min-width: 28px; height: 22px;" title="${pt.location}: ${depthVal}cm">
        ${depthText}
      </div>
    `;

    const popupHtml = buildStationPopupHtml(pt);
    const popup = new maplibregl.Popup({ offset: 18, maxWidth: '350px' }).setHTML(popupHtml);

    el.onclick = (e) => {
      e.stopPropagation();
      openActivePopup(popup, [pt.lng, pt.lat]);
    };

    const marker = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
      .setLngLat([pt.lng, pt.lat])
      .addTo(mapInstance);

    markersRegistry.floodPoints.push(marker);
  }

  function openStationPopupById(pointId) {
    const pt = cachedRawFloodPoints.find(p => p.id === pointId);
    if (!pt || !mapInstance) return;

    mapInstance.flyTo({ center: [pt.lng, pt.lat], zoom: 14.5, duration: 800 });
    setTimeout(() => {
      const popupHtml = buildStationPopupHtml(pt);
      const popup = new maplibregl.Popup({ offset: 18, maxWidth: '350px' }).setHTML(popupHtml);
      openActivePopup(popup, [pt.lng, pt.lat]);
    }, 450);
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
        <div style="padding: 12px; background: #0b0f19; color: #f8fafc; border-radius: 14px; border: 1px solid rgba(245,158,11,0.5); box-shadow: 0 16px 36px rgba(0,0,0,0.8); min-width: 260px; max-width: 300px; font-family: 'Be Vietnam Pro', 'Inter', sans-serif; user-select: none;">
          <div style="font-weight: 900; color: #fbbf24; font-size: 13px; border-bottom: 1px solid rgba(245,158,11,0.3); padding-bottom: 6px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; padding-right: 20px;">
            <span>⚠️</span> ${h.name}
          </div>
          <div style="font-size: 11px; color: #cbd5e1; line-height: 1.4; margin-bottom: 6px;">${h.desc}</div>
          <div style="font-size: 10px; font-family: monospace; color: #64748b;">[${h.lat.toFixed(4)}, ${h.lng.toFixed(4)}]</div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 18, maxWidth: '240px' }).setHTML(popupHtml);
      el.onclick = (e) => {
        e.stopPropagation();
        openActivePopup(popup, [h.lng, h.lat]);
      };
      const marker = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
        .setLngLat([h.lng, h.lat])
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
          <div style="padding: 12px; background: #0b0f19; color: #f8fafc; border-radius: 14px; border: 1px solid rgba(16,185,129,0.4); box-shadow: 0 16px 36px rgba(0,0,0,0.8); min-width: 275px; max-width: 320px; font-family: 'Be Vietnam Pro', 'Inter', sans-serif; user-select: none;">
            <div style="font-weight: 900; color: #34d399; font-size: 13px; border-bottom: 1px solid rgba(16,185,129,0.3); padding-bottom: 6px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; padding-right: 20px;">
              <span>🛡️</span> ${p.name}
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">${p.address || ''}</div>
            <div style="background: rgba(2,6,23,0.85); border: 1px solid rgba(51,65,85,0.7); border-radius: 10px; padding: 8px 10px; font-size: 11px; margin-bottom: 8px; line-height: 1.6;">
              <div style="display: flex; justify-content: space-between;"><span style="color: #94a3b8;">Sức chứa:</span><span style="font-weight: 800; color: #ffffff; font-family: monospace;">${p.capacity || 500} người</span></div>
              <div style="display: flex; justify-content: space-between;"><span style="color: #94a3b8;">Còn trống:</span><span style="font-weight: 800; color: #34d399; font-family: monospace;">${p.available_slots || 300} chỗ</span></div>
            </div>
            <button onclick="NorthStarMapLibre.setRouteOriginDestination('dest', ${coords[0]}, ${coords[1]}, '${p.name.replace(/'/g, "\\'")}')" style="width: 100%; padding: 8px 12px; background: #059669; color: #ffffff; border: 1px solid #10b981; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;">
              <span>🛡️ Sơ tán tới đây</span>
            </button>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 18, maxWidth: '260px' }).setHTML(popupHtml);
        el.onclick = (e) => {
          e.stopPropagation();
          openActivePopup(popup, [coords[0], coords[1]]);
        };
        const marker = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
          .setLngLat([coords[0], coords[1]])
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
        <div class="p-2.5 font-sans space-y-1.5 text-xs text-slate-100 select-none">
          <div class="font-black text-sky-400 text-sm border-b border-slate-800 pb-1">${icon} ${u.name}</div>
          <div class="text-[11px]">Trạng thái: <b class="${u.status === 'ready' ? 'text-emerald-400' : 'text-amber-400'}">${u.status === 'ready' ? 'Sẵn sàng cơ động' : 'Đang làm nhiệm vụ'}</b></div>
          <div class="text-[11px] text-slate-300">Lực lượng: <b class="text-white">${u.crew}</b></div>
          <div class="text-[10px] text-slate-400 font-mono">[${u.lat.toFixed(4)}, ${u.lng.toFixed(4)}]</div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 15, maxWidth: '240px' }).setHTML(popupHtml);
      el.onclick = (e) => {
        e.stopPropagation();
        openActivePopup(popup, [u.lng, u.lat]);
      };
      const marker = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
        .setLngLat([u.lng, u.lat])
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
               (item.description || item.notes || '').toLowerCase().includes(q) ||
               (item.id || '').toLowerCase().includes(q);
      });

      if (!items.length) {
        listContainer.innerHTML = '<div class="text-center text-slate-500 text-xs py-8">Không có tin tiếp nhận nào phù hợp.</div>';
        return;
      }

      items.forEach(item => {
        let icon = '🚨';
        let badgeColor = 'bg-rose-950 text-rose-300 border-rose-800';
        if (item.source === 'citizen_report' || (item.id && String(item.id).startsWith('REP-'))) {
          icon = '📢';
          badgeColor = 'bg-amber-950 text-amber-300 border-amber-800';
        } else if (item.source === 'hotline_114' || (item.id && String(item.id).startsWith('HOTLINE'))) {
          icon = '☎️';
          badgeColor = 'bg-blue-950 text-blue-300 border-blue-800';
        } else if (item.source === 'iot_sensor' || (item.id && String(item.id).startsWith('IOT'))) {
          icon = '🌊';
          badgeColor = 'bg-cyan-950 text-cyan-300 border-cyan-800';
        } else if (item.source === 'satellite_sar' || (item.id && String(item.id).startsWith('SAR'))) {
          icon = '🛰️';
          badgeColor = 'bg-purple-950 text-purple-300 border-purple-800';
        }

        const div = document.createElement('div');
        div.className = 'p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-sky-500/60 transition space-y-1.5 text-xs';
        div.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="font-extrabold text-slate-100 flex items-center gap-1.5 truncate">
              <span>${icon}</span> <span class="truncate">${item.contact_name || 'Nạn nhân'}</span>
            </span>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${badgeColor} border whitespace-nowrap">
              ${item.id}
            </span>
          </div>
          <div class="text-[11px] text-slate-300">📞 SĐT: <b>${item.phone}</b></div>
          ${(item.description || item.notes) ? `<div class="text-[10.5px] text-slate-400 italic line-clamp-2">"${item.description || item.notes}"</div>` : ''}
          <div class="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
            ${(item.phone && String(item.phone).match(/\d/)) ? `<a href="tel:${item.phone}" class="px-2 py-1 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded font-bold no-underline">Gọi Ngay</a>` : '<span class="text-slate-500">Kênh Nội Bộ</span>'}
            <button onclick="NorthStarMapLibre.focusIncident('${item.id}', ${item.coords[0]}, ${item.coords[1]})" class="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded font-bold cursor-pointer transition">
              📍 Định Vị
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
            <button onclick="NorthStarMapLibre.openStationPopupById(${item.id})" class="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold cursor-pointer transition flex items-center gap-1 shadow">
              <span>📍</span> Chi Tiết AI
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
      <div class="p-2.5 font-sans space-y-1 text-xs text-slate-100 select-none">
        <div class="font-black text-cyan-300 text-sm border-b border-slate-700/80 pb-1">${title}</div>
        <div class="text-[11px] text-slate-200 mt-1">${details}</div>
        <div class="text-[10px] text-slate-400 font-mono mt-1">[${lat.toFixed(4)}, ${lng.toFixed(4)}]</div>
      </div>
    `;

    const popup = new maplibregl.Popup({ offset: 18, maxWidth: '270px' })
      .setHTML(html);
    openActivePopup(popup, [lng, lat]);
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
          subtitle: `Mực nước: ${Math.round(f.depth)} cm • ${f.district || 'Hà Nội'}`,
          coords: [f.lng, f.lat],
          pointId: f.id
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

    // 5. Trạm quan trắc chất lượng không khí OpenAQ
    const openAQList = (window.CommandUIController && typeof window.CommandUIController.getOpenAQStationsData === 'function')
      ? window.CommandUIController.getOpenAQStationsData()
      : [];
    openAQList.forEach(st => {
      if ((st.name || '').toLowerCase().includes(q) ||
          (st.city || '').toLowerCase().includes(q) ||
          (st.district || '').toLowerCase().includes(q) ||
          q.includes('aqi') || q.includes('bụi') || q.includes('không khí') || q.includes('openaq')) {
        results.push({
          type: 'openaq',
          title: `🍃 ${st.name}`,
          subtitle: `AQI: ${st.aqi} (${st.status_label}) • PM2.5: ${st.pm25} µg/m³ • ${st.city}`,
          coords: [st.lng, st.lat]
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
      else if (res.type === 'openaq') badgeHtml = '<span class="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-teal-950 text-teal-300 border border-teal-800 shrink-0">🍃 OpenAQ</span>';
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
        flyToSearchItem(res.coords[0], res.coords[1], res.title, res.type, res.pointId);
        dropdown.classList.add('hidden');
      };

      dropdown.appendChild(item);
    });

    dropdown.classList.remove('hidden');
  }

  function flyToSearchItem(lng, lat, title, type, pointId) {
    if (!mapInstance) return;
    if (pointId) {
      openStationPopupById(pointId);
      return;
    }
    mapInstance.flyTo({
      center: [lng, lat],
      zoom: 14.5,
      pitch: 0,
      bearing: 0,
      speed: 1.4,
      essential: true
    });

    const html = `
      <div class="p-2.5 font-sans space-y-1 text-xs text-slate-100">
        <div class="font-extrabold text-cyan-400 text-sm border-b border-slate-700 pb-1">${title}</div>
        <div class="text-[10px] text-slate-400 font-mono">[${lat.toFixed(4)}, ${lng.toFixed(4)}]</div>
      </div>
    `;

    const popup = new maplibregl.Popup({ offset: 18, maxWidth: '280px' }).setHTML(html);
    openActivePopup(popup, [lng, lat]);
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
    } else if (layerKey === 'terrain') {
      if (isVisible) {
        setup3DTerrainDEM();
      } else {
        try { mapInstance.setTerrain(null); } catch (_) {}
      }
    } else if (layerKey === 'buildings') {
      if (mapInstance.getLayer('buildings-3d-extrusion')) {
        mapInstance.setLayoutProperty('buildings-3d-extrusion', 'visibility', isVisible ? 'visible' : 'none');
      }
    } else if (layerKey === 'rainRadar') {
      if (mapInstance.getLayer('rain-radar-heat')) {
        mapInstance.setLayoutProperty('rain-radar-heat', 'visibility', isVisible ? 'visible' : 'none');
      }
    } else if (layerKey === 'floodPoints') {
      if (mapInstance.getLayer('flood-circles-fill')) {
        mapInstance.setLayoutProperty('flood-circles-fill', 'visibility', isVisible ? 'visible' : 'none');
      }
      if (mapInstance.getLayer('flood-circles-line')) {
        mapInstance.setLayoutProperty('flood-circles-line', 'visibility', isVisible ? 'visible' : 'none');
      }
      syncFloodPointMarkers();
      syncFloodCirclesData();
      updateMapLibreViewportAlert();
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
          btn.className = 'px-2 py-1 rounded-lg text-[9.5px] font-bold cursor-pointer transition shadow bg-cyan-600 text-white';
        } else {
          btn.className = 'px-2 py-1 rounded-lg text-[9.5px] font-medium cursor-pointer transition bg-transparent hover:bg-slate-800 text-slate-300';
        }
      }
    });

    if (regionKey === 'all') {
      const provSel = document.getElementById('ml-province-selector');
      if (provSel) provSel.value = 'all';
    }
  }

  // Tọa độ & mức phóng tối ưu cho 26 Tỉnh Thành Miền Bắc (zoom >= 11.5 tự động bung điểm ngập chi tiết)
  const NORTHERN_PROVINCE_TARGETS = {
    'Hà Nội': { center: [105.8542, 21.0285], zoom: 12.8 },
    'Quảng Ninh': { center: [107.1800, 21.1500], zoom: 12.0 },
    'Hải Phòng': { center: [106.6800, 20.8600], zoom: 12.0 },
    'Hải Dương': { center: [106.3330, 20.9409], zoom: 12.0 },
    'Hưng Yên': { center: [106.0511, 20.6464], zoom: 12.0 },
    'Bắc Ninh': { center: [106.0700, 21.1800], zoom: 12.0 },
    'Bắc Giang': { center: [106.2000, 21.2800], zoom: 12.0 },
    'Vĩnh Phúc': { center: [105.5900, 21.3100], zoom: 12.0 },
    'Phú Thọ': { center: [105.2200, 21.3200], zoom: 12.0 },
    'Thái Nguyên': { center: [105.8450, 21.5940], zoom: 12.0 },
    'Bắc Kạn': { center: [105.8300, 22.1400], zoom: 12.0 },
    'Cao Bằng': { center: [106.2600, 22.6700], zoom: 12.0 },
    'Lạng Sơn': { center: [106.7600, 21.8500], zoom: 12.0 },
    'Hà Giang': { center: [104.9800, 22.8200], zoom: 12.0 },
    'Tuyên Quang': { center: [105.2200, 21.8200], zoom: 12.0 },
    'Lào Cai': { center: [103.9700, 22.4800], zoom: 12.0 },
    'Yên Bái': { center: [104.8700, 21.7200], zoom: 12.0 },
    'Hòa Bình': { center: [105.3400, 20.8100], zoom: 12.0 },
    'Sơn La': { center: [103.9148, 21.3283], zoom: 11.8 },
    'Điện Biên': { center: [103.0188, 21.3857], zoom: 11.8 },
    'Lai Châu': { center: [103.4582, 22.3964], zoom: 11.8 },
    'Hà Nam': { center: [105.9200, 20.5400], zoom: 12.0 },
    'Nam Định': { center: [106.1700, 20.4300], zoom: 12.0 },
    'Thái Bình': { center: [106.3400, 20.4500], zoom: 12.0 },
    'Ninh Bình': { center: [105.9700, 20.2500], zoom: 12.0 },
    'Thanh Hóa': { center: [105.7852, 19.8067], zoom: 11.8 }
  };

  /**
   * BỘ CHỌN TIÊU ĐIỂM TỈNH THÀNH (DROPDOWN SELECTOR ĐỦ 26 TỈNH MIỀN BẮC)
   */
  function onProvinceDropdownChange(val) {
    if (!mapInstance) return;
    if (!val || val === 'all') {
      jumpToRegion('all');
      closeCurrentPopup();
      const provSel = document.getElementById('ml-province-selector');
      if (provSel) provSel.value = 'all';
      return;
    }

    const tgt = NORTHERN_PROVINCE_TARGETS[val] || (window.ProvinceWeatherLayer && window.ProvinceWeatherLayer.metadata && window.ProvinceWeatherLayer.metadata[val]);
    if (tgt) {
      const center = tgt.center || [tgt.lng, tgt.lat];
      const zoom = tgt.zoom || 10.2;
      mapInstance.flyTo({
        center: center,
        zoom: zoom,
        pitch: currentPitch > 20 ? currentPitch : 0,
        bearing: currentBearing,
        duration: 1200,
        essential: true
      });
      setTimeout(() => {
        showProvinceWeatherPopup(center, val);
      }, 650);

      const provSel = document.getElementById('ml-province-selector');
      if (provSel && provSel.value !== val) provSel.value = val;
    }
  }

  /**
   * ĐIỀU KHIỂN GÓC NGHIÊNG 3D (PITCH)
   */
  function setPitch(deg) {
    if (!mapInstance) return;
    currentPitch = deg;

    // Tự động kích hoạt địa hình 3D nổi khối khi người dùng chọn góc nhìn nghiêng 3D
    if (deg > 0 && layerVisibility.terrain) {
      setup3DTerrainDEM();
    }

    mapInstance.easeTo({ pitch: deg, duration: 1000 });
    updatePitchBadge();

    [0, 45, 60].forEach(p => {
      const btn = document.getElementById(`ml-pitch-${p}`);
      if (btn) {
        if (p === deg) {
          btn.className = 'px-2 py-1 bg-cyan-600 text-white rounded-lg text-[9.5px] font-bold cursor-pointer transition shadow';
        } else {
          btn.className = 'px-2 py-1 bg-transparent hover:bg-slate-800 text-slate-300 rounded-lg text-[9.5px] font-bold cursor-pointer transition';
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
          btn.className = 'px-2 py-1 bg-transparent hover:bg-slate-800 text-slate-300 rounded-lg text-[9.5px] font-bold cursor-pointer transition';
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

      setup3DTerrainDEM();
      setupProvincesVectorLayer();
      setupStormSimulationVectorLayer();
      setupTacticalRouteVectorLayer();
      setupMeasureVectorLayer();
      setup3DBuildingsVectorLayer();
      setupRainRadarVectorLayer();
      setupFloodCirclesVectorLayer();
      syncAllLayers();
      document.querySelectorAll('.maplibregl-ctrl-attrib, .maplibregl-ctrl-bottom-right, .maplibregl-compact, .maplibregl-ctrl-attrib-button').forEach(el => el.remove());

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

  function zoomToProvince(provinceName) {
    if (!mapInstance) return;
    const meta = (window.ProvinceWeatherLayer && window.ProvinceWeatherLayer.metadata && window.ProvinceWeatherLayer.metadata[provinceName]) || null;
    if (meta && meta.lat && meta.lng) {
      mapInstance.flyTo({ center: [meta.lng, meta.lat], zoom: 9.5, duration: 800 });
      return;
    }
  }

  function focusProvinceRegion(provinceName) {
    if (window.ProvinceWeatherLayer && typeof window.ProvinceWeatherLayer.focusProvinceRegion === 'function') {
      window.ProvinceWeatherLayer.focusProvinceRegion(provinceName);
    }
  }

  // =========================================================================
  // C2 GROUND RECONNAISSANCE & DETAILED REGIONAL IMAGERY DATABASE
  // =========================================================================
  const GROUND_RECON_DATABASE = [
    {
      id: 'recon-lang-nu',
      name: 'Thôn Làng Nủ, Xã Phúc Khánh, Bảo Yên, Lào Cai',
      province: 'Lào Cai',
      lng: 104.3400,
      lat: 22.2800,
      elev: 460,
      depth: 'Lũ bùn đất 2 - 3m',
      danger: 'CỰC KỲ NGUY HIỂM',
      source: 'Flycam Drone Trinh Sát Ban Chỉ Huy',
      heading: 140,
      pitch: 65,
      zoom: 16.5,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=700&q=75',
          title: 'Hiện trường sạt lở núi & lũ bùn quét thôn Làng Nủ',
          desc: 'Khu vực thung lũng hứng trọn vệt sạt trượt từ đỉnh núi Voi dài hơn 3.6km. Lực lượng công binh Quân khu 2 đang dò tìm cứu nạn.',
          source: 'Ảnh Viễn Thám Cứu Nạn Drone',
          badge: '🚨 LŨ QUÉT LỊCH SỬ'
        },
        {
          url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=700&q=75',
          title: 'Hạ lưu suối Làng Nủ đổ ra Sông Chảy',
          desc: 'Dòng chảy đục ngầu phù sa và cây cối gãy đổ, các nhịp cầu tạm được công binh dựng lên để tiếp tế.',
          source: 'Tổ Trinh sát Thực địa',
          badge: '⚠️ NƯỚC XIẾT'
        }
      ]
    },
    {
      id: 'recon-sapa-fansipan',
      name: 'Thị Xã Sa Pa & Đỉnh Fansipan 3.143m, Lào Cai',
      province: 'Lào Cai',
      lng: 103.8438,
      lat: 22.3364,
      elev: 1620,
      depth: '0 cm (Núi cao)',
      danger: 'ĐỊA HÌNH DỐC HIỂM TRỞ',
      source: 'Trạm Quan trắc Khí tượng Sa Pa',
      heading: 45,
      pitch: 65,
      zoom: 16.0,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=700&q=75',
          title: 'Dãy Hoàng Liên Sơn & Thung lũng Mường Hoa',
          desc: 'Độ dốc sườn núi lớn trên 45 độ, địa hình phân cắt mạnh. Lượng mưa tích tụ cao dễ gây sạt lở taluy âm các tuyến đường đèo.',
          source: 'Vệ Tinh Quang Học & Trạm Khí Tượng',
          badge: '⛰️ ĐỊA HÌNH 3D CẬN CẢNH'
        }
      ]
    },
    {
      id: 'recon-hanoi-thaiha',
      name: 'Tuyến Phố Thái Hà - Chùa Bộc, Đống Đa, Hà Nội',
      province: 'Hà Nội',
      lng: 105.8215,
      lat: 21.0115,
      elev: 12,
      depth: '35 cm',
      danger: 'NGẬP SÂU ĐÔ THỊ',
      source: 'Camera Giao thông Thông minh C2',
      heading: 200,
      pitch: 60,
      zoom: 17.0,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=700&q=75',
          title: 'Điểm trũng ngập lụt tại ngã tư Thái Hà - Chùa Bộc',
          desc: 'Nước ngập từ 30-45cm ngập nửa bánh xe ô tô con. Đội cơ động 114 đã bố trí xe cẩu và máy bơm chống úng cục bộ.',
          source: 'Camera Giám Sát C2',
          badge: '🚨 NGẬP 35CM'
        }
      ]
    },
    {
      id: 'recon-hanoi-keangnam',
      name: 'Keangnam Landmark 72 & Đường Phạm Hùng, Nam Từ Liêm, Hà Nội',
      province: 'Hà Nội',
      lng: 105.7838,
      lat: 21.0173,
      elev: 14,
      depth: '18 cm',
      danger: 'CẢNH BÁO TẮC NGHẼN',
      source: 'Camera Giao thông C2 & Radar Tác chiến',
      heading: 330,
      pitch: 65,
      zoom: 16.8,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=700&q=75',
          title: 'Tòa tháp Keangnam Landmark 72 (Cao 350m)',
          desc: 'Tòa nhà cao nhất Hà Nội trên trục đường vành đai 3 Phạm Hùng. Điểm mốc tác chiến không phận và trinh sát khí tượng đô thị.',
          source: 'Dữ Liệu Khối Nhà 3D Extrusion',
          badge: '🏙️ CAO 350M'
        }
      ]
    },
    {
      id: 'recon-hanoi-lotte',
      name: 'Lotte Center Hà Nội (Ngã tư Liễu Giai - Đào Tấn), Ba Đình, Hà Nội',
      province: 'Hà Nội',
      lng: 105.8124,
      lat: 21.0333,
      elev: 15,
      depth: '12 cm',
      danger: 'AN TOÀN',
      source: 'Cảm biến IoT Đô thị',
      heading: 110,
      pitch: 65,
      zoom: 16.8,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1477959858617-67f30bc75b82?auto=format&fit=crop&w=700&q=75',
          title: 'Tòa tháp Lotte Center Hà Nội (Cao 272m, 65 tầng)',
          desc: 'Trung tâm quận Ba Đình tiếp giáp hồ Thủ Lệ. Hệ thống cống ngầm thoát nước lưu vực hồ Ngọc Khánh hoạt động ổn định.',
          source: 'Hệ thống Khối nhà 3D',
          badge: '🏙️ CAO 272M'
        }
      ]
    },
    {
      id: 'recon-hanoi-longbien',
      name: 'Cầu Long Biên & Bãi Giữa Sông Hồng, Hoàn Kiếm - Long Biên, Hà Nội',
      province: 'Hà Nội',
      lng: 105.8566,
      lat: 21.0425,
      elev: 16,
      depth: 'Mực nước sông: 11.3m (Báo động 2)',
      danger: 'LŨ SÔNG HỒNG LỚN',
      source: 'Trạm Thủy Văn An Cảnh & C2 Drone',
      heading: 70,
      pitch: 62,
      zoom: 16.2,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=700&q=75',
          title: 'Cầu Long Biên bắc qua lòng Sông Hồng mùa mưa lũ',
          desc: 'Dòng nước phù sa dâng ngập bãi bồi nông nghiệp Phúc Xá và bãi giữa. Lực lượng PCCC & CNCH đã di dời toàn bộ người dân vào bờ an toàn.',
          source: 'Ảnh Flycam Ban Chỉ Huy',
          badge: '🌊 BÁO ĐỘNG LŨ CẤP 2'
        }
      ]
    },
    {
      id: 'recon-hanoi-hoankiem',
      name: 'Hồ Hoàn Kiếm & Trung Tâm Phố Cổ, Hà Nội',
      province: 'Hà Nội',
      lng: 105.8524,
      lat: 21.0285,
      elev: 14,
      depth: '5 cm',
      danger: 'AN TOÀN',
      source: 'Cảm biến Thoát nước Hà Nội',
      heading: 0,
      pitch: 55,
      zoom: 16.5,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=700&q=75',
          title: 'Khu vực Tháp Rùa & Hồ Hoàn Kiếm',
          desc: 'Mực nước mặt hồ được điều tiết ổn định, không ghi nhận ngập úng trên các trục phố Đinh Tiên Hoàng, Tràng Tiền.',
          source: 'Trung Tâm Điều Hành Đô Thị',
          badge: '✓ AN TOÀN'
        }
      ]
    },
    {
      id: 'recon-yenbai-thanhnien',
      name: 'Đường Thanh Niên & Bờ Kè Sông Thao, TP Yên Bái',
      province: 'Yên Bái',
      lng: 104.8720,
      lat: 21.7240,
      elev: 38,
      depth: '210 cm',
      danger: 'NGẬP LỤT ĐẶC BIỆT NGUY HIỂM',
      source: 'Đội Cứu hộ Quân Khu 2',
      heading: 135,
      pitch: 60,
      zoom: 16.5,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=700&q=75',
          title: 'Sông Thao dâng ngập trắng toàn bộ tuyến đường Thanh Niên',
          desc: 'Nước lũ vượt đỉnh lịch sử 35.73m. Xuồng máy và ca-nô đặc chủng là phương tiện duy nhất tiếp cận cứu trợ thực phẩm.',
          source: 'Ảnh Trinh Sát Cứu Hộ',
          badge: '🚨 NGẬP SÂU 2.1M'
        }
      ]
    },
    {
      id: 'recon-thainguyen-giabay',
      name: 'Cầu Gia Bẩy & Lòng Sông Cầu, TP Thái Nguyên',
      province: 'Thái Nguyên',
      lng: 105.8450,
      lat: 21.6020,
      elev: 28,
      depth: '185 cm',
      danger: 'ĐỈNH LŨ LỊCH SỬ',
      source: 'Trạm Thủy Văn Gia Bẩy',
      heading: 80,
      pitch: 60,
      zoom: 16.5,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1498084393753-b411b2d26b34?auto=format&fit=crop&w=700&q=75',
          title: 'Cầu Gia Bẩy ngập sát dầm cầu trong đỉnh lũ Sông Cầu',
          desc: 'Mực nước đo được tại Gia Bẩy đạt 2.881cm, vượt báo động 3 lịch sử năm 1959 là 67cm. Phường Quang Vinh ngập sâu.',
          source: 'Báo Cáo Thực Địa Trạm Khí Tượng',
          badge: '🌊 VƯỢT ĐỈNH LỊCH SỬ 65 NĂM'
        }
      ]
    },
    {
      id: 'recon-phutho-phongchau',
      name: 'Khu Vực Cầu Phong Châu (QL32C Bắc Qua Sông Thao), Phú Thọ',
      province: 'Phú Thọ',
      lng: 105.2890,
      lat: 21.3020,
      elev: 25,
      depth: 'Dòng xiết 4.2m/s',
      danger: 'CỰC KỲ NGUY HIỂM - CẤM QUA LẠI',
      source: 'Lữ đoàn 249 Binh chủng Công binh',
      heading: 210,
      pitch: 62,
      zoom: 16.2,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=700&q=75',
          title: 'Hiện trường sập 2 nhịp dàn Cầu Phong Châu',
          desc: 'Dòng chảy lũ xiết gây xói lở móng trụ cầu T6, T7. Lữ đoàn 249 Công binh đã thiết lập bến phà dã chiến phục vụ nhân dân.',
          source: 'Không Ảnh Flycam Công Binh',
          badge: '⚠️ HIỆN TRƯỜNG KHẨN CẤP'
        }
      ]
    },
    {
      id: 'recon-quangninh-halong',
      name: 'Vịnh Hạ Long & Cảng Tàu Khách Quốc Tế Tuần Châu, Quảng Ninh',
      province: 'Quảng Ninh',
      lng: 107.0100,
      lat: 20.9400,
      elev: 5,
      depth: 'Sóng biển cao 3.5m',
      danger: 'KHU VỰC VEN BIỂN BÃO ĐỔ BỘ',
      source: 'Bộ Chỉ Huy BĐBP Quảng Ninh',
      heading: 150,
      pitch: 58,
      zoom: 15.8,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=700&q=75',
          title: 'Vịnh Hạ Long và Đảo Tuần Châu',
          desc: 'Tâm bão số 3 Yagi đổ bộ trực diện sức gió cấp 14. Toàn bộ tàu bè đã được neo đậu an toàn tại các âu tránh bão.',
          source: 'Bản Đồ Vệ Tinh Hải Đảo',
          badge: '🌊 BỜ BIỂN CẤP BÃO 14'
        }
      ]
    },
    {
      id: 'recon-haiphong-dinhvu',
      name: 'Cụm Cảng Container Đình Vũ & Sông Cấm, Hải Phòng',
      province: 'Hải Phòng',
      lng: 106.7450,
      lat: 20.8520,
      elev: 8,
      depth: 'Nước triều cường + Gió bão',
      danger: 'CẢNH BÁO GIÓ GIẬT CẢNG BIỂN',
      source: 'Cảng Vụ Hàng Hải Hải Phòng',
      heading: 90,
      pitch: 55,
      zoom: 16.0,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=700&q=75',
          title: 'Cảng Container Quốc tế Đình Vũ bên sông Cấm',
          desc: 'Khu vực bốc dỡ hàng hóa chiến lược của miền Bắc. Các cẩu giàn bờ STS đã hạ tải neo giằng ứng phó gió bão giật.',
          source: 'Hệ Thống Camera Giám Sát Cảng Biển',
          badge: '⚓ KHU CẢNG BIỂN'
        }
      ]
    }
  ];

  let activeReconData = null;
  let activeReconTarget = null;
  let isBoostingTerrain = false;

  function findClosestReconEntry(lng, lat) {
    let best = null;
    let minD = Infinity;
    for (const item of GROUND_RECON_DATABASE) {
      const d = Math.hypot(item.lng - lng, item.lat - lat);
      if (d < minD) {
        minD = d;
        best = item;
      }
    }
    if (best && minD < 0.25) {
      return best;
    }
    return {
      id: `recon-dyn-${Date.now()}`,
      name: `Khu vực Tọa độ [${lat.toFixed(4)}°B, ${lng.toFixed(4)}°Đ]`,
      province: 'Miền Bắc',
      lng: lng,
      lat: lat,
      elev: Math.round(15 + Math.abs(lat - 21.0) * 150),
      depth: 'Theo dõi thời gian thực',
      danger: 'KHU VỰC QUAN SÁT CẬN CẢNH',
      source: 'Vệ Tinh Quang Học & Viễn Thám C2',
      heading: 0,
      pitch: 62,
      zoom: 16.5,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=700&q=75',
          title: `Không ảnh trinh sát tọa độ ${lat.toFixed(4)}°B, ${lng.toFixed(4)}°Đ`,
          desc: `Khung nhìn thực địa phân giải cao tại khu vực miền Bắc. Địa hình trắc diện được tái hiện qua mô hình số DEM 3D.`,
          source: 'Vệ Tinh Viễn Thám & SAR',
          badge: '🛰️ KHÔNG ẢNH CẬN CẢNH'
        }
      ]
    };
  }

  function openGroundReconViewer(lng, lat, name) {
    let targetLng = lng;
    let targetLat = lat;
    if (targetLng === undefined || targetLat === undefined) {
      if (mapInstance) {
        const c = mapInstance.getCenter();
        targetLng = c.lng;
        targetLat = c.lat;
      } else {
        targetLng = 105.8542;
        targetLat = 21.0285;
      }
    }

    const reconItem = findClosestReconEntry(targetLng, targetLat);
    activeReconData = reconItem;
    activeReconTarget = { lng: targetLng, lat: targetLat, name: name || reconItem.name };

    const modal = document.getElementById('ground-recon-modal');
    if (!modal) return;

    const locEl = document.getElementById('recon-modal-location');
    if (locEl) locEl.innerText = name || reconItem.name;
    const coordsEl = document.getElementById('recon-modal-coords');
    if (coordsEl) coordsEl.innerText = `${targetLat.toFixed(4)}° N, ${targetLng.toFixed(4)}° E`;
    const elevEl = document.getElementById('recon-modal-elev');
    if (elevEl) elevEl.innerText = `Độ cao: +${reconItem.elev}m ASL`;

    const svLink = document.getElementById('recon-streetview-link');
    if (svLink) {
      svLink.href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${targetLat.toFixed(5)},${targetLng.toFixed(5)}`;
    }

    renderReconPhotos(reconItem);
    switchReconTab('photos');
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }

  function renderReconPhotos(reconItem) {
    const mainImg = document.getElementById('recon-main-img');
    const badgeTag = document.getElementById('recon-badge-tag');
    const srcBadge = document.getElementById('recon-source-badge');
    const titleEl = document.getElementById('recon-img-title');
    const descEl = document.getElementById('recon-img-desc');
    const thumbsContainer = document.getElementById('recon-thumbnails');

    const firstImg = (reconItem.images && reconItem.images[0]) || {};
    const svgFallback = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect width="800" height="450" fill="%230b0f19"/><circle cx="400" cy="225" r="160" stroke="%2338bdf8" stroke-width="2" fill="none" opacity="0.3"/><circle cx="400" cy="225" r="90" stroke="%2338bdf8" stroke-width="1.5" fill="none" opacity="0.4"/><line x1="400" y1="20" x2="400" y2="430" stroke="%2338bdf8" stroke-width="1" opacity="0.3"/><line x1="20" y1="225" x2="780" y2="225" stroke="%2338bdf8" stroke-width="1" opacity="0.3"/><text x="400" y="215" fill="%2338bdf8" font-family="monospace" font-size="20" font-weight="bold" text-anchor="middle">KHÔNG ẢNH TRINH SÁT C2 VIỄN THÁM</text><text x="400" y="245" fill="%2394a3b8" font-family="sans-serif" font-size="14" text-anchor="middle">${encodeURIComponent(reconItem.name)}</text><text x="400" y="275" fill="%2334d399" font-family="monospace" font-size="13" text-anchor="middle">Tọa độ: ${reconItem.lat.toFixed(4)}°N, ${reconItem.lng.toFixed(4)}°E • Độ cao: +${reconItem.elev}m ASL</text></svg>`;

    if (mainImg) {
      mainImg.onerror = () => { mainImg.src = svgFallback; };
      mainImg.src = firstImg.url || svgFallback;
    }
    if (badgeTag) badgeTag.innerText = firstImg.badge || reconItem.danger;
    if (srcBadge) srcBadge.innerText = firstImg.source || reconItem.source;
    if (titleEl) titleEl.innerText = firstImg.title || reconItem.name;
    if (descEl) descEl.innerText = firstImg.desc || '';

    if (thumbsContainer) {
      thumbsContainer.innerHTML = '';
      (reconItem.images || []).forEach((img, idx) => {
        const thumb = document.createElement('div');
        thumb.className = `cursor-pointer rounded-xl overflow-hidden border-2 transition ${idx === 0 ? 'border-cyan-400 scale-102' : 'border-slate-700 opacity-60 hover:opacity-100'} aspect-video bg-slate-950`;
        thumb.innerHTML = `<img src="${img.url}" class="w-full h-full object-cover" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'160\\' height=\\'90\\'><rect width=\\'160\\' height=\\'90\\' fill=\\'%231e293b\\'/><text x=\\'80\\' y=\\'50\\' fill=\\'%2394a3b8\\' font-size=\\'12\\' text-anchor=\\'middle\\'>Ảnh ${idx+1}</text></svg>'" />`;
        thumb.onclick = () => selectReconPhoto(idx);
        thumbsContainer.appendChild(thumb);
      });
    }
  }

  function selectReconPhoto(idx) {
    if (!activeReconData || !activeReconData.images[idx]) return;
    const img = activeReconData.images[idx];
    const mainImg = document.getElementById('recon-main-img');
    const badgeTag = document.getElementById('recon-badge-tag');
    const srcBadge = document.getElementById('recon-source-badge');
    const titleEl = document.getElementById('recon-img-title');
    const descEl = document.getElementById('recon-img-desc');
    const thumbsContainer = document.getElementById('recon-thumbnails');

    if (mainImg) mainImg.src = img.url;
    if (badgeTag) badgeTag.innerText = img.badge;
    if (srcBadge) srcBadge.innerText = img.source;
    if (titleEl) titleEl.innerText = img.title;
    if (descEl) descEl.innerText = img.desc;

    if (thumbsContainer) {
      Array.from(thumbsContainer.children).forEach((child, i) => {
        if (i === idx) {
          child.className = 'cursor-pointer rounded-xl overflow-hidden border-2 border-cyan-400 scale-102 transition aspect-video bg-slate-950';
        } else {
          child.className = 'cursor-pointer rounded-xl overflow-hidden border-2 border-slate-700 opacity-60 hover:opacity-100 transition aspect-video bg-slate-950';
        }
      });
    }
  }

  function closeGroundReconModal() {
    const modal = document.getElementById('ground-recon-modal');
    if (modal) modal.classList.add('hidden');
  }

  function switchReconTab(tabKey) {
    const panes = {
      photos: document.getElementById('recon-pane-photos'),
      streetview: document.getElementById('recon-pane-streetview'),
      satellite: document.getElementById('recon-pane-satellite')
    };
    const btns = {
      photos: document.getElementById('recon-tab-btn-photos'),
      streetview: document.getElementById('recon-tab-btn-streetview'),
      satellite: document.getElementById('recon-tab-btn-satellite')
    };

    Object.keys(panes).forEach(k => {
      if (panes[k]) {
        if (k === tabKey) panes[k].classList.remove('hidden');
        else panes[k].classList.add('hidden');
      }
      if (btns[k]) {
        if (k === tabKey) {
          btns[k].className = 'flex-1 py-2 rounded-xl bg-cyan-600 text-white transition flex items-center justify-center gap-1.5 cursor-pointer shadow';
        } else {
          btns[k].className = 'flex-1 py-2 rounded-xl bg-transparent hover:bg-slate-800 text-slate-300 transition flex items-center justify-center gap-1.5 cursor-pointer';
        }
      }
    });
  }

  function flyToRecon3D() {
    closeGroundReconModal();
    if (!mapInstance || !activeReconData) return;
    const tgt = activeReconTarget || activeReconData;
    mapInstance.flyTo({
      center: [tgt.lng, tgt.lat],
      zoom: activeReconData.zoom || 16.5,
      pitch: activeReconData.pitch || 65,
      bearing: activeReconData.heading || 0,
      duration: 1500,
      essential: true
    });
    if (typeof window.showNorthStarToast === 'function') {
      window.showNorthStarToast(`📐 Chuyển camera tới góc nhìn 3D cận cảnh (Pitch 65°): ${tgt.name}`, 'info', 2500);
    }
  }

  function setReconRouteDestination() {
    closeGroundReconModal();
    if (!activeReconTarget) return;
    setRouteOriginDestination('dest', activeReconTarget.lng, activeReconTarget.lat, activeReconTarget.name);
  }

  function openCurrentViewRecon() {
    if (!mapInstance) return;
    const c = mapInstance.getCenter();
    openGroundReconViewer(c.lng, c.lat);
  }

  function updateDeepZoomHUD() {
    if (!mapInstance) return;
    const z = mapInstance.getZoom();
    const hud = document.getElementById('ml-deep-zoom-hud');
    const badge = document.getElementById('ml-deep-zoom-badge');
    if (hud) {
      if (z >= 15.0) {
        hud.classList.remove('hidden');
        if (badge) badge.innerText = `Z: ${z.toFixed(1)}`;
        if (layerVisibility.terrain && !isBoostingTerrain) {
          isBoostingTerrain = true;
          try {
            mapInstance.setTerrain({ source: 'terrain-dem-source', exaggeration: 2.2 });
          } catch (_) {}
        }
      } else {
        hud.classList.add('hidden');
        if (layerVisibility.terrain && isBoostingTerrain) {
          isBoostingTerrain = false;
          try {
            mapInstance.setTerrain({ source: 'terrain-dem-source', exaggeration: 1.6 });
          } catch (_) {}
        }
      }
    }
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
    zoomToProvince,
    focusProvinceRegion,
    focusIncident,
    syncIntakeMarkers,
    syncSOSMarkers,
    // Ground Reconnaissance & Deep Zoom Features
    openGroundReconViewer,
    openCurrentViewRecon,
    closeGroundReconModal,
    switchReconTab,
    selectReconPhoto,
    flyToRecon3D,
    setReconRouteDestination,
    updateDeepZoomHUD,
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
    openStationPopupById,
    showProvinceWeatherPopup,
    onProvinceDropdownChange,
    dismissViewportAlert,
    closeCurrentPopup,
    closePopup: closeCurrentPopup,
    renderHanoiDistrictMarkers,
    setup3DTerrainDEM,
    getMap: () => mapInstance,
    get map() { return mapInstance; }
  };
})();
