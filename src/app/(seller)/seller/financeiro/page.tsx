import { requireSeller, getCurrentStore } from '@/lib/auth';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import FinanceiroClient from './FinanceiroClient';
import SetupStoreClient from "../SetupStoreClient";
import { hasFeature } from '@/lib/entitlements/entitlement-service';
import { DollarSign } from 'lucide-react';

export default async function FinanceiroPage() {
  const seller = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  const hasFinancialReports = await hasFeature(seller.id, "financial_reports_enabled");
  if (!hasFinancialReports) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent p-8 text-center space-y-4 shadow-xl">
          <div className="inline-flex p-4 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
            <DollarSign className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Relatórios Financeiros Indisponíveis</h2>
          <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
            Os relatórios financeiros detalhados e o histórico consolidado de métricas não estão disponíveis no seu plano atual. Faça upgrade do seu plano para liberar este recurso.
          </p>
        </div>
      </div>
    );
  }

  // Fetch Store Transactions
  const storeOrders = await db.query.orders.findMany({
    where: eq(orders.storeId, store.id),
    orderBy: [desc(orders.createdAt)],
    with: {
      customer: true,
    },
  });

  // Calculate Metrics
  const paidOrders = storeOrders.filter(o => o.status === 'paid');
  const pendingOrders = storeOrders.filter(o => o.status === 'pending');

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

  const formattedTransactions = storeOrders.map(o => ({
    id: o.id,
    paymentId: o.paymentId,
    paymentMethod: o.paymentMethod || 'mercadopago',
    customerName: o.customer?.firstName 
      ? `${o.customer.firstName} ${o.customer.lastName || ''}`.trim() 
      : o.customer?.username || 'Cliente',
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
