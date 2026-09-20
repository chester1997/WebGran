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
  Layers, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  ChevronRight, 
  Bot, 
  Globe, 
  Sparkles,
  ArrowUpRight,
  RefreshCw,
  BarChart3,
  Calendar,
  Activity,
  Tag
} from "lucide-react";
import { StoreAnalyticsData } from "@/lib/analytics/analytics-service";
import { getDashboardAnalyticsAction } from "./actions";

interface DashboardClientProps {
  initialData: StoreAnalyticsData;
}

export function DashboardClient({ initialData }: DashboardClientProps) {
  const [data, setData] = useState<StoreAnalyticsData>(initialData);
  const [period, setPeriod] = useState<string>(initialData.period || "30D");
  const [chartMetric, setChartMetric] = useState<"revenue" | "sales">("revenue");
  const [topProductsPeriod, setTopProductsPeriod] = useState<string>("30D");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [hoveredPoint, setHoveredPoint] = useState<{
    dateLabel: string;
    revenue: number;
    salesCount: number;
    x: number;
    y: number;
  } | null>(null);

  const [hoveredHour, setHoveredHour] = useState<{
    hourLabel: string;
    salesCount: number;
    revenue: number;
  } | null>(null);

  const handlePeriodChange = (newPeriod: string) => {
    if (newPeriod === period && !errorMsg) return;
    setPeriod(newPeriod);
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const res = await getDashboardAnalyticsAction(newPeriod);
        setData(res);
      } catch (err: any) {
        setErrorMsg(err.message || "Não foi possível carregar este indicador.");
      }
    });
  };

  const periodsList = [
    { key: "TODAY", label: "Hoje" },
    { key: "7D", label: "7 dias" },
    { key: "30D", label: "30 dias" },
    { key: "90D", label: "90 dias" },
    { key: "12M", label: "12 meses" },
    { key: "ALL", label: "Tudo" },
  ];

  // SVG Area Chart calculations
  const series = data.chartSeries || [];
  const maxVal = Math.max(
    ...series.map((s) => (chartMetric === "revenue" ? s.revenue : s.salesCount)),
    1
  );

  const svgWidth = 700;
  const svgHeight = 220;
  const paddingX = 40;
  const paddingY = 30;

  const points = series.map((s, idx) => {
    const x =
      series.length <= 1
        ? svgWidth / 2
        : paddingX + (idx / (series.length - 1)) * (svgWidth - paddingX * 2);
    const val = chartMetric === "revenue" ? s.revenue : s.salesCount;
    const y = svgHeight - paddingY - (val / maxVal) * (svgHeight - paddingY * 2);
    return { x, y, data: s };
  });

  // Construct smooth SVG path for Area Chart
  let areaD = "";
  let lineD = "";

  if (points.length > 0) {
    lineD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const cx = (p1.x + p2.x) / 2;
      lineD += ` C ${cx} ${p1.y}, ${cx} ${p2.y}, ${p2.x} ${p2.y}`;
    }
    const lastP = points[points.length - 1];
    const firstP = points[0];
    areaD = `${lineD} L ${lastP.x} ${svgHeight - paddingY} L ${firstP.x} ${svgHeight - paddingY} Z`;
  }

  return (
    <div className="space-y-6 fade-in w-full pb-16">
      {/* 1. Header & Period Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Olá, {data.storeName} <span className="animate-pulse">👋</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-0.5">
            Acompanhe o desempenho da sua loja e indicadores em tempo real.
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="bg-[#121216] p-1.5 rounded-2xl border border-white/10 flex items-center gap-1 overflow-x-auto custom-scrollbar shrink-0">
          {periodsList.map((p) => {
            const isActive = period === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => handlePeriodChange(p.key)}
                disabled={isPending}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Retry Banner */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-950/80 border border-red-500/30 text-red-200 text-xs flex items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => handlePeriodChange(period)}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin-reverse" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* 2. Main KPI Cards (4 Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Faturamento */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-white/10 transition-all">
          {isPending ? (
            <SkeletonKpi />
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Faturamento</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {data.kpis.revenue.formatted}
                </h3>
                <div className="flex items-center gap-2 pt-1">
                  <TrendBadge 
                    percent={data.kpis.revenue.changePercent} 
                    trend={data.kpis.revenue.trend} 
                  />
                  <span className="text-[11px] text-zinc-500 truncate">
                    {data.kpis.revenue.subtitle}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* KPI 2: Vendas */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-white/10 transition-all">
          {isPending ? (
            <SkeletonKpi />
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Total Vendas</span>
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-4 h-4 text-blue-400" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {data.kpis.salesCount.value} {data.kpis.salesCount.value === 1 ? "venda" : "vendas"}
                </h3>
                <div className="flex items-center gap-2 pt-1">
                  <TrendBadge 
                    percent={data.kpis.salesCount.changePercent} 
                    trend={data.kpis.salesCount.trend} 
                  />
                  <span className="text-[11px] text-zinc-500 truncate">
                    {data.kpis.salesCount.subtitle}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* KPI 3: Clientes */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-white/10 transition-all">
          {isPending ? (
            <SkeletonKpi />
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Clientes</span>
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-indigo-400" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {data.kpis.customersCount.value}
                </h3>
                <div className="flex items-center gap-2 pt-1">
                  <TrendBadge 
                    percent={data.kpis.customersCount.changePercent} 
                    trend={data.kpis.customersCount.trend} 
                  />
                  <span className="text-[11px] text-zinc-500 truncate">
                    {data.kpis.customersCount.subtitle}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* KPI 4: Ticket Médio */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-white/10 transition-all">
          {isPending ? (
            <SkeletonKpi />
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Ticket Médio</span>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4 text-amber-400" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {data.kpis.averageTicket.formatted}
                </h3>
                <div className="flex items-center gap-2 pt-1">
                  <TrendBadge 
                    percent={data.kpis.averageTicket.changePercent} 
                    trend={data.kpis.averageTicket.trend} 
                  />
                  <span className="text-[11px] text-zinc-500 truncate">
                    {data.kpis.averageTicket.subtitle}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 3. Main Chart & Channels Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Evolution SVG Area Chart (2 Cols) */}
        <div className="lg:col-span-2 bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Evolução das Vendas</h3>
                <p className="text-[11px] text-zinc-500">Desempenho ao longo do tempo</p>
              </div>
            </div>

            {/* Metric Switcher */}
            <div className="bg-[#181820] p-1 rounded-xl border border-white/5 flex items-center gap-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setChartMetric("revenue")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  chartMetric === "revenue"
                    ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Faturamento (R$)
              </button>
              <button
                type="button"
                onClick={() => setChartMetric("sales")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  chartMetric === "sales"
                    ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Qtd Vendas
              </button>
            </div>
          </div>

          {/* Chart SVG Rendering or Empty State */}
          {isPending ? (
            <div className="h-56 bg-white/[0.02] rounded-xl animate-pulse flex items-center justify-center text-zinc-600 text-xs">
              Carregando gráfico...
            </div>
          ) : !data.hasSales && series.every((s) => s.revenue === 0 && s.salesCount === 0) ? (
            <div className="h-56 flex flex-col items-center justify-center p-6 text-center bg-[#181820]/40 rounded-xl border border-white/5">
              <BarChart3 className="w-10 h-10 text-zinc-600 mb-2 opacity-50" />
              <p className="text-zinc-400 text-xs font-semibold">Nenhuma venda registrada no período selecionado</p>
              <p className="text-zinc-600 text-[11px] mt-1 max-w-xs">
                Quando sua loja receber novos pedidos, a curva de evolução aparecerá aqui automaticamente.
              </p>
            </div>
          ) : (
            <div className="relative w-full overflow-hidden">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="#FFFFFF" strokeOpacity="0.05" strokeDasharray="4 4" />
                <line x1={paddingX} y1={(svgHeight - paddingY * 2) / 2 + paddingY} x2={svgWidth - paddingX} y2={(svgHeight - paddingY * 2) / 2 + paddingY} stroke="#FFFFFF" strokeOpacity="0.05" strokeDasharray="4 4" />
                <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke="#FFFFFF" strokeOpacity="0.1" />

                {/* Area & Line Paths */}
                {areaD && <path d={areaD} fill="url(#chartGradient)" />}
                {lineD && <path d={lineD} fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" />}

                {/* Data Nodes */}
                {points.map((pt, idx) => (
                  <g key={idx} className="group cursor-pointer">
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="4"
                      className="fill-red-500 stroke-[#121214] stroke-2 transition-all group-hover:r-6 group-hover:stroke-white"
                      onMouseEnter={() => setHoveredPoint({
                        dateLabel: pt.data.fullDate,
                        revenue: pt.data.revenue,
                        salesCount: pt.data.salesCount,
                        x: pt.x,
                        y: pt.y
                      })}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  </g>
                ))}
              </svg>

              {/* X Axis Labels */}
              <div className="flex justify-between px-4 pt-2 text-[10px] text-zinc-500 font-mono">
                {series.length <= 8
                  ? series.map((s, idx) => <span key={idx}>{s.dateLabel}</span>)
                  : [series[0], series[Math.floor(series.length / 2)], series[series.length - 1]].map((s, idx) => (
                      <span key={idx}>{s?.dateLabel}</span>
                    ))}
              </div>

              {/* Hover Tooltip Overlay */}
              {hoveredPoint && (
                <div
                  className="absolute bg-[#1C1C22] border border-red-500/30 text-white p-2.5 rounded-xl shadow-2xl text-xs z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 animate-in fade-in duration-150"
                  style={{
                    left: `${(hoveredPoint.x / svgWidth) * 100}%`,
                    top: `${(hoveredPoint.y / svgHeight) * 100}%`
                  }}
                >
                  <p className="font-bold text-zinc-300 border-b border-white/10 pb-1 mb-1 text-[11px]">
                    {hoveredPoint.dateLabel}
                  </p>
                  <p className="text-emerald-400 font-semibold">
                    Faturamento: R$ {hoveredPoint.revenue.toFixed(2).replace(".", ",")}
                  </p>
                  <p className="text-blue-400 text-[11px]">
                    Vendas: {hoveredPoint.salesCount} {hoveredPoint.salesCount === 1 ? "pedido" : "pedidos"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Channels Breakdown Card (1 Col) */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Vendas por Canal</h3>
                <p className="text-[11px] text-zinc-500">Origem do faturamento</p>
              </div>
            </div>

            {isPending ? (
              <div className="space-y-3 py-4">
                <div className="h-10 bg-white/5 rounded-xl animate-pulse" />
                <div className="h-10 bg-white/5 rounded-xl animate-pulse" />
              </div>
            ) : data.channels.length === 0 ? (
              <p className="text-zinc-500 text-xs py-8 text-center">Nenhuma informação de canal disponível.</p>
            ) : (
              <div className="space-y-4 py-2">
                {data.channels.map((chan) => (
                  <div key={chan.channel} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white flex items-center gap-2 min-w-0">
                        {chan.photoUrl ? (
                          <img src={chan.photoUrl} className="w-4 h-4 rounded-full object-cover shrink-0 border border-white/10" alt="" />
                        ) : chan.channel !== "web" ? (
                          <Bot className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        ) : (
                          <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        <span className="truncate">{chan.label}</span>
                      </span>
                      <span className="font-mono text-zinc-400 shrink-0 ml-2">{chan.percentage}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2.5 bg-[#181820] rounded-full overflow-hidden border border-white/5 relative">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          chan.channel === "web" ? "bg-emerald-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${Math.max(chan.percentage, 4)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-0.5">
                      <span>{chan.salesCount} {chan.salesCount === 1 ? "venda" : "vendas"}</span>
                      <span className="font-semibold text-zinc-300">R$ {chan.revenue.toFixed(2).replace(".", ",")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/5 text-[11px] text-zinc-500 flex items-center justify-between">
            <span>Canal predominante</span>
            <span className="font-bold text-white uppercase">
              {data.channels[0]?.label || "Nenhum"}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Top Products & Recent Sales Grid (2 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">Produtos Mais Vendidos</h3>
            </div>
          </div>

          {isPending ? (
            <div className="space-y-2 py-4">
              <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
              <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
            </div>
          ) : data.topProducts.length === 0 ? (
            <div className="py-12 text-center bg-[#181820]/50 rounded-xl border border-white/5">
              <ShoppingBag className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-50" />
              <p className="text-zinc-400 text-xs font-semibold">Nenhum produto vendido ainda neste período.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.topProducts.map((prod, idx) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#181820] border border-white/5 transition-all hover:border-white/10"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Rank Badge */}
                    <span className="text-base shrink-0 select-none">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}º`}
                    </span>

                    {/* Product Cover */}
                    {prod.coverUrl ? (
                      <img
                        src={prod.coverUrl}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover bg-zinc-800 shrink-0 border border-white/10"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0 text-zinc-500 text-[10px]">
                        Sem foto
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{prod.title}</p>
                      <p className="text-[11px] text-zinc-500">
                        {prod.salesCount} {prod.salesCount === 1 ? "unidade vendida" : "unidades vendidas"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-3">
                    <p className="text-xs font-extrabold text-emerald-400">
                      R$ {prod.revenue.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sales History */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">Últimas Vendas</h3>
            </div>

            <Link
              href="/seller/orders"
              className="text-xs font-semibold text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
            >
              <span>Ver todas</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isPending ? (
            <div className="space-y-2 py-4">
              <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
              <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
            </div>
          ) : data.recentOrders.length === 0 ? (
            <div className="py-12 text-center bg-[#181820]/50 rounded-xl border border-white/5">
              <CheckCircle2 className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-50" />
              <p className="text-zinc-400 text-xs font-semibold">O histórico de vendas está vazio.</p>
              <p className="text-zinc-600 text-[11px] mt-1">Quando os clientes comprarem via PIX/Cartão, os pedidos aparecerão em tempo real.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
              {data.recentOrders.map((ord) => (
                <Link
                  key={ord.id}
                  href={`/seller/orders`}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#181820] border border-white/5 hover:border-white/10 transition-all group"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white truncate">{ord.productTitle}</p>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                          ord.status === "paid"
                            ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/30"
                            : "bg-amber-950/80 text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {ord.status === "paid" ? "Pago" : "Pendente"}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {ord.customerName} • <span className="text-zinc-500">{ord.timeAgo}</span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs font-extrabold text-emerald-400">
                      R$ {ord.total.toFixed(2).replace(".", ",")}
                    </p>
                    <p className="text-[10px] text-zinc-500 uppercase">{ord.paymentMethod}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Store Activity & Catalog Overview (2 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atividade da Loja (Real-time Health Indicators) */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="text-base font-bold text-white tracking-tight">Atividade da Loja</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-[#181820] border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Vendas hoje</span>
              </div>
              <span className="font-extrabold text-sm text-white">{data.activity.salesToday}</span>
            </div>

            <div className="p-3 rounded-xl bg-[#181820] border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Novos clientes</span>
              </div>
              <span className="font-extrabold text-sm text-white">{data.activity.newCustomersPeriod}</span>
            </div>

            <div className="p-3 rounded-xl bg-[#181820] border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Acessos liberados</span>
              </div>
              <span className="font-extrabold text-sm text-white">{data.activity.activeAccesses}</span>
            </div>

            <div className="p-3 rounded-xl bg-[#181820] border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>PIX pendentes</span>
              </div>
              <span className="font-extrabold text-sm text-amber-400">{data.activity.pendingPayments}</span>
            </div>
          </div>
        </div>

        {/* Visão do Catálogo */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4 text-blue-400" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">Visão do Catálogo</h3>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/seller/products"
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-lg shadow-red-600/20 inline-flex items-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo produto</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-1 text-center">
            <div className="p-3 rounded-xl bg-[#181820] border border-white/5">
              <span className="block text-lg font-extrabold text-white">{data.catalog.totalProducts}</span>
              <span className="text-[10px] text-zinc-500">Total</span>
            </div>
            <div className="p-3 rounded-xl bg-[#181820] border border-white/5">
              <span className="block text-lg font-extrabold text-emerald-400">{data.catalog.activeProducts}</span>
              <span className="text-[10px] text-zinc-500">Ativos</span>
            </div>
            <div className="p-3 rounded-xl bg-[#181820] border border-white/5">
              <span className="block text-lg font-extrabold text-zinc-400">{data.catalog.inactiveProducts}</span>
              <span className="text-[10px] text-zinc-500">Inativos</span>
            </div>
            <div className="p-3 rounded-xl bg-[#181820] border border-white/5">
              <span className="block text-lg font-extrabold text-indigo-400">{data.catalog.categoriesCount}</span>
              <span className="text-[10px] text-zinc-500">Categorias</span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Hourly Sales Distribution Bar Chart (00h - 23h) */}
      <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Horários de Maior Venda</h3>
            <p className="text-[11px] text-zinc-500">Concentração de pedidos por hora do dia (00:00 às 23:00)</p>
          </div>
        </div>

        {/* 24-Hour Bar Chart */}
        <div className="relative pt-4">
          <div className="h-36 flex items-end gap-1 sm:gap-1.5 w-full">
            {data.hourlySales.map((hItem) => {
              const maxHourSales = Math.max(...data.hourlySales.map((h) => h.salesCount), 1);
              const heightPercent = Math.max((hItem.salesCount / maxHourSales) * 100, 4);

              return (
                <div
                  key={hItem.hour}
                  className="flex-1 flex flex-col items-center group relative h-full justify-end"
                  onMouseEnter={() => setHoveredHour(hItem)}
                  onMouseLeave={() => setHoveredHour(null)}
                >
                  {/* Bar */}
                  <div
                    className={`w-full rounded-t transition-all duration-300 ${
                      hItem.salesCount > 0
                        ? "bg-amber-500 group-hover:bg-amber-400 shadow-md shadow-amber-500/20"
                        : "bg-white/5 group-hover:bg-white/10"
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Hour Labels */}
          <div className="flex justify-between pt-2 text-[9px] text-zinc-500 font-mono">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>

          {/* Tooltip for Hourly Bar Hover */}
          {hoveredHour && (
            <div className="absolute top-0 right-4 bg-[#1C1C22] border border-amber-500/30 text-white p-2 rounded-xl text-xs z-20 shadow-xl">
              <p className="font-bold text-amber-400">{hoveredHour.hourLabel}</p>
              <p className="text-zinc-200">{hoveredHour.salesCount} {hoveredHour.salesCount === 1 ? "venda" : "vendas"}</p>
              <p className="text-emerald-400 font-mono text-[11px]">R$ {hoveredHour.revenue.toFixed(2).replace(".", ",")}</p>
            </div>
          )}
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
        Sem dados comparativos
      </span>
    );
  }

  if (trend === "up") {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
        <TrendingUp className="w-3 h-3" />
        ↑ {percent}%
      </span>
    );
  }

  if (trend === "down") {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 inline-flex items-center gap-1">
        <TrendingDown className="w-3 h-3" />
        ↓ {percent}%
      </span>
    );
  }

  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-white/10 inline-flex items-center gap-1">
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
        <div className="w-8 h-8 bg-white/10 rounded-xl" />
      </div>
      <div className="h-7 bg-white/10 rounded w-28" />
      <div className="h-3 bg-white/10 rounded w-32" />
    </div>
  );
}
