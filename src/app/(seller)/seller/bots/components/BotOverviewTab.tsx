"use client";

import React from "react";
import Link from "next/link";
import { 
  DollarSign, 
  ShoppingCart, 
  MousePointerClick, 
  Package, 
  ImageIcon, 
  Settings, 
  Video, 
  Layers, 
  Bell, 
  ShieldCheck, 
  CheckCircle2, 
  Smartphone,
  HelpCircle,
  Users,
  CheckCircle,
  Sparkles
} from "lucide-react";

interface MetricsData {
  approvedRevenue: number;
  totalOrders: number;
  paidCount: number;
  conversionRate: number;
  clicksCount: number;
  conversationsCount: number;
}

interface BotOverviewTabProps {
  bot: {
    id: string;
    username: string;
    displayName: string;
    status: "active" | "paused" | "disconnected";
    storeSlug: string;
    storeName: string;
    chatsCount: number;
    recipientsCount: number;
  };
  metrics: MetricsData;
  selectedPeriod: "today" | "week" | "month" | "year";
  onSelectPeriod: (period: "today" | "week" | "month" | "year") => void;
  onOpenConversas: () => void;
}

export default function BotOverviewTab({
  bot,
  metrics,
  selectedPeriod,
  onSelectPeriod,
  onOpenConversas,
}: BotOverviewTabProps) {
  const isRunning = bot.status === "active";

  const periodLabels: Record<string, string> = {
    today: "Hoje",
    week: "Esta semana",
    month: "Este mês",
    year: "Este ano",
  };

  return (
    <div className="space-y-6">
      {/* 1. Barra Superior: Filtro de Período Alinhado à Direita (Referência Gerencia VIP) */}
      <div className="flex items-center justify-end">
        <div className="inline-flex items-center p-1 bg-[#111215] border border-white/10 rounded-xl text-xs font-semibold shadow-sm">
          {(["today", "week", "month", "year"] as const).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => onSelectPeriod(period)}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedPeriod === period
                  ? "bg-white/10 text-white font-bold shadow-inner"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {periodLabels[period]}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Grid de Métricas Principais (Referência Exata Gerencia VIP: 1 Card de Receita + Grid 2x2) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card de Receita Aprovada (Destaque Principal à Esquerda) */}
        <div className="bg-[#111215] border border-white/[0.08] rounded-2xl p-6 shadow-md flex flex-col justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-white">Receita aprovada</span>
                <span title="Pagos no período por este bot, valor líquido." className="cursor-help inline-flex items-center">
                  <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
                </span>
              </div>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Pagos no período por este bot, valor líquido.
            </p>
          </div>

          <div className="pt-4 border-t border-white/[0.04]">
            <div className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {metrics.approvedRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>
        </div>

        {/* Grid 2x2 à Direita: Cliques, Iniciaram, Criados, Aprovados */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card: Cliques no link */}
          <div className="bg-[#111215] border border-white/[0.08] rounded-2xl p-5 shadow-md flex flex-col justify-between gap-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Cliques no link</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {metrics.clicksCount}
            </div>
          </div>

          {/* Card: Iniciaram o bot */}
          <div className="bg-[#111215] border border-white/[0.08] rounded-2xl p-5 shadow-md flex flex-col justify-between gap-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Iniciaram o bot</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {metrics.conversationsCount}
            </div>
          </div>

          {/* Card: Pedidos criados */}
          <div className="bg-[#111215] border border-white/[0.08] rounded-2xl p-5 shadow-md flex flex-col justify-between gap-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium">
              <ShoppingCart className="w-4 h-4 text-[#3984FF]" />
              <span>Pedidos criados</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {metrics.totalOrders}
            </div>
          </div>

          {/* Card: Pedidos aprovados */}
          <div className="bg-[#111215] border border-white/[0.08] rounded-2xl p-5 shadow-md flex flex-col justify-between gap-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Pedidos aprovados</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {metrics.paidCount}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Seção de Gráficos de Conversão (Referência Gerencia VIP Frame 06) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gráfico 1: Iniciaram o bot */}
        <div className="bg-[#111215] border border-white/[0.08] rounded-2xl p-5 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-300">Iniciaram o bot</span>
            </div>
            <span className="text-xs font-bold text-zinc-400">Total: {metrics.conversationsCount}</span>
          </div>

          <div className="text-2xl font-extrabold text-white">
            {metrics.conversationsCount}
          </div>

          {/* Barras Visuais de Tendência */}
          <div className="h-28 pt-4 flex items-end gap-2 border-b border-white/[0.06] pb-2">
            <div className="flex-1 bg-white/[0.03] rounded-t hover:bg-white/[0.08] transition-colors h-[20%]" title="D-6" />
            <div className="flex-1 bg-white/[0.03] rounded-t hover:bg-white/[0.08] transition-colors h-[35%]" title="D-5" />
            <div className="flex-1 bg-white/[0.03] rounded-t hover:bg-white/[0.08] transition-colors h-[25%]" title="D-4" />
            <div className="flex-1 bg-white/[0.03] rounded-t hover:bg-white/[0.08] transition-colors h-[40%]" title="D-3" />
            <div className="flex-1 bg-white/[0.03] rounded-t hover:bg-white/[0.08] transition-colors h-[60%]" title="D-2" />
            <div className="flex-1 bg-white/[0.03] rounded-t hover:bg-white/[0.08] transition-colors h-[45%]" title="Ontem" />
            <div className="flex-1 bg-emerald-500 rounded-t shadow-lg shadow-emerald-500/20 h-[85%]" title="Hoje" />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>Início do período</span>
            <span>Hoje</span>
          </div>
        </div>

        {/* Gráfico 2: Pedidos aprovados */}
        <div className="bg-[#111215] border border-white/[0.08] rounded-2xl p-5 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-300">Pedidos aprovados</span>
            </div>
            <span className="text-xs font-bold text-zinc-400">Total: {metrics.paidCount}</span>
          </div>

          <div className="text-2xl font-extrabold text-white">
            {metrics.paidCount}
          </div>

          {/* Barras Visuais de Tendência */}
          <div className="h-28 pt-4 flex items-end gap-2 border-b border-white/[0.06] pb-2">
            <div className="flex-1 bg-white/[0.03] rounded-t hover:bg-white/[0.08] transition-colors h-[15%]" title="D-6" />
            <div className="flex-1 bg-white/[0.03] rounded-t hover:bg-white/[0.08] transition-colors h-[25%]" title="D-5" />
            <div className="flex-1 bg-white/[0.03] rounded-t hover:bg-white/[0.08] transition-colors h-[20%]" title="D-4" />
            <div className="flex-1 bg-white/[0.03] rounded-t hover:bg-white/[0.08] transition-colors h-[30%]" title="D-3" />
            <div className="flex-1 bg-white/[0.03] rounded-t hover:bg-white/[0.08] transition-colors h-[40%]" title="D-2" />
            <div className="flex-1 bg-white/[0.03] rounded-t hover:bg-white/[0.08] transition-colors h-[35%]" title="Ontem" />
            <div className="flex-1 bg-[#3984FF] rounded-t shadow-lg shadow-[#3984FF]/20 h-[75%]" title="Hoje" />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>Início do período</span>
            <span>Hoje</span>
          </div>
        </div>
      </div>

      {/* 4. Painel de Status Operacional do Bot */}
      <div className="bg-[#111215] border border-white/[0.08] rounded-2xl p-5 shadow-md">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#3984FF]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Status Operacional da Integração
            </h3>
          </div>

          <span className="text-[11px] text-zinc-500">
            Atualizado em tempo real
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <span className="text-zinc-500 text-[11px]">Conexão com Telegram</span>
            <div className="flex items-center gap-2 text-white font-semibold">
              <span className={`w-2 h-2 rounded-full ${isRunning ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <span>{isRunning ? "Webhook Ativo & Respondendo" : "Operação Pausada"}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <span className="text-zinc-500 text-[11px]">Modo de Operação</span>
            <div className="flex items-center gap-2 text-white font-semibold">
              <Smartphone className="w-3.5 h-3.5 text-[#3984FF]" />
              <span>Mini App Integrado</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <span className="text-zinc-500 text-[11px]">Canais & Destinatários</span>
            <div className="flex items-center gap-2 text-white font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{bot.chatsCount} canais • {bot.recipientsCount} notificações</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Atalhos Rápidos para Gerenciamento */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
          Ações Rápidas do Bot
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/seller/products"
            className="bg-[#111215] hover:bg-[#14151A] border border-white/[0.08] hover:border-[#3984FF]/40 rounded-2xl p-5 transition-all group shadow-md"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[#3984FF] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Package className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-zinc-500 group-hover:text-white transition-colors">
                Gerenciar →
              </span>
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Catálogo de Produtos</h4>
            <p className="text-xs text-zinc-400">Cadastre produtos, defina preços e vincule a entrega a este bot.</p>
          </Link>

          <Link
            href="/seller/banners"
            className="bg-[#111215] hover:bg-[#14151A] border border-white/[0.08] hover:border-[#3984FF]/40 rounded-2xl p-5 transition-all group shadow-md"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ImageIcon className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-zinc-500 group-hover:text-white transition-colors">
                Gerenciar →
              </span>
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Banners do Mini App</h4>
            <p className="text-xs text-zinc-400">Adicione banners promocionais para destacar seus lançamentos.</p>
          </Link>

          <Link
            href="/seller/videos"
            className="bg-[#111215] hover:bg-[#14151A] border border-white/[0.08] hover:border-[#3984FF]/40 rounded-2xl p-5 transition-all group shadow-md"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Video className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-zinc-500 group-hover:text-white transition-colors">
                Gerenciar →
              </span>
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Biblioteca de Vídeos</h4>
            <p className="text-xs text-zinc-400">Gerencie vídeos de entrega exclusiva e streaming protegido.</p>
          </Link>

          <Link
            href="/seller/combos"
            className="bg-[#111215] hover:bg-[#14151A] border border-white/[0.08] hover:border-[#3984FF]/40 rounded-2xl p-5 transition-all group shadow-md"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-zinc-500 group-hover:text-white transition-colors">
                Gerenciar →
              </span>
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Combos Promocionais</h4>
            <p className="text-xs text-zinc-400">Crie pacotes com múltiplos canais ou produtos em uma única compra.</p>
          </Link>

          <Link
            href="/seller/bot/notifications"
            className="bg-[#111215] hover:bg-[#14151A] border border-white/[0.08] hover:border-[#3984FF]/40 rounded-2xl p-5 transition-all group shadow-md"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Bell className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-zinc-500 group-hover:text-white transition-colors">
                Gerenciar →
              </span>
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Notificações de Vendas</h4>
            <p className="text-xs text-zinc-400">Configure quem recebe os alertas de Pix pago instantaneamente no Telegram.</p>
          </Link>

          <button
            type="button"
            onClick={onOpenConversas}
            className="bg-[#111215] hover:bg-[#14151A] border border-white/[0.08] hover:border-[#3984FF]/40 rounded-2xl p-5 transition-all group shadow-md text-left cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Settings className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-zinc-500 group-hover:text-white transition-colors">
                Abrir →
              </span>
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Central de Atendimento</h4>
            <p className="text-xs text-zinc-400">Visualize as mensagens trocadas e responda clientes pelo painel.</p>
          </button>
        </div>
      </div>
    </div>
  );
}
