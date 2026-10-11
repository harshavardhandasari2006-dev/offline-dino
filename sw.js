// OFFLINE DINO - Authentic Offline Service Worker (Cache-First)
// Caches all static resources, scripts, stylesheets, and sprites for 100% offline gameplay.

const CACHE_NAME = 'offline-dino-v6.0';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './manifest.json',
  './icons/favicon.svg',
  './js/sprite_data.js',
  './js/audio.js',
  './js/sprites.js',
  './js/game.js',
  './js/ui.js',
  // Backgrounds
  './assets/sprites/bg_day.png',
  './assets/sprites/bg_night.png',
  // Obstacles
  './assets/sprites/cactus_single.png',
  './assets/sprites/cactus_double.png',
  './assets/sprites/cactus_small.png',
  './assets/sprites/cactus_tall.png',
  './assets/sprites/pterodactyl_0.png',
  './assets/sprites/pterodactyl_1.png',
  // Dinosaur Frames
  './assets/sprites/dino_idle_0.png',
  './assets/sprites/dino_idle_1.png',
  './assets/sprites/dino_idle_2.png',
  './assets/sprites/dino_idle_3.png',
  './assets/sprites/dino_run_0.png',
  './assets/sprites/dino_run_1.png',
  './assets/sprites/dino_run_2.png',
  './assets/sprites/dino_run_3.png',
  './assets/sprites/dino_run_4.png',
  './assets/sprites/dino_jump_0.png',
  './assets/sprites/dino_jump_1.png',
  './assets/sprites/dino_jump_2.png',
  './assets/sprites/dino_jump_3.png',
  './assets/sprites/dino_jump_4.png',
  './assets/sprites/dino_duck_0.png',
  './assets/sprites/dino_duck_1.png',
  './assets/sprites/dino_duck_2.png',
  './assets/sprites/dino_duck_3.png',
  './assets/sprites/dino_duck_4.png',
  './assets/sprites/dino_hit.png',
  './assets/sprites/dino_dead.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Dual strategy:
// 1. Code & markup assets (HTML, JS, CSS): Network-First with Cache fallback.
//    Ensures code updates take effect immediately on reload while guaranteeing 100% offline gameplay.
// 2. Static media assets (PNG, SVG, audio): Cache-First with Network fallback.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  const isCodeOrDoc = event.request.mode === 'navigate' ||
                      url.pathname.endsWith('.html') ||
                      url.pathname.endsWith('.js') ||
                      url.pathname.endsWith('.css') ||
                      url.pathname.endsWith('/') ||
                      url.pathname === '';

  if (isCodeOrDoc) {
    // Network-First with Cache Fallback for code assets
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
        });
      })
    );
    return;
  }

  // Cache-First for static media (sprites, fonts, icons)
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
