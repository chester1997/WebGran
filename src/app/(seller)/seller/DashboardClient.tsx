"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Wallet, 
  ShoppingBag, 
  Users, 
  Package, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Bot, 
  Globe, 
  Sparkles,
  RefreshCw,
  BarChart3,
  Activity,
  ArrowUpRight,
  CreditCard,
  Layers,
  Tag,
  UserPlus,
  Calendar,
  ChevronDown
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from "recharts";
import { StoreAnalyticsData } from "@/lib/analytics/analytics-service";
import { CommercialMetricsCards } from "@/components/analytics/CommercialMetricsCards";
import { BUSINESS_TIMEZONE, getBusinessParts, getBusinessDateKey } from "@/lib/analytics/timezone-utils";
import { getDashboardAnalyticsAction } from "./actions";

export interface DashboardBot {
  id: string;
  username: string;
  displayName?: string | null;
}

interface DashboardClientProps {
  initialData: StoreAnalyticsData;
  bots?: DashboardBot[];
}

function getGreetingByHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getFormattedDateString(date: Date = new Date()): string {
  try {
    const formatted = new Intl.DateTimeFormat("pt-BR", {
      timeZone: BUSINESS_TIMEZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return "Hoje";
  }
}

function CustomRechartsTooltip({ active, payload, label, chartMetric }: any) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-[#141418] border border-white/10 text-white p-3 rounded-xl shadow-2xl text-xs space-y-1.5 min-w-[150px]">
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-1.5 mb-1">
          <span className="font-semibold text-zinc-300 text-[11px]">{item.fullDate || item.dateLabel || label}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        </div>
        <div className="flex items-center justify-between text-xs gap-3">
          <span className="text-zinc-400">Faturamento:</span>
          <span className="font-bold text-emerald-400 font-mono wg-tabular">
            R$ {(item.revenue || 0).toFixed(2).replace(".", ",")}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs gap-3">
          <span className="text-zinc-400">Vendas:</span>
          <span className="font-bold text-white font-mono wg-tabular">
            {item.salesCount || 0} {(item.salesCount || 0) === 1 ? "pedido" : "pedidos"}
          </span>
        </div>
      </div>
    );
  }
  return null;
}

function ChannelAvatarItem({ chan }: { chan: { channel: string; label: string; photoUrl?: string | null } }) {
  const [hasError, setHasError] = useState(false);

  if (chan.photoUrl && !hasError) {
    return (
      <img
        src={chan.photoUrl}
        alt={chan.label || "Avatar do Bot"}
        onError={() => setHasError(true)}
        className="w-4.5 h-4.5 rounded-full object-cover shrink-0 border border-white/10"
      />
    );
  }

  if (chan.channel !== "web") {
    return (
      <div className="w-4.5 h-4.5 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
        <Bot className="w-2.5 h-2.5 text-blue-400" />
      </div>
    );
  }

  return (
    <div className="w-4.5 h-4.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
      <Globe className="w-2.5 h-2.5 text-emerald-400" />
    </div>
  );
}

