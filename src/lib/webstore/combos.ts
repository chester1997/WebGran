import { randomBytes } from "crypto";
import { and, asc, desc, eq, inArray, like, ne } from "drizzle-orm";
import { db } from "@/db";
import { comboProducts, comboTiers, combos, products } from "@/db/schema";
import { ProgressivePricingEngine } from "@/lib/combos/pricing-engine";
import { WEB_ACTIVE } from "./scope";

/**
 * Combos e oferta progressiva da LOJA WEB.
 * Ficam na mesma tabela `combos`, mas com status "web_active" / "web_draft" / "web_archived".
 * O Mini App, os bots e a tela de Combos do lojista só leem status "active", então nunca veem estes.
 */

export const WEB_COMBO_DRAFT = "web_draft";
export const WEB_COMBO_ARCHIVED = "web_archived";

export interface WebComboView {
  id: string;
  type: "curated" | "progressive";
  title: string;
  description: string | null;
  coverUrl: string | null;
  price: number;
  active: boolean;
  eligibilityMode: "all_products" | "specific_products";
  productIds: string[];
  tiers: { minQuantity: number; price: number }[];
}

export async function listWebCombos(storeId: string): Promise<WebComboView[]> {
  const rows = await db.query.combos.findMany({
    where: and(eq(combos.storeId, storeId), like(combos.status, "web_%"), ne(combos.status, WEB_COMBO_ARCHIVED)),
    orderBy: [asc(combos.position), desc(combos.createdAt)],
    with: { products: { orderBy: [asc(comboProducts.position)] }, tiers: { orderBy: [asc(comboTiers.minQuantity)] } },
  });
  return rows.map((c) => ({
    id: c.id,
    type: c.type === "progressive" ? "progressive" : "curated",
    title: c.title,
    description: c.description,
    coverUrl: c.coverUrl,
    price: Number(c.price) || 0,
    active: c.status === WEB_ACTIVE,
    eligibilityMode: c.eligibilityMode === "specific_products" ? "specific_products" : "all_products",
    productIds: c.products.map((p) => p.productId),
    tiers: c.tiers.map((t) => ({ minQuantity: t.minQuantity, price: Number(t.price) })),
  }));
}

/** Faixas da oferta progressiva do Mini App, para o lojista reaproveitar com um clique. */
export async function miniAppProgressiveTiers(storeId: string) {
  const c = await db.query.combos.findFirst({
    where: and(eq(combos.storeId, storeId), eq(combos.status, "active"), eq(combos.type, "progressive")),
    with: { tiers: { orderBy: [asc(comboTiers.minQuantity)] } },
  });
  return c ? { title: c.title, tiers: c.tiers.map((t) => ({ minQuantity: t.minQuantity, price: Number(t.price) })) } : null;
}

const slugify = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "combo";

const newSlug = (title: string) => `${slugify(title)}-web-${randomBytes(3).toString("hex")}`;

async function ownWebProductIds(storeId: string, ids: string[]) {
  const clean = Array.from(new Set(ids.filter((x) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)))).slice(0, 60);
  if (!clean.length) return [];
  const rows = await db.query.products.findMany({
    where: and(eq(products.storeId, storeId), inArray(products.id, clean), like(products.status, "web_%")),
    columns: { id: true },
  });
  const ok = new Set(rows.map((r) => r.id));
  return clean.filter((id) => ok.has(id));
}

async function findOwnWebCombo(storeId: string, id: string | null) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return db.query.combos.findFirst({ where: and(eq(combos.id, id), eq(combos.storeId, storeId), like(combos.status, "web_%")) });
}

type Result = { ok: true; id: string } | { ok: false; error: string };

export interface ProgressiveInput {
  id: string | null;
  title: string;
  active: boolean;
  eligibilityMode: "all_products" | "specific_products";
  productIds: string[];
  tiers: { minQuantity: number; price: number }[];
}

export async function saveWebProgressive(storeId: string, raw: ProgressiveInput): Promise<Result> {
  const title = String(raw.title || "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (title.length < 3) return { ok: false, error: "Dê um nome para a oferta (ex.: Leve mais, pague menos)." };
  const tiers = (Array.isArray(raw.tiers) ? raw.tiers : [])
    .map((t) => ({ minQuantity: Math.floor(Number(t.minQuantity)), priceCents: Math.round(Number(t.price) * 100) }))
    .filter((t) => t.minQuantity > 0 || t.priceCents > 0)
    .sort((a, b) => a.minQuantity - b.minQuantity);
  if (!tiers.length) return { ok: false, error: "Adicione pelo menos uma faixa." };
  if (tiers.length > 8) return { ok: false, error: "Use no máximo 8 faixas." };
  if (tiers.some((t) => t.minQuantity < 2)) return { ok: false, error: "Cada faixa precisa ser de 2 títulos ou mais." };
  if (tiers.some((t) => t.priceCents < 100)) return { ok: false, error: "O preço de cada faixa precisa ser de pelo menos R$ 1,00." };
  try {
    ProgressivePricingEngine.validateTiers(tiers);
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Faixas inválidas." };
  }
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i].priceCents / tiers[i].minQuantity >= tiers[i - 1].priceCents / tiers[i - 1].minQuantity) {
      return { ok: false, error: "Cada faixa maior precisa sair mais barata por título que a anterior." };
    }
  }
  const mode = raw.eligibilityMode === "specific_products" ? "specific_products" : "all_products";
  const productIds = mode === "specific_products" ? await ownWebProductIds(storeId, raw.productIds || []) : [];
  if (mode === "specific_products" && productIds.length < 2) return { ok: false, error: "Escolha pelo menos 2 títulos que participam da oferta." };

  const status = raw.active ? WEB_ACTIVE : WEB_COMBO_DRAFT;
  const existing = await findOwnWebCombo(storeId, raw.id);
  if (raw.id && (!existing || existing.type !== "progressive")) return { ok: false, error: "Oferta não encontrada." };

  let id = existing?.id || "";
  if (existing) {
    await db.update(combos).set({ title, status, eligibilityMode: mode, price: "0", updatedAt: new Date() }).where(eq(combos.id, existing.id));
  } else {
    const [row] = await db
      .insert(combos)
      .values({ storeId, title, slug: newSlug(title), price: "0", type: "progressive", eligibilityMode: mode, status })
      .returning({ id: combos.id });
    id = row.id;
  }
  // só uma oferta progressiva ativa na Loja Web
  if (raw.active) {
    const others = await db.query.combos.findMany({
      where: and(eq(combos.storeId, storeId), eq(combos.type, "progressive"), eq(combos.status, WEB_ACTIVE), ne(combos.id, id)),
      columns: { id: true },
    });
    if (others.length) await db.update(combos).set({ status: WEB_COMBO_DRAFT, updatedAt: new Date() }).where(inArray(combos.id, others.map((o) => o.id)));
  }
  await db.delete(comboTiers).where(eq(comboTiers.comboId, id));
  await db.insert(comboTiers).values(tiers.map((t, position) => ({ comboId: id, minQuantity: t.minQuantity, price: (t.priceCents / 100).toFixed(2), position })));
  await db.delete(comboProducts).where(eq(comboProducts.comboId, id));
  if (productIds.length) await db.insert(comboProducts).values(productIds.map((productId, position) => ({ comboId: id, productId, position })));
  return { ok: true, id };
}

export interface ComboInput {
  id: string | null;
  title: string;
  description: string;
  coverUrl: string;
  price: number;
  active: boolean;
  productIds: string[];
}

export async function saveWebCombo(storeId: string, raw: ComboInput): Promise<Result> {
  const title = String(raw.title || "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (title.length < 3) return { ok: false, error: "Dê um nome para o combo." };
  const description = String(raw.description || "").trim().slice(0, 500) || null;
  const cover = String(raw.coverUrl || "").trim();
  const coverUrl = /^https:\/\/\S+$/i.test(cover) ? cover.slice(0, 1000) : null;
  const productIds = await ownWebProductIds(storeId, raw.productIds || []);
  if (productIds.length < 2) return { ok: false, error: "Um combo precisa de pelo menos 2 títulos da Loja Web." };
  const price = Math.round(Number(raw.price) * 100) / 100;
  if (!(price >= 1)) return { ok: false, error: "O preço do combo precisa ser de pelo menos R$ 1,00." };
  const prods = await db.query.products.findMany({ where: inArray(products.id, productIds), columns: { price: true } });
  const normal = prods.reduce((a, p) => a + (Number(p.price) || 0), 0);
  if (price >= normal) return { ok: false, error: `O combo precisa sair mais barato que os títulos separados (${normal.toFixed(2).replace(".", ",")}).` };

  const status = raw.active ? WEB_ACTIVE : WEB_COMBO_DRAFT;
  const existing = await findOwnWebCombo(storeId, raw.id);
  if (raw.id && (!existing || existing.type === "progressive")) return { ok: false, error: "Combo não encontrado." };
  let id = existing?.id || "";
  if (existing) {
    await db.update(combos).set({ title, description, coverUrl, price: price.toFixed(2), status, updatedAt: new Date() }).where(eq(combos.id, existing.id));
  } else {
    const [row] = await db
      .insert(combos)
      .values({ storeId, title, slug: newSlug(title), description, coverUrl, price: price.toFixed(2), type: "curated", eligibilityMode: "specific_products", status })
      .returning({ id: combos.id });
    id = row.id;
  }
  await db.delete(comboProducts).where(eq(comboProducts.comboId, id));
  await db.insert(comboProducts).values(productIds.map((productId, position) => ({ comboId: id, productId, position })));
  return { ok: true, id };
}

/** Arquiva (não apaga): pedidos antigos continuam apontando para ele. */
export async function archiveWebCombo(storeId: string, id: string): Promise<Result> {
  const existing = await findOwnWebCombo(storeId, id);
  if (!existing) return { ok: false, error: "Combo não encontrado." };
  await db.update(combos).set({ status: WEB_COMBO_ARCHIVED, updatedAt: new Date() }).where(eq(combos.id, existing.id));
  return { ok: true, id: existing.id };
}
