import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { productVideos, videoProgress, webStoreSections } from "@/db/schema";
import { listWebProducts, topSellingWebProducts, type WebProductRow } from "./products";

export type SectionKind = "hero" | "top15" | "continue" | "combos" | "carousel";

export interface SectionConfig {
  id?: string;
  kind: SectionKind;
  title: string;
  active: boolean;
  mode: "auto" | "manual";
  productIds: string[];
}

/** Vitrine padrão enquanto o lojista não configura nada. */
export function defaultSections(): SectionConfig[] {
  return [
    { kind: "hero", title: "Destaques do topo", active: true, mode: "auto", productIds: [] },
    { kind: "continue", title: "Continuar assistindo", active: true, mode: "auto", productIds: [] },
    { kind: "top15", title: "Top 15 da semana", active: true, mode: "auto", productIds: [] },
    { kind: "carousel", title: "Lançamentos", active: true, mode: "auto", productIds: [] },
  ];
}

export function isMissingSectionsTable(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string } | null;
  const code = e?.code || e?.cause?.code;
  return code === "42P01" || /relation "web_store_sections" does not exist/i.test(String(e?.message || ""));
}

/** Seções salvas (ou o padrão). `ready=false` quando a migration 0029 ainda não rodou. */
export async function getSections(storeId: string): Promise<{ ready: boolean; sections: SectionConfig[] }> {
  try {
    const rows = await db.select().from(webStoreSections).where(eq(webStoreSections.storeId, storeId)).orderBy(asc(webStoreSections.position));
    if (!rows.length) return { ready: true, sections: defaultSections() };
    return {
      ready: true,
      sections: rows.map((r) => ({
        id: r.id,
        kind: r.kind as SectionKind,
        title: r.title,
        active: r.active,
        mode: (r.mode === "auto" ? "auto" : "manual") as "auto" | "manual",
        productIds: Array.isArray(r.productIds) ? r.productIds.filter((x): x is string => typeof x === "string") : [],
      })),
    };
  } catch (err) {
    if (isMissingSectionsTable(err)) return { ready: false, sections: defaultSections() };
    throw err;
  }
}

const KINDS = new Set<SectionKind>(["hero", "top15", "continue", "combos", "carousel"]);

/** Substitui a vitrine inteira pela lista enviada (na ordem). */
export async function saveSections(storeId: string, list: SectionConfig[], validProductIds: Set<string>) {
  const clean = list
    .filter((s) => s && KINDS.has(s.kind))
    .slice(0, 30)
    .map((s, position) => ({
      storeId,
      kind: s.kind,
      title: String(s.title || "").trim().slice(0, 60) || "Seção",
      position,
      active: Boolean(s.active),
      mode: s.mode === "auto" ? "auto" : "manual",
      productIds: (Array.isArray(s.productIds) ? s.productIds : [])
        .filter((id) => validProductIds.has(id))
        .slice(0, s.kind === "hero" ? 5 : s.kind === "top15" ? 15 : 40),
    }));
  // Só uma seção de cada tipo especial.
  const seen = new Set<string>();
  const final = clean.filter((s) => (s.kind === "carousel" ? true : seen.has(s.kind) ? false : (seen.add(s.kind), true)));
  await db.delete(webStoreSections).where(eq(webStoreSections.storeId, storeId));
  if (final.length) await db.insert(webStoreSections).values(final);
}

/* ------------------------------------------------------------------ */
/* Montagem da vitrine para o cliente                                  */
/* ------------------------------------------------------------------ */

export interface StoreRow {
  key: string;
  kind: SectionKind;
  title: string;
  items: WebProductRow[];
  progress?: Record<string, { percent: number; label: string }>;
}

export async function buildStorefront(storeId: string, shadowCustomerId: string | null) {
  const [{ sections }, all] = await Promise.all([getSections(storeId), listWebProducts(storeId, { onlyActive: true })]);
  const byId = new Map(all.map((p) => [p.id, p]));
  const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((p): p is WebProductRow => Boolean(p));
  const withVideos = all.filter((p) => p.videoCount > 0);

  let top: WebProductRow[] = [];
  const top15 = sections.find((s) => s.kind === "top15");
  if (top15?.active) {
    if (top15.mode === "manual" && top15.productIds.length) top = pick(top15.productIds);
    else {
      const sold = await topSellingWebProducts(storeId).catch(() => []);
      top = pick(sold.map((s) => s.productId));
      for (const p of withVideos) if (top.length < 15 && !top.includes(p)) top.push(p);
    }
    top = top.slice(0, 15);
  }

  const heroCfg = sections.find((s) => s.kind === "hero");
  let hero: WebProductRow[] = [];
  if (heroCfg?.active !== false) {
    hero = heroCfg && heroCfg.mode === "manual" && heroCfg.productIds.length ? pick(heroCfg.productIds) : (top.length ? top : withVideos).slice(0, 3);
    if (!hero.length) hero = all.slice(0, 3);
  }

  const rows: StoreRow[] = [];
  for (const [i, s] of sections.entries()) {
    if (!s.active || s.kind === "hero" || s.kind === "combos") continue;
    if (s.kind === "top15") {
      if (top.length) rows.push({ key: `top-${i}`, kind: "top15", title: s.title, items: top });
    } else if (s.kind === "continue") {
      if (!shadowCustomerId) continue;
      const cont = await continueWatching(storeId, shadowCustomerId, byId);
      if (cont.items.length) rows.push({ key: `cont-${i}`, kind: "continue", title: s.title, items: cont.items, progress: cont.progress });
    } else {
      const items = s.mode === "auto" || !s.productIds.length ? [...all].sort((a, b) => +b.createdAt - +a.createdAt).slice(0, 20) : pick(s.productIds);
      if (items.length) rows.push({ key: `car-${s.id || i}`, kind: "carousel", title: s.title, items });
    }
  }
  return { hero, rows, all };
}

/** Produtos que o cliente começou a assistir (último vídeo visto por produto). */
async function continueWatching(storeId: string, customerId: string, byId: Map<string, WebProductRow>) {
  const progress: Record<string, { percent: number; label: string }> = {};
  const items: WebProductRow[] = [];
  const rows = await db
    .select({ videoId: videoProgress.productVideoId, percent: videoProgress.progressPercent, completed: videoProgress.completed, at: videoProgress.lastWatchedAt })
    .from(videoProgress)
    .where(and(eq(videoProgress.storeId, storeId), eq(videoProgress.customerId, customerId)))
    .orderBy(desc(videoProgress.lastWatchedAt))
    .limit(60);
  if (!rows.length) return { items, progress };
  const vids = await db.query.productVideos.findMany({
    where: inArray(
      productVideos.id,
      rows.map((r) => r.videoId)
    ),
    with: { assignments: { columns: { productId: true } } },
    columns: { id: true, title: true, productId: true },
  });
  for (const r of rows) {
    const v = vids.find((x) => x.id === r.videoId);
    if (!v) continue;
    const pids = [v.productId, ...v.assignments.map((a) => a.productId)].filter((x): x is string => Boolean(x));
    const p = pids.map((id) => byId.get(id)).find(Boolean);
    if (!p || progress[p.id]) continue;
    progress[p.id] = { percent: Math.min(100, Number(r.percent) || 0), label: r.completed ? `Assistido: ${v.title}` : v.title };
    items.push(p);
    if (items.length >= 12) break;
  }
  return { items, progress };
}