export function DashboardClient({ initialData, bots = [] }: DashboardClientProps) {
  const [data, setData] = useState<StoreAnalyticsData>(initialData);
  const [period, setPeriod] = useState<string>(initialData.period || "30D");
  const [selectedBot, setSelectedBot] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(() => getBusinessDateKey(new Date()));
  const [chartMetric, setChartMetric] = useState<"revenue" | "sales">("revenue");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [hoveredPoint, setHoveredPoint] = useState<{
    dateLabel: string;
    revenue: number;
    salesCount: number;
    x: number;
    y: number;
  } | null>(null);

  const fetchAnalytics = (targetPeriod: string, targetBot: string) => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const botParam = targetBot !== "all" ? targetBot : undefined;
        const res = await getDashboardAnalyticsAction(targetPeriod, botParam);
        setData(res);
      } catch (err: any) {
        setErrorMsg(err.message || "Não foi possível carregar este indicador.");
      }
    });
  };

  const handlePeriodChange = (newPeriod: string) => {
    if (newPeriod === period && !errorMsg) return;
    setPeriod(newPeriod);
    fetchAnalytics(newPeriod, selectedBot);
  };

  const handleBotChange = (newBot: string) => {
    setSelectedBot(newBot);
    fetchAnalytics(period, newBot);
  };

  const handleDateChange = (dateStr: string) => {
    setSelectedDate(dateStr);
    const todayKey = getBusinessDateKey(new Date());
    if (dateStr === todayKey) {
      handlePeriodChange("TODAY");
    }
  };

  const currentParts = getBusinessParts(new Date());
  const greeting = getGreetingByHour(currentParts.hour);
  const formattedDate = getFormattedDateString(new Date());
  const displayName = data.userName || data.storeName || "STUDIO ADM";

  const availableBots = (bots && bots.length > 0)
    ? bots
    : (data.channels || [])
        .filter((c) => c.channel !== "web")
        .map((c) => ({
          id: c.channel,
          username: c.username || c.label.replace(/^@/, ""),
          displayName: c.label,
        }));

  const periodsList = [
    { key: "TODAY", label: "Hoje" },
    { key: "7D", label: "7D" },
    { key: "30D", label: "30D" },
    { key: "90D", label: "90D" },
    { key: "12M", label: "12M" },
    { key: "ALL", label: "Tudo" },
  ];

  return (
    <div className="space-y-6 fade-in w-full max-w-full overflow-hidden min-w-0 pb-20">
      
      {/* 1. Header & Period Selector (WebGran Executive Header) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0E0E11] border border-white/[0.06] rounded-2xl p-4 sm:p-5 lg:px-6 lg:py-5 shadow-sm">
        {/* Lado Esquerdo: Saudação Principal e Data Atual */}
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl lg:text-[26px] font-bold text-white tracking-tight truncate">
              {greeting}, {displayName}
            </h1>
            {isPending && (
              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 font-mono shrink-0">
                <RefreshCw className="w-3 h-3 animate-spin text-rose-500" />
                <span className="hidden sm:inline">Atualizando...</span>
              </span>
            )}
          </div>
          <p className="text-zinc-400 text-xs sm:text-sm font-normal">
            {formattedDate}
          </p>
        </div>

        {/* Lado Direito: Filtros em uma linha (Bot, Data, Período) */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 max-w-full">
          {/* Seletor de Bot */}
          <div className="relative flex items-center">
            <Bot className="absolute left-2.5 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            <select
              value={selectedBot}
              onChange={(e) => handleBotChange(e.target.value)}
              className="bg-[#141418] hover:bg-white/[0.04] text-zinc-300 hover:text-white border border-white/10 rounded-xl pl-8 pr-7 py-1.5 text-xs font-medium focus:outline-none focus:border-rose-500/50 transition-all appearance-none cursor-pointer h-9 shadow-sm"
              aria-label="Selecionar Bot"
            >
              <option value="all" className="bg-[#141418] text-white">Todos os bots</option>
              {availableBots.map((b) => (
                <option key={b.id} value={b.id} className="bg-[#141418] text-white">
                  {b.displayName || (b.username ? `@${b.username}` : `Bot ${b.id.slice(0, 6)}`)}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          </div>

          {/* Seletor de Data */}
          <div className="relative flex items-center">
            <Calendar className="absolute left-2.5 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-[#141418] hover:bg-white/[0.04] text-zinc-300 hover:text-white border border-white/10 rounded-xl pl-8 pr-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-rose-500/50 transition-all cursor-pointer h-9 shadow-sm [color-scheme:dark]"
              aria-label="Selecionar Data"
            />
          </div>

          {/* Seletor de Período (Segmented Control) */}
          <div className="bg-[#141418] p-1 rounded-xl border border-white/[0.06] flex items-center gap-0.5 overflow-x-auto scrollbar-hide shrink-0 h-9 shadow-sm">
            {periodsList.map((p) => {
              const isActive = period === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handlePeriodChange(p.key)}
                  disabled={isPending}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-rose-600 text-white shadow-sm font-semibold"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-between gap-3 shadow-md w-full max-w-full">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => handlePeriodChange(period)}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs"
          >
            <RefreshCw className="w-3 h-3 animate-spin-reverse" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* 2. Commercial Metrics Cards (Reference Grid) */}
      <CommercialMetricsCards 
        metrics={data.commercialMetrics} 
        isPending={isPending} 
      />

      {/* 3. Atividades, Mais Vendidos e Vendas por Canal (3 Cols Lado a Lado) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* 1. Log de Atividades (Esquerda) */}
        <div className="bg-[#0E0E11] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between min-h-[380px]">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-rose-500 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Log de Atividades</h3>
                  <p className="text-xs text-zinc-400">Acompanhe os acontecimentos da loja</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium text-emerald-400 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Tempo real</span>
              </div>
            </div>

            {isPending ? (
              <div className="space-y-2 py-2">
                <div className="h-14 bg-white/5 rounded-xl animate-pulse" />
                <div className="h-14 bg-white/5 rounded-xl animate-pulse" />
                <div className="h-14 bg-white/5 rounded-xl animate-pulse" />
              </div>
            ) : (!data.activityLog || data.activityLog.length === 0) ? (
              <div className="py-10 text-center bg-[#141418]/50 rounded-xl border border-white/[0.04] space-y-2">
                <Activity className="w-7 h-7 text-zinc-600 mx-auto opacity-50" />
                <p className="text-zinc-400 text-xs font-semibold">Nenhuma atividade recente registrada.</p>
                <p className="text-zinc-500 text-[11px] max-w-xs mx-auto">
                  Novos leads, pagamentos pendentes e vendas aprovadas aparecerão aqui automaticamente.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                {data.activityLog.map((event) => {
                  const isLead = event.type === "lead";
                  const isSale = event.type === "sale_approved";
                  const isPendingPay = event.type === "payment_pending";

                  const iconContainerClass = isSale
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : isPendingPay
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-sky-500/10 text-sky-400 border-sky-500/20";

                  return (
                    <div
                      key={event.id}
                      className="p-3 rounded-xl bg-[#141418] border border-white/[0.05] hover:border-white/[0.1] transition-all flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${iconContainerClass}`}
                        >
                          {isSale ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : isPendingPay ? (
                            <Clock className="w-4 h-4" />
                          ) : (
                            <UserPlus className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white tracking-tight">
                            {event.title}
                          </p>
                          <p className="text-[11px] text-zinc-400 font-medium truncate">
                            <span className="text-zinc-200 font-medium">{event.targetName}</span>
                            <span className="mx-1 text-zinc-600">—</span>
                            <span className={isSale ? "text-emerald-400 font-semibold" : isPendingPay ? "text-amber-400 font-medium" : "text-zinc-400"}>
                              {event.description}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center text-[10px] font-mono font-medium text-zinc-400 bg-white/[0.03] px-2 py-0.5 rounded-md border border-white/[0.05] wg-tabular">
                          {event.dateFormatted} • {event.timeFormatted}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/[0.06] text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Histórico de acontecimentos:</span>
            <span className="font-bold text-white wg-tabular">
              {data.activityLog?.length || 0} {(data.activityLog?.length || 0) === 1 ? "registro" : "registros"}
            </span>
          </div>
        </div>

        {/* 2. Mais Vendidos (Meio) */}
        <div className="bg-[#0E0E11] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between min-h-[380px]">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Mais Vendidos</h3>
                <p className="text-xs text-zinc-400">Ranking por receita no período</p>
              </div>
            </div>

            {isPending ? (
              <div className="space-y-3 py-3">
                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
                <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
              </div>
            ) : data.topProducts.length === 0 ? (
              <div className="py-10 text-center bg-[#141418]/50 rounded-xl border border-white/[0.04] space-y-2">
                <ShoppingBag className="w-7 h-7 text-zinc-600 mx-auto opacity-50" />
                <p className="text-zinc-400 text-xs font-semibold">Nenhum produto vendido ainda neste período.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                {data.topProducts.map((prod, idx) => (
                  <div
                    key={prod.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#141418] border border-white/[0.05] hover:border-white/10 transition-all duration-150 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Rank Badge */}
                      {idx === 0 ? (
                        <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold flex items-center justify-center shrink-0">1</div>
                      ) : idx === 1 ? (
                        <div className="w-6 h-6 rounded-lg bg-zinc-300/15 border border-zinc-300/30 text-zinc-200 text-xs font-mono font-bold flex items-center justify-center shrink-0">2</div>
                      ) : idx === 2 ? (
                        <div className="w-6 h-6 rounded-lg bg-amber-700/15 border border-amber-700/30 text-amber-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">3</div>
                      ) : (
                        <div className="w-6 h-6 rounded-lg bg-white/[0.03] border border-white/[0.08] text-zinc-400 text-xs font-mono font-medium flex items-center justify-center shrink-0">{idx + 1}</div>
                      )}

                      {/* Product Cover */}
                      <div className="w-9 h-9 rounded-xl overflow-hidden bg-zinc-900 border border-white/10 shrink-0 flex items-center justify-center text-zinc-500">
                        {prod.coverUrl ? (
                          <img
                            src={prod.coverUrl}
                            alt={prod.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-4 h-4 text-zinc-600" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate group-hover:text-rose-400 transition-colors">{prod.title}</p>
                        <p className="text-[11px] text-zinc-400 font-medium">
                          {prod.salesCount} {prod.salesCount === 1 ? "unidade" : "unidades"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      <p className="text-xs font-bold text-emerald-400 font-mono wg-tabular">
                        R$ {prod.revenue.toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/[0.06] text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Ranking de produtos:</span>
            <span className="font-bold text-white wg-tabular">
              {data.topProducts?.length || 0} {(data.topProducts?.length || 0) === 1 ? "produto" : "produtos"}
            </span>
          </div>
        </div>

        {/* 3. Vendas por Canal (Direita) */}
        <div className="bg-[#0E0E11] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between min-h-[380px]">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <Bot className="w-5 h-5 text-rose-500 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Vendas por Canal</h3>
                <p className="text-xs text-zinc-400">Origem dos pedidos efetuados</p>
              </div>
            </div>

            {isPending ? (
              <div className="space-y-3 py-3">
                <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
                <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
              </div>
            ) : data.channels.length === 0 ? (
              <p className="text-zinc-500 text-xs py-10 text-center">Nenhum canal ativo registrado.</p>
            ) : (
              <div className="space-y-4 py-1 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                {data.channels.map((chan) => (
                  <div key={chan.channel} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-white flex items-center gap-2 min-w-0">
                        <ChannelAvatarItem chan={chan} />
                        <span className="truncate">{chan.label}</span>
                      </span>
                      <span className="font-mono font-bold text-zinc-300 shrink-0 ml-2 wg-tabular">{chan.percentage}%</span>
                    </div>

                    {/* Progress Bar in WebGran Red / Rose */}
                    <div className="h-2 bg-[#141418] rounded-full overflow-hidden border border-white/[0.04]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          chan.channel === "web" 
                            ? "bg-emerald-500" 
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${Math.max(chan.percentage, 5)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
                      <span>{chan.salesCount} {chan.salesCount === 1 ? "venda" : "vendas"}</span>
                      <span className="font-bold text-white wg-tabular">R$ {chan.revenue.toFixed(2).replace(".", ",")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/[0.06] text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Canal principal:</span>
            <span className="font-bold text-white uppercase tracking-wider">
              {data.channels[0]?.label || "Nenhum"}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}

// Sub-components: Trend Badge & Skeleton KPI
function TrendBadge({
  percent,
  trend,
}: {
  percent: number | null;
  trend: "up" | "down" | "neutral" | "none";
}) {
  if (percent === null || trend === "none") {
    return (
      <span className="text-[10px] text-zinc-500 font-medium">
        Sem comparativo
      </span>
    );
  }

  if (trend === "up") {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1 wg-tabular">
        <TrendingUp className="w-3 h-3" />
        ↑ {percent}%
      </span>
    );
  }

  if (trend === "down") {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 inline-flex items-center gap-1 wg-tabular">
        <TrendingDown className="w-3 h-3" />
        ↓ {percent}%
      </span>
    );
  }

  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800/80 text-zinc-400 border border-white/10 inline-flex items-center gap-1 wg-tabular">
      <Minus className="w-3 h-3" />
      — 0%
    </span>
  );
}

function SkeletonKpi() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-3 bg-white/10 rounded w-20" />
        <div className="w-8 h-8 bg-white/10 rounded-lg" />
      </div>
      <div className="h-7 bg-white/10 rounded-lg w-28" />
      <div className="h-3 bg-white/10 rounded w-20" />
    </div>
  );
}
