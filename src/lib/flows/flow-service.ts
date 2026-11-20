import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { products, salesFlowBots, salesFlowFolders, salesFlows, telegramBotChats, telegramBots } from "@/db/schema";
import { blankBasicConfig, normalizeBasicConfig, planDelivery, templateBasicConfig, type BasicFlowConfig } from "./basic-config";
import { blankGraph, normalizeGraph } from "./advanced-graph";

export const FLOW_LIMIT = 30;
export type FlowType = "basic" | "advanced";

export interface FlowSummary {
  id: string;
  name: string;
  type: FlowType;
  status: "draft" | "published";
  folder: string | null;
  updatedAt: string;
  bots: { id: string; username: string }[];
}

export interface StoreBot {
  id: string;
  username: string;
  displayName: string | null;
  salesMode: string;
}

/** Tabela/relação inexistente no Postgres (migration 0024 ainda não rodou). */
export function isMissingRelation(err: unknown): boolean {
  const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = e?.code || e?.cause?.code;
  const msg = String(e?.message || e?.cause?.message || "");
  return code === "42P01" || /relation "sales_flow/i.test(msg);
}

export class FlowTablesMissingError extends Error {
  constructor() {
    super("As tabelas de fluxos ainda não existem no banco. Rode a migration 0024_sales_flows.sql no Neon.");
  }
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isMissingRelation(err)) throw new FlowTablesMissingError();
    throw err;
  }
}

const cleanName = (v: string, max = 40) => v.replace(/\s+/g, " ").trim().slice(0, max);

export async function listStoreBots(storeId: string): Promise<StoreBot[]> {
  return db
    .select({ id: telegramBots.id, username: telegramBots.username, displayName: telegramBots.displayName, salesMode: telegramBots.salesMode })
    .from(telegramBots)
    .where(eq(telegramBots.storeId, storeId))
    .orderBy(asc(telegramBots.createdAt));
}

/** Lista fluxos, pastas e bots. `available: false` quando as tabelas ainda não existem. */
export async function listFlows(storeId: string): Promise<{ available: boolean; flows: FlowSummary[]; folders: string[] }> {
  try {
    const [rows, links, folders] = await Promise.all([
      db
        .select({ id: salesFlows.id, name: salesFlows.name, type: salesFlows.type, status: salesFlows.status, folder: salesFlows.folder, updatedAt: salesFlows.updatedAt })
        .from(salesFlows)
        .where(eq(salesFlows.storeId, storeId))
        .orderBy(desc(salesFlows.updatedAt)),
      db
        .select({ flowId: salesFlowBots.flowId, botId: telegramBots.id, username: telegramBots.username })
        .from(salesFlowBots)
        .innerJoin(telegramBots, eq(telegramBots.id, salesFlowBots.botId))
        .where(eq(salesFlowBots.storeId, storeId)),
      db.select({ name: salesFlowFolders.name }).from(salesFlowFolders).where(eq(salesFlowFolders.storeId, storeId)).orderBy(asc(salesFlowFolders.name)),
    ]);
    return {
      available: true,
      folders: folders.map((f) => f.name),
      flows: rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type === "advanced" ? "advanced" : "basic",
        status: r.status === "published" ? "published" : "draft",
        folder: r.folder,
        updatedAt: new Date(r.updatedAt).toISOString(),
        bots: links.filter((l) => l.flowId === r.id).map((l) => ({ id: l.botId, username: l.username })),
      })),
    };
  } catch (err) {
    if (isMissingRelation(err)) return { available: false, flows: [], folders: [] };
    throw err;
  }
}

export async function getFlow(storeId: string, flowId: string) {
  return guard(async () => {
    const flow = await db.query.salesFlows.findFirst({ where: and(eq(salesFlows.id, flowId), eq(salesFlows.storeId, storeId)) });
    if (!flow) return null;
    const bots = await db
      .select({ id: telegramBots.id, username: telegramBots.username })
      .from(salesFlowBots)
      .innerJoin(telegramBots, eq(telegramBots.id, salesFlowBots.botId))
      .where(eq(salesFlowBots.flowId, flowId));
    const type: FlowType = flow.type === "advanced" ? "advanced" : "basic";
    return {
      id: flow.id,
      name: flow.name,
      type,
      status: flow.status === "published" ? ("published" as const) : ("draft" as const),
      folder: flow.folder,
      updatedAt: new Date(flow.updatedAt).toISOString(),
      bots,
      config: type === "advanced" ? normalizeGraph(flow.config) : normalizeBasicConfig(flow.config),
    };
  });
}

