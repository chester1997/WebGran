import { and, asc, count, desc, eq, inArray, like, ne, notLike, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products, productVideoAssignments, productVideos } from "@/db/schema";
import { WEB_ACTIVE, WEB_DRAFT } from "./scope";

/**
 * Produtos da Loja Web: linhas da tabela products com status "web_*".
 * Entrega sempre em vídeo na própria loja (product_video), com vídeos da Biblioteca.
 * A cópia de um produto do bot vira um produto independente; os vídeos são só vinculados
 * (nenhum arquivo é duplicado ou apagado na Bunny).
 */

export const WEB_ARCHIVED = "web_archived";
const COPY_PREFIX = "copy:";

export interface WebProductRow {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  coverUrl: string | null;
  bannerUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  duration: string | null;
  badge: string | null;
  status: string;
  position: number;
  videoCount: number;
  copiedFrom: string | null;
  createdAt: Date;
}

const toRow = (p: typeof products.$inferSelect, videoCount: number): WebProductRow => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  shortDescription: p.shortDescription,
  description: p.description,
  coverUrl: p.coverUrl,
  bannerUrl: p.bannerUrl,
  price: Number(p.price) || 0,
  compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
  duration: p.duration,
  badge: p.badge,
  status: p.status,
  position: p.position,
  videoCount,
  copiedFrom: p.deliveryValue?.startsWith(COPY_PREFIX) ? p.deliveryValue.slice(COPY_PREFIX.length) : null,
  createdAt: p.createdAt,
});

/** Quantos vídeos prontos cada produto tem (vínculos + vídeos antigos ligados direto ao produto). */
export async function videoCounts(storeId: string, productIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!productIds.length) return map;
  const [assigned, legacy] = await Promise.all([
    db
      .select({ productId: productVideoAssignments.productId, n: count() })
      .from(productVideoAssignments)
      .innerJoin(productVideos, eq(productVideos.id, productVideoAssignments.videoId))
      .where(
        and(
          eq(productVideoAssignments.storeId, storeId),
          inArray(productVideoAssignments.productId, productIds),
          eq(productVideos.status, "READY"),
          eq(productVideos.active, true)
        )
      )
      .groupBy(productVideoAssignments.productId),
    db
      .select({ productId: productVideos.productId, n: count() })
      .from(productVideos)
      .where(and(eq(productVideos.storeId, storeId), inArray(productVideos.productId, productIds), eq(productVideos.status, "READY"), eq(productVideos.active, true)))
      .groupBy(productVideos.productId),
  ]);
  for (const r of [...assigned, ...legacy]) if (r.productId) map.set(r.productId, (map.get(r.productId) || 0) + Number(r.n));
  return map;
}

/** IDs dos vídeos prontos de um produto, na ordem. */
async function productVideoIds(storeId: string, productId: string): Promise<string[]> {
  const [assigned, legacy] = await Promise.all([
    db
      .select({ id: productVideos.id, pos: productVideoAssignments.position })
      .from(productVideoAssignments)
      .innerJoin(productVideos, eq(productVideos.id, productVideoAssignments.videoId))
      .where(and(eq(productVideoAssignments.storeId, storeId), eq(productVideoAssignments.productId, productId), eq(productVideos.status, "READY")))
      .orderBy(asc(productVideoAssignments.position)),
    db
      .select({ id: productVideos.id, pos: productVideos.position })
      .from(productVideos)
      .where(and(eq(productVideos.storeId, storeId), eq(productVideos.productId, productId), eq(productVideos.status, "READY")))
      .orderBy(asc(productVideos.position)),
  ]);
  const seen = new Set<string>();
  return [...assigned, ...legacy].filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true))).map((v) => v.id);
}

export async function listWebProducts(storeId: string, opts: { onlyActive?: boolean } = {}): Promise<WebProductRow[]> {
  const rows = await db.query.products.findMany({
    where: and(
      eq(products.storeId, storeId),
      opts.onlyActive ? eq(products.status, WEB_ACTIVE) : and(like(products.status, "web_%"), ne(products.status, WEB_ARCHIVED), notLike(products.status, "web_vip%"))
    ),
    orderBy: [asc(products.position), desc(products.createdAt)],
  });
  const counts = await videoCounts(storeId, rows.map((r) => r.id));
  return rows.map((r) => toRow(r, counts.get(r.id) || 0));
}

export interface CopyCandidate {
  id: string;
  title: string;
  coverUrl: string | null;
  price: number;
  deliveryType: string;
  videoCount: number;
  alreadyCopied: boolean;
  blockedReason: string | null;
}

