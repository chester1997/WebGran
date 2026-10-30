"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Building2,
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
  ArrowUpDown,
  Tag,
  AlertTriangle,
  Info,
  Calendar,
  Check,
  Zap,
  ChevronDown,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
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
  { id: "7d", label: "Últimos 7 dias", shortLabel: "7 dias", badge: "7D" },
  { id: "30d", label: "Últimos 30 dias", shortLabel: "30 dias", badge: "30D" },
  { id: "90d", label: "Últimos 90 dias", shortLabel: "90 dias", badge: "90D" },
] as const;

export default function AdminDashboardClient() {
  const [period, setPeriod] = useState<AdminDashboardPeriod>("30d");
  const [isPeriodOpen, setIsPeriodOpen] = useState<boolean>(false);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Split sync state
  const [syncingSplits, setSyncingSplits] = useState<boolean>(false);
  const [splitSyncResult, setSplitSyncResult] = useState<{ updated: number; skipped: number; divergence: number; errors: number; total: number; } | null>(null);

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

  // Active period display object
  const activePeriodObj = ADMIN_PERIOD_OPTIONS.find((p) => p.id === period) || ADMIN_PERIOD_OPTIONS[1];

  return (
    <div className="space-y-6 sm:space-y-8 pb-12 text-gray-100 fade-in">
      {/* ==================================================== */}
      {/* 1. HEADER SECTION (Integrado ao fundo, sem caixa card) */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              Dashboard Administrativo
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Super Admin
            </span>
          </div>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">
            Visão estratégica em tempo real de vendas, pagamentos, ecossistema e taxas da plataforma
          </p>
        </div>

        {/* PERIOD SELECTOR (POPOVER PRESETS) & REFRESH */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Period Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsPeriodOpen(!isPeriodOpen)}
              className={`inline-flex items-center justify-between gap-2 bg-[#15171D] hover:bg-[#1C1E26] text-zinc-200 hover:text-white border rounded-xl px-3 py-1.5 text-xs font-medium transition-all cursor-pointer h-9 shadow-xs ${
                isPeriodOpen
                  ? "border-blue-500/80 ring-1 ring-blue-500/30 text-white"
                  : "border-white/[0.08] hover:border-zinc-700"
              }`}
              aria-haspopup="dialog"
              aria-expanded={isPeriodOpen}
            >
              <div className="flex items-center gap-2 truncate">
                <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="font-semibold text-white truncate">
                  {activePeriodObj.label}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform shrink-0 ${isPeriodOpen ? "rotate-180 text-blue-400" : ""}`} />
            </button>

            {/* Backdrop for mobile */}
            {isPeriodOpen && (
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-xs sm:hidden z-40"
                onClick={() => setIsPeriodOpen(false)}
              />
            )}

            {/* Popover panel */}
            {isPeriodOpen && (
              <div className="fixed inset-x-4 top-24 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 z-50 w-auto sm:w-[320px] bg-[#090A0D] border border-white/[0.08] rounded-2xl shadow-2xl p-4 space-y-3 animate-in fade-in-0 zoom-in-95">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                  <div className="flex items-center gap-1.5 text-[#F3F4F6] font-semibold text-xs">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <span>Período de análise</span>
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

                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">
                    Intervalos Rápidos
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {ADMIN_PERIOD_OPTIONS.map((p) => {
                      const isSelected = period === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setPeriod(p.id);
                            setIsPeriodOpen(false);
                          }}
                          className={`px-2 py-2 rounded-xl text-xs font-medium transition-all text-left flex flex-col justify-between h-[52px] border cursor-pointer ${
                            isSelected
                              ? "bg-[#15171D] text-white border-blue-500/80 shadow-xs font-semibold ring-1 ring-blue-500/20"
                              : "bg-[#15171D] text-zinc-300 hover:text-white hover:bg-[#1C1E26] border-white/[0.08]"
                          }`}
                        >
                          <span className="truncate leading-tight text-[11px]">{p.shortLabel}</span>
                          <div className="flex items-center justify-between w-full pt-1">
                            <span className={`text-[9px] font-mono px-1 rounded ${isSelected ? 'bg-blue-500/20 text-blue-300' : 'bg-[#090A0D] text-zinc-400'}`}>
                              {p.badge}
                            </span>
                            {isSelected && <Check className="w-3 h-3 text-blue-400 shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchDashboardStats(period, true)}
              disabled={refreshing || loading}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#15171D] hover:bg-white/5 border border-white/[0.08] text-gray-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 h-9"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-blue-400" : ""}`} />
              <span>Atualizar</span>
            </button>

            {data?.updatedAt && (
              <span className="text-[11px] text-zinc-400 font-mono hidden sm:flex items-center gap-1">
                <Clock className="w-3 h-3 text-zinc-400" />
                {data.updatedAt}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ERROR BANNER */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => fetchDashboardStats(period)}
            className="text-xs font-bold underline hover:text-white cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. PRIMARY INDICATORS (8 COMPACT CARDS) */}
      {/* ==================================================== */}
      <div>
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center justify-between">
          <span>Indicadores Principais da Plataforma ({data?.periodLabel || activePeriodObj.label})</span>
          <span className="text-[10px] text-gray-500 normal-case font-mono">Fuso: America/Recife (UTC-3)</span>
        </div>

        {loading && !data ? (
          <KPISkeletonGrid />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. Vendedores (Base total + novos no período selecionado) */}
            <KPICard
              title="Total Vendedores"
              value={data?.kpis.sellers.total.toLocaleString("pt-BR") || "0"}
              periodCount={data?.kpis.sellers.current}
              changePercent={data?.kpis.sellers.changePercent}
              icon={Users}
              accent="blue"
              hint="Lojistas cadastrados na plataforma"
            />

            {/* 2. Lojas (Base total + novas no período selecionado) */}
            <KPICard
              title="Total Lojas"
              value={data?.kpis.stores.total.toLocaleString("pt-BR") || "0"}
              periodCount={data?.kpis.stores.current}
              changePercent={data?.kpis.stores.changePercent}
              icon={Store}
              accent="purple"
              hint="Lojas criadas e configuradas"
            />

            {/* 3. Bots Conectados (Base total + novos no período selecionado) */}
            <KPICard
              title="Bots Conectados"
              value={data?.kpis.bots.total.toLocaleString("pt-BR") || "0"}
              periodCount={data?.kpis.bots.current}
              changePercent={data?.kpis.bots.changePercent}
              icon={Bot}
              accent="blue"
              hint="Bots do Telegram com status ativo"
            />

            {/* 4. Produtos (Base total + novos no período selecionado) */}
            <KPICard
              title="Total Produtos"
              value={data?.kpis.products.total.toLocaleString("pt-BR") || "0"}
              periodCount={data?.kpis.products.current}
              changePercent={data?.kpis.products.changePercent}
              icon={Package}
              accent="zinc"
              hint="Produtos ativos no catálogo global"
            />

            {/* 5. Clientes Telegram (Base total + novos no período selecionado) */}
            <KPICard
              title="Clientes Telegram"
              value={data?.kpis.telegramCustomers.total.toLocaleString("pt-BR") || "0"}
              periodCount={data?.kpis.telegramCustomers.current}
              changePercent={data?.kpis.telegramCustomers.changePercent}
              icon={UserCheck}
              accent="blue"
              hint="Compradores únicos via Telegram"
            />

            {/* 6. Pedidos Pagos (Métrica temporal: valor no período + histórico de apoio) */}
            <KPICard
              title="Pedidos Pagos"
              value={(data?.kpis.paidOrders.current ?? 0).toLocaleString("pt-BR")}
              historicalTotal={`Total acumulado: ${(data?.kpis.paidOrders.total ?? 0).toLocaleString("pt-BR")}`}
              changePercent={data?.kpis.paidOrders.changePercent}
              icon={ShoppingCart}
              accent="emerald"
              hint="Vendas confirmadas no intervalo"
            />

            {/* 7. GMV Aprovado (Métrica financeira: valor no período + histórico de apoio) */}
            <KPICard
              title="Volume Bruto (GMV)"
              value={formatCurrency(data?.kpis.gmv.current ?? 0)}
              historicalTotal={`Total acumulado: ${formatCurrency(data?.kpis.gmv.total ?? 0)}`}
              changePercent={data?.kpis.gmv.changePercent}
              icon={DollarSign}
              accent="blue"
              isFeatured={true}
              hint="Faturamento bruto no intervalo"
            />

            {/* 8. Taxas Efetivamente Processadas (Métrica financeira: valor no período + histórico de apoio) */}
            <KPICard
              title="Taxas Processadas"
              value={formatCurrency(data?.kpis.processedFees.current ?? 0)}
              historicalTotal={`Total acumulado: ${formatCurrency(data?.kpis.processedFees.total ?? 0)}`}
              changePercent={data?.kpis.processedFees.changePercent}
              icon={Coins}
              accent="emerald"
              hint="Taxas da plataforma no intervalo"
            />
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 3. VENDAS E PAGAMENTOS (DESEMPENHO COMERCIAL) */}
      {/* ==================================================== */}
      <div className="bg-[#0F1014] p-5 sm:p-6 rounded-2xl border border-white/[0.08] shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              Desempenho Comercial & Pagamentos
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Métricas reais de checkout, conversão Pix e evolução temporal no período
            </p>
          </div>

          {/* Chart View Selector */}
          <div className="flex items-center bg-[#15171D] p-1 rounded-xl border border-white/[0.08] text-xs">
            <button
              onClick={() => setChartView("gmv")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                chartView === "gmv" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Volume (GMV)
            </button>
            <button
              onClick={() => setChartView("orders")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                chartView === "orders" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Pedidos Pagos
            </button>
            <button
              onClick={() => setChartView("pix")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                chartView === "pix" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Pix Gerado vs Pago
            </button>
          </div>
        </div>

        {/* 4 Mini Performance Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#15171D] p-4 rounded-xl border border-white/[0.08]">
            <span className="text-[11px] text-gray-400 uppercase font-semibold block">Pix Gerados</span>
            <span className="text-xl font-black text-white mt-1 block font-mono tabular-nums">
              {data?.salesAndPayments.pixGeneratedCount.toLocaleString("pt-BR") || "0"}
            </span>
            <span className="text-[10px] text-gray-500 mt-0.5 block">Cobranças Pix emitidas</span>
          </div>

          <div className="bg-[#15171D] p-4 rounded-xl border border-white/[0.08]">
            <span className="text-[11px] text-gray-400 uppercase font-semibold block">Pix Pagos</span>
            <span className="text-xl font-black text-emerald-400 mt-1 block font-mono tabular-nums">
              {data?.salesAndPayments.pixPaidCount.toLocaleString("pt-BR") || "0"}
            </span>
            <span className="text-[10px] text-gray-500 mt-0.5 block">Pagamentos confirmados</span>
          </div>

          <div className="bg-[#15171D] p-4 rounded-xl border border-white/[0.08]">
            <span className="text-[11px] text-gray-400 uppercase font-semibold block">Conversão Pix</span>
            <span className="text-xl font-black text-blue-400 mt-1 block font-mono tabular-nums">
              {data?.salesAndPayments.pixConversionRate !== null && data?.salesAndPayments.pixConversionRate !== undefined
                ? `${data.salesAndPayments.pixConversionRate}%`
                : "Sem dados"}
            </span>
            <span className="text-[10px] text-gray-500 mt-0.5 block">(Pix Pagos / Pix Gerados)</span>
          </div>

          <div className="bg-[#15171D] p-4 rounded-xl border border-white/[0.08]">
            <span className="text-[11px] text-gray-400 uppercase font-semibold block">GMV no Período</span>
            <span className="text-xl font-black text-white mt-1 block font-mono tabular-nums">
              {formatCurrency(data?.salesAndPayments.gmvApproved || 0)}
            </span>
            <span className="text-[10px] text-gray-500 mt-0.5 block">
              {data?.salesAndPayments.paidOrdersCount || 0} pedidos aprovados
            </span>
          </div>
        </div>

        {/* Dynamic Chart Container */}
        <div className="h-72 w-full pt-2">
          {loading ? (
            <ChartSkeleton />
          ) : data?.salesAndPayments.dailyEvolution && data.salesAndPayments.dailyEvolution.length > 0 ? (
            <AdminChartsComponent
              type={chartView === "gmv" ? "gmv" : chartView === "orders" ? "orders" : "pix"}
              data={data.salesAndPayments.dailyEvolution}
            />
          ) : (
            <EmptyChartState message="Sem histórico de vendas para o período selecionado." />
          )}
        </div>
      </div>

      {/* ==================================================== */}
      {/* 4. ACOMPANHAMENTO DAS TAXAS DA PLATAFORMA (FASE COMERCIAL) */}
      {/* ==================================================== */}
      <div className="bg-[#0F1014] p-5 sm:p-6 rounded-2xl border border-white/[0.08] shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-400" />
              Taxas da Plataforma & Auditoria de Splits
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Acompanhamento rigoroso das taxas por venda Pix com base no estado real registrado no banco
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 self-start sm:self-auto">
            {formatCurrency(data?.platformFees.processedFeeTotal || 0)} processado no período
          </span>
        </div>

        {/* Breakdown Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Card 1: Previsto Total */}
          <div className="bg-[#15171D] p-4 rounded-xl border border-white/[0.08] space-y-1">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Taxas Previstas (Elegíveis)</span>
              <Info className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <span className="text-xl font-black text-white block">
              {formatCurrency(data?.platformFees.expectedFeeTotal || 0)}
            </span>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Total de comissões calculadas para pedidos pagos no período conforme taxa individual configurada.
            </p>
          </div>

          {/* Card 2: Processado / Aceito */}
          <div className="bg-[#15171D] p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] space-y-1">
            <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Splits Processados / Aceitos
              </span>
              <span className="font-mono text-[11px]">{data?.platformFees.processedCount || 0} pedidos</span>
            </div>
            <span className="text-xl font-black text-emerald-400 block">
              {formatCurrency(data?.platformFees.processedFeeTotal || 0)}
            </span>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Splits aceitos e confirmados com sucesso pelo gateway de pagamentos (`PROCESSED` / `GATEWAY_ACCEPTED`).
            </p>
          </div>

          {/* Card 3: Liquidado em Conta */}
          <div className="bg-[#15171D] p-4 rounded-xl border border-white/[0.08] space-y-1">
            <div className="flex items-center justify-between text-blue-400 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Liquidado em Conta (`SETTLED`)
              </span>
              <span className="font-mono text-[11px]">{data?.platformFees.settledCount || 0} pedidos</span>
            </div>
            <span className="text-xl font-black text-white block">
              {formatCurrency(data?.platformFees.settledFeeTotal || 0)}
            </span>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Valor com liquidação bancária formalizada (`SETTLED`). Caso ainda não haja conciliação externa, exibe R$ 0,00.
            </p>
          </div>

          {/* Card 4: Pendentes */}
          <div className="bg-[#15171D] p-4 rounded-xl border border-white/[0.08] space-y-1">
            <div className="flex items-center justify-between text-amber-400 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Splits Pendentes
              </span>
              <span className="font-mono text-[11px]">{data?.platformFees.pendingCount || 0} pedidos</span>
            </div>
            <span className="text-xl font-black text-amber-400 block">
              {formatCurrency(data?.platformFees.pendingFeeTotal || 0)}
            </span>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Pedidos pagos aguardando processamento do split pelo gateway (`PENDING` ou `REQUESTED`).
            </p>
            {/* Reconcile button */}
            <button
              type="button"
              onClick={handleSyncSplits}
              disabled={syncingSplits || loading}
              className="mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {syncingSplits ? (
                <><RefreshCw className="w-3 h-3 animate-spin" /> Sincronizando...</>
              ) : (
                <><Zap className="w-3 h-3" /> Reconciliar Agora</>
              )}
            </button>
            {splitSyncResult && (
              <p className="text-[10px] text-emerald-400 mt-1 font-mono">
                ✓ {splitSyncResult.updated} atualizado(s) · {splitSyncResult.skipped} sem mudança · {splitSyncResult.divergence} divergência · {splitSyncResult.errors} erro(s)
              </p>
            )}
          </div>

          {/* Card 5: Isenções Intencionais (SKIPPED) */}
          <div className="bg-[#15171D] p-4 rounded-xl border border-white/[0.08] space-y-1">
            <div className="flex items-center justify-between text-gray-300 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-400" />
                Isenções & Ignorados (`SKIPPED`)
              </span>
              <span className="font-mono text-[11px]">{data?.platformFees.skippedCount || 0} pedidos</span>
            </div>
            <span className="text-xl font-black text-gray-200 block">
              {formatCurrency(data?.platformFees.skippedFeeTotal || 0)}
            </span>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Isenções temporárias ativas ou taxa zero intencional. <strong>Não é falha financeira</strong>.
            </p>
          </div>

          {/* Card 6: Splits com Falha (FAILED) */}
          <div className="bg-[#15171D] p-4 rounded-xl border border-red-500/20 bg-red-500/[0.03] space-y-1">
            <div className="flex items-center justify-between text-red-400 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Splits com Falha (`FAILED`)
              </span>
              <span className="font-mono text-[11px]">{data?.platformFees.failedCount || 0} pedidos</span>
            </div>
            <span className="text-xl font-black text-red-400 block">
              {formatCurrency(data?.platformFees.failedFeeTotal || 0)}
            </span>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Splits rejeitados ou que apresentaram erro de comunicação com a PushinPay.
            </p>
          </div>
        </div>

        {/* Audit Footnote */}
        <div className="p-3.5 bg-[#15171D] rounded-xl border border-white/[0.08] text-[11px] text-gray-400 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p>
            <strong>Regra de Auditoria Histórica:</strong> As métricas acima utilizam exclusivamente os snapshots de taxa
            gravados no momento da criação da cobrança (`splitAmountCents` e `splitStatus`). Configurações recentes de taxa
            não alteram o passado retroativamente.
          </p>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 5. RANKING DE VENDEDORES (PRINCIPAIS VENDEDORES) */}
      {/* ==================================================== */}
      <div className="bg-[#0F1014] p-5 sm:p-6 rounded-2xl border border-white/[0.08] shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              Principais Vendedores
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Desempenho por vendedor e lojas vinculadas no período ({data?.periodLabel || "Últimos 30 dias"})
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#15171D] p-1 rounded-xl border border-white/[0.08] text-xs">
            <span className="text-gray-400 px-2 text-[11px]">Ordenar por:</span>
            <button
              onClick={() => setRankingSort("gmv")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                rankingSort === "gmv" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Maior GMV
            </button>
            <button
              onClick={() => setRankingSort("orders")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                rankingSort === "orders" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Mais Pedidos
            </button>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-gray-400 text-[11px] font-semibold uppercase tracking-wider">
                <th className="pb-3 px-3">#</th>
                <th className="pb-3 px-3">Vendedor</th>
                <th className="pb-3 px-3">Loja Vinculada</th>
                <th className="pb-3 px-3 text-right">Pedidos Pagos</th>
                <th className="pb-3 px-3 text-right">GMV Aprovado</th>
                <th className="pb-3 px-3 text-right">Taxas Processadas</th>
                <th className="pb-3 px-3 text-right">Taxas Previstas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {sortedRanking.map((s, idx) => (
                <tr key={s.sellerId} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3 text-gray-500 font-mono text-[11px]">#{idx + 1}</td>
                  <td className="py-3 px-3">
                    <div>
                      <p className="font-bold text-white text-xs">{s.sellerName}</p>
                      <span className="text-[10px] text-gray-500">{s.sellerEmail}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    {s.storeName ? (
                      <div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-200">
                          <Store className="w-3 h-3 text-blue-400" />
                          {s.storeName}
                        </span>
                        {s.storeSlug && (
                          <span className="text-[10px] text-gray-500 block font-mono">/{s.storeSlug}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-500 italic">Sem loja</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-gray-200">
                    {s.paidOrdersCount.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-3 px-3 text-right font-black text-white">
                    {formatCurrency(s.approvedGmv)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-400">
                    {formatCurrency(s.processedFees)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[11px] text-gray-400">
                    {formatCurrency(s.totalFeesExpected)}
                  </td>
                </tr>
              ))}

              {sortedRanking.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-500 text-xs">
                    Nenhum pedido pago encontrado para os vendedores no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 6. ECOSSISTEMA TELEGRAM & NOTA DE ATRIBUIÇÃO */}
      {/* ==================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Telegram Stats */}
        <div className="bg-[#0F1014] p-5 sm:p-6 rounded-2xl border border-white/[0.08] shadow-2xl space-y-4">
          <div className="border-b border-white/[0.08] pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-400" />
              Ecossistema Telegram
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Bots conectados e telemetria de clientes</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-[#15171D] rounded-xl border border-white/[0.08]">
              <span className="text-gray-400">Bots Conectados Ativos:</span>
              <span className="font-black text-white text-sm">{data?.telegramStats.activeBots || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#15171D] rounded-xl border border-white/[0.08]">
              <span className="text-gray-400">Total de Clientes Registrados:</span>
              <span className="font-black text-white text-sm">
                {data?.telegramStats.totalCustomers.toLocaleString("pt-BR") || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#15171D] rounded-xl border border-white/[0.08]">
              <span className="text-gray-400">Novos Clientes no Período:</span>
              <span className="font-bold text-blue-400 text-sm">
                +{data?.telegramStats.newCustomersPeriod.toLocaleString("pt-BR") || 0}
              </span>
            </div>
          </div>

          <div className="p-3 bg-purple-500/5 rounded-xl border border-purple-500/20 text-[11px] text-gray-400 leading-relaxed">
            {data?.telegramStats.attributionNote}
          </div>
        </div>

        {/* Recent Paid Sales */}
        <div className="lg:col-span-2 bg-[#0F1014] p-5 sm:p-6 rounded-2xl border border-white/[0.08] shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-400" />
                Últimos Pedidos Aprovados
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Transações pagas mais recentes na plataforma</p>
            </div>
            <span className="text-[11px] font-mono text-gray-500">Últimos 10</span>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-gray-400 text-[10px] font-semibold uppercase tracking-wider">
                  <th className="pb-2.5 px-2">Cliente</th>
                  <th className="pb-2.5 px-2">Loja / Vendedor</th>
                  <th className="pb-2.5 px-2">Total</th>
                  <th className="pb-2.5 px-2">Split</th>
                  <th className="pb-2.5 px-2 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {(data?.recentSales || []).map((sale) => (
                  <tr key={sale.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-2 font-medium text-gray-200 truncate max-w-[120px]">
                      {sale.customerName}
                    </td>
                    <td className="py-2.5 px-2 text-[11px]">
                      <span className="text-gray-300 font-semibold">{sale.storeName}</span>
                      <span className="text-[10px] text-gray-500 block">por {sale.sellerName}</span>
                    </td>
                    <td className="py-2.5 px-2 font-black text-white font-mono tabular-nums">{formatCurrency(sale.total)}</td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          sale.splitStatus === "PROCESSED" || sale.splitStatus === "GATEWAY_ACCEPTED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : sale.splitStatus === "SKIPPED"
                            ? "bg-white/5 text-gray-400 border border-white/[0.08]"
                            : sale.splitStatus === "FAILED"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {sale.splitStatus || "PENDING"}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right text-[10px] text-gray-400 font-mono">
                      {new Date(sale.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}

                {(data?.recentSales || []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-500 text-xs">
                      Nenhum pedido pago registrado recentemente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ====================================================
// REUSABLE COMPONENTS
// ====================================================

interface KPICardProps {
  title: string;
  value: string;
  periodCount?: number;
  periodValue?: string;
  historicalTotal?: string;
  changePercent?: number | null;
  icon: any;
  accent: "blue" | "emerald" | "purple" | "zinc";
  isFeatured?: boolean;
  hint?: string;
}

function KPICard({
  title,
  value,
  periodCount,
  periodValue,
  historicalTotal,
  changePercent,
  icon: Icon,
  accent,
  isFeatured = false,
  hint,
}: KPICardProps) {
  const accentStyles = {
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    zinc: "bg-white/5 border-white/[0.08] text-gray-300",
  };

  return (
    <div
      className={`p-4 rounded-2xl border transition-all duration-200 ${
        isFeatured
          ? "bg-[#0F1014] border-blue-500/30 shadow-lg shadow-blue-500/5"
          : "bg-[#0F1014] border-white/[0.08]"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider truncate">
          {title}
        </span>
        <div className={`p-2 rounded-xl border ${accentStyles[accent]} shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-xl sm:text-2xl font-black text-white tracking-tight block font-mono tabular-nums">
          {value}
        </span>

        {historicalTotal && (
          <span className="text-[10px] font-mono text-zinc-400 block truncate">
            {historicalTotal}
          </span>
        )}

        {/* Period count / value badge & variation */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {periodCount !== undefined && (
            <span className="text-[10px] font-mono text-gray-400">
              +{periodCount.toLocaleString("pt-BR")} no período
            </span>
          )}
          {periodValue !== undefined && (
            <span className="text-[10px] font-mono text-gray-400">{periodValue} no período</span>
          )}

          {/* Genuine variation badge (only when meaningful and calculated) */}
          {changePercent !== null && changePercent !== undefined && (
            <span
              className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded ${
                changePercent > 0
                  ? "text-emerald-400 bg-emerald-500/10"
                  : changePercent < 0
                  ? "text-red-400 bg-red-500/10"
                  : "text-gray-400 bg-white/5"
              }`}
            >
              {changePercent > 0 ? (
                <TrendingUp className="w-2.5 h-2.5" />
              ) : changePercent < 0 ? (
                <TrendingDown className="w-2.5 h-2.5" />
              ) : null}
              {changePercent > 0 ? `+${changePercent}%` : `${changePercent}%`}
            </span>
          )}
        </div>

        {hint && <span className="text-[10px] text-zinc-400 block truncate pt-0.5">{hint}</span>}
      </div>
    </div>
  );
}

function KPISkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-28 bg-[#0F1014] rounded-2xl border border-white/[0.08] p-4 space-y-3">
          <div className="h-3 w-20 bg-white/5 rounded" />
          <div className="h-6 w-28 bg-white/10 rounded" />
          <div className="h-2 w-16 bg-white/5 rounded" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-white/[0.01] rounded-xl border border-white/[0.04] animate-pulse">
      <div className="flex items-center gap-2 text-gray-500 text-xs font-mono">
        <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
        <span>Carregando série temporal...</span>
      </div>
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-white/[0.01] rounded-xl border border-white/[0.04] text-center p-4">
      <Calendar className="w-6 h-6 text-gray-600 mb-2" />
      <p className="text-xs text-gray-400 font-medium">{message}</p>
      <span className="text-[10px] text-gray-600 mt-0.5">
        Selecione outro período ou aguarde novos eventos de vendas.
      </span>
    </div>
  );
}
