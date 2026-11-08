/**
 * Construtor Centralizado de Payloads de Notificação do WebGran.
 * Garante padronização visual completa (ícone, badge, formatação BRL, tags e dados de navegação)
 * para todos os perfis de usuário (vendedores e administradores).
 */

export interface BasePushData {
  type: string;
  url: string;
  [key: string]: any;
}

export interface StandardPushPayload {
  title: string;
  body: string;
  icon: string;
  badge: string;
  url: string;
  tag: string;
  data: BasePushData;
}

export const WEBGRAN_CANONICAL_DOMAIN = "https://www.webgran.online";

export const WEBGRAN_NOTIFICATION_BRAND = {
  name: "WebGran",
  canonicalOrigin: WEBGRAN_CANONICAL_DOMAIN,
  defaultIcon: "/icons/icon-192x192.png",
  defaultBadge: "/icons/badge-72x72.png",
  defaultSound: "/sounds/commission.mp3",
  canonicalIcon: `${WEBGRAN_CANONICAL_DOMAIN}/icons/icon-192x192.png`,
  canonicalBadge: `${WEBGRAN_CANONICAL_DOMAIN}/icons/badge-72x72.png`,
  canonicalSound: `${WEBGRAN_CANONICAL_DOMAIN}/sounds/commission.mp3`,
} as const;

/**
 * Normaliza qualquer URL de asset de notificação para URL canônica sem redirect 308.
 * Android OS Notification Manager recusa seguir redirects HTTP 301/308 para ícones e badges.
 */
export function resolveNotificationAssetUrl(url: string | undefined | null, fallbackUrl: string): string {
  if (!url || typeof url !== "string" || url.trim().length === 0) {
    return fallbackUrl;
  }
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    // Normaliza apex webgran.online -> www.webgran.online para evitar 308 redirect
    if (trimmed.includes("webgran.online") && !trimmed.includes("www.webgran.online")) {
      return trimmed.replace("webgran.online", "www.webgran.online");
    }
    return trimmed;
  }
  return trimmed;
}

/**
 * Formata valores monetários no padrão oficial brasileiro (BRL - pt-BR).
 * Substitui espaços não quebráveis (\u00A0) por espaço normal para evitar quebras em leitores.
 */
export function formatNotificationBRL(amount: number | string): string {
  const num = typeof amount === "number" ? amount : parseFloat(String(amount)) || 0;
  return (isNaN(num) ? 0 : num)
    .toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
    .replace(/\u00A0/g, " ");
}

/**
 * 1. Payload de Nova Venda Aprovada (Padrão Global WebGran)
 * Destinado ao vendedor dono da loja.
 */
export function buildSaleNotificationPayload(params: {
  orderId: string;
  amount: number | string;
  itemTitle?: string;
  storeId?: string;
  sellerId?: string;
  recipientUserId?: string;
}): StandardPushPayload {
  const { orderId, amount, itemTitle, storeId, sellerId, recipientUserId } = params;
  const formattedAmount = formatNotificationBRL(amount);
  const title = "🛒 Nova venda no WebGran";
  const body = `Você recebeu ${formattedAmount}`;

  return {
    title,
    body,
    icon: WEBGRAN_NOTIFICATION_BRAND.defaultIcon,
    badge: WEBGRAN_NOTIFICATION_BRAND.defaultBadge,
    url: "/seller/financeiro",
    tag: `sale-${orderId}`,
    data: {
      type: "SALE",
      orderId,
      storeId: storeId || "",
      sellerId: sellerId || recipientUserId || "",
      recipientUserId: recipientUserId || sellerId || "",
      amount: typeof amount === "number" ? amount : parseFloat(String(amount)) || 0,
      itemTitle: itemTitle || "Produto",
      url: "/seller/financeiro",
    },
  };
}

/**
 * 2. Payload de Notificação de Teste
 * Compartilhado identicamente entre vendedores e administradores.
 */
export function buildTestNotificationPayload(params?: {
  userName?: string;
  role?: string;
}): StandardPushPayload {
  return {
    title: "🔔 Notificações ativas no WebGran",
    body: "Suas notificações estão configuradas e funcionando corretamente.",
    icon: WEBGRAN_NOTIFICATION_BRAND.defaultIcon,
    badge: WEBGRAN_NOTIFICATION_BRAND.defaultBadge,
    url: "/seller/settings",
    tag: "test-notification",
    data: {
      type: "TEST",
      isTest: true,
      userName: params?.userName || "",
      role: params?.role || "seller",
      url: "/seller/settings",
    },
  };
}

/**
 * 3. Payload de Liberação de Acesso / Entrega de Pedido
 * Enviado quando o acesso digital/conteúdo do pedido é liberado.
 */
export function buildAccessDeliveredPayload(params: {
  orderId: string;
  itemTitle?: string;
  storeId?: string;
}): StandardPushPayload {
  const { orderId, itemTitle = "Produto", storeId } = params;
  return {
    title: "✨ Acesso liberado no WebGran",
    body: `O acesso ao produto ${itemTitle} foi entregue com sucesso.`,
    icon: WEBGRAN_NOTIFICATION_BRAND.defaultIcon,
    badge: WEBGRAN_NOTIFICATION_BRAND.defaultBadge,
    url: "/seller/orders",
    tag: `delivery-${orderId}`,
    data: {
      type: "ACCESS_DELIVERED",
      orderId,
      storeId: storeId || "",
      itemTitle,
      url: "/seller/orders",
    },
  };
}

/**
 * 4. Payload de Pagamento Pendente (Pix Gerado)
 * Alerta operacional de intenção de compra / Pix gerado.
 */
