"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, webSupportTickets } from "@/db/schema";
import { CheckoutService } from "@/lib/orders/checkout-service";
import { ProductVideoService } from "@/lib/videos/product-video-service";
import {
  closeWebSession,
  getWebCustomer,
  getWebStore,
  loginWebCustomer,
  registerWebCustomer,
  type RegisterInput,
} from "@/lib/webstore/web-store";
import { quoteCart, type CartLine, type CartQuote } from "@/lib/webstore/catalog";
import { WEB_ACTIVE } from "@/lib/webstore/scope";

type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function ctx(slug: string) {
  const store = await getWebStore(slug);
  if (!store) return null;
  const customer = await getWebCustomer(store.id);
  return { store, customer };
}

export async function registerAction(slug: string, input: RegisterInput): Promise<Res> {
  const store = await getWebStore(slug);
  if (!store) return { ok: false, error: "Loja não encontrada." };
  return registerWebCustomer(store, {
    name: String(input.name || ""),
    email: String(input.email || ""),
    password: String(input.password || ""),
    whatsapp: String(input.whatsapp || ""),
    telegram: String(input.telegram || ""),
  });
}

export async function loginAction(slug: string, email: string, password: string): Promise<Res> {
  const store = await getWebStore(slug);
  if (!store) return { ok: false, error: "Loja não encontrada." };
  return loginWebCustomer(store, String(email || ""), String(password || ""));
}

export async function logoutAction(slug: string): Promise<void> {
  const store = await getWebStore(slug);
  if (store) await closeWebSession(store.id);
}

export async function quoteAction(slug: string, lines: CartLine[]): Promise<Res<{ quote: CartQuote }>> {
  const store = await getWebStore(slug);
  if (!store) return { ok: false, error: "Loja não encontrada." };
  return { ok: true, quote: await quoteCart(store.id, lines) };
}

export async function checkoutAction(slug: string, lines: CartLine[], couponCode?: string): Promise<Res<{ orderId: string }>> {
  const c = await ctx(slug);
  if (!c) return { ok: false, error: "Loja não encontrada." };
  if (!c.customer) return { ok: false, error: "Entre na sua conta para finalizar a compra." };
  const quote = await quoteCart(c.store.id, lines);
  if (!quote.lines.length) return { ok: false, error: "Seu carrinho está vazio." };
  const res = await CheckoutService.createCheckout({
    storeId: c.store.id,
    customerId: c.customer.shadowCustomerId,
    storeSlug: slug,
    items: quote.lines.map((l) => ({ id: l.id, quantity: l.quantity, isCombo: l.isCombo, comboId: l.isCombo ? l.id : null })),
    couponCode: couponCode?.trim() || undefined,
    sessionId: `web:${c.customer.id}`,
    originBotId: null,
    productStatus: WEB_ACTIVE,
    comboStatus: WEB_ACTIVE,
  });
  if (!res.success || !res.orderId) return { ok: false, error: res.error || "Não foi possível gerar o PIX." };
  return { ok: true, orderId: res.orderId };
}

export interface OrderView {
  id: string;
  status: string;
  total: number;
  discount: number;
  pixQrCode: string | null;
  pixQrCodeBase64: string | null;
  pixExpiresAt: string | null;
}

/** Status do pedido do próprio cliente; se pendente, consulta o gateway (mesma rotina do Mini App). */
export async function orderStatusAction(slug: string, orderId: string): Promise<Res<{ order: OrderView }>> {
  const c = await ctx(slug);
  if (!c?.customer) return { ok: false, error: "Sessão expirada. Entre novamente." };
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return { ok: false, error: "Pedido inválido." };
  let order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.storeId, c.store.id), eq(orders.customerId, c.customer.shadowCustomerId)),
  });
  if (!order) return { ok: false, error: "Pedido não encontrado." };
  if (order.status === "pending") {
    try {
      const { syncOrderWithMercadoPago } = await import("@/lib/payments/order-sync");
      await syncOrderWithMercadoPago(order.id);
      order = (await db.query.orders.findFirst({ where: eq(orders.id, order.id) })) || order;
    } catch (err) {
      console.warn("[LojaWeb] Falha ao consultar o pagamento:", err);
    }
  }
  return {
    ok: true,
    order: {
      id: order.id,
      status: order.status,
      total: Number(order.total),
      discount: Number(order.discount),
      pixQrCode: order.pixQrCode,
      pixQrCodeBase64: order.pixQrCodeBase64,
      pixExpiresAt: order.pixExpiresAt ? order.pixExpiresAt.toISOString() : null,
    },
  };
}

export async function openTicketAction(
  slug: string,
  input: { subject: string; message: string; orderId?: string | null; contactVia: string }
): Promise<Res> {
  const c = await ctx(slug);
  if (!c?.customer) return { ok: false, error: "Entre na sua conta para pedir suporte." };
  const subject = String(input.subject || "").trim().slice(0, 120);
  const message = String(input.message || "").trim().slice(0, 2000);
  if (subject.length < 3) return { ok: false, error: "Escolha o assunto." };
  if (message.length < 5) return { ok: false, error: "Conte o que aconteceu." };
  const contactVia = ["whatsapp", "telegram", "email"].includes(input.contactVia) ? input.contactVia : "email";
  let orderId: string | null = null;
  if (input.orderId && /^[0-9a-f-]{36}$/i.test(input.orderId)) {
    const o = await db.query.orders.findFirst({
      where: and(eq(orders.id, input.orderId), eq(orders.storeId, c.store.id), eq(orders.customerId, c.customer.shadowCustomerId)),
      columns: { id: true },
    });
    orderId = o?.id || null;
  }
  // Limite simples: no máximo 5 pedidos abertos por cliente.
  const open = await db.query.webSupportTickets.findMany({
    where: and(eq(webSupportTickets.webCustomerId, c.customer.id), eq(webSupportTickets.status, "open")),
    columns: { id: true },
  });
  if (open.length >= 5) return { ok: false, error: "Você já tem pedidos de suporte em aberto. Aguarde a resposta da loja." };
  await db.insert(webSupportTickets).values({ storeId: c.store.id, webCustomerId: c.customer.id, orderId, subject, message, contactVia });
  return { ok: true };
}

