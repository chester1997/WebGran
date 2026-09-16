import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { products, orders, telegramCustomers } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { ArrowUpRight, ArrowDownRight, Wallet, Users, ShoppingBag, TrendingUp, MoreHorizontal, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function SellerDashboardPage() {
  await requireSeller();
  const store = await getCurrentStore();

  let productsCount = 0;
  let ordersCount = 0;
  let customersCount = 0;

  if (store) {
    const pResult = await db.select({ value: count() }).from(products).where(eq(products.storeId, store.id));
    productsCount = pResult[0].value;

    const oResult = await db.select({ value: count() }).from(orders).where(eq(orders.storeId, store.id));
    ordersCount = oResult[0].value;

    const cResult = await db.select({ value: count() }).from(telegramCustomers).where(eq(telegramCustomers.storeId, store.id));
    customersCount = cResult[0].value;
  }

  return (
    <div className="space-y-8 fade-in">
      
      {/* Top Tabs (Visual) */}
      <div className="flex items-center gap-6 border-b border-white/5 pb-px text-sm font-medium">
        <div className="text-white border-b-2 border-violet-500 pb-3 -mb-px px-1">
          Visão Geral
        </div>
        <div className="text-zinc-500 hover:text-zinc-300 cursor-pointer pb-3 px-1 transition-colors">
          Notificações
        </div>
        <div className="text-zinc-500 hover:text-zinc-300 cursor-pointer pb-3 px-1 transition-colors">
          Histórico de Vendas
        </div>
      </div>

      {!store && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Você ainda não possui uma loja configurada. Acesse as configurações para criar.
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        
        {/* Card 1: Primary Gradient */}
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-6 shadow-xl shadow-violet-900/20 text-white border border-white/10 group">
          <div className="absolute top-0 right-0 p-4 opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
            <MoreHorizontal className="w-5 h-5" />
          </div>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-4 backdrop-blur-sm">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <p className="text-violet-100 text-sm font-medium mb-1">Faturamento Total</p>
          <div className="flex items-end gap-3 mb-2">
            <h3 className="text-3xl font-bold tracking-tight">R$ 0,00</h3>
            <span className="flex items-center text-xs font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full mb-1">
              <ArrowUpRight className="w-3 h-3 mr-0.5" /> +12.5%
            </span>
          </div>
          <p className="text-xs text-violet-200/70">Comparado ao mês passado</p>
        </div>

        {/* Card 2: Orders */}
        <div className="bg-[#121212] rounded-2xl p-6 border border-white/5 shadow-lg relative group hover:border-white/10 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
            <MoreHorizontal className="w-5 h-5 text-zinc-500 hover:text-white" />
          </div>
          <div className="w-10 h-10 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4 border border-white/5">
            <ShoppingBag className="w-5 h-5 text-violet-400" />
          </div>
          <p className="text-zinc-400 text-sm font-medium mb-1">Pedidos Realizados</p>
          <div className="flex items-end gap-3 mb-2">
            <h3 className="text-3xl font-bold tracking-tight text-white">{ordersCount}</h3>
            <span className="flex items-center text-xs font-semibold bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full mb-1">
              <ArrowDownRight className="w-3 h-3 mr-0.5" /> -3.1%
            </span>
          </div>
          <p className="text-xs text-zinc-500">Comparado ao mês passado</p>
        </div>

        {/* Card 3: Customers */}
        <div className="bg-[#121212] rounded-2xl p-6 border border-white/5 shadow-lg relative group hover:border-white/10 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
            <MoreHorizontal className="w-5 h-5 text-zinc-500 hover:text-white" />
          </div>
          <div className="w-10 h-10 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4 border border-white/5">
            <Users className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-zinc-400 text-sm font-medium mb-1">Clientes no Bot</p>
          <div className="flex items-end gap-3 mb-2">
            <h3 className="text-3xl font-bold tracking-tight text-white">{customersCount}</h3>
            <span className="flex items-center text-xs font-semibold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full mb-1">
              <ArrowUpRight className="w-3 h-3 mr-0.5" /> +25.4%
            </span>
          </div>
          <p className="text-xs text-zinc-500">Comparado ao mês passado</p>
        </div>

        {/* Card 4: Products */}
        <div className="bg-[#121212] rounded-2xl p-6 border border-white/5 shadow-lg relative group hover:border-white/10 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
            <MoreHorizontal className="w-5 h-5 text-zinc-500 hover:text-white" />
          </div>
          <div className="w-10 h-10 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4 border border-white/5">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-zinc-400 text-sm font-medium mb-1">Produtos Ativos</p>
          <div className="flex items-end gap-3 mb-2">
            <h3 className="text-3xl font-bold tracking-tight text-white">{productsCount}</h3>
          </div>
          <p className="text-xs text-zinc-500">Catálogo atual da loja</p>
        </div>
      </div>

      {/* Transaction History Section (Like the bottom part of the reference) */}
      <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 shadow-xl mt-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Pedidos Recentes</h3>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="bg-transparent border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white rounded-lg h-8 px-3 text-xs">
              <Download className="w-3 h-3 mr-2" /> Exportar
            </Button>
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg h-8 px-4 text-xs font-medium">
              Ver Todos
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-zinc-500 text-xs font-medium uppercase tracking-wider">
                <th className="pb-4 font-medium pl-2">Cliente / Produto</th>
                <th className="pb-4 font-medium">Valor Total</th>
                <th className="pb-4 font-medium">Data</th>
                <th className="pb-4 font-medium">Status</th>
                <th className="pb-4 font-medium text-right pr-2">Ação</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-white/5">
              {/* Empty State Mock for now, since DB is likely empty */}
              {ordersCount === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-3">
                        <ShoppingBag className="w-6 h-6 text-zinc-500" />
                      </div>
                      <p className="text-zinc-400 font-medium">Nenhum pedido recebido ainda</p>
                      <p className="text-zinc-600 text-xs mt-1">Divulgue sua loja para conseguir a primeira venda!</p>
                    </div>
                  </td>
                </tr>
              ) : (
                /* Mock Rows to showcase the design when there are orders */
                <>
                  <tr className="group hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 pl-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 border border-white/5">JD</div>
                        <div>
                          <p className="text-zinc-200 font-medium">João Silva</p>
                          <p className="text-zinc-500 text-xs">Acesso Premium 30 Dias</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-zinc-300">R$ 29,90</td>
                    <td className="py-4 text-zinc-500 text-sm">Hoje, 14:32</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                        <span className="text-emerald-400 text-xs font-medium">Aprovado</span>
                      </div>
                    </td>
                    <td className="py-4 text-right pr-2">
                      <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-white/5 h-8">
                        Detalhes
                      </Button>
                    </td>
                  </tr>
                  <tr className="group hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 pl-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 border border-white/5">MA</div>
                        <div>
                          <p className="text-zinc-200 font-medium">Maria Antonia</p>
                          <p className="text-zinc-500 text-xs">E-book Receitas</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-zinc-300">R$ 49,90</td>
                    <td className="py-4 text-zinc-500 text-sm">Ontem, 09:15</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                        <span className="text-amber-400 text-xs font-medium">Pendente</span>
                      </div>
                    </td>
                    <td className="py-4 text-right pr-2">
                      <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-white/5 h-8">
                        Detalhes
                      </Button>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
        .fade-in { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}
