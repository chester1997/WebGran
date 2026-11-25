"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { webCustomers, webSupportTickets } from "@/db/schema";
import { getCurrentStore } from "@/lib/auth";
import { verifyOwnerActionAccess } from "@/lib/bots/owner-guard";
import { getSellerWebCustomerDetail } from "@/lib/webstore/account";

async function ownerStore() {
  const auth = await verifyOwnerActionAccess();
  if (!auth.authorized) return null;
  return getCurrentStore();
}

export async function customerDetailAction(webCustomerId: string) {
  const store = await ownerStore();
  if (!store) return { ok: false as const, error: "Sem permissão." };
  const d = await getSellerWebCustomerDetail(store.id, webCustomerId);
  if (!d) return { ok: false as const, error: "Cliente não encontrado." };
  return {
    ok: true as const,
    detail: {
      orders: d.orders.map((o) => ({
        id: o.id,
        status: o.status,
        total: Number(o.total),
        discount: Number(o.discount),
        paymentMethod: o.paymentMethod,
        couponCode: o.couponCode,
        createdAt: o.createdAt.toISOString(),
        paidAt: o.paidAt ? o.paidAt.toISOString() : null,
        items: o.items.map((i) => ({
          title: i.product?.title || i.combo?.title || (i.comboSnapshot as { title?: string } | null)?.title || "Produto",
          quantity: i.quantity,
          total: Number(i.total),
          isCombo: Boolean(i.comboId),
        })),
      })),
      owned: d.owned.map((o) => ({
        title: o.title,
        status: o.status,
        deliveryType: o.deliveryType,
        expiresAt: o.expiresAt ? o.expiresAt.toISOString() : null,
        grantedAt: o.grantedAt ? o.grantedAt.toISOString() : null,
      })),
      tickets: d.tickets.map((t) => ({ id: t.id, subject: t.subject, status: t.status, createdAt: t.createdAt.toISOString() })),
    },
  };
}

export async function replyTicketAction(ticketId: string, reply: string, close: boolean) {
  const store = await ownerStore();
  if (!store) return { ok: false as const, error: "Sem permissão." };
  const text = String(reply || "").trim().slice(0, 2000);
  if (!text && !close) return { ok: false as const, error: "Escreva a resposta." };
  const now = new Date();
  await db
    .update(webSupportTickets)
    .set({
      ...(text ? { sellerReply: text, repliedAt: now } : {}),
      status: close ? "closed" : "answered",
      updatedAt: now,
    })
    .where(and(eq(webSupportTickets.id, ticketId), eq(webSupportTickets.storeId, store.id)));
  revalidatePath("/seller/loja-web");
  return { ok: true as const };
}

export async function setCustomerStatusAction(webCustomerId: string, blocked: boolean) {
  const store = await ownerStore();
  if (!store) return { ok: false as const, error: "Sem permissão." };
  await db
    .update(webCustomers)
    .set({ status: blocked ? "blocked" : "active", updatedAt: new Date() })
    .where(and(eq(webCustomers.id, webCustomerId), eq(webCustomers.storeId, store.id)));
  revalidatePath("/seller/loja-web");
  return { ok: true as const };
}

/* ------------------------------------------------------------------ */
/* Produtos da Loja Web                                                */
/* ------------------------------------------------------------------ */

import {
  archiveWebProduct,
  copyProductsToWeb,
  createWebProduct,
  getWebProductOrNull,
  getWebProductVideoIds,
  listCopyCandidates,
  listWebProducts,
  setWebProductVideos,
  updateWebProduct,
  validateWebProduct,
  type WebProductInput,
} from "@/lib/webstore/products";
import { saveSections, type SectionConfig } from "@/lib/webstore/sections";
import { ProductVideoService } from "@/lib/videos/product-video-service";

async function ownerCtx() {
  const auth = await verifyOwnerActionAccess();
  if (!auth.authorized || !auth.user) return null;
  const store = await getCurrentStore();
  return store ? { store, user: auth.user } : null;
}

/** Limite de produtos do plano (conta todos os produtos da loja, como no cadastro normal). */
async function checkProductLimit(userId: string, storeId: string, adding: number) {
  const { products } = await import("@/db/schema");
  const { count } = await import("drizzle-orm");
  const { checkLimit } = await import("@/lib/entitlements/entitlement-service");
  const [r] = await db.select({ n: count() }).from(products).where(eq(products.storeId, storeId));
  const current = Number(r?.n || 0);
  const res = await checkLimit(userId, "max_products", current + adding - 1);
  return res.allowed ? null : `Limite de produtos do seu plano atingido (${current}/${res.limit}).`;
}

export async function copyCandidatesAction() {
  const c = await ownerCtx();
  if (!c) return { ok: false as const, error: "Sem permissão." };
  return { ok: true as const, list: await listCopyCandidates(c.store.id) };
}