export async function createFlow(storeId: string, input: { name: string; type: FlowType; template: boolean }) {
  return guard(async () => {
    const name = cleanName(input.name);
    if (!name) throw new Error("Dê um nome ao fluxo.");
    const existing = await db.select({ id: salesFlows.id }).from(salesFlows).where(eq(salesFlows.storeId, storeId));
    if (existing.length >= FLOW_LIMIT) throw new Error(`Você chegou ao limite de ${FLOW_LIMIT} fluxos.`);
    const config = input.type === "advanced" ? blankGraph() : input.template ? templateBasicConfig() : blankBasicConfig();
    const [row] = await db.insert(salesFlows).values({ storeId, name, type: input.type, config }).returning({ id: salesFlows.id });
    return row.id;
  });
}

async function ownFlow(storeId: string, flowId: string) {
  const f = await db.query.salesFlows.findFirst({ where: and(eq(salesFlows.id, flowId), eq(salesFlows.storeId, storeId)) });
  if (!f) throw new Error("Fluxo não encontrado.");
  return f;
}

export async function renameFlow(storeId: string, flowId: string, name: string) {
  return guard(async () => {
    const n = cleanName(name);
    if (!n) throw new Error("O nome não pode ficar vazio.");
    await ownFlow(storeId, flowId);
    await db.update(salesFlows).set({ name: n, updatedAt: new Date() }).where(eq(salesFlows.id, flowId));
  });
}

export async function deleteFlow(storeId: string, flowId: string) {
  return guard(async () => {
    await ownFlow(storeId, flowId);
    await db.delete(salesFlows).where(eq(salesFlows.id, flowId));
  });
}

export async function duplicateFlow(storeId: string, flowId: string) {
  return guard(async () => {
    const f = await ownFlow(storeId, flowId);
    const count = await db.select({ id: salesFlows.id }).from(salesFlows).where(eq(salesFlows.storeId, storeId));
    if (count.length >= FLOW_LIMIT) throw new Error(`Você chegou ao limite de ${FLOW_LIMIT} fluxos.`);
    const [row] = await db
      .insert(salesFlows)
      .values({ storeId, name: cleanName(`${f.name} (cópia)`), type: f.type, folder: f.folder, config: f.config, status: "draft" })
      .returning({ id: salesFlows.id });
    return row.id;
  });
}

export async function moveFlow(storeId: string, flowId: string, folder: string | null) {
  return guard(async () => {
    await ownFlow(storeId, flowId);
    const name = folder ? cleanName(folder, 30) : null;
    if (name) {
      const exists = await db.query.salesFlowFolders.findFirst({ where: and(eq(salesFlowFolders.storeId, storeId), eq(salesFlowFolders.name, name)) });
      if (!exists) throw new Error("Pasta não encontrada.");
    }
    await db.update(salesFlows).set({ folder: name, updatedAt: new Date() }).where(eq(salesFlows.id, flowId));
  });
}

export async function createFolder(storeId: string, name: string) {
  return guard(async () => {
    const n = cleanName(name, 30);
    if (!n) throw new Error("Dê um nome à pasta.");
    await db.insert(salesFlowFolders).values({ storeId, name: n }).onConflictDoNothing();
    return n;
  });
}

/**
 * Liga o fluxo exatamente aos bots informados. Só bots desta loja no modo
 * "Venda na conversa" (PADRAO). Um bot que estava em outro fluxo passa para este.
 */
export async function setFlowBots(storeId: string, flowId: string, botIds: string[]) {
  return guard(async () => {
    await ownFlow(storeId, flowId);
    const wanted = [...new Set(botIds)].slice(0, 50);
    const valid = wanted.length
      ? await db
          .select({ id: telegramBots.id, salesMode: telegramBots.salesMode })
          .from(telegramBots)
          .where(and(eq(telegramBots.storeId, storeId), inArray(telegramBots.id, wanted)))
      : [];
    const ok = valid.filter((b) => b.salesMode === "PADRAO").map((b) => b.id);
    if (ok.length !== wanted.length) throw new Error("Só bots de “Venda na conversa” desta loja podem usar fluxos.");

    await db.transaction(async (tx) => {
      await tx.delete(salesFlowBots).where(eq(salesFlowBots.flowId, flowId));
      if (ok.length) {
        await tx.delete(salesFlowBots).where(inArray(salesFlowBots.botId, ok));
        await tx.insert(salesFlowBots).values(ok.map((botId) => ({ flowId, botId, storeId })));
      }
      await tx.update(salesFlows).set({ updatedAt: new Date() }).where(eq(salesFlows.id, flowId));
    });
  });
}

