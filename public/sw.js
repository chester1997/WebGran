// WebGran PWA Service Worker (Etapa 1: Installability & High Security Pass-Through)
const CACHE_NAME = 'webgran-static-v1';

// Static brand assets explicitly safe to pre-cache (brand icons only)
const PRECACHE_ASSETS = [
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for existing tabs to close
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache skipped for some assets:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  // Claim clients immediately and clean up any old cache versions
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. NON-GET REQUESTS: Pass through directly (mutations, server actions, webhooks)
  if (request.method !== 'GET') {
    return;
  }

  // 2. CRITICAL SECURITY BOUNDARY: NEVER cache APIs, auth, billing, or private routes
  // Pass through directly to network
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/seller') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/register') ||
    url.pathname.includes('/checkout') ||
    url.pathname.includes('/order') ||
    request.headers.get('Authorization') ||
    request.headers.get('cookie')
  ) {
    return;
  }

  // 3. NAVIGATION REQUESTS: Always Network-First (Fresh HTML from Vercel)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        return new Response(
          '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WebGran - Offline</title><style>body{background:#121214;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px}h1{font-size:22px;margin-bottom:8px;font-weight:700}p{color:#a1a1aa;font-size:14px;margin-bottom:20px}button{background:#e11d48;color:#fff;border:none;padding:10px 20px;border-radius:12px;font-weight:600;cursor:pointer}</style></head><body><div><h1>Você está offline</h1><p>Conecte-se à internet para continuar navegando no WebGran.</p><button onclick="window.location.reload()">Tentar novamente</button></div></body></html>',
          {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          }
        );
      })
    );
    return;
  }

  // 4. STATIC BRAND ASSETS: Cache-First with Network fallback (icons only)
  if (url.pathname.startsWith('/icons/') || url.pathname.endsWith('.png') || url.pathname.endsWith('.ico')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 5. ALL OTHER REQUESTS: Network-First
  event.respondWith(fetch(request));
});
