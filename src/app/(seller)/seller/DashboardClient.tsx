"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ShoppingBag, 
  Package, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Bot, 
  Globe, 
  Sparkles,
  RefreshCw,
  Activity,
  CreditCard,
  UserPlus,
  Calendar,
  ChevronDown,
  Check,
  X,
  SlidersHorizontal,
  ArrowRight,
  Flame,
  BarChart2
} from "lucide-react";
import { StoreAnalyticsData } from "@/lib/analytics/analytics-service";
import { CommercialMetricsCards } from "@/components/analytics/CommercialMetricsCards";
import { 
  BUSINESS_TIMEZONE, 
  getBusinessParts, 
  getBusinessDateKey, 
  formatCivilDateToBR 
} from "@/lib/analytics/timezone-utils";
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

interface PeriodOption {
  key: string;
  label: string;
  badge?: string;
}

const PRESET_PERIODS: PeriodOption[] = [
  { key: "TODAY", label: "Hoje", badge: "24h" },
  { key: "7D", label: "Últimos 7 dias", badge: "7D" },
  { key: "30D", label: "Últimos 30 dias", badge: "30D" },
  { key: "90D", label: "Últimos 90 dias", badge: "90D" },
  { key: "THIS_MONTH", label: "Este mês", badge: "Mês" },
  { key: "LAST_MONTH", label: "Mês anterior", badge: "M-1" },
  { key: "12M", label: "Últimos 12 meses", badge: "12M" },
  { key: "THIS_YEAR", label: "Este ano", badge: "Ano" },
  { key: "ALL", label: "Todo o período", badge: "Tudo" },
];

function getPeriodDisplayLabel(periodKey: string): string {
  const preset = PRESET_PERIODS.find((p) => p.key === periodKey);
  if (preset) return preset.label;

  if (periodKey.startsWith("CUSTOM:")) {
    const parts = periodKey.split(":");
    const startStr = parts[1] || "";
    const endStr = parts[2] || "";
    if (startStr && endStr) {
      return `${formatCivilDateToBR(startStr)} — ${formatCivilDateToBR(endStr)}`;
    }
    return "Personalizado";
  }

  return "Últimos 30 dias";
}

function ChannelAvatarItem({ chan }: { chan: { channel: string; label: string; photoUrl?: string | null } }) {
  const [hasError, setHasError] = useState(false);

  if (chan.photoUrl && !hasError) {
    return (
      <img
        src={chan.photoUrl}
        alt={chan.label || "Avatar do Bot"}
        onError={() => setHasError(true)}
        className="w-6 h-6 rounded-full object-cover shrink-0 border border-slate-700/80 bg-slate-900"
      />
    );
  }

  if (chan.channel !== "web") {
    return (
      <div className="w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
        <Bot className="w-3.5 h-3.5 text-blue-400" />
      </div>
    );
  }

  return (
    <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
      <Globe className="w-3.5 h-3.5 text-emerald-400" />
    </div>
  );
}

