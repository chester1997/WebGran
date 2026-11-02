"use client";

import React from "react";
import Link from "next/link";
import { 
  Bot, 
  Package, 
  CheckCircle2, 
  Clock, 
  UserPlus, 
  ArrowRight,
  Activity,
  ShoppingBag
} from "lucide-react";
import { ActivityLogItem, TopProductItem, ChannelItem } from "@/lib/analytics/analytics-service";
import { DashboardEmptyState } from "./DashboardEmptyState";

interface SellerActivityAndChannelsProps {
  activityLog?: ActivityLogItem[];
  topProducts?: TopProductItem[];
  channels?: ChannelItem[];
  totalBotsCount?: number;
  isPending?: boolean;
  selectedBotId?: string | null;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (isNaN(diffMs)) return "recentemente";
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "agora";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `há ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `há ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "ontem";
    if (diffDays < 30) return `há ${diffDays} d`;
    return `há ${Math.floor(diffDays / 30)} m`;
  } catch (_e) {
    return "recentemente";
  }
}

function getActivityLabel(type: string): string {
  switch (type) {
    case "lead":
      return "Nova pessoa iniciou conversa";
    case "sale_approved":
      return "Venda aprovada";
    case "payment_pending":
      return "Cobrança aguardando pagamento";
    default:
      return "Nova atividade";
  }
}

