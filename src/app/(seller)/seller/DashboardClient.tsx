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
  Plus, 
  ChevronRight, 
  Bot, 
  Globe, 
  Sparkles,
  RefreshCw,
  BarChart3,
  Activity,
  ArrowUpRight,
  Zap,
  CreditCard,
  Layers,
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
    { key: "7D", label: "7D" },
    { key: "30D", label: "30D" },
    { key: "90D", label: "90D" },
    { key: "12M", label: "12M" },
    { key: "ALL", label: "Tudo" },
  ];

  // SVG Area Chart calculations
  const series = data.chartSeries || [];
  const maxVal = Math.max(
    ...series.map((s) => (chartMetric === "revenue" ? s.revenue : s.salesCount)),
    1
  );

  const svgWidth = 750;
  const svgHeight = 230;
  const paddingX = 45;
  const paddingY = 35;

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
    <div className="space-y-6 sm:space-y-8 fade-in w-full max-w-full overflow-hidden min-w-0 pb-20">
      
      {/* 1. Header & Period Selector (SaaS Premium Header) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#111115] via-[#14141A] to-[#0E0E12] border border-white/[0.07] rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden group">
        {/* Glow backdrop accent */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-red-600/10 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-red-500/5 rounded-full blur-[90px] pointer-events-none" />

        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Painel do Vendedor
            </span>
            {isPending && (
              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin text-red-500" />
                Atualizando...
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            Olá, {data.userName || data.storeName} <span className="animate-bounce inline-block text-xl">👋</span>
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm">
            Acompanhe o desempenho comercial e métricas em tempo real da sua loja.
          </p>
        </div>

        {/* Period Selector Segmented Control */}
        <div className="relative z-10 bg-[#09090C]/90 p-1.5 rounded-2xl border border-white/10 flex items-center gap-1 overflow-x-auto scrollbar-hide shrink-0 max-w-full w-full sm:w-auto shadow-inner">
          {periodsList.map((p) => {
            const isActive = period === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => handlePeriodChange(p.key)}
                disabled={isPending}
                className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-600/30 scale-[1.02]"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.05]"
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
        <div className="p-4 rounded-2xl bg-red-950/80 border border-red-500/30 text-red-200 text-xs flex items-center justify-between gap-3 shadow-xl w-full max-w-full">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => handlePeriodChange(period)}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin-reverse" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* 2. Main KPI Grid (4 High-Impact Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 w-full max-w-full">
        
        {/* KPI 1: Faturamento */}
        <div className="bg-[#111114] border border-white/[0.07] rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300 flex flex-col justify-between min-h-[125px] sm:min-h-[145px]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
          {isPending ? (
            <SkeletonKpi />
          ) : (
            <>
              <div className="flex items-center justify-between relative z-10 mb-2">
                <span className="text-zinc-400 text-[10px] sm:text-xs font-black uppercase tracking-wider truncate">
                  Faturamento
                </span>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/5">
                  <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                </div>
              </div>

              <div className="space-y-1 relative z-10">
                <h3 className="text-lg sm:text-2xl lg:text-3xl font-black text-white tracking-tight truncate">
                  {data.kpis.revenue.formatted}
                </h3>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <TrendBadge 
                    percent={data.kpis.revenue.changePercent} 
                    trend={data.kpis.revenue.trend} 
                  />
                  <span className="hidden sm:inline text-[11px] text-zinc-500 truncate">
                    {data.kpis.revenue.subtitle}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* KPI 2: Total Vendas */}
        <div className="bg-[#111114] border border-white/[0.07] rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300 flex flex-col justify-between min-h-[125px] sm:min-h-[145px]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all" />
          {isPending ? (
            <SkeletonKpi />
          ) : (
            <>
              <div className="flex items-center justify-between relative z-10 mb-2">
                <span className="text-zinc-400 text-[10px] sm:text-xs font-black uppercase tracking-wider truncate">
                  Total Vendas
                </span>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/5 border border-blue-500/20 flex items-center justify-center shrink-0 shadow-md shadow-blue-500/5">
                  <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                </div>
              </div>

              <div className="space-y-1 relative z-10">
                <h3 className="text-lg sm:text-2xl lg:text-3xl font-black text-white tracking-tight truncate">
                  {data.kpis.salesCount.value} <span className="text-xs sm:text-sm font-semibold text-zinc-400">{data.kpis.salesCount.value === 1 ? "venda" : "vendas"}</span>
                </h3>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <TrendBadge 
                    percent={data.kpis.salesCount.changePercent} 
                    trend={data.kpis.salesCount.trend} 
                  />
                  <span className="hidden sm:inline text-[11px] text-zinc-500 truncate">
                    {data.kpis.salesCount.subtitle}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* KPI 3: Clientes */}
        <div className="bg-[#111114] border border-white/[0.07] rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300 flex flex-col justify-between min-h-[125px] sm:min-h-[145px]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all" />
          {isPending ? (
            <SkeletonKpi />
          ) : (
            <>
              <div className="flex items-center justify-between relative z-10 mb-2">
                <span className="text-zinc-400 text-[10px] sm:text-xs font-black uppercase tracking-wider truncate">
                  Clientes
                </span>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/5 border border-indigo-500/20 flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/5">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                </div>
              </div>

              <div className="space-y-1 relative z-10">
                <h3 className="text-lg sm:text-2xl lg:text-3xl font-black text-white tracking-tight truncate">
                  {data.kpis.customersCount.value}
                </h3>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <TrendBadge 
                    percent={data.kpis.customersCount.changePercent} 
                    trend={data.kpis.customersCount.trend} 
                  />
                  <span className="hidden sm:inline text-[11px] text-zinc-500 truncate">
                    {data.kpis.customersCount.subtitle}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* KPI 4: Ticket Médio */}
        <div className="bg-[#111114] border border-white/[0.07] rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300 flex flex-col justify-between min-h-[125px] sm:min-h-[145px]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all" />
          {isPending ? (
            <SkeletonKpi />
          ) : (
            <>
              <div className="flex items-center justify-between relative z-10 mb-2">
                <span className="text-zinc-400 text-[10px] sm:text-xs font-black uppercase tracking-wider truncate">
                  Ticket Médio
                </span>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/5">
                  <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                </div>
              </div>

              <div className="space-y-1 relative z-10">
                <h3 className="text-lg sm:text-2xl lg:text-3xl font-black text-white tracking-tight truncate">
                  {data.kpis.averageTicket.formatted}
                </h3>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <TrendBadge 
                    percent={data.kpis.averageTicket.changePercent} 
                    trend={data.kpis.averageTicket.trend} 
                  />
                  <span className="hidden sm:inline text-[11px] text-zinc-500 truncate">
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
        <div className="lg:col-span-2 bg-[#111114] border border-white/[0.07] rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/5 border border-red-500/20 flex items-center justify-center shrink-0 shadow-md shadow-red-500/10">
                <BarChart3 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Evolução das Vendas</h3>
                <p className="text-xs text-zinc-400">Curva de crescimento no período</p>
              </div>
            </div>

            {/* Metric Switcher */}
            <div className="bg-[#09090C] p-1 rounded-2xl border border-white/10 flex items-center gap-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setChartMetric("revenue")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  chartMetric === "revenue"
                    ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-md shadow-red-600/20"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Faturamento (R$)
              </button>
              <button
                type="button"
                onClick={() => setChartMetric("sales")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  chartMetric === "sales"
                    ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-md shadow-red-600/20"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Qtd Vendas
              </button>
            </div>
          </div>

          {/* Chart SVG Rendering or Empty State */}
          {isPending ? (
            <div className="h-60 bg-white/[0.02] rounded-2xl animate-pulse flex items-center justify-center text-zinc-500 text-xs">
              Carregando gráfico...
            </div>
          ) : !data.hasSales && series.every((s) => s.revenue === 0 && s.salesCount === 0) ? (
            <div className="h-60 flex flex-col items-center justify-center p-6 text-center bg-[#15151A]/40 rounded-2xl border border-white/5 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-white/10 flex items-center justify-center text-zinc-500">
                <BarChart3 className="w-6 h-6 opacity-60" />
              </div>
              <p className="text-zinc-300 text-xs font-bold">Nenhuma venda registrada no período selecionado</p>
              <p className="text-zinc-500 text-[11px] max-w-xs leading-relaxed">
                Quando sua loja receber novos pedidos, a curva de evolução aparecerá aqui em tempo real.
              </p>
            </div>
          ) : (
            <div className="relative w-full max-w-full overflow-hidden">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto max-w-full block overflow-visible">
                <defs>
                  <linearGradient id="chartGradientRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF1E2D" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#FF1E2D" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="#FFFFFF" strokeOpacity="0.05" strokeDasharray="4 4" />
                <line x1={paddingX} y1={(svgHeight - paddingY * 2) / 2 + paddingY} x2={svgWidth - paddingX} y2={(svgHeight - paddingY * 2) / 2 + paddingY} stroke="#FFFFFF" strokeOpacity="0.05" strokeDasharray="4 4" />
                <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke="#FFFFFF" strokeOpacity="0.1" />

                {/* Area & Line Paths */}
                {areaD && <path d={areaD} fill="url(#chartGradientRed)" />}
                {lineD && <path d={lineD} fill="none" stroke="#FF1E2D" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}

                {/* Data Nodes */}
                {points.map((pt, idx) => (
                  <g key={idx} className="group cursor-pointer">
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="4.5"
                      className="fill-[#FF1E2D] stroke-[#111114] stroke-[2.5] transition-all group-hover:r-7 group-hover:stroke-white group-hover:fill-red-400"
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
              <div className="flex justify-between px-4 pt-3 text-[10px] text-zinc-500 font-mono">
                {series.length <= 8
                  ? series.map((s, idx) => <span key={idx}>{s.dateLabel}</span>)
                  : [series[0], series[Math.floor(series.length / 2)], series[series.length - 1]].map((s, idx) => (
                      <span key={idx}>{s?.dateLabel}</span>
                    ))}
              </div>

              {/* Smart Tooltip Overlay */}
              {hoveredPoint && (() => {
                const isTop = (hoveredPoint.y / svgHeight) < 0.45;
                const isRight = (hoveredPoint.x / svgWidth) > 0.8;
                const isLeft = (hoveredPoint.x / svgWidth) < 0.2;

                const posXClass = isRight ? "-translate-x-[90%]" : isLeft ? "-translate-x-[10%]" : "-translate-x-1/2";
                const posYClass = isTop ? "translate-y-3 mt-1" : "-translate-y-full mb-3";

                return (
                  <div
                    className={`absolute bg-[#16161D]/95 backdrop-blur-md border border-red-500/40 text-white p-3 rounded-2xl shadow-2xl text-xs z-30 pointer-events-none transform ${posXClass} ${posYClass} animate-in fade-in duration-150 space-y-1 min-w-[150px]`}
                    style={{
                      left: `${(hoveredPoint.x / svgWidth) * 100}%`,
                      top: `${(hoveredPoint.y / svgHeight) * 100}%`
                    }}
                  >
                    <p className="font-bold text-zinc-300 border-b border-white/10 pb-1 mb-1 text-[11px]">
                      {hoveredPoint.dateLabel}
                    </p>
                    <p className="text-emerald-400 font-extrabold text-xs">
                      Faturamento: R$ {hoveredPoint.revenue.toFixed(2).replace(".", ",")}
                    </p>
                    <p className="text-blue-400 text-[11px] font-semibold">
                      Vendas: {hoveredPoint.salesCount} {hoveredPoint.salesCount === 1 ? "pedido" : "pedidos"}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Channels Breakdown Card (1 Col) */}
        <div className="bg-[#111114] border border-white/[0.07] rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/5 border border-indigo-500/20 flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/10">
                <Bot className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Vendas por Canal</h3>
                <p className="text-xs text-zinc-400">Origem dos pedidos</p>
              </div>
            </div>

            {isPending ? (
              <div className="space-y-4 py-4">
                <div className="h-12 bg-white/5 rounded-2xl animate-pulse" />
                <div className="h-12 bg-white/5 rounded-2xl animate-pulse" />
              </div>
            ) : data.channels.length === 0 ? (
              <p className="text-zinc-500 text-xs py-10 text-center">Nenhum canal ativo registrado.</p>
            ) : (
              <div className="space-y-5 py-2">
                {data.channels.map((chan) => (
                  <div key={chan.channel} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white flex items-center gap-2 min-w-0">
                        {chan.photoUrl ? (
                          <img src={chan.photoUrl} className="w-5 h-5 rounded-full object-cover shrink-0 border border-white/10" alt="" />
                        ) : chan.channel !== "web" ? (
                          <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                            <Bot className="w-3 h-3 text-blue-400" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                            <Globe className="w-3 h-3 text-emerald-400" />
                          </div>
                        )}
                        <span className="truncate">{chan.label}</span>
                      </span>
                      <span className="font-mono font-bold text-zinc-300 shrink-0 ml-2">{chan.percentage}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-3 bg-[#16161D] rounded-full overflow-hidden border border-white/5 relative">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          chan.channel === "web" 
                            ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/20" 
                            : "bg-gradient-to-r from-blue-500 to-indigo-500 shadow-md shadow-blue-500/20"
                        }`}
                        style={{ width: `${Math.max(chan.percentage, 5)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
                      <span>{chan.salesCount} {chan.salesCount === 1 ? "venda" : "vendas"}</span>
                      <span className="font-extrabold text-white">R$ {chan.revenue.toFixed(2).replace(".", ",")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/5 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Canal principal</span>
            <span className="font-black text-white uppercase tracking-wider">
              {data.channels[0]?.label || "Nenhum"}
            </span>
          </div>
        </div>

      </div>

      {/* 4. Top Products & Recent Sales Grid (2 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Selling Products */}
        <div className="bg-[#111114] border border-white/[0.07] rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/10">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Mais Vendidos</h3>
                <p className="text-xs text-zinc-400">Ranking por volume de receita</p>
              </div>
            </div>
          </div>

          {isPending ? (
            <div className="space-y-3 py-4">
              <div className="h-14 bg-white/5 rounded-2xl animate-pulse" />
              <div className="h-14 bg-white/5 rounded-2xl animate-pulse" />
            </div>
          ) : data.topProducts.length === 0 ? (
            <div className="py-12 text-center bg-[#15151A]/40 rounded-2xl border border-white/5 space-y-2">
              <ShoppingBag className="w-8 h-8 text-zinc-600 mx-auto opacity-50" />
              <p className="text-zinc-400 text-xs font-bold">Nenhum produto vendido ainda neste período.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.topProducts.map((prod, idx) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-[#16161D] border border-white/5 hover:border-white/10 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Rank Badge */}
                    <span className="text-base shrink-0 select-none font-bold w-6 text-center">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}º`}
                    </span>

                    {/* Product Cover */}
                    {prod.coverUrl ? (
                      <img
                        src={prod.coverUrl}
                        alt=""
                        className="w-11 h-11 rounded-xl object-cover bg-zinc-800 shrink-0 border border-white/10 group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0 text-zinc-500 text-[10px] font-bold">
                        Sem foto
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate group-hover:text-red-400 transition-colors">{prod.title}</p>
                      <p className="text-[11px] text-zinc-400">
                        {prod.salesCount} {prod.salesCount === 1 ? "unidade" : "unidades"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-3">
                    <p className="text-xs font-black text-emerald-400">
                      R$ {prod.revenue.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sales History */}
        <div className="bg-[#111114] border border-white/[0.07] rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/10">
                <Clock className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Últimas Vendas</h3>
                <p className="text-xs text-zinc-400">Pedidos recentes em tempo real</p>
              </div>
            </div>

            <Link
              href="/seller/orders"
              className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20"
            >
              <span>Ver todas</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isPending ? (
            <div className="space-y-3 py-4">
              <div className="h-14 bg-white/5 rounded-2xl animate-pulse" />
              <div className="h-14 bg-white/5 rounded-2xl animate-pulse" />
            </div>
          ) : data.recentOrders.length === 0 ? (
            <div className="py-12 text-center bg-[#15151A]/40 rounded-2xl border border-white/5 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-zinc-600 mx-auto opacity-50" />
              <p className="text-zinc-400 text-xs font-bold">O histórico de vendas está vazio.</p>
              <p className="text-zinc-500 text-[11px]">Quando os clientes comprarem via PIX/Cartão, os pedidos aparecerão aqui.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
              {data.recentOrders.map((ord) => (
                <Link
                  key={ord.id}
                  href={`/seller/orders`}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-[#16161D] border border-white/5 hover:border-white/10 transition-all duration-200 group"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white truncate group-hover:text-red-400 transition-colors">{ord.productTitle}</p>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${
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
                    <p className="text-xs font-black text-emerald-400">
                      R$ {ord.total.toFixed(2).replace(".", ",")}
                    </p>
                    <p className="text-[10px] text-zinc-500 uppercase font-semibold">{ord.paymentMethod}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* 5. Store Activity & Catalog Overview (2 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Atividade da Loja */}
        <div className="bg-[#111114] border border-white/[0.07] rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/10">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Atividade da Loja</h3>
              <p className="text-xs text-zinc-400">Indicadores de movimentação em tempo real</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div className="p-4 rounded-2xl bg-[#16161D] border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-xs text-zinc-300 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span>Vendas hoje</span>
              </div>
              <span className="font-black text-base text-white">{data.activity.salesToday}</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#16161D] border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-xs text-zinc-300 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Novos clientes</span>
              </div>
              <span className="font-black text-base text-white">{data.activity.newCustomersPeriod}</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#16161D] border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-xs text-zinc-300 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>Acessos liberados</span>
              </div>
              <span className="font-black text-base text-white">{data.activity.activeAccesses}</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#16161D] border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-xs text-zinc-300 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>PIX pendentes</span>
              </div>
              <span className="font-black text-base text-amber-400">{data.activity.pendingPayments}</span>
            </div>
          </div>
        </div>

        {/* Visão do Catálogo */}
        <div className="bg-[#111114] border border-white/[0.07] rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/5 border border-blue-500/20 flex items-center justify-center shrink-0 shadow-md shadow-blue-500/10">
                <Package className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Visão do Catálogo</h3>
                <p className="text-xs text-zinc-400">Resumo dos produtos e estrutura</p>
              </div>
            </div>

            <Link
              href="/seller/products"
              className="px-3.5 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/25 inline-flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Novo produto</span>
            </Link>
          </div>

          <div className="grid grid-cols-4 gap-2.5 pt-1 text-center">
            <div className="p-3.5 rounded-2xl bg-[#16161D] border border-white/5">
              <span className="block text-xl font-black text-white">{data.catalog.totalProducts}</span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Total</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#16161D] border border-white/5">
              <span className="block text-xl font-black text-emerald-400">{data.catalog.activeProducts}</span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Ativos</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#16161D] border border-white/5">
              <span className="block text-xl font-black text-zinc-400">{data.catalog.inactiveProducts}</span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Inativos</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#16161D] border border-white/5">
              <span className="block text-xl font-black text-indigo-400">{data.catalog.categoriesCount}</span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Categorias</span>
            </div>
          </div>
        </div>

      </div>

      {/* 6. Hourly Sales Distribution Bar Chart (00h - 23h) */}
      <div className="bg-[#111114] border border-white/[0.07] rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/10">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Horários de Maior Venda</h3>
            <p className="text-xs text-zinc-400">Concentração de vendas por hora do dia (00:00 às 23:00)</p>
          </div>
        </div>

        {/* 24-Hour Bar Chart */}
        <div className="relative pt-4">
          <div className="h-40 flex items-end gap-1 sm:gap-1.5 w-full">
            {data.hourlySales.map((hItem) => {
              const maxHourSales = Math.max(...data.hourlySales.map((h) => h.salesCount), 1);
              const heightPercent = Math.max((hItem.salesCount / maxHourSales) * 100, 5);

              return (
                <div
                  key={hItem.hour}
                  className="flex-1 flex flex-col items-center group relative h-full justify-end"
                  onMouseEnter={() => setHoveredHour(hItem)}
                  onMouseLeave={() => setHoveredHour(null)}
                >
                  {/* Bar */}
                  <div
                    className={`w-full rounded-t-lg transition-all duration-300 ${
                      hItem.salesCount > 0
                        ? "bg-gradient-to-t from-amber-600 to-amber-400 group-hover:from-amber-500 group-hover:to-amber-300 shadow-md shadow-amber-500/20 scale-y-[1.02]"
                        : "bg-white/5 group-hover:bg-white/10"
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Hour Labels */}
          <div className="flex justify-between pt-3 text-[10px] text-zinc-500 font-mono font-bold">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>

          {/* Tooltip for Hourly Bar Hover */}
          {hoveredHour && (
            <div className="absolute top-0 right-4 bg-[#16161D] border border-amber-500/40 text-white p-3 rounded-2xl text-xs z-20 shadow-2xl space-y-0.5">
              <p className="font-bold text-amber-400">{hoveredHour.hourLabel}</p>
              <p className="text-zinc-200 font-semibold">{hoveredHour.salesCount} {hoveredHour.salesCount === 1 ? "venda" : "vendas"}</p>
              <p className="text-emerald-400 font-extrabold text-[11px]">R$ {hoveredHour.revenue.toFixed(2).replace(".", ",")}</p>
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
      <span className="text-[10px] text-zinc-500 font-bold">
        Sem comparativo
      </span>
    );
  }

  if (trend === "up") {
    return (
      <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
        <TrendingUp className="w-3 h-3" />
        ↑ {percent}%
      </span>
    );
  }

  if (trend === "down") {
    return (
      <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-red-500/10 text-red-400 border border-red-500/20 inline-flex items-center gap-1">
        <TrendingDown className="w-3 h-3" />
        ↓ {percent}%
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-zinc-800/80 text-zinc-400 border border-white/10 inline-flex items-center gap-1">
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
        <div className="w-9 h-9 bg-white/10 rounded-2xl" />
      </div>
      <div className="h-8 bg-white/10 rounded-xl w-32" />
      <div className="h-3 bg-white/10 rounded w-24" />
    </div>
  );
}
