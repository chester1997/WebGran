import { connection } from "next/server";
import { getCurrentStore } from "@/lib/auth";
import { requireOwnerAccount } from "@/lib/bots/owner-guard";
import { getRecoverySettings, getRecoveryStats } from "@/lib/marketing/sales-recovery";
import SetupStoreClient from "../../SetupStoreClient";
import RecoveryClient from "./RecoveryClient";

/** Marketing → Recuperação de vendas (fase de testes: exclusivo da conta proprietária). */
export default async function RecoveryPage() {
  await connection();
  await requireOwnerAccount();
  const store = await getCurrentStore();
  if (!store) return <SetupStoreClient />;

  const [settings, stats] = await Promise.all([getRecoverySettings(store.id), getRecoveryStats(store.id)]);
  return <RecoveryClient initial={settings} stats={stats} storeName={store.name} />;
}
