"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import {
  DollarSign,
  MousePointerClick,
  ShieldCheck,
  CheckCircle2,
  Smartphone,
  HelpCircle,
  Users,
  ShoppingBag,
  Clock,
  UserPlus,
  Check,
  Package,
  Activity,
  Inbox,
  TrendingUp,
} from "lucide-react";
import type { BotActivityEvent, TopSellingProduct } from "../[id]/SingleBotClient";

interface MetricsData {
  approvedRevenue: number;
  totalCustomers: number;
  averageTicket: number;
  activeProductsCount: number;
  totalOrders?: number;
  paidCount?: number;
  conversionRate?: number;
  clicksCount?: number;
  conversationsCount?: number;
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
  recentActivity?: BotActivityEvent[];
  topSellingProducts?: TopSellingProduct[];
  selectedPeriod: "today" | "week" | "month" | "year";
  onSelectPeriod: (period: "today" | "week" | "month" | "year") => void;
  onOpenConversas?: () => void;
  isAdmin?: boolean;
  userRole?: string;
  showOperationalStatus?: boolean;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return "agora";
    if (diffMin < 60) return `há ${diffMin} min`;
    if (diffHours === 1) return "há 1 h";
    if (diffHours < 24) return `há ${diffHours} h`;
    if (diffDays === 1) return "ontem";
    if (diffDays < 30) return `há ${diffDays} d`;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
  } catch {
    return "recente";
  }
}

