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
 * =================================================
 * FloodNav - Tactical Map Controller & MapLibre GL Core
 * Động cơ: MapLibre GL JS (BSD-3-Clause - OSI Approved Open-Source WebGL)
 * Hiệu năng: 60 FPS GPU-Accelerated GeoJSON Rendering & Clustering
 * =================================================
 */

let map = null;
let mapInstance = null;
let currentBaseLayer = 'dark';
let activeMapLibrePopup = null;

let pickMarkers = { origin: null, destination: null, report: null };
let routeLayers = { safe: true, fastest: true };

let coords = {
  origin: null,
  destination: null,
  report: null
};

let currentPickMode = null; // 'origin' | 'destination' | 'report' | null
let floodPoints = [];
let floodGeoJsonData = { type: 'FeatureCollection', features: [] };
let floodCirclesGeoJson = { type: 'FeatureCollection', features: [] };
let currentRouteGeoJson = {
  safe: { type: 'FeatureCollection', features: [] },
  fastest: { type: 'FeatureCollection', features: [] }
};

const BASEMAP_STYLES = {
  dark: {
    version: 8,
    sources: {
      'base-dark': {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: '&copy; Esri &copy; OpenStreetMap contributors'
      },
      'base-dark-ref': {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256
      }
    },
    layers: [
      { id: 'base-dark-layer', type: 'raster', source: 'base-dark', minzoom: 0, maxzoom: 19 },
      { id: 'base-dark-ref-layer', type: 'raster', source: 'base-dark-ref', minzoom: 0, maxzoom: 19 }
    ]
  },
  satellite: {
    version: 8,
    sources: {
      'base-satellite': {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: '&copy; Esri, Maxar, Earthstar Geographics'
      },
      'base-satellite-ref': {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256
      }
    },
    layers: [
      { id: 'base-sat-layer', type: 'raster', source: 'base-satellite', minzoom: 0, maxzoom: 19 },
      { id: 'base-sat-ref-layer', type: 'raster', source: 'base-satellite-ref', minzoom: 0, maxzoom: 19 }
    ]
  },
  streets: {
    version: 8,
    sources: {
      'base-streets': {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: '&copy; Esri &mdash; World Street Map'
      }
    },
    layers: [
      { id: 'base-streets-layer', type: 'raster', source: 'base-streets', minzoom: 0, maxzoom: 19 }
    ]
  },
  osm: {
    version: 8,
    sources: {
      'base-osm': {
        type: 'raster',
        tiles: ['https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', 'https://b.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors'
      }
    },
    layers: [
      { id: 'base-osm-layer', type: 'raster', source: 'base-osm', minzoom: 0, maxzoom: 19 }
    ]
  }
};

function createClusterIcon(cluster) {
  return '';
}

function syncFloodCirclesWithZoom() {}

function initMap() {
  if (mapInstance) return window.map;

  const container = document.getElementById('map');
  if (!container) return null;

  try {
    mapInstance = new maplibregl.Map({
      container: 'map',
      style: BASEMAP_STYLES.dark,
      center: [105.70, 21.25],
      zoom: 8.2,
      minZoom: 6.5,
      maxZoom: 18.5,
      pitch: 0,
      bearing: 0,
      antialias: true
    });

    // Navigation control
    mapInstance.addControl(new maplibregl.NavigationControl({ visualizePitch: false, showCompass: true }), 'top-right');
    // Scale control
    mapInstance.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

    // Build compatibility facade on window.map
    buildMapCompatibilityFacade();

    mapInstance.on('load', () => {
      setupMapLibreSourcesAndLayers();
      loadFloodPoints();
      checkPostGISConnection();
      loadWeatherInfo();

      if (window.ProvinceWeatherLayer && typeof window.ProvinceWeatherLayer.init === 'function') {
        window.ProvinceWeatherLayer.init(window.map);
      }
      if (window.NorthStarRescue && typeof window.NorthStarRescue.initRescueLayers === 'function') {
        window.NorthStarRescue.initRescueLayers(window.map);
        window.NorthStarRescue.loadDisasters();
        window.NorthStarRescue.loadShelters();
        window.NorthStarRescue.loadSOSBeacons();
      }
      if (window.CommandUIController && typeof window.CommandUIController.init === 'function') {
        window.CommandUIController.init(window.map);
      }
      console.log('✅ [NorthStar MapCore] MapLibre GL JS engine initialized successfully at 60 FPS.');
    });

    mapInstance.on('click', (e) => {
      onMapClick(e);
    });

    return window.map;
  } catch (e) {
    console.error('Failed to initialize MapLibre GL:', e);
    return null;
  }
}

function buildMapCompatibilityFacade() {
  window.map = {
    _maplibre: mapInstance,
    getMap: () => mapInstance,
    getContainer: () => mapInstance ? mapInstance.getContainer() : document.getElementById('map'),

    flyTo: function (target, zoom, options) {
      if (!mapInstance) return;
      if (Array.isArray(target)) {
        mapInstance.flyTo({
          center: [target[1], target[0]],
          zoom: typeof zoom === 'number' ? zoom : 14.5,
          duration: (options && options.duration) ? options.duration * 1000 : 1200
        });
      } else if (typeof target === 'object' && target !== null) {
        if (target.center) {
          mapInstance.flyTo(target);
        } else if (target.lat !== undefined && target.lng !== undefined) {
          mapInstance.flyTo({ center: [target.lng, target.lat], zoom: zoom || 14.5 });
        }
      }
    },

    setView: function (center, zoom) {
      if (!mapInstance) return;
      const c = Array.isArray(center) ? [center[1], center[0]] : [center.lng, center.lat];
      mapInstance.jumpTo({ center: c, zoom: zoom || 11 });
    },

    fitBounds: function (bounds, options) {
      if (!mapInstance || !bounds) return;
      let b = bounds;
      if (bounds.getSouthWest && bounds.getNorthEast) {
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        b = [[sw.lng, sw.lat], [ne.lng, ne.lat]];
      } else if (Array.isArray(bounds) && bounds.length === 2 && Array.isArray(bounds[0])) {
        // Check if [lat, lng] or [lng, lat]
        if (Math.abs(bounds[0][0]) <= 90 && Math.abs(bounds[0][1]) > 90) {
          b = [[bounds[0][1], bounds[0][0]], [bounds[1][1], bounds[1][0]]];
        }
      }
      const pad = (options && options.padding) ? options.padding : 50;
      mapInstance.fitBounds(b, { padding: pad, maxZoom: 16.5, duration: 1000 });
    },

    getZoom: function () {
      return mapInstance ? mapInstance.getZoom() : 8;
    },

    getCenter: function () {
      if (!mapInstance) return { lat: 21.0285, lng: 105.8542, latlng: [21.0285, 105.8542] };
      const c = mapInstance.getCenter();
      return { lat: c.lat, lng: c.lng, latlng: [c.lat, c.lng] };
    },

    getBounds: function () {
      if (!mapInstance) return null;
      const b = mapInstance.getBounds();
      return {
        getSouthWest: () => ({ lat: b.getSouth(), lng: b.getWest() }),
        getNorthEast: () => ({ lat: b.getNorth(), lng: b.getEast() }),
        contains: (coord) => {
          const lng = Array.isArray(coord) ? coord[1] : (coord.lng !== undefined ? coord.lng : coord[1]);
          const lat = Array.isArray(coord) ? coord[0] : (coord.lat !== undefined ? coord.lat : coord[0]);
          return b.contains([lng, lat]);
        }
      };
    },

    invalidateSize: function () {
      if (mapInstance) mapInstance.resize();
    },

    resize: function () {
      if (mapInstance) mapInstance.resize();
    },

    on: function (event, layerOrHandler, handler) {
      if (!mapInstance) return;
      if (typeof layerOrHandler === 'function') {
        mapInstance.on(event, (e) => {
          if (e.lngLat) e.latlng = { lat: e.lngLat.lat, lng: e.lngLat.lng };
          layerOrHandler(e);
        });
      } else {
        mapInstance.on(event, layerOrHandler, (e) => {
          if (e.lngLat) e.latlng = { lat: e.lngLat.lat, lng: e.lngLat.lng };
          handler(e);
        });
      }
    },

    once: function (event, handler) {
      if (!mapInstance) return;
      mapInstance.once(event, (e) => {
        if (e.lngLat) e.latlng = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        handler(e);
      });
    },

    off: function (event, handler) {
      if (!mapInstance) return;
      mapInstance.off(event, handler);
    },

    closePopup: function () {
      if (activeMapLibrePopup) {
        activeMapLibrePopup.remove();
        activeMapLibrePopup = null;
      }
    },

    hasLayer: function () { return true; },
    addLayer: function () {},
    removeLayer: function () {}
  };
  map = window.map;
}

function setupMapLibreSourcesAndLayers() {
  if (!mapInstance) return;

  // 1. Clustered Flood Points Source
  if (!mapInstance.getSource('flood-points')) {
    mapInstance.addSource('flood-points', {
      type: 'geojson',
      data: floodGeoJsonData,
      cluster: true,
      clusterRadius: 45,
      clusterMaxZoom: 14
    });

    // Cluster Circles (GPU rendered)
    mapInstance.addLayer({
      id: 'flood-clusters',
      type: 'circle',
      source: 'flood-points',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#0284c7', // < 6 points: Sky/cyan
          6, '#f59e0b', // 6 - 15 points: Amber
          16, '#ef4444' // > 15 points: Red danger
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          18,
          6, 22,
          16, 26
        ],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.95
      }
    });

    // Cluster Label Count
    mapInstance.addLayer({
      id: 'flood-cluster-count',
      type: 'symbol',
      source: 'flood-points',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 12
      },
      paint: {
        'text-color': '#ffffff'
      }
    });

    // Unclustered Flood Point Outer Ring
    mapInstance.addLayer({
      id: 'flood-unclustered-glow',
      type: 'circle',
      source: 'flood-points',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'case',
          ['>=', ['get', 'depth'], 20], 'rgba(239, 68, 68, 0.35)',
          ['>=', ['get', 'depth'], 5], 'rgba(245, 158, 11, 0.3)',
          'rgba(6, 182, 212, 0.25)'
        ],
        'circle-radius': 14,
        'circle-stroke-width': 1,
        'circle-stroke-color': [
          'case',
          ['>=', ['get', 'depth'], 20], '#ef4444',
          ['>=', ['get', 'depth'], 5], '#f59e0b',
          '#06b6d4'
        ]
      }
    });

    // Unclustered Flood Point Center Dot
    mapInstance.addLayer({
      id: 'flood-unclustered-point',
      type: 'circle',
      source: 'flood-points',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'case',
          ['>=', ['get', 'depth'], 20], '#ef4444',
          ['>=', ['get', 'depth'], 5], '#f59e0b',
          '#0284c7'
        ],
        'circle-radius': 7.5,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Click cluster to expand
    mapInstance.on('click', 'flood-clusters', (e) => {
      const features = mapInstance.queryRenderedFeatures(e.point, { layers: ['flood-clusters'] });
      if (!features.length) return;
      const clusterId = features[0].properties.cluster_id;
      mapInstance.getSource('flood-points').getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        mapInstance.easeTo({
          center: features[0].geometry.coordinates,
          zoom: zoom + 0.5,
          duration: 600
        });
      });
    });

    // Click unclustered point to show popup
    mapInstance.on('click', 'flood-unclustered-point', (e) => {
      if (!e.features || !e.features.length) return;
      const f = e.features[0];
      const p = f.properties;
      showFloodPointMapLibrePopup(p, f.geometry.coordinates);
    });

    mapInstance.on('mouseenter', 'flood-clusters', () => { mapInstance.getCanvas().style.cursor = 'pointer'; });
    mapInstance.on('mouseleave', 'flood-clusters', () => { mapInstance.getCanvas().style.cursor = ''; });
    mapInstance.on('mouseenter', 'flood-unclustered-point', () => { mapInstance.getCanvas().style.cursor = 'pointer'; });
    mapInstance.on('mouseleave', 'flood-unclustered-point', () => { mapInstance.getCanvas().style.cursor = ''; });
  }

  // 2. Safe Route Layer
  if (!mapInstance.getSource('route-safe-source')) {
    mapInstance.addSource('route-safe-source', {
      type: 'geojson',
      data: currentRouteGeoJson.safe
    });
    mapInstance.addLayer({
      id: 'route-safe-layer',
      type: 'line',
      source: 'route-safe-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        'visibility': 'visible'
      },
      paint: {
        'line-color': '#10b981',
        'line-width': 6,
        'line-opacity': 0.95
      }
    });
  }

  // 3. Fastest Route Layer
  if (!mapInstance.getSource('route-fastest-source')) {
    mapInstance.addSource('route-fastest-source', {
      type: 'geojson',
      data: currentRouteGeoJson.fastest
    });
    mapInstance.addLayer({
      id: 'route-fastest-layer',
      type: 'line',
      source: 'route-fastest-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        'visibility': 'visible'
      },
      paint: {
        'line-color': '#dc2626',
        'line-width': 5,
        'line-dasharray': [3, 2],
        'line-opacity': 0.9
      }
    });
  }
}

