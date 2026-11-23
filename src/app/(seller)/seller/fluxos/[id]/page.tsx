import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getCurrentStore } from "@/lib/auth";
import { requireOwnerAccount } from "@/lib/bots/owner-guard";
import { FlowTablesMissingError, getFlow, listFlowChats, listFlowProducts, listStoreBots } from "@/lib/flows/flow-service";
import type { BasicFlowConfig } from "@/lib/flows/basic-config";
import type { FlowGraph } from "@/lib/flows/advanced-graph";
import SetupStoreClient from "../../SetupStoreClient";
import BasicFlowEditor from "./BasicFlowEditor";
import AdvancedFlowEditor from "./AdvancedFlowEditor";
import Link from "next/link";

export default async function FluxoEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requireOwnerAccount();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const store = await getCurrentStore();
  if (!store) return <SetupStoreClient />;

  let flow: Awaited<ReturnType<typeof getFlow>>;
  try {
    flow = await getFlow(store.id, id);
  } catch (err) {
    if (err instanceof FlowTablesMissingError) {
      return (
        <div className="p-6 text-[14px] text-amber-200">
          Rode a migration <b>0024_sales_flows.sql</b> no Neon. <Link href="/seller/fluxos" className="underline">Voltar</Link>
        </div>
      );
    }
    throw err;
  }
  if (!flow) notFound();

  const botIds = flow.bots.map((b) => b.id);
  const [productsList, chats, storeBots] = await Promise.all([
    listFlowProducts(store.id).catch(() => []),
    listFlowChats(store.id, botIds).catch(() => []),
    listStoreBots(store.id).catch(() => []),
  ]);
  const botName = storeBots.find((b) => botIds.includes(b.id))?.displayName || store.name || "Seu bot";

  const shared = {
    flowId: flow.id,
    name: flow.name,
    status: flow.status,
    bots: flow.bots,
    products: productsList,
    chats: chats.map((c) => ({ id: c.id, chatId: c.chatId, title: c.title, type: c.type, canInvite: c.canInvite })),
    botName,
  };

  return flow.type === "advanced" ? (
    <AdvancedFlowEditor {...shared} initialGraph={flow.config as FlowGraph} storeBots={storeBots.map((b) => ({ id: b.id, username: b.username, displayName: b.displayName }))} />
  ) : (
    <BasicFlowEditor {...shared} initialConfig={flow.config as BasicFlowConfig} />
  );
}
