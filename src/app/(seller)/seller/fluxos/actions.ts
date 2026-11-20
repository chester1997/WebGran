"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStore } from "@/lib/auth";
import { verifyOwnerActionAccess } from "@/lib/bots/owner-guard";
import * as Flows from "@/lib/flows/flow-service";

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
    return { webgranFlow: 1, name: f.name, type: f.type, config: f.config };
  }, false);
}