function showFloodPointMapLibrePopup(p, lngLat) {
  if (activeMapLibrePopup) {
    activeMapLibrePopup.remove();
    activeMapLibrePopup = null;
  }

  const id = p.id;
  const name = p.name || p.location || 'Điểm quan trắc';
  const depth = parseFloat(p.depth !== undefined ? p.depth : p.depth_cm || 0);
  const threshold_cm = parseFloat(p.threshold_cm || 20);
  const status = p.status || (depth >= threshold_cm ? 'danger' : (depth >= 5 ? 'warning' : 'safe'));
  const lat = lngLat[1];
  const lng = lngLat[0];

  const districtName = getStationLocationDisplay(name, lat, lng);
  const statusBadge = getRiskBadge(depth, null, depth >= threshold_cm);

  const cachedAi = aiPredictionsCache ? aiPredictionsCache[id] : null;
  const aiHtml = cachedAi ? renderAiForecastHtml(cachedAi, threshold_cm) : renderAiLoadingHtml();
  const drainageHtml = renderDrainageForecastHtml(p);

  const html = `
    <div class="text-xs space-y-2 p-1 min-w-[290px] max-w-[330px] font-sans text-slate-100 select-none">
      <div class="border-b border-slate-700/80 pb-1.5 flex items-start justify-between gap-1.5">
        <div>
          <h4 class="font-extrabold text-sm text-white">${name}</h4>
          <div class="text-[11px] text-slate-400 mt-0.5">📍 ${districtName}</div>
        </div>
        <div>${statusBadge}</div>
      </div>

      <div class="bg-slate-900/80 rounded-lg p-2.5 border border-slate-800 flex items-center justify-between">
        <div>
          <span class="text-[10px] uppercase font-bold text-slate-400 block">Mực nước</span>
          <span class="text-2xl font-black ${depth >= 20 ? 'text-rose-400' : (depth >= 5 ? 'text-amber-400' : 'text-emerald-400')}">${Math.round(depth)}</span>
          <span class="text-xs font-bold text-slate-400">cm</span>
        </div>
        <div class="text-right">
          <span class="text-[10px] uppercase font-bold text-slate-400 block">Ngưỡng tràn</span>
          <span class="text-sm font-bold text-slate-300 font-mono">${threshold_cm} cm</span>
        </div>
      </div>

      <div id="ai-forecast-container-${id}">
        ${aiHtml}
      </div>

      <div>${drainageHtml}</div>

      <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <button onclick="setAsRouteTarget(${lng}, ${lat}, 'origin')" class="flex-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-[10.5px] font-bold border border-slate-700 cursor-pointer transition">
          🚩 Điểm Đi
        </button>
        <button onclick="setAsRouteTarget(${lng}, ${lat}, 'destination')" class="flex-1 py-1 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10.5px] font-bold cursor-pointer transition shadow-xs">
          🎯 Điểm Đến
        </button>
      </div>
    </div>
  `;

  activeMapLibrePopup = new maplibregl.Popup({
    className: 'flood-custom-popup',
    maxWidth: '340px',
    closeButton: true,
    closeOnClick: true
  })
    .setLngLat(lngLat)
    .setHTML(html)
    .addTo(mapInstance);
}

function switchBaseLayer(type) {
  if (!mapInstance || !BASEMAP_STYLES[type]) return;
  currentBaseLayer = type;
  mapInstance.setStyle(BASEMAP_STYLES[type]);

  mapInstance.once('style.load', () => {
    setupMapLibreSourcesAndLayers();
    if (window.ProvinceWeatherLayer && typeof window.ProvinceWeatherLayer.init === 'function') {
      window.ProvinceWeatherLayer.init(window.map);
    }
    if (window.NorthStarRescue && typeof window.NorthStarRescue.initRescueLayers === 'function') {
      window.NorthStarRescue.initRescueLayers(window.map);
      window.NorthStarRescue.loadDisasters();
      window.NorthStarRescue.loadShelters();
      window.NorthStarRescue.loadSOSBeacons();
    }
    renderFloodPoints(floodPoints);
  });
}
window.switchBaseLayer = switchBaseLayer;


async function loadFloodPoints() {
  const loadingEl = document.getElementById('summary-loading-view');
  const errorEl = document.getElementById('summary-error-view');
  const contentEl = document.getElementById('summary-content-view');

  try {
    const res = await fetch(getApiUrl('/api/flood-points'));
    if (!res.ok) {
      throw new Error(`Mã phản hồi HTTP: ${res.status}`);
    }
    const geojson = await res.json();
    renderFloodPoints(geojson);
  } catch (err) {
    console.error('Lỗi tải danh sách điểm ngập:', err);
    if (loadingEl) loadingEl.classList.add('hidden');
    if (contentEl) contentEl.classList.add('hidden');
    if (errorEl) {
      errorEl.classList.remove('hidden');
      const errP = errorEl.querySelector('p');
      if (errP) errP.innerText = `Lỗi kết nối máy chủ: ${err.message || 'Không thể lấy dữ liệu'}.`;
    }
  }
}

function formatReadingTime(isoStr) {
  if (!isoStr) return 'Chưa có bản ghi';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${hours}:${mins} ${day}/${month}/${year}`;
  } catch (e) {
    return isoStr;
  }
}

// Tính toán số liệu thống kê tình hình ngập từ dữ liệu trạm quan trắc thực tế
function getFloodStats() {
  const points = window.floodPoints || [];
  if (!points || points.length === 0) {
    return null;
  }

  let validCount = 0;
  let safeCount = 0;
  let warningCount = 0;
  let dangerCount = 0;
  let offlineCount = 0;
  let noDataCount = 0;
  let staleCount = 0;
  let latestTime = null;

  points.forEach(p => {
    const hasValidDepth = (p.depth_cm !== null && p.depth_cm !== undefined && !isNaN(Number(p.depth_cm)));
    const isOffline = p.status === 'offline';
    const isNoData = p.status === 'no_data' || !hasValidDepth;
    const isInvalid = p.status === 'invalid';
    const isStale = p.status === 'stale';

    if (p.last_reading_at) {
      const t = new Date(p.last_reading_at);
      if (!isNaN(t.getTime()) && (!latestTime || t > latestTime)) {
        latestTime = t;
      }
    }

    if (isOffline) {
      offlineCount++;
    } else if (isNoData || isInvalid) {
      noDataCount++;
    } else if (isStale) {
      staleCount++;
    } else {
      validCount++;
      const depth = Number(p.depth_cm);
      if (depth < 5) {
        safeCount++;
      } else if (depth < 20) {
        warningCount++;
      } else {
        dangerCount++;
      }
    }
  });

  return {
    total: points.length,
    valid: validCount,
    safe: safeCount,
    warning: warningCount,
    danger: dangerCount,
    offline: offlineCount,
    noData: noDataCount,
    stale: staleCount,
    latestTime: latestTime ? latestTime.toISOString() : null
  };
}

// Cập nhật giao diện Tóm tắt tình hình ngập ở Sidebar (trước khi tìm đường)
function updateSidebarFloodSummary() {
  const loadingEl = document.getElementById('summary-loading-view');
  const errorEl = document.getElementById('summary-error-view');
  const contentEl = document.getElementById('summary-content-view');
  if (!contentEl) return;

  const stats = getFloodStats();
  if (!stats) {
    if (loadingEl) loadingEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    return;
  }

  if (loadingEl) loadingEl.classList.add('hidden');
  if (errorEl) errorEl.classList.add('hidden');
  contentEl.classList.remove('hidden');

  const safeEl = document.getElementById('sum-count-safe');
  const warnEl = document.getElementById('sum-count-warning');
  const dangEl = document.getElementById('sum-count-danger');
  const ratioEl = document.getElementById('sum-valid-ratio');
  const timeEl = document.getElementById('sum-last-update');
  const badgeEl = document.getElementById('summary-badge-status');
  const staleNoteEl = document.getElementById('sum-stale-note');
  const staleCountEl = document.getElementById('sum-stale-count');

  if (safeEl) safeEl.innerText = stats.safe;
  if (warnEl) warnEl.innerText = stats.warning;
  if (dangEl) dangEl.innerText = stats.danger;
  if (ratioEl) ratioEl.innerText = `${stats.valid} / ${stats.total} trạm`;

  const staleTotal = stats.offline + stats.noData + (stats.stale || 0);
  if (staleNoteEl && staleCountEl) {
    if (staleTotal > 0) {
      staleNoteEl.classList.remove('hidden');
      const parts = [];
      if (stats.stale > 0) parts.push(`${stats.stale} dữ liệu cũ`);
      if (stats.offline > 0) parts.push(`${stats.offline} mất kết nối`);
      if (stats.noData > 0) parts.push(`${stats.noData} chưa có DL`);
      staleCountEl.innerText = `${staleTotal} trạm (${parts.join(', ')})`;
    } else {
      staleNoteEl.classList.add('hidden');
    }
  }

  if (timeEl) {
    timeEl.innerText = stats.latestTime ? formatReadingTime(stats.latestTime) : 'Chưa có bản ghi';
  }

  if (badgeEl) {
    if (stats.danger > 0) {
      badgeEl.innerText = `${stats.danger} điểm ngập sâu`;
      badgeEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300';
    } else if (stats.warning > 0) {
      badgeEl.innerText = `${stats.warning} điểm chú ý`;
      badgeEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300';
    } else {
      badgeEl.innerText = 'Bình thường';
      badgeEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300';
    }
  }

  if (window.lucide) lucide.createIcons();
}

// ============================================================================
// KHU VỰC QUẢN LÝ DỰ ĐOÁN NGẬP BẰNG AI (Router /api/predictions)
// ============================================================================
let aiPredictionsCache = null;
window.aiPredictionsCache = null;
let aiPredictionsLoading = false;
let aiPredictionsError = false;

// Đánh giá mức độ rủi ro theo tiêu chuẩn màu sắc và ngưỡng ngập của FloodNav
function getRiskBadge(depth, riskScore, exceedsThreshold) {
  if (exceedsThreshold || depth >= 20 || riskScore >= 0.7) {
    return {
      label: 'Nguy hiểm',
      colorClass: 'text-rose-600',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-200'
    };
  } else if (depth >= 5 || riskScore >= 0.25) {
    return {
      label: 'Chú ý',
      colorClass: 'text-amber-600',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200'
    };
  } else {
    return {
      label: 'An toàn',
      colorClass: 'text-emerald-600',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    };
  }
}

function renderAiLoadingHtml() {
  return `
    <div class="bg-indigo-50/60 rounded-lg p-2 border border-indigo-100 text-[10px]">
      <div class="flex items-center justify-between text-indigo-900 font-bold">
        <span class="flex items-center gap-1">
          <svg class="w-3.5 h-3.5 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
          DỰ ĐOÁN NGẬP BẰNG AI
        </span>
        <span class="text-[9px] text-indigo-600 font-normal">Đang nạp...</span>
      </div>
    </div>
  `;
}

function renderAiErrorHtml() {
  return `
    <div class="bg-rose-50/70 rounded-lg p-2 border border-rose-200 text-[10px]">
      <div class="flex items-center justify-between text-rose-900 font-bold mb-1">
        <span class="flex items-center gap-1">
          <svg class="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          DỰ ĐOÁN NGẬP BẰNG AI
        </span>
        <span class="text-[9px] text-rose-600 bg-rose-100 px-1.5 py-0.2 rounded border border-rose-200">Lỗi nạp</span>
      </div>
      <p class="text-[10px] text-rose-700">Không thể tải dữ liệu dự đoán</p>
    </div>
  `;
}

function renderAiForecastHtml(pred, threshold_cm) {
  if (!pred || !pred.forecast_30m || !pred.forecast_60m) {
    return `
      <div class="bg-slate-50 rounded-lg p-2 border border-slate-200 text-[10px]">
        <div class="flex items-center justify-between text-slate-700 font-bold mb-1">
          <span class="flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            DỰ ĐOÁN NGẬP BẰNG AI
          </span>
          <span class="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Đang chờ tính toán</span>
        </div>
        <p class="text-[10px] text-slate-500 italic">Đang cập nhật mô hình hồi quy thủy văn...</p>
      </div>
    `;
  }

  const f30 = pred.forecast_30m;
  const f60 = pred.forecast_60m;
  const risk30 = getRiskBadge(f30.predicted_depth_cm, f30.risk_score, f30.exceeds_threshold);
  const risk60 = getRiskBadge(f60.predicted_depth_cm, f60.risk_score, f60.exceeds_threshold);

  return `
    <div class="bg-indigo-50/70 rounded-lg p-2.5 border border-indigo-100">
      <div class="flex items-center justify-between pb-1.5 border-b border-indigo-100">
        <div class="flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
          <span class="text-[10.5px] font-bold text-indigo-900 tracking-wider uppercase">Dự đoán ngập bằng AI</span>
        </div>
        <span class="text-[9.5px] font-semibold text-indigo-600 bg-indigo-100/80 px-2 py-0.5 rounded-full border border-indigo-200">
          Đã cập nhật
        </span>
      </div>

      <div class="grid grid-cols-2 gap-2 mt-2">
        <!-- Cột 30 phút -->
        <div class="bg-white/95 rounded-lg p-2 border border-indigo-100 text-center shadow-xs">
          <span class="text-[10px] text-slate-500 font-medium block">Sau 30 phút</span>
          <div class="flex items-baseline justify-center gap-0.5 my-0.5">
            <span class="text-base font-black ${risk30.colorClass}">${f30.predicted_depth_cm}</span>
            <span class="text-[10px] font-bold text-slate-500">cm</span>
          </div>
          <div class="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold border ${risk30.badgeClass}">
            ${risk30.label}
          </div>
          <div class="text-[9.5px] text-slate-400 mt-0.5">Chỉ số rủi ro: ${Number(f30.risk_score).toFixed(2)}</div>
        </div>

        <!-- Cột 60 phút -->
        <div class="bg-white/95 rounded-lg p-2 border border-indigo-100 text-center shadow-xs">
          <span class="text-[10px] text-slate-500 font-medium block">Sau 60 phút</span>
          <div class="flex items-baseline justify-center gap-0.5 my-0.5">
            <span class="text-base font-black ${risk60.colorClass}">${f60.predicted_depth_cm}</span>
            <span class="text-[10px] font-bold text-slate-500">cm</span>
          </div>
          <div class="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold border ${risk60.badgeClass}">
            ${risk60.label}
          </div>
          <div class="text-[9.5px] text-slate-400 mt-0.5">Chỉ số rủi ro: ${Number(f60.risk_score).toFixed(2)}</div>
        </div>
      </div>

      <p class="text-[9.5px] text-indigo-700/80 mt-1.5 text-center leading-normal break-words px-1">
        * Dự báo xu thế theo mô hình thủy văn &amp; lượng mưa Open-Meteo
      </p>
    </div>
  `;
}

function updateOpenPopupAi() {
  const containers = document.querySelectorAll('[data-ai-point-id]');
  containers.forEach(el => {
    const pointId = parseInt(el.getAttribute('data-ai-point-id'), 10);
    const threshold = parseFloat(el.getAttribute('data-threshold')) || 20;
    const parent = el.closest('.flood-custom-popup') || el.parentElement;
    const drainageContainer = parent ? (parent.querySelector(`#popup-drainage-forecast-${pointId}`) || parent.querySelector('[data-drainage-point-id]')) : null;

    if (aiPredictionsError) {
      el.innerHTML = renderAiErrorHtml();
    } else if (aiPredictionsCache) {
      const pred = aiPredictionsCache[pointId];
      el.innerHTML = renderAiForecastHtml(pred, threshold);
      if (drainageContainer && pred) {
        drainageContainer.innerHTML = renderDrainageForecastHtml(pred);
      }
    }
  });
}

