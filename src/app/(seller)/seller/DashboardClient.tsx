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
  CreditCard,
  Layers,
  Tag
} from "lucide-react";
import { StoreAnalyticsData } from "@/lib/analytics/analytics-service";
import { getDashboardAnalyticsAction } from "./actions";

interface DashboardClientProps {
  initialData: StoreAnalyticsData;
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

  // Construct smooth non-overshooting SVG path for Area Chart
  let areaD = "";
  let lineD = "";

  if (points.length > 0) {
    if (points.length === 1) {
      lineD = `M ${points[0].x - 20} ${points[0].y} L ${points[0].x + 20} ${points[0].y}`;
      areaD = `M ${points[0].x - 20} ${points[0].y} L ${points[0].x + 20} ${points[0].y} L ${points[0].x + 20} ${svgHeight - paddingY} L ${points[0].x - 20} ${svgHeight - paddingY} Z`;
    } else {
      lineD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? i : i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

        const dx1 = (p2.x - p0.x) / 6;
        const dy1 = (p2.y - p0.y) / 6;
        const dx2 = (p3.x - p1.x) / 6;
        const dy2 = (p3.y - p1.y) / 6;

        const cp1x = (p1.x + dx1).toFixed(1);
        const cp1y = Math.min(Math.max(p1.y + dy1, paddingY), svgHeight - paddingY).toFixed(1);
        const cp2x = (p2.x - dx2).toFixed(1);
        const cp2y = Math.min(Math.max(p2.y - dy2, paddingY), svgHeight - paddingY).toFixed(1);

        lineD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
      const lastP = points[points.length - 1];
      const firstP = points[0];
      areaD = `${lineD} L ${lastP.x.toFixed(1)} ${svgHeight - paddingY} L ${firstP.x.toFixed(1)} ${svgHeight - paddingY} Z`;
    }
  }