/** Produtos dos bots/Mini App que podem ser copiados (só entrega em vídeo, com vídeos prontos). */
export async function listCopyCandidates(storeId: string): Promise<CopyCandidate[]> {
  const src = await db.query.products.findMany({
    where: and(eq(products.storeId, storeId), inArray(products.status, ["active", "draft"])),
    orderBy: [asc(products.position), desc(products.createdAt)],
  });
  const copies = await db
    .select({ v: products.deliveryValue })
    .from(products)
    .where(and(eq(products.storeId, storeId), like(products.status, "web_%"), ne(products.status, WEB_ARCHIVED), like(products.deliveryValue, `${COPY_PREFIX}%`)));
  const copied = new Set(copies.map((c) => String(c.v).slice(COPY_PREFIX.length)));
  const counts = await videoCounts(storeId, src.map((p) => p.id));
  return src.map((p) => {
    const n = counts.get(p.id) || 0;
    const isVideo = p.deliveryType === "product_video";
    return {
      id: p.id,
      title: p.title,
      coverUrl: p.coverUrl || p.bannerUrl,
      price: Number(p.price) || 0,
      deliveryType: p.deliveryType || "telegram",
      videoCount: n,
      alreadyCopied: copied.has(p.id),
      blockedReason: !isVideo
        ? p.deliveryType === "external"
          ? "Entrega por link externo: não dá para copiar"
          : "Entrega por grupo do Telegram: não dá para copiar"
        : n === 0
          ? "Sem vídeos prontos na Biblioteca"
          : null,
    };
  });
}

async function uniqueSlug(storeId: string, base: string): Promise<string> {
  const clean =
    base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "produto";
  const root = `${clean}-web`;
  const taken = await db.select({ slug: products.slug }).from(products).where(and(eq(products.storeId, storeId), like(products.slug, `${root}%`)));
  const set = new Set(taken.map((t) => t.slug));
  if (!set.has(root)) return root;
  for (let i = 2; i < 500; i++) if (!set.has(`${root}-${i}`)) return `${root}-${i}`;
  return `${root}-${Date.now()}`;
}

async function nextPosition(storeId: string) {
  const [r] = await db
    .select({ m: sql<number>`coalesce(max(${products.position}), -1)`.mapWith(Number) })
    .from(products)
    .where(and(eq(products.storeId, storeId), like(products.status, "web_%")));
  return (r?.m ?? -1) + 1;
}

/** Copia produtos de vídeo para a Loja Web. Retorna quantos foram copiados e os que foram pulados. */
export async function copyProductsToWeb(storeId: string, ids: string[]) {
  const candidates = await listCopyCandidates(storeId);
  const ok = candidates.filter((c) => ids.includes(c.id) && !c.blockedReason);
  const skipped = candidates.filter((c) => ids.includes(c.id) && c.blockedReason).map((c) => c.title);
  let pos = await nextPosition(storeId);
  let copied = 0;
  for (const c of ok) {
    const src = await db.query.products.findFirst({ where: and(eq(products.id, c.id), eq(products.storeId, storeId)) });
    if (!src) continue;
    const [created] = await db
      .insert(products)
      .values({
        storeId,
        botId: null,
        categoryId: src.categoryId,
        title: src.title,
        slug: await uniqueSlug(storeId, src.slug || src.title),
        description: src.description,
        shortDescription: src.shortDescription,
        coverUrl: src.coverUrl,
        bannerUrl: src.bannerUrl,
        price: src.price,
        compareAtPrice: src.compareAtPrice,
        duration: src.duration,
        badge: src.badge,
        status: WEB_ACTIVE,
        position: pos++,
        deliveryType: "product_video",
        deliveryValue: `${COPY_PREFIX}${src.id}`,
        catalogScope: "STORE_GENERAL",
        sharingMode: "EXCLUSIVE",
      })
      .returning({ id: products.id });
    const vids = await productVideoIds(storeId, src.id);
    if (vids.length) {
      await db
        .insert(productVideoAssignments)
        .values(vids.map((videoId, i) => ({ storeId, productId: created.id, videoId, position: i })))
        .onConflictDoNothing();
    }
    copied++;
  }
  return { copied, skipped };
}

export interface WebProductInput {
  title: string;
  shortDescription?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  bannerUrl?: string | null;
  price: number;
  compareAtPrice?: number | null;
  duration?: string | null;
  badge?: string | null;
  published: boolean;
}

