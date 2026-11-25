/**
 * Copyright 2026 GrassTouchers Team - NORTHSTAR Project
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

// Unified Service Worker for NORTHSTAR (Command + Citizen PWA, Phase 5 / CIT-06 / Local Vendor)
const CACHE_VERSION = 'v20261125-p5-local';
const STATIC_CACHE = `northstar-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `northstar-runtime-${CACHE_VERSION}`;
const WEATHER_CACHE = `northstar-weather-${CACHE_VERSION}`;
const TILE_CACHE = `northstar-tiles-${CACHE_VERSION}`;
const ACTIVE_CACHES = [STATIC_CACHE, RUNTIME_CACHE, WEATHER_CACHE, TILE_CACHE];

const MAX_TILE_ENTRIES = 120;
const IDB_NAME = 'northstar_citizen_db';
const IDB_VERSION = 1;

const STATIC_ASSETS = [
  './',
  './index.html',
  './citizen.html',
  './manifest.json',
  './manifest-citizen.json',
  './assets/icons/citizen-192.png',
  './assets/icons/citizen-512.png',
  './assets/icons/citizen-icon.svg',
  './css/style.css',
  './css/maplibre-gl.css',
  './js/vendor/maplibre-gl.js',
  './js/vendor/tailwindcss.min.js',
  './js/vendor/lucide.min.js',
  './js/vendor/qrcode.min.js',
  './js/vendor/jsQR.js',
  './js/config.js',
  './js/offline_db.js',
  './js/offline_sync_manager.js',
  './js/sos_relay.js',
  './js/satellite_gateway_adapter.js',
  './js/rescue_manager.js',
  './js/voice_sos.js',
  './js/citizen_portal.js',
  './js/offline_knowledge.js',
  './js/ai_assistant.js',
  './js/maplibre_engine.js',
  './js/command_ui_controller.js',
  './js/provinces_weather_layer.js',
  './data/northern_provinces.geojson',
  './data/offline_knowledge_vi.json'
];

let lastPrecacheReport = {
  version: CACHE_VERSION,
  cached: [],
  failed: [],
  completedAt: null
};

function isSensitiveApi(url) {
  const p = url.pathname || '';
  return (
    p.startsWith('/api/sos') ||
    p.startsWith('/api/reports') ||
    p.startsWith('/api/auth') ||
    p.startsWith('/api/ai')
  );
}

function isWeatherOrDisasterApi(url) {
  const p = url.pathname || '';
  const h = url.hostname || '';
  return (
    p.startsWith('/api/weather') ||
    p.startsWith('/api/disasters') ||
    p.startsWith('/api/flood') ||
    p.startsWith('/api/shelters') ||
    h.includes('open-meteo.com')
  );
}

function isMapTileRequest(url) {
  const h = url.hostname || '';
  return (
    h.includes('arcgisonline.com') ||
    h.includes('tile.openstreetmap.org') ||
    h.includes('cartocdn.com')
  );
}

function isAllowedCdnAsset(url) {
  const h = url.hostname || '';
  return (
    h === 'cdn.tailwindcss.com' ||
    h === 'unpkg.com' ||
    h === 'cdn.jsdelivr.net'
  );
}

async function trimTileCache() {
  try {
    const cache = await caches.open(TILE_CACHE);
    const keys = await cache.keys();
    if (keys.length > MAX_TILE_ENTRIES) {
      const excess = keys.length - MAX_TILE_ENTRIES;
      for (let i = 0; i < excess; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch (_) {
    // Ignore tile cache trim errors
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = [];
    const failed = [];

    await Promise.allSettled(
      STATIC_ASSETS.map(async (assetUrl) => {
        try {
          const req = new Request(assetUrl, { cache: 'reload' });
          const resp = await fetch(req);
          if (resp && resp.ok) {
            await cache.put(assetUrl, resp);
            cached.push(assetUrl);
          } else {
            failed.push({ url: assetUrl, status: resp ? resp.status : 0 });
          }
        } catch (err) {
          failed.push({ url: assetUrl, error: err && err.message ? err.message : 'fetch_error' });
        }
      })
    );

    lastPrecacheReport = {
      version: CACHE_VERSION,
      cached,
      failed,
      completedAt: new Date().toISOString()
    };

    // Activate immediately only on initial install (no active controller yet)
    if (!self.registration.active) {
      await self.skipWaiting();
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((key) => {
        if (!ACTIVE_CACHES.includes(key)) {
          return caches.delete(key);
        }
        return Promise.resolve(false);
      })
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event && event.data ? event.data : {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'GET_PRECACHE_REPORT' && event.ports && event.ports[0]) {
    event.ports[0].postMessage(lastPrecacheReport);
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!request || request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // 1. Sensitive / SOS / Reports / Auth / AI APIs -> Network Only (never cache in Cache Storage)
  if (isSensitiveApi(url)) {
    return;
  }

  // 2. Weather & Disaster APIs -> Network First with WEATHER_CACHE fallback
  if (isWeatherOrDisasterApi(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(WEATHER_CACHE);
      try {
        const networkResp = await fetch(request);
        if (networkResp && networkResp.ok) {
          await cache.put(request, networkResp.clone());
        }
        return networkResp;
      } catch (_) {
        const cachedResp = await cache.match(request);
        if (cachedResp) {
          return cachedResp;
        }
        return new Response(
          JSON.stringify({
            offline: true,
            detail: 'Chưa có dữ liệu ngoại tuyến trong cache cho yêu cầu này.'
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    })());
    return;
  }

  // 3. Map Tiles -> Cache First with bounded TILE_CACHE
  if (isMapTileRequest(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(TILE_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const networkResp = await fetch(request);
        if (networkResp && (networkResp.ok || networkResp.type === 'opaque')) {
          await cache.put(request, networkResp.clone());
          trimTileCache();
        }
        return networkResp;
      } catch (_) {
        return new Response('', { status: 504, statusText: 'Tile Offline' });
      }
    })());
    return;
  }

  // 4. HTML Navigation -> Network First with dedicated Citizen vs Command offline fallback
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const isCitizen = url.pathname.endsWith('/citizen.html') || url.pathname === '/citizen.html';
      try {
        const networkResp = await fetch(request);
        if (networkResp && networkResp.ok) {
          await cache.put(isCitizen ? './citizen.html' : request, networkResp.clone());
        }
        return networkResp;
      } catch (_) {
        const fallbackKey = isCitizen ? './citizen.html' : './index.html';
        const cachedPage = (await cache.match(request)) || (await cache.match(fallbackKey));
        if (cachedPage) return cachedPage;
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>NORTHSTAR Offline</title><body><h3>Đang ngoại tuyến</h3><p>Tài nguyên chưa được tải trước.</p></body>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  // 5. Same-origin static assets -> Cache First
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) {
      return;
    }
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const networkResp = await fetch(request);
        if (networkResp && networkResp.ok) {
          await cache.put(request, networkResp.clone());
        }
        return networkResp;
      } catch (_) {
        return new Response('', { status: 503, statusText: 'Asset Offline' });
      }
    })());
    return;
  }

  // 6. Approved third-party CDN assets (Tailwind, Lucide, Chart.js) -> Cache First in RUNTIME_CACHE
  if (isAllowedCdnAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const networkResp = await fetch(request);
        if (networkResp && (networkResp.ok || networkResp.type === 'opaque')) {
          await cache.put(request, networkResp.clone());
        }
        return networkResp;
      } catch (_) {
        return new Response('/* offline cdn fallback */', {
          status: 200,
          headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
        });
      }
    })());
  }
});

