// OFFLINE DINO - Authentic Offline Service Worker (Cache-First)
// Complete offline-first application shell, resilient precaching, and offline video streaming.

const CACHE_NAME = 'offline-dino-v57';

// 1. Critical Application Shell (HTML, CSS, JavaScript, Manifest, Icons)
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./manifest.json",
  "./favicon.ico",
  "./favicon.png",
  "./apple-touch-icon.png",
  "./icons/favicon.png",
  "./icons/favicon-32x32.png",
  "./icons/favicon-16x16.png",
  "./icons/favicon-48x48.png",
  "./icons/favicon.ico",
  "./icons/favicon.svg",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./assets/offline_dino_mascot_logo.png",
  "./js/sprite_data.js",
  "./js/skins.js",
  "./js/audio.js",
  "./js/three.min.js",
  "./js/dino3d.js",
  "./js/sprites.js",
  "./js/score_math.js",
  "./js/game.js",
  "./js/ui.js"
];

// 2. High-Performance Media Assets (Sprites, Audio Buffers, 3D Model, Intro Video)
const MEDIA_ASSETS = [
  "./assets/models/dino.glb",
  "./assets/audio/sand_step.wav",
  "./assets/audio/sand_step_left.wav",
  "./assets/audio/sand_step_right.wav",
  "./assets/audio/sand_step_land.wav",
  "./assets/audio/sand_slide.wav",
  "./assets/audio/dragon_flap.wav",
  "./assets/audio/dragon_flap_down.wav",
  "./assets/audio/dragon_flap_up.wav",
  "./assets/sprites/homepage_seamless_panorama.jpg",
  "./assets/sprites/homepage_seamless_panorama.jpg?v=33",
  "./assets/sprites/home_bg_desktop.png",
  "./assets/sprites/home_sound_off_patch.png",
  "./assets/sprites/home_title_sign_green.png",
  "./assets/sprites/home_title_sign_blue.png",
  "./assets/sprites/home_title_sign_red.png",
  "./assets/sprites/home_title_sign_orange.png",
  "./assets/sprites/home_title_sign_black.png",
  "./assets/sprites/home_title_sign_yellow.png",
  "./assets/sprites/home_title_sign_purple.png",
  "./assets/sprites/home_title_sign_pink.png",
  "./assets/sprites/btn_home_sound_frame.png",
  "./assets/sprites/btn_mask_skins.png",
  "./assets/sprites/btn_mask_highscore.png",
  "./assets/sprites/btn_mask_sound.png",
  "./assets/sprites/btn_mask_exit.png",
  "./assets/sprites/skin_green.png",
  "./assets/sprites/skin_blue.png",
  "./assets/sprites/skin_red.png",
  "./assets/sprites/skin_yellow.png",
  "./assets/sprites/skin_orange.png",
  "./assets/sprites/skin_purple.png",
  "./assets/sprites/skin_pink.png",
  "./assets/sprites/skin_black.png",
  "./assets/sprites/home_dino_skin_green.png",
  "./assets/sprites/home_dino_skin_blue.png",
  "./assets/sprites/home_dino_skin_red.png",
  "./assets/sprites/home_dino_skin_yellow.png",
  "./assets/sprites/home_dino_skin_orange.png",
  "./assets/sprites/home_dino_skin_purple.png",
  "./assets/sprites/home_dino_skin_pink.png",
  "./assets/sprites/home_dino_skin_black.png",
  "./assets/sprites/bg_day.png",
  "./assets/sprites/bg_night.png",
  "./assets/sprites/cactus_single.png",
  "./assets/sprites/cactus_double.png",
  "./assets/sprites/cactus_small.png",
  "./assets/sprites/cactus_tall.png",
  "./assets/sprites/cactus_triple.png",
  "./assets/sprites/pterodactyl_0.png",
  "./assets/sprites/pterodactyl_1.png",
  "./assets/sprites/dino_idle_0.png",
  "./assets/sprites/dino_idle_1.png",
  "./assets/sprites/dino_idle_2.png",
  "./assets/sprites/dino_idle_3.png",
  "./assets/sprites/dino_idle_sclera.png",
  "./assets/sprites/run_01.png",
  "./assets/sprites/run_02.png",
  "./assets/sprites/run_03.png",
  "./assets/sprites/run_04.png",
  "./assets/sprites/run_05.png",
  "./assets/sprites/run_06.png",
  "./assets/sprites/run_07.png",
  "./assets/sprites/run_08.png",
  "./assets/sprites/run_09.png",
  "./assets/sprites/run_10.png",
  "./assets/sprites/dino_run_0.png",
  "./assets/sprites/dino_run_1.png",
  "./assets/sprites/dino_run_2.png",
  "./assets/sprites/dino_run_3.png",
  "./assets/sprites/dino_run_4.png",
  "./assets/sprites/dino_run_5.png",
  "./assets/sprites/dino_run_6.png",
  "./assets/sprites/dino_run_7.png",
  "./assets/sprites/dino_run_8.png",
  "./assets/sprites/dino_run_9.png",
  "./assets/sprites/jump_01.png",
  "./assets/sprites/jump_02.png",
  "./assets/sprites/jump_03.png",
  "./assets/sprites/jump_04.png",
  "./assets/sprites/jump_05.png",
  "./assets/sprites/jump_06.png",
  "./assets/sprites/jump_07.png",
  "./assets/sprites/jump_08.png",
  "./assets/sprites/jump_09.png",
  "./assets/sprites/jump_10.png",
  "./assets/sprites/dino_jump_0.png",
  "./assets/sprites/dino_jump_1.png",
  "./assets/sprites/dino_jump_2.png",
  "./assets/sprites/dino_jump_3.png",
  "./assets/sprites/dino_jump_4.png",
  "./assets/sprites/dino_jump_5.png",
  "./assets/sprites/dino_jump_6.png",
  "./assets/sprites/dino_jump_7.png",
  "./assets/sprites/dino_jump_8.png",
  "./assets/sprites/dino_jump_9.png",
  "./assets/sprites/duck_01.png",
  "./assets/sprites/duck_02.png",
  "./assets/sprites/duck_03.png",
  "./assets/sprites/duck_04.png",
  "./assets/sprites/duck_05.png",
  "./assets/sprites/duck_06.png",
  "./assets/sprites/duck_07.png",
  "./assets/sprites/duck_08.png",
  "./assets/sprites/duck_09.png",
  "./assets/sprites/duck_10.png",
  "./assets/sprites/dino_duck_0.png",
  "./assets/sprites/dino_duck_1.png",
  "./assets/sprites/dino_duck_2.png",
  "./assets/sprites/dino_duck_3.png",
  "./assets/sprites/dino_duck_4.png",
  "./assets/sprites/dino_duck_5.png",
  "./assets/sprites/dino_duck_6.png",
  "./assets/sprites/dino_duck_7.png",
  "./assets/sprites/dino_duck_8.png",
  "./assets/sprites/dino_duck_9.png",
  "./assets/sprites/dino_hit.png",
  "./assets/sprites/dino_dead.png",
  "./assets/sprites/dino_turn_0.png",
  "./assets/sprites/dino_turn_1.png",
  "./assets/sprites/dino_turn_2.png",
  "./assets/sprites/dino_turn_3.png",
  "./assets/sprites/dino_turn_4.png",
  "./assets/sprites/dino_turn_5.png",
  "./assets/sprites/dino_turn_6.png",
  "./assets/sprites/dino_turn_7.png",
  "./assets/sprites/dino_turn_8.png",
  "./assets/sprites/dino_turn_9.png",
  "./assets/sprites/loading_dino/dino_run_01.png",
  "./assets/sprites/loading_dino/dino_run_02.png",
  "./assets/sprites/loading_dino/dino_run_03.png",
  "./assets/sprites/loading_dino/dino_run_04.png",
  "./assets/sprites/loading_dino/dino_run_05.png",
  "./assets/sprites/loading_dino/dino_run_06.png",
  "./assets/sprites/loading_dino/dino_run_07.png",
  "./assets/sprites/loading_dino/dino_run_08.png",
  "./assets/sprites/loading_dino/dino_run_09.png",
  "./assets/sprites/loading_dino/dino_run_10.png",
  "./assets/sprites/loading_dino/dino_run_11.png",
  "./assets/sprites/loading_dino/dino_run_12.png",
  "./assets/sprites/loading_dino/dino_run_13.png",
  "./assets/sprites/loading_dino/dino_run_14.png",
  "./assets/sprites/loading_dino/dino_run_15.png",
  "./assets/sprites/loading_dino.png",
  "./assets/videos/intro.mp4"
];

