"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStore } from "@/lib/auth";
import { verifyOwnerActionAccess } from "@/lib/bots/owner-guard";
import * as Flows from "@/lib/flows/flow-service";
import { normalizeBasicConfig, stripSecrets } from "@/lib/flows/basic-config";

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string };

/** Conta proprietária (Redesign V2) + loja atual. */
async function ctx() {
  const access = await verifyOwnerActionAccess();
  if (!access.authorized) throw new Error(access.error || "Acesso negado.");
  const store = await getCurrentStore();
  if (!store) throw new Error("Loja não encontrada.");
  return store;
}

async function run<T>(fn: (storeId: string) => Promise<T>, revalidate = true): Promise<Result<T>> {
  try {
    const store = await ctx();
    const data = await fn(store.id);
    if (revalidate) revalidatePath("/seller/fluxos");
    return { success: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível concluir agora.";
    if (!(err instanceof Flows.FlowTablesMissingError)) console.error("[fluxos]", msg);
    return { success: false, error: msg };
  }
}

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const need = (v: unknown) => {
  if (!isId(v)) throw new Error("Fluxo inválido.");
  return v;
};

export async function createFlowAction(input: { name: string; type: "basic" | "advanced"; template: boolean }) {
  return run((storeId) =>
    Flows.createFlow(storeId, { name: String(input?.name ?? ""), type: input?.type === "advanced" ? "advanced" : "basic", template: !!input?.template })
  );
}

export async function renameFlowAction(flowId: string, name: string) {
  return run((storeId) => Flows.renameFlow(storeId, need(flowId), String(name ?? "")));
}

export async function deleteFlowAction(flowId: string) {
  return run((storeId) => Flows.deleteFlow(storeId, need(flowId)));
}

export async function duplicateFlowAction(flowId: string) {
  return run((storeId) => Flows.duplicateFlow(storeId, need(flowId)));
}

export async function moveFlowAction(flowId: string, folder: string | null) {
  return run((storeId) => Flows.moveFlow(storeId, need(flowId), folder ? String(folder) : null));
}

export async function createFolderAction(name: string) {
  return run((storeId) => Flows.createFolder(storeId, String(name ?? "")));
}

export async function setFlowBotsAction(flowId: string, botIds: string[]) {
  return run((storeId) => Flows.setFlowBots(storeId, need(flowId), (Array.isArray(botIds) ? botIds : []).filter(isId)));
}

/** Salvamento automático do editor: não revalida a lista a cada tecla. */
export async function saveFlowConfigAction(flowId: string, config: unknown) {
  return run((storeId) => Flows.saveFlowConfig(storeId, need(flowId), config), false);
}

export async function importFlowAction(payload: { name?: unknown; type?: unknown; config?: unknown }) {
  return run((storeId) => Flows.importFlow(storeId, { name: payload?.name, type: payload?.type, config: payload?.config }));
}

/** Conteúdo para o botão Exportar (sem dados de bots ou da loja). */
export async function exportFlowAction(flowId: string) {
  return run(async (storeId) => {
    const f = await Flows.getFlow(storeId, need(flowId));
    if (!f) throw new Error("Fluxo não encontrado.");
    // Tokens de rastreamento nunca saem no arquivo.
    const config = f.type === "basic" ? stripSecrets(normalizeBasicConfig(f.config)) : f.config;
    return { webgranFlow: 1, name: f.name, type: f.type, config };
  }, false);
}

/** Lista curta de fluxos para o passo "Como você quer vender?" ao conectar um bot. */
export async function listFlowOptionsAction() {
  return run((storeId) => Flows.listFlowOptions(storeId), false);
}

export async function publishFlowAction(flowId: string) {
  return run((storeId) => Flows.publishFlow(storeId, need(flowId)));
}

export async function unpublishFlowAction(flowId: string) {
  return run((storeId) => Flows.unpublishFlow(storeId, need(flowId)));
}

export async function flowTestLinkAction(flowId: string) {
  return run((storeId) => Flows.flowTestLink(storeId, need(flowId)), false);
}

/* Disparo */
export async function broadcastCountAction(flowId: string, audience: string) {
  const a = audience === "nobuy" || audience === "buyers" ? audience : "all";
  return run((storeId) => Flows.countBroadcastAudience(storeId, need(flowId), a), false);
}

export async function createBroadcastAction(flowId: string, input: Flows.BroadcastInput) {
  return run(async (storeId) => {
    const r = await Flows.createBroadcast(storeId, need(flowId), input);
    // Começa a enviar já, sem esperar o próximo ciclo da fila.
    const { after } = await import("next/server");
    after(async () => {
      try {
        const { processFlowJobs } = await import("@/lib/flows/flow-jobs");
        await processFlowJobs({ budgetMs: 50_000 });
      } catch (err) {
        console.warn("[fluxos] Envio do disparo:", (err as Error)?.message);
      }
    });
    return r;
  }, false);
}

export async function listBroadcastsAction(flowId: string) {
  return run((storeId) => Flows.listBroadcasts(storeId, need(flowId)), false);
}

export async function cancelBroadcastAction(flowId: string, broadcastId: string) {
  if (!isId(broadcastId)) return { success: false as const, error: "Disparo inválido." };
  return run((storeId) => Flows.cancelBroadcast(storeId, need(flowId), broadcastId), false);
}