export default function BotOverviewTab({
  bot,
  metrics,
  recentActivity = [],
  topSellingProducts = [],
  selectedPeriod,
  onSelectPeriod,
  onOpenConversas,
  isAdmin = false,
  userRole,
  showOperationalStatus,
}: BotOverviewTabProps) {
  const isRunning = bot.status === "active";

  // Ocultado por padrão da Visão Geral conforme solicitado pelo usuário.
  // Permanece falso mesmo para administradores, a menos que explicitamente ativado via prop.
  const isVisibleOperationalStatus = Boolean(showOperationalStatus);

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

  // Formatação de ticket médio: R$ X,XX
  const formattedTicket = useMemo(() => {
    const raw = metrics.averageTicket || 0;
    return raw.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [metrics.averageTicket]);

  return (
    <div className="space-y-5">
      {/* LINHA DE INDICADORES: 4 CARDS UNIFICADOS E PROPORCIONAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: RECEITA APROVADA */}
        <div className="bg-[#171717] border border-white/[0.08] hover:border-white/[0.14] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-sm transition-all min-h-[145px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs sm:text-sm font-semibold text-zinc-300 tracking-tight flex items-center gap-1.5">
              Receita aprovada
              <span
                title="Pagos no período por este bot, valor líquido."
                className="cursor-help inline-flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </span>
            </span>
            <DollarSign className="w-5 h-5 text-[#3984FF] stroke-[2.2] shrink-0" />
          </div>

          <div className="mt-3">
            <div className="flex items-baseline">
              <span className="text-sm sm:text-base font-bold text-zinc-400 mr-1">R$</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {formattedRevenue.integer}
              </span>
              <span className="text-xl sm:text-2xl font-bold text-zinc-300 tracking-tight">
                ,{formattedRevenue.decimal}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Pagos no período por este bot, valor líquido.
            </p>
          </div>
        </div>

        {/* Card 2: TOTAL DE CLIENTES */}
        <div className="bg-[#171717] border border-white/[0.08] hover:border-white/[0.14] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-sm transition-all min-h-[145px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs sm:text-sm font-semibold text-zinc-300 tracking-tight">
              Total de clientes
            </span>
            <Users className="w-5 h-5 text-[#3984FF] stroke-[2] shrink-0" />
          </div>

          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {metrics.totalCustomers}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Clientes únicos com interação
            </p>
          </div>
        </div>

        {/* Card 3: TICKET MÉDIO */}
        <div className="bg-[#171717] border border-white/[0.08] hover:border-white/[0.14] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-sm transition-all min-h-[145px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs sm:text-sm font-semibold text-zinc-300 tracking-tight">
              Ticket médio
            </span>
            <TrendingUp className="w-5 h-5 text-[#3984FF] stroke-[2] shrink-0" />
          </div>

          <div className="mt-3">
            <div className="flex items-baseline">
              <span className="text-sm sm:text-base font-bold text-zinc-400 mr-1">R$</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {formattedTicket}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Média por pedido aprovado
            </p>
          </div>
        </div>

        {/* Card 4: PRODUTOS ATIVOS */}
        <div className="bg-[#171717] border border-white/[0.08] hover:border-white/[0.14] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-sm transition-all min-h-[145px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs sm:text-sm font-semibold text-zinc-300 tracking-tight">
              Produtos ativos
            </span>
            <Package className="w-5 h-5 text-[#3984FF] stroke-[2] shrink-0" />
          </div>

          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {metrics.activeProductsCount}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Disponíveis no catálogo do bot
            </p>
          </div>
        </div>
      </div>

      {/* 3. SEÇÃO 2: ATIVIDADE RECENTE (ESQUERDA) + MAIS VENDIDOS (DIREITA) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card Esquerdo: ATIVIDADE RECENTE */}
        <div className="bg-[#171717] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between min-h-[380px]">
          <div>
            {/* Header do Card */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/[0.06]">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Atividade recente</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Acontecimentos em tempo real</p>
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Ao vivo</span>
              </div>
            </div>

            {/* Lista de Acontecimentos */}
            <div className="py-2 divide-y divide-white/[0.04] max-h-[340px] overflow-y-auto sidebar-scroll">
              {recentActivity.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center text-zinc-500 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center text-zinc-500">
                    <Activity className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-medium text-zinc-400">Nenhuma atividade recente</p>
                  <p className="text-[11px] text-zinc-600 max-w-xs leading-relaxed">
                    Acontecimentos do bot aparecerão aqui conforme clientes interagirem e realizarem pedidos.
                  </p>
                </div>
              ) : (
                recentActivity.slice(0, 10).map((event) => {
                  const isApproved = event.type === "sale_approved";
                  const isPending = event.type === "payment_pending";

                  return (
                    <div key={event.id} className="py-3 flex items-center gap-3">
                      {/* Ícone Semântico */}
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${isApproved
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                          : isPending
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                            : "bg-white/[0.04] border-white/10 text-zinc-400"
                          }`}
                      >
                        {isApproved ? (
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        ) : isPending ? (
                          <Clock className="w-4 h-4" />
                        ) : (
                          <UserPlus className="w-4 h-4" />
                        )}
                      </div>

                      {/* Informações Centrais */}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs">
                            {event.title}
                          </span>
                          {event.botTag && (
                            <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400 bg-white/[0.04] border border-white/[0.08] px-1.5 py-0.5 rounded shrink-0">
                              {event.botTag}
                            </span>
                          )}
                        </div>

                        <p
                          className={`text-xs truncate ${isApproved ? "text-emerald-400 font-medium" : "text-zinc-400"
                            }`}
                        >
                          {event.description}
                        </p>
                      </div>

                      {/* Tempo Relativo */}
                      <span className="text-[11px] sm:text-xs text-zinc-500 font-medium shrink-0 ml-auto whitespace-nowrap">
                        {formatRelativeTime(event.createdAt)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Rodapé do Card */}
          <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
            <span className="text-zinc-400">Registros no período</span>
            <span className="font-semibold text-zinc-200 tabular-nums">
              {recentActivity.length} {recentActivity.length === 1 ? "registro" : "registros"}
            </span>
          </div>
        </div>

        {/* Card Direito: MAIS VENDIDOS */}
        <div className="bg-[#171717] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between min-h-[380px]">
          <div>
            {/* Header do Card */}
            <div className="pb-4 border-b border-white/[0.06]">
              <h3 className="text-base font-bold text-white tracking-tight">Mais vendidos</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Ranking por receita aprovada no período</p>
            </div>

            {/* Lista de Produtos Mais Vendidos */}
            <div className="py-2 divide-y divide-white/[0.04] max-h-[340px] overflow-y-auto sidebar-scroll">
              {topSellingProducts.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center text-zinc-500 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center text-zinc-500">
                    <Package className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-medium text-zinc-400">Nenhum produto vendido</p>
                  <p className="text-[11px] text-zinc-600 max-w-xs leading-relaxed">
                    As vendas aprovadas deste bot serão ranqueadas aqui conforme forem pagas.
                  </p>
                </div>
              ) : (
                topSellingProducts.slice(0, 10).map((product) => (
                  <div key={product.id} className="py-3 space-y-2">
                    <div className="flex items-center gap-3">
                      {/* Miniatura do Produto */}
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center relative">
                        {product.coverUrl ? (
                          <img
                            src={product.coverUrl}
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>

                      {/* Nome e Quantidade */}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <h4 className="text-xs sm:text-sm font-medium text-white truncate" title={product.title}>
                          {product.title}
                        </h4>
                        <p className="text-xs text-zinc-400">
                          {product.totalQuantity} {product.totalQuantity === 1 ? "unidade vendida" : "unidades vendidas"}
                        </p>
                      </div>

                      {/* Valor Aprovado e Percentual */}
                      <div className="text-right shrink-0 space-y-0.5">
                        <div className="text-xs sm:text-sm font-bold text-white tabular-nums">
                          R$ {product.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] text-zinc-400 tabular-nums">
                          {product.revenuePercent}% do total
                        </div>
                      </div>
                    </div>

                    {/* Barra Horizontal Proporcional */}
                    <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#3984FF] rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(product.revenuePercent, 2)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Rodapé do Card */}
          <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
            <span className="text-zinc-400">Produtos vendidos no período</span>
            <span className="font-semibold text-zinc-200 tabular-nums">
              {topSellingProducts.length} {topSellingProducts.length === 1 ? "produto" : "produtos"}
            </span>
          </div>
        </div>
      </div>

      {/* 4. PAINEL DE STATUS OPERACIONAL (Oculto para vendedores / Exclusivo para administração) */}
      {isVisibleOperationalStatus && (
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
      )}
    </div>
  );
}