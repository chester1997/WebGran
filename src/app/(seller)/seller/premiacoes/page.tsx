import { redirect } from "next/navigation";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { isOwnerAccount } from "@/lib/auth/owner-access";
import { getStorePaidRevenue, listStoreRedemptions } from "@/lib/rewards/service";
import SetupStoreClient from "../SetupStoreClient";
import PremiacoesClient, { type RedemptionView } from "./PremiacoesClient";

/** Premiações (placas por faturamento) — por enquanto só a conta proprietária. */
export default async function PremiacoesPage() {
  const seller = await requireSeller();
  if (!isOwnerAccount(seller)) redirect("/seller");

  const store = await getCurrentStore();
  if (!store) return <SetupStoreClient />;

  const [revenue, redemptions] = await Promise.all([
    getStorePaidRevenue(store.id),
    listStoreRedemptions(store.id).catch((err) => {
      console.error("[PremiacoesPage] redemptions:", err);
      return { tableReady: false, rows: [] };
    }),
  ]);

  const views: RedemptionView[] = redemptions.rows.map((r) => ({
    id: r.id,
    plaqueValue: r.plaqueValue,
    status: r.status as RedemptionView["status"],
    trackingCode: r.trackingCode,
    createdAt: r.createdAt.toISOString(),
  }));

  return <PremiacoesClient revenue={revenue} redemptions={views} redemptionReady={redemptions.tableReady} />;
}
