"use client";

import React from "react";
import Link from "next/link";
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  UserPlus, 
  ArrowRight,
  Bot
} from "lucide-react";
import { ActivityLogItem } from "@/lib/analytics/analytics-service";
import { DashboardEmptyState } from "./DashboardEmptyState";

interface SellerRealtimeActivityProps {
  activityLog?: ActivityLogItem[];
  isPending?: boolean;
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

function getActivityBadge(type: string) {
  switch (type) {
    case "sale_approved":
      return {
        label: "Venda aprovada",
        icon: CheckCircle2,
        iconClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        pillClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      };
    case "payment_pending":
      return {
        label: "Aguardando Pix",
        icon: Clock,
        iconClass: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        pillClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      };
    case "lead":
    default:
      return {
        label: "Novo lead",
        icon: UserPlus,
        iconClass: "text-[#3984FF] bg-blue-500/10 border-blue-500/20",
        pillClass: "bg-blue-500/10 text-[#3984FF] border-blue-500/20",
      };
  }
}

export function SellerRealtimeActivity({
  activityLog = [],
  isPending = false,
}: SellerRealtimeActivityProps) {
  const hasLogs = activityLog.length > 0;

  if (isPending) {
    return (
      <div className="rounded-2xl bg-[var(--seller-surface,#101218)] border border-white/[0.06] p-5 sm:p-6 min-h-[300px] animate-pulse flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-white/[0.04] rounded w-36" />
          <div className="h-5 bg-white/[0.04] rounded-full w-20" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-white/[0.02] rounded-xl w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Atividades em tempo real"
      className="relative overflow-hidden rounded-2xl bg-[var(--seller-surface,#101218)] border border-white/[0.06] p-5 sm:p-6 shadow-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-500/25 before:to-transparent"
    >
      {/* Topo do Card */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#3984FF]" />
            <span>Atividades em tempo real</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Acontecimentos, vendas e conversas recentes
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] font-semibold text-[#3984FF] shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3984FF] animate-pulse motion-reduce:animate-none" />
          <span>Ao vivo</span>
        </div>
      </div>

      {!hasLogs ? (
        <DashboardEmptyState
          icon={Activity}
          title="Nenhuma atividade registrada"
          description="Quando visitantes interagirem com seus bots ou realizarem compras, o fluxo ao vivo aparecerá aqui."
          actionText="Ver bots ativos"
          actionHref="/seller/store"
        />
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label="Feed de atividades recentes"
          className="max-h-[380px] overflow-y-auto no-scrollbar pr-0.5 focus:outline-none focus:ring-1 focus:ring-[#3984FF]/30 rounded-xl"
        >
          <ul role="list" className="space-y-2 pb-2">
            {activityLog.map((event) => {
              const badge = getActivityBadge(event.type);
              const EventIcon = badge.icon;
              const relativeTime = formatRelativeTime(event.timestamp);

              return (
                <li
                  key={event.id}
                  className="p-3 sm:p-3.5 rounded-xl bg-[var(--seller-surface-raised,#151821)] border border-white/[0.04] hover:border-white/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Ícone com Chip Circular */}
                    <div
                      className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 shadow-xs ${badge.iconClass}`}
                    >
                      <EventIcon className="w-4 h-4 stroke-[2]" />
                    </div>

                    {/* Detalhes do Evento */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-zinc-100 truncate">
                          {event.targetName}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badge.pillClass}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 pt-0.5 truncate">
                        {event.description}
                      </p>
                    </div>
                  </div>

                  {/* Metadados: Bot de Origem e Horário */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-white/[0.04]">
                    {event.botName && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-400 bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.04]">
                        <Bot className="w-3 h-3 text-zinc-500" />
                        <span className="truncate max-w-[100px] sm:max-w-[140px]">
                          {event.botName}
                        </span>
                      </span>
                    )}
                    <span
                      title={`${event.dateFormatted} às ${event.timeFormatted}`}
                      className="text-[11px] text-zinc-400 font-sans tabular-nums shrink-0"
                    >
                      {relativeTime}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

