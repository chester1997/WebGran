"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { products, stores, telegramCustomers } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { 
  ArrowUpRight, 
  Wallet, 
  TrendingUp, 
  Users, 
  MoreHorizontal, 
  Download,
  ShoppingBag,
  Award,
  Crown,
  CheckCircle2,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function SellerDashboardPage() {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <div>Store not found</div>;
  }

  // Basic Metrics
  const pResult = await db.select({ value: count() }).from(products).where(eq(products.storeId, store.id));
  const productsCount = pResult[0].value;
  
  const cResult = await db.select({ value: count() }).from(telegramCustomers).where(eq(telegramCustomers.storeId, store.id));
  const customersCount = cResult[0].value;
  
  // Mock Metrics for Dashboard Display
  const todayRevenue = 0;
  const todayOrders = 0;
  const last7DaysRevenue = 0;
  const last7DaysOrders = 0;
  const totalRevenue = 0;
  const averageTicket = 0;
  const pendingPix = 0;
  const conversionRate = "0%";
  
  // Gamification logic
  const currentLevel = "Bronze";
  const nextLevel = "Prata";
  const nextLevelThreshold = 10000;
  const progressPercent = (totalRevenue / nextLevelThreshold) * 100;
  const remainingToNext = nextLevelThreshold - totalRevenue;

  return (
    <div className="space-y-6 fade-in w-full">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Olá, {store.name}
        </h2>
        <p className="text-zinc-400 text-sm mt-1">Visão geral da sua operação</p>
      </div>

      {/* Gamification Bar */}
      <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-xl relative overflow-hidden flex items-center justify-between">
        <div className="flex items-center gap-5 relative z-10 w-full">
          {/* Badge/Trophy */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-700/40 to-amber-900/10 border border-amber-600/30 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(217,119,6,0.15)]">
            <Award className="w-8 h-8 text-amber-500" />
          </div>
          
          <div className="flex-1">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Sua Classificação</p>
            <div className="flex items-end gap-3 mb-2">
              <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
                {currentLevel}
              </h3>
            </div>
            
            {/* Progress Track */}
            <div className="flex items-center gap-4 w-full max-w-2xl">
              <div className="flex-1 h-2 bg-[#0A0A0A] rounded-full overflow-hidden border border-white/5 relative">
                <div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full"
                  style={{ width: `${Math.max(progressPercent, 2)}%` }}
                ></div>
              </div>
              <span className="text-xs font-medium text-zinc-400 shrink-0">
                Faltam <span className="text-white">R$ {remainingToNext.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> para {nextLevel}
              </span>
            </div>
          </div>
          
          <div className="hidden lg:block shrink-0 text-right">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Meta Acumulada</p>
            <p className="text-lg font-bold text-white">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        
        {/* Glow Effects */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-amber-500/5 blur-[100px] rounded-full pointer-events-none"></div>
      </div>

      {/* Metrics Grid (2x4) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Vendas Hoje */}
        <div className="bg-[#121214] rounded-xl p-5 border border-white/5 shadow-md flex flex-col justify-between hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Vendas Hoje</p>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">R$ {todayRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <p className="text-xs text-zinc-500">{todayOrders} pedidos confirmados</p>
          </div>
        </div>

        {/* Últimos 7 dias */}
        <div className="bg-[#121214] rounded-xl p-5 border border-white/5 shadow-md flex flex-col justify-between hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Últimos 7 Dias</p>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
              <TrendingUp className="w-4 h-4 text-violet-400" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">R$ {last7DaysRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <p className="text-xs text-zinc-500">{last7DaysOrders} pedidos no período</p>
          </div>
        </div>

        {/* Receita Total */}
        <div className="bg-[#121214] rounded-xl p-5 border border-white/5 shadow-md flex flex-col justify-between hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Receita Total</p>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Wallet className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <p className="text-xs text-emerald-500/80 font-medium">Líquido disponível</p>
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="bg-[#121214] rounded-xl p-5 border border-white/5 shadow-md flex flex-col justify-between hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Ticket Médio</p>
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center border border-white/10">
              <ShoppingBag className="w-4 h-4 text-zinc-400" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">R$ {averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <p className="text-xs text-zinc-500">Média por cliente</p>
          </div>
        </div>

        {/* Produtos Ativos */}
        <div className="bg-[#121214] rounded-xl p-5 border border-white/5 shadow-md flex flex-col justify-between hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Produtos Ativos</p>
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center border border-white/10">
              <ShoppingBag className="w-4 h-4 text-zinc-400" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">{productsCount}</h3>
            <p className="text-xs text-zinc-500">No catálogo atual</p>
          </div>
        </div>

        {/* Total Clientes */}
        <div className="bg-[#121214] rounded-xl p-5 border border-white/5 shadow-md flex flex-col justify-between hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Total Clientes</p>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">{customersCount}</h3>
            <p className="text-xs text-zinc-500">Na sua base de dados</p>
          </div>
        </div>

        {/* PIX Pendente */}
        <div className="bg-[#121214] rounded-xl p-5 border border-white/5 shadow-md flex flex-col justify-between hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">PIX Pendentes</p>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-amber-400 mb-1">{pendingPix}</h3>
            <p className="text-xs text-zinc-500">Aguardando pagamento</p>
          </div>
        </div>

        {/* Conversão */}
        <div className="bg-[#121214] rounded-xl p-5 border border-white/5 shadow-md flex flex-col justify-between hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Taxa de Conversão</p>
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center border border-pink-500/20">
              <ArrowUpRight className="w-4 h-4 text-pink-400" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">{conversionRate}</h3>
            <p className="text-xs text-zinc-500">Visitas x Vendas</p>
          </div>
        </div>
      </div>

      {/* Bottom Layout (Top Products & Latest Sales) */}
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        
        {/* Produtos Mais Vendidos */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <Crown className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white tracking-tight">Produtos mais vendidos</h3>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-60">
            <div className="w-16 h-16 rounded-2xl bg-[#1A1A1E] flex items-center justify-center mb-4 border border-white/5">
              <ShoppingBag className="w-6 h-6 text-zinc-500" />
            </div>
            <p className="text-zinc-400 font-medium text-sm">Nenhuma venda registrada ainda</p>
            <p className="text-zinc-600 text-xs mt-1 text-center max-w-xs">Os produtos com maior volume de vendas aparecerão listados aqui.</p>
          </div>
        </div>

        {/* Últimas Vendas */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white tracking-tight">Últimas vendas</h3>
            </div>
            <Link href="/seller/orders" className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors">
              Ver todas
            </Link>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-60">
            <div className="w-16 h-16 rounded-2xl bg-[#1A1A1E] flex items-center justify-center mb-4 border border-white/5">
              <CheckCircle2 className="w-6 h-6 text-zinc-500" />
            </div>
            <p className="text-zinc-400 font-medium text-sm">O histórico de vendas está vazio</p>
            <p className="text-zinc-600 text-xs mt-1 text-center max-w-xs">Quando os clientes começarem a comprar via PIX/Cartão, os pedidos aparecerão aqui em tempo real.</p>
          </div>
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
