// WebGran PWA Service Worker (Etapa 1: Installability & High Security Pass-Through)
const CACHE_NAME = 'webgran-static-v11';

// Static brand assets explicitly safe to pre-cache (brand icons, notification badges and notification chime sounds)
const PRECACHE_ASSETS = [
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/badge-72x72.png',
  '/icons/badge-96x96.png',
  '/icons/badge-128x128.png',
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
            .filter(
              (key) => key.startsWith('webgran-') && key !== CACHE_NAME
            )
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
  // Requisições com cabeçalho Range (mídia HTML5 audio/video): bypass de cache direto para a rede (bug Chromium #73692)
  if (request.headers.get('range')) {
    event.respondWith(fetch(request));
    return;
  }

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

/**
 * Consulta assíncrona ao IndexedDB para obter preferências de som mesmo quando o PWA está fechado.
 * Retorna { soundEnabled, volume, soundId } ou null em caso de falha/inexistência.
 */
function getSoundPreferenceFromIndexedDB(userId) {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }

    try {
      const openReq = indexedDB.open('webgran_notifications_db', 1);

      openReq.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('sound_preferences')) {
          db.createObjectStore('sound_preferences', { keyPath: 'key' });
        }
      };

      openReq.onsuccess = (e) => {
        const db = e.target.result;
        try {
          if (!db.objectStoreNames.contains('sound_preferences')) {
            db.close();
            resolve(null);
            return;
          }

          const tx = db.transaction('sound_preferences', 'readonly');
          const store = tx.objectStore('sound_preferences');
          const queryKey = userId ? `user_${userId}` : 'active_preference';
          const getReq = store.get(queryKey);

          getReq.onsuccess = () => {
            const res = getReq.result;
            if (res) {
              db.close();
              resolve(res);
            } else if (userId) {
              // Fallback para chave ativa se o usuário específico não estiver registrado
              const fallbackReq = store.get('active_preference');
              fallbackReq.onsuccess = () => {
                db.close();
                resolve(fallbackReq.result || null);
              };
              fallbackReq.onerror = () => {
                db.close();
                resolve(null);
              };
            } else {
              db.close();
              resolve(null);
            }
          };

          getReq.onerror = () => {
            db.close();
            resolve(null);
          };
        } catch {
          try { db.close(); } catch {}
          resolve(null);
        }
      };

      openReq.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

