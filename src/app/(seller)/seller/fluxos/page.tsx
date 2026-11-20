import { connection } from "next/server";
import { getCurrentStore } from "@/lib/auth";
import { requireOwnerAccount } from "@/lib/bots/owner-guard";
import { FLOW_LIMIT, listFlows, listStoreBots } from "@/lib/flows/flow-service";
import SetupStoreClient from "../SetupStoreClient";
import FlowsListClient from "./FlowsListClient";

/** Automações → Meus Fluxos (Redesign V2, exclusivo da conta proprietária). */
export default async function FluxosPage() {
  await connection();
  await requireOwnerAccount();
  const store = await getCurrentStore();
  if (!store) return <SetupStoreClient />;

  const [data, bots] = await Promise.all([
    listFlows(store.id).catch((err) => {
      console.error("[fluxos] Falha ao listar fluxos:", err?.message);
      return { available: true, flows: [], folders: [] };
    }),
    listStoreBots(store.id).catch(() => []),
  ]);

  return <FlowsListClient available={data.available} flows={data.flows} folders={data.folders} bots={bots} limit={FLOW_LIMIT} />;
}