// In-memory ArrayBuffer cache to eliminate repeated 15MB disk reads & garbage collection
let cachedVideoBuffer = null;

// Installation: Cache App Shell atomically, followed by resilient media precaching
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // 1. Atomically precache core application shell
      await cache.addAll(CORE_ASSETS);

      // 2. Precache media, sprites, audio and video with individual resilience
      await Promise.all(
        MEDIA_ASSETS.map(async (url) => {
          try {
            const res = await fetch(url);
            if (res && res.status === 200) {
              await cache.put(url, res.clone());
              // For intro video, also store clean pathname keys for bulletproof matching
              if (url.includes('intro.mp4')) {
                await cache.put('/assets/videos/intro.mp4', res.clone());
                await cache.put('./assets/videos/intro.mp4', res.clone());
              }
            }
          } catch (err) {
            console.warn('[SW] Non-critical precache skipped for:', url);
          }
        })
      );

      await self.skipWaiting();
    })()
  );
});

// Activation: Clean up obsolete application caches without destroying user data
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (k.startsWith('offline-dino-') && k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

// Fetch router:
// 1. Video requests -> Progressive HTTP 206 Range Streamer from Cache
// 2. Navigation requests -> Network with Cache Fallback to cached index.html
// 3. Static Assets (Scripts, Styles, Sprites, Audio) -> Cache-First with ignoreSearch
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // 1. Progressive Video Range Handling (Offline & Online)
  if (url.pathname.endsWith('.mp4') || url.pathname.includes('/assets/videos/')) {
    event.respondWith(handleVideoRequest(event));
    return;
  }

  // 2. Navigation requests (HTML document)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, resClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request, { ignoreSearch: true });
          if (cached) return cached;
          return (await caches.match('./index.html', { ignoreSearch: true })) ||
                 (await caches.match('/index.html', { ignoreSearch: true })) ||
                 (await caches.match('./', { ignoreSearch: true }));
        })
    );
    return;
  }

  // 3. All other assets: Cache-First with Network fallback
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, resClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Fallback for relative vs absolute path mismatch
          return (await caches.match(url.pathname, { ignoreSearch: true })) ||
                 (await caches.match('.' + url.pathname, { ignoreSearch: true }));
        });
    })
  );
});