// 6. WEB PUSH NOTIFICATIONS COM CONFIRMAÇÃO BIDIRECIONAL (MessageChannel)
async function handlePushEvent(event) {
  let data = {
    title: 'WebGran',
    body: 'Você tem uma nova notificação.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-96x96.png',
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
    : new URL('/icons/badge-96x96.png', self.location.origin).href;

  const notificationTag = typeof data.tag === 'string' && data.tag.trim().length > 0 ? data.tag.trim() : null;
  // Prioriza data.tag para garantir identificadores independentes entre venda (sale-*) e comissão (commission-*)
  const notificationId = notificationTag || data.data?.orderId || `push-${Date.now()}`;

  // Base de opções (sem vibrate fixo para conformidade com a especificação W3C Notifications API)
  const baseOptions = {
    body: data.body,
    icon: iconUrl,
    badge: badgeUrl,
    timestamp: Date.now(),
    data: {
      url: data.url || '/seller/financeiro',
      dateOfArrival: Date.now(),
      notificationId,
      ...(data.data || {}),
    },
  };

  // Conforme a especificação W3C Notifications API: renotify SÓ pode ser true se tag for definida
  if (notificationTag) {
    baseOptions.tag = notificationTag;
    baseOptions.renotify = true;
  }

  if (data.image) {
    baseOptions.image = data.image.startsWith('http')
      ? data.image
      : new URL(data.image, self.location.origin).href;
  }

  // 1. Tentar obter confirmação honesta de clientes com janelas abertas
  let clientHandledSilently = false;

  try {
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });

    if (windowClients && windowClients.length > 0) {
      // Ordena clientes: janelas focadas/visíveis primeiro para priorizar quem tem foco ativo
      const sortedClients = [...windowClients].sort((a, b) => {
        if (a.focused && !b.focused) return -1;
        if (!a.focused && b.focused) return 1;
        if (a.visibilityState === 'visible' && b.visibilityState !== 'visible') return -1;
        if (a.visibilityState !== 'visible' && b.visibilityState === 'visible') return 1;
        return 0;
      });

      // Timeout defensivo de 1.000 ms (1 segundo) para as páginas responderem
      const channelPromise = new Promise((resolve) => {
        let positiveResolved = false;
        let pendingResponses = sortedClients.length;

        const timeoutId = setTimeout(() => {
          if (!positiveResolved) {
            resolve({ confirmed: false, reason: 'timeout' });
          }
        }, 1000);

        for (const client of sortedClients) {
          const channel = new MessageChannel();
          channel.port1.onmessage = (msgEvent) => {
            pendingResponses--;
            const res = msgEvent.data;

            // Se qualquer janela confirmar positivamente a reprodução ou exibição em foco:
            if (!positiveResolved && res && res.confirmed) {
              positiveResolved = true;
              clearTimeout(timeoutId);
              try { channel.port1.close(); } catch {}
              resolve(res);
              return;
            }

            // Se todas as janelas responderam e nenhuma confirmou positivamente:
            if (!positiveResolved && pendingResponses <= 0) {
              clearTimeout(timeoutId);
              try { channel.port1.close(); } catch {}
              resolve({ confirmed: false, reason: 'all_clients_negative' });
            }
          };

          // Envia SALE_SOUND com canal de resposta dedicado
          client.postMessage(
            {
              type: 'SALE_SOUND',
              soundId: 'commission',
              notificationId,
              payload: data,
            },
            [channel.port2]
          );
        }
      });

      const result = await channelPromise;
      if (result && result.confirmed) {
        // Confirmação honesta: som tocou com sucesso OU preferência desligada com página visível em foco
        clientHandledSilently = true;
      }
    }
  } catch (err) {
    console.warn('[SW] Erro na negociação de áudio com janela:', err);
  }

  // 2. Quando o PWA estiver fechado (ou nenhuma janela confirmou o som em primeiro plano):
  // Consulta IndexedDB para verificar se o usuário desligou o som de notificações
  let shouldPlaySoundWithAppClosed = true;

  if (!clientHandledSilently) {
    try {
      const recipientId = data.data?.recipientUserId || data.data?.sellerId || data.data?.userId || data.data?.ownerId;
      const idbPrefs = await getSoundPreferenceFromIndexedDB(recipientId);
      if (idbPrefs && typeof idbPrefs.soundEnabled === 'boolean') {
        shouldPlaySoundWithAppClosed = idbPrefs.soundEnabled;
      }
    } catch (err) {
      // Fallback seguro documentado: em caso de erro no IndexedDB,
      // mantém shouldPlaySoundWithAppClosed = true para não silenciar alertas importantes de vendas.
      shouldPlaySoundWithAppClosed = true;
    }
  }

  // Decisão de notificação rigorosamente compatível com a especificação W3C:
  // - silent: true NÃO PODE incluir vibrate (lança TypeError: vibrate cannot be set if silent is true).
  //   Portanto, no ramo silencioso, as opções são montadas SEM a propriedade vibrate.
  // - silent: false inclui vibrate [200, 100, 200] para alertar via hardware no Android / SO.
  let finalOptions;
  if (clientHandledSilently || !shouldPlaySoundWithAppClosed) {
    finalOptions = {
      ...baseOptions,
      silent: true,
    };
  } else {
    finalOptions = {
      ...baseOptions,
      silent: false,
      vibrate: [200, 100, 200],
    };
  }

  return self.registration.showNotification(data.title, finalOptions);
}

self.addEventListener('push', (event) => {
  event.waitUntil(handlePushEvent(event));
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
