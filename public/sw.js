// WebGran PWA Service Worker (Etapa 1: Installability & High Security Pass-Through)
const CACHE_NAME = 'webgran-static-v6';

// Static brand assets explicitly safe to pre-cache (brand icons, notification badges and notification chime sounds)
const PRECACHE_ASSETS = [
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/badge-72x72.png',
  '/icons/badge-96x96.png',
  '/icons/apple-touch-icon.png',
  '/sounds/commission.mp3',
  '/sounds/commission.ogg',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for existing tabs to close
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        PRECACHE_ASSETS.map(async (asset) => {
          try {
            const res = await fetch(asset, { cache: 'reload' });
            if (res.ok) {
              await cache.put(asset, res);
            }
          } catch (err) {
            console.warn('[SW] Precache skipped for asset:', asset, err);
          }
        })
      );
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

  // 4. STATIC BRAND ASSETS: Cache-First with Network fallback (icons and notification sounds)
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/sounds/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.ogg')
  ) {
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

// 6. WEB PUSH NOTIFICATIONS
self.addEventListener('push', (event) => {
  let data = {
    title: 'WebGran',
    body: 'Você tem uma nova notificação.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    url: '/seller/financeiro',
    tag: 'webgran-notification',
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  // Garante URLs absolutas acessíveis para o sistema operacional renderizar
  const iconUrl = data.icon
    ? (data.icon.startsWith('http') ? data.icon : new URL(data.icon, self.location.origin).href)
    : new URL('/icons/icon-192x192.png', self.location.origin).href;

  const badgeUrl = data.badge
    ? (data.badge.startsWith('http') ? data.badge : new URL(data.badge, self.location.origin).href)
    : new URL('/icons/badge-72x72.png', self.location.origin).href;

  const options = {
    body: data.body,
    icon: iconUrl,
    badge: badgeUrl,
    silent: false,
    vibrate: [200, 100, 200, 100, 200],
    timestamp: Date.now(),
    data: {
      url: data.url || '/seller/financeiro',
      dateOfArrival: Date.now(),
      ...(data.data || {}),
    },
    tag: data.tag || 'webgran-general',
    renotify: true,
  };

  if (data.image) {
    options.image = data.image.startsWith('http')
      ? data.image
      : new URL(data.image, self.location.origin).href;
  }

  // Notifica clientes com janelas abertas em primeiro plano para reprodução do som personalizado
  const notifyForegroundClients = clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((windowClients) => {
      for (const client of windowClients) {
        client.postMessage({
          type: 'WEBGRAN_PUSH_RECEIVED',
          payload: data,
        });
      }
    })
    .catch((err) => {
      console.warn('[SW] Falha ao enviar evento para clientes em primeiro plano:', err);
    });

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      notifyForegroundClients,
    ])
  );
});

// 7. NOTIFICATION CLICK HANDLING
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/seller/financeiro';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se houver uma aba aberta no mesmo domínio, foca nela e navega para targetUrl
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // Se não houver janela aberta, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