// Progressive video caching & Range request handler for offline playback
async function handleVideoRequest(event) {
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(event.request.url);

  // Match video from cache using all possible key forms
  let cachedResponse = await cache.match(event.request, { ignoreSearch: true });
  if (!cachedResponse) cachedResponse = await cache.match(url.href, { ignoreSearch: true });
  if (!cachedResponse) cachedResponse = await cache.match(url.pathname, { ignoreSearch: true });
  if (!cachedResponse) cachedResponse = await cache.match('/assets/videos/intro.mp4', { ignoreSearch: true });
  if (!cachedResponse) cachedResponse = await cache.match('./assets/videos/intro.mp4', { ignoreSearch: true });

  const rangeHeader = event.request.headers.get('range');

  if (cachedResponse) {
    if (!rangeHeader) {
      return cachedResponse;
    }

    try {
      if (!cachedVideoBuffer) {
        cachedVideoBuffer = await cachedResponse.arrayBuffer();
      }
      const total = cachedVideoBuffer.byteLength;
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;

      if (start >= total || end >= total || start > end) {
        return new Response(null, {
          status: 416,
          statusText: 'Range Not Satisfiable',
          headers: {
            'Content-Range': 'bytes */' + total,
            'Accept-Ranges': 'bytes'
          }
        });
      }

      const chunk = cachedVideoBuffer.slice(start, end + 1);
      return new Response(chunk, {
        status: 206,
        statusText: 'Partial Content',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
          'Content-Length': chunk.byteLength.toString(),
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (e) {
      return cachedResponse;
    }
  }

  // Not in cache: fetch from network and populate cache
  try {
    if (rangeHeader) {
      fetch(event.request.url, { headers: {} })
        .then(async (fullRes) => {
          if (fullRes && fullRes.status === 200) {
            const clone = fullRes.clone();
            await cache.put('./assets/videos/intro.mp4', clone);
            await cache.put('/assets/videos/intro.mp4', fullRes.clone());
            cachedVideoBuffer = await fullRes.arrayBuffer();
          }
        })
        .catch(() => {});
    }

    const networkResponse = await fetch(event.request);
    if (!rangeHeader && networkResponse && networkResponse.status === 200) {
      cache.put('./assets/videos/intro.mp4', networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    return new Response(null, { status: 404, statusText: 'Not Found' });
  }
}