export function SellerActivityAndChannels({
  activityLog = [],
  topProducts = [],
  channels = [],
  totalBotsCount = 0,
  isPending = false,
  selectedBotId = null,
}: SellerActivityAndChannelsProps) {
  // Apenas exibe "Desempenho por bot" se a loja tiver mais de um bot cadastrado/canal
  const effectiveBotsCount = Math.max(channels.length, totalBotsCount);
  const hasMultipleBots = effectiveBotsCount > 1;

  return (
    <div
      className={`grid grid-cols-1 ${
        hasMultipleBots ? "lg:grid-cols-3" : "lg:grid-cols-2"
      } gap-5`}
    >
      {/* =========================================================================
          1. ATIVIDADE RECENTE (Lado Esquerdo)
         ========================================================================= */}
      <section
        aria-label="Atividade recente"
        className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 sm:p-6 flex flex-col justify-between min-h-[380px]"
      >
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">Atividade recente</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Acontecimentos em tempo real</p>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#3984FF]/10 border border-[#3984FF]/25 text-[10px] font-medium text-[#3984FF] shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3984FF] animate-pulse motion-reduce:animate-none" />
              <span>Tempo real</span>
            </div>
          </div>

          {isPending ? (
            <div 
              aria-busy="true" 
              aria-label="Carregando atividade recente"
              className="space-y-2 py-2 animate-pulse motion-reduce:animate-none"
            >
              <div className="h-12 bg-white/[0.03] rounded-[8px]" />
              <div className="h-12 bg-white/[0.03] rounded-[8px]" />
              <div className="h-12 bg-white/[0.03] rounded-[8px]" />
            </div>
          ) : activityLog.length === 0 ? (
            <DashboardEmptyState
              icon={Activity}
              title="Sem atividades recentes"
              description="Quando novas conversas ou compras forem realizadas, elas aparecerão aqui em tempo real."
              actionText="Ver link do bot"
              actionHref="/seller/store"
              className="my-auto"
            />
          ) : (
            <div 
              tabIndex={0}
              role="region"
              aria-label="Lista de atividades recentes rolável"
              className="max-h-[360px] overflow-y-auto no-scrollbar pr-0.5 focus:outline-none focus:ring-1 focus:ring-[#3984FF]/30 rounded-[8px] [mask-image:linear-gradient(to_bottom,black_85%,transparent)]"
            >
              <ul role="list" className="space-y-2 pb-6">
                {activityLog.map((event) => {
                  const isSale = event.type === "sale_approved";
                  const isPendingPay = event.type === "payment_pending";

                  const iconBoxClass = isSale
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : isPendingPay
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-white/[0.06] text-zinc-300 border-white/10";

                  const relativeTime = formatRelativeTime(event.timestamp);
                  const fullDateTime = `${event.dateFormatted} às ${event.timeFormatted}`;
                  const titleLabel = getActivityLabel(event.type);

                  return (
                    <li
                      key={event.id}
                      className="p-3 rounded-[8px] bg-[var(--seller-surface-raised,#181A20)] border border-[var(--seller-border,rgba(255,255,255,0.06))] hover:border-white/10 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-7 h-7 rounded-[6px] border flex items-center justify-center shrink-0 ${iconBoxClass}`}
                        >
                          {isSale ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : isPendingPay ? (
                            <Clock className="w-3.5 h-3.5" />
                          ) : (
                            <UserPlus className="w-3.5 h-3.5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-medium text-white leading-tight">
                              {titleLabel}
                            </p>
                            {hasMultipleBots && event.botName && (
                              <span className="text-[10px] text-zinc-400 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.2 rounded shrink-0">
                                {event.botName}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                            <span className="text-zinc-300">{event.targetName}</span>
                            {event.description && (
                              <>
                                <span className="mx-1 text-zinc-600">—</span>
                                <span
                                  className={
                                    isSale
                                      ? "text-emerald-400 font-medium"
                                      : isPendingPay
                                      ? "text-amber-400"
                                      : "text-zinc-400"
                                  }
                                >
                                  {event.description}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <time
                          dateTime={event.timestamp}
                          title={fullDateTime}
                          className="text-[11px] text-zinc-400 hover:text-zinc-300 transition-colors cursor-default select-none font-sans tabular-nums"
                        >
                          {relativeTime}
                        </time>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="pt-3 mt-3 border-t border-white/[0.04] text-[11px] text-zinc-400 flex items-center justify-between">
          <span>Registros no período</span>
          <span className="font-sans font-medium tabular-nums text-zinc-300">
            {activityLog.length} {activityLog.length === 1 ? "registro" : "registros"}
          </span>
        </div>
      </section>

      {/* =========================================================================
          2. PRODUTOS MAIS VENDIDOS (Meio)
         ========================================================================= */}
      <section
        aria-label="Produtos mais vendidos"
        className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 sm:p-6 flex flex-col justify-between min-h-[380px]"
      >
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">Produtos mais vendidos</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Ranking por receita aprovada no período</p>
            </div>
          </div>

          {isPending ? (
            <div 
              aria-busy="true" 
              aria-label="Carregando produtos mais vendidos"
              className="space-y-2.5 py-2 animate-pulse motion-reduce:animate-none"
            >
              <div className="h-12 bg-white/[0.03] rounded-[8px]" />
              <div className="h-12 bg-white/[0.03] rounded-[8px]" />
            </div>
          ) : topProducts.length === 0 ? (
            <div className="py-12 text-center bg-white/[0.02] rounded-[8px] border border-white/[0.04] p-6 space-y-3 my-auto">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#3984FF] flex items-center justify-center mx-auto mb-1 shrink-0">
                <ShoppingBag className="w-5 h-5 stroke-[1.75]" />
              </div>
              <p className="text-xs text-zinc-400">
                Você ainda não vendeu. Veja como divulgar o seu bot
              </p>
              <Link
                href="/seller/store"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#3984FF] hover:bg-[#2563EB] text-white text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-[#3984FF]"
              >
                <span>Divulgar meu bot</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ) : (
            <div 
              tabIndex={0}
              role="region"
              aria-label="Lista de produtos mais vendidos rolável"
              className="max-h-[360px] overflow-y-auto no-scrollbar pr-0.5 focus:outline-none focus:ring-1 focus:ring-[#3984FF]/30 rounded-[8px] [mask-image:linear-gradient(to_bottom,black_85%,transparent)]"
            >
              <ul role="list" className="space-y-2 pb-6">
                {topProducts.map((prod) => {
                  const percentage = prod.percentage ?? 0;
                  return (
                    <li
                      key={prod.id}
                      className="p-3 rounded-[8px] bg-[var(--seller-surface-raised,#181A20)] border border-[var(--seller-border,rgba(255,255,255,0.06))] hover:border-white/10 transition-colors space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3 min-w-0">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {/* Miniatura do produto */}
                          <div className="w-9 h-9 rounded-[6px] overflow-hidden bg-black/40 border border-white/[0.06] shrink-0 flex items-center justify-center text-zinc-500">
                            {prod.coverUrl ? (
                              <img
                                src={prod.coverUrl}
                                alt={prod.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-4 h-4 text-zinc-500" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-white truncate leading-tight">
                              {prod.title}
                            </p>
                            <p className="text-[11px] text-zinc-400 mt-0.5 font-sans tabular-nums">
                              {prod.salesCount} {prod.salesCount === 1 ? "unidade vendida" : "unidades vendidas"}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-white font-sans tabular-nums">
                            {formatBRL(prod.revenue)}
                          </p>
                          {percentage > 0 && (
                            <span className="text-[10px] text-zinc-400 font-sans tabular-nums">
                              {percentage}% do total
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Barra discreta de participação em azul */}
                      {percentage > 0 && (
                        <div className="h-1 w-full bg-white/[0.04] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#3984FF] rounded-full transition-all duration-500 motion-reduce:transition-none"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="pt-3 mt-3 border-t border-white/[0.04] text-[11px] text-zinc-400 flex items-center justify-between">
          <span>Catálogo vendido</span>
          <span className="font-sans font-medium tabular-nums text-zinc-300">
            {topProducts.length} {topProducts.length === 1 ? "produto" : "produtos"}
          </span>
        </div>
      </section>

      {/* =========================================================================
          3. DESEMPENHO POR BOT (SÓ APARECE SE HOUVER MAIS DE UM BOT)
         ========================================================================= */}
      {hasMultipleBots && (
        <section
          aria-label="Desempenho por bot"
          className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 sm:p-6 flex flex-col justify-between min-h-[380px]"
        >
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-tight">Desempenho por bot</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Métricas e conversão por canal</p>
              </div>

              <div className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] font-sans tabular-nums text-zinc-300 font-medium">
                {channels.length} {channels.length === 1 ? "bot" : "bots"}
              </div>
            </div>

            {isPending ? (
              <div 
                aria-busy="true"
                aria-label="Carregando desempenho por bot"
                className="space-y-2.5 py-2 animate-pulse motion-reduce:animate-none"
              >
                <div className="h-16 bg-white/[0.03] rounded-[8px]" />
                <div className="h-16 bg-white/[0.03] rounded-[8px]" />
              </div>
            ) : channels.length === 0 ? (
              <DashboardEmptyState
                icon={Bot}
                title="Nenhum bot conectado"
                description="Conecte seu robô do Telegram para acompanhar as vendas por canal."
                actionText="Conectar bot"
                actionHref="/seller/store"
                className="my-auto"
              />
            ) : (
              <div 
                tabIndex={0}
                role="region"
                aria-label="Lista de desempenho por bot rolável"
                className="max-h-[360px] overflow-y-auto no-scrollbar pr-0.5 focus:outline-none focus:ring-1 focus:ring-[#3984FF]/30 rounded-[8px] [mask-image:linear-gradient(to_bottom,black_85%,transparent)]"
              >
                <ul role="list" className="space-y-2 pb-6">
                  {channels.map((chan) => {
                    const isSelected = selectedBotId === chan.channel;
                    const percentage = chan.percentage ?? 0;

                    return (
                      <li
                        key={chan.channel}
                        className={`p-3 rounded-[8px] bg-[var(--seller-surface-raised,#181A20)] border transition-all space-y-2.5 ${
                          isSelected
                            ? "border-[#3984FF]/60 ring-1 ring-[#3984FF]/30"
                            : "border-[var(--seller-border,rgba(255,255,255,0.06))] hover:border-white/10"
                        }`}
                      >
                        {/* Top row: Bot info e receita */}
                        <div className="flex items-center justify-between text-xs gap-2">
                          <span className="font-medium text-white flex items-center gap-2 min-w-0">
                            <div className="w-5 h-5 rounded-full bg-[#3984FF]/10 border border-[#3984FF]/25 flex items-center justify-center text-[#3984FF] shrink-0">
                              <Bot className="w-3 h-3" />
                            </div>
                            <span className="truncate">{chan.label}</span>
                            {chan.username && (
                              <span className="text-[10px] text-zinc-400 truncate hidden sm:inline">
                                @{chan.username.replace(/^@/, "")}
                              </span>
                            )}
                          </span>

                          <span className="font-bold text-white font-sans tabular-nums shrink-0">
                            {formatBRL(chan.revenue)}
                          </span>
                        </div>

                        {/* Barra de progresso de receita relativa */}
                        <div className="h-1 w-full bg-white/[0.04] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 motion-reduce:transition-none ${
                              isSelected ? "bg-[#3984FF]" : "bg-[#3984FF]/70"
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>

                        {/* Detalhes inferiores: Vendas e starts */}
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5 font-sans tabular-nums">
                          <span>
                            {chan.salesCount} {chan.salesCount === 1 ? "venda" : "vendas"}
                          </span>
                          {typeof chan.uniqueStarts === "number" && (
                            <span>{chan.uniqueStarts} conversas</span>
                          )}
                          <span>{percentage}% da receita</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-white/[0.04] text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Bots ativos</span>
            <span className="font-sans font-medium tabular-nums text-zinc-300">
              {channels.length} {channels.length === 1 ? "bot conectado" : "bots conectados"}
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