const MAX_CONFIG_BYTES = 200_000;

export async function saveFlowConfig(storeId: string, flowId: string, config: unknown) {
  return guard(async () => {
    const f = await ownFlow(storeId, flowId);
    const clean = f.type === "advanced" ? normalizeGraph(config) : normalizeBasicConfig(config);
    if (JSON.stringify(clean).length > MAX_CONFIG_BYTES) throw new Error("O fluxo ficou grande demais para salvar. Remova alguns blocos ou textos.");
    const updatedAt = new Date();
    await db.update(salesFlows).set({ config: clean, updatedAt }).where(eq(salesFlows.id, flowId));
    return updatedAt.toISOString();
  });
}

/** Produtos ativos da loja (viram planos no fluxo). */
export async function listFlowProducts(storeId: string) {
  const rows = await db
    .select({ id: products.id, title: products.title, price: products.price, duration: products.duration, botId: products.botId, deliveryType: products.deliveryType, deliveryValue: products.deliveryValue })
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.status, "active")))
    .orderBy(asc(products.position), asc(products.title));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    price: Number(r.price) || 0,
    duration: r.duration || "lifetime",
    botId: r.botId,
    /** Produto tem destino de entrega (grupo, link ou vídeo). */
    hasDelivery: r.deliveryType === "product_video" || !!(r.deliveryValue && String(r.deliveryValue).trim()),
    deliveryKind: r.deliveryType === "product_video" ? "Vídeo" : r.deliveryType === "external" ? "Link" : "Grupo do Telegram",
  }));
}

/** Grupos e canais onde os bots ligados ao fluxo são administradores. */
export async function listFlowChats(storeId: string, botIds: string[]) {
  const where = botIds.length
    ? and(eq(telegramBotChats.storeId, storeId), inArray(telegramBotChats.botId, botIds), eq(telegramBotChats.isActive, true))
    : and(eq(telegramBotChats.storeId, storeId), eq(telegramBotChats.isActive, true));
  const rows = await db
    .select({ id: telegramBotChats.id, chatId: telegramBotChats.telegramChatId, title: telegramBotChats.title, type: telegramBotChats.type, botId: telegramBotChats.botId, canInvite: telegramBotChats.canInviteUsers })
    .from(telegramBotChats)
    .where(where)
    .orderBy(asc(telegramBotChats.title));
  // O mesmo grupo pode aparecer em mais de um bot: mostra uma vez só.
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.chatId) ? false : (seen.add(r.chatId), true)));
}

/** Importa um fluxo exportado (.json). O conteúdo passa pela mesma validação do salvamento. */
export async function importFlow(storeId: string, input: { name: unknown; type: unknown; config: unknown }) {
  return guard(async () => {
    const type: FlowType = input.type === "advanced" ? "advanced" : "basic";
    const name = cleanName(typeof input.name === "string" && input.name.trim() ? input.name : "Fluxo importado");
    const count = await db.select({ id: salesFlows.id }).from(salesFlows).where(eq(salesFlows.storeId, storeId));
    if (count.length >= FLOW_LIMIT) throw new Error(`Você chegou ao limite de ${FLOW_LIMIT} fluxos.`);
    const config = type === "advanced" ? normalizeGraph(input.config) : normalizeBasicConfig(input.config);
    if (JSON.stringify(config).length > MAX_CONFIG_BYTES) throw new Error("Arquivo grande demais.");
    const [row] = await db.insert(salesFlows).values({ storeId, name, type, config }).returning({ id: salesFlows.id });
    return row.id;
  });
}

/** Opções para escolher o fluxo ao conectar um bot. Vazio se as tabelas ainda não existem. */
export async function listFlowOptions(storeId: string) {
  try {
    const rows = await db
      .select({ id: salesFlows.id, name: salesFlows.name, type: salesFlows.type })
      .from(salesFlows)
      .where(eq(salesFlows.storeId, storeId))
      .orderBy(desc(salesFlows.updatedAt));
    return rows.map((r) => ({ id: r.id, name: r.name, type: (r.type === "advanced" ? "advanced" : "basic") as FlowType }));
  } catch (err) {
    if (isMissingRelation(err)) return [];
    throw err;
  }
}

