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
  RefreshCw,
  Calendar,
  ChevronDown,
  Check,
  ArrowRight,
} from "lucide-react";
import { StoreAnalyticsData } from "@/lib/analytics/analytics-service";
import { SellerMetricsOverview } from "@/components/analytics/SellerMetricsOverview";
import type { SellerSetupChecklistData } from "@/components/analytics/SellerSetupChecklist";
import { SellerActivityAndChannels } from "@/components/analytics/SellerActivityAndChannels";
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
  /** Redesign V2 (conta proprietária): filtros como botões de ícone ao lado da saudação. */
  isOwner?: boolean;
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

export function DashboardClient({ initialData, bots = [], isOwner = false }: DashboardClientProps) {
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

  // Popover de bots (cabeçalho V2)
  const [isBotOpen, setIsBotOpen] = useState(false);
  const botPopoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isBotOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (botPopoverRef.current && !botPopoverRef.current.contains(event.target as Node)) setIsBotOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isBotOpen]);

  // Click outside to close period popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (periodPopoverRef.current && !periodPopoverRef.current.contains(event.target as Node)) {
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

  const fetchAnalytics = (targetPeriod: string, botId?: string) => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const res = await getDashboardAnalyticsAction(
          targetPeriod,
          botId === "all" ? undefined : botId
        );
        if (res) {
          setData(res);
        }
      } catch (err: any) {
        setErrorMsg(err?.message || "Falha na comunicação com o servidor.");
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

  // Painel de período (presets + intervalo personalizado), usado nos dois layouts do cabeçalho.
  const periodPanel = (
    <div className="absolute right-0 top-full mt-2 w-[300px] sm:w-[320px] max-w-[calc(100vw-32px)] bg-[#101218] border border-white/[0.1] rounded-2xl p-3 shadow-2xl z-50 backdrop-blur-md space-y-3 animate-in fade-in zoom-in-95 duration-100">
      {/* Seção Presets */}
      <div className="space-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block px-2 py-0.5">
          Períodos Rápidos
        </span>
        <div className="grid grid-cols-1 gap-0.5">
          {PRESET_PERIODS.map((opt) => {
            const isSelected = period === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => handlePeriodChange(opt.key)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between cursor-pointer ${isSelected
                    ? "bg-[#3984FF]/15 text-[#3984FF] font-semibold"
                    : "text-zinc-300 hover:bg-white/[0.05] hover:text-white"
                  }`}
              >
                <span>{opt.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-400 bg-white/[0.04] px-1.5 py-0.5 rounded font-mono">
                    {opt.badge}
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
  );

  const botLabel = (b: DashboardBot) => b.displayName || (b.username ? `@${b.username}` : `Bot ${b.id.slice(0, 6)}`);
  const selectedBotObj = availableBots.find((b) => b.id === selectedBot);
  const periodBadge = PRESET_PERIODS.find((p) => p.key === period)?.badge ?? (period.startsWith("CUSTOM:") ? "Per." : "30D");

  return (
    <>
      {isOwner ? (
        <SellerPageHeader>
          <div className="flex items-center justify-between gap-3 w-full min-w-0 relative z-30 overflow-visible">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-base sm:text-xl md:text-2xl font-bold tracking-tight min-w-0">
                <span className="truncate">
                  <span className="text-zinc-400 font-normal">{greeting}, </span>
                  <span className="text-white">{displayName}</span>
                </span>
                {isPending && <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin text-[#60a5fa]" aria-label="Atualizando" />}
              </h1>
              <p className="text-zinc-400 text-xs sm:text-sm truncate">{formattedDate}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Filtro de bot: botão de ícone em gradiente azul */}
              <div className="relative" ref={botPopoverRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsBotOpen((v) => !v);
                    setIsPeriodOpen(false);
                  }}
                  aria-haspopup="listbox"
                  aria-expanded={isBotOpen}
                  aria-label={`Filtrar por bot: ${selectedBotObj ? botLabel(selectedBotObj) : "Todos os bots"}`}
                  title={selectedBotObj ? botLabel(selectedBotObj) : "Todos os bots"}
                  className="relative w-10 h-10 rounded-[9px] flex items-center justify-center text-white border border-white/20 transition-all hover:brightness-110 active:scale-95 cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 55%, #60a5fa 100%)",
                    boxShadow: "0 8px 20px -8px rgba(59,130,246,0.85), inset 0 1px 0 rgba(255,255,255,0.3)",
                  }}
                >
                  <Bot className="w-5 h-5" />
                  {selectedBotObj && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white border-2 border-[#3b82f6]" aria-hidden="true" />
                  )}
                </button>
                {isBotOpen && (
                  <div
                    role="listbox"
                    aria-label="Bots"
                    className="absolute right-0 top-full mt-2 w-[240px] max-w-[calc(100vw-32px)] bg-[#101218] border border-white/[0.1] rounded-2xl p-2 shadow-2xl z-50 space-y-0.5"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block px-2 py-1">Filtrar por bot</span>
                    {[{ id: "all", label: "Todos os bots" }, ...availableBots.map((b) => ({ id: b.id, label: botLabel(b) }))].map((opt) => {
                      const sel = selectedBot === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="option"
                          aria-selected={sel}
                          onClick={() => {
                            setIsBotOpen(false);
                            if (!sel) handleBotChange(opt.id);
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            sel ? "bg-[#3b82f6]/15 text-[#60a5fa] font-semibold" : "text-zinc-300 hover:bg-white/[0.05] hover:text-white"
                          }`}
                        >
                          <span className="truncate">{opt.label}</span>
                          {sel && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Filtro de período: botão de ícone com o período atual no selo */}
              <div className="relative" ref={periodPopoverRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsPeriodOpen((v) => !v);
                    setIsBotOpen(false);
                  }}
                  aria-haspopup="dialog"
                  aria-expanded={isPeriodOpen}
                  aria-label={`Período: ${activePeriodLabel}`}
                  title={activePeriodLabel}
                  className={`relative h-10 pl-2.5 pr-3 rounded-[9px] inline-flex items-center gap-1.5 bg-[#15171D] hover:bg-[#1C1E26] border transition-all active:scale-95 cursor-pointer ${
                    isPeriodOpen ? "border-[#3b82f6]/80 ring-1 ring-[#3b82f6]/30 text-white" : "border-white/[0.08] hover:border-zinc-700 text-zinc-300 hover:text-white"
                  }`}
                >
                  <Calendar className="w-[17px] h-[17px] shrink-0" />
                  <span className="text-[12px] font-semibold tabular-nums whitespace-nowrap">{periodBadge}</span>
                </button>
                {isPeriodOpen && periodPanel}
              </div>
            </div>
          </div>
        </SellerPageHeader>
      ) : (
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
          <div className="flex items-center gap-2 sm:gap-[10px] md:gap-2.5 shrink-0 max-w-full relative z-30">
            {/* Seletor de Bot Integrado */}
            <div className="relative flex items-center min-w-[120px] sm:min-w-[160px] max-w-full">
              <Bot className="absolute left-2.5 w-4 h-4 text-zinc-400 pointer-events-none" />
              <select
                value={selectedBot}
                onChange={(e) => handleBotChange(e.target.value)}
                className="w-full bg-[#15171D] hover:bg-[#1C1E26] text-zinc-200 hover:text-white border border-white/[0.08] hover:border-zinc-700 rounded-xl pl-6.5 pr-5.5 sm:pl-8 sm:pr-7 py-1.5 text-[11.5px] sm:text-xs font-medium focus:outline-none focus:border-[#3984FF] transition-all appearance-none cursor-pointer h-9 shadow-xs"
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
                className={`w-full sm:w-auto inline-flex items-center justify-between gap-2 bg-[#15171D] hover:bg-[#1C1E26] text-zinc-200 hover:text-white border rounded-xl px-2.5 sm:px-3 py-1.5 text-[11.5px] sm:text-xs font-medium transition-all cursor-pointer h-9 shadow-xs ${isPeriodOpen
                    ? "border-[#3984FF]/80 ring-1 ring-[#3984FF]/30 text-white"
                    : "border-white/[0.08] hover:border-zinc-700"
                  }`}
                aria-haspopup="dialog"
                aria-expanded={isPeriodOpen}
                aria-label="Selecionar intervalo de datas"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">
                    {activePeriodLabel}
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform ${isPeriodOpen ? "rotate-180 text-[#3984FF]" : ""}`} />
              </button>

              {/* Popover Dropdown */}
              {isPeriodOpen && (
                periodPanel
              )}
            </div>
          </div>
        }
      />
      )}

      <div className="w-full max-w-none flex flex-col gap-[20px] min-w-0 pb-0 relative">

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

        {/* 2. Destaque Principal (Hero), 4 Indicadores Compactos, Gráfico de Receita (65%) e Funil de Conversão (35%) */}
        <SellerMetricsOverview
          metrics={data.commercialMetrics}
          kpis={data.kpis}
          chartSeries={data.chartSeries}
          isPending={isPending}
          periodLabel={activePeriodLabel}
          compactMobile={isOwner}
        />

        {/* 3. Atividade recente, Mais Vendidos e Desempenho por Bot */}
        <SellerActivityAndChannels
          activityLog={data.activityLog}
          topProducts={data.topProducts}
          channels={data.channels}
          totalBotsCount={bots.length}
          isPending={isPending}
          selectedBotId={selectedBot}
        />
      </div>
    </>
  );
}