async function fetchAiPredictions(forceRefresh = false, rainfallMm = null) {
  if (!forceRefresh && aiPredictionsCache !== null) return aiPredictionsCache;
  if (aiPredictionsLoading) return;
  aiPredictionsLoading = true;
  aiPredictionsError = false;

  try {
    const query = (rainfallMm !== null && rainfallMm !== undefined) ? `?rainfall_mm=${encodeURIComponent(rainfallMm)}` : '';
    const res = await fetch(getApiUrl(`/api/predictions${query}`));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      aiPredictionsCache = {};
      data.forEach(item => {
        if (item && item.point_id !== undefined) {
          aiPredictionsCache[item.point_id] = item;
        }
      });
      window.aiPredictionsCache = aiPredictionsCache;
      aiPredictionsError = false;
    } else {
      aiPredictionsCache = {};
      window.aiPredictionsCache = {};
    }
    updateOpenPopupAi();
    return aiPredictionsCache;
  } catch (err) {
    console.warn("Lỗi tải dữ liệu dự đoán AI:", err);
    aiPredictionsError = true;
    updateOpenPopupAi();
    return null;
  } finally {
    aiPredictionsLoading = false;
  }
}

window.fetchAiPredictions = fetchAiPredictions;
window.updateOpenPopupAi = updateOpenPopupAi;

function handlePopupOpen(e) {
  const popup = e.popup;
  if (!popup) return;
  const el = popup.getElement();
  if (!el) return;
  const aiContainer = el.querySelector('[data-ai-point-id]');
  if (!aiContainer) return;

  const pointId = parseInt(aiContainer.getAttribute('data-ai-point-id'), 10);
  const threshold = parseFloat(aiContainer.getAttribute('data-threshold')) || 20;
  const drainageContainer = el.querySelector(`#popup-drainage-forecast-${pointId}`) || el.querySelector('[data-drainage-point-id]');

  if (aiPredictionsCache) {
    const pred = aiPredictionsCache[pointId];
    aiContainer.innerHTML = renderAiForecastHtml(pred, threshold);
    if (drainageContainer && pred) {
      drainageContainer.innerHTML = renderDrainageForecastHtml(pred);
    }
  } else if (aiPredictionsError) {
    aiContainer.innerHTML = renderAiErrorHtml();
  } else if (!aiPredictionsLoading) {
    aiContainer.innerHTML = renderAiLoadingHtml();
    fetchAiPredictions();
  }
}

// ============================================================================
// KHU VỰC DỰ ĐOÁN THỜI GIAN NƯỚC RÚT & XU HƯỚNG MỰC NƯỚC
// ============================================================================
function renderDrainageForecastHtml(fp) {
  // Trích xuất xu hướng và thời gian nước rút từ API (hỗ trợ cả cấu trúc phẳng lẫn object lồng nhau)
  const trend = (fp && (fp.water_trend || (fp.drainage_forecast && fp.drainage_forecast.water_trend))) || null;
  const drainTime = (fp && (fp.estimated_drainage_time || (fp.drainage_forecast && fp.drainage_forecast.estimated_drainage_time))) || null;
  const depth = (fp && (fp.depth_cm !== undefined && fp.depth_cm !== null ? Number(fp.depth_cm) : (fp.current_depth_cm !== undefined && fp.current_depth_cm !== null ? Number(fp.current_depth_cm) : null)));
  const isCurrentlyFlooded = (depth !== null && depth >= 5);

  let trendLabel = 'Chưa xác định';
  let trendClass = 'text-slate-700';
  let trendDot = 'bg-slate-400';

  if (trend === 'rising') {
    trendLabel = 'Đang tăng';
    trendClass = 'text-rose-600';
    trendDot = 'bg-rose-500';
  } else if (trend === 'falling') {
    trendLabel = 'Đang giảm';
    trendClass = 'text-cyan-600';
    trendDot = 'bg-cyan-500';
  } else if (trend === 'stable') {
    trendLabel = 'Ổn định';
    trendClass = 'text-emerald-600';
    trendDot = 'bg-emerald-500';
  }

  const isSupported = Boolean(trend || drainTime);

  // Nếu điểm không ngập và không có thời gian rút phức tạp -> hiển thị gọn 1 dòng thanh lịch
  if (!isCurrentlyFlooded && (!drainTime || drainTime.includes('Không ngập') || drainTime.includes('Đã cạn') || !isSupported)) {
    return `
      <div class="bg-slate-50/80 rounded-lg px-2.5 py-1.5 border border-slate-200/80 flex items-center justify-between text-[11px]">
        <div class="flex items-center gap-1.5 text-slate-600 font-medium">
          <svg class="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
          </svg>
          <span>Dự đoán nước rút:</span>
        </div>
        <span class="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
          ${drainTime || 'Đã cạn / Không ngập (< 5cm)'}
        </span>
      </div>
    `;
  }

  // Trường hợp đang ngập hoặc có dự báo chi tiết -> hiển thị đầy đủ 2 cột
  const drainTimeDisplay = drainTime || 'Đang phân tích...';
  const statusBadge = isSupported 
    ? '<span class="text-[9.5px] font-semibold text-cyan-700 bg-cyan-100/70 px-2 py-0.5 rounded-full border border-cyan-200">Đã cập nhật</span>'
    : '<span class="text-[9.5px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">Chờ dữ liệu đo</span>';

  return `
    <div class="bg-slate-50/90 rounded-lg p-2.5 border border-slate-200">
      <div class="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
        <div class="flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
          </svg>
          <span class="text-[10.5px] font-bold text-slate-800 tracking-wider uppercase">Dự đoán nước rút</span>
        </div>
        ${statusBadge}
      </div>

      <div class="grid grid-cols-2 gap-2 mt-2">
        <!-- Xu hướng mực nước -->
        <div class="bg-white rounded-lg p-2 border border-slate-200/80 shadow-xs">
          <span class="text-[10px] text-slate-500 font-medium block">Xu hướng mực nước</span>
          <div class="mt-1 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full ${trendDot} flex-shrink-0"></span>
            <span class="text-xs font-bold ${trendClass}">${trendLabel}</span>
          </div>
          <p class="text-[9.5px] text-slate-400 mt-0.5 leading-tight">${isSupported ? 'Dự báo theo mô hình AI' : 'Cần chuỗi đo lịch sử'}</p>
        </div>

        <!-- Thời gian nước rút dự kiến -->
        <div class="bg-white rounded-lg p-2 border border-slate-200/80 shadow-xs">
          <span class="text-[10px] text-slate-500 font-medium block">Thời gian nước rút</span>
          <div class="mt-1">
            <span class="text-[11px] font-bold ${drainTime ? 'text-cyan-700' : 'text-slate-600'} block leading-tight">
              ${drainTimeDisplay}
            </span>
          </div>
          <p class="text-[9.5px] text-slate-400 mt-0.5 leading-tight">${isSupported ? 'Về ngưỡng an toàn (< 5cm)' : 'Chưa có mô hình tính'}</p>
        </div>
      </div>
    </div>
  `;
}

// Helper nhận diện địa bàn hiển thị chính xác (Hà Nội, các quận huyện, hoặc tỉnh thành miền Bắc)
function getStationLocationDisplay(name, lat, lng) {
  if (!name) return 'Hà Nội';

  // Nhận diện theo từ khóa các tỉnh / thành miền Bắc
  const northernProvinces = [
    'Lào Cai', 'Yên Bái', 'Thái Nguyên', 'Bắc Giang', 'Cao Bằng', 
    'Phú Thọ', 'Quảng Ninh', 'Hải Phòng', 'Hòa Bình', 'Tuyên Quang',
    'Lạng Sơn', 'Bắc Kạn', 'Hà Giang', 'Sơn La', 'Điện Biên', 
    'Lai Châu', 'Nam Định', 'Ninh Bình', 'Thái Bình', 'Hà Nam', 
    'Hưng Yên', 'Hải Dương', 'Vĩnh Phúc', 'Bắc Ninh'
  ];

  for (const prov of northernProvinces) {
    if (name.includes(prov)) {
      const match = name.match(/\((.*?)\)/);
      if (match && match[1]) {
        const inside = match[1];
        if (inside.includes(prov)) {
          return inside; // VD: "Lào Cai - Sông Hồng", "Phổ Yên - Thái Nguyên"
        }
        return `${inside}, ${prov}`;
      }
      return prov;
    }
  }

  // Điểm mốc đặc biệt
  if (name.includes('Làng Nủ') || name.includes('Bảo Yên')) return 'Bảo Yên, Lào Cai';
  if (name.includes('Phong Châu') || name.includes('Tam Nông')) return 'Tam Nông, Phú Thọ';
  if (name.includes('Nguyên Bình')) return 'Nguyên Bình, Cao Bằng';

  // Nhận diện nếu có tên huyện/quận trong ngoặc
  const match = name.match(/\((.*?)\)/);
  if (match && match[1]) {
    const inside = match[1];
    if (inside.includes('Hà Nội')) return inside;
    // Nếu trong ngoặc là tên sông hoặc hồ chứa
    if (inside.startsWith('Sông ') || inside.startsWith('Kênh ') || inside.startsWith('Hồ ')) {
      return `Lưu vực ${inside}`;
    }
    return `${inside}, Hà Nội`;
  }

  // Nhận diện theo tên các quận huyện phổ biến của Hà Nội
  const hanoiDistricts = [
    'Ba Đình', 'Hoàn Kiếm', 'Tây Hồ', 'Long Biên', 'Cầu Giấy', 'Đống Đa', 'Hai Bà Trưng', 
    'Hoàng Mai', 'Thanh Xuân', 'Sóc Sơn', 'Đông Anh', 'Gia Lâm', 'Nam Từ Liêm', 'Thanh Trì', 
    'Bắc Từ Liêm', 'Mê Linh', 'Hà Đông', 'Sơn Tây', 'Ba Vì', 'Phúc Thọ', 'Đan Phượng', 
    'Hoài Đức', 'Quốc Oai', 'Thạch Thất', 'Chương Mỹ', 'Thanh Oai', 'Thường Tín', 'Phú Xuyên', 
    'Ứng Hòa', 'Mỹ Đức', 'Tiên Dương', 'Nhật Tân'
  ];

  for (const dist of hanoiDistricts) {
    if (name.includes(dist)) {
      return `${dist}, Hà Nội`;
    }
  }

  return 'Hà Nội';
}

