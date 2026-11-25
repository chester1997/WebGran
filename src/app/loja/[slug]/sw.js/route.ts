import { getStorePwaInfo, STORE_APP_BG } from "@/lib/webstore/pwa";

/**
 * Service worker do app da loja (escopo só desta loja).
 * Guarda apenas arquivos estáticos (JS/CSS do Next, ícones). Páginas, login, conta, pedidos,
 * respostas autenticadas e vídeos sempre vão direto para a rede e nunca são guardados.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const info = await getStorePwaInfo(slug);
  if (!info) return new Response("Not found", { status: 404 });

  const base = info.base;
  const cacheName = `loja-${info.slug}-v1`;
  const offline = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(info.name)}</title><style>body{background:${STORE_APP_BG};color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px}p{color:#a1a1aa;font-size:14px;margin:8px 0 22px}button{background:#3b82f6;color:#fff;border:0;padding:11px 22px;border-radius:10px;font-weight:600;font-size:14px}</style></head><body><div><h1 style="font-size:20px;margin:0">Você está sem internet</h1><p>Conecte-se para abrir a ${escapeHtml(info.name)}.</p><button onclick="location.reload()">Tentar de novo</button></div></body></html>`;

  const js = `// App da loja ${JSON.stringify(info.slug)}
const CACHE = ${JSON.stringify(cacheName)};
const BASE = ${JSON.stringify(base)};
const OFFLINE = ${JSON.stringify(offline)};

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("loja-" + ${JSON.stringify(info.slug)} + "-") && k !== CACHE).map((k) => caches.delete(k)))),
  ]));
});

function isStatic(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith(BASE + "/app-icon/") || url.pathname.startsWith("/icons/") || /\\.(?:woff2?|css)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // vídeos (Bunny) e terceiros: nunca passam pelo cache
  if (req.headers.get("range")) return;

  // Páginas: sempre da rede (têm dados do cliente). Sem internet, mostra o aviso.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => new Response(OFFLINE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } })));
    return;
  }

  // Casca do app (arquivos estáticos com nome versionado e ícones): cache primeiro.
  // No localhost os arquivos do Next não mudam de nome a cada versão: lá nunca guarda.
  if (isStatic(url) && self.location.hostname !== "localhost") {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }))
    );
  }
  // Todo o resto (dados, ações, APIs, conta): rede direto, sem guardar
});
`;
  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      // Permite o escopo "/loja/<slug>" (inclui a página inicial da loja, que não tem barra no fim)
      "Service-Worker-Allowed": base,
    },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
