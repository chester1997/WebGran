export const instant = false;
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { orders, telegramCustomers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Search, ShoppingCart, MoreHorizontal, Filter, Receipt, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RetryDeliveryButton } from "./RetryDeliveryButton";

import SetupStoreClient from "../SetupStoreClient";

export default async function OrdersPage() {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  const items = await db.query.orders.findMany({
    where: eq(orders.storeId, store.id),
    orderBy: [desc(orders.createdAt)],
    with: {
      customer: true,
      accesses: {
        with: {
          product: true
        }
      }
    }
  });

  return (
    <div className="space-y-8 fade-in w-full">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Pedidos</h2>
          <p className="text-zinc-400 text-sm mt-1">Acompanhe as vendas e pagamentos dos seus bots.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-transparent border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 h-11 px-4 rounded-xl">
            <Filter className="w-4 h-4 mr-2" />
            Filtrar
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl h-11 px-6 shadow-lg shadow-blue-600/20">
            <Receipt className="w-4 h-4 mr-2" /> Exportar
          </Button>
        </div>
      </div>

      {/* Filters Area */}
      <div className="flex flex-col md:flex-row gap-4 bg-[#121212] p-4 border border-white/5 rounded-2xl shadow-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Buscar por ID do pedido, cliente..." 
            className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
          />
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-[#121212] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-zinc-500 text-xs font-semibold uppercase tracking-wider bg-white/[0.01]">
                <th className="py-4 pl-6">Pedido</th>
                <th className="py-4">Cliente</th>
                <th className="py-4">Data</th>
                <th className="py-4">Total</th>
                <th className="py-4">Pagamento</th>
                <th className="py-4">Entrega</th>
                <th className="py-4 text-right pr-6">Ações</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-white/5">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4 border border-white/5 shadow-inner">
                        <ShoppingCart className="w-8 h-8 text-zinc-500" />
                      </div>
                      <p className="text-zinc-300 font-medium text-base mb-1">Nenhum pedido ainda</p>
                      <p className="text-zinc-600 text-sm max-w-sm mb-6">As compras realizadas no seu Mini App aparecerão aqui.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((order) => {
                  const access = order.accesses?.[0];
                  return (
                    <tr key={order.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 pl-6">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-300 font-mono text-xs bg-white/5 px-2 py-1 rounded border border-white/5">
                            #{order.id.slice(0, 8)}
                          </span>
                        </div>
                      </td>
                      <td className="py-4">
                        {order.customer ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/20 font-bold text-[10px]">
                              {order.customer.photoUrl ? (
                                <img src={order.customer.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                (order.customer.firstName?.[0] || 'U').toUpperCase()
                              )}
                            </div>
                            <span className="text-zinc-200 font-medium">{order.customer.firstName} {order.customer.lastName}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-500">Desconhecido</span>
                        )}
                      </td>
                      <td className="py-4 text-zinc-400 text-xs">
                        {new Date(order.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-4">
                        <span className="text-emerald-400 font-medium tracking-tight">R$ {Number(order.total).toFixed(2).replace('.', ',')}</span>
                      </td>
                      <td className="py-4">
                        {order.status === 'paid' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> APROVADO
                          </span>
                        ) : order.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div> PENDENTE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> CANCELADO
                          </span>
                        )}
                      </td>
                      <td className="py-4">
                        {!access ? (
                          <span className="text-zinc-500 text-xs">—</span>
                        ) : access.deliveryStatus === 'DELIVERED' || access.status === 'ACTIVE' ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                              🟢 ENTREGUE
                            </span>
                            {access.telegramChatId && (
                              <span className="text-[10px] text-zinc-500 font-mono">Chat: {access.telegramChatId}</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 items-start">
                            <span className="inline-flex items-center gap-1 text-red-400 text-xs font-semibold">
                              🔴 FALHOU
                            </span>
                            {access.deliveryError && (
                              <span className="text-[10px] text-red-400/80 max-w-[160px] truncate" title={access.deliveryError}>
                                {access.deliveryError}
                              </span>
                            )}
                            <RetryDeliveryButton accessId={access.id} />
                          </div>
                        )}
                      </td>
                      <td className="py-4 text-right pr-6">
                        <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white hover:bg-white/5 h-8 w-8 rounded-lg">
                          <ArrowUpRight className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
