"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Crown, Layers, Package, Receipt } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WebOverview } from "@/lib/webstore/overview";

const SURFACE =
  "relative rounded-[14px] border border-white/[0.07] bg-[linear-gradient(180deg,#191a1f_0%,#121317_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_1px_2px_rgba(0,0,0,0.45),0_14px_30px_-16px_rgba(0,0,0,0.9)]";
const BLUE = "#3b82f6";
const TZ = "America/Sao_Paulo";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brlShort = (n: number) => (n >= 1000 ? `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : brl(n));
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ }); // AAAA-MM-DD no horário de Brasília
const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];

/** Visão geral da Loja Web: ganhos do período, gráfico por dia, mais vendidos e últimas vendas. */
export default function OverviewPane({ data }: { data: WebOverview }) {
  const [days, setDays] = useState<Period>(30);
  // "Agora" fixo de quando a aba abriu (o recorte não muda sozinho enquanto a pessoa olha)
  const [now] = useState(() => Date.now());

  const v = useMemo(() => {
    const start = now - days * 86400_000;
    const prevStart = start - days * 86400_000;
    const inRange = (iso: string | null, a: number, b: number) => {
      if (!iso) return false;
      const t = Date.parse(iso);
      return t >= a && t < b;
    };
    const paid = data.orders.filter((o) => o.status === "paid" && inRange(o.paidAt, start, now + 1));
    const paidPrev = data.orders.filter((o) => o.status === "paid" && inRange(o.paidAt, prevStart, start));
    const created = data.orders.filter((o) => inRange(o.createdAt, start, now + 1));
    const revenue = paid.reduce((a, o) => a + o.total, 0);
    const revenuePrev = paidPrev.reduce((a, o) => a + o.total, 0);

    // Série por dia (todos os dias do período, inclusive os sem venda)
    const buckets = new Map<string, { revenue: number; count: number }>();
    for (let k = days - 1; k >= 0; k--) buckets.set(dayKey(new Date(now - k * 86400_000)), { revenue: 0, count: 0 });
    for (const o of paid) {
      const b = buckets.get(dayKey(new Date(o.paidAt!)));
      if (b) {
        b.revenue += o.total;
        b.count += 1;
      }
    }
    const series = [...buckets.entries()].map(([k, b]) => {
      const d = new Date(`${k}T12:00:00`);
      return {
        key: k,
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        full: d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "long" }),
        revenue: Math.round(b.revenue * 100) / 100,
        count: b.count,
      };
    });

    // Mais vendidos e receita por tipo
    const top = new Map<string, { title: string; revenue: number; qty: number }>();
    const kind = { avulso: 0, combo: 0, vip: 0 };
    for (const o of paid)
      for (const it of o.items) {
        const t = top.get(it.key) || { title: it.title, revenue: 0, qty: 0 };
        t.revenue += it.total;
        t.qty += it.quantity;
        top.set(it.key, t);
        if (it.vip) kind.vip += it.total;
        else if (it.combo) kind.combo += it.total;
        else kind.avulso += it.total;
      }
    const topList = [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);

    return {
      revenue,
      delta: revenuePrev > 0 ? ((revenue - revenuePrev) / revenuePrev) * 100 : null,
      paidCount: paid.length,
      ticket: paid.length ? revenue / paid.length : 0,
      conversion: created.length ? (created.filter((o) => o.status === "paid").length / created.length) * 100 : null,
      createdCount: created.length,
      newCustomers: data.newCustomers.filter((c) => inRange(c, start, now + 1)).length,
      series,
      topList,
      kind,
      recent: paid.slice(0, 6),
    };
  }, [data, days, now]);

  const best = v.series.reduce((a, b) => (b.revenue > a.revenue ? b : a), v.series[0]);
  const kindTotal = v.kind.avulso + v.kind.combo + v.kind.vip;

  return (
    <div className="space-y-4">
      {/* Período: uma linha só, acima de tudo */}
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Período" className="inline-grid grid-cols-3 p-1 rounded-[10px] bg-black/30 border border-white/[0.07]">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={days === p}
              onClick={() => setDays(p)}
              className={`h-8 px-3.5 rounded-[7px] text-[12.5px] font-medium transition-colors ${days === p ? "bg-[#26282f] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              {p} dias
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-zinc-500">Só vendas da Loja Web. Bot e Mini App ficam de fora.</p>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`${SURFACE} p-4 col-span-2 lg:col-span-1`}>
          <p className="text-[12px] text-zinc-500">Faturamento</p>
          <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight leading-none">{brl(v.revenue)}</p>
          <p className="mt-2 text-[12px] text-zinc-500 flex items-center gap-1">
            {v.delta === null ? (
              "sem vendas no período anterior"
            ) : (
              <>
                <span className={`inline-flex items-center font-semibold ${v.delta >= 0 ? "text-zinc-200" : "text-zinc-400"}`}>
                  {v.delta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 text-[#3b82f6]" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {Math.abs(v.delta).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
                </span>
                vs. {days} dias anteriores
              </>
            )}
          </p>
        </div>
        <Kpi label="Vendas pagas" value={String(v.paidCount)} hint={`${v.createdCount} PIX gerados`} />
        <Kpi label="Ticket médio" value={brl(v.ticket)} hint="por venda paga" />
        <Kpi
          label="PIX pagos"
          value={v.conversion === null ? "—" : `${v.conversion.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`}
          hint="dos PIX gerados no período"
        />
      </div>

      {/* Receita por dia */}
      <section className={`${SURFACE} p-5`}>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-1 mb-4">
          <div className="mr-auto">
            <h3 className="text-[15px] font-semibold">Receita por dia</h3>
            <p className="text-[12.5px] text-zinc-500 mt-0.5">Vendas pagas, pelo dia do pagamento (horário de Brasília).</p>
          </div>
          {best && best.revenue > 0 && (
            <p className="text-[12.5px] text-zinc-500">
              Melhor dia: <b className="text-zinc-200 font-semibold">{best.full}</b> · <span className="tabular-nums text-zinc-200">{brl(best.revenue)}</span>
            </p>
          )}
        </div>
        {v.paidCount === 0 ? (
          <div className="h-[240px] flex flex-col items-center justify-center text-center rounded-[10px] border border-dashed border-white/[0.08]">
            <Receipt className="w-8 h-8 text-zinc-600 mb-2" />
            <p className="text-[13.5px] text-zinc-400">Nenhuma venda paga nos últimos {days} dias.</p>
            <p className="text-[12px] text-zinc-500 mt-0.5">Quando entrar o primeiro PIX, o gráfico aparece aqui.</p>
          </div>
        ) : (
          <div className="h-[260px] -ml-2" role="img" aria-label={`Receita por dia nos últimos ${days} dias. Total ${brl(v.revenue)}.`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={v.series} margin={{ top: 6, right: 6, bottom: 0, left: 0 }} barCategoryGap={days > 30 ? 1 : 2}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  interval={days === 7 ? 0 : days === 30 ? 4 : 13}
                  minTickGap={8}
                />
                <YAxis tickLine={false} axisLine={false} width={64} tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(n: number) => brlShort(n)} allowDecimals={false} />
                <Tooltip cursor={{ fill: "rgba(59,130,246,0.08)" }} content={<DayTip />} isAnimationActive={false} />
                <Bar dataKey="revenue" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4">
        {/* Mais vendidos */}
        <section className={`${SURFACE} p-5`}>
          <h3 className="text-[15px] font-semibold mb-3">Mais vendidos</h3>
          {v.topList.length === 0 ? (
            <p className="text-[13px] text-zinc-500 py-6 text-center">Sem vendas no período.</p>
          ) : (
            <ol className="space-y-3">
              {v.topList.map((t, k) => (
                <li key={t.title + k} className="min-w-0">
                  <div className="flex items-baseline gap-3 text-[13px]">
                    <span className="w-4 text-zinc-500 tabular-nums shrink-0">{k + 1}</span>
                    <span className="truncate flex-1 text-zinc-200">{t.title}</span>
                    <span className="text-zinc-500 tabular-nums shrink-0">{t.qty}×</span>
                    <span className="w-[84px] text-right font-semibold tabular-nums shrink-0">{brl(t.revenue)}</span>
                  </div>
                  <div className="ml-7 mt-1.5 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className="h-full rounded-full bg-[#3b82f6]" style={{ width: `${Math.max(3, (t.revenue / v.topList[0].revenue) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="space-y-4">
          {/* De onde vem a receita */}
          <section className={`${SURFACE} p-5`}>
            <h3 className="text-[15px] font-semibold mb-3">De onde vem a receita</h3>
            <ul className="space-y-2.5">
              {[
                { label: "Títulos avulsos", value: v.kind.avulso, icon: Package },
                { label: "Combos", value: v.kind.combo, icon: Layers },
                { label: "Planos VIP", value: v.kind.vip, icon: Crown },
              ].map((r) => (
                <li key={r.label} className="flex items-center gap-3 text-[13px]">
                  <r.icon className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span className="flex-1 text-zinc-300">{r.label}</span>
                  <span className="text-zinc-500 tabular-nums">{kindTotal ? Math.round((r.value / kindTotal) * 100) : 0}%</span>
                  <span className="w-[84px] text-right font-semibold tabular-nums">{brl(r.value)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-3 gap-2 text-center">
              <Mini label="VIP ativos" value={String(data.vipActive)} />
              <Mini label="Novos clientes" value={String(v.newCustomers)} />
              <Mini label="Desde o início" value={brlShort(data.allTime.revenue)} />
            </div>
          </section>

          {/* Últimas vendas */}
          <section className={`${SURFACE} p-5`}>
            <h3 className="text-[15px] font-semibold mb-3">Últimas vendas</h3>
            {v.recent.length === 0 ? (
              <p className="text-[13px] text-zinc-500 py-4 text-center">Sem vendas no período.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {v.recent.map((o) => (
                  <li key={o.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-zinc-200 truncate">{o.items.map((i) => i.title).join(", ") || "Pedido"}</p>
                      <p className="text-[11.5px] text-zinc-500">
                        {new Date(o.paidAt!).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className="text-[13px] font-semibold tabular-nums shrink-0">{brl(o.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className={`${SURFACE} p-4`}>
      <p className="text-[12px] text-zinc-500">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight leading-none">{value}</p>
      <p className="mt-2 text-[12px] text-zinc-500">{hint}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[15px] font-semibold tabular-nums truncate">{value}</p>
      <p className="text-[11px] text-zinc-500">{label}</p>
    </div>
  );
}

function DayTip({ active, payload }: { active?: boolean; payload?: { payload: { full: string; revenue: number; count: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#151821] border border-white/10 rounded-[10px] px-3 py-2.5 shadow-2xl text-[12px] min-w-[160px] pointer-events-none">
      <p className="font-semibold text-zinc-200 mb-1.5 capitalize">{d.full}</p>
      <p className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-zinc-400">
          <span className="w-2 h-2 rounded-[2px] bg-[#3b82f6]" /> Receita
        </span>
        <b className="tabular-nums text-white">{brl(d.revenue)}</b>
      </p>
      <p className="flex items-center justify-between gap-4 mt-0.5">
        <span className="text-zinc-400 pl-3.5">Vendas</span>
        <span className="tabular-nums text-zinc-300">{d.count}</span>
      </p>
    </div>
  );
}