/* ---------------------------- vídeos ---------------------------- */

export async function productVideosAction(slug: string, productId: string) {
  const c = await ctx(slug);
  if (!c?.customer) return { ok: false as const, error: "Entre na sua conta." };
  try {
    const videos = await ProductVideoService.listCustomerProductVideos(c.store.id, c.customer.shadowCustomerId, productId);
    return { ok: true as const, videos };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message || "Sem acesso a este produto." };
  }
}

export async function playbackAction(slug: string, videoId: string, productId?: string) {
  const c = await ctx(slug);
  if (!c?.customer) return { ok: false as const, error: "Entre na sua conta." };
  try {
    const data = await ProductVideoService.getProductVideoForPlayback(c.store.id, c.customer.shadowCustomerId, videoId, productId);
    return { ok: true as const, data: JSON.parse(JSON.stringify(data)) as typeof data };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message || "Sem acesso a este vídeo." };
  }
}

export async function progressAction(slug: string, videoId: string, positionSeconds: number, durationSeconds: number) {
  const c = await ctx(slug);
  if (!c?.customer) return;
  try {
    await ProductVideoService.upsertVideoProgress(c.store.id, c.customer.shadowCustomerId, videoId, positionSeconds, durationSeconds);
  } catch {
    // não bloqueia o player
  }
}

/* ---------------------------- perfil ---------------------------- */

export async function profileAction(slug: string, input: { name: string; whatsapp: string; telegram: string }): Promise<Res> {
  const c = await ctx(slug);
  if (!c?.customer) return { ok: false, error: "Entre na sua conta." };
  const { updateWebProfile } = await import("@/lib/webstore/profile");
  return updateWebProfile(c.customer, { name: String(input?.name || ""), whatsapp: String(input?.whatsapp || ""), telegram: String(input?.telegram || "") });
}

export async function passwordAction(slug: string, current: string, next: string): Promise<Res> {
  const c = await ctx(slug);
  if (!c?.customer) return { ok: false, error: "Entre na sua conta." };
  const { changeWebPassword } = await import("@/lib/webstore/profile");
  return changeWebPassword(c.customer, String(current || ""), String(next || ""));
}

/** Foto de perfil: imagem já reduzida no navegador (até ~400 KB), enviada para o armazenamento da loja. */
export async function avatarAction(slug: string, dataUrl: string | null): Promise<Res<{ url: string | null }>> {
  const c = await ctx(slug);
  if (!c?.customer) return { ok: false, error: "Entre na sua conta." };
  const { setWebAvatar } = await import("@/lib/webstore/profile");
  if (!dataUrl) {
    await setWebAvatar(c.customer.shadowCustomerId, null);
    return { ok: true, url: null };
  }
  const m = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  if (!m) return { ok: false, error: "Envie uma imagem JPG, PNG ou WebP." };
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 400 * 1024) return { ok: false, error: "A imagem ficou grande demais. Tente outra." };
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isWebp = buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
  if (!isPng && !isJpg && !isWebp) return { ok: false, error: "Arquivo de imagem inválido." };
  const { getStorageProvider, generateMultiTenantStoragePath } = await import("@/lib/storage/provider");
  const { StorageUsageService } = await import("@/lib/storage/storage-usage-service");
  const reservation = await StorageUsageService.reserveStorageForUpload({ sellerId: c.store.ownerId, storeId: c.store.id, bytes: buf.length, referenceType: "image_upload" });
  if (!reservation.allowed) return { ok: false, error: "Não foi possível salvar a foto agora. Tente mais tarde." };
  const path = generateMultiTenantStoragePath(c.store.id, "profiles", `cliente-${c.customer.id.slice(0, 8)}.${isPng ? "png" : isJpg ? "jpg" : "webp"}`);
  const result = await getStorageProvider().upload(buf, path, m[1]);
  if (reservation.reservationId) await StorageUsageService.confirmReservation(reservation.reservationId, result.sizeBytes || buf.length);
  await setWebAvatar(c.customer.shadowCustomerId, result.url);
  return { ok: true, url: result.url };
}

/* ------------------------- recuperar senha ------------------------- */

export async function forgotPasswordAction(slug: string, email: string, contactVia: string): Promise<Res> {
  const store = await getWebStore(slug);
  if (!store) return { ok: false, error: "Loja não encontrada." };
  const { requestPasswordHelp } = await import("@/lib/webstore/profile");
  return requestPasswordHelp(store, String(email || ""), String(contactVia || ""));
}

export async function resetPasswordAction(slug: string, token: string, password: string): Promise<Res> {
  const store = await getWebStore(slug);
  if (!store) return { ok: false, error: "Loja não encontrada." };
  const { resetWebPassword } = await import("@/lib/webstore/profile");
  const r = await resetWebPassword(store.id, String(token || ""), String(password || ""));
  if (!r.ok) return r;
  const { openSession } = await import("@/lib/webstore/web-store");
  await openSession(store.id, r.customer.id);
  return { ok: true };
}