// ============================================================================
// Background Sync integration with Unified Outbox (northstar_citizen_db)
// ============================================================================
function openCitizenIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB in SW'));
  });
}

function idbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function idbGetMeta(db, key) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('sync_metadata', 'readonly');
      const req = tx.objectStore('sync_metadata').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

function idbPut(db, storeName, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

function buildSwSOSPayload(record) {
  const base = record && record.payload && typeof record.payload === 'object'
    ? record.payload
    : (record || {});
  return {
    contact_name: base.contact_name || 'Người dân',
    phone: base.phone || base.contact_phone || '0000000000',
    lng: base.lng !== undefined ? base.lng : null,
    lat: base.lat !== undefined ? base.lat : null,
    location_source: base.location_source || 'manual',
    location_accuracy_m: base.location_accuracy_m ?? null,
    location_captured_at: base.location_captured_at ?? null,
    location_confirmed: base.location_confirmed !== undefined ? Boolean(base.location_confirmed) : true,
    location_description: base.location_description ?? null,
    location_landmark: base.location_landmark ?? null,
    people_count: Number(base.people_count) || 1,
    has_elderly_or_children: Boolean(base.has_elderly_or_children),
    water_level_cm: Number.isFinite(Number(base.water_level_cm)) ? Number(base.water_level_cm) : 0,
    priority: base.priority || base.urgency_level || 'high',
    notes: base.notes !== undefined ? base.notes : (base.note || null),
    client_event_id: record.client_event_id || base.client_event_id
  };
}

function buildSwReportPayload(record) {
  const base = record && record.payload && typeof record.payload === 'object'
    ? record.payload
    : (record || {});
  return {
    lat: Number(base.lat),
    lng: Number(base.lng),
    level: base.level || 'medium',
    photo_url: base.photo_url || null,
    user_id: base.user_id || null,
    client_event_id: record.client_event_id || base.client_event_id
  };
}

async function syncOutboxFromSW() {
  const db = await openCitizenIDB();
  const apiBase = (await idbGetMeta(db, 'api_base_url')) || self.location.origin;
  const cleanBase = String(apiBase).replace(/\/$/, '');

  let acknowledged = 0;
  let failed = 0;

  const processStore = async (storeName, path, buildPayload, extractId) => {
    const records = await idbGetAll(db, storeName);
    for (const rec of records) {
      if (!rec || rec.sync_status !== 'PENDING_OFFLINE' || !rec.client_event_id) continue;
      try {
        const resp = await fetch(`${cleanBase}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(rec))
        });

        if (resp.ok) {
          const data = await resp.json();
          const serverId = extractId(data);
          if (Number.isFinite(Number(serverId))) {
            await idbPut(db, storeName, {
              ...rec,
              sync_status: 'ACKNOWLEDGED',
              server_id: Number(serverId),
              acknowledged_at: new Date().toISOString(),
              last_error: null,
              next_retry_at: null,
              updated_at: new Date().toISOString()
            });
            acknowledged += 1;
            continue;
          }
        }

        if (resp.status >= 400 && resp.status < 500 && resp.status !== 408 && resp.status !== 429) {
          await idbPut(db, storeName, {
            ...rec,
            sync_status: 'FAILED',
            last_error: `HTTP ${resp.status}`,
            updated_at: new Date().toISOString()
          });
          failed += 1;
        }
      } catch (err) {
        // Keep PENDING_OFFLINE for next sync
      }
    }
  };

  await processStore(
    'sos_queue',
    '/api/sos',
    buildSwSOSPayload,
    (d) => d && (d.properties ? d.properties.id : d.id)
  );
  await processStore(
    'flood_reports',
    '/api/reports',
    buildSwReportPayload,
    (d) => d && d.id
  );

  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clientList) {
    client.postMessage({
      type: 'SYNC_COMPLETED',
      summary: { acknowledged, failed }
    });
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'northstar-offline-sync') {
    event.waitUntil(syncOutboxFromSW());
  }
});
