import { notLike } from "drizzle-orm";
import { products } from "@/db/schema";

/**
 * Produtos da Loja Web usam status próprio ("web_active" | "web_draft").
 * O Mini App, os bots e os fluxos só listam status "active", então nunca os veem.
 * As telas do painel que listam sem filtrar status usam este filtro para escondê-los.
 */
export const WEB_ACTIVE = "web_active";
export const WEB_DRAFT = "web_draft";
export const notWebProduct = () => notLike(products.status, "web_%");
export const isWebStatus = (s: string | null | undefined) => typeof s === "string" && s.startsWith("web_");