export function DashboardClient({ initialData, bots = [] }: DashboardClientProps) {
  const [data, setData] = useState<StoreAnalyticsData>(initialData);
  const [period, setPeriod] = useState<string>(initialData.period || "30D");
  const [selectedBot, setSelectedBot] = useState<string>("all");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Period Popover State
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return getBusinessDateKey(d);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => getBusinessDateKey(new Date()));
  const [customError, setCustomError] = useState<string | null>(null);
  const periodPopoverRef = useRef<HTMLDivElement>(null);

  // Click outside to close period popover
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (periodPopoverRef.current && !periodPopoverRef.current.contains(e.target as Node)) {
        setIsPeriodOpen(false);
      }
    }
    if (isPeriodOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPeriodOpen]);

  // Close on ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsPeriodOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const fetchAnalytics = (targetPeriod: string, targetBot: string) => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const botParam = targetBot !== "all" ? targetBot : undefined;
        const res = await getDashboardAnalyticsAction(targetPeriod, botParam);
        setData(res);
      } catch (err: any) {
        setErrorMsg(err.message || "Não foi possível carregar os dados deste período.");
      }
    });
  };

  const handlePeriodChange = (newPeriod: string) => {
    setIsPeriodOpen(false);
    if (newPeriod === period && !errorMsg) return;
    setPeriod(newPeriod);
    fetchAnalytics(newPeriod, selectedBot);
  };

  const handleApplyCustomPeriod = () => {
    setCustomError(null);
    if (!customStart || !customEnd) {
      setCustomError("Preencha data inicial e final.");
      return;
    }
    if (customStart > customEnd) {
      setCustomError("Data inicial não pode ser posterior à final.");
      return;
    }
    const customKey = `CUSTOM:${customStart}:${customEnd}`;
    handlePeriodChange(customKey);
  };

  const handleBotChange = (newBot: string) => {
    setSelectedBot(newBot);
    fetchAnalytics(period, newBot);
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

  const activePeriodLabel = getPeriodDisplayLabel(period);

  return (
    <div className="space-y-6 fade-in w-full max-w-full overflow-hidden min-w-0 pb-20">
      
      {/* 1. Executive Neutral Dark Header & Unified Filters */}
      <div className="relative bg-[#0F1014] border border-white/[0.08] rounded-2xl p-4 sm:p-5 lg:px-6 lg:py-4.5 shadow-xs overflow-visible">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Lado Esquerdo: Saudação Principal e Data Atual */}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#F3F4F6] truncate">
                <span className="text-zinc-400 font-normal">{greeting}, </span>
                <span>{displayName}</span>
              </h1>
              {isPending && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-blue-400 font-mono shrink-0 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                  <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                  <span className="hidden sm:inline">Atualizando...</span>
                </span>
              )}
            </div>
            <p className="text-[#9CA3AF] text-xs font-normal flex items-center gap-1.5 mt-0.5">
              <span>{formattedDate}</span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-500 text-[11px] font-mono">Fuso América/Recife</span>
            </p>
          </div>

          {/* Lado Direito: Controles Unificados (Bot + Período Único) */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 shrink-0 max-w-full">
            
            {/* Seletor de Bot Integrado */}
            <div className="relative flex items-center min-w-[150px] sm:min-w-[170px] max-w-full">
              <Bot className="absolute left-2.5 w-4 h-4 text-zinc-400 pointer-events-none" />
              <select
                value={selectedBot}
                onChange={(e) => handleBotChange(e.target.value)}
                className="w-full bg-[#15171D] hover:bg-[#1C1E26] text-zinc-200 hover:text-white border border-white/[0.08] hover:border-zinc-700 rounded-xl pl-8 pr-8 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer h-9 shadow-xs"
                aria-label="Selecionar Bot"
              >
                <option value="all" className="bg-[#0F1014] text-white">Todos os bots</option>
                {availableBots.map((b) => (
                  <option key={b.id} value={b.id} className="bg-[#0F1014] text-white">
                    {b.displayName || (b.username ? `@${b.username}` : `Bot ${b.id.slice(0, 6)}`)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            </div>

            {/* SELETOR DE PERÍODO ÚNICO COM POPOVER (Presets + Personalizado) */}
            <div className="relative flex-1 sm:flex-initial" ref={periodPopoverRef}>
              
              {/* Botão Gatilho do Seletor */}
              <button
                type="button"
                onClick={() => setIsPeriodOpen(!isPeriodOpen)}
                className={`w-full sm:w-auto inline-flex items-center justify-between gap-2 bg-[#15171D] hover:bg-[#1C1E26] text-zinc-200 hover:text-white border rounded-xl px-3 py-1.5 text-xs font-medium transition-all cursor-pointer h-9 shadow-xs ${
                  isPeriodOpen 
                    ? "border-blue-500/80 ring-1 ring-blue-500/30 text-white" 
                    : "border-white/[0.08] hover:border-zinc-700"
                }`}
                aria-haspopup="dialog"
                aria-expanded={isPeriodOpen}
              >
                <div className="flex items-center gap-2 truncate">
                  <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="font-semibold text-[#F3F4F6] truncate max-w-[160px] sm:max-w-[200px]">
                    {activePeriodLabel}
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform shrink-0 ${isPeriodOpen ? "rotate-180 text-blue-400" : ""}`} />
              </button>

              {/* Backdrop para telas pequenas */}
              {isPeriodOpen && (
                <div 
                  className="fixed inset-0 bg-black/60 backdrop-blur-xs sm:hidden z-40" 
                  onClick={() => setIsPeriodOpen(false)}
                />
              )}

              {/* Painel Popover do Seletor */}
              {isPeriodOpen && (
                <div className="fixed inset-x-4 top-24 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 z-50 w-auto sm:w-[360px] bg-[#0F1014] border border-white/[0.08] rounded-2xl shadow-2xl p-4 sm:p-5 space-y-4 animate-in fade-in-0 zoom-in-95">
                  
                  {/* Topo do Popover */}
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
                    <div className="flex items-center gap-1.5 text-[#F3F4F6] font-semibold text-xs">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" />
                      <span>Selecione o período de análise</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPeriodOpen(false)}
                      className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-[#15171D] transition-colors"
                      aria-label="Fechar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Grid de Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">
                      Intervalos Rápidos
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {PRESET_PERIODS.map((p) => {
                        const isSelected = period === p.key;
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => handlePeriodChange(p.key)}
                            disabled={isPending}
                            className={`px-2 py-2 rounded-xl text-xs font-medium transition-all text-left flex flex-col justify-between h-[52px] border ${
                              isSelected
                                ? "bg-[#181A20] text-white border-blue-500/80 shadow-xs font-semibold ring-1 ring-blue-500/20"
                                : "bg-[#15171D] text-zinc-300 hover:text-white hover:bg-[#1C1E26] border-white/[0.08]"
                            }`}
                          >
                            <span className="truncate leading-tight text-[11px]">{p.label}</span>
                            <div className="flex items-center justify-between w-full pt-1">
                              <span className={`text-[9px] font-mono px-1 rounded ${isSelected ? 'bg-blue-500/20 text-blue-300' : 'bg-[#0F1014] text-zinc-400'}`}>
                                {p.badge}
                              </span>
                              {isSelected && <Check className="w-3 h-3 text-blue-400 shrink-0" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Seção Personalizada */}
                  <div className="pt-2 border-t border-white/[0.08] space-y-2.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">
                      Intervalo Personalizado
                    </span>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-400 block font-medium">Data Inicial</label>
                        <input
                          type="date"
                          value={customStart}
                          max={getBusinessDateKey(new Date())}
                          onChange={(e) => {
                            setCustomStart(e.target.value);
                            setCustomError(null);
                          }}
                          className="w-full bg-[#15171D] border border-white/[0.08] hover:border-zinc-700 focus:border-blue-500 text-zinc-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none transition-all [color-scheme:dark]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-400 block font-medium">Data Final</label>
                        <input
                          type="date"
                          value={customEnd}
                          max={getBusinessDateKey(new Date())}
                          onChange={(e) => {
                            setCustomEnd(e.target.value);
                            setCustomError(null);
                          }}
                          className="w-full bg-[#15171D] border border-white/[0.08] hover:border-zinc-700 focus:border-blue-500 text-zinc-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none transition-all [color-scheme:dark]"
                        />
                      </div>
                    </div>

                    {customError && (
                      <p className="text-[11px] text-rose-400 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        {customError}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={handleApplyCustomPeriod}
                      disabled={isPending}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl py-2 text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                    >
                      <span>Aplicar intervalo de datas</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              )}
            </div>

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
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs cursor-pointer"
          >
            <RefreshCw className="w-3 h-3 animate-spin-reverse" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* 2. Commercial Metrics Cards (Reference Grid: 4 Cards 2x2 + Seu Desempenho) */}
      <CommercialMetricsCards 
        metrics={data.commercialMetrics} 
        isPending={isPending} 
      />

      {/* 3. Atividades, Mais Vendidos e Desempenho por Bot (3 Cols Lado a Lado) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* 1. Log de Atividades (Esquerda) */}
        <div className="bg-[#0F1014] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between min-h-[380px]">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-blue-500 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-[#F3F4F6] tracking-tight">Log de Atividades</h3>
                  <p className="text-xs text-[#9CA3AF]">Acontecimentos operacionais em tempo real</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium text-emerald-400 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Tempo real</span>
              </div>
            </div>

            {isPending ? (
              <div className="space-y-2 py-2">
                <div className="h-14 bg-[#15171D] rounded-xl animate-pulse" />
                <div className="h-14 bg-[#15171D] rounded-xl animate-pulse" />
                <div className="h-14 bg-[#15171D] rounded-xl animate-pulse" />
              </div>
            ) : (!data.activityLog || data.activityLog.length === 0) ? (
              <div className="py-10 text-center bg-[#15171D]/50 rounded-xl border border-white/[0.08] space-y-2">
                <Activity className="w-7 h-7 text-zinc-600 mx-auto opacity-50" />
                <p className="text-zinc-300 text-xs font-semibold">Nenhuma atividade recente registrada.</p>
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
                    : "bg-blue-500/10 text-blue-400 border-blue-500/20";

                  return (
                    <div
                      key={event.id}
                      className="p-3 rounded-xl bg-[#15171D] border border-white/[0.08] hover:border-zinc-700 transition-all flex items-center justify-between gap-2.5"
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-bold text-[#F3F4F6] tracking-tight">
                              {event.title}
                            </p>
                            {event.botName && (
                              <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 rounded shrink-0">
                                {event.botName}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#9CA3AF] font-medium truncate">
                            <span className="text-zinc-200 font-medium">{event.targetName}</span>
                            <span className="mx-1 text-zinc-600">—</span>
                            <span className={isSale ? "text-emerald-400 font-semibold" : isPendingPay ? "text-amber-400 font-medium" : "text-zinc-400"}>
                              {event.description}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center text-[10px] font-mono font-medium text-zinc-400 bg-[#0F1014] px-2 py-0.5 rounded-md border border-white/[0.08] wg-tabular">
                          {event.dateFormatted} • {event.timeFormatted}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/[0.08] text-[11px] text-[#9CA3AF] flex items-center justify-between">
            <span>Histórico operacional:</span>
            <span className="font-bold text-[#F3F4F6] wg-tabular">
              {data.activityLog?.length || 0} {(data.activityLog?.length || 0) === 1 ? "registro" : "registros"}
            </span>
          </div>
        </div>

        {/* 2. Mais Vendidos (Meio) */}
        <div className="bg-[#0F1014] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between min-h-[380px]">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-[#F3F4F6] tracking-tight">Mais Vendidos</h3>
                <p className="text-xs text-[#9CA3AF]">Ranking por receita aprovada no período</p>
              </div>
            </div>

            {isPending ? (
              <div className="space-y-3 py-3">
                <div className="h-12 bg-[#15171D] rounded-xl animate-pulse" />
                <div className="h-12 bg-[#15171D] rounded-xl animate-pulse" />
              </div>
            ) : data.topProducts.length === 0 ? (
              <div className="py-10 text-center bg-[#15171D]/50 rounded-xl border border-white/[0.08] space-y-2">
                <ShoppingBag className="w-7 h-7 text-zinc-600 mx-auto opacity-50" />
                <p className="text-zinc-300 text-xs font-semibold">Nenhum produto vendido ainda neste período.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                {data.topProducts.map((prod, idx) => (
                  <div
                    key={prod.id}
                    className="p-3 rounded-xl bg-[#15171D] border border-white/[0.08] hover:border-zinc-700 transition-all duration-150 group space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2.5 min-w-0">
                      
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Rank Badge */}
                        {idx === 0 ? (
                          <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono font-bold flex items-center justify-center shrink-0">1</div>
                        ) : idx === 1 ? (
                          <div className="w-6 h-6 rounded-lg bg-zinc-300/10 border border-zinc-300/20 text-zinc-200 text-xs font-mono font-bold flex items-center justify-center shrink-0">2</div>
                        ) : idx === 2 ? (
                          <div className="w-6 h-6 rounded-lg bg-amber-700/10 border border-amber-700/20 text-amber-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">3</div>
                        ) : (
                          <div className="w-6 h-6 rounded-lg bg-[#0F1014] border border-white/[0.08] text-zinc-400 text-xs font-mono font-medium flex items-center justify-center shrink-0">{idx + 1}</div>
                        )}

                        {/* Product Cover */}
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#0F1014] border border-white/[0.08] shrink-0 flex items-center justify-center text-zinc-500">
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
                          <p className="text-xs font-bold text-[#F3F4F6] truncate group-hover:text-blue-400 transition-colors">{prod.title}</p>
                          <p className="text-[11px] text-[#9CA3AF] font-medium">
                            {prod.salesCount} {prod.salesCount === 1 ? "unidade vendida" : "unidades vendidas"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-emerald-400 font-mono wg-tabular">
                          R$ {prod.revenue.toFixed(2).replace(".", ",")}
                        </p>
                        {prod.percentage !== undefined && prod.percentage > 0 && (
                          <span className="text-[10px] font-mono text-[#9CA3AF]">
                            {prod.percentage}% do total
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Subtle Share Progress Bar */}
                    {prod.percentage !== undefined && prod.percentage > 0 && (
                      <div className="h-1 bg-[#1A1C24] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500/80 rounded-full"
                          style={{ width: `${Math.min(prod.percentage, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/[0.08] text-[11px] text-[#9CA3AF] flex items-center justify-between">
            <span>Ranking de produtos:</span>
            <span className="font-bold text-[#F3F4F6] wg-tabular">
              {data.topProducts?.length || 0} {(data.topProducts?.length || 0) === 1 ? "produto" : "produtos"}
            </span>
          </div>
        </div>

        {/* 3. Desempenho por Bot (Direita) */}
        <div className="bg-[#0F1014] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between min-h-[380px]">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <Bot className="w-5 h-5 text-blue-500 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-[#F3F4F6] tracking-tight">Desempenho por Bot</h3>
                  <p className="text-xs text-[#9CA3AF]">Métricas operacionais e conversão por canal</p>
                </div>
              </div>

              <div className="px-2 py-0.5 rounded-full bg-[#15171D] border border-white/[0.08] text-[10px] font-mono text-zinc-300 font-medium">
                {data.channels.length} {data.channels.length === 1 ? "canal" : "canais"}
              </div>
            </div>

            {isPending ? (
              <div className="space-y-3 py-3">
                <div className="h-14 bg-[#15171D] rounded-xl animate-pulse" />
                <div className="h-14 bg-[#15171D] rounded-xl animate-pulse" />
              </div>
            ) : data.channels.length === 0 ? (
              <div className="py-10 text-center bg-[#15171D]/50 rounded-xl border border-white/[0.08] space-y-2">
                <Bot className="w-7 h-7 text-zinc-600 mx-auto opacity-50" />
                <p className="text-zinc-300 text-xs font-semibold">Nenhum canal ativo registrado.</p>
                <p className="text-zinc-500 text-[11px] max-w-xs mx-auto">
                  Vincule bots do Telegram em Configurações &gt; Loja.
                </p>
              </div>
            ) : (
              <div className="space-y-3 py-1 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                {data.channels.map((chan) => {
                  const isSelected = selectedBot === chan.channel;
                  return (
                    <div 
                      key={chan.channel} 
                      className={`p-3 rounded-xl bg-[#15171D] border transition-all space-y-2 ${
                        isSelected 
                          ? "border-blue-500/80 ring-1 ring-blue-500/20" 
                          : "border-white/[0.08] hover:border-zinc-700"
                      }`}
                    >
                      {/* Linha Superior: Avatar, Nome e Faturamento */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#F3F4F6] flex items-center gap-2 min-w-0">
                          <ChannelAvatarItem chan={chan} />
                          <span className="truncate">{chan.label}</span>
                          {chan.username && (
                            <span className="text-[10px] font-mono text-zinc-400 hidden sm:inline">
                              @{chan.username.replace(/^@/, '')}
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-bold text-emerald-400 shrink-0 ml-2 wg-tabular">
                          R$ {chan.revenue.toFixed(2).replace(".", ",")}
                        </span>
                      </div>

                      {/* Métricas Operacionais: Starts, Vendas e Taxa de Conversão */}
                      <div className="grid grid-cols-3 gap-1.5 py-0.5 text-center bg-[#0F1014] p-1.5 rounded-lg border border-white/[0.08]">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-zinc-400 block font-medium">Starts</span>
                          <span className="text-xs font-bold font-mono text-blue-400 wg-tabular">
                            {chan.uniqueStarts ?? "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-zinc-400 block font-medium">Vendas</span>
                          <span className="text-xs font-bold font-mono text-[#F3F4F6] wg-tabular">
                            {chan.salesCount}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-zinc-400 block font-medium">Conversão</span>
                          <span className="text-xs font-bold font-mono text-zinc-200 wg-tabular">
                            {chan.conversionRate !== null && chan.conversionRate !== undefined ? `${chan.conversionRate}%` : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Barra de Participação no Faturamento Total */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-zinc-400">
                          <span>Participação nas vendas</span>
                          <span className="font-mono font-semibold text-zinc-300">{chan.percentage}%</span>
                        </div>
                        <div className="h-1.5 bg-[#1A1C24] rounded-full overflow-hidden border border-white/[0.08]">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              chan.channel === "web" ? "bg-emerald-500" : "bg-blue-500"
                            }`}
                            style={{ width: `${Math.max(chan.percentage, 4)}%` }}
                          />
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/[0.08] text-[11px] text-[#9CA3AF] flex items-center justify-between">
            <span>Canal principal:</span>
            <span className="font-bold text-[#F3F4F6] uppercase tracking-wider font-mono">
              {data.channels[0]?.label || "Nenhum"}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
