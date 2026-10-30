import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Search, ShoppingCart, Filter, Receipt, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RetryDeliveryButton } from "./RetryDeliveryButton";
import { formatBusinessDateTime } from "@/lib/analytics/timezone-utils";

import SetupStoreClient from "../SetupStoreClient";

export default async function OrdersPage() {
  await connection();
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
    <div className="space-y-6 sm:space-y-8 w-full max-w-full">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Pedidos</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
              {items.length}
            </span>
          </div>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">Acompanhe as vendas e pagamentos dos seus bots em tempo real.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button variant="outline" size="default" className="text-xs h-9 sm:h-10">
            <Filter className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
            Filtrar
          </Button>
          <Button variant="default" size="default" className="text-xs h-9 sm:h-10">
            <Receipt className="w-3.5 h-3.5 mr-1.5" /> Exportar
          </Button>
        </div>
      </div>

      {/* Filters Area */}
      <div className="bg-[#0F1014] p-3 sm:p-4 border border-white/[0.08] rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="search" 
            name="search"
            id="orders_search_input"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-form-type="other"
            placeholder="Buscar por ID do pedido, cliente..." 
            className="w-full bg-[#15171D] border border-white/[0.08] hover:border-white/20 rounded-xl py-2.5 pl-10 pr-4 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
      </div>

      {/* Orders List - Desktop Table */}
      <div className="hidden md:block bg-[#0F1014] border border-white/[0.08] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] text-zinc-400 text-[11px] font-bold uppercase tracking-wider font-mono bg-white/[0.02]">
                <th className="py-3.5 pl-5 sm:pl-6">Pedido</th>
                <th className="py-3.5 px-4">Cliente</th>
                <th className="py-3.5 px-4">Data</th>
                <th className="py-3.5 px-4">Total</th>
                <th className="py-3.5 px-4">Pagamento</th>
                <th className="py-3.5 px-4">Entrega</th>
                <th className="py-3.5 text-right pr-5 sm:pr-6">Ações</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-white/[0.06]">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-14 h-14 rounded-2xl bg-[#15171D] border border-white/[0.08] flex items-center justify-center mb-3.5 shadow-inner">
                        <ShoppingCart className="w-6 h-6 text-zinc-500" />
                      </div>
                      <p className="text-zinc-200 font-semibold text-sm mb-1">Nenhum pedido ainda</p>
                      <p className="text-zinc-500 text-xs max-w-sm">As compras realizadas no seu Mini App aparecerão listadas aqui.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((order) => {
                  const access = order.accesses?.[0];
                  return (
                    <tr key={order.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 pl-5 sm:pl-6">
                        <span className="text-zinc-300 font-mono text-[11px] bg-white/[0.04] px-2 py-1 rounded-md border border-white/[0.08]">
                          #{order.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {order.customer ? (
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/20 font-bold text-[10px] shrink-0 overflow-hidden">
                              {order.customer.photoUrl ? (
                                <img src={order.customer.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                (order.customer.firstName?.[0] || 'U').toUpperCase()
                              )}
                            </div>
                            <span className="text-zinc-200 font-medium truncate max-w-[160px]">{order.customer.firstName} {order.customer.lastName}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-500">Desconhecido</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                        {formatBusinessDateTime(order.createdAt)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-emerald-400 font-mono font-bold text-xs tracking-tight tabular-nums">
                          R$ {Number(order.total).toFixed(2).replace('.', ',')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {order.status === 'paid' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> APROVADO
                          </span>
                        ) : order.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> PENDENTE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> CANCELADO
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {!access ? (
                          <span className="text-zinc-500 text-xs">—</span>
                        ) : access.deliveryStatus === 'DELIVERED' || access.status === 'ACTIVE' ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                              🟢 Entregue
                            </span>
                            {access.telegramChatId && (
                              <span className="text-[10px] text-zinc-500 font-mono">Chat: {access.telegramChatId}</span>
                            )}
                          </div>
                        ) : access.deliveryStatus === 'PENDING' || (typeof access.deliveryStatus === 'string' && access.deliveryStatus.startsWith('PROCESSING')) ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-semibold">
                              🟡 Processando
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 items-start">
                            <span className="inline-flex items-center gap-1 text-red-400 text-xs font-semibold">
                              🔴 Falhou
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
                      <td className="py-3.5 text-right pr-5 sm:pr-6">
                        <Button variant="ghost" size="icon-sm" className="text-zinc-400 hover:text-white">
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

      {/* Orders List - Mobile Cards View */}
      <div className="block md:hidden space-y-3">
        {items.length === 0 ? (
          <div className="bg-[#0F1014] border border-white/[0.08] rounded-2xl p-6 text-center shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-[#15171D] border border-white/[0.08] flex items-center justify-center mx-auto mb-3">
              <ShoppingCart className="w-6 h-6 text-zinc-500" />
            </div>
            <p className="text-zinc-200 font-semibold text-sm mb-1">Nenhum pedido ainda</p>
            <p className="text-zinc-500 text-xs">As compras realizadas no seu Mini App aparecerão listadas aqui.</p>
          </div>
        ) : (
          items.map((order) => {
            const access = order.accesses?.[0];
            return (
              <div 
                key={order.id} 
                className="bg-[#0F1014] border border-white/[0.08] rounded-2xl p-4 space-y-3 shadow-sm"
              >
                {/* Header: ID + Status */}
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
                  <span className="text-zinc-300 font-mono text-[11px] bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.08]">
                    #{order.id.slice(0, 8)}
                  </span>
                  {order.status === 'paid' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> APROVADO
                    </span>
                  ) : order.status === 'pending' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> PENDENTE
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> CANCELADO
                    </span>
                  )}
                </div>

                {/* Body Details */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 text-[11px]">Cliente</span>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/20 font-bold text-[9px] overflow-hidden shrink-0">
                        {order.customer?.photoUrl ? (
                          <img src={order.customer.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          (order.customer?.firstName?.[0] || 'U').toUpperCase()
                        )}
                      </div>
                      <span className="text-zinc-200 font-medium truncate max-w-[150px]">
                        {order.customer ? `${order.customer.firstName} ${order.customer.lastName || ''}`.trim() : 'Desconhecido'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 text-[11px]">Data</span>
                    <span className="text-zinc-300 font-mono text-[11px]">
                      {formatBusinessDateTime(order.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 text-[11px]">Total</span>
                    <span className="text-emerald-400 font-mono font-bold text-sm tabular-nums">
                      R$ {Number(order.total).toFixed(2).replace('.', ',')}
                    </span>
                  </div>

                  {access && (
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                      <span className="text-zinc-500 text-[11px]">Entrega</span>
                      {access.deliveryStatus === 'DELIVERED' || access.status === 'ACTIVE' ? (
                        <span className="text-emerald-400 font-medium text-xs">🟢 Entregue</span>
                      ) : access.deliveryStatus === 'PENDING' || (typeof access.deliveryStatus === 'string' && access.deliveryStatus.startsWith('PROCESSING')) ? (
                        <span className="text-amber-400 font-medium text-xs">🟡 Processando</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-red-400 font-medium text-xs">🔴 Falhou</span>
                          <RetryDeliveryButton accessId={access.id} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
