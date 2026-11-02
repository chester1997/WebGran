"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Bot, ArrowRight, TrendingUp } from "lucide-react";
import { ChannelItem } from "@/lib/analytics/analytics-service";
import { DashboardEmptyState } from "./DashboardEmptyState";

interface SellerTopBotsCardProps {
  channels?: ChannelItem[];
  isPending?: boolean;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function BotAvatarItem({ chan }: { chan: ChannelItem }) {
  const [hasError, setHasError] = useState(false);

  if (chan.photoUrl && !hasError) {
    return (
      <img
        src={chan.photoUrl}
        alt={chan.label}
        onError={() => setHasError(true)}
        className="w-9 h-9 rounded-full object-cover shrink-0 border border-white/10 bg-slate-900"
      />
    );
  }

  return (
    <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#3984FF] flex items-center justify-center shrink-0">
      <Bot className="w-4 h-4" />
    </div>
  );
}

export function SellerTopBotsCard({
  channels = [],
  isPending = false,
}: SellerTopBotsCardProps) {
  // Filtra apenas bots reais do Telegram
  const botChannels = channels.filter((c) => c.channel !== "web");
  const hasBots = botChannels.length > 0;

  if (isPending) {
    return (
      <div className="rounded-2xl bg-[var(--seller-surface,#101218)] border border-white/[0.06] p-5 sm:p-6 min-h-[340px] animate-pulse flex flex-col justify-between">
        <div className="space-y-2">
          <div className="h-4 bg-white/[0.04] rounded w-28" />
          <div className="h-3 bg-white/[0.03] rounded w-20" />
        </div>
        <div className="space-y-3 my-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-white/[0.02] rounded-xl w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Canais e bots de venda"
      className="group relative overflow-hidden rounded-2xl bg-[var(--seller-surface,#101218)] border border-white/[0.06] p-5 sm:p-6 shadow-none flex flex-col justify-between before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-500/25 before:to-transparent hover:-translate-y-0.5 hover:border-white/10 hover:shadow-xl transition-all duration-200 min-h-[340px]"
    >
      {/* Topo do Card */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <Bot className="w-4 h-4 text-[#3984FF]" />
            <span>Top bots</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">Canais de venda Telegram</p>
        </div>

        <Link
          href="/seller/store"
          className="text-xs font-medium text-[#3984FF] hover:text-[#60A5FA] flex items-center gap-1 transition-colors"
        >
          <span>Conexões</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {!hasBots ? (
        <DashboardEmptyState
          icon={Bot}
          title="Nenhum bot conectado"
          description="Conecte seu bot do Telegram para vender seus infoprodutos diretamente pelo chat."
          actionText="Conectar bot"
          actionHref="/seller/store"
          className="my-auto"
        />
      ) : (
        <div className="space-y-2.5 my-auto">
          {botChannels.slice(0, 5).map((bot, idx) => (
            <div
              key={bot.channel || idx}
              className="p-3 rounded-xl bg-[var(--seller-surface-raised,#151821)] border border-white/[0.04] hover:border-white/10 transition-colors flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-xs font-bold text-zinc-500 w-4 text-center shrink-0 tabular-nums">
                  #{idx + 1}
                </span>

                <BotAvatarItem chan={bot} />

                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-semibold text-zinc-100 truncate">
                    {bot.label}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 pt-0.5">
                    <span className="tabular-nums font-medium">
                      {bot.salesCount} {bot.salesCount === 1 ? "venda" : "vendas"}
                    </span>
                    {bot.conversionRate !== null && bot.conversionRate !== undefined && (
                      <span className="inline-flex items-center gap-0.5 text-emerald-400 font-semibold text-[10px]">
                        <TrendingUp className="w-2.5 h-2.5" />
                        {bot.conversionRate}% conv.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Receita Gerada no Bot */}
              <div className="text-right shrink-0">
                <span className="text-xs font-bold text-white tabular-nums block">
                  {formatBRL(bot.revenue)}
                </span>
                {bot.percentage > 0 && (
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {bot.percentage}% do total
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