/** Liga UM bot a um fluxo (sem mexer nos outros bots do fluxo). O bot sai do fluxo anterior, se tinha. */
export async function assignBotToFlow(storeId: string, flowId: string, botId: string) {
  return guard(async () => {
    await ownFlow(storeId, flowId);
    const bot = await db.query.telegramBots.findFirst({ where: and(eq(telegramBots.id, botId), eq(telegramBots.storeId, storeId)) });
    if (!bot || bot.salesMode !== "PADRAO") throw new Error("Só bots de “Venda na conversa” desta loja podem usar fluxos.");
    await db.transaction(async (tx) => {
      await tx.delete(salesFlowBots).where(eq(salesFlowBots.botId, botId));
      await tx.insert(salesFlowBots).values({ flowId, botId, storeId });
      await tx.update(salesFlows).set({ updatedAt: new Date() }).where(eq(salesFlows.id, flowId));
    });
  });
}

/** Tira o bot de qualquer fluxo (ex.: bot voltou para o modo Mini App). Não falha se as tabelas não existirem. */
export async function unassignBot(storeId: string, botId: string) {
  try {
    await db.delete(salesFlowBots).where(and(eq(salesFlowBots.botId, botId), eq(salesFlowBots.storeId, storeId)));
  } catch (err) {
    if (!isMissingRelation(err)) throw err;
  }
}


/** Problemas que impedem publicar um fluxo básico (lista vazia = pode publicar). */
export function basicPublishProblems(config: BasicFlowConfig, botCount: number) {
  const problems: string[] = [];
  if (!botCount) problems.push("Ligue o fluxo a um bot.");
  if (!config.inicio.msg.trim() || !config.inicio.btn.trim()) problems.push("Escreva a mensagem de boas-vindas e o texto do botão.");
  if (!config.planos.items.length) problems.push("Crie pelo menos um plano.");
  const bad = config.planos.items.filter((p) => !p.name.trim() || p.price < 1).map((p) => p.name.trim() || "sem nome");
  if (bad.length) problems.push(`Dê nome e valor (mínimo R$ 1,00) aos planos: ${bad.join(", ")}.`);
  const noDelivery = config.planos.items.filter((p) => !planDelivery(p, config)).map((p) => p.name.trim() || "sem nome");
  if (noDelivery.length) problems.push(`Defina o grupo ou link de entrega (seção Acesso VIP) para: ${noDelivery.join(", ")}.`);
  return problems;
}

export async function publishFlow(storeId: string, flowId: string) {
  return guard(async () => {
    const f = await ownFlow(storeId, flowId);
    if (f.type !== "basic") throw new Error("O fluxo avançado ainda não pode ser publicado. Ele começa a rodar numa próxima etapa.");
    const bots = await db.select({ botId: salesFlowBots.botId }).from(salesFlowBots).where(eq(salesFlowBots.flowId, flowId));
    const config = normalizeBasicConfig(f.config);
    const problems = basicPublishProblems(config, bots.length);
    if (problems.length) throw new Error(problems.join(" "));
    await db.update(salesFlows).set({ status: "published", updatedAt: new Date() }).where(eq(salesFlows.id, flowId));
  });
}

export async function unpublishFlow(storeId: string, flowId: string) {
  return guard(async () => {
    await ownFlow(storeId, flowId);
    await db.update(salesFlows).set({ status: "draft", updatedAt: new Date() }).where(eq(salesFlows.id, flowId));
  });
}

/** Link "Testar no Telegram": abre o bot ligado já rodando o rascunho. */
export async function flowTestLink(storeId: string, flowId: string) {
  return guard(async () => {
    const f = await ownFlow(storeId, flowId);
    if (f.type !== "basic") throw new Error("O teste do fluxo avançado chega numa próxima etapa.");
    const bot = await db
      .select({ username: telegramBots.username })
      .from(salesFlowBots)
      .innerJoin(telegramBots, eq(telegramBots.id, salesFlowBots.botId))
      .where(eq(salesFlowBots.flowId, flowId))
      .limit(1);
    if (!bot[0]?.username) throw new Error("Ligue o fluxo a um bot para testar.");
    const { buildTestStartParam } = await import("./flow-runtime");
    return `https://t.me/${bot[0].username.replace(/^@/, "")}?start=${buildTestStartParam(flowId)}`;
  });
}