function renderFloodPoints(data) {
  floodPoints = data || [];
  window.floodPoints = floodPoints;

  const features = [];
  floodPoints.forEach(fp => {
    const lat = parseFloat(fp.lat || (fp.geometry && fp.geometry.coordinates[1]) || fp.latitude);
    const lng = parseFloat(fp.lng || (fp.geometry && fp.geometry.coordinates[0]) || fp.longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    const depth = parseFloat(fp.depth_cm !== undefined ? fp.depth_cm : (fp.depth !== undefined ? fp.depth : fp.current_depth_cm || 0));
    const threshold_cm = parseFloat(fp.threshold_cm || 20);
    const status = fp.status || (depth >= threshold_cm ? 'danger' : (depth >= 5 ? 'warning' : 'safe'));

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      properties: {
        id: fp.id || Math.floor(Math.random() * 100000),
        name: fp.name || fp.location || 'Điểm đo ngập',
        depth: depth,
        threshold_cm: threshold_cm,
        status: status,
        location: fp.location || fp.name || '',
        sensor_id: fp.sensor_id || '',
        last_reading_at: fp.last_reading_at || new Date().toISOString(),
        water_trend: fp.water_trend || 'stable',
        estimated_drainage_time: fp.estimated_drainage_time || null
      }
    });
  });

  floodGeoJsonData = {
    type: 'FeatureCollection',
    features: features
  };

  if (mapInstance && mapInstance.getSource('flood-points')) {
    mapInstance.getSource('flood-points').setData(floodGeoJsonData);
  }

  updateSidebarFloodSummary();
  updateViewportFloodAlert();
  renderPointsList();
}

function setAsRouteTarget(lng, lat, type) {

  if (type === 'origin') {

    coords.origin = { lng, lat };

    document.getElementById('origin-text').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    updatePickMarker('origin', lat, lng, '#10b981', 'Điểm xuất phát');

  } else {

    coords.destination = { lng, lat };

    document.getElementById('dest-text').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    updatePickMarker('destination', lat, lng, '#ef4444', 'Điểm đến');

  }

  map.closePopup();

  switchTab('route');

}



// 3. Render danh sách điểm ngập ở Tab 2 (Ưu tiên điểm trong khung nhìn bản đồ)
function renderPointsList() {
  const container = document.getElementById('points-list');
  if (!container) return;
  container.innerHTML = '';

  const bounds = map ? map.getBounds() : null;
  const inViewCount = bounds ? floodPoints.filter(fp => bounds.contains([fp.lat, fp.lng])).length : floodPoints.length;
  const summaryEl = document.getElementById('points-viewport-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `<i data-lucide="eye" class="w-3.5 h-3.5 text-blue-600 inline-block mr-1"></i> Trong khung nhìn: <b>${inViewCount}</b> / ${floodPoints.length} điểm`;
  }

  // Sắp xếp: Điểm trong khung nhìn lên trước, kế tiếp ưu tiên nguy hiểm / chú ý / an toàn / mất tín hiệu
  const sortedPoints = [...floodPoints].sort((a, b) => {
    const aInView = bounds ? bounds.contains([a.lat, a.lng]) : false;
    const bInView = bounds ? bounds.contains([b.lat, b.lng]) : false;
    if (aInView && !bInView) return -1;
    if (!aInView && bInView) return 1;

    const rank = s => (s === 'danger' ? 4 : s === 'warning' ? 3 : s === 'safe' ? 2 : 1);
    const rDiff = rank(b.status) - rank(a.status);
    if (rDiff !== 0) return rDiff;

    return (Number(b.depth_cm) || 0) - (Number(a.depth_cm) || 0);
  });

  sortedPoints.forEach(fp => {
    const { id, name, depth_cm, threshold_cm, status, lat, lng } = fp;
    const hasValidDepth = (depth_cm !== null && depth_cm !== undefined && !isNaN(Number(depth_cm)));
    const depth = hasValidDepth ? Number(depth_cm) : null;
    const isInView = bounds ? bounds.contains([lat, lng]) : true;

    let badgeBg = 'bg-emerald-100 text-emerald-800';
    let badgeText = 'An toàn';
    if (status === 'no_data' || !hasValidDepth) {
      badgeBg = 'bg-slate-100 text-slate-700 border border-slate-300';
      badgeText = 'Chưa có DL';
    } else if (status === 'offline') {
      badgeBg = 'bg-slate-200 text-slate-800 border border-slate-400';
      badgeText = 'Mất kết nối';
    } else if (status === 'invalid') {
      badgeBg = 'bg-rose-100 text-rose-800 border border-rose-300';
      badgeText = 'Dữ liệu lỗi';
    } else if (status === 'stale') {
      badgeBg = 'bg-amber-100 text-amber-900 border border-amber-300';
      badgeText = 'Dữ liệu cũ';
    } else if (status === 'warning') {
      badgeBg = 'bg-amber-100 text-amber-800';
      badgeText = 'Chú ý';
    } else if (status === 'danger') {
      badgeBg = 'bg-rose-100 text-rose-800';
      badgeText = 'Nguy hiểm';
    }

    const inViewBadge = isInView ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">Khung nhìn</span>' : '';

    const div = document.createElement('div');
    div.className = `p-3 bg-white rounded-xl border ${isInView ? 'border-blue-300 shadow-sm' : 'border-slate-200 opacity-80'} space-y-2 hover:border-blue-500 transition`;

    const sliderVal = hasValidDepth ? depth : 0;
    const depthText = hasValidDepth ? `${depth}cm` : '--';

    div.innerHTML = `
      <div class="flex items-center justify-between gap-1">
        <h4 class="font-bold text-xs text-slate-800 cursor-pointer hover:text-blue-600 truncate flex-1" onclick="flyToPoint(${lat}, ${lng})" title="Nhấp để chuyển tới điểm này">
          ${name}
        </h4>
        <div class="flex items-center gap-1 flex-shrink-0">
          ${inViewBadge}
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeBg}">${badgeText}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[11px] text-slate-500">Mực nước:</span>
        <input type="range" min="0" max="60" value="${sliderVal}" 
               class="flex-1 accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
               onchange="updateSensorDepth(${id}, this.value)"
               oninput="this.nextElementSibling.innerText = this.value + 'cm'">
        <span class="text-[11px] font-mono w-10 text-right font-bold text-slate-700">${depthText}</span>
      </div>
    `;

    container.appendChild(div);
  });

  if (window.lucide) lucide.createIcons();
}



// 3.1. Cảnh báo điểm ngập theo khung nhìn hiện tại (Viewport Alert Controller)

let lastVoiceViewportAlertTime = 0;

let viewportAlertTargetPoint = null;



function onViewportAlertClick() {

  if (viewportAlertTargetPoint && map) {

    map.flyTo([viewportAlertTargetPoint.lat, viewportAlertTargetPoint.lng], 15, { duration: 1 });

  }

}



const NORTHERN_REGIONAL_PRESETS = {
  all: { center: [21.50, 105.70], zoom: 8, name: 'Toàn Miền Bắc (Tổng quan)' },
  hanoi: { center: [21.0285, 105.8542], zoom: 12, name: 'Hà Nội & Phụ cận' },
  taybac: { center: [22.05, 104.35], zoom: 9, name: 'Tây Bắc (Lào Cai - Yên Bái)' },
  vietbac: { center: [21.45, 105.95], zoom: 10, name: 'Việt Bắc (Thái Nguyên - Bắc Giang)' },
  dongbac: { center: [22.40, 106.10], zoom: 9, name: 'Đông Bắc (Cao Bằng - Lạng Sơn)' },
  quangninh: { center: [20.95, 107.05], zoom: 10, name: 'Duyên Hải (Quảng Ninh - Hải Phòng)' },
  songda: { center: [21.05, 105.30], zoom: 10, name: 'Sông Đà (Phú Thọ - Hòa Bình)' }
};

function jumpToRegion(regionKey) {
  if (!map) return;
  const target = NORTHERN_REGIONAL_PRESETS[regionKey] || NORTHERN_REGIONAL_PRESETS.all;
  map.flyTo(target.center, target.zoom, { duration: 1.2 });

  const selEl = document.getElementById('region-jump-select');
  if (selEl && selEl.value !== regionKey) {
    if (Array.from(selEl.options).some(opt => opt.value === regionKey)) {
      selEl.value = regionKey;
    }
  }

  const cmdRegSelect = document.getElementById('cmd-region-selector');
  if (cmdRegSelect && cmdRegSelect.value !== regionKey) {
    if (Array.from(cmdRegSelect.options).some(opt => opt.value === regionKey)) {
      cmdRegSelect.value = regionKey;
    }
  }

  if (typeof window.showNorthStarToast === 'function') {
    window.showNorthStarToast(`📍 Chuyển vùng quan trắc: ${target.name}`, 'info', 2500);
  }
}
window.jumpToRegion = jumpToRegion;
window.NORTHERN_REGIONAL_PRESETS = NORTHERN_REGIONAL_PRESETS;

function zoomToAllPoints() {
  if (!mapInstance || !floodPoints || floodPoints.length === 0) return;
  let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
  floodPoints.forEach(p => {
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  });
  if (minLng <= maxLng && minLat <= maxLat) {
    mapInstance.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50, duration: 800 });
  }
}
    } catch (e) {
      console.warn("Lỗi căn chỉnh khung nhìn bản đồ cho tuyến an toàn:", e);
    }

    if (cardSafe) {
      cardSafe.classList.remove('opacity-60', 'border-slate-300');
      cardSafe.classList.add('border-emerald-500', 'ring-2', 'ring-emerald-400', 'shadow-md');
    }
    if (badgeSafe) badgeSafe.classList.remove('hidden');

    if (cardFastest) {
      cardFastest.classList.remove('ring-2', 'ring-blue-400', 'border-blue-500', 'shadow-md');
      cardFastest.classList.add('opacity-70', 'border-slate-300');
    }
    if (badgeFastest) badgeFastest.classList.add('hidden');

    // Chạy mô phỏng di chuyển xe dọc theo các điểm uốn lượn thực tế của tuyến an toàn
    if (window.VehicleSim && typeof VehicleSim.start === 'function') {
      const latlngs = safeLatLngs;
      const v = document.querySelector('input[name="vehicle"]:checked');
      VehicleSim.start(latlngs, v ? v.value : 'motorbike');
    }
  } else if (mode === 'fastest') {
    if (!fastest || !fastest.found || !routeLayers.fastest) {
      showToast('Lộ trình nhanh nhất hiện không khả dụng để hiển thị', 'warning');
      return;
    }

    // Gỡ bỏ lớp an toàn nếu đang hiển thị trên bản đồ (tránh chồng đè Polyline)
    if (routeLayers.safe && map && true) {
      
    }

    // Cập nhật GeoJSON tuyến nhanh nhất lên MapLibre
    currentRouteGeoJson.fastest = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: fastestLatLngs.map(ll => [ll[1], ll[0]])
        }
      }]
    };
    if (mapInstance && mapInstance.getSource('route-fastest-source')) {
      mapInstance.getSource('route-fastest-source').setData(currentRouteGeoJson.fastest);
    }

    if (cardFastest) {
      cardFastest.classList.remove('opacity-70', 'border-slate-300');
      cardFastest.classList.add('border-blue-500', 'ring-2', 'ring-blue-400', 'shadow-md');
    }
    if (badgeFastest) badgeFastest.classList.remove('hidden');

    if (cardSafe) {
      cardSafe.classList.remove('ring-2', 'ring-emerald-400', 'border-emerald-500', 'shadow-md');
      cardSafe.classList.add('opacity-70', 'border-slate-300');
    }
    if (badgeSafe) badgeSafe.classList.add('hidden');

    // Chạy mô phỏng di chuyển xe dọc theo các điểm uốn lượn thực tế của tuyến nhanh nhất
    if (window.VehicleSim && typeof VehicleSim.start === 'function') {
      const latlngs = fastestLatLngs;
      const v = document.querySelector('input[name="vehicle"]:checked');
      VehicleSim.start(latlngs, v ? v.value : 'motorbike');
    }
  }

  if (window.lucide) lucide.createIcons();
}



