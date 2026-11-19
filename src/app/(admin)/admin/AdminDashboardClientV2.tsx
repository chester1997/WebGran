"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import AdminPageHeader from "../AdminPageHeader";
import type { AdminDashboardData, AdminDashboardPeriod } from "@/lib/analytics/admin-dashboard-service";

/**
 * Redesign V2 da dashboard do painel admin — exclusivo da conta proprietária (ver page.tsx).
 * Usa a mesma API (/api/admin/dashboard-stats) e a mesma ação de sincronizar splits da versão clássica.
 * A sidebar do admin não é alterada.
 */

const PERIODS: { id: AdminDashboardPeriod; label: string; days: number }[] = [
  { id: "7d", label: "7 dias", days: 7 },
  { id: "30d", label: "30 dias", days: 30 },
  { id: "90d", label: "90 dias", days: 90 },
];

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const int = (v: number) => Math.round(v).toLocaleString("pt-BR");
const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Rótulo curto para o eixo do gráfico, sem arredondar valores diferentes para o mesmo texto. */
export function formatAxisValue(value: number, money: boolean): string {
  if (value >= 1000) {
    const k = value / 1000;
    const txt = k.toLocaleString("pt-BR", { maximumFractionDigits: k < 10 ? 1 : 0 });
    return money ? `R$ ${txt} mil` : `${txt} mil`;
  }
  return money ? `R$ ${Math.round(value).toLocaleString("pt-BR")}` : Math.round(value).toLocaleString("pt-BR");
}

/** Texto da comparação com o período anterior; sem "+999%" quando o anterior foi zero. */
export function describeChange(changePercent: number | null | undefined): { text: string; tone: "up" | "down" | "neutral" } {
  if (changePercent === null || changePercent === undefined) {
    return { text: "Sem período anterior para comparar", tone: "neutral" };
  }
  if (changePercent > 500) return { text: "Muito acima do período anterior", tone: "up" };
  if (changePercent > 0) return { text: `+${pct(changePercent)} vs período anterior`, tone: "up" };
  if (changePercent < 0) return { text: `${pct(changePercent)} vs período anterior`, tone: "down" };
  return { text: "Igual ao período anterior", tone: "neutral" };
}

/** Situação do repasse da taxa de um pedido, com os mesmos grupos do serviço do dashboard. */
export function describeSplitStatus(status: string | null): { label: string; className: string } {
  const st = (status || "PENDING").toUpperCase();
  if (st === "SETTLED") return { label: "Na conta", className: "text-[#93c5fd] bg-[#3b82f6]/15" };
  if (st === "PROCESSED" || st === "CONFIRMED" || st === "GATEWAY_ACCEPTED")
    return { label: "Taxa processada", className: "text-emerald-400 bg-emerald-500/12" };
  if (st === "SKIPPED") return { label: "Isenta", className: "text-zinc-300 bg-white/[0.06]" };
  if (st === "FAILED") return { label: "Falha no split", className: "text-rose-300 bg-rose-500/15" };
  return { label: "Split pendente", className: "text-amber-300 bg-amber-500/12" };
}

type ChartMetric = "gmv" | "orders" | "pix";
type RankingSort = "gmv" | "orders" | "fees";

const card = "bg-[#131316] border border-[#232328] rounded-2xl";