export async function copyProductsAction(ids: string[]) {
  const c = await ownerCtx();
  if (!c) return { ok: false as const, error: "Sem permissão." };
  const list = Array.isArray(ids) ? ids.filter((x) => typeof x === "string").slice(0, 100) : [];
  if (!list.length) return { ok: false as const, error: "Escolha pelo menos um produto." };
  const limitErr = await checkProductLimit(c.user.id as string, c.store.id, list.length);
  if (limitErr) return { ok: false as const, error: limitErr };
  const res = await copyProductsToWeb(c.store.id, list);
  revalidatePath("/seller/loja-web");
  return { ok: true as const, ...res };
}

function parseInput(raw: WebProductInput): WebProductInput {
  return {
    title: String(raw.title || ""),
    shortDescription: raw.shortDescription ? String(raw.shortDescription) : null,
    description: raw.description ? String(raw.description) : null,
    coverUrl: raw.coverUrl ? String(raw.coverUrl) : null,
    bannerUrl: raw.bannerUrl ? String(raw.bannerUrl) : null,
    price: Math.round(Number(raw.price) * 100) / 100,
    compareAtPrice: raw.compareAtPrice ? Math.round(Number(raw.compareAtPrice) * 100) / 100 : null,
    duration: raw.duration ? String(raw.duration) : "lifetime",
    badge: raw.badge ? String(raw.badge) : null,
    published: Boolean(raw.published),
  };
}

export async function saveWebProductAction(id: string | null, raw: WebProductInput, videoIds: string[]) {
  const c = await ownerCtx();
  if (!c) return { ok: false as const, error: "Sem permissão." };
  const input = parseInput(raw);
  const err = validateWebProduct(input);
  if (err) return { ok: false as const, error: err };
  const vids = Array.isArray(videoIds) ? videoIds.filter((v) => typeof v === "string") : [];
  if (input.published && vids.length === 0) return { ok: false as const, error: "Escolha pelo menos um vídeo para publicar o produto." };
  let productId = id;
  if (productId) {
    if (!(await getWebProductOrNull(c.store.id, productId))) return { ok: false as const, error: "Produto não encontrado." };
    await updateWebProduct(c.store.id, productId, input);
  } else {
    const limitErr = await checkProductLimit(c.user.id as string, c.store.id, 1);
    if (limitErr) return { ok: false as const, error: limitErr };
    productId = await createWebProduct(c.store.id, input);
  }
  await setWebProductVideos(c.store.id, productId, vids);
  revalidatePath("/seller/loja-web");
  return { ok: true as const, id: productId };
}

export async function archiveWebProductAction(id: string) {
  const c = await ownerCtx();
  if (!c) return { ok: false as const, error: "Sem permissão." };
  await archiveWebProduct(c.store.id, id);
  revalidatePath("/seller/loja-web");
  return { ok: true as const };
}

/** Vídeos prontos da Biblioteca + os já escolhidos para o produto. */
export async function videoPickerAction(productId: string | null) {
  const c = await ownerCtx();
  if (!c) return { ok: false as const, error: "Sem permissão." };
  const lib = await ProductVideoService.listSellerLibraryVideos(c.store.id, { statusFilter: "READY" });
  const selected = productId && (await getWebProductOrNull(c.store.id, productId)) ? await getWebProductVideoIds(c.store.id, productId) : [];
  return {
    ok: true as const,
    selected,
    library: lib.map((v) => ({ id: v.id, title: v.title, thumbnailUrl: v.thumbnailUrl, durationSeconds: v.durationSeconds, products: v.assignedProducts.map((p) => p.title).slice(0, 2) })),
  };
}

export async function saveSectionsAction(list: SectionConfig[]) {
  const c = await ownerCtx();
  if (!c) return { ok: false as const, error: "Sem permissão." };
  const valid = new Set((await listWebProducts(c.store.id)).map((p) => p.id));
  try {
    await saveSections(c.store.id, Array.isArray(list) ? list : [], valid);
  } catch (e) {
    const { isMissingSectionsTable } = await import("@/lib/webstore/sections");
    if (isMissingSectionsTable(e)) return { ok: false as const, error: "Rode a migration 0029_web_store_sections.sql no Neon para salvar a vitrine." };
    throw e;
  }
  revalidatePath("/seller/loja-web");
  return { ok: true as const };
}

/** Aparência da Loja Web: nome exibido, logo e imagem da faixa de promoção. */
export async function saveBrandingAction(raw: { displayName?: string; logoUrl?: string; promoImageUrl?: string }) {
  const c = await ownerCtx();
  if (!c) return { ok: false as const, error: "Sem permissão." };
  const { normalizeBranding, saveWebBranding, isMissingSettingsTable } = await import("@/lib/webstore/settings");
  const v = normalizeBranding(raw || {});
  if (!v.ok) return { ok: false as const, error: v.error };
  try {
    await saveWebBranding(c.store.id, v.value);
  } catch (e) {
    if (isMissingSettingsTable(e)) return { ok: false as const, error: "Rode a migration 0030_web_store_settings.sql no Neon para salvar." };
    throw e;
  }
  revalidatePath("/seller/loja-web");
  revalidatePath(`/loja/${c.store.slug}`, "layout");
  return { ok: true as const };
}

/* ------------------------- planos VIP da Loja Web ------------------------- */

export async function saveVipPlansAction(raw: import("@/lib/webstore/vip").VipPlanInput[]) {
  const c = await ownerCtx();
  if (!c) return { ok: false as const, error: "Sem permissão." };
  const { saveVipPlans } = await import("@/lib/webstore/vip");
  const r = await saveVipPlans(c.store.id, Array.isArray(raw) ? raw : []);
  if (r.ok) {
    revalidatePath("/seller/loja-web");
    revalidatePath(`/loja/${c.store.slug}`, "layout");
  }
  return r;
}

/* ------------------------- combos da Loja Web ------------------------- */

export async function saveWebProgressiveAction(raw: import("@/lib/webstore/combos").ProgressiveInput) {
  const c = await ownerCtx();
  if (!c) return { ok: false as const, error: "Sem permissão." };
  const { saveWebProgressive } = await import("@/lib/webstore/combos");
  const r = await saveWebProgressive(c.store.id, raw);
  if (r.ok) {
    revalidatePath("/seller/loja-web");
    revalidatePath(`/loja/${c.store.slug}`, "layout");
  }
  return r;
}

export async function saveWebComboAction(raw: import("@/lib/webstore/combos").ComboInput) {
  const c = await ownerCtx();
  if (!c) return { ok: false as const, error: "Sem permissão." };
  const { saveWebCombo } = await import("@/lib/webstore/combos");
  const r = await saveWebCombo(c.store.id, raw);
  if (r.ok) {
    revalidatePath("/seller/loja-web");
    revalidatePath(`/loja/${c.store.slug}`, "layout");
  }
  return r;
}

export async function archiveWebComboAction(id: string) {
  const c = await ownerCtx();
  if (!c) return { ok: false as const, error: "Sem permissão." };
  const { archiveWebCombo } = await import("@/lib/webstore/combos");
  const r = await archiveWebCombo(c.store.id, String(id || ""));
  if (r.ok) {
    revalidatePath("/seller/loja-web");
    revalidatePath(`/loja/${c.store.slug}`, "layout");
  }
  return r;
}

/** Link de nova senha para um cliente da Loja Web (vale 24 h e deixa de valer quando a senha muda). */
export async function resetLinkAction(webCustomerId: string) {
  const c = await ownerCtx();
  if (!c) return { ok: false as const, error: "Sem permissão." };
  if (!/^[0-9a-f-]{36}$/i.test(String(webCustomerId || ""))) return { ok: false as const, error: "Cliente inválido." };
  const cust = await db.query.webCustomers.findFirst({ where: and(eq(webCustomers.id, webCustomerId), eq(webCustomers.storeId, c.store.id)) });
  if (!cust) return { ok: false as const, error: "Cliente não encontrado." };
  if (cust.status !== "active") return { ok: false as const, error: "Este cliente está bloqueado. Libere antes de gerar o link." };
  const { makeResetToken } = await import("@/lib/webstore/profile");
  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "www.webgran.online";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return { ok: true as const, url: `${proto}://${host}/loja/${c.store.slug}/nova-senha?t=${makeResetToken(cust)}` };
}

export async function savePromoImageAction(url: string | null) {
  const c = await ownerCtx();
  if (!c) return { ok: false as const, error: "Sem permissão." };
  const { savePromoImage, isMissingSettingsTable } = await import("@/lib/webstore/settings");
  try {
    await savePromoImage(c.store.id, url);
  } catch (e) {
    if (isMissingSettingsTable(e)) return { ok: false as const, error: "Rode a migration 0030_web_store_settings.sql no Neon para salvar." };
    throw e;
  }
  revalidatePath("/seller/loja-web");
  revalidatePath(`/loja/${c.store.slug}`, "layout");
  return { ok: true as const };
}

/** Imagem horizontal de um título nos Destaques do topo. */
export async function saveHeroImageAction(productId: string, url: string | null) {
  const c = await ownerCtx();
  if (!c) return { ok: false as const, error: "Sem permissão." };
  const { saveHeroImage } = await import("@/lib/webstore/hero-images");
  const r = await saveHeroImage(c.store.id, String(productId || ""), url);
  if (r.ok) {
    revalidatePath("/seller/loja-web");
    revalidatePath(`/loja/${c.store.slug}`, "layout");
  }
  return r;
}
