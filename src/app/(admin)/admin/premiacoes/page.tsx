import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listAllRedemptions } from "@/lib/rewards/service";
import AdminPremiacoesClient, { type AdminRedemption } from "./AdminPremiacoesClient";

export default async function AdminPremiacoesPage() {
  await connection();
  await requireAdmin();

  const { tableReady, rows } = await listAllRedemptions().catch((err) => {
    console.error("[AdminPremiacoesPage]", err);
    return { tableReady: false, rows: [] };
  });

  const items: AdminRedemption[] = rows.map((r) => ({
    id: r.id,
    storeName: r.storeName ?? "Loja removida",
    plaqueValue: r.plaqueValue,
    fullName: r.fullName,
    phone: r.phone,
    address: `${r.street}, ${r.number}${r.complement ? ` — ${r.complement}` : ""} · ${r.district} · ${r.city}/${r.state} · CEP ${r.zipCode}`,
    notes: r.notes,
    revenueAtRequest: Number(r.revenueAtRequest),
    status: r.status as AdminRedemption["status"],
    trackingCode: r.trackingCode,
    createdAt: r.createdAt.toISOString(),
  }));

  return <AdminPremiacoesClient items={items} tableReady={tableReady} />;
}
