import { and, asc, eq, gt, inArray, isNull, like, or } from "drizzle-orm";
import { db } from "@/db";
import { accesses, products } from "@/db/schema";

/**
 * Planos VIP da Loja Web: quem assina vê TODOS os produtos da loja enquanto o plano estiver ativo.
 * Ficam na tabela `products` com status próprio ("web_vip" ligado / "web_vip_off" desligado),
 * entrega "product_video" (sem Telegram) e a validade calculada pelo mesmo `duration` dos produtos.
 * Começam com "web_", então nunca aparecem no Mini App nem nos bots.
 */
export const WEB_VIP = "web_vip";
export const WEB_VIP_OFF = "web_vip_off";

export const VIP_PLANS = [
  { duration: "daily", label: "Diário", period: "1 dia", days: 1 },
  { duration: "weekly", label: "Semanal", period: "7 dias", days: 7 },
  { duration: "monthly", label: "Mensal", period: "1 mês", days: 30 },
  { duration: "quarterly", label: "Trimestral", period: "3 meses", days: 90 },
  { duration: "semiannual", label: "Semestral", period: "6 meses", days: 180 },
  { duration: "annual", label: "Anual", period: "12 meses", days: 365 },
  { duration: "lifetime", label: "Vitalício", period: "para sempre", days: 0 },
] as const;

export type VipDuration = (typeof VIP_PLANS)[number]["duration"];
const META = new Map<string, (typeof VIP_PLANS)[number]>(VIP_PLANS.map((p) => [p.duration, p]));
export const vipMeta = (d: string | null | undefined) => META.get(String(d || ""));

export interface VipPlanView {
  duration: VipDuration;
  label: string;
  period: string;
  enabled: boolean;
  price: number;
  productId: string | null;
}

export interface ActiveVip {
  label: string;
  /** null = vitalício */
  expiresAt: Date | null;
}

const isVipStatus = () => like(products.status, "web_vip%");

/** Todos os 7 planos (ligados ou não) para o editor do vendedor. */
export async function listVipPlans(storeId: string): Promise<VipPlanView[]> {
  const rows = await db.query.products.findMany({ where: and(eq(products.storeId, storeId), isVipStatus()), orderBy: [asc(products.createdAt)] });
  const byDuration = new Map(rows.map((r) => [String(r.duration), r]));
  return VIP_PLANS.map((p) => {
    const r = byDuration.get(p.duration);
    return { duration: p.duration, label: p.label, period: p.period, enabled: r?.status === WEB_VIP, price: r ? Number(r.price) : 0, productId: r?.id || null };
  });
}

/** Planos ligados, para o card da loja. */
export async function listActiveVipPlans(storeId: string): Promise<{ id: string; duration: VipDuration; label: string; period: string; price: number; days: number }[]> {
  const rows = await db.query.products.findMany({ where: and(eq(products.storeId, storeId), eq(products.status, WEB_VIP)) });
  return VIP_PLANS.flatMap((p) => {
    const r = rows.find((x) => x.duration === p.duration);
    return r ? [{ id: r.id, duration: p.duration, label: p.label, period: p.period, price: Number(r.price), days: p.days }] : [];
  });
}

export interface VipPlanInput {
  duration: string;
  enabled: boolean;
  price: number;
}

/** Liga/desliga e define o preço de cada plano. Nunca apaga (quem já comprou continua com o acesso). */
export async function saveVipPlans(storeId: string, input: VipPlanInput[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const list = (Array.isArray(input) ? input : []).filter((i) => META.has(String(i?.duration)));
  for (const i of list) {
    if (i.enabled && (!Number.isFinite(i.price) || i.price < 1)) return { ok: false, error: `Informe o preço do plano ${META.get(i.duration)!.label} (mínimo R$ 1,00).` };
  }
  const existing = await db.query.products.findMany({ where: and(eq(products.storeId, storeId), isVipStatus()) });
  for (const i of list) {
    const meta = META.get(i.duration)!;
    const row = existing.find((r) => r.duration === i.duration);
    const price = Number.isFinite(i.price) && i.price > 0 ? i.price.toFixed(2) : row?.price || "1.00";
    const status = i.enabled ? WEB_VIP : WEB_VIP_OFF;
    if (row) {
      await db.update(products).set({ status, price, updatedAt: new Date() }).where(and(eq(products.id, row.id), eq(products.storeId, storeId)));
    } else if (i.enabled) {
      await db.insert(products).values({
        storeId,
        title: `VIP ${meta.label}`,
        slug: `vip-plano-${meta.duration}`,
        shortDescription: `Acesso a todos os conteúdos da loja por ${meta.period}.`,
        price,
        duration: meta.duration,
        status,
        position: 0,
        deliveryType: "product_video",
        catalogScope: "STORE_GENERAL",
        sharingMode: "EXCLUSIVE",
      });
    }
  }
  return { ok: true };
}

/** VIP ativo do cliente (o que vence por último; vitalício ganha de todos). */
export async function getActiveVip(storeId: string, shadowCustomerId: string): Promise<ActiveVip | null> {
  const now = new Date();
  const rows = await db
    .select({ expiresAt: accesses.expiresAt, duration: products.duration })
    .from(accesses)
    .innerJoin(products, eq(products.id, accesses.productId))
    .where(
      and(
        eq(accesses.storeId, storeId),
        eq(accesses.customerId, shadowCustomerId),
        eq(accesses.status, "ACTIVE"),
        isVipStatus(),
        or(isNull(accesses.expiresAt), gt(accesses.expiresAt, now))
      )
    );
  if (!rows.length) return null;
  const best = rows.reduce((a, b) => (!a.expiresAt ? a : !b.expiresAt ? b : a.expiresAt > b.expiresAt ? a : b));
  return { label: vipMeta(best.duration)?.label || "VIP", expiresAt: best.expiresAt };
}

/** O produto pertence à loja e está à venda na Loja Web (o VIP libera só esses). */
export async function isVipUnlockable(storeId: string, productId: string) {
  const p = await db.query.products.findFirst({ where: and(eq(products.id, productId), eq(products.storeId, storeId), eq(products.status, "web_active")), columns: { id: true } });
  return Boolean(p);
}

/** Ids dos produtos VIP (para tirar das listas de "meus produtos"). */
export async function vipProductIds(storeId: string, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const rows = await db.query.products.findMany({ where: and(eq(products.storeId, storeId), inArray(products.id, ids), isVipStatus()), columns: { id: true } });
  return new Set(rows.map((r) => r.id));
}