export function validateWebProduct(i: WebProductInput): string | null {
  if (!i.title || i.title.trim().length < 2) return "Informe o nome do produto.";
  if (!Number.isFinite(i.price) || i.price < 1) return "O preço mínimo é R$ 1,00.";
  if (i.compareAtPrice != null && i.compareAtPrice > 0 && i.compareAtPrice <= i.price) return "O preço “de” precisa ser maior que o preço de venda.";
  return null;
}

const DURATIONS = new Set(["daily", "weekly", "monthly", "quarterly", "semiannual", "annual", "lifetime"]);

function values(i: WebProductInput) {
  return {
    title: i.title.trim().slice(0, 140),
    shortDescription: i.shortDescription?.trim().slice(0, 220) || null,
    description: i.description?.trim().slice(0, 5000) || null,
    coverUrl: i.coverUrl?.trim() || null,
    bannerUrl: i.bannerUrl?.trim() || null,
    price: i.price.toFixed(2),
    compareAtPrice: i.compareAtPrice && i.compareAtPrice > i.price ? i.compareAtPrice.toFixed(2) : null,
    duration: i.duration && DURATIONS.has(i.duration) ? i.duration : "lifetime",
    badge: i.badge || null,
    status: i.published ? WEB_ACTIVE : WEB_DRAFT,
  };
}

export async function createWebProduct(storeId: string, i: WebProductInput) {
  const [row] = await db
    .insert(products)
    .values({
      storeId,
      ...values(i),
      slug: await uniqueSlug(storeId, i.title),
      position: await nextPosition(storeId),
      deliveryType: "product_video",
      catalogScope: "STORE_GENERAL",
      sharingMode: "EXCLUSIVE",
    })
    .returning({ id: products.id });
  return row.id;
}

/** Garante que o produto é da Loja Web desta loja. */
export async function getWebProductOrNull(storeId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const p = await db.query.products.findFirst({ where: and(eq(products.id, id), eq(products.storeId, storeId), like(products.status, "web_%")) });
  return p && p.status !== WEB_ARCHIVED ? p : null;
}

export async function updateWebProduct(storeId: string, id: string, i: WebProductInput) {
  await db
    .update(products)
    .set({ ...values(i), updatedAt: new Date() })
    .where(and(eq(products.id, id), eq(products.storeId, storeId), like(products.status, "web_%")));
}

/** Tira da loja sem apagar (pedidos e acessos antigos continuam valendo). */
export async function archiveWebProduct(storeId: string, id: string) {
  await db
    .update(products)
    .set({ status: WEB_ARCHIVED, updatedAt: new Date() })
    .where(and(eq(products.id, id), eq(products.storeId, storeId), like(products.status, "web_%")));
}

/** Troca a lista de vídeos do produto (só vínculos; os vídeos continuam na Biblioteca). */
export async function setWebProductVideos(storeId: string, productId: string, videoIds: string[]) {
  const ids = Array.from(new Set(videoIds)).slice(0, 300);
  const valid = ids.length
    ? await db
        .select({ id: productVideos.id })
        .from(productVideos)
        .where(and(eq(productVideos.storeId, storeId), inArray(productVideos.id, ids)))
    : [];
  const ok = new Set(valid.map((v) => v.id));
  await db.delete(productVideoAssignments).where(and(eq(productVideoAssignments.storeId, storeId), eq(productVideoAssignments.productId, productId)));
  const rows = ids.filter((v) => ok.has(v)).map((videoId, position) => ({ storeId, productId, videoId, position }));
  if (rows.length) await db.insert(productVideoAssignments).values(rows).onConflictDoNothing();
}

export async function getWebProductVideoIds(storeId: string, productId: string) {
  return productVideoIds(storeId, productId);
}

/** Mais vendidos da Loja Web nos últimos 7 dias. */
export async function topSellingWebProducts(storeId: string, days = 7): Promise<{ productId: string; sold: number }[]> {
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await db
    .select({ productId: orderItems.productId, sold: sql<number>`sum(${orderItems.quantity})`.mapWith(Number) })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(and(eq(orders.storeId, storeId), eq(orders.status, "paid"), sql`${orders.paidAt} >= ${since}`, eq(products.status, WEB_ACTIVE)))
    .groupBy(orderItems.productId)
    .orderBy(desc(sql`sum(${orderItems.quantity})`))
    .limit(15);
  return rows.filter((r): r is { productId: string; sold: number } => Boolean(r.productId));
}