export default function AdminDashboardClientV2() {
  const [period, setPeriod] = useState<AdminDashboardPeriod>("30d");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ updated: number; skipped: number; divergence: number; errors: number; total: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [metric, setMetric] = useState<ChartMetric>("gmv");
  const [hover, setHover] = useState<number | null>(null);
  const [sort, setSort] = useState<RankingSort>("gmv");

  const load = useCallback(async (p: AdminDashboardPeriod, manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/dashboard-stats?period=${p}`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Falha ao carregar métricas administrativas.");
      }
      setData((await res.json()) as AdminDashboardData);
    } catch (err) {
      setErrorMsg((err as Error)?.message || "Erro de conexão ao carregar a dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(period);
    setHover(null);
  }, [period, load]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await fetch("/api/admin/splits/sync", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Falha ao sincronizar splits.");
      }
      const json = await res.json();
      setSyncResult(json.summary);
      await load(period, true);
    } catch (err) {
      setSyncError((err as Error)?.message || "Erro desconhecido ao sincronizar.");
    } finally {
      setSyncing(false);
    }
  }, [period, load]);

  const periodDays = PERIODS.find((p) => p.id === period)?.days || 30;
  const sp = data?.salesAndPayments;
  const fees = data?.platformFees;
  const gmv = sp?.gmvApproved ?? data?.kpis.gmv.current ?? 0;
  const paidOrders = sp?.paidOrdersCount ?? data?.kpis.paidOrders.current ?? 0;
  const ticket = paidOrders > 0 ? gmv / paidOrders : 0;
  const takeRate = gmv > 0 && fees ? (fees.processedFeeTotal / gmv) * 100 : null;

  // Gráfico
  const daily = sp?.dailyEvolution || [];
  const series = daily.map((d) => (metric === "gmv" ? d.gmv : metric === "orders" ? d.ordersCount : d.pixGenerated));
  const maxValue = Math.max(0, ...series);
  const peakIdx = series.reduce((best, v, i) => (v > series[best] ? i : best), 0);
  const money = metric === "gmv";
  const fmtSeries = (v: number) => (money ? brl(v) : int(v));
  const unit = metric === "gmv" ? "" : metric === "orders" ? " pedidos" : " Pix gerados";
  const seriesTotal = series.reduce((a, b) => a + b, 0);
  const chartHeadline =
    daily.length === 0
      ? "Sem dados no período"
      : hover !== null && daily[hover]
      ? `${daily[hover].label} · ${fmtSeries(series[hover])}${unit}`
      : maxValue > 0
      ? `${fmtSeries(seriesTotal)}${unit} no período · pico em ${daily[peakIdx]?.label} (${fmtSeries(series[peakIdx])}${unit})`
      : `Nenhum registro no período`;

  // Ranking
  const ranking = useMemo(() => {
    const list = [...(data?.sellerRanking || [])];
    return list.sort((a, b) =>
      sort === "orders" ? b.paidOrdersCount - a.paidOrdersCount : sort === "fees" ? b.processedFees - a.processedFees : b.approvedGmv - a.approvedGmv
    );
  }, [data?.sellerRanking, sort]);
  const top3Share = useMemo(() => {
    if (gmv <= 0) return null;
    const top = [...(data?.sellerRanking || [])].sort((a, b) => b.approvedGmv - a.approvedGmv).slice(0, 3);
    return (top.reduce((s, r) => s + r.approvedGmv, 0) / gmv) * 100;
  }, [data?.sellerRanking, gmv]);

  const feesProgress = fees && fees.expectedFeeTotal > 0 ? (fees.processedFeeTotal / fees.expectedFeeTotal) * 100 : null;

  const segClass = (on: boolean, alt = false) =>
    `px-3 py-1.5 rounded-[7px] text-[13px] transition-colors cursor-pointer ${
      on ? `${alt ? "bg-[#27272a]" : "bg-[#2563eb]"} text-white font-semibold` : "text-[#a1a1aa] hover:text-white"
    }`;

  const kpis = data
    ? [
        {
          label: "Vendas aprovadas",
          value: brl(gmv),
          change: describeChange(data.kpis.gmv.changePercent),
          sub: `${brl(data.kpis.gmv.total)} no histórico`,
          valueClass: "text-white",
        },
        {
          label: "Receita da plataforma",
          value: brl(fees?.processedFeeTotal ?? data.kpis.processedFees.current),
          change: describeChange(data.kpis.processedFees.changePercent),
          sub: `${takeRate !== null ? `${pct(takeRate)} das vendas · ` : ""}${brl(data.kpis.processedFees.total)} no histórico`,
          valueClass: "text-emerald-400",
        },
        {
          label: "Pedidos pagos",
          value: int(paidOrders),
          change: describeChange(data.kpis.paidOrders.changePercent),
          sub: `Ticket médio ${brl(ticket)}`,
          valueClass: "text-white",
        },
        {
          label: "Conversão do Pix",
          value: sp?.pixConversionRate !== null && sp?.pixConversionRate !== undefined ? pct(sp.pixConversionRate) : "—",
          change: null,
          sub: `${int(sp?.pixPaidCount || 0)} pagos de ${int(sp?.pixGeneratedCount || 0)} gerados`,
          valueClass: "text-white",
        },
      ]
    : [];

  const eco = data
    ? [
        { label: "Lojistas", value: int(data.kpis.sellers.total), sub: `+${int(data.kpis.sellers.current)} no período` },
        { label: "Lojas", value: int(data.kpis.stores.total), sub: `+${int(data.kpis.stores.current)} no período` },
        { label: "Bots", value: int(data.kpis.bots.total), sub: `${int(data.telegramStats.activeBots)} operando` },
        { label: "Produtos", value: int(data.kpis.products.total), sub: `+${int(data.kpis.products.current)} no período` },
        {
          label: "Clientes no Telegram",
          value: int(data.telegramStats.totalCustomers),
          sub: `+${int(data.telegramStats.newCustomersPeriod)} no período`,
        },
      ]
    : [];

  return (
    <div className="space-y-5 pb-16 text-zinc-100 max-w-[1240px] mx-auto tabular-nums">
      <AdminPageHeader
        title="Visão geral"
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            Últimos {periodDays} dias{data?.updatedAt ? ` · atualizado às ${data.updatedAt}` : ""}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <div role="group" aria-label="Período" className="flex gap-0.5 bg-[#131316] border border-[#232328] rounded-[10px] p-[3px]">
              {PERIODS.map((p) => (
                <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)} className={segClass(period === p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => load(period, true)}
              disabled={refreshing || loading}
              aria-label="Atualizar dados"
              title="Atualizar dados"
              className="w-9 h-9 rounded-[10px] bg-[#131316] border border-[#232328] text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#60a5fa]" : ""}`} />
            </button>
          </div>
        }
      />

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </span>
          <button type="button" onClick={() => load(period)} className="text-sm font-semibold underline hover:text-white cursor-pointer">
            Tentar novamente
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-5 animate-pulse" aria-label="Carregando dashboard" role="status">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`${card} h-[132px]`} />
            ))}
          </div>
          <div className={`${card} h-[320px]`} />
          <div className={`${card} h-[260px]`} />
        </div>
      ) : data ? (
        <>
          {/* 1. Indicadores principais */}
          <section aria-label="Indicadores principais" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {kpis.map((k) => (
              <div key={k.label} className={`${card} p-[18px] flex flex-col gap-2`}>
                <span className="text-[13px] text-[#a1a1aa]">{k.label}</span>
                <span className={`text-[28px] leading-tight font-bold tracking-tight ${k.valueClass}`}>{k.value}</span>
                {k.change && (
                  <span
                    className={`text-[12px] ${
                      k.change.tone === "up" ? "text-emerald-400" : k.change.tone === "down" ? "text-rose-300" : "text-[#8b8b94]"
                    }`}
                  >
                    {k.change.text}
                  </span>
                )}
                <span className="text-[12px] text-[#8b8b94]">{k.sub}</span>
              </div>
            ))}
          </section>

          {/* 2. Gráfico + checkout Pix */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <div className={`${card} xl:col-span-2 p-[18px] flex flex-col gap-4 min-w-0`}>
              <div className="flex flex-wrap justify-between gap-3 items-start">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-white">
                    {metric === "gmv" ? "Vendas por dia" : metric === "orders" ? "Pedidos pagos por dia" : "Pix gerados por dia"}
                  </h2>
                  <p className="text-[13px] text-[#a1a1aa]" aria-live="polite">{chartHeadline}</p>
                </div>
                <div role="tablist" aria-label="Métrica do gráfico" className="flex gap-0.5 bg-[#0e0e10] border border-[#232328] rounded-[9px] p-[3px]">
                  {([
                    ["gmv", "Vendas"],
                    ["orders", "Pedidos"],
                    ["pix", "Pix"],
                  ] as [ChartMetric, string][]).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={metric === id}
                      onClick={() => {
                        setMetric(id);
                        setHover(null);
                      }}
                      className={segClass(metric === id, true)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {daily.length > 0 ? (
                <>
                  <div className="flex gap-3">
                    <div
                      className={`flex-1 min-w-0 h-[220px] flex items-end border-b border-[#232328] ${daily.length > 45 ? "gap-px" : daily.length > 14 ? "gap-1" : "gap-3"}`}
                      onMouseLeave={() => setHover(null)}
                    >
                      {series.map((v, i) => (
                        <button
                          key={daily[i].date}
                          type="button"
                          aria-label={`${daily[i].label}: ${fmtSeries(v)}${unit}`}
                          onMouseEnter={() => setHover(i)}
                          onFocus={() => setHover(i)}
                          onBlur={() => setHover(null)}
                          className="flex-1 min-w-0 rounded-t-[4px] cursor-pointer transition-opacity"
                          style={{
                            height: `${maxValue > 0 ? Math.max(1.5, (v / maxValue) * 100) : 1.5}%`,
                            background: hover === i ? "#60a5fa" : "#2563eb",
                            opacity: hover === null || hover === i ? 1 : 0.45,
                          }}
                        />
                      ))}
                    </div>
                    <div className="w-[64px] h-[220px] flex flex-col justify-between text-[11px] text-[#8b8b94] text-right shrink-0">
                      <span>{formatAxisValue(maxValue, money)}</span>
                      <span>{formatAxisValue(maxValue / 2, money)}</span>
                      <span>0</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px] text-[#8b8b94] pr-[76px]">
                    <span>{daily[0].label}</span>
                    <span>{daily[daily.length - 1].label}</span>
                  </div>
                </>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-[13px] text-[#8b8b94]">Sem dados no período</div>
              )}
            </div>

            <div className={`${card} p-[18px] flex flex-col gap-4`}>
              <div className="flex justify-between items-baseline">
                <h2 className="text-[15px] font-semibold text-white">Checkout Pix</h2>
                <span className="text-[12px] text-[#8b8b94]">PushinPay</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-[13px] text-[#a1a1aa]">Conversão</span>
                  <span className="text-[26px] font-bold text-emerald-400">
                    {sp?.pixConversionRate !== null && sp?.pixConversionRate !== undefined ? pct(sp.pixConversionRate) : "—"}
                  </span>
                </div>
                <div className="h-2 bg-[#232328] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, sp?.pixConversionRate || 0))}%` }} />
                </div>
                <span className="text-[12px] text-[#8b8b94]">Pix pagos ÷ Pix gerados</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#0e0e10] border border-[#1c1c21] rounded-[10px] p-3">
                  <span className="block text-[12px] text-[#a1a1aa]">Gerados</span>
                  <span className="text-[18px] font-bold text-white">{int(sp?.pixGeneratedCount || 0)}</span>
                </div>
                <div className="bg-[#0e0e10] border border-[#1c1c21] rounded-[10px] p-3">
                  <span className="block text-[12px] text-[#a1a1aa]">Pagos</span>
                  <span className="text-[18px] font-bold text-emerald-400">{int(sp?.pixPaidCount || 0)}</span>
                </div>
              </div>
              <div className="mt-auto border-t border-[#232328] pt-3 space-y-1.5 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-[#a1a1aa]">Total aprovado</span>
                  <span className="font-semibold text-white">{brl(gmv)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a1a1aa]">Ticket médio</span>
                  <span className="font-semibold text-white">{brl(ticket)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Repasse das taxas (auditoria de splits) */}
          {fees && (
            <section aria-label="Repasse das taxas" className={`${card} p-[18px] flex flex-col gap-4`}>
              <div className="flex flex-wrap justify-between items-end gap-2">
                <div>
                  <h2 className="text-[15px] font-semibold text-white">Repasse das taxas</h2>
                  <p className="text-[13px] text-[#a1a1aa]">Conciliação dos splits entre a PushinPay e a WebGran</p>
                </div>
                {feesProgress !== null && (
                  <span className="text-[13px] text-[#a1a1aa]">{pct(feesProgress)} das taxas previstas já processadas</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    step: "1 · Previstas",
                    count: "elegíveis",
                    value: fees.expectedFeeTotal,
                    width: 100,
                    bar: "bg-zinc-600",
                    valueClass: "text-white",
                    desc: "Calculado nos pedidos pagos com a taxa de cada vendedor.",
                  },
                  {
                    step: "2 · Processadas",
                    count: `${int(fees.processedCount)} pedidos`,
                    value: fees.processedFeeTotal,
                    width: feesProgress ?? 0,
                    bar: "bg-emerald-500",
                    valueClass: "text-emerald-400",
                    desc: "Splits aceitos e confirmados pela PushinPay.",
                  },
                  {
                    step: "3 · Na conta",
                    count: `${int(fees.settledCount)} pedidos`,
                    value: fees.settledFeeTotal,
                    width: fees.expectedFeeTotal > 0 ? (fees.settledFeeTotal / fees.expectedFeeTotal) * 100 : 0,
                    bar: "bg-[#3b82f6]",
                    valueClass: "text-white",
                    desc: "Valor com liquidação bancária registrada (saldo em conta).",
                  },
                ].map((s) => (
                  <div key={s.step} className="bg-[#0e0e10] border border-[#1c1c21] rounded-xl p-3.5 flex flex-col gap-2">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#a1a1aa]">{s.step}</span>
                      <span className="text-[#8b8b94]">{s.count}</span>
                    </div>
                    <span className={`text-[22px] font-bold ${s.valueClass}`}>{brl(s.value)}</span>
                    <div className="h-[5px] bg-[#232328] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.min(100, Math.max(0, s.width))}%` }} />
                    </div>
                    <span className="text-[12px] text-[#8b8b94] leading-snug">{s.desc}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div
                  className={`rounded-xl p-3.5 flex flex-col gap-2.5 border ${
                    fees.pendingCount > 0 ? "border-amber-500/35 bg-amber-500/[0.06]" : "border-[#232328]"
                  }`}
                >
                  <div className="flex justify-between text-[13px]">
                    <span className={`font-semibold ${fees.pendingCount > 0 ? "text-amber-300" : "text-zinc-200"}`}>Pendentes</span>
                    <span className={fees.pendingCount > 0 ? "text-amber-300" : "text-[#8b8b94]"}>{int(fees.pendingCount)} pedidos</span>
                  </div>
                  <span className={`text-[20px] font-bold ${fees.pendingCount > 0 ? "text-amber-300" : "text-white"}`}>{brl(fees.pendingFeeTotal)}</span>
                  <button
                    type="button"
                    onClick={handleSync}
                    disabled={syncing}
                    className={`text-[13px] font-semibold rounded-[9px] py-2 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 ${
                      fees.pendingCount > 0 ? "bg-amber-400 text-[#1c1405] hover:bg-amber-300" : "bg-[#1c1c21] text-zinc-200 border border-[#2e2e34] hover:bg-[#232328]"
                    }`}
                  >
                    {syncing && <Loader2 className="w-4 h-4 animate-spin" />}
                    {syncing ? "Reconciliando…" : "Reconciliar agora"}
                  </button>
                  {syncResult && (
                    <span className="text-[12px] text-[#a1a1aa]">
                      {syncResult.updated} atualizados · {syncResult.skipped} isentos · {syncResult.divergence} divergentes · {syncResult.errors} erros
                    </span>
                  )}
                  {syncError && <span className="text-[12px] text-rose-300">{syncError}</span>}
                </div>
                <div className="rounded-xl p-3.5 flex flex-col gap-2.5 border border-[#232328]">
                  <div className="flex justify-between text-[13px]">
                    <span className="font-semibold text-zinc-200">Isentas</span>
                    <span className="text-[#8b8b94]">{int(fees.skippedCount)} pedidos</span>
                  </div>
                  <span className="text-[20px] font-bold text-white">{brl(fees.skippedFeeTotal)}</span>
                  <span className="text-[12px] text-[#8b8b94]">Taxa zero de propósito ou isenção promocional. Não é falha.</span>
                </div>
                <div className={`rounded-xl p-3.5 flex flex-col gap-2.5 border ${fees.failedCount > 0 ? "border-rose-500/35 bg-rose-500/[0.06]" : "border-[#232328]"}`}>
                  <div className="flex justify-between text-[13px]">
                    <span className={`font-semibold ${fees.failedCount > 0 ? "text-rose-300" : "text-zinc-200"}`}>Com falha</span>
                    <span className="text-[#8b8b94]">{int(fees.failedCount)} pedidos</span>
                  </div>
                  <span className={`text-[20px] font-bold ${fees.failedCount > 0 ? "text-rose-300" : "text-white"}`}>{brl(fees.failedFeeTotal)}</span>
                  <span className={`text-[12px] ${fees.failedCount > 0 ? "text-rose-300" : "text-emerald-400"}`}>
                    {fees.failedCount > 0 ? "Splits com erro de comunicação que pedem atenção." : "Nenhuma falha de comunicação no período."}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* 4. Ecossistema */}
          <section
            aria-label="Ecossistema"
            className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-px bg-[#232328] border border-[#232328] rounded-2xl overflow-hidden"
          >
            {eco.map((e) => (
              <div key={e.label} className="bg-[#131316] px-[18px] py-4 flex flex-col gap-1">
                <span className="text-[12px] text-[#a1a1aa]">{e.label}</span>
                <span className="text-[20px] font-bold text-white">{e.value}</span>
                <span className="text-[12px] text-[#8b8b94]">{e.sub}</span>
              </div>
            ))}
          </section>

          {/* 5. Ranking de vendedores */}
          <section aria-label="Ranking de vendedores" className={`${card} p-[18px] flex flex-col gap-3`}>
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-white">Vendedores que mais vendem</h2>
                {top3Share !== null && (
                  <p className="text-[13px] text-[#a1a1aa]">Os 3 primeiros fazem {pct(top3Share)} das vendas do período</p>
                )}
              </div>
              <div role="group" aria-label="Ordenar ranking" className="flex gap-0.5 bg-[#0e0e10] border border-[#232328] rounded-[9px] p-[3px]">
                {([
                  ["gmv", "Vendas"],
                  ["orders", "Pedidos"],
                  ["fees", "Taxas"],
                ] as [RankingSort, string][]).map(([id, label]) => (
                  <button key={id} type="button" aria-pressed={sort === id} onClick={() => setSort(id)} className={segClass(sort === id, true)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {ranking.length === 0 ? (
              <p className="text-[13px] text-[#8b8b94] py-6 text-center">Nenhuma venda no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-[13px]">
                  <thead>
                    <tr className="text-left text-[12px] text-[#8b8b94]">
                      <th className="font-medium py-2 pr-2 w-8">#</th>
                      <th className="font-medium p-2">Vendedor</th>
                      <th className="font-medium p-2 w-[24%]">Participação</th>
                      <th className="font-medium p-2 text-right">Pedidos</th>
                      <th className="font-medium p-2 text-right">Vendas</th>
                      <th className="font-medium py-2 pl-2 text-right">Taxas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((r, i) => {
                      const share = gmv > 0 ? (r.approvedGmv / gmv) * 100 : 0;
                      return (
                        <tr key={r.sellerId} className="border-t border-[#1c1c21] hover:bg-[#16161a]">
                          <td className="py-2.5 pr-2 text-[#8b8b94]">{i + 1}</td>
                          <td className="p-2">
                            <span className="block font-semibold text-white">
                              {r.sellerName}
                              {r.storeName && <span className="font-normal text-[#a1a1aa]"> · {r.storeName}</span>}
                            </span>
                            <span className="block text-[12px] text-[#71717a]">{r.sellerEmail}</span>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-[5px] bg-[#232328] rounded-full overflow-hidden">
                                <div className="h-full bg-[#3b82f6] rounded-full" style={{ width: `${Math.max(share, r.approvedGmv > 0 ? 1 : 0)}%` }} />
                              </div>
                              <span className="w-11 text-right text-[12px] text-[#a1a1aa]">{pct(share)}</span>
                            </div>
                          </td>
                          <td className="p-2 text-right">{int(r.paidOrdersCount)}</td>
                          <td className="p-2 text-right font-semibold text-white">{brl(r.approvedGmv)}</td>
                          <td className="py-2.5 pl-2 text-right text-emerald-400">
                            {brl(r.processedFees)}
                            <span className="block text-[11px] text-[#71717a]">
                              {r.approvedGmv > 0 ? `${pct((r.processedFees / r.approvedGmv) * 100)} das vendas` : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 6. Últimos pedidos + ecossistema Telegram */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <div className={`${card} xl:col-span-2 p-[18px] flex flex-col`}>
              <div className="flex justify-between items-baseline mb-2.5">
                <h2 className="text-[15px] font-semibold text-white">Últimos pedidos aprovados</h2>
                <a href="/admin/orders" className="text-[12px] text-[#93c5fd] hover:text-[#bfdbfe]">
                  Ver todos os pedidos
                </a>
              </div>
              {data.recentSales.length === 0 ? (
                <p className="text-[13px] text-[#8b8b94] py-6 text-center">Nenhum pedido aprovado ainda.</p>
              ) : (
                data.recentSales.map((sale) => {
                  const status = describeSplitStatus(sale.splitStatus);
                  const name = sale.customerName?.trim() || "Cliente";
                  return (
                    <div key={sale.id} className="flex items-center gap-3 py-2.5 px-1 border-t border-[#1c1c21] rounded-lg hover:bg-[#16161a]">
                      <span className="w-[30px] h-[30px] rounded-full bg-[#1f2937] text-[#93c5fd] flex items-center justify-center text-[12px] font-semibold shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </span>
                      <span className="flex-1 min-w-0 flex flex-col">
                        <span className="text-[13px] font-semibold text-white truncate">{name}</span>
                        <span className="text-[12px] text-[#8b8b94] truncate">
                          {sale.storeName} · {sale.sellerName}
                        </span>
                      </span>
                      <span className={`hidden sm:inline text-[11px] font-semibold rounded-full px-2 py-[3px] whitespace-nowrap ${status.className}`}>
                        {status.label}
                      </span>
                      <span className="flex flex-col items-end min-w-[84px]">
                        <span className="text-[13px] font-semibold text-white">{brl(sale.total)}</span>
                        <span className="text-[11px] text-[#8b8b94]">
                          {new Date(sale.createdAt).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className={`${card} p-[18px] flex flex-col gap-3.5`}>
              <h2 className="text-[15px] font-semibold text-white">Ecossistema Telegram</h2>
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] text-[#a1a1aa]">Bots conectados</span>
                <span className="text-[22px] font-bold text-white">
                  {int(data.telegramStats.activeBots)}{" "}
                  <span className="text-[14px] font-medium text-[#a1a1aa]">de {int(data.telegramStats.totalBots)} ativos</span>
                </span>
                <div className="h-1.5 bg-[#232328] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{
                      width: `${data.telegramStats.totalBots > 0 ? (data.telegramStats.activeBots / data.telegramStats.totalBots) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#0e0e10] border border-[#1c1c21] rounded-[10px] p-3">
                  <span className="block text-[12px] text-[#a1a1aa]">Clientes no total</span>
                  <span className="text-[18px] font-bold text-white">{int(data.telegramStats.totalCustomers)}</span>
                </div>
                <div className="bg-[#0e0e10] border border-[#1c1c21] rounded-[10px] p-3">
                  <span className="block text-[12px] text-[#a1a1aa]">Novos no período</span>
                  <span className="text-[18px] font-bold text-emerald-400">+{int(data.telegramStats.newCustomersPeriod)}</span>
                </div>
              </div>
              <p className="mt-auto text-[12px] text-[#8b8b94] leading-relaxed">{data.telegramStats.attributionNote}</p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
