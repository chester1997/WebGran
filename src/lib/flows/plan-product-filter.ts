import { sql } from "drizzle-orm";
import { products } from "@/db/schema";

/**
 * Produtos ocultos criados pelos planos do Fluxo Básico têm slug "fluxo-<8 hex>-<id do plano>".
 * O padrão é estrito para nunca esconder um produto normal (ex.: "fluxo-de-caixa").
 */
export const FLOW_PLAN_SLUG_RE = /^fluxo-[0-9a-f]{8}-[a-z0-9]{4,24}$/i;
export const isFlowPlanSlug = (slug: string | null | undefined) => !!slug && FLOW_PLAN_SLUG_RE.test(slug);

/** Condição SQL: o produto NÃO é um plano oculto de fluxo. */
export const notFlowPlanProduct = () => sql`${products.slug} !~* '^fluxo-[0-9a-f]{8}-[a-z0-9]{4,24}$'`;
