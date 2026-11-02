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

export const WEBGRAN_NOTIFICATION_BRAND = {
  name: "WebGran",
  defaultIcon: "/icons/icon-192x192.png",
  defaultBadge: "/icons/badge-72x72.png",
  defaultSound: "/sounds/commission.mp3",
} as const;

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
}): StandardPushPayload {
  const { orderId, amount, itemTitle, storeId } = params;
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
}): StandardPushPayload {
  const { orderId, feeReais, eventType } = params;
  const formattedFee = formatNotificationBRL(feeReais);

  let title = "💰 Comissão WebGran";
  let body = `Comissão de ${formattedFee} confirmada`;

  if (eventType === "COMMISSION_SETTLED") {
    title = "💰 Comissão recebida";
    body = `Você recebeu ${formattedFee} em comissão`;
  }

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
    icon: payload.icon || WEBGRAN_NOTIFICATION_BRAND.defaultIcon,
    badge: payload.badge || WEBGRAN_NOTIFICATION_BRAND.defaultBadge,
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
  origin: string = "https://webgran.com.br"
): WebGranServiceWorkerNotificationOptions {
  const notificationTag = typeof data.tag === "string" && data.tag.trim().length > 0 ? data.tag.trim() : null;
  // Prioriza tag única para distinguir vendas (sale-*) e comissões (commission-*)
  const notificationId = notificationTag || data.data?.orderId || `push-${Date.now()}`;

  const iconUrl = data.icon
    ? (data.icon.startsWith("http") ? data.icon : `${origin}${data.icon.startsWith("/") ? "" : "/"}${data.icon}`)
    : `${origin}/icons/icon-192x192.png`;

  const badgeUrl = data.badge
    ? (data.badge.startsWith("http") ? data.badge : `${origin}${data.badge.startsWith("/") ? "" : "/"}${data.badge}`)
    : `${origin}/icons/badge-96x96.png`;

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
