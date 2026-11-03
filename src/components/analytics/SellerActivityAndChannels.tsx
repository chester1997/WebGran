"use client";

import React from "react";
import Link from "next/link";
import { 
  Bot, 
  Package, 
  Check, 
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

function toTitleCase(str: string): string {
  if (!str) return "";
  const preserveUpper = ["VIP", "PRO", "PLUS", "MAX", "AI", "API", "BRL", "PIX", "CLUB", "ADM"];
  const lowercaseWords = ["de", "da", "do", "das", "dos", "e", "em", "por", "com", "a", "o", "as", "os", "um", "uma", "para"];
  return str
    .split(/\s+/)
    .map((word, idx) => {
      if (!word) return "";
      if (word === "VIP" || word === "PRO" || word === "PLUS" || word === "MAX" || word === "3D") {
        return word.toUpperCase();
      }
      const lower = word.toLowerCase();
      if (idx > 0 && lowercaseWords.includes(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
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
  const effectiveBotsCount = Math.max(channels.length, totalBotsCount);
  const hasMultipleBots = effectiveBotsCount > 1;

  return (
    <div className="w-full max-w-none flex flex-col gap-[20px] font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','SF_Pro_Display','Inter',system-ui,sans-serif] [font-feature-settings:'tnum'] text-[var(--apple-text,#fff)]">
      {/* =========================================================================
          5. DUAS SUPERFÍCIES LADO A LADO (UMA COLUNA ABAIXO DE 860px)
         ========================================================================= */}
      <div
        className={`grid grid-cols-1 ${
          hasMultipleBots ? "lg:grid-cols-3" : "lg:grid-cols-2"
        } gap-[20px]`}
      >
        {/* =========================================================================
            SUPERFÍCIE 1: ATIVIDADE RECENTE (Lista Estilo iOS)
           ========================================================================= */}
        <section
          aria-label="Atividade recente"
          className="bg-[#1C1C1E] rounded-[22px] p-7 lg:p-8 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-[18px] sm:text-[20px] font-bold text-[var(--apple-text,#fff)] tracking-tight">
                  Atividade recente
                </h3>
                <p className="text-[13px] sm:text-[14px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] mt-0.5">
                  Acontecimentos em tempo real
                </p>
              </div>

              {/* Selo "Ao vivo" com bolinha verde */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--apple-surface-2,#2c2c2e)] text-[12px] font-medium text-[var(--apple-text,#fff)] shrink-0">
                <span className="w-2 h-2 rounded-full bg-[var(--apple-green,#30d158)] animate-pulse" />
                <span>Ao vivo</span>
                <span className="sr-only">Tempo real</span>
              </div>
            </div>

            {isPending ? (
              <div aria-busy="true" className="space-y-3 py-2 animate-pulse">
                <div className="h-12 bg-white/[0.03] rounded-[12px]" />
                <div className="h-12 bg-white/[0.03] rounded-[12px]" />
                <div className="h-12 bg-white/[0.03] rounded-[12px]" />
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
                aria-label="Lista de atividades recentes"
                className="max-h-[420px] overflow-y-auto no-scrollbar focus:outline-none focus:ring-1 focus:ring-[var(--apple-blue,#0a84ff)] rounded-[12px]"
              >
                <ul role="list" className="divide-y divide-[var(--apple-separator,rgba(84,84,88,0.25))]">
                  {activityLog.map((event) => {
                    const isSale = event.type === "sale_approved";
                    const isPendingPay = event.type === "payment_pending";
                    const isLead = event.type === "lead";

                    const relativeTime = formatRelativeTime(event.timestamp);
                    const fullDateTime = `${event.dateFormatted} às ${event.timeFormatted}`;
                    const labelText = getActivityLabel(event.type);

                    return (
                      <li key={event.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Ícone Circular de 36px */}
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                              isSale
                                ? "bg-[rgba(48,209,88,0.15)] text-[var(--apple-green,#30d158)]"
                                : "bg-[var(--apple-surface-2,#2c2c2e)] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))]"
                            }`}
                          >
                            {isSale ? (
                              <Check className="w-4 h-4 stroke-[2.5]" />
                            ) : isPendingPay ? (
                              <Clock className="w-4 h-4 stroke-[2]" />
                            ) : (
                              <UserPlus className="w-4 h-4 stroke-[2]" />
                            )}
                          </div>

                          {/* Textos da Linha */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[15px] font-bold text-[var(--apple-text,#fff)] truncate">
                                {event.targetName || "Cliente"}
                              </p>
                              {hasMultipleBots && event.botName && (
                                <span className="text-[10px] text-zinc-400 bg-white/[0.04] px-2 py-0.5 rounded-full shrink-0">
                                  {event.botName}
                                </span>
                              )}
                            </div>

                            <p className="text-[13px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] truncate mt-0.5">
                              {isSale ? (
                                <>
                                  <span className="text-[var(--apple-green,#30d158)] font-medium">Venda aprovada</span>
                                  {event.description && <span> · {event.description}</span>}
                                </>
                              ) : isPendingPay ? (
                                <>
                                  <span>Cobrança aguardando pagamento</span>
                                  {event.description && <span> · {event.description}</span>}
                                </>
                              ) : (
                                <span>Iniciou uma conversa</span>
                              )}
                              <span className="sr-only">
                                {isLead ? "Nova pessoa iniciou conversa" : labelText}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Tempo relativo à direita */}
                        <div className="text-right shrink-0">
                          <time
                            dateTime={event.timestamp}
                            title={fullDateTime}
                            className="text-[13px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] font-normal tabular-nums cursor-default select-none"
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

          {/* Rodapé com "Registros no período" e o total */}
          <div className="pt-3.5 mt-3.5 border-t border-[var(--apple-separator,rgba(84,84,88,0.25))] text-[13px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] flex items-center justify-between">
            <span>Registros no período</span>
            <span className="font-bold text-[var(--apple-text,#fff)] tabular-nums">
              {activityLog.length} {activityLog.length === 1 ? "registro" : "registros"}
            </span>
          </div>
        </section>

        {/* =========================================================================
            SUPERFÍCIE 2: MAIS VENDIDOS (Ranking Numerado com Barra Azul de 4px)
           ========================================================================= */}
        <section
          aria-label="Produtos mais vendidos"
          className="bg-[#1C1C1E] rounded-[22px] p-7 lg:p-8 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-[18px] sm:text-[20px] font-bold text-[var(--apple-text,#fff)] tracking-tight">
                  Mais vendidos
                  <span className="sr-only">Produtos mais vendidos</span>
                </h3>
                <p className="text-[13px] sm:text-[14px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] mt-0.5">
                  Ranking por receita aprovada no período
                </p>
              </div>
            </div>

            {isPending ? (
              <div aria-busy="true" className="space-y-3 py-2 animate-pulse">
                <div className="h-12 bg-white/[0.03] rounded-[12px]" />
                <div className="h-12 bg-white/[0.03] rounded-[12px]" />
              </div>
            ) : topProducts.length === 0 ? (
              <div className="py-12 text-center bg-[var(--apple-surface-2,#2c2c2e)] rounded-[16px] p-6 space-y-3 my-auto">
                <div className="w-10 h-10 rounded-full bg-[var(--apple-blue,#0a84ff)]/15 text-[var(--apple-blue,#0a84ff)] flex items-center justify-center mx-auto mb-1 shrink-0">
                  <ShoppingBag className="w-5 h-5 stroke-[1.75]" />
                </div>
                <p className="text-[13px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))]">
                  Você ainda não vendeu. Veja como divulgar o seu bot
                </p>
                <Link
                  href="/seller/store"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-[var(--apple-blue,#0a84ff)] hover:opacity-90 text-white text-[13px] font-medium transition-opacity"
                >
                  <span>Divulgar meu bot</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div
                tabIndex={0}
                role="region"
                aria-label="Lista de mais vendidos"
                className="max-h-[420px] overflow-y-auto no-scrollbar focus:outline-none focus:ring-1 focus:ring-[var(--apple-blue,#0a84ff)] rounded-[12px]"
              >
                <ul role="list" className="divide-y divide-[var(--apple-separator,rgba(84,84,88,0.25))]">
                  {topProducts.map((prod, index) => {
                    const percentage = prod.percentage ?? 0;
                    return (
                      <li key={prod.id} className="py-3 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between gap-3 min-w-0">
                          {/* Miniatura ou Número do Ranking */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {prod.coverUrl ? (
                              <img
                                src={prod.coverUrl}
                                alt={prod.title}
                                className="w-9 h-9 rounded-[8px] object-cover shrink-0 border border-white/10"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-[8px] bg-[var(--apple-surface-2,#2c2c2e)] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] font-bold text-[13px] flex items-center justify-center shrink-0 tabular-nums">
                                {index + 1}
                              </div>
                            )}

                            {/* Título em Title Case */}
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] font-medium text-[var(--apple-text,#fff)] truncate leading-tight">
                                {toTitleCase(prod.title)}
                              </p>
                              <p className="text-[12px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] mt-0.5 tabular-nums">
                                {prod.salesCount} {prod.salesCount === 1 ? "unidade vendida" : "unidades vendidas"}
                              </p>
                            </div>
                          </div>

                          {/* Receita e % à direita */}
                          <div className="text-right shrink-0">
                            <p className="text-[15px] font-bold text-[var(--apple-text,#fff)] tabular-nums">
                              {formatBRL(prod.revenue)}
                            </p>
                            {percentage > 0 && (
                              <span className="text-[12px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] tabular-nums">
                                {percentage}% do total
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Barra azul fina de 4px embaixo, com largura proporcional à % */}
                        {percentage > 0 && (
                          <div className="h-[4px] w-full bg-[var(--apple-surface-2,#2c2c2e)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--apple-blue,#0a84ff)] bg-[#3984FF] rounded-full transition-all duration-500"
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

          {/* Rodapé com "Produtos vendidos no período" e o total */}
          <div className="pt-3.5 mt-3.5 border-t border-[var(--apple-separator,rgba(84,84,88,0.25))] text-[13px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] flex items-center justify-between">
            <span>Produtos vendidos no período</span>
            <span className="font-bold text-[var(--apple-text,#fff)] tabular-nums">
              {topProducts.length} {topProducts.length === 1 ? "produto" : "produtos"}
            </span>
          </div>
        </section>

        {/* =========================================================================
            SUPERFÍCIE 3: DESEMPENHO POR BOT (Exibida se houver mais de um bot)
           ========================================================================= */}
        {hasMultipleBots && (
          <section
            aria-label="Desempenho por bot"
            className="bg-[#1C1C1E] rounded-[22px] p-7 lg:p-8 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-[18px] sm:text-[20px] font-bold text-[var(--apple-text,#fff)] tracking-tight">
                    Desempenho por bot
                  </h3>
                  <p className="text-[13px] sm:text-[14px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))] mt-0.5">
                    Métricas e conversão por canal
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {channels.map((ch) => (
                  <div
                    key={ch.channel}
                    className="p-3.5 rounded-[16px] bg-[var(--apple-surface-2,#2c2c2e)] border border-[var(--apple-separator,rgba(84,84,88,0.25))] space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[14px] text-[var(--apple-text,#fff)] truncate">{ch.label}</span>
                      <span className="text-[13px] font-bold text-[var(--apple-blue,#0a84ff)] tabular-nums">
                        {formatBRL(ch.revenue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[12px] text-[var(--apple-text-secondary,rgba(235,235,245,0.6))]">
                      <span>{ch.salesCount} vendas</span>
                      {ch.username && (
                        <span>@{ch.username.replace(/^@/, "")}</span>
                      )}
                      <span>{ch.uniqueStarts || 0} conversas</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