// 9. Báo cáo ngập cộng đồng

async function submitReport() {

  if (!coords.report) {

    alert('Vui lòng chọn vị trí ngập trên bản đồ trước!');

    return;

  }

  const level = document.querySelector('input[name="report_level"]:checked').value;

  try {

    const res = await fetch(getApiUrl('/api/reports'), {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({

        lng: coords.report.lng,

        lat: coords.report.lat,

        level: level

      })

    });

    if (res.ok) {

      alert('Cảm ơn bạn! Báo cáo ngập đã được gửi lên hệ thống.');

      coords.report = null;

      document.getElementById('report-coord-text').innerText = 'Nhấp vào đây rồi bấm lên bản đồ';

      if (pickMarkers.report) map.removeLayer(pickMarkers.report);

      loadFloodPoints();

      if (window.CommandUIController && typeof window.CommandUIController.refreshSystemData === 'function') {
        window.CommandUIController.refreshSystemData();
      }
      window.dispatchEvent(new CustomEvent('northstar:new_citizen_report'));

    }

  } catch (err) {

    alert('Lỗi gửi báo cáo: ' + err.message);

  }

}



// 10. Chuyển đổi Tab Sidebar & Thanh công cụ Header
function switchTab(tabId) {
  ['route', 'points', 'report', 'rescue', 'command', 'tracking'].forEach(id => {
    const tab = document.getElementById(`tab-${id}`);
    const btn = document.getElementById(`tab-btn-${id}`);
    const hdrBtn = document.getElementById(`hdr-btn-${id}`);
    const cBtn = document.getElementById(`citizen-tab-btn-${id}`);

    if (tab) tab.classList.add('hidden');
    if (btn) btn.className = 'flex-1 py-3 px-2 border-b-2 border-transparent hover:text-slate-900 flex items-center justify-center gap-1.5 transition text-xs font-semibold text-slate-600';
    if (hdrBtn) {
      hdrBtn.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 font-semibold text-xs transition flex items-center gap-1.5';
    }
    if (cBtn) {
      cBtn.className = 'flex-1 min-w-[120px] py-2 rounded-lg hover:bg-slate-800 text-slate-300 text-center cursor-pointer transition font-bold';
    }
  });

  const activeTab = document.getElementById(`tab-${tabId}`);
  const activeBtn = document.getElementById(`tab-btn-${tabId}`);
  const activeHdrBtn = document.getElementById(`hdr-btn-${tabId}`);
  const activeCBtn = document.getElementById(`citizen-tab-btn-${tabId}`);

  if (activeTab) activeTab.classList.remove('hidden');
  if (activeBtn) {
    if (tabId === 'command') {
      activeBtn.className = 'flex-1 py-3 px-2 border-b-2 border-rose-600 text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5 transition font-extrabold text-xs bg-rose-50/40 dark:bg-rose-950/20';
    } else {
      activeBtn.className = 'flex-1 py-3 px-2 border-b-2 border-blue-600 text-blue-600 flex items-center justify-center gap-1.5 transition font-bold text-xs';
    }
  }
  if (activeCBtn) {
    activeCBtn.className = 'flex-1 min-w-[120px] py-2 rounded-lg bg-emerald-600 text-white text-center cursor-pointer transition font-black shadow-sm';
  }
  if (activeHdrBtn) {
    if (tabId === 'command') {
      activeHdrBtn.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg bg-rose-600 text-white font-extrabold text-xs transition flex items-center gap-1.5 shadow-md border border-rose-400';
    } else {
      activeHdrBtn.className = 'px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/25 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm border border-white/20';
    }
  }

  if (tabId === 'tracking' && window.CommandUIController && typeof window.CommandUIController.trackCitizenTicket === 'function') {
    window.CommandUIController.trackCitizenTicket();
  }

  // Cập nhật tiêu đề thanh điều khiển trên mobile tương ứng với tab
  const mobTitle = document.getElementById('mobile-sidebar-title');
  if (mobTitle) {
    if (tabId === 'route') {
      mobTitle.innerHTML = '<i data-lucide="sliders-horizontal" class="w-3.5 h-3.5 text-blue-600"></i> Bảng điều khiển tìm đường';
    } else if (tabId === 'points') {
      mobTitle.innerHTML = '<i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-amber-500"></i> Danh sách 130 trạm quan trắc';
    } else if (tabId === 'report') {
      mobTitle.innerHTML = '<i data-lucide="send" class="w-3.5 h-3.5 text-emerald-500"></i> Báo cáo ngập tại hiện trường';
    } else if (tabId === 'rescue') {
      mobTitle.innerHTML = '<i data-lucide="shield-alert" class="w-3.5 h-3.5 text-rose-500"></i> Cứu hộ SOS & Điểm sơ tán';
    } else if (tabId === 'command') {
      mobTitle.innerHTML = '<i data-lucide="shield-check" class="w-3.5 h-3.5 text-rose-600"></i> Bàn Tác Chiến Điều Phối';
    }
  }

  if (tabId === 'rescue' && window.NorthStarRescue) {
    NorthStarRescue.loadShelters();
    NorthStarRescue.loadDisasters();
    NorthStarRescue.loadSOSBeacons();
  }

  if (tabId === 'command' && window.CoordinatorCommand) {
    CoordinatorCommand.refreshAllData();
  }

  // Tự động mở lại sidebar nếu đang thu gọn trên desktop
  const panel = document.getElementById('sidebar-panel');
  if (panel && panel.classList.contains('sm:-ml-[420px]')) {
    panel.classList.remove('sm:-ml-[420px]');
    const icon = document.getElementById('sidebar-collapse-icon');
    if (icon) icon.setAttribute('data-lucide', 'chevron-left');
    setTimeout(() => {
      if (window.map) window.map.invalidateSize();
    }, 320);
  }

  // Trên thiết bị di động, tự động mở sidebar khi người dùng chuyển tab
  if (window.innerWidth < 640 && typeof toggleMobilePanel === 'function') {
    toggleMobilePanel(true);
  }

  if (window.lucide) lucide.createIcons();

  cancelPickMode();
}



// 11. Chuyển đổi Dark Mode nâng cao (Esri World Dark Gray Canvas & OpenStreetMap)
function toggleDarkMode() {
  const isCurrentlyDark = document.body.classList.contains('dark-mode') || document.documentElement.classList.contains('dark');
  const targetType = isCurrentlyDark ? 'osm' : 'dark';

  if (typeof window.switchBaseLayer === 'function') {
    window.switchBaseLayer(targetType);
  } else {
    const isDark = (targetType === 'dark');
    if (isDark) {
      document.body.classList.add('dark-mode', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      document.body.classList.remove('dark-mode', 'dark');
      document.documentElement.classList.remove('dark');
    }

    const btn = document.getElementById('dark-mode-icon');
    if (btn) {
      btn.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
      if (window.lucide) lucide.createIcons();
    }
  }
}
window.toggleDarkMode = toggleDarkMode;



// 12. Modal Hướng Dẫn Sử Dụng Nhanh (Onboarding Guide - FE-05)

function openHelpGuide() {

  const modal = document.getElementById('onboarding-modal');

  if (modal) modal.classList.remove('hidden'); if (window.lucide) lucide.createIcons();

}



function closeHelpGuide() {

  const modal = document.getElementById('onboarding-modal');

  if (modal) modal.classList.add('hidden');

  try {

    localStorage.setItem('floodnav_tour_seen', 'true');

  } catch (e) {}

}

// 12.1. Modal Danh Mục Nguồn Dữ Liệu Mở & Bản Quyền (Open Data Compliance)
function openOpenDataModal() {
  const modal = document.getElementById('open-data-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }
}

function closeOpenDataModal() {
  const modal = document.getElementById('open-data-modal');
  if (modal) modal.classList.add('hidden');
}
window.openOpenDataModal = openOpenDataModal;
window.closeOpenDataModal = closeOpenDataModal;



function checkFirstTimeVisitor() {

  try {

    const seen = localStorage.getItem('floodnav_tour_seen');

    if (!seen) {

      setTimeout(openHelpGuide, 500);

    }

  } catch (e) {}

}





// =================================================
// 13. TÌM KIẾM ĐỊA CHỈ & GỢI Ý ĐỊA ĐIỂM (Address Geocoding - FE-02)

// =================================================
let addressDebounceTimer = null;



// Danh bạ địa điểm trọng yếu Hà Nội phục vụ tìm kiếm tức thì và offline (FE-02: Trung)
const HANOI_LANDMARKS = [
  // 1. Trường Đại học & Học viện trọng điểm
  { name: "Đại học Y Hà Nội", lat: 21.0028, lng: 105.8315, sub: "Số 1 Tôn Thất Tùng, Kim Liên, Đống Đa" },
  { name: "Bệnh viện Đại học Y Hà Nội", lat: 21.0028, lng: 105.8315, sub: "Số 1 Tôn Thất Tùng, Kim Liên, Đống Đa" },
  { name: "Đại học Quốc Gia Hà Nội (Xuân Thủy)", lat: 21.0372, lng: 105.7818, sub: "144 Xuân Thủy, Cầu Giấy" },
  { name: "Đại học Sư Phạm Hà Nội", lat: 21.0365, lng: 105.7830, sub: "136 Xuân Thủy, Dịch Vọng Hậu" },
  { name: "Đại học Bách Khoa Hà Nội", lat: 21.0050, lng: 105.8430, sub: "Số 1 Đại Cồ Việt, Bách Khoa, Hai Bà Trưng" },
  { name: "Đại học Kinh Tế Quốc Dân (NEU)", lat: 21.0003, lng: 105.8427, sub: "207 Giải Phóng, Đồng Tâm, Hai Bà Trưng" },
  { name: "Đại học Xây Dựng Hà Nội", lat: 21.0035, lng: 105.8433, sub: "55 Giải Phóng, Đồng Tâm, Hai Bà Trưng" },
  { name: "Đại học Khoa Học Tự Nhiên (ĐHQGHN)", lat: 20.9953, lng: 105.8083, sub: "334 Nguyễn Trãi, Thanh Xuân Trung" },
  { name: "Đại học Khoa Học Xã Hội và Nhân Văn", lat: 20.9950, lng: 105.8078, sub: "336 Nguyễn Trãi, Thanh Xuân Trung" },
  { name: "Đại học Hà Nội (HANU)", lat: 20.9839, lng: 105.7915, sub: "Km 9 Nguyễn Trãi, Trung Văn, Nam Từ Liêm" },
  { name: "Học viện Ngân Hàng", lat: 21.0085, lng: 105.8260, sub: "12 Chùa Bộc, Quang Trung, Đống Đa" },
  { name: "Đại học Thủy Lợi", lat: 21.0076, lng: 105.8239, sub: "175 Tây Sơn, Trung Liệt, Đống Đa" },
  { name: "Đại học Công Đoàn", lat: 21.0088, lng: 105.8231, sub: "169 Tây Sơn, Quang Trung, Đống Đa" },
  { name: "Đại học Ngoại Thương", lat: 21.0235, lng: 105.8068, sub: "91 Chùa Láng, Láng Thượng, Đống Đa" },
  { name: "Học viện Ngoại Giao", lat: 21.0226, lng: 105.8063, sub: "69 Chùa Láng, Láng Thượng, Đống Đa" },
  { name: "Đại học Luật Hà Nội", lat: 21.0255, lng: 105.8105, sub: "87 Nguyễn Chí Thanh, Láng Thượng, Đống Đa" },
  { name: "Đại học Giao Thông Vận Tải", lat: 21.0285, lng: 105.8035, sub: "Số 3 Cầu Giấy, Láng Thượng, Đống Đa" },
  { name: "Học viện Báo chí và Tuyên truyền", lat: 21.0380, lng: 105.7870, sub: "36 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy" },
  { name: "Đại học Thương Mại", lat: 21.0366, lng: 105.7748, sub: "79 Hồ Tùng Mậu, Mai Dịch, Cầu Giấy" },
  { name: "Đại học Công Nghiệp Hà Nội", lat: 21.0537, lng: 105.7351, sub: "298 Cầu Diễn, Minh Khai, Bắc Từ Liêm" },
  { name: "Học viện Tài Chính", lat: 21.0744, lng: 105.7745, sub: "58 Lê Văn Hiến, Đức Thắng, Bắc Từ Liêm" },
  { name: "Học viện Bưu Chính Viễn Thông", lat: 20.9804, lng: 105.7877, sub: "Km 10 Trần Phú, Mộ Lao, Hà Đông" },
  { name: "Học viện An Ninh Nhân Dân", lat: 20.9840, lng: 105.7901, sub: "125 Trần Phú, Văn Quán, Hà Đông" },
  { name: "Đại học Kiến Trúc Hà Nội", lat: 20.9818, lng: 105.7895, sub: "Km 10 Nguyễn Trãi, Văn Quán, Hà Đông" },
  { name: "Học viện Cảnh Sát Nhân Dân", lat: 21.0664, lng: 105.7668, sub: "Cổ Nhuế 2, Bắc Từ Liêm, Hà Nội" },

  // 2. Bệnh viện lớn
  { name: "Bệnh viện Bạch Mai", lat: 21.0028, lng: 105.8398, sub: "78 Giải Phóng, Phương Mai, Đống Đa" },
  { name: "Bệnh viện Hữu nghị Việt Đức", lat: 21.0285, lng: 105.8488, sub: "40 Tràng Thi, Hàng Bông, Hoàn Kiếm" },
  { name: "Bệnh viện Trung ương Quân đội 108", lat: 21.0182, lng: 105.8605, sub: "Số 1 Trần Hưng Đạo, Bạch Đằng, Hai Bà Trưng" },
  { name: "Bệnh viện Nhi Trung Ương", lat: 21.0245, lng: 105.8080, sub: "18/879 La Thành, Láng Thượng, Đống Đa" },
  { name: "Bệnh viện Phụ Sản Hà Nội", lat: 21.0270, lng: 105.8062, sub: "929 La Thành, Ngọc Khánh, Ba Đình" },
  { name: "Bệnh viện K (Quán Sứ)", lat: 21.0253, lng: 105.8465, sub: "43 Quán Sứ, Hàng Bông, Hoàn Kiếm" },
  { name: "Bệnh viện K (Tân Triều)", lat: 20.9658, lng: 105.7972, sub: "30 Cầu Bươu, Tân Triều, Thanh Trì" },
  { name: "Bệnh viện Thanh Nhàn", lat: 21.0024, lng: 105.8617, sub: "42 Thanh Nhàn, Hai Bà Trưng, Hà Nội" },
  { name: "Bệnh viện E", lat: 21.0506, lng: 105.7885, sub: "89 Trần Cung, Nghĩa Tân, Cầu Giấy" },
  { name: "Bệnh viện Tim Hà Nội", lat: 21.0232, lng: 105.8460, sub: "92 Trần Hưng Đạo, Cửa Nam, Hoàn Kiếm" },
  { name: "Bệnh viện Xanh Pôn (Saint Paul)", lat: 21.0321, lng: 105.8358, sub: "12 Chu Văn An, Điện Biên, Ba Đình" },
  { name: "Bệnh viện Quân Y 103", lat: 20.9660, lng: 105.7880, sub: "261 Phùng Hưng, Phúc La, Hà Đông" },

  // 3. Tòa nhà, Chung cư & Trung tâm thương mại
  { name: "Chung cư 96A Định Công", lat: 20.9856, lng: 105.8378, sub: "96A Định Công, Phương Liệt, Thanh Xuân" },
  { name: "Chung cư 360 Giải Phóng (Imperial Plaza)", lat: 20.9890, lng: 105.8405, sub: "360 Giải Phóng, Định Công, Thanh Xuân" },
  { name: "Chung cư HH Linh Đàm", lat: 20.9650, lng: 105.8280, sub: "KĐT Linh Đàm, Hoàng Liệt, Hoàng Mai" },
  { name: "Keangnam Landmark 72", lat: 21.0175, lng: 105.7840, sub: "Khu E6 Phạm Hùng, Cầu Giấy" },
  { name: "Big C Thăng Long (GO!)", lat: 21.0070, lng: 105.7930, sub: "222 Trần Duy Hưng, Trung Hòa, Cầu Giấy" },
  { name: "Vincom Mega Mall Royal City", lat: 21.0028, lng: 105.8152, sub: "72A Nguyễn Trãi, Thượng Đình, Thanh Xuân" },
  { name: "Vincom Mega Mall Times City", lat: 20.9953, lng: 105.8672, sub: "458 Minh Khai, Vĩnh Tuy, Hai Bà Trưng" },
  { name: "Vincom Center Bà Triệu", lat: 21.0116, lng: 105.8497, sub: "191 Bà Triệu, Lê Đại Hành, Hai Bà Trưng" },
  { name: "Vincom Center Nguyễn Chí Thanh", lat: 21.0232, lng: 105.8105, sub: "54A Nguyễn Chí Thanh, Láng Thượng, Đống Đa" },
  { name: "Vincom Mega Mall Smart City", lat: 20.9965, lng: 105.7423, sub: "Vinhomes Smart City, Tây Mỗ, Nam Từ Liêm" },
  { name: "Vincom Mega Mall Ocean Park", lat: 20.9880, lng: 105.9450, sub: "Vinhomes Ocean Park, Đa Tốn, Gia Lâm" },
  { name: "Aeon Mall Hà Đông", lat: 20.9804, lng: 105.7538, sub: "Khu đô thị Dương Nội, Hà Đông" },
  { name: "Aeon Mall Long Biên", lat: 21.0267, lng: 105.9004, sub: "27 Cổ Linh, Long Biên, Hà Nội" },
  { name: "Lotte Center Hà Nội (Liễu Giai)", lat: 21.0326, lng: 105.8130, sub: "54 Liễu Giai, Cống Vị, Ba Đình" },
  { name: "Lotte Mall Tây Hồ", lat: 21.0772, lng: 105.8080, sub: "272 Võ Chí Công, Phú Thượng, Tây Hồ" },

  // 4. Bến xe, Sân bay, Ga tàu & Nút giao trọng yếu
  { name: "Bến xe Mỹ Đình", lat: 21.0288, lng: 105.7780, sub: "20 Phạm Hùng, Mỹ Đình 2, Nam Từ Liêm" },
  { name: "Bến xe Giáp Bát", lat: 20.9806, lng: 105.8418, sub: "Đường Giải Phóng, Giáp Bát, Hoàng Mai" },
  { name: "Bến xe Nước Ngầm", lat: 20.9634, lng: 105.8410, sub: "Số 1 Ngọc Hồi, Hoàng Liệt, Hoàng Mai" },
  { name: "Bến xe Gia Lâm", lat: 21.0502, lng: 105.8770, sub: "Số 9 Ngô Gia Khảm, Ngọc Lâm, Long Biên" },
  { name: "Bến xe Yên Nghĩa", lat: 20.9535, lng: 105.7510, sub: "Quốc lộ 6, Yên Nghĩa, Hà Đông" },
  { name: "Ga Hà Nội", lat: 21.0246, lng: 105.8412, sub: "120 Lê Duẩn, Văn Miếu, Đống Đa" },
  { name: "Sân bay Quốc tế Nội Bài", lat: 21.2212, lng: 105.8072, sub: "Xã Phú Minh, Huyện Sóc Sơn, Hà Nội" },
  { name: "Sân vận động Quốc gia Mỹ Đình", lat: 21.0205, lng: 105.7640, sub: "Đường Lê Đức Thọ, Mỹ Đình 1, Nam Từ Liêm" },
  { name: "Trung tâm Hội nghị Quốc gia", lat: 21.0055, lng: 105.7838, sub: "Đại lộ Thăng Long, Mễ Trì, Nam Từ Liêm" },
  { name: "Hồ Gươm (Hồ Hoàn Kiếm)", lat: 21.0285, lng: 105.8542, sub: "Quận Hoàn Kiếm, Hà Nội" },
  { name: "Hồ Tây (Đường Thanh Niên)", lat: 21.0450, lng: 105.8350, sub: "Quận Tây Hồ, Hà Nội" },
  { name: "Lăng Chủ tịch Hồ Chí Minh (Lăng Bác)", lat: 21.0368, lng: 105.8346, sub: "Số 2 Hùng Vương, Điện Biên, Ba Đình" },
  { name: "Văn Miếu Quốc Tử Giám", lat: 21.0286, lng: 105.8355, sub: "58 Quốc Tử Giám, Đống Đa, Hà Nội" },
  { name: "Ngã Tư Sở", lat: 21.0035, lng: 105.8180, sub: "Giao lộ Trường Chinh - Tây Sơn - Láng - Nguyễn Trãi" },
  { name: "Ngã Tư Vọng", lat: 20.9995, lng: 105.8415, sub: "Giao lộ Giải Phóng - Trường Chinh - Đại La" },
  { name: "Ô Chợ Dừa", lat: 21.0202, lng: 105.8278, sub: "Giao lộ Tôn Đức Thắng - Xã Đàn - Khâm Thiên" },
  { name: "Hầm chui Kim Liên", lat: 21.0105, lng: 105.8440, sub: "Đại Cồ Việt - Xã Đàn, Đống Đa / Hai Bà Trưng" },
  { name: "Hầm chui Trung Hòa", lat: 21.0060, lng: 105.7900, sub: "Trần Duy Hưng - Đại lộ Thăng Long, Cầu Giấy" },
  { name: "Hầm chui Thanh Xuân", lat: 20.9930, lng: 105.7985, sub: "Nguyễn Trãi - Khuất Duy Tiến, Thanh Xuân" },
  { name: "Hầm chui Lê Văn Lương", lat: 21.0010, lng: 105.7940, sub: "Lê Văn Lương - Vành đai 3, Thanh Xuân" },

  // 5. Tuyến phố & Đường huyết mạch
  { name: "Đường Tôn Thất Tùng", lat: 21.0040, lng: 105.8310, sub: "Phường Kim Liên - Khương Thượng, Đống Đa" },
  { name: "Đường Chùa Bộc", lat: 21.0085, lng: 105.8260, sub: "Phường Quang Trung, Đống Đa" },
  { name: "Đường Thái Hà", lat: 21.0145, lng: 105.8185, sub: "Phường Trung Liệt, Đống Đa" },
  { name: "Đường Tây Sơn", lat: 21.0105, lng: 105.8215, sub: "Phường Quang Trung, Đống Đa" },
  { name: "Đường Láng Hạ", lat: 21.0115, lng: 105.8120, sub: "Phường Láng Hạ, Đống Đa" },
  { name: "Đường Huỳnh Thúc Kháng", lat: 21.0190, lng: 105.8115, sub: "Phường Láng Hạ, Đống Đa" },
  { name: "Phố Chùa Láng", lat: 21.0240, lng: 105.8035, sub: "Phường Láng Thượng, Đống Đa" },
  { name: "Đường Trường Chinh", lat: 21.0010, lng: 105.8330, sub: "Phường Khương Mai - Phương Mai" },
  { name: "Đường Xã Đàn", lat: 21.0165, lng: 105.8350, sub: "Phường Nam Đồng, Đống Đa" },
  { name: "Đường Đại Cồ Việt", lat: 21.0100, lng: 105.8480, sub: "Phường Lê Đại Hành, Hai Bà Trưng" },
  { name: "Đường Định Công", lat: 20.9880, lng: 105.8380, sub: "Phường Định Công, Hoàng Mai" },
  { name: "Đường Giải Phóng", lat: 20.9964, lng: 105.8414, sub: "Quận Hoàng Mai / Hai Bà Trưng" },
  { name: "Đường Phạm Ngọc Thạch", lat: 21.0090, lng: 105.8325, sub: "Phường Kim Liên, Đống Đa" },
  { name: "Đường Nguyễn Chí Thanh", lat: 21.0255, lng: 105.8105, sub: "Quận Đống Đa / Ba Đình" },
  { name: "Đường Trần Duy Hưng", lat: 21.0105, lng: 105.8010, sub: "Phường Trung Hòa, Cầu Giấy" },
  { name: "Đường Lê Văn Lương", lat: 21.0040, lng: 105.7990, sub: "Phường Nhân Chính, Thanh Xuân" },
  { name: "Đường Tố Hữu", lat: 20.9930, lng: 105.7820, sub: "Phường Trung Văn, Nam Từ Liêm" },
  { name: "Đường Nguyễn Trãi", lat: 20.9960, lng: 105.8080, sub: "Quận Thanh Xuân, Hà Nội" },
  { name: "Đường Khuất Duy Tiến", lat: 20.9985, lng: 105.7950, sub: "Phường Thanh Xuân Bắc, Thanh Xuân" },
  { name: "Đường Nguyễn Xiển", lat: 20.9870, lng: 105.8085, sub: "Phường Hạ Đình, Thanh Xuân" },
  { name: "Đường Láng", lat: 21.0165, lng: 105.8060, sub: "Phường Láng Thượng - Thịnh Quang, Đống Đa" },
  { name: "Đường Cầu Giấy", lat: 21.0335, lng: 105.7950, sub: "Phường Quan Hoa - Dịch Vọng, Cầu Giấy" },
  { name: "Đường Xuân Thủy", lat: 21.0370, lng: 105.7820, sub: "Phường Dịch Vọng Hậu, Cầu Giấy" },
  { name: "Đường Hồ Tùng Mậu", lat: 21.0390, lng: 105.7680, sub: "Phường Mai Dịch, Cầu Giấy" },
  { name: "Đường Phạm Hùng", lat: 21.0220, lng: 105.7810, sub: "Phường Mễ Trì - Mỹ Đình, Nam Từ Liêm" },
  { name: "Đường Hoàng Quốc Việt", lat: 21.0465, lng: 105.7925, sub: "Phường Nghĩa Đô, Cầu Giấy" },
  { name: "Đường Võ Chí Công", lat: 21.0650, lng: 105.8080, sub: "Phường Xuân La, Tây Hồ" },
  { name: "Đường Lạc Long Quân", lat: 21.0580, lng: 105.8100, sub: "Phường Bưởi, Tây Hồ" },
  { name: "Đường Âu Cơ", lat: 21.0680, lng: 105.8250, sub: "Phường Quảng An, Tây Hồ" },
  { name: "Đường Nghi Tàm", lat: 21.0520, lng: 105.8380, sub: "Phường Yên Phụ, Tây Hồ" },
  { name: "Đường Kim Mã", lat: 21.0315, lng: 105.8200, sub: "Phường Kim Mã, Ba Đình" },
  { name: "Đường Giảng Võ", lat: 21.0260, lng: 105.8225, sub: "Phường Giảng Võ, Ba Đình" },
  { name: "Đường Liễu Giai", lat: 21.0340, lng: 105.8140, sub: "Phường Cống Vị, Ba Đình" },
  { name: "Đường Hoàng Hoa Thám", lat: 21.0420, lng: 105.8150, sub: "Quận Ba Đình / Tây Hồ" },
  { name: "Đường Thụy Khuê", lat: 21.0430, lng: 105.8220, sub: "Phường Thụy Khuê, Tây Hồ" },
  { name: "Đường Minh Khai", lat: 20.9980, lng: 105.8600, sub: "Phường Vĩnh Tuy, Hai Bà Trưng" },
  { name: "Đường Bạch Mai", lat: 21.0030, lng: 105.8500, sub: "Phường Bạch Mai, Hai Bà Trưng" },
  { name: "Đường Phố Huế", lat: 21.0150, lng: 105.8510, sub: "Quận Hai Bà Trưng, Hà Nội" },
  { name: "Đường Bà Triệu", lat: 21.0180, lng: 105.8500, sub: "Quận Hoàn Kiếm / Hai Bà Trưng" },
  { name: "Đường Tràng Thi", lat: 21.0280, lng: 105.8490, sub: "Phường Hàng Bông, Hoàn Kiếm" },
  { name: "Đường Đinh Tiên Hoàng", lat: 21.0300, lng: 105.8530, sub: "Phường Tràng Tiền, Hoàn Kiếm" },
  { name: "Đường Trần Hưng Đạo", lat: 21.0220, lng: 105.8510, sub: "Quận Hoàn Kiếm, Hà Nội" },
  { name: "Đường Hai Bà Trưng", lat: 21.0260, lng: 105.8510, sub: "Quận Hoàn Kiếm, Hà Nội" },
  { name: "Đường Phan Đình Phùng", lat: 21.0400, lng: 105.8400, sub: "Phường Quán Thánh, Ba Đình" }
];



// Chuẩn hóa chuỗi tìm kiếm tiếng Việt (bỏ dấu, chuyển đ->d, loại bỏ ký tự đặc biệt)
function normalizeSearchText(str) {
  if (!str) return '';
  return str.toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Kiểm tra và tính điểm tương đồng giữa từ khóa và địa danh
function scoreLocationMatch(name, sub, query) {
  const qNorm = normalizeSearchText(query);
  if (!qNorm) return 0;
  const nNorm = normalizeSearchText(name);
  const sNorm = normalizeSearchText(sub);

  // 1. Khớp chính xác tuyệt đối
  if (nNorm === qNorm) return 100;
  // 2. Bắt đầu bằng từ khóa
  if (nNorm.startsWith(qNorm)) return 85;
  // 3. Chứa trọn vẹn từ khóa trong tên
  if (nNorm.includes(qNorm)) return 75;
  // 4. Từ khóa chứa trọn vẹn tên địa danh (ví dụ user gõ "trường đại học y hà nội")
  if (qNorm.includes(nNorm) && nNorm.length >= 4) return 70;
  // 5. Chứa trọn vẹn trong địa chỉ phụ (sub)
  if (sNorm.includes(qNorm)) return 60;

  // 6. Khớp theo tập hợp từ (token-based), bỏ qua các từ phụ phổ biến
  const STOP_WORDS = new Set(['truong', 'khu', 'pho', 'duong', 'quan', 'tp', 'thanh', 'ha', 'noi', 'hn', 'so', 'nha', 'toa']);
  const qTokens = qNorm.split(' ').filter(w => w.length > 0 && !STOP_WORDS.has(w));
  if (qTokens.length === 0) return 0;

  const nTokens = nNorm.split(' ');
  const sTokens = sNorm.split(' ');
  const allTargetTokens = new Set([...nTokens, ...sTokens]);

  const matchedTokens = qTokens.filter(t => allTargetTokens.has(t) || [...allTargetTokens].some(target => target.includes(t)));
  const matchRatio = matchedTokens.length / qTokens.length;

  if (matchRatio === 1) return 55; // Khớp đủ tất cả từ khóa chính
  if (matchRatio >= 0.6) return 30; // Khớp đa số từ khóa

  return 0;
}

// Tìm kiếm danh bạ địa phương (HANOI_LANDMARKS + window.floodPoints) tức thì (<1ms)
function getLocalAddressMatches(query) {
  if (!query || query.trim().length < 2) return [];
  const qClean = query.trim();
  const results = [];

  // 1. Quét danh bạ địa danh Hà Nội
  if (typeof HANOI_LANDMARKS !== 'undefined' && Array.isArray(HANOI_LANDMARKS)) {
    for (const item of HANOI_LANDMARKS) {
      const score = scoreLocationMatch(item.name, item.sub, qClean);
      if (score > 0) {
        results.push({
          name: item.name,
          sub: item.sub,
          lat: item.lat,
          lng: item.lng,
          score: score
        });
      }
    }
  }

  // 2. Quét thêm từ 130 điểm trạm quan trắc ngập lụt hiện có trên bản đồ
  if (typeof window !== 'undefined' && Array.isArray(window.floodPoints)) {
    for (const pt of window.floodPoints) {
      const ptName = pt.name || pt.location_desc || '';
      const ptSub = pt.location_desc || pt.district || 'Hà Nội';
      const score = scoreLocationMatch(ptName, ptSub, qClean);
      if (score > 0) {
        // Kiểm tra tránh trùng lặp tọa độ quá gần với địa danh đã có
        const isDuplicate = results.some(r => Math.abs(r.lat - pt.lat) < 0.001 && Math.abs(r.lng - pt.lng) < 0.001);
        if (!isDuplicate) {
          results.push({
            name: ptName,
            sub: `${ptSub} (Điểm trạm)`,
            lat: pt.lat,
            lng: pt.lng,
            score: score - 5
          });
        }
      }
    }
  }

  // Sắp xếp theo điểm tương đồng cao nhất
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 6);
}

// Helper đồng bộ ID phần tử cho cả 'destination' và 'dest'
function getAddressElements(type) {
  const isDest = (type === 'destination' || type === 'dest');
  const prefix = isDest ? 'dest' : 'origin';
  return {
    targetType: isDest ? 'destination' : 'origin',
    input: document.getElementById(`${prefix}-text`) || document.getElementById(`${type}-text`),
    container: document.getElementById(`${prefix}-suggestions`) || document.getElementById(`${type}-suggestions`),
    clearBtn: document.getElementById(`btn-clear-${prefix}`) || document.getElementById(`btn-clear-${type}`)
  };
}

// Hiển thị danh sách gợi ý ra giao diện
function renderAddressSuggestions(targetType, container, items) {
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = `<div class="p-3 text-center text-slate-400 text-xs">Không tìm thấy địa chỉ phù hợp. Bạn có thể bấm "Chỉ định trên bản đồ".</div>`;
    container.classList.remove('hidden');
    return;
  }

  container.innerHTML = items.slice(0, 6).map(item => `
    <div onclick="selectAddress('${targetType}', ${item.lat}, ${item.lng}, '${encodeURIComponent(item.name)}')" 
         class="p-2.5 hover:bg-blue-50 cursor-pointer transition flex items-start gap-2.5 text-left group border-b border-slate-100 last:border-b-0">
      <i data-lucide="map-pin" class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5 group-hover:scale-110 transition"></i>
      <div class="flex-1 overflow-hidden">
        <p class="font-bold text-slate-800 text-xs truncate group-hover:text-blue-600">${item.name}</p>
        <p class="text-[11px] text-slate-500 truncate">${item.sub}</p>
      </div>
    </div>
  `).join('');
  container.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

// Tự động phân giải địa chỉ từ chuỗi người dùng đã nhập
async function resolveAddressFromInput(type) {
  const { targetType, input } = getAddressElements(type);
  if (!input) return false;
  const query = input.value.trim();
  if (!query) return false;

  // 1. Kiểm tra nếu là dạng tọa độ số "lat, lng"
  const parts = query.split(',').map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    coords[targetType] = { lat: parts[0], lng: parts[1] };
    const color = targetType === 'origin' ? '#10b981' : '#ef4444';
    const label = targetType === 'origin' ? 'Điểm xuất phát' : 'Điểm đến';
    updatePickMarker(targetType, parts[0], parts[1], color, label);
    return true;
  }

  // 2. Tra cứu tức thì từ danh bạ địa phương (HANOI_LANDMARKS + floodPoints)
  const localMatches = getLocalAddressMatches(query);
  if (localMatches.length > 0) {
    const best = localMatches[0];
    coords[targetType] = { lat: best.lat, lng: best.lng };
    const color = targetType === 'origin' ? '#10b981' : '#ef4444';
    const label = targetType === 'origin' ? 'Điểm xuất phát' : 'Điểm đến';
    updatePickMarker(targetType, best.lat, best.lng, color, label);
    return true;
  }

  // 3. Tra cứu nhanh dự phòng qua Photon API (tối đa 2.0s timeout)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=21.0285&lon=105.8030&limit=1&lang=default`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const f = data.features[0];
        const lat = f.geometry.coordinates[1];
        const lng = f.geometry.coordinates[0];
        coords[targetType] = { lat, lng };
        const color = targetType === 'origin' ? '#10b981' : '#ef4444';
        const label = targetType === 'origin' ? 'Điểm xuất phát' : 'Điểm đến';
        updatePickMarker(targetType, lat, lng, color, label);
        return true;
      }
    }
  } catch (e) {
    console.debug("resolveAddressFromInput fallback status:", e.message || e);
  }

  return false;
}