export function buildPaymentPendingPayload(params: {
  orderId: string;
  amount: number | string;
  storeId?: string;
}): StandardPushPayload {
  const { orderId, amount, storeId } = params;
  const formattedAmount = formatNotificationBRL(amount);

  return {
    title: "⏳ Pedido aguardando pagamento",
    body: `Pix de ${formattedAmount} gerado no WebGran.`,
    icon: WEBGRAN_NOTIFICATION_BRAND.defaultIcon,
    badge: WEBGRAN_NOTIFICATION_BRAND.defaultBadge,
    url: "/seller/orders",
    tag: `pending-${orderId}`,
    data: {
      type: "PAYMENT_PENDING",
      orderId,
      storeId: storeId || "",
      amount: typeof amount === "number" ? amount : parseFloat(String(amount)) || 0,
      url: "/seller/orders",
    },
  };
}

/**
 * 5. Payload de Comissão da Plataforma (EXCLUSIVO DO PROPRIETÁRIO)
 * Distingue liquidação bancária de processamento de split confirmado.
 */
export function buildPlatformCommissionPayload(params: {
  orderId: string;
  feeReais: number | string;
  eventType: "SPLIT_PROCESSED" | "COMMISSION_CONFIRMED" | "COMMISSION_SETTLED" | string;
  ownerId?: string;
  recipientUserId?: string;
}): StandardPushPayload {
  const { orderId, feeReais, eventType, ownerId, recipientUserId } = params;
  const formattedFee = formatNotificationBRL(feeReais);

  const title = "💰 Taxas Recebidas!";
  const body = `Taxa de ${formattedFee} recebida!`;

  return {
    title,
    body,
    icon: WEBGRAN_NOTIFICATION_BRAND.defaultIcon,
    badge: WEBGRAN_NOTIFICATION_BRAND.defaultBadge,
    url: "/admin/commission",
    tag: `commission-${orderId}-${eventType.toLowerCase()}`,
    data: {
      type: "PLATFORM_COMMISSION",
      orderId,
      eventType,
      recipientUserId: recipientUserId || ownerId || "",
      feeReais: typeof feeReais === "number" ? feeReais : parseFloat(String(feeReais)) || 0,
      url: "/admin/commission",
    },
  };
}

/**
 * Normaliza qualquer payload de entrada garantindo padrões oficiais do WebGran
 * para ícone, badge, fallback de navegação e estrutura de dados.
 */
export function standardizePushPayload(payload: {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, any>;
}): StandardPushPayload {
  const targetUrl = payload.url || "/seller/financeiro";

  return {
    title: payload.title || "Notificação WebGran",
    body: payload.body || "Você tem uma nova notificação.",
    icon: resolveNotificationAssetUrl(payload.icon, WEBGRAN_NOTIFICATION_BRAND.defaultIcon),
    badge: resolveNotificationAssetUrl(payload.badge, WEBGRAN_NOTIFICATION_BRAND.defaultBadge),
    url: targetUrl,
    tag: payload.tag || "general",
    data: {
      ...(payload.data || {}),
      type: payload.data?.type || "GENERAL",
      url: targetUrl,
    },
  };
}

export interface WebGranServiceWorkerNotificationOptions {
  body: string;
  icon: string;
  badge: string;
  timestamp: number;
  data: Record<string, any>;
  tag?: string;
  renotify?: boolean;
  image?: string;
  silent: boolean;
  vibrate?: number[];
}

/**
 * Monta as opções do showNotification respeitando estritamente a especificação W3C Notifications API:
 * 1. silent: true NUNCA pode conter vibrate (a especificação lança TypeError caso vibrate esteja presente).
 * 2. silent: false inclui o padrão de vibração [200, 100, 200] para dispositivos móveis / Android.
 * 3. renotify: true SÓ pode ser incluído se houver tag válida e não-vazia.
 */
export function buildPushNotificationOptions(
  data: {
    title?: string;
    body?: string;
    icon?: string;
    badge?: string;
    url?: string;
    tag?: string;
    data?: Record<string, any>;
    image?: string;
    [key: string]: any;
  },
  clientHandledSilently: boolean,
  origin: string = WEBGRAN_CANONICAL_DOMAIN
): WebGranServiceWorkerNotificationOptions {
  const notificationTag = typeof data.tag === "string" && data.tag.trim().length > 0 ? data.tag.trim() : null;
  // Prioriza tag única para distinguir vendas (sale-*) e comissões (commission-*)
  const notificationId = notificationTag || data.data?.orderId || `push-${Date.now()}`;

  const iconUrl = resolveNotificationAssetUrl(data.icon, `${origin}/icons/icon-192x192.png`);
  const badgeUrl = resolveNotificationAssetUrl(data.badge, `${origin}/icons/badge-72x72.png`);

  const baseOptions: Omit<WebGranServiceWorkerNotificationOptions, "silent" | "vibrate"> = {
    body: data.body || "",
    icon: iconUrl,
    badge: badgeUrl,
    timestamp: Date.now(),
    data: {
      url: data.url || "/seller/financeiro",
      dateOfArrival: Date.now(),
      notificationId,
      ...(data.data || {}),
    },
  };

  if (notificationTag) {
    baseOptions.tag = notificationTag;
    baseOptions.renotify = true;
  }

  if (data.image) {
    baseOptions.image = data.image.startsWith("http")
      ? data.image
      : `${origin}${data.image.startsWith("/") ? "" : "/"}${data.image}`;
  }

  if (clientHandledSilently) {
    // Ramo silencioso: NUNCA inclui vibrate (evita TypeError na spec W3C)
    return {
      ...baseOptions,
      silent: true,
    };
  }

  return {
    ...baseOptions,
    silent: false,
    vibrate: [200, 100, 200],
  };
}