  return (
    <div className="space-y-6 fade-in w-full max-w-full overflow-hidden min-w-0 pb-20">
      
      {/* 1. Header & Period Selector (WebGran Executive Header) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0E0E11] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Painel Comercial
            </span>
            {isPending && (
              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 font-mono">
                <RefreshCw className="w-3 h-3 animate-spin text-rose-500" />
                Atualizando...
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Olá, {data.userName || data.storeName}
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm">
            Acompanhe o desempenho comercial, faturamento e vendas em tempo real.
          </p>
        </div>

        {/* Period Selector Segmented Control */}
        <div className="bg-[#141418] p-1 rounded-xl border border-white/[0.06] flex items-center gap-1 overflow-x-auto scrollbar-hide shrink-0 max-w-full w-full sm:w-auto">
          {periodsList.map((p) => {
            const isActive = period === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => handlePeriodChange(p.key)}
                disabled={isPending}
                className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
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

      {/* 2. Main KPI Grid (4 High-Impact Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 w-full max-w-full">
        
        {/* KPI 1: Faturamento */}
        <div 
          className="border border-white/[0.06] rounded-2xl p-4 sm:p-5 shadow-sm hover:border-white/[0.12] transition-all flex flex-col justify-between min-h-[120px] sm:min-h-[135px]"
          style={{
            background: `radial-gradient(ellipse 80% 80% at 92% 8%, rgba(16, 185, 129, 0.22) 0%, rgba(16, 185, 129, 0.12) 25%, rgba(16, 185, 129, 0.05) 50%, rgba(16, 185, 129, 0.01) 70%, transparent 85%), #0E0E11`
          }}
        >
          {isPending ? (
            <SkeletonKpi />
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-[11px] font-semibold uppercase tracking-wider truncate">
                  Faturamento
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate wg-tabular">
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
        <div 
          className="border border-white/[0.06] rounded-2xl p-4 sm:p-5 shadow-sm hover:border-white/[0.12] transition-all flex flex-col justify-between min-h-[120px] sm:min-h-[135px]"
          style={{
            background: `radial-gradient(ellipse 80% 80% at 92% 8%, rgba(59, 130, 246, 0.22) 0%, rgba(59, 130, 246, 0.12) 25%, rgba(59, 130, 246, 0.05) 50%, rgba(59, 130, 246, 0.01) 70%, transparent 85%), #0E0E11`
          }}
        >
          {isPending ? (
            <SkeletonKpi />
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-[11px] font-semibold uppercase tracking-wider truncate">
                  Total Vendas
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-4 h-4 text-blue-400" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate wg-tabular">
                  {data.kpis.salesCount.value} <span className="text-xs font-normal text-zinc-400">{data.kpis.salesCount.value === 1 ? "venda" : "vendas"}</span>
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
        <div 
          className="border border-white/[0.06] rounded-2xl p-4 sm:p-5 shadow-sm hover:border-white/[0.12] transition-all flex flex-col justify-between min-h-[120px] sm:min-h-[135px]"
          style={{
            background: `radial-gradient(ellipse 80% 80% at 92% 8%, rgba(168, 85, 247, 0.22) 0%, rgba(168, 85, 247, 0.12) 25%, rgba(168, 85, 247, 0.05) 50%, rgba(168, 85, 247, 0.01) 70%, transparent 85%), #0E0E11`
          }}
        >
          {isPending ? (
            <SkeletonKpi />
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-[11px] font-semibold uppercase tracking-wider truncate">
                  Clientes
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-purple-400" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate wg-tabular">
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
        <div 
          className="border border-white/[0.06] rounded-2xl p-4 sm:p-5 shadow-sm hover:border-white/[0.12] transition-all flex flex-col justify-between min-h-[120px] sm:min-h-[135px]"
          style={{
            background: `radial-gradient(ellipse 80% 80% at 92% 8%, rgba(245, 158, 11, 0.22) 0%, rgba(245, 158, 11, 0.12) 25%, rgba(245, 158, 11, 0.05) 50%, rgba(245, 158, 11, 0.01) 70%, transparent 85%), #0E0E11`
          }}
        >
          {isPending ? (
            <SkeletonKpi />
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-[11px] font-semibold uppercase tracking-wider truncate">
                  Ticket Médio
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4 text-amber-400" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate wg-tabular">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Sales Evolution SVG Area Chart (2 Cols) */}
        <div className="lg:col-span-2 bg-[#0E0E11] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4.5 h-4.5 text-rose-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Evolução de Vendas</h3>
                <p className="text-xs text-zinc-400">Curva de receita e pedidos no período</p>
              </div>
            </div>

            {/* Metric Switcher */}
            <div className="bg-[#141418] p-1 rounded-lg border border-white/[0.06] flex items-center gap-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setChartMetric("revenue")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  chartMetric === "revenue"
                    ? "bg-rose-600 text-white font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Faturamento (R$)
              </button>
              <button
                type="button"
                onClick={() => setChartMetric("sales")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  chartMetric === "sales"
                    ? "bg-rose-600 text-white font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Qtd Vendas
              </button>
            </div>
          </div>

          {/* Chart SVG Rendering or Empty State */}
          {isPending ? (
            <div className="h-60 bg-white/[0.02] rounded-xl animate-pulse flex items-center justify-center text-zinc-500 text-xs">
              Carregando gráfico...
            </div>
          ) : !data.hasSales && series.every((s) => s.revenue === 0 && s.salesCount === 0) ? (
            <div className="h-60 flex flex-col items-center justify-center p-6 text-center bg-[#141418]/50 rounded-xl border border-white/[0.04] space-y-2">
              <div className="w-10 h-10 rounded-xl bg-zinc-800/60 border border-white/10 flex items-center justify-center text-zinc-500">
                <BarChart3 className="w-5 h-5 opacity-60" />
              </div>
              <p className="text-zinc-300 text-xs font-semibold">Nenhuma venda registrada no período selecionado</p>
              <p className="text-zinc-500 text-[11px] max-w-xs leading-relaxed">
                Quando sua loja receber novos pedidos, a curva de evolução aparecerá aqui em tempo real.
              </p>
            </div>
          ) : (
            <div className="relative w-full max-w-full overflow-hidden">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto max-w-full block overflow-visible">
                <defs>
                  <linearGradient id="chartGradientRose" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E11D48" stopOpacity="0.18" />
                    <stop offset="50%" stopColor="#F43F5E" stopOpacity="0.06" />
                    <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="rgba(255, 255, 255, 0.03)" strokeDasharray="3 3" />
                <line x1={paddingX} y1={(svgHeight - paddingY * 2) / 2 + paddingY} x2={svgWidth - paddingX} y2={(svgHeight - paddingY * 2) / 2 + paddingY} stroke="rgba(255, 255, 255, 0.03)" strokeDasharray="3 3" />
                <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke="rgba(255, 255, 255, 0.06)" />

                {/* Area & Line Paths */}
                {areaD && <path d={areaD} fill="url(#chartGradientRose)" />}
                {lineD && <path d={lineD} fill="none" stroke="#F43F5E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

                {/* Data Nodes */}
                {points.map((pt, idx) => {
                  const isHovered = hoveredPoint?.x === pt.x && hoveredPoint?.y === pt.y;
                  return (
                    <g key={idx} className="group cursor-pointer">
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? "5" : "2.5"}
                        className={`transition-all duration-150 ${
                          isHovered
                            ? "fill-[#F43F5E] stroke-white stroke-[2.5]"
                            : "fill-[#F43F5E] stroke-[#0E0E11] stroke-[1.5] group-hover:r-4 group-hover:fill-rose-400"
                        }`}
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
                  );
                })}
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
                    className={`absolute bg-[#141418] border border-white/10 text-white p-3 rounded-xl shadow-2xl text-xs z-30 pointer-events-none transform ${posXClass} ${posYClass} animate-in fade-in duration-150 space-y-1.5 min-w-[150px]`}
                    style={{
                      left: `${(hoveredPoint.x / svgWidth) * 100}%`,
                      top: `${(hoveredPoint.y / svgHeight) * 100}%`
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-1.5 mb-1">
                      <span className="font-semibold text-zinc-300 text-[11px]">{hoveredPoint.dateLabel}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    </div>
                    <div className="flex items-center justify-between text-xs gap-3">
                      <span className="text-zinc-400">Faturamento:</span>
                      <span className="font-bold text-emerald-400 font-mono wg-tabular">R$ {hoveredPoint.revenue.toFixed(2).replace(".", ",")}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs gap-3">
                      <span className="text-zinc-400">Vendas:</span>
                      <span className="font-bold text-white font-mono wg-tabular">{hoveredPoint.salesCount} {hoveredPoint.salesCount === 1 ? "pedido" : "pedidos"}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Channels Breakdown Card (1 Col) */}
        <div className="bg-[#0E0E11] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <Bot className="w-4.5 h-4.5 text-indigo-400" />
              </div>
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
              <div className="space-y-4 py-1">
                {data.channels.map((chan) => (
                  <div key={chan.channel} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-white flex items-center gap-2 min-w-0">
                        <ChannelAvatarItem chan={chan} />
                        <span className="truncate">{chan.label}</span>
                      </span>
                      <span className="font-mono font-bold text-zinc-300 shrink-0 ml-2 wg-tabular">{chan.percentage}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 bg-[#141418] rounded-full overflow-hidden border border-white/[0.04]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          chan.channel === "web" 
                            ? "bg-emerald-500" 
                            : "bg-blue-500"
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

      {/* 4. Top Products & Recent Sales Grid (2 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Top Selling Products */}
        <div className="bg-[#0E0E11] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-4.5 h-4.5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Mais Vendidos</h3>
                <p className="text-xs text-zinc-400">Ranking por receita no período</p>
              </div>
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
            <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar p-0.5 pr-1">
              {data.topProducts.map((prod, idx) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#141418] border border-white/[0.05] hover:border-white/10 transition-all duration-150 group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
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
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-900 border border-white/10 shrink-0 flex items-center justify-center text-zinc-500">
                      {prod.coverUrl ? (
                        <img
                          src={prod.coverUrl}
                          alt={prod.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-4.5 h-4.5 text-zinc-600" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate group-hover:text-rose-400 transition-colors">{prod.title}</p>
                      <p className="text-[11px] text-zinc-400 font-medium">
                        {prod.salesCount} {prod.salesCount === 1 ? "unidade" : "unidades"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-3">
                    <p className="text-xs font-bold text-emerald-400 font-mono wg-tabular">
                      R$ {prod.revenue.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sales History */}
        <div className="bg-[#0E0E11] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Clock className="w-4.5 h-4.5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Últimas Vendas</h3>
                <p className="text-xs text-zinc-400">Pedidos recentes recebidos</p>
              </div>
            </div>

            <Link
              href="/seller/orders"
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20"
            >
              <span>Ver todas</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isPending ? (
            <div className="space-y-3 py-3">
              <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
              <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
            </div>
          ) : data.recentOrders.length === 0 ? (
            <div className="py-10 text-center bg-[#141418]/50 rounded-xl border border-white/[0.04] space-y-2">
              <CheckCircle2 className="w-7 h-7 text-zinc-600 mx-auto opacity-50" />
              <p className="text-zinc-400 text-xs font-semibold">O histórico de vendas está vazio.</p>
              <p className="text-zinc-500 text-[11px]">Quando os clientes comprarem via PIX/Cartão, os pedidos aparecerão aqui.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar p-0.5 pr-1">
              {data.recentOrders.map((ord) => (
                <Link
                  key={ord.id}
                  href={`/seller/orders`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-[#141418] border border-white/[0.05] hover:border-white/10 transition-all duration-150 gap-2 sm:gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white truncate group-hover:text-rose-400 transition-colors">{ord.productTitle}</p>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {ord.customerName} • <span className="text-zinc-500">{ord.timeAgo}</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-0 border-white/[0.04]">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                        ord.status === "paid"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : ord.status === "pending"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                      }`}
                    >
                      {ord.status === "paid" ? "Pago" : ord.status === "pending" ? "Pendente" : ord.status}
                    </span>
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-400 font-mono wg-tabular">
                        R$ {ord.total.toFixed(2).replace(".", ",")}
                      </p>
                      {ord.paymentMethod && (
                        <p className="text-[10px] text-zinc-500 uppercase font-semibold">{ord.paymentMethod}</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* 5. Store Activity & Catalog Overview (2 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Atividade da Loja */}
        <div className="bg-[#0E0E11] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Activity className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Atividade da Loja</h3>
              <p className="text-xs text-zinc-400">Indicadores de movimentação operacional</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-xl bg-[#141418] border border-white/[0.05] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-zinc-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Vendas hoje</span>
              </div>
              <span className="font-bold text-sm text-white wg-tabular">{data.activity.salesToday}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#141418] border border-white/[0.05] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-zinc-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Novos clientes</span>
              </div>
              <span className="font-bold text-sm text-white wg-tabular">{data.activity.newCustomersPeriod}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#141418] border border-white/[0.05] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-zinc-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Acessos liberados</span>
              </div>
              <span className="font-bold text-sm text-white wg-tabular">{data.activity.activeAccesses}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#141418] border border-white/[0.05] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-zinc-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>PIX pendentes</span>
              </div>
              <span className="font-bold text-sm text-amber-400 wg-tabular">{data.activity.pendingPayments}</span>
            </div>
          </div>
        </div>

        {/* Visão do Catálogo */}
        <div className="bg-[#0E0E11] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Package className="w-4.5 h-4.5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Visão do Catálogo</h3>
                <p className="text-xs text-zinc-400">Resumo dos produtos e estrutura</p>
              </div>
            </div>

            <Link
              href="/seller/products"
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-sm inline-flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo produto</span>
            </Link>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-1 text-center">
            <div className="p-3 rounded-xl bg-[#141418] border border-white/[0.05]">
              <span className="block text-lg font-bold text-white wg-tabular">{data.catalog.totalProducts}</span>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase">Total</span>
            </div>
            <div className="p-3 rounded-xl bg-[#141418] border border-white/[0.05]">
              <span className="block text-lg font-bold text-emerald-400 wg-tabular">{data.catalog.activeProducts}</span>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase">Ativos</span>
            </div>
            <div className="p-3 rounded-xl bg-[#141418] border border-white/[0.05]">
              <span className="block text-lg font-bold text-zinc-400 wg-tabular">{data.catalog.inactiveProducts}</span>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase">Inativos</span>
            </div>
            <div className="p-3 rounded-xl bg-[#141418] border border-white/[0.05]">
              <span className="block text-lg font-bold text-indigo-400 wg-tabular">{data.catalog.categoriesCount}</span>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase">Categorias</span>
            </div>
          </div>
        </div>

      </div>

      {/* 6. Hourly Sales Distribution Bar Chart (00h - 23h) */}
      <div className="bg-[#0E0E11] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Clock className="w-4.5 h-4.5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Horários de Maior Venda</h3>
            <p className="text-xs text-zinc-400">Distribuição de vendas por hora do dia (00:00 às 23:00)</p>
          </div>
        </div>

        {/* 24-Hour Bar Chart */}
        <div className="relative pt-3">
          <div className="h-36 flex items-end gap-1 sm:gap-1.5 w-full">
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
                    className={`w-full rounded-t transition-all duration-200 ${
                      hItem.salesCount > 0
                        ? "bg-amber-500 group-hover:bg-amber-400"
                        : "bg-white/[0.04] group-hover:bg-white/[0.08]"
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Hour Labels */}
          <div className="flex justify-between pt-3 text-[10px] text-zinc-500 font-mono">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>

          {/* Tooltip for Hourly Bar Hover */}
          {hoveredHour && (
            <div className="absolute top-0 right-4 bg-[#141418] border border-white/10 text-white p-2.5 rounded-xl text-xs z-20 shadow-xl space-y-0.5">
              <p className="font-bold text-amber-400">{hoveredHour.hourLabel}</p>
              <p className="text-zinc-200 font-medium">{hoveredHour.salesCount} {hoveredHour.salesCount === 1 ? "venda" : "vendas"}</p>
              <p className="text-emerald-400 font-bold text-[11px] wg-tabular">R$ {hoveredHour.revenue.toFixed(2).replace(".", ",")}</p>
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
