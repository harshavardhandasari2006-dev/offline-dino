// OFFLINE DINO - Authentic Offline Service Worker (Cache-First)
// Caches all static resources, scripts, stylesheets, and sprites for 100% offline gameplay.

const CACHE_NAME = 'offline-dino-v38';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './manifest.json',
  './favicon.ico',
  './favicon.png',
  './apple-touch-icon.png',
  './icons/favicon.png',
  './icons/favicon-32x32.png',
  './icons/favicon-16x16.png',
  './icons/favicon-48x48.png',
  './icons/favicon.ico',
  './icons/favicon.svg',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './assets/offline_dino_mascot_logo.png',
  './js/sprite_data.js',
  './js/skins.js',
  './js/audio.js',
  './js/three.min.js',
  './js/dino3d.js',
  './js/sprites.js',
  './js/score_math.js',
  './js/game.js',
  './js/ui.js',
  './assets/models/dino.glb',
  // Offline Sand Footstep Audio Assets
  './assets/audio/sand_step.wav',
  './assets/audio/sand_step_left.wav',
  './assets/audio/sand_step_right.wav',
  './assets/audio/sand_step_land.wav',
  // Offline Dragon Audio Assets
  './assets/audio/dragon_flap.wav',
  './assets/audio/dragon_flap_down.wav',
  './assets/audio/dragon_flap_up.wav',
  // Master Continuous Homepage Artwork Panorama
  './assets/sprites/homepage_seamless_panorama.jpg',
  './assets/sprites/homepage_seamless_panorama.jpg?v=33',
  './assets/sprites/home_bg_desktop.png',
  './assets/sprites/home_sound_off_patch.png',
  './assets/sprites/home_title_sign_green.png',
  './assets/sprites/home_title_sign_blue.png',
  './assets/sprites/home_title_sign_red.png',
  './assets/sprites/home_title_sign_orange.png',
  './assets/sprites/home_title_sign_brown.png',
  './assets/sprites/home_title_sign_black.png',
  './assets/sprites/btn_home_sound_frame.png',
  './assets/sprites/btn_mask_skins.png',
  './assets/sprites/btn_mask_highscore.png',
  './assets/sprites/btn_mask_sound.png',
  './assets/sprites/btn_mask_exit.png',
  // 9 Dino Skin Previews
  './assets/sprites/skin_green.png',
  './assets/sprites/skin_blue.png',
  './assets/sprites/skin_red.png',
  './assets/sprites/skin_yellow.png',
  './assets/sprites/skin_orange.png',
  './assets/sprites/skin_purple.png',
  './assets/sprites/skin_pink.png',
  './assets/sprites/skin_brown.png',
  './assets/sprites/skin_black.png',
  // 9 Dino Skin Homepage Overlays
  './assets/sprites/home_dino_skin_green.png',
  './assets/sprites/home_dino_skin_blue.png',
  './assets/sprites/home_dino_skin_red.png',
  './assets/sprites/home_dino_skin_yellow.png',
  './assets/sprites/home_dino_skin_orange.png',
  './assets/sprites/home_dino_skin_purple.png',
  './assets/sprites/home_dino_skin_pink.png',
  './assets/sprites/home_dino_skin_brown.png',
  './assets/sprites/home_dino_skin_black.png',
  // Backgrounds
  './assets/sprites/bg_day.png',
  './assets/sprites/bg_night.png',
  // Obstacles
  './assets/sprites/cactus_single.png',
  './assets/sprites/cactus_double.png',
  './assets/sprites/cactus_small.png',
  './assets/sprites/cactus_tall.png',
  './assets/sprites/cactus_triple.png',
  './assets/sprites/pterodactyl_0.png',
  './assets/sprites/pterodactyl_1.png',
  // Dinosaur Frames
  './assets/sprites/dino_idle_0.png',
  './assets/sprites/dino_idle_1.png',
  './assets/sprites/dino_idle_2.png',
  './assets/sprites/dino_idle_3.png',
  './assets/sprites/dino_idle_sclera.png',
  // Approved 10 Running Animation Frames
  './assets/sprites/run_01.png',
  './assets/sprites/run_02.png',
  './assets/sprites/run_03.png',
  './assets/sprites/run_04.png',
  './assets/sprites/run_05.png',
  './assets/sprites/run_06.png',
  './assets/sprites/run_07.png',
  './assets/sprites/run_08.png',
  './assets/sprites/run_09.png',
  './assets/sprites/run_10.png',
  './assets/sprites/dino_run_0.png',
  './assets/sprites/dino_run_1.png',
  './assets/sprites/dino_run_2.png',
  './assets/sprites/dino_run_3.png',
  './assets/sprites/dino_run_4.png',
  './assets/sprites/dino_run_5.png',
  './assets/sprites/dino_run_6.png',
  './assets/sprites/dino_run_7.png',
  './assets/sprites/dino_run_8.png',
  './assets/sprites/dino_run_9.png',
  // Approved 10 Jump Animation Frames
  './assets/sprites/jump_01.png',
  './assets/sprites/jump_02.png',
  './assets/sprites/jump_03.png',
  './assets/sprites/jump_04.png',
  './assets/sprites/jump_05.png',
  './assets/sprites/jump_06.png',
  './assets/sprites/jump_07.png',
  './assets/sprites/jump_08.png',
  './assets/sprites/jump_09.png',
  './assets/sprites/jump_10.png',
  './assets/sprites/dino_jump_0.png',
  './assets/sprites/dino_jump_1.png',
  './assets/sprites/dino_jump_2.png',
  './assets/sprites/dino_jump_3.png',
  './assets/sprites/dino_jump_4.png',
  './assets/sprites/dino_jump_5.png',
  './assets/sprites/dino_jump_6.png',
  './assets/sprites/dino_jump_7.png',
  './assets/sprites/dino_jump_8.png',
  './assets/sprites/dino_jump_9.png',
  // Approved 10 Duck Animation Frames
  './assets/sprites/duck_01.png',
  './assets/sprites/duck_02.png',
  './assets/sprites/duck_03.png',
  './assets/sprites/duck_04.png',
  './assets/sprites/duck_05.png',
  './assets/sprites/duck_06.png',
  './assets/sprites/duck_07.png',
  './assets/sprites/duck_08.png',
  './assets/sprites/duck_09.png',
  './assets/sprites/duck_10.png',
  './assets/sprites/dino_duck_0.png',
  './assets/sprites/dino_duck_1.png',
  './assets/sprites/dino_duck_2.png',
  './assets/sprites/dino_duck_3.png',
  './assets/sprites/dino_duck_4.png',
  './assets/sprites/dino_duck_5.png',
  './assets/sprites/dino_duck_6.png',
  './assets/sprites/dino_duck_7.png',
  './assets/sprites/dino_duck_8.png',
  './assets/sprites/dino_duck_9.png',
  './assets/sprites/dino_hit.png',
  './assets/sprites/dino_dead.png',
  // Turnaround frames
  './assets/sprites/dino_turn_0.png',
  './assets/sprites/dino_turn_1.png',
  './assets/sprites/dino_turn_2.png',
  './assets/sprites/dino_turn_3.png',
  './assets/sprites/dino_turn_4.png',
  './assets/sprites/dino_turn_5.png',
  './assets/sprites/dino_turn_6.png',
  './assets/sprites/dino_turn_7.png',
  './assets/sprites/dino_turn_8.png',
  './assets/sprites/dino_turn_9.png',
  // Loading screen frame-by-frame dinosaur animation
  './assets/sprites/loading_dino/dino_run_01.png',
  './assets/sprites/loading_dino/dino_run_02.png',
  './assets/sprites/loading_dino/dino_run_03.png',
  './assets/sprites/loading_dino/dino_run_04.png',
  './assets/sprites/loading_dino/dino_run_05.png',
  './assets/sprites/loading_dino/dino_run_06.png',
  './assets/sprites/loading_dino/dino_run_07.png',
  './assets/sprites/loading_dino/dino_run_08.png',
  './assets/sprites/loading_dino/dino_run_09.png',
  './assets/sprites/loading_dino/dino_run_10.png',
  './assets/sprites/loading_dino/dino_run_11.png',
  './assets/sprites/loading_dino/dino_run_12.png',
  './assets/sprites/loading_dino/dino_run_13.png',
  './assets/sprites/loading_dino/dino_run_14.png',
  './assets/sprites/loading_dino/dino_run_15.png',
  './assets/sprites/loading_dino.png'
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
    caches.match(event.request).then((cachedResponse) => {
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
