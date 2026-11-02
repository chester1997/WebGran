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
import { SellerSetupChecklist, SellerSetupChecklistData } from "@/components/analytics/SellerSetupChecklist";
import { SellerKpiCards } from "@/components/analytics/SellerKpiCards";
import { SellerRevenueBarChart } from "@/components/analytics/SellerRevenueBarChart";
import { SellerConversionFunnel } from "@/components/analytics/SellerConversionFunnel";
import { SellerNetRevenueCard } from "@/components/analytics/SellerNetRevenueCard";
import { SellerTopProductsCard } from "@/components/analytics/SellerTopProductsCard";
import { SellerTopBotsCard } from "@/components/analytics/SellerTopBotsCard";
import { SellerRealtimeActivity } from "@/components/analytics/SellerRealtimeActivity";
import SellerPageHeader from "@/components/layout/SellerPageHeader";
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
  setupChecklist?: SellerSetupChecklistData | null;
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
    <div className="w-6 h-6 rounded-full bg-[#3984FF]/15 border border-[#3984FF]/30 flex items-center justify-center shrink-0">
      <Globe className="w-3.5 h-3.5 text-[#3984FF]" />
    </div>
  );
}

export function DashboardClient({ initialData, bots = [], setupChecklist }: DashboardClientProps) {
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

  // Saudação calculada no cliente após montagem para evitar hydration mismatch
  const [greeting, setGreeting] = useState<string>("Olá");
  useEffect(() => {
    const parts = getBusinessParts(new Date());
    setGreeting(getGreetingByHour(parts.hour));
  }, []);

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
    <>
      <SellerPageHeader
        title={
          <span>
            <span className="text-zinc-400 font-normal">{greeting}, </span>
            <span className="text-white font-bold">{displayName}</span>
          </span>
        }
        subtitle={formattedDate}
        badge={
          isPending ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#3984FF] font-mono shrink-0 bg-[#3984FF]/10 border border-[#3984FF]/25 px-2 py-0.5 rounded-full">
              <RefreshCw className="w-3 h-3 animate-spin text-[#3984FF]" />
              <span className="hidden sm:inline">Atualizando...</span>
            </span>
          ) : null
        }
        actions={
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 max-w-full relative z-30">
            {/* Seletor de Bot Integrado */}
            <div className="relative flex items-center min-w-[130px] sm:min-w-[160px] max-w-full">
              <Bot className="absolute left-2.5 w-4 h-4 text-zinc-400 pointer-events-none" />
              <select
                value={selectedBot}
                onChange={(e) => handleBotChange(e.target.value)}
                className="w-full bg-[#15171D] hover:bg-[#1C1E26] text-zinc-200 hover:text-white border border-white/[0.08] hover:border-zinc-700 rounded-xl pl-8 pr-7 py-1.5 text-xs font-medium focus:outline-none focus:border-[#3984FF] transition-all appearance-none cursor-pointer h-9 shadow-xs"
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
                    ? "border-[#3984FF]/80 ring-1 ring-[#3984FF]/30 text-white" 
                    : "border-white/[0.08] hover:border-zinc-700"
                }`}
                aria-haspopup="dialog"
                aria-expanded={isPeriodOpen}
              >
                <div className="flex items-center gap-2 truncate">
                  <Calendar className="w-3.5 h-3.5 text-[#3984FF] shrink-0" />
                  <span className="font-semibold text-[#F3F4F6] truncate max-w-[130px] sm:max-w-[180px]">
                    {activePeriodLabel}
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform shrink-0 ${isPeriodOpen ? "rotate-180 text-[#3984FF]" : ""}`} />
              </button>

              {/* Backdrop para telas pequenas (sem blur) */}
              {isPeriodOpen && (
                <div 
                  className="fixed inset-0 bg-black/75 sm:hidden z-40" 
                  onClick={() => setIsPeriodOpen(false)}
                />
              )}

              {/* Painel Popover do Seletor */}
              {isPeriodOpen && (
                <div className="fixed inset-x-4 top-24 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 z-50 w-auto sm:w-[360px] bg-[#0F1014] border border-white/[0.08] rounded-2xl shadow-2xl p-4 sm:p-5 space-y-4 animate-in fade-in-0 zoom-in-95">
                  {/* Topo do Popover */}
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
                    <div className="flex items-center gap-1.5 text-[#F3F4F6] font-semibold text-xs">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-[#3984FF]" />
                      <span>Selecione o período de análise</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPeriodOpen(false)}
                      className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-[#15171D] transition-colors cursor-pointer"
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
                            className={`px-2 py-2 rounded-xl text-xs font-medium transition-all text-left flex flex-col justify-between h-[52px] border cursor-pointer ${
                              isSelected
                                ? "bg-[#181A20] text-white border-[#3984FF]/80 shadow-xs font-semibold ring-1 ring-[#3984FF]/25"
                                : "bg-[#15171D] text-zinc-300 hover:text-white hover:bg-[#1C1E26] border-white/[0.08]"
                            }`}
                          >
                            <span className="truncate leading-tight text-[11px]">{p.label}</span>
                            <div className="flex items-center justify-between w-full pt-1">
                              <span className={`text-[9px] font-mono px-1 rounded ${isSelected ? 'bg-[#3984FF]/20 text-[#60A5FA]' : 'bg-[#0F1014] text-zinc-400'}`}>
                                {p.badge}
                              </span>
                              {isSelected && <Check className="w-3 h-3 text-[#3984FF] shrink-0" />}
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
                          className="w-full bg-[#15171D] border border-white/[0.08] hover:border-zinc-700 focus:border-[#3984FF] text-zinc-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none transition-all [color-scheme:dark]"
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
                          className="w-full bg-[#15171D] border border-white/[0.08] hover:border-zinc-700 focus:border-[#3984FF] text-zinc-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none transition-all [color-scheme:dark]"
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
                      className="w-full bg-[#3984FF] hover:bg-[#2563EB] text-white font-medium rounded-xl py-2 text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                    >
                      <span>Aplicar intervalo de datas</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        }
      />

      <div className="space-y-6 fade-in w-full max-w-full overflow-hidden min-w-0 pb-20">

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

      {/* 1. Checklist de primeiros passos (contextual, desaparece quando 100% concluído) */}
      <SellerSetupChecklist checklist={setupChecklist} isPending={isPending} />

      {/* 2. LINHA 1: CARDS DE KPI (4 cards em grid de 12 colunas / 4 colunas responsivas) */}
      <SellerKpiCards
        kpis={data.kpis}
        commercialMetrics={data.commercialMetrics}
        chartSeries={data.chartSeries}
        periodLabel={activePeriodLabel}
        isPending={isPending}
      />

      {/* 3. LINHA 2: GRÁFICO DE BARRAS DE RECEITA (8 cols) + FUNIL DE CONVERSÃO (4 cols) */}
      <div className="grid grid-cols-12 gap-4 lg:gap-6 w-full">
        <div className="col-span-12 lg:col-span-8">
          <SellerRevenueBarChart
            chartSeries={data.chartSeries}
            periodLabel={activePeriodLabel}
            isPending={isPending}
          />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <SellerConversionFunnel
            metrics={data.commercialMetrics}
            isPending={isPending}
          />
        </div>
      </div>

      {/* 4. LINHA 3: RECEITA LÍQUIDA VS BRUTA (4 cols) + TOP PRODUTOS (4 cols) + TOP BOTS (4 cols) */}
      <div className="grid grid-cols-12 gap-4 lg:gap-6 w-full">
        <div className="col-span-12 md:col-span-6 lg:col-span-4">
          <SellerNetRevenueCard
            financialSummary={data.financialSummary}
            totalGrossFallback={data.kpis?.revenue?.value || 0}
            salesCountFallback={data.kpis?.salesCount?.value || 0}
            isPending={isPending}
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-4">
          <SellerTopProductsCard
            topProducts={data.topProducts}
            isPending={isPending}
          />
        </div>
        <div className="col-span-12 md:col-span-12 lg:col-span-4">
          <SellerTopBotsCard
            channels={data.channels}
            isPending={isPending}
          />
        </div>
      </div>

      {/* 5. LINHA 4: ATIVIDADES EM TEMPO REAL (12 cols) */}
      <div className="w-full">
        <SellerRealtimeActivity
          activityLog={data.activityLog}
          isPending={isPending}
        />
      </div>
    </div>
  </>
);
}
