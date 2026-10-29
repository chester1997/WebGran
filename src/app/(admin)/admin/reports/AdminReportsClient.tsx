"use client";

import { useState, useTransition } from "react";
import {
  BarChart3,
  Users,
  Package,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Percent,
  Receipt,
  Calendar,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpRight,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { AdminReportResponse, ReportFilterParams } from "@/lib/reports/admin-reports-service";

interface AdminReportsClientProps {
  adminUser: any;
  initialData: AdminReportResponse | null;
  initialError?: string | null;
}

export default function AdminReportsClient({
  adminUser,
  initialData,
  initialError,
}: AdminReportsClientProps) {
  const [data, setData] = useState<AdminReportResponse | null>(initialData);
  const [error, setError] = useState<string | null>(initialError || null);
  const [isPending, startTransition] = useTransition();

  // Filters state
  const [selectedSeller, setSelectedSeller] = useState<string>(
    initialData?.filters?.sellerId || "all"
  );
  const [selectedPeriod, setSelectedPeriod] = useState<string>(
    initialData?.filters?.period || "30d"
  );
  const [customStart, setCustomStart] = useState<string>(() => {
    if (initialData?.filters?.startDate) {
      return initialData.filters.startDate.slice(0, 10);
    }
    return new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => {
    if (initialData?.filters?.endDate) {
      return initialData.filters.endDate.slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState<number>(initialData?.orders?.page || 1);

  // Active chart metric tab
  const [chartMetric, setChartMetric] = useState<"gmv" | "sales" | "fees">("gmv");

  const fetchReports = (pageToFetch = 1, periodToUse = selectedPeriod, sellerToUse = selectedSeller) => {
    setError(null);
    startTransition(async () => {
      try {
        const query = new URLSearchParams({
          period: periodToUse,
          sellerId: sellerToUse,
          page: String(pageToFetch),
          pageSize: "20",
        });

        if (periodToUse === "custom") {
          query.set("startDate", customStart);
          query.set("endDate", customEnd);
        }

        const res = await fetch(`/api/admin/reports?${query.toString()}`);
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || "Erro ao carregar dados do relatório.");
        }

        setData(json.data);
        setCurrentPage(pageToFetch);
      } catch (err: any) {
        setError(err.message || "Falha de conexão ao atualizar relatório.");
      }
    });
  };

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    if (period !== "custom") {
      fetchReports(1, period, selectedSeller);
    }
  };

  const handleSellerChange = (sellerId: string) => {
    setSelectedSeller(sellerId);
    fetchReports(1, selectedPeriod, sellerId);
  };

  const handleApplyCustomFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReports(1, "custom", selectedSeller);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || (data && newPage > data.orders.totalPages)) return;
    fetchReports(newPage, selectedPeriod, selectedSeller);
  };

  const kpis = data?.kpis;
  const timeSeries = data?.timeSeries || [];
  const gatewayBreakdown = data?.gatewayBreakdown || [];
  const orderItems = data?.orders?.items || [];
  const availableSellers = data?.availableSellers || [];

  // Filter local orders by search term
  const filteredOrders = orderItems.filter((ord) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      ord.id.toLowerCase().includes(term) ||
      ord.customerName.toLowerCase().includes(term) ||
      (ord.customerUsername && ord.customerUsername.toLowerCase().includes(term)) ||
      ord.storeName.toLowerCase().includes(term) ||
      ord.sellerName.toLowerCase().includes(term)
    );
  });

  // Calculate highest point for chart scaling
  const maxChartValue = Math.max(
    ...timeSeries.map((t) =>
      chartMetric === "gmv" ? t.gmv : chartMetric === "fees" ? t.platformFee : t.salesCount
    ),
    1
  );

  return (
    <div className="space-y-6 pb-12 text-zinc-100 max-w-7xl">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              Relatórios da Plataforma
            </h1>
            <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              BI & Performance
            </span>
          </div>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">
            Métricas de vendas, GMV, taxas da plataforma e detalhamento individual por vendedor ou visão consolidada.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchReports(currentPage)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14141B] border border-white/[0.08] hover:border-white/20 text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            title="Recarregar relatório"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin text-blue-400" : "text-zinc-400"}`} />
            <span>{isPending ? "Atualizando..." : "Recarregar"}</span>
          </button>
        </div>
      </div>

      {/* 2. FILTERS BAR */}
      <div className="p-4 rounded-2xl bg-[#14141B] border border-white/[0.08] shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Seller Filter */}
          <div className="flex items-center gap-2 min-w-[260px]">
            <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
            <select
              value={selectedSeller}
              onChange={(e) => handleSellerChange(e.target.value)}
              className="w-full text-xs font-semibold bg-[#0F0F14] border border-white/[0.08] rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-blue-500/50 cursor-pointer"
            >
              <option value="all">Todos os Vendedores (Plataforma Completa)</option>
              {availableSellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.storeName ? `(${s.storeName})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Period Buttons */}
          <div className="flex items-center gap-1.5 bg-[#0F0F14] p-1 rounded-xl border border-white/[0.06] overflow-x-auto">
            {[
              { id: "7d", label: "7 Dias" },
              { id: "30d", label: "30 Dias" },
              { id: "month", label: "Este Mês" },
              { id: "year", label: "Este Ano" },
              { id: "custom", label: "Personalizado" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePeriodChange(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  selectedPeriod === p.id
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Form (visible only when 'custom') */}
        {selectedPeriod === "custom" && (
          <form
            onSubmit={handleApplyCustomFilter}
            className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">De:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="text-xs bg-[#0F0F14] border border-white/[0.08] rounded-xl px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">Até:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="text-xs bg-[#0F0F14] border border-white/[0.08] rounded-xl px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Aplicar Filtro</span>
            </button>
          </form>
        )}
      </div>

      {/* ERROR ALERT */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. KPIS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* KPI 1: Clientes Únicos */}
        <div className="p-4 rounded-2xl bg-[#14141B] border border-white/[0.08] space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Clientes Únicos</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {kpis ? kpis.uniqueCustomers.toLocaleString("pt-BR") : "0"}
          </div>
          <span className="text-[10px] text-zinc-500 block">Clientes compradores</span>
        </div>

        {/* KPI 2: Produtos Ativos */}
        <div className="p-4 rounded-2xl bg-[#14141B] border border-white/[0.08] space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Produtos Ativos</span>
            <Package className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {kpis ? kpis.activeProducts.toLocaleString("pt-BR") : "0"}
          </div>
          <span className="text-[10px] text-zinc-500 block">Disponíveis na loja</span>
        </div>

        {/* KPI 3: Vendas Aprovadas */}
        <div className="p-4 rounded-2xl bg-[#14141B] border border-white/[0.08] space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Vendas Pagas</span>
            <ShoppingBag className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {kpis ? kpis.approvedSalesCount.toLocaleString("pt-BR") : "0"}
          </div>
          <span className="text-[10px] text-zinc-500 block">Status aprovado</span>
        </div>

        {/* KPI 4: Faturamento Bruto (GMV) */}
        <div className="p-4 rounded-2xl bg-[#14141B] border border-white/[0.08] space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Faturamento (GMV)</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {kpis ? kpis.formattedGmv : "R$ 0,00"}
          </div>
          <span className="text-[10px] text-zinc-500 block">Volume bruto transacionado</span>
        </div>

        {/* KPI 5: Ticket Médio */}
        <div className="p-4 rounded-2xl bg-[#14141B] border border-white/[0.08] space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Ticket Médio</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {kpis ? kpis.formattedAvgTicket : "R$ 0,00"}
          </div>
          <span className="text-[10px] text-zinc-500 block">Média por venda paga</span>
        </div>

        {/* KPI 6: Conversão */}
        <div className="p-4 rounded-2xl bg-[#14141B] border border-white/[0.08] space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Conversão</span>
            <Percent className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {kpis ? kpis.formattedConversionRate : "0%"}
          </div>
          <span className="text-[10px] text-zinc-500 block" title="Pedidos pagos / Total de checkouts gerados">
            Pagas / Checkouts
          </span>
        </div>

        {/* KPI 7: Taxas da Plataforma */}
        <div className="p-4 rounded-2xl bg-[#14141B] border border-blue-500/30 shadow-lg shadow-blue-500/5 space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-blue-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Taxas WebGran</span>
            <Receipt className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {kpis ? kpis.formattedTotalPlatformFees : "R$ 0,00"}
          </div>
          <span className="text-[10px] text-blue-400 font-medium block">Receita retida via split</span>
        </div>
      </div>

      {/* 4. CHARTS & GATEWAY BREAKDOWN SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Time Series Chart (Col-span 2) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#14141B] border border-white/[0.08] shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Evolução ao Longo do Tempo</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {timeSeries.length > 0
                  ? `Série com ${timeSeries.length} intervalo(s) registrados no período`
                  : "Nenhum histórico no período selecionado"}
              </p>
            </div>

            {/* Metric Switcher */}
            <div className="flex items-center gap-1 bg-[#0F0F14] p-1 rounded-xl border border-white/[0.06] self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setChartMetric("gmv")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  chartMetric === "gmv"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                GMV (R$)
              </button>
              <button
                type="button"
                onClick={() => setChartMetric("sales")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  chartMetric === "sales"
                    ? "bg-sky-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Vendas
              </button>
              <button
                type="button"
                onClick={() => setChartMetric("fees")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  chartMetric === "fees"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Taxas (R$)
              </button>
            </div>
          </div>

          {/* Chart Display */}
          {timeSeries.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-zinc-500 text-xs space-y-2">
              <BarChart3 className="w-8 h-8 opacity-40" />
              <span>Sem dados de vendas para exibir no gráfico neste período.</span>
            </div>
          ) : (
            <div className="h-60 pt-6 flex items-end gap-1.5 sm:gap-2 overflow-x-auto pb-2">
              {timeSeries.map((point, idx) => {
                const rawVal =
                  chartMetric === "gmv"
                    ? point.gmv
                    : chartMetric === "fees"
                    ? point.platformFee
                    : point.salesCount;
                const heightPercent = Math.max(8, Math.round((rawVal / maxChartValue) * 100));

                const barColor =
                  chartMetric === "gmv"
                    ? "bg-emerald-500 hover:bg-emerald-400"
                    : chartMetric === "fees"
                    ? "bg-blue-500 hover:bg-blue-400"
                    : "bg-sky-500 hover:bg-sky-400";

                return (
                  <div
                    key={idx}
                    className="flex-1 min-w-[28px] max-w-[48px] flex flex-col items-center gap-2 group relative cursor-pointer"
                  >
                    {/* Tooltip on Hover */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                      <div className="bg-zinc-950 border border-white/20 text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap">
                        <div className="font-semibold text-zinc-300">{point.label}</div>
                        <div className="text-emerald-400 font-bold">
                          GMV: {point.gmv.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </div>
                        <div className="text-sky-300">Vendas: {point.salesCount}</div>
                        <div className="text-blue-300">
                          Taxa: {point.platformFee.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </div>
                      </div>
                      <div className="w-2 h-2 bg-zinc-950 border-r border-b border-white/20 transform rotate-45 -mt-1" />
                    </div>

                    {/* Bar */}
                    <div className="w-full h-44 flex items-end justify-center">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t-md transition-all duration-300 ${barColor}`}
                      />
                    </div>

                    {/* Date Label */}
                    <span className="text-[10px] text-zinc-500 font-mono truncate w-full text-center">
                      {point.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Gateway Breakdown Card */}
        <div className="p-5 rounded-2xl bg-[#14141B] border border-white/[0.08] shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Taxas por Gateway</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Distribuição de receita e volume por provedor
              </p>
            </div>

            {gatewayBreakdown.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs">
                Nenhuma transação registrada por gateway no período.
              </div>
            ) : (
              <div className="space-y-3">
                {gatewayBreakdown.map((gw, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#0F0F14] border border-white/[0.06] space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                        <span className="font-bold text-white">{gw.gatewayLabel}</span>
                      </div>
                      <span className="font-bold text-emerald-400 font-mono">
                        {gw.formattedFeeAmount}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, Math.max(5, gw.percentageOfFees))}%` }}
                        className="h-full bg-blue-500 rounded-full"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span>{gw.salesCount} vendas ({gw.formattedGmv})</span>
                      <span className="font-semibold text-zinc-300">{gw.percentageOfFees}% das taxas</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>As taxas são retidas automaticamente por split ou debitadas de acordo com as regras vigentes no momento da venda.</span>
          </div>
        </div>
      </div>

      {/* 5. DETAILED ORDERS TABLE */}
      <div className="rounded-2xl bg-[#14141B] border border-white/[0.08] shadow-xl overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Detalhamento dos Pedidos</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Lista analítica com data, identificador, comprador, loja, valor e taxa retida
            </p>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por ID, cliente, loja..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-[#0F0F14] border border-white/[0.08] rounded-xl pl-8 pr-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                <th className="py-3 px-3">Data / Pedido</th>
                <th className="py-3 px-3">Cliente</th>
                <th className="py-3 px-3">Loja & Vendedor</th>
                <th className="py-3 px-3">Valor Bruto</th>
                <th className="py-3 px-3">Taxa WebGran</th>
                <th className="py-3 px-3">Gateway</th>
                <th className="py-3 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    Nenhum pedido encontrado para o período e filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Date / ID */}
                    <td className="py-3 px-3 space-y-0.5">
                      <span className="font-mono text-zinc-200 font-semibold block">
                        #{ord.id.slice(0, 8)}
                      </span>
                      <span className="text-[10px] text-zinc-500 block">{ord.formattedDate}</span>
                    </td>

                    {/* Customer */}
                    <td className="py-3 px-3 space-y-0.5">
                      <span className="font-semibold text-white block">{ord.customerName}</span>
                      {ord.customerUsername && (
                        <span className="text-[10px] text-zinc-400 font-mono block">
                          @{ord.customerUsername}
                        </span>
                      )}
                    </td>

                    {/* Store / Seller */}
                    <td className="py-3 px-3 space-y-0.5">
                      <span className="font-semibold text-zinc-200 block">{ord.storeName}</span>
                      <span className="text-[10px] text-zinc-400 block">{ord.sellerName}</span>
                    </td>

                    {/* Total */}
                    <td className="py-3 px-3 font-mono font-bold text-white">
                      {ord.formattedTotal}
                    </td>

                    {/* Platform Fee */}
                    <td className="py-3 px-3 font-mono font-bold text-blue-400">
                      {ord.formattedPlatformFee}
                    </td>

                    {/* Gateway */}
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.06] text-zinc-300 border border-white/[0.08] capitalize">
                        {ord.paymentMethod}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      {ord.status === "paid" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Aprovado
                        </span>
                      ) : ord.status === "pending" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="w-3 h-3" /> Pendente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                          {ord.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {data && data.orders.totalPages > 1 && (
          <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
            <span>
              Mostrando {orderItems.length} de {data.orders.total} pedido(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || isPending}
                className="p-1.5 rounded-lg bg-[#0F0F14] border border-white/[0.08] hover:border-white/20 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono font-semibold text-white">
                {currentPage} / {data.orders.totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= data.orders.totalPages || isPending}
                className="p-1.5 rounded-lg bg-[#0F0F14] border border-white/[0.08] hover:border-white/20 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Próxima página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

