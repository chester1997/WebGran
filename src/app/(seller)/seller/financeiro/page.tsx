import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import FinanceiroClient from "./FinanceiroClient";
import SetupStoreClient from "../SetupStoreClient";
import { hasFeature } from "@/lib/entitlements/entitlement-service";
import { DollarSign, Lock } from "lucide-react";
import SellerPageHeader from "@/components/layout/SellerPageHeader";

export default async function FinanceiroPage() {
  await connection();
  const seller = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  const hasFinancialReports = await hasFeature(seller.id, "financial_reports_enabled");
  if (!hasFinancialReports) {
    return (
      <div className="space-y-6 w-full max-w-full">
        <SellerPageHeader
          portalId="seller-page-header-portal"
          title="Financeiro"
          subtitle="Acompanhe o faturamento líquido, vendas processadas e repasses da sua loja."
        />
        <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-8 text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex p-3 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-white">Relatórios Financeiros Indisponíveis</h2>
          <p className="text-zinc-400 max-w-md mx-auto text-xs leading-relaxed">
            Os relatórios financeiros detalhados e o histórico consolidado de métricas não estão disponíveis no seu plano atual. Faça upgrade para liberar este recurso.
          </p>
        </div>
      </div>
    );
  }

  // Consulta de transações da loja do vendedor
  const storeOrders = await db.query.orders.findMany({
    where: eq(orders.storeId, store.id),
    orderBy: [desc(orders.createdAt)],
    with: {
      customer: true,
    },
  });

  // Cálculo das métricas
  const paidOrders = storeOrders.filter((o) => o.status === "paid");
  const pendingOrders = storeOrders.filter((o) => o.status === "pending");

  const totalBruto = paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalTaxa = paidOrders.reduce((sum, o) => sum + Number(o.platformFee || 0), 0);
  const totalLiquido = paidOrders.reduce((sum, o) => sum + Number(o.netAmount || (Number(o.total) - Number(o.platformFee || 0))), 0);

  const metrics = {
    totalBruto,
    totalTaxa,
    totalLiquido,
    paidCount: paidOrders.length,
    pendingCount: pendingOrders.length,
  };

  const formattedTransactions = storeOrders.map((o) => ({
    id: o.id,
    paymentId: o.paymentId,
    paymentMethod: o.paymentMethod || "mercadopago",
    customerName: o.customer?.firstName
      ? `${o.customer.firstName} ${o.customer.lastName || ""}`.trim()
      : o.customer?.username || "Cliente",
    total: Number(o.total || 0),
    platformFee: Number(o.platformFee || 0),
    netAmount: Number(o.netAmount || (Number(o.total) - Number(o.platformFee || 0))),
    status: o.status,
    createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
    paidAt: o.paidAt ? new Date(o.paidAt).toISOString() : null,
  }));

  return (
    <FinanceiroClient 
      metrics={metrics}
      transactions={formattedTransactions}
    />
  );
}
