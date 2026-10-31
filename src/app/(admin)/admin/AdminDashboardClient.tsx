"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Users,
  Bot,
  Package,
  ShoppingCart,
  DollarSign,
  UserCheck,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Store,
  Coins,
  ShieldCheck,
  Tag,
  AlertTriangle,
  Info,
  Calendar,
  Zap,
  Trophy,
} from "lucide-react";
import dynamic from "next/dynamic";
import AdminPageHeader from "../AdminPageHeader";
import type {
  AdminDashboardData,
  AdminDashboardPeriod,
  SellerRankingItem,
} from "@/lib/analytics/admin-dashboard-service";

const AdminChartsComponent = dynamic(
  () => import("./AdminChartsComponent").then((m) => m.AdminChartsComponent),
  { ssr: false }
);

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const ADMIN_PERIOD_OPTIONS = [
  { id: "7d", label: "7 dias", badge: "7D" },
  { id: "30d", label: "30 dias", badge: "30D" },
  { id: "90d", label: "90 dias", badge: "90D" },
] as const;

export default function AdminDashboardClient() {
  const [period, setPeriod] = useState<AdminDashboardPeriod>("30d");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Split sync state
  const [syncingSplits, setSyncingSplits] = useState<boolean>(false);
  const [splitSyncResult, setSplitSyncResult] = useState<{
    updated: number;
    skipped: number;
    divergence: number;
    errors: number;
    total: number;
  } | null>(null);

  // Chart view toggle: "gmv" | "pix" | "orders"
  const [chartView, setChartView] = useState<"gmv" | "pix" | "orders">("gmv");

  // Ranking sorting: "gmv" | "orders"
  const [rankingSort, setRankingSort] = useState<"gmv" | "orders">("gmv");

  const fetchDashboardStats = useCallback(
    async (selectedPeriod: AdminDashboardPeriod, isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMsg(null);

      try {
        const res = await fetch(`/api/admin/dashboard-stats?period=${selectedPeriod}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || "Falha ao carregar métricas administrativas.");
        }
        const json: AdminDashboardData = await res.json();
        setData(json);
      } catch (err: any) {
        console.error("Dashboard Stats Fetch Error:", err);
        setErrorMsg(err.message || "Erro de conexão ao carregar dashboard.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  const handleSyncSplits = useCallback(async () => {
    setSyncingSplits(true);
    setSplitSyncResult(null);
    try {
      const res = await fetch("/api/admin/splits/sync", { method: "POST" });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Falha ao sincronizar splits.");
      }
      const json = await res.json();
      setSplitSyncResult(json.summary);
      await fetchDashboardStats(period, true);
    } catch (err: any) {
      console.error("Split sync error:", err);
      alert("Erro ao sincronizar splits: " + String(err?.message || "Erro desconhecido"));
    } finally {
      setSyncingSplits(false);
    }
  }, [period, fetchDashboardStats]);

  useEffect(() => {
    fetchDashboardStats(period);
  }, [period, fetchDashboardStats]);

  // Sorted Seller Ranking
  const sortedRanking = useMemo(() => {
    if (!data?.sellerRanking) return [];
    return [...data.sellerRanking].sort((a, b) => {
      if (rankingSort === "orders") {
        return b.paidOrdersCount - a.paidOrdersCount;
      }
      return b.approvedGmv - a.approvedGmv;
    });
  }, [data?.sellerRanking, rankingSort]);

  // Total GMV do período para cálculo do % Share no Leaderboard
  const totalPeriodGmv = useMemo(() => {
    return data?.salesAndPayments.gmvApproved || data?.kpis.gmv.current || 0;
  }, [data?.salesAndPayments.gmvApproved, data?.kpis.gmv.current]);

  // Cálculo de Ticket Médio Real do período
  const averageTicket = useMemo(() => {
    const ordersCount = data?.salesAndPayments.paidOrdersCount || 0;
    const gmv = data?.salesAndPayments.gmvApproved || 0;
    if (ordersCount <= 0 || gmv <= 0) return 0;
    return gmv / ordersCount;
  }, [data?.salesAndPayments.paidOrdersCount, data?.salesAndPayments.gmvApproved]);

  // Take-rate médio efetivo da plataforma no período
  const effectiveTakeRate = useMemo(() => {
    const gmv = data?.salesAndPayments.gmvApproved || 0;
    const fees = data?.platformFees.processedFeeTotal || 0;
    if (gmv <= 0 || fees <= 0) return null;
    return ((fees / gmv) * 100).toFixed(1);
  }, [data?.salesAndPayments.gmvApproved, data?.platformFees.processedFeeTotal]);

  const activePeriodObj =
    ADMIN_PERIOD_OPTIONS.find((p) => p.id === period) || ADMIN_PERIOD_OPTIONS[1];

  return (
    <div className="space-y-6 sm:space-y-8 pb-16 text-zinc-100 fade-in max-w-[1600px] mx-auto">
      {/* ==================================================== */}
      {/* 1. TOPBAR EXECUTIVA (Sóbria, Minimalista, Sem Caixas) */}
      {/* ==================================================== */}
      <AdminPageHeader>
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
                Dashboard Administrativo
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono text-zinc-400 bg-white/[0.04] rounded-full">
                Super Admin
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-zinc-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Operacional
              </span>
            </div>
            <p className="text-zinc-400 text-xs sm:text-sm mt-1">
              Visão estratégica em tempo real de vendas, conversão Pix, saúde do ecossistema e taxas da plataforma
            </p>
          </div>

          {/* CONTROLES: SEGMENTED PERIOD & REFRESH */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Segmented Control Minimalista (Linear Style) */}
            <div className="inline-flex items-center bg-[#07080B] p-0.5 rounded-lg border border-white/[0.05]">
              {ADMIN_PERIOD_OPTIONS.map((p) => {
                const isSelected = period === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPeriod(p.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${isSelected
                        ? "bg-[#161820] text-white font-semibold shadow-xs"
                        : "text-zinc-400 hover:text-zinc-200"
                      }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Botão Atualizar Minimalista */}
            <button
              type="button"
              onClick={() => fetchDashboardStats(period, true)}
              disabled={refreshing || loading}
              title="Atualizar dados"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0C0E14] hover:bg-[#141720] text-zinc-400 hover:text-white rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-50 h-8"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-blue-400" : "text-zinc-400"}`}
              />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            {data?.updatedAt && (
              <div className="hidden xl:flex items-center gap-1 text-[11px] font-mono text-zinc-400">
                <Clock className="w-3 h-3 text-zinc-400" />
                <span>{data.updatedAt}</span>
              </div>
            )}
          </div>
        </header>
      </AdminPageHeader>

      {/* ERROR BANNER */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => fetchDashboardStats(period)}
            className="text-xs font-semibold underline hover:text-white cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. HERO FINANCEIRO ASSIMÉTRICO (Sem Caixas de Ícone) */}
      {/* ==================================================== */}
      <section id="section-hero" className="space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center justify-between">
          <span>O Motor Financeiro da Plataforma ({data?.periodLabel || activePeriodObj.label})</span>
          <span className="text-[10px] text-zinc-400 normal-case font-mono">Fuso: America/Recife (UTC-3)</span>
        </div>

        {loading && !data ? (
          <HeroSkeleton />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* HERO 1: GMV Aprovado (7 Colunas - Dominante) */}
            <div className="lg:col-span-7 bg-[#0C0F17] bg-[radial-gradient(ellipse_120%_100%_at_0%_0%,rgba(59,130,246,0.09)_0%,transparent_70%)] hover:bg-[radial-gradient(ellipse_120%_100%_at_0%_0%,rgba(59,130,246,0.13)_0%,transparent_70%)] rounded-2xl p-6 sm:p-7 shadow-sm transition-all duration-150 ease-out motion-safe:hover:-translate-y-[1px] relative overflow-hidden">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                      Volume Bruto Transacionado (GMV)
                    </span>
                    <span className="text-[9px] font-mono text-zinc-300 uppercase tracking-wider">
                      Vendas Aprovadas
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Total faturado no intervalo selecionado pelas lojas ativas
                  </p>
                </div>
                {/* Ícone direto sobre a superfície, sem caixa/selo */}
                <DollarSign className="w-5 h-5 text-blue-400 shrink-0" strokeWidth={2} />
              </div>

              {/* Valor Principal Hero com Halo difuso */}
              <div className="relative flex flex-col sm:flex-row sm:items-baseline gap-3 my-2">
                {/* Halo difuso atrás do valor */}
                <div
                  aria-hidden="true"
                  className="absolute -left-4 top-1/2 -translate-y-1/2 w-48 h-24 bg-blue-500/[0.14] rounded-full blur-[40px] pointer-events-none"
                />

                <span className="relative z-10 text-3xl sm:text-4xl lg:text-5xl font-black text-white font-mono tabular-nums tracking-tight">
                  {formatCurrency(data?.kpis.gmv.current ?? 0)}
                </span>

                {data?.kpis.gmv.changePercent !== null && data?.kpis.gmv.changePercent !== undefined && (() => {
                  const val = data.kpis.gmv.changePercent;
                  const isPositive = val > 0;
                  const isNegative = val < 0;
                  const formatted = isPositive ? (val > 999 ? "+999%+" : `+${val}%`) : isNegative ? (val < -999 ? "-999%-" : `${val}%`) : `${val}%`;
                  const fullLabel = `${isPositive ? `+${val}%` : `${val}%`} vs anterior`;
                  const pillColor = isPositive
                    ? "bg-emerald-500/10 text-emerald-400"
                    : isNegative
                      ? "bg-red-500/10 text-red-400"
                      : "bg-white/[0.04] text-zinc-400";

                  return (
                    <span
                      title={fullLabel}
                      className={`relative z-10 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono font-medium ${pillColor}`}
                    >
                      {isPositive ? (
                        <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                      ) : isNegative ? (
                        <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                      ) : null}
                      <span>{formatted}</span>
                      <span className="text-[10px] text-zinc-400 opacity-80">vs anterior</span>
                    </span>
                  );
                })()}
              </div>

              {/* Indicadores de Apoio Hero em colunas separadas por linhas verticais */}
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06] pt-4 mt-4 border-t border-white/[0.06] text-xs">
                <div className="sm:pr-4 pb-3 sm:pb-0">
                  <span className="text-[10px] text-zinc-300 uppercase font-mono tracking-wider block">Pedidos Aprovados</span>
                  <span className="text-base font-semibold text-white font-mono tabular-nums mt-0.5 block">
                    {(data?.salesAndPayments.paidOrdersCount || data?.kpis.paidOrders.current || 0).toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="sm:px-4 py-3 sm:py-0">
                  <span className="text-[10px] text-zinc-300 uppercase font-mono tracking-wider block">Ticket Médio</span>
                  <span className="text-base font-semibold text-zinc-100 font-mono tabular-nums mt-0.5 block">
                    {formatCurrency(averageTicket)}
                  </span>
                </div>
                <div className="sm:pl-4 pt-3 sm:pt-0">
                  <span className="text-[10px] text-zinc-300 uppercase font-mono tracking-wider block">Acumulado Histórico</span>
                  <span className="text-base font-semibold text-zinc-200 font-mono tabular-nums mt-0.5 block">
                    {formatCurrency(data?.kpis.gmv.total ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* HERO 2: Receita de Taxas da Plataforma (5 Colunas) */}
            <div className="lg:col-span-5 bg-[#091211] bg-[radial-gradient(ellipse_120%_100%_at_0%_0%,rgba(16,185,129,0.09)_0%,transparent_70%)] hover:bg-[radial-gradient(ellipse_120%_100%_at_0%_0%,rgba(16,185,129,0.13)_0%,transparent_70%)] rounded-2xl p-6 sm:p-7 shadow-sm transition-all duration-150 ease-out motion-safe:hover:-translate-y-[1px] relative overflow-hidden">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      Receita de Taxas da Plataforma
                    </span>
                    <span className="text-[9px] font-mono text-zinc-300 uppercase tracking-wider">
                      Confirmado
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Comissões e taxas processadas com sucesso pelo gateway
                  </p>
                </div>
                {/* Ícone direto sobre a superfície, sem caixa/selo */}
                <Coins className="w-5 h-5 text-emerald-400 shrink-0" strokeWidth={2} />
              </div>

              {/* Valor Principal Taxas com Halo difuso */}
              <div className="relative flex flex-col sm:flex-row sm:items-baseline gap-3 my-2">
                {/* Halo difuso atrás do valor */}
                <div
                  aria-hidden="true"
                  className="absolute -left-4 top-1/2 -translate-y-1/2 w-48 h-24 bg-emerald-500/[0.14] rounded-full blur-[40px] pointer-events-none"
                />

                <span className="relative z-10 text-3xl sm:text-4xl lg:text-4xl font-black text-emerald-400 font-mono tabular-nums tracking-tight">
                  {formatCurrency(data?.kpis.processedFees.current ?? 0)}
                </span>

                {data?.kpis.processedFees.changePercent !== null && data?.kpis.processedFees.changePercent !== undefined && (() => {
                  const val = data.kpis.processedFees.changePercent;
                  const isPositive = val > 0;
                  const isNegative = val < 0;
                  const formatted = isPositive ? (val > 999 ? "+999%+" : `+${val}%`) : isNegative ? (val < -999 ? "-999%-" : `${val}%`) : `${val}%`;
                  const fullLabel = `${isPositive ? `+${val}%` : `${val}%`} vs anterior`;
                  const pillColor = isPositive
                    ? "bg-emerald-500/10 text-emerald-400"
                    : isNegative
                      ? "bg-red-500/10 text-red-400"
                      : "bg-white/[0.04] text-zinc-400";

                  return (
                    <span
                      title={fullLabel}
                      className={`relative z-10 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono font-medium ${pillColor}`}
                    >
                      {isPositive ? (
                        <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                      ) : isNegative ? (
                        <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                      ) : null}
                      <span>{formatted}</span>
                      <span className="text-[10px] text-zinc-400 opacity-80">vs anterior</span>
                    </span>
                  );
                })()}
              </div>

              {/* Indicadores de Apoio Taxas em colunas separadas por linhas verticais */}
              <div className="grid grid-cols-2 divide-x divide-white/[0.06] pt-4 mt-4 border-t border-white/[0.06] text-xs">
                <div className="pr-4">
                  <span className="text-[10px] text-zinc-300 uppercase font-mono tracking-wider block">Take-Rate Efetivo</span>
                  <span className="text-base font-semibold text-white font-mono tabular-nums mt-0.5 block">
                    {effectiveTakeRate ? `${effectiveTakeRate}% das vendas` : "R$ 0,50/venda"}
                  </span>
                </div>
                <div className="pl-4">
                  <span className="text-[10px] text-zinc-300 uppercase font-mono tracking-wider block">Total Histórico</span>
                  <span className="text-base font-semibold text-zinc-200 font-mono tabular-nums mt-0.5 block">
                    {formatCurrency(data?.kpis.processedFees.total ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ==================================================== */}
      {/* 3. RÉGUA COMPACTA DE TELEMETRIA (Ícones Neutros)     */}
      {/* ==================================================== */}
      <section id="section-telemetry" className="bg-[#0B0D12] p-4 sm:p-5 rounded-2xl shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.04]">
          {/* 1. Lojistas */}
          <div className="px-2 pt-2 sm:pt-0 sm:px-4 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium uppercase tracking-wider">Lojistas</span>
              <Users className="w-4 h-4 text-zinc-400" strokeWidth={1.75} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white font-mono tabular-nums">
                {data?.kpis.sellers.total.toLocaleString("pt-BR") || "0"}
              </span>
              {data?.kpis.sellers.current !== undefined && data.kpis.sellers.current > 0 && (
                <span className="text-[11px] font-mono text-zinc-400">
                  +{data.kpis.sellers.current}
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-400">Vendedores cadastrados</p>
          </div>

          {/* 2. Lojas */}
          <div className="px-2 pt-2 sm:pt-0 sm:px-4 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium uppercase tracking-wider">Lojas</span>
              <Store className="w-4 h-4 text-zinc-400" strokeWidth={1.75} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white font-mono tabular-nums">
                {data?.kpis.stores.total.toLocaleString("pt-BR") || "0"}
              </span>
              {data?.kpis.stores.current !== undefined && data.kpis.stores.current > 0 && (
                <span className="text-[11px] font-mono text-zinc-400">
                  +{data.kpis.stores.current} novas
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-400">Lojas virtuais ativas</p>
          </div>

          {/* 3. Bots Telegram */}
          <div className="px-2 pt-2 sm:pt-0 sm:px-4 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium uppercase tracking-wider">Bots Telegram</span>
              <Bot className="w-4 h-4 text-zinc-400" strokeWidth={1.75} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white font-mono tabular-nums">
                {data?.kpis.bots.total.toLocaleString("pt-BR") || "0"}
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                {data?.telegramStats.activeBots || 0} operando
              </span>
            </div>
            <p className="text-[10px] text-zinc-400">Bots com webhook ativo</p>
          </div>

          {/* 4. Produtos */}
          <div className="px-2 pt-2 sm:pt-0 sm:px-4 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium uppercase tracking-wider">Produtos</span>
              <Package className="w-4 h-4 text-zinc-400" strokeWidth={1.75} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white font-mono tabular-nums">
                {data?.kpis.products.total.toLocaleString("pt-BR") || "0"}
              </span>
              {data?.kpis.products.current !== undefined && data.kpis.products.current > 0 && (
                <span className="text-[11px] font-mono text-zinc-400">
                  +{data.kpis.products.current} novos
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-400">Catálogo global cadastrado</p>
          </div>
        </div>
      </section>

      {/* ==================================================== */}
      {/* 4. NÚCLEO ANALÍTICO: GRÁFICO + EFICIÊNCIA PIX       */}
      {/* ==================================================== */}
      <section id="section-charts" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Lado Esquerdo: Gráfico Discreto (8 Colunas) */}
        <div className="lg:col-span-8 bg-[#0B0D12] p-5 sm:p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.04] pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Evolução Temporal & Vendas
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Tendência diária registrada em tempo real pelo sistema
              </p>
            </div>

            {/* Segmented Control do Gráfico */}
            <div className="inline-flex items-center bg-[#07080B] p-0.5 rounded-lg border border-white/[0.05] text-xs">
              <button
                type="button"
                onClick={() => setChartView("gmv")}
                className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${chartView === "gmv"
                    ? "bg-[#161820] text-white font-semibold shadow-xs"
                    : "text-zinc-400 hover:text-white"
                  }`}
              >
                Volume (GMV)
              </button>
              <button
                type="button"
                onClick={() => setChartView("orders")}
                className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${chartView === "orders"
                    ? "bg-[#161820] text-white font-semibold shadow-xs"
                    : "text-zinc-400 hover:text-white"
                  }`}
              >
                Pedidos Pagos
              </button>
              <button
                type="button"
                onClick={() => setChartView("pix")}
                className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${chartView === "pix"
                    ? "bg-[#161820] text-white font-semibold shadow-xs"
                    : "text-zinc-400 hover:text-white"
                  }`}
              >
                Pix Gerado vs Pago
              </button>
            </div>
          </div>

          {/* Gráfico Recharts */}
          <div className="h-72 sm:h-80 w-full pt-1">
            {loading ? (
              <ChartSkeleton />
            ) : data?.salesAndPayments.dailyEvolution && data.salesAndPayments.dailyEvolution.length > 0 ? (
              <AdminChartsComponent
                type={chartView === "gmv" ? "gmv" : chartView === "orders" ? "orders" : "pix"}
                data={data.salesAndPayments.dailyEvolution}
              />
            ) : (
              <EmptyChartState message="Sem histórico de transações para o período selecionado." />
            )}
          </div>
        </div>

        {/* Lado Direito: Eficiência do Checkout Pix (4 Colunas) */}
        <div className="lg:col-span-4 bg-[#0B0D12] p-5 sm:p-6 rounded-2xl shadow-xs flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Eficiência do Checkout Pix
              </h2>
              <span className="text-[10px] font-mono text-zinc-400 uppercase">PushinPay</span>
            </div>

            {/* Destaque Taxa de Conversão */}
            <div className="pt-4 pb-2 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-zinc-400">Taxa de Conversão</span>
                <span className="text-2xl font-black text-emerald-400 font-mono tabular-nums">
                  {data?.salesAndPayments.pixConversionRate !== null &&
                    data?.salesAndPayments.pixConversionRate !== undefined
                    ? `${data.salesAndPayments.pixConversionRate}%`
                    : "0%"}
                </span>
              </div>

              {/* Barra de Progresso Visual */}
              <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, data?.salesAndPayments.pixConversionRate || 0)
                    )}%`,
                  }}
                />
              </div>
              <span className="text-[10px] text-zinc-400 block text-right font-mono">
                Pix pagos / Pix gerados
              </span>
            </div>

            {/* Grid de Métricas de Checkout (Sem bordas pesadas) */}
            <div className="grid grid-cols-2 gap-3 pt-3">
              <div className="p-3 rounded-xl bg-white/[0.02]">
                <span className="text-[10px] text-zinc-400 uppercase font-mono block">Pix Gerados</span>
                <span className="text-lg font-black text-white font-mono tabular-nums mt-0.5 block">
                  {data?.salesAndPayments.pixGeneratedCount.toLocaleString("pt-BR") || "0"}
                </span>
                <span className="text-[9px] text-zinc-400 block mt-0.5">Cobranças emitidas</span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02]">
                <span className="text-[10px] text-emerald-400 uppercase font-mono block">Pix Pagos</span>
                <span className="text-lg font-black text-emerald-400 font-mono tabular-nums mt-0.5 block">
                  {data?.salesAndPayments.pixPaidCount.toLocaleString("pt-BR") || "0"}
                </span>
                <span className="text-[9px] text-zinc-400 block mt-0.5">Confirmados</span>
              </div>
            </div>
          </div>

          {/* Apoio Informativo */}
          <div className="p-3 rounded-xl bg-white/[0.02] space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-400">Total Aprovado:</span>
              <span className="font-bold text-white font-mono tabular-nums">
                {formatCurrency(data?.salesAndPayments.gmvApproved || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-400">Ticket Médio:</span>
              <span className="font-bold text-zinc-300 font-mono tabular-nums">
                {formatCurrency(averageTicket)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================== */}
      {/* 5. ESTEIRA DE LIQUIDAÇÃO & AUDITORIA DE SPLITS      */}
      {/* ==================================================== */}
      <section id="section-pipeline" className="bg-[#0B0D12] p-5 sm:p-7 rounded-2xl shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.04] pb-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Auditoria de Splits & Liquidação de Taxas
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Esteira de conciliação bancária entre o gateway PushinPay e a plataforma WebGran
            </p>
          </div>
          <span className="text-xs font-mono font-medium text-emerald-400 self-start sm:self-auto">
            {formatCurrency(data?.platformFees.processedFeeTotal || 0)} processado
          </span>
        </div>

        {/* Pipeline de 3 Estágios (Sem bordas agressivas, separação por tonalidade) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Estágio 1: Previsto Total */}
          <div className="p-4 rounded-xl bg-white/[0.02] space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-medium uppercase tracking-wider text-[10px]">
                1. Taxas Previstas (Elegíveis)
              </span>
              <Info className="w-3.5 h-3.5 text-zinc-400" />
            </div>
            <span className="text-xl sm:text-2xl font-black text-white font-mono tabular-nums block">
              {formatCurrency(data?.platformFees.expectedFeeTotal || 0)}
            </span>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Total calculado para pedidos pagos conforme taxa individual configurada.
            </p>
          </div>

          {/* Estágio 2: Processado / Aceito */}
          <div className="p-4 rounded-xl bg-emerald-500/[0.03] border-l-2 border-emerald-500/50 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-emerald-400">
              <span className="font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                2. Processado / Aceito
              </span>
              <span className="font-mono text-[10px] text-emerald-400/80">
                {data?.platformFees.processedCount || 0} pedidos
              </span>
            </div>
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tabular-nums block">
              {formatCurrency(data?.platformFees.processedFeeTotal || 0)}
            </span>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Splits aceitos e confirmados com sucesso pelo gateway de pagamentos (<code className="text-emerald-300 font-mono">GATEWAY_ACCEPTED</code>).
            </p>
          </div>

          {/* Estágio 3: Liquidado em Conta */}
          <div className="p-4 rounded-xl bg-blue-500/[0.03] border-l-2 border-blue-500/50 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-blue-400">
              <span className="font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                3. Liquidado em Conta
              </span>
              <span className="font-mono text-[10px] text-blue-400/80">
                {data?.platformFees.settledCount || 0} pedidos
              </span>
            </div>
            <span className="text-xl sm:text-2xl font-black text-white font-mono tabular-nums block">
              {formatCurrency(data?.platformFees.settledFeeTotal || 0)}
            </span>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Valor com liquidação bancária formalizada (<code className="text-blue-300 font-mono">SETTLED</code>). Saldo efetivo em conta.
            </p>
          </div>
        </div>

        {/* Central de Exceções & Reconciliação */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
          {/* Pendentes com Ação Rápida */}
          <div className="p-4 rounded-xl bg-white/[0.02] space-y-2">
            <div className="flex items-center justify-between text-amber-400 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Splits Pendentes
              </span>
              <span className="font-mono text-[11px]">{data?.platformFees.pendingCount || 0} pedidos</span>
            </div>
            <span className="text-lg font-black text-amber-400 font-mono tabular-nums block">
              {formatCurrency(data?.platformFees.pendingFeeTotal || 0)}
            </span>
            <button
              type="button"
              onClick={handleSyncSplits}
              disabled={syncingSplits || loading}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 disabled:opacity-50 cursor-pointer transition-all h-8"
            >
              {syncingSplits ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" /> Sincronizando...
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3" /> Reconciliar Agora
                </>
              )}
            </button>
            {splitSyncResult && (
              <p className="text-[10px] text-emerald-400 font-mono">
                ✓ {splitSyncResult.updated} atualizados · {splitSyncResult.skipped} inalterados
              </p>
            )}
          </div>

          {/* Isenções Intencionais (SKIPPED) */}
          <div className="p-4 rounded-xl bg-white/[0.02] space-y-1.5">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-zinc-400" />
                Isenções / Skipped
              </span>
              <span className="font-mono text-[11px] text-zinc-400">
                {data?.platformFees.skippedCount || 0} pedidos
              </span>
            </div>
            <span className="text-lg font-black text-zinc-300 font-mono tabular-nums block">
              {formatCurrency(data?.platformFees.skippedFeeTotal || 0)}
            </span>
            <p className="text-[11px] text-zinc-400">
              Taxa zero intencional ou isenção promocional. Não é falha.
            </p>
          </div>

          {/* Splits com Falha (FAILED) */}
          <div className="p-4 rounded-xl bg-white/[0.02] space-y-1.5">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-red-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                Splits com Falha
              </span>
              <span className="font-mono text-[11px] text-zinc-400">{data?.platformFees.failedCount || 0} pedidos</span>
            </div>
            <span className="text-lg font-black text-red-400 font-mono tabular-nums block">
              {formatCurrency(data?.platformFees.failedFeeTotal || 0)}
            </span>
            <p className="text-[11px] text-zinc-400">
              Transações com erro de comunicação que exigem atenção.
            </p>
          </div>
        </div>
      </section>

      {/* ==================================================== */}
      {/* 6. LEADERBOARD DE VENDEDORES COM % SHARE DO GMV      */}
      {/* ==================================================== */}
      <section id="section-leaderboard" className="bg-[#0B0D12] p-5 sm:p-7 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.04] pb-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Leaderboard de Vendedores
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Participação no faturamento da plataforma e volume de transações no período
            </p>
          </div>

          {/* Ordenação do Ranking */}
          <div className="flex items-center gap-1 bg-[#07080B] p-0.5 rounded-lg border border-white/[0.05] text-xs">
            <span className="text-zinc-400 px-2 text-[11px]">Ordenar:</span>
            <button
              type="button"
              onClick={() => setRankingSort("gmv")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${rankingSort === "gmv"
                  ? "bg-[#161820] text-white font-semibold shadow-xs"
                  : "text-zinc-400 hover:text-white"
                }`}
            >
              Maior GMV
            </button>
            <button
              type="button"
              onClick={() => setRankingSort("orders")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${rankingSort === "orders"
                  ? "bg-[#161820] text-white font-semibold shadow-xs"
                  : "text-zinc-400 hover:text-white"
                }`}
            >
              Mais Pedidos
            </button>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/[0.04] text-zinc-400 text-[10px] font-semibold uppercase tracking-wider font-mono">
                <th className="pb-3 px-3 w-12">Pos</th>
                <th className="pb-3 px-3">Vendedor & Loja</th>
                <th className="pb-3 px-3 w-48">Share do Faturamento</th>
                <th className="pb-3 px-3 text-right">Pedidos</th>
                <th className="pb-3 px-3 text-right">GMV Aprovado</th>
                <th className="pb-3 px-3 text-right">Taxas Retidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {sortedRanking.map((s, idx) => {
                const sharePercent =
                  totalPeriodGmv > 0 ? (s.approvedGmv / totalPeriodGmv) * 100 : 0;

                return (
                  <tr key={s.sellerId} className="hover:bg-white/[0.02] transition-colors">
                    {/* Badge de Posição */}
                    <td className="py-3 px-3">
                      {idx === 0 ? (
                        <span className="font-bold text-amber-300 font-mono text-xs">#1</span>
                      ) : idx === 1 ? (
                        <span className="font-bold text-slate-300 font-mono text-xs">#2</span>
                      ) : idx === 2 ? (
                        <span className="font-bold text-amber-500 font-mono text-xs">#3</span>
                      ) : (
                        <span className="text-zinc-400 font-mono text-[11px]">#{idx + 1}</span>
                      )}
                    </td>

                    {/* Vendedor e Loja Vinculada */}
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-xs">{s.sellerName}</span>
                          {s.storeName && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 bg-white/[0.03] px-1.5 py-0.5 rounded">
                              <Store className="w-2.5 h-2.5" />
                              {s.storeName}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono">{s.sellerEmail}</span>
                      </div>
                    </td>

                    {/* Barra Visual de % Share */}
                    <td className="py-3 px-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-zinc-400">Participação</span>
                          <span className="font-bold text-white">{sharePercent.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(0, sharePercent))}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Pedidos */}
                    <td className="py-3 px-3 text-right font-medium text-zinc-300 font-mono tabular-nums">
                      {s.paidOrdersCount.toLocaleString("pt-BR")}
                    </td>

                    {/* GMV */}
                    <td className="py-3 px-3 text-right font-black text-white font-mono tabular-nums">
                      {formatCurrency(s.approvedGmv)}
                    </td>

                    {/* Taxas Processadas */}
                    <td className="py-3 px-3 text-right font-bold text-emerald-400 font-mono tabular-nums">
                      {formatCurrency(s.processedFees)}
                    </td>
                  </tr>
                );
              })}

              {sortedRanking.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-zinc-400 text-xs">
                    Nenhum pedido pago encontrado para os vendedores no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ==================================================== */}
      {/* 7. FEED DE VENDAS & ECOSSISTEMA TELEGRAM (7 + 5)     */}
      {/* ==================================================== */}
      <section id="section-feed" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Últimos Pedidos Aprovados (7 Colunas) */}
        <div className="lg:col-span-7 bg-[#0B0D12] p-5 sm:p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-400" />
                Últimos Pedidos Aprovados
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Feed de transações pagas mais recentes na plataforma
              </p>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">Últimas 10</span>
          </div>

          <div className="divide-y divide-white/[0.03]">
            {(data?.recentSales || []).map((sale) => (
              <div
                key={sale.id}
                className="py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.02] px-2 rounded-lg transition-colors"
              >
                {/* Avatar Inicial + Cliente */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-[#181C26] text-zinc-300 font-bold text-xs flex items-center justify-center shrink-0 uppercase font-mono">
                    {sale.customerName ? sale.customerName.charAt(0) : "C"}
                  </div>
                  <div className="min-w-0 truncate">
                    <p className="text-xs font-medium text-white truncate">{sale.customerName}</p>
                    <p className="text-[10px] text-zinc-400 truncate">
                      {sale.storeName} · <span className="text-zinc-400">{sale.sellerName}</span>
                    </p>
                  </div>
                </div>

                {/* Valor + Status do Split */}
                <div className="text-right shrink-0 space-y-0.5">
                  <span className="text-xs font-black text-white font-mono tabular-nums block">
                    {formatCurrency(sale.total)}
                  </span>
                  <div className="flex items-center justify-end gap-1.5">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium font-mono ${sale.splitStatus === "PROCESSED" || sale.splitStatus === "GATEWAY_ACCEPTED"
                          ? "text-emerald-400 bg-emerald-500/10"
                          : sale.splitStatus === "SKIPPED"
                            ? "text-zinc-400 bg-white/5"
                            : sale.splitStatus === "FAILED"
                              ? "text-red-400 bg-red-500/10"
                              : "text-amber-400 bg-amber-500/10"
                        }`}
                    >
                      {sale.splitStatus || "PENDING"}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {new Date(sale.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {(data?.recentSales || []).length === 0 && (
              <div className="py-8 text-center text-zinc-400 text-xs">
                Nenhuma venda confirmada registrada recentemente.
              </div>
            )}
          </div>
        </div>

        {/* Ecossistema Telegram (5 Colunas) */}
        <div className="lg:col-span-5 bg-[#0B0D12] p-5 sm:p-6 rounded-2xl shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-white/[0.04] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Bot className="w-4 h-4 text-zinc-400" />
                Ecossistema Telegram
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">Telemetria de bots e clientes conectados</p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                <span className="text-zinc-400">Bots Conectados Ativos:</span>
                <span className="font-bold text-white text-sm font-mono tabular-nums">
                  {data?.telegramStats.activeBots || 0} de {data?.telegramStats.totalBots || 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                <span className="text-zinc-400">Clientes Telegram Totais:</span>
                <span className="font-bold text-white text-sm font-mono tabular-nums">
                  {data?.telegramStats.totalCustomers.toLocaleString("pt-BR") || "0"}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                <span className="text-zinc-400">Novos Clientes no Período:</span>
                <span className="font-bold text-zinc-200 text-sm font-mono tabular-nums">
                  +{data?.telegramStats.newCustomersPeriod.toLocaleString("pt-BR") || "0"}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-white/[0.02] rounded-xl text-[11px] text-zinc-400 leading-relaxed">
            {data?.telegramStats.attributionNote ||
              "Telemetria baseada em compradores únicos que iniciaram sessão de compra via WebApp do Telegram."}
          </div>
        </div>
      </section>
    </div>
  );
}

// ====================================================
// SKELETONS & EMPTY STATES
// ====================================================

function HeroSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-pulse">
      <div className="lg:col-span-7 h-44 bg-[#0C0F17] rounded-2xl p-6 space-y-3">
        <div className="h-3 w-40 bg-white/5 rounded" />
        <div className="h-9 w-64 bg-white/10 rounded" />
        <div className="h-2.5 w-48 bg-white/5 rounded" />
      </div>
      <div className="lg:col-span-5 h-44 bg-[#091211] rounded-2xl p-6 space-y-3">
        <div className="h-3 w-40 bg-white/5 rounded" />
        <div className="h-9 w-48 bg-white/10 rounded" />
        <div className="h-2.5 w-32 bg-white/5 rounded" />
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-white/[0.01] rounded-xl animate-pulse">
      <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
        <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
        <span>Carregando série temporal...</span>
      </div>
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-white/[0.01] rounded-xl text-center p-4">
      <Calendar className="w-6 h-6 text-zinc-400 mb-2" />
      <p className="text-xs text-zinc-300 font-medium">{message}</p>
      <span className="text-[10px] text-zinc-400 mt-0.5">
        Selecione outro período ou aguarde novos eventos de vendas.
      </span>
    </div>
  );
}
