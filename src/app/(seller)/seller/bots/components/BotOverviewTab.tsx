"use client";

import React, { useMemo } from "react";
import { 
  DollarSign, 
  MousePointerClick, 
  ShieldCheck, 
  CheckCircle2, 
  Smartphone,
  HelpCircle,
  Users,
  ShoppingBag
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

  const periodOptions: Array<{ id: "today" | "week" | "month" | "year"; label: string }> = [
    { id: "today", label: "Hoje" },
    { id: "week", label: "Esta semana" },
    { id: "month", label: "Este mês" },
    { id: "year", label: "Este ano" },
  ];

  // Formatação de receita: R$ X,XX
  const formattedRevenue = useMemo(() => {
    const raw = metrics.approvedRevenue || 0;
    const parts = raw.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).split(",");
    return {
      integer: parts[0] || "0",
      decimal: parts[1] || "00",
    };
  }, [metrics.approvedRevenue]);

  // Dias recentes para os eixos do gráfico (últimos 5 dias)
  const chartDays = useMemo(() => {
    const now = new Date();
    const days = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      days.push({
        label: `${day}/${month}`,
        isToday: i === 0,
        isPenultimate: i === 1,
      });
    }
    return days;
  }, []);

  return (
    <div className="space-y-5">
      {/* 1. SELETOR DE PERÍODO ALINHADO À DIREITA (Conforme Referência Visual) */}
      <div className="flex items-center justify-end">
        <div className="inline-flex items-center gap-1">
          {periodOptions.map((item) => {
            const isActive = selectedPeriod === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectPeriod(item.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#222222] text-white border border-white/20 font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. LINHA DE INDICADORES: RECEITA (ESQUERDA) + GRID 2x2 UNIFICADO (DIREITA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Bloco da Esquerda: Receita aprovada (~42% da largura no desktop) */}
        <div className="lg:col-span-5 bg-[#171717] border border-white/[0.08] rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1b2f1e] border border-[#2e5d34] flex items-center justify-center shrink-0 text-[#4ade80]">
                <DollarSign className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white tracking-tight">Receita aprovada</h3>
                  <span
                    title="Pagos no período por este bot, valor líquido."
                    className="cursor-help inline-flex items-center text-zinc-500 hover:text-zinc-300"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                  Pagos no período por este bot, valor líquido.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-8">
            <div className="flex items-baseline">
              <span className="text-base sm:text-lg font-bold text-zinc-400 mr-1.5">R$</span>
              <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {formattedRevenue.integer}
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                ,{formattedRevenue.decimal}
              </span>
            </div>
          </div>
        </div>

        {/* Bloco da Direita: Card Unificado 2x2 (~58% da largura no desktop) */}
        <div className="lg:col-span-7 bg-[#171717] border border-white/[0.08] rounded-2xl overflow-hidden grid grid-cols-1 sm:grid-cols-2 shadow-sm">
          {/* Quadrante 1: Cliques no link */}
          <div className="p-5 sm:p-6 border-b sm:border-r border-white/[0.06] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <MousePointerClick className="w-4 h-4 text-[#84cc16] shrink-0" />
              <span className="text-xs font-medium text-zinc-300">Cliques no link</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white mt-4">
              {metrics.clicksCount}
            </div>
          </div>

          {/* Quadrante 2: Iniciaram o bot */}
          <div className="p-5 sm:p-6 border-b border-white/[0.06] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#84cc16] shrink-0" />
              <span className="text-xs font-medium text-zinc-300">Iniciaram o bot</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white mt-4">
              {metrics.conversationsCount}
            </div>
          </div>

          {/* Quadrante 3: Pedidos criados */}
          <div className="p-5 sm:p-6 border-b sm:border-b-0 sm:border-r border-white/[0.06] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#84cc16] shrink-0" />
              <span className="text-xs font-medium text-zinc-300">Pedidos criados</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white mt-4">
              {metrics.totalOrders}
            </div>
          </div>

          {/* Quadrante 4: Pedidos aprovados */}
          <div className="p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#84cc16] shrink-0" />
              <span className="text-xs font-medium text-zinc-300">Pedidos aprovados</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white mt-4">
              {metrics.paidCount}
            </div>
          </div>
        </div>
      </div>

      {/* 3. SEÇÃO DE GRÁFICOS: 2 CARDS BALANCEADOS LADO A LADO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gráfico 1: Iniciaram o bot */}
        <div className="bg-[#171717] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-zinc-400">
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium text-zinc-300">Iniciaram o bot</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white mt-1">
              {metrics.conversationsCount}
            </div>
          </div>

          {/* Área Gráfica com Linhas Sutis e Barras */}
          <div className="mt-8 relative pt-6 pb-2">
            {/* Linhas de grade pontilhadas sutis */}
            <div className="absolute inset-x-0 top-0 flex flex-col justify-between h-32 pointer-events-none">
              <div className="flex items-center">
                <span className="text-[10px] text-zinc-500 w-5">1</span>
                <div className="flex-1 border-b border-dashed border-white/[0.05]" />
              </div>
              <div className="flex items-center">
                <span className="text-[10px] text-zinc-500 w-5">0</span>
                <div className="flex-1 border-b border-dashed border-white/[0.05]" />
              </div>
            </div>

            {/* Barras Alinhadas aos Dias */}
            <div className="h-32 pl-6 pr-2 flex items-end justify-between gap-3 relative z-10">
              {chartDays.map((day, idx) => {
                const isPeak = idx === 3 && metrics.conversationsCount > 0;
                const isHatched = idx === 4;

                return (
                  <div key={day.label} className="flex-1 flex flex-col items-center h-full justify-end">
                    {isPeak ? (
                      <div
                        className="w-full max-w-[28px] bg-gradient-to-t from-lime-600 via-lime-500 to-lime-400 rounded-t-sm shadow-lg shadow-lime-500/20"
                        style={{ height: "92%" }}
                        title={`${day.label}: ${metrics.conversationsCount}`}
                      />
                    ) : isHatched ? (
                      <div
                        className="w-full max-w-[28px] h-1.5 bg-[#84cc16]/40 rounded-t-sm"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(132, 204, 22, 0.6) 3px, rgba(132, 204, 22, 0.6) 6px)",
                        }}
                        title={`${day.label}: Projeção`}
                      />
                    ) : (
                      <div
                        className="w-full max-w-[28px] h-1 bg-[#84cc16] rounded-t-sm"
                        title={`${day.label}: 0`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legenda dos Dias */}
            <div className="pl-6 pr-2 mt-3 flex justify-between text-[11px] text-zinc-500 font-medium">
              {chartDays.map((day) => (
                <span key={day.label} className="text-center flex-1">
                  {day.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Gráfico 2: Pedidos aprovados */}
        <div className="bg-[#171717] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-zinc-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs font-medium text-zinc-300">Pedidos aprovados</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white mt-1">
              {metrics.paidCount}
            </div>
          </div>

          {/* Área Gráfica com Linhas Sutis e Barras */}
          <div className="mt-8 relative pt-6 pb-2">
            {/* Linhas de grade pontilhadas sutis */}
            <div className="absolute inset-x-0 top-0 flex flex-col justify-between h-32 pointer-events-none">
              <div className="flex items-center">
                <span className="text-[10px] text-zinc-500 w-5">1</span>
                <div className="flex-1 border-b border-dashed border-white/[0.05]" />
              </div>
              <div className="flex items-center">
                <span className="text-[10px] text-zinc-500 w-5">0</span>
                <div className="flex-1 border-b border-dashed border-white/[0.05]" />
              </div>
            </div>

            {/* Barras Alinhadas aos Dias */}
            <div className="h-32 pl-6 pr-2 flex items-end justify-between gap-3 relative z-10">
              {chartDays.map((day, idx) => {
                const isPeak = idx === 3 && metrics.paidCount > 0;
                const isHatched = idx === 4;

                return (
                  <div key={day.label} className="flex-1 flex flex-col items-center h-full justify-end">
                    {isPeak ? (
                      <div
                        className="w-full max-w-[28px] bg-gradient-to-t from-lime-600 via-lime-500 to-lime-400 rounded-t-sm shadow-lg shadow-lime-500/20"
                        style={{ height: "92%" }}
                        title={`${day.label}: ${metrics.paidCount}`}
                      />
                    ) : isHatched ? (
                      <div
                        className="w-full max-w-[28px] h-1.5 bg-[#84cc16]/40 rounded-t-sm"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(132, 204, 22, 0.6) 3px, rgba(132, 204, 22, 0.6) 6px)",
                        }}
                        title={`${day.label}: Projeção`}
                      />
                    ) : (
                      <div
                        className="w-full max-w-[28px] h-1 bg-[#84cc16] rounded-t-sm"
                        title={`${day.label}: 0`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legenda dos Dias */}
            <div className="pl-6 pr-2 mt-3 flex justify-between text-[11px] text-zinc-500 font-medium">
              {chartDays.map((day) => (
                <span key={day.label} className="text-center flex-1">
                  {day.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. PAINEL DE STATUS OPERACIONAL */}
      <div className="bg-[#171717] border border-white/[0.08] rounded-2xl p-5 shadow-sm">
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
    </div>
  );
}