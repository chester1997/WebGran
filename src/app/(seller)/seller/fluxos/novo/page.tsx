import { connection } from "next/server";
import { getCurrentStore } from "@/lib/auth";
import { requireOwnerAccount } from "@/lib/bots/owner-guard";
import { FLOW_LIMIT, listFlows } from "@/lib/flows/flow-service";
import SetupStoreClient from "../../SetupStoreClient";
import NewFlowClient from "./NewFlowClient";

export default async function NovoFluxoPage() {
  await connection();
  await requireOwnerAccount();
  const store = await getCurrentStore();
  if (!store) return <SetupStoreClient />;
  const data = await listFlows(store.id).catch(() => ({ available: true, flows: [], folders: [] }));
  return <NewFlowClient available={data.available} used={data.flows.length} limit={FLOW_LIMIT} />;
}
