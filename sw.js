// Service Worker for NORTHSTAR (GrassTouchers Frontend)
const CACHE_NAME = 'northstar-cache-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/map_core.js',
  './js/dashboard.js',
  './js/storm_simulator.js',
  './js/vehicle_sim.js',
  './js/voice_warning.js',
  './js/rescue_manager.js',
  './js/demo_suite.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[NORTHSTAR SW] Pre-caching app shell assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[NORTHSTAR SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip caching for dynamic API calls and WebSocket connections
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws') || url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // Stale-while-revalidate for local assets and third-party libraries (Leaflet, Tailwind, Lucide)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        // If offline and request is HTML navigation, fallback to cached index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        console.warn('[NORTHSTAR SW] Fetch failed, serving cache fallback:', err);
      });

      return cachedResponse || fetchPromise;
    })
  );
});