// Xử lý sự kiện khi gõ vào ô địa chỉ
function handleAddressInput(type, query) {
  const { targetType, clearBtn, container } = getAddressElements(type);
  if (!container) return;

  if (clearBtn) {
    if (query && query.trim().length > 0) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  // Nếu người dùng xóa sạch text, xóa luôn tọa độ tương ứng
  if (!query || query.trim().length === 0) {
    coords[targetType] = null;
    if (pickMarkers[targetType]) {
      map.removeLayer(pickMarkers[targetType]);
      pickMarkers[targetType] = null;
    }
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  if (query.trim().length < 2) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  // HIỂN THỊ TỨC THÌ (<1ms) KẾT QUẢ ĐỊA PHƯƠNG KHÔNG CẦN CHỜ ĐỢI
  const instantMatches = getLocalAddressMatches(query);
  if (instantMatches.length > 0) {
    renderAddressSuggestions(targetType, container, instantMatches);
  }

  // Debounce gọi thêm API mở rộng để bổ sung địa chỉ hiếm (nếu cần)
  clearTimeout(addressDebounceTimer);
  addressDebounceTimer = setTimeout(() => {
    executeAddressSearch(type, query.trim(), instantMatches);
  }, 250);
}

// Tìm kiếm mở rộng kết hợp danh bạ và API
async function executeAddressSearch(type, query, currentLocalMatches = []) {
  const { targetType, container } = getAddressElements(type);
  if (!container) return;

  // Lấy kết quả địa phương mới nhất
  const localMatches = (currentLocalMatches && currentLocalMatches.length > 0) 
    ? currentLocalMatches 
    : getLocalAddressMatches(query);

  // Nếu chưa có kết quả địa phương nào, hiển thị spinner tìm kiếm
  if (localMatches.length === 0) {
    container.innerHTML = `<div class="p-2.5 text-center text-slate-400 text-xs flex items-center justify-center gap-1.5"><i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Đang tìm địa chỉ...</span></div>`;
    container.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  // Nếu đã có 4+ kết quả địa phương khớp rất tốt (điểm >= 70), không cần chờ API để tránh làm chậm UX
  if (localMatches.length >= 4 && localMatches[0].score >= 70) {
    renderAddressSuggestions(targetType, container, localMatches);
    return;
  }

  // Gọi Photon API mở rộng với timeout an toàn 2.0s
  let apiMatches = [];
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=21.0285&lon=105.8030&limit=6&lang=default`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      apiMatches = (data.features || []).map(f => {
        const p = f.properties || {};
        const title = p.name || p.street || query;
        const parts = [];
        if (p.housenumber && p.street && !title.includes(p.street)) {
          parts.push(`${p.housenumber} ${p.street}`);
        } else if (p.street && !title.includes(p.street)) {
          parts.push(p.street);
        }
        if (p.district) parts.push(p.district);
        if (p.city) parts.push(p.city);
        const sub = parts.join(', ') || 'Hà Nội, Việt Nam';
        return {
          name: title,
          sub: sub,
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
          score: 50
        };
      });
    }
  } catch (e) {
    // Tuyệt đối không return ở đây - đảm bảo luôn cập nhật giao diện
    console.debug("Address API search note:", e.message || e);
  }

  // Kết hợp và loại bỏ trùng lặp (ưu tiên danh bạ địa phương)
  const combined = [...localMatches];
  apiMatches.forEach(item => {
    if (!combined.some(r => Math.abs(r.lat - item.lat) < 0.003 && Math.abs(r.lng - item.lng) < 0.003)) {
      combined.push(item);
    }
  });

  renderAddressSuggestions(targetType, container, combined);
}

function selectAddress(type, lat, lng, displayName) {

  try {

    displayName = decodeURIComponent(displayName);

  } catch (e) {}

  const { targetType, input, clearBtn, container } = getAddressElements(type);

  coords[targetType] = { lat: Number(lat), lng: Number(lng) };

  

  if (input) input.value = displayName;

  if (clearBtn) clearBtn.classList.remove('hidden');

  if (container) container.classList.add('hidden');



  const color = targetType === 'origin' ? '#10b981' : '#ef4444';

  const label = targetType === 'origin' ? 'Điểm xuất phát' : 'Điểm đến';

  updatePickMarker(targetType, lat, lng, color, label);



  map.flyTo([lat, lng], 15, { duration: 0.8 });



  // Tự động kích hoạt tính lộ trình nếu cả 2 điểm đã sẵn sàng

  if (coords.origin && coords.destination) {

    calculateRoute();

  }

}



function clearLocation(type) {

  const { targetType, input, clearBtn, container } = getAddressElements(type);

  coords[targetType] = null;

  if (input) input.value = '';

  if (clearBtn) clearBtn.classList.add('hidden');

  if (container) container.classList.add('hidden');



  if (pickMarkers[targetType]) {

    map.removeLayer(pickMarkers[targetType]);

    pickMarkers[targetType] = null;

  }

}



async function handleAddressKeydown(event, type) {

  const { targetType, container } = getAddressElements(type);

  if (event.key === 'Enter') {

    event.preventDefault();

    if (container && !container.classList.contains('hidden')) {

      const firstItem = container.querySelector('[onclick]');

      if (firstItem) {

        firstItem.click();

        return;

      }

    }

    // Nếu dropdown chưa có hoặc người dùng nhấn Enter ngay

    await resolveAddressFromInput(type);

    if (coords.origin && coords.destination) {

      calculateRoute();

    }

  } else if (event.key === 'Escape') {

    if (container) container.classList.add('hidden');

  }

}



// Đóng dropdown khi click ra ngoài

document.addEventListener('click', (e) => {

  ['origin', 'destination'].forEach(type => {

    const { input, container } = getAddressElements(type);

    if (container && !container.contains(e.target) && e.target !== input) {

      container.classList.add('hidden');

    }

  });

});



// FE-01: Kiểm tra trạng thái PostGIS kết nối cho Floating Header
async function checkPostGISConnection() {
  const badge = document.getElementById('postgis-status-badge');
  if (!badge) return;
  try {
    const res = await fetch(getApiUrl('/api/health'));
    if (res.ok) {
      const data = await res.json();
      if (data.database === 'connected') {
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>PostGIS Live</span>';
        badge.className = 'flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 rounded-lg text-[11px] font-semibold cursor-default';
        badge.title = 'PostGIS Live: Cơ sở dữ liệu không gian PostgreSQL kết nối thành công';
        return;
      } else {
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400"></span><span>PostGIS Standby</span>';
        badge.className = 'flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 border border-amber-400/30 text-amber-100 rounded-lg text-[11px] font-semibold cursor-default';
        badge.title = 'PostGIS Standby: Đang hoạt động ở chế độ bộ nhớ dự phòng In-Memory / SQLite';
        return;
      }
    }
  } catch (e) {
    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span><span>Backend Standby</span>';
    badge.className = 'flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/20 border border-rose-400/30 text-rose-200 rounded-lg text-[11px] font-semibold cursor-default';
    badge.title = 'Không thể kết nối Backend API. Vui lòng kiểm tra lại dịch vụ Backend.';
    return;
  }
  badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400"></span><span>PostGIS Standby</span>';
  badge.className = 'flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 border border-amber-400/30 text-amber-100 rounded-lg text-[11px] font-semibold cursor-default';
  badge.title = 'PostGIS Standby: Đang hoạt động ở chế độ bộ nhớ dự phòng In-Memory / SQLite';
}

// FE-02: Tải thông tin thời tiết & lượng mưa thực tế cho Nhóm 2 (Giám sát)
async function loadWeatherInfo() {
  const el = document.getElementById('weather-badge');
  if (!el) return;
  try {
    const res = await fetch(getApiUrl('/api/weather/hanoi'));
    if (res.ok) {
      const data = await res.json();
      const currentPrecip = data.hourly_forecast && data.hourly_forecast[0] ? data.hourly_forecast[0].precipitation_mm : 0;
      const weatherText = currentPrecip > 0 ? `Mưa ${currentPrecip} mm` : `☀️ Tạnh ráo`;
      el.innerHTML = `<i data-lucide="${currentPrecip > 0 ? 'cloud-rain' : 'cloud-sun'}" class="w-3.5 h-3.5 text-cyan-200"></i><span>Hà Nội: <b>${weatherText}</b></span>`;
      el.title = `Dự báo lượng mưa tại Hà Nội: ${currentPrecip} mm/h (Open-Meteo API)`;
      if (window.lucide) lucide.createIcons();
      return;
    }
  } catch (e) {}
  el.innerHTML = `<i data-lucide="sun" class="w-3.5 h-3.5 text-amber-300"></i><span>Hà Nội: <b>28°C • Tạnh</b></span>`;
  if (window.lucide) lucide.createIcons();
}

// FE-02: Điều khiển Menu phụ Dropdown trong Nhóm 3 (Tiện ích)
function toggleHeaderMenu(e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  const menu = document.getElementById('header-more-dropdown');
  if (menu) menu.classList.toggle('hidden');
}

function closeHeaderMenu() {
  const menu = document.getElementById('header-more-dropdown');
  if (menu) menu.classList.add('hidden');
}

// Điều khiển Bật/Tắt Bảng Lớp Bản Đồ Thiên Tai (Dấu 3 lớp / Layers icon)
function toggleHazardLayersPanel(forceState) {
  const panel = document.getElementById('multi-hazard-layer-control');
  if (!panel) return;
  if (typeof forceState === 'boolean') {
    if (forceState) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  } else {
    panel.classList.toggle('hidden');
  }
  if (window.lucide) lucide.createIcons();
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('header-more-dropdown');
  const btn = document.getElementById('btn-header-more');
  if (menu && !menu.contains(e.target) && btn && !btn.contains(e.target)) {
    menu.classList.add('hidden');
  }
});

// =================================================
// Xuất các biến và hàm điều khiển quan trọng ra window
// =================================================
window.floodPoints = floodPoints;
window.coords = coords;
if (typeof map !== 'undefined') window.map = map;
window.renderFloodPoints = renderFloodPoints;
window.switchTab = switchTab;
window.toggleHazardLayersPanel = toggleHazardLayersPanel;
window.toggleHeaderMenu = toggleHeaderMenu;
window.closeHeaderMenu = closeHeaderMenu;
window.loadWeatherInfo = loadWeatherInfo;
window.renderPointsList = renderPointsList;
window.updateViewportFloodAlert = updateViewportFloodAlert;
window.calculateRoute = calculateRoute;
window.loadFloodPoints = loadFloodPoints;


// ========================================================
// FE: Tiện ích Toast & Điều khiển Đặt lại Mặc định
// ========================================================
function showToast(message, type = 'info') {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    document.body.appendChild(toast);
  }
  
  const bgClass = type === 'success' ? 'bg-emerald-600 text-white shadow-emerald-500/30' :
                  type === 'warning' ? 'bg-amber-600 text-white shadow-amber-500/30' :
                  type === 'error' ? 'bg-rose-600 text-white shadow-rose-500/30' :
                  'bg-slate-800 text-white shadow-slate-900/30';
  const icon = type === 'success' ? 'check-circle' : 'info';

  toast.className = `fixed bottom-6 right-6 z-[9999] px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 transition-all duration-300 transform translate-y-0 opacity-100 ${bgClass} pointer-events-auto`;
  toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i><span>${message}</span>`;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.className = toast.className.replace('translate-y-0 opacity-100', 'translate-y-10 opacity-0');
  }, 3000);
}

function clearActiveRoute() {
  currentRouteGeoJson.safe = { type: 'FeatureCollection', features: [] };
  currentRouteGeoJson.fastest = { type: 'FeatureCollection', features: [] };
  if (mapInstance) {
    if (mapInstance.getSource('route-safe-source')) {
      mapInstance.getSource('route-safe-source').setData(currentRouteGeoJson.safe);
    }
    if (mapInstance.getSource('route-fastest-source')) {
      mapInstance.getSource('route-fastest-source').setData(currentRouteGeoJson.fastest);
    }
  }
  if (window.VehicleSim && typeof VehicleSim.stop === 'function') {
    VehicleSim.stop();
  }
  clearLocation('origin');
  clearLocation('destination');
  currentRouteData = null;

  const resultCard = document.getElementById('route-results');
  if (resultCard) resultCard.classList.add('hidden');

  const summaryCard = document.getElementById('flood-summary-card');
  if (summaryCard) summaryCard.classList.remove('hidden');

  updateSidebarFloodSummary();
  showToast('Đã xóa lộ trình & xem lại tình hình ngập', 'info');
}

window.showToast = showToast;
window.clearActiveRoute = clearActiveRoute;
window.selectActiveRoute = selectActiveRoute;
window.updateSidebarFloodSummary = updateSidebarFloodSummary;
window.resetToDefaultState = function() {
  if (window.StormSimulator && typeof StormSimulator.resetToDefault === 'function') {
    StormSimulator.resetToDefault();
  }
};
