"use client";

import { useState, useTransition } from "react";
import { Check, Download, Gift, Lock, Sparkles, Trophy, X, Wallet, Target, Hourglass } from "lucide-react";
import SellerPageHeader from "@/components/layout/SellerPageHeader";
import { PlaqueArt } from "@/components/rewards/PlaqueArt";
import {
  PLAQUES,
  REDEMPTION_STATUS_LABEL,
  brl,
  formatGoalPercent,
  formatPlaqueLong,
  plaqueProgress,
  type Plaque,
  type PlaqueArtMap,
  type RedemptionStatus,
} from "@/lib/rewards/plaques";
import { BR_UFS } from "@/lib/rewards/validate";
import { requestPlaqueRedemption } from "./actions";

export type RedemptionView = {
  id: string;
  plaqueValue: number;
  status: RedemptionStatus;
  trackingCode: string | null;
  createdAt: string;
};

const brlInt = (v: number) => brl(v).replace(/,\d{2}$/, "");

/** Posição (0–1) do faturamento na linha do tempo, com os marcos igualmente espaçados. */
function timelinePosition(revenue: number): number {
  const n = PLAQUES.length;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const v = PLAQUES[i].value;
    if (revenue < v) {
      const within = (revenue - prev) / (v - prev);
      return (i - 1 + Math.max(0, within)) / (n - 1);
    }
    prev = v;
  }
  return 1;
}

export default function PremiacoesClient({
  revenue,
  redemptions,
  redemptionReady,
  arts,
}: {
  revenue: number;
  redemptions: RedemptionView[];
  redemptionReady: boolean;
  /** Arte em uso de cada placa (troca do admin ou padrão). */
  arts: PlaqueArtMap;
}) {
  const { next, allReached, current, reachedCount } = plaqueProgress(revenue);
  const [redeeming, setRedeeming] = useState<Plaque | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeRedemption = (value: number) =>
    redemptions.find((r) => r.plaqueValue === value && r.status !== "CANCELED") ?? null;

  const hero = allReached ? PLAQUES[PLAQUES.length - 1] : next;
  const heroRatio = Math.min(1, revenue / hero.value);
  const t = hero.theme;
  const levelTheme = (current ?? PLAQUES[0]).theme;
  const linePos = Math.max(0, timelinePosition(revenue));

  return (
    <div className="w-full min-w-0 pb-16">
      <SellerPageHeader
        title="Premiações"
        subtitle="Placas por faturamento acumulado. São permanentes e nunca resetam."
        actions={
          <div
            className="inline-flex items-center gap-2 pl-2 pr-3 h-9 rounded-full border text-xs"
            style={{ borderColor: `rgba(${levelTheme.rgb},0.28)`, background: `rgba(${levelTheme.rgb},0.06)` }}
          >
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: `rgba(${levelTheme.rgb},0.16)`, color: levelTheme.light }}
            >
              <Trophy className="w-3.5 h-3.5" />
            </span>
            <span className="text-zinc-500 hidden sm:inline">Nível</span>
            <span className="font-semibold text-zinc-100">{current ? current.level : "Iniciante"}</span>
            <span className="w-px h-3.5 bg-white/10" />
            <span className="font-medium text-zinc-300 tabular-nums">{brlInt(revenue)}</span>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-[1320px] flex flex-col gap-12">
        {notice && (
          <div className="rounded-xl border border-[#3b82f6]/30 bg-[#3b82f6]/10 px-4 py-3 text-sm text-[#93c5fd] flex items-center justify-between gap-3">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso" className="text-zinc-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ===================== Destaque: próxima conquista ===================== */}
        <section
          className="relative overflow-hidden rounded-[28px] border border-white/[0.06] p-6 sm:p-8 lg:p-10"
          style={{
            background: `radial-gradient(55% 90% at 14% 35%, rgba(${t.rgb},0.16) 0%, rgba(${t.rgb},0) 70%), linear-gradient(180deg, #101116 0%, #0b0c0f 100%)`,
          }}
        >
          {/* filete de luz no topo */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-[8%] right-[8%] h-px"
            style={{ background: `linear-gradient(90deg, transparent, rgba(${t.rgb},0.7), transparent)` }}
          />

          <div className="relative grid gap-8 lg:gap-14 md:grid-cols-[minmax(0,240px)_1fr] items-center">
            {/* Placa em vitrine: halo, placa e reflexo */}
            <div className="relative w-[170px] sm:w-[200px] md:w-full mx-auto">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-8 rounded-full"
                style={{ background: `radial-gradient(closest-side, rgba(${t.rgb},0.45), rgba(${t.rgb},0))`, filter: "blur(18px)" }}
              />
              <PlaqueArt
                plaque={hero}
                src={arts[hero.value]}
                sheen
                className="shadow-[0_30px_60px_-25px_rgba(0,0,0,0.9)]"
              />
              {/* reflexo no chão */}
              <div aria-hidden="true" className="relative h-14 overflow-hidden mt-1 opacity-35 [mask-image:linear-gradient(180deg,#000,transparent)]">
                <div className="-scale-y-100 origin-top">
                  <PlaqueArt plaque={hero} src={arts[hero.value]} />
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.28em]" style={{ color: t.light }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.main, boxShadow: `0 0 10px rgba(${t.rgb},0.9)` }} />
                {allReached ? "Coleção completa" : "Sua próxima conquista"}
              </p>
              <h2
                className="mt-3 text-[40px] sm:text-[52px] leading-[0.95] font-bold tracking-[-0.03em] bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(180deg, #ffffff 30%, ${t.light} 130%)` }}
              >
                Placa {hero.short}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Nível <span className="text-zinc-200 font-medium">{hero.level}</span> · {formatPlaqueLong(hero.value)} em vendas
              </p>

              {/* números */}
              <div className="mt-7 grid grid-cols-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-x divide-white/[0.06]">
                {[
                  { icon: Wallet, label: "Faturado", value: brlInt(revenue) },
                  { icon: Target, label: "Meta", value: brlInt(hero.value) },
                  { icon: Hourglass, label: allReached ? "Status" : "Faltam", value: allReached ? "Concluída" : brlInt(Math.max(0, hero.value - revenue)) },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="px-3 sm:px-5 py-3.5 min-w-0">
                    <p className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] text-zinc-500">
                      <Icon className="w-3 h-3" /> {label}
                    </p>
                    <p className="mt-1 text-[15px] sm:text-lg font-semibold text-white tabular-nums truncate">{value}</p>
                  </div>
                ))}
              </div>

              {/* progresso */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                  <span>Progresso até a placa</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: t.light }}>
                    {formatGoalPercent(revenue, hero.value)}
                  </span>
                </div>
                <div className="relative h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="relative h-full rounded-full overflow-hidden transition-all duration-1000 ease-out"
                    style={{
                      width: `max(${revenue > 0 ? "10px" : "0px"}, ${heroRatio * 100}%)`,
                      background: t.gradient,
                      boxShadow: `0 0 16px rgba(${t.rgb},0.7)`,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 w-1/2 animate-[plaque-sheen_3.5s_ease-in-out_infinite] motion-reduce:hidden"
                      style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)" }}
                    />
                  </div>
                </div>
              </div>

              {/* linha do tempo dos marcos */}
              <ol className="relative mt-9 grid grid-cols-5" aria-label="Marcos de faturamento">
                <span aria-hidden="true" className="absolute left-[10%] right-[10%] top-[13px] h-[2px] rounded-full bg-white/[0.07]" />
                <span
                  aria-hidden="true"
                  className="absolute left-[10%] top-[13px] h-[2px] rounded-full transition-all duration-1000"
                  style={{ width: `calc(80% * ${linePos})`, background: t.gradient, boxShadow: `0 0 8px rgba(${t.rgb},0.6)` }}
                />
                {PLAQUES.map((p) => {
                  const done = revenue >= p.value;
                  const isNext = !allReached && p.value === next.value;
                  return (
                    <li key={p.value} className="relative flex flex-col items-center gap-2">
                      <span
                        className={`relative w-7 h-7 rounded-full flex items-center justify-center border ${
                          isNext ? "animate-[plaque-pulse_1.8s_ease-out_infinite] motion-reduce:animate-none" : ""
                        }`}
                        style={
                          {
                            "--pulse-rgb": p.theme.rgb,
                            ...(done
                              ? { background: p.theme.gradient, borderColor: "transparent", boxShadow: `0 0 12px rgba(${p.theme.rgb},0.55)` }
                              : isNext
                                ? { background: "#0d0e12", borderColor: p.theme.main }
                                : { background: "#0d0e12", borderColor: "rgba(255,255,255,0.1)" }),
                          } as unknown as React.CSSProperties
                        }
                      >
                        {done ? (
                          <Check className="w-3.5 h-3.5 text-black/75" strokeWidth={3} />
                        ) : isNext ? (
                          <span className="w-2 h-2 rounded-full" style={{ background: p.theme.main }} />
                        ) : (
                          <span className="w-1 h-1 rounded-full bg-white/25" />
                        )}
                      </span>
                      <span className="flex flex-col items-center leading-tight">
                        <span className={`text-[11.5px] font-semibold tabular-nums ${done || isNext ? "text-zinc-100" : "text-zinc-600"}`}>{p.short}</span>
                        <span className="hidden sm:block text-[10px]" style={{ color: done || isNext ? p.theme.light : "#52525b" }}>
                          {p.level}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </section>

        {/* ===================== Coleção ===================== */}
        <section>
          <div className="flex items-end justify-between gap-3 mb-5">
            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.28em] text-zinc-500">COLEÇÃO</p>
              <h3 className="mt-1 text-xl font-semibold text-white tracking-tight">Suas placas</h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 tabular-nums">
              <span className="flex gap-1">
                {PLAQUES.map((p) => (
                  <span
                    key={p.value}
                    className="w-4 h-1 rounded-full"
                    style={{ background: revenue >= p.value ? p.theme.main : "rgba(255,255,255,0.1)" }}
                  />
                ))}
              </span>
              {reachedCount} de {PLAQUES.length}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-5">
            {PLAQUES.map((p, i) => {
              const done = revenue >= p.value;
              const isNext = !allReached && p.value === next.value;
              const locked = !done && !isNext;
              const red = activeRedemption(p.value);
              const pt = p.theme;
              return (
                <article
                  key={p.value}
                  className="group relative rounded-[22px] p-2.5 pb-3.5 flex flex-col gap-3 border transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background: "linear-gradient(180deg, #111216 0%, #0c0d10 100%)",
                    borderColor: isNext ? `rgba(${pt.rgb},0.45)` : done ? `rgba(${pt.rgb},0.18)` : "rgba(255,255,255,0.05)",
                    boxShadow: isNext ? `0 20px 50px -25px rgba(${pt.rgb},0.7)` : undefined,
                  }}
                >
                  <div className="relative">
                    {!locked && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -inset-2 rounded-[20px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{ background: `radial-gradient(closest-side, rgba(${pt.rgb},0.35), transparent)`, filter: "blur(14px)" }}
                      />
                    )}
                    <PlaqueArt plaque={p} src={arts[p.value]} locked={locked} sheen={isNext} className="relative" />
                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-[3px] rounded-full border backdrop-blur-md"
                        style={
                          locked
                            ? { color: "#a1a1aa", borderColor: "rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.55)" }
                            : { color: pt.light, borderColor: `rgba(${pt.rgb},0.35)`, background: "rgba(0,0,0,0.55)" }
                        }
                      >
                        {done ? <Check className="w-3 h-3" /> : isNext ? <Sparkles className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {done ? "Conquistada" : isNext ? "Próxima" : "Bloqueada"}
                      </span>
                      <span className="text-[10px] font-semibold text-white/40 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    </div>
                  </div>

                  <div className="px-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold text-white tracking-tight">Placa {p.short}</p>
                      <p className="text-[11px] font-medium truncate" style={{ color: locked ? "#71717a" : pt.light }}>
                        {p.level}
                      </p>
                    </div>
                    <div className="mt-2.5 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(1, revenue / p.value) * 100}%`, background: locked ? "#3f3f46" : pt.gradient }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[10.5px] tabular-nums text-zinc-500">
                      <span>{formatGoalPercent(revenue, p.value)}</span>
                      <span>{formatPlaqueLong(p.value)}</span>
                    </div>
                  </div>

                  <div className="mt-auto px-1.5 flex flex-col gap-2">
                    {done ? (
                      <>
                        {red ? (
                          <div className="rounded-xl border px-3 py-2 text-center" style={{ borderColor: `rgba(${pt.rgb},0.25)`, background: `rgba(${pt.rgb},0.07)` }}>
                            <p className="text-xs font-semibold" style={{ color: pt.light }}>
                              {REDEMPTION_STATUS_LABEL[red.status]}
                            </p>
                            {red.trackingCode && <p className="mt-0.5 text-[10.5px] text-zinc-400 break-all">Rastreio: {red.trackingCode}</p>}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRedeeming(p)}
                            className="h-9 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors shadow-[0_8px_20px_-10px_rgba(59,130,246,0.9)]"
                          >
                            <Gift className="w-3.5 h-3.5" /> Resgatar placa
                          </button>
                        )}
                        {arts[p.value] && (
                          <a
                            href={arts[p.value] ?? undefined}
                            download={`placa-${p.short.toLowerCase().replace(",", "-")}.webp`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-8 rounded-xl text-[11.5px] font-medium text-zinc-400 hover:text-white inline-flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> Baixar arte
                          </a>
                        )}
                      </>
                    ) : isNext ? (
                      <span
                        className="h-9 rounded-xl text-xs font-semibold inline-flex items-center justify-center tabular-nums border"
                        style={{ color: pt.light, borderColor: `rgba(${pt.rgb},0.35)`, background: `rgba(${pt.rgb},0.08)` }}
                      >
                        Faltam {brlInt(p.value - revenue)}
                      </span>
                    ) : (
                      <span className="h-9 rounded-xl text-[11.5px] text-zinc-600 inline-flex items-center justify-center gap-1.5">
                        <Lock className="w-3 h-3" /> Libera em {formatPlaqueLong(p.value)}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ===================== Como funciona ===================== */}
        <section>
          <p className="text-[10.5px] font-semibold tracking-[0.28em] text-zinc-500 mb-4">COMO FUNCIONA</p>
          <ol className="grid gap-3 md:grid-cols-3">
            {[
              ["Venda pela WebGran", "Todo pagamento aprovado soma no seu faturamento acumulado. Reembolsos e chargebacks não contam."],
              ["Bata a meta", "Ao atingir o valor, a placa é desbloqueada na hora e fica sua para sempre."],
              ["Receba em casa", "Clique em Resgatar, informe o endereço e acompanhe aqui a produção e o envio."],
            ].map(([title, text], i) => (
              <li key={title} className="relative rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
                <span className="text-[34px] font-bold leading-none tracking-tight text-white/[0.07] absolute right-4 top-3 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-sm font-semibold text-zinc-100">{title}</p>
                <p className="mt-1 text-xs text-zinc-500 leading-relaxed pr-6">{text}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {redeeming && (
        <RedeemModal
          plaque={redeeming}
          ready={redemptionReady}
          onClose={() => setRedeeming(null)}
          onDone={() => {
            setRedeeming(null);
            setNotice(`Pedido da Placa ${redeeming.short} recebido! Você acompanha o status aqui.`);
          }}
        />
      )}
    </div>
  );
}

const inputCls =
  "w-full h-10 rounded-lg bg-[#15171D] border border-white/[0.08] px-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#3b82f6]";

function RedeemModal({ plaque, ready, onClose, onDone }: { plaque: Plaque; ready: boolean; onClose: () => void; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await requestPlaqueRedemption(plaque.value, fd);
      if (res.ok) onDone();
      else setError(res.error);
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Resgatar Placa ${plaque.short}`}>
      <form onSubmit={submit} className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0f1117] p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Resgatar Placa {plaque.short}</h2>
            <p className="text-xs text-zinc-500">Informe onde a placa física deve ser entregue.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!ready && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            O resgate ainda não está ativo: falta rodar a migração 0027 no banco.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome completo" className="col-span-2"><input name="fullName" required className={inputCls} autoComplete="name" /></Field>
          <Field label="Telefone (com DDD)"><input name="phone" required inputMode="tel" className={inputCls} autoComplete="tel" placeholder="(11) 99999-9999" /></Field>
          <Field label="CEP"><input name="zipCode" required inputMode="numeric" className={inputCls} autoComplete="postal-code" placeholder="00000-000" /></Field>
          <Field label="Rua" className="col-span-2"><input name="street" required className={inputCls} autoComplete="address-line1" /></Field>
          <Field label="Número"><input name="number" required className={inputCls} /></Field>
          <Field label="Complemento"><input name="complement" className={inputCls} autoComplete="address-line2" /></Field>
          <Field label="Bairro"><input name="district" required className={inputCls} /></Field>
          <Field label="Cidade"><input name="city" required className={inputCls} autoComplete="address-level2" /></Field>
          <Field label="Estado (UF)">
            <select name="state" required defaultValue="" className={inputCls}>
              <option value="" disabled>Selecione</option>
              {BR_UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </Field>
          <Field label="Observações" className="col-span-2"><textarea name="notes" rows={2} maxLength={500} className={`${inputCls} h-auto py-2`} /></Field>
        </div>

        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg border border-white/10 text-sm text-zinc-300 hover:bg-white/[0.05]">
            Cancelar
          </button>
          <button type="submit" disabled={pending} className="h-10 px-4 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-60 text-sm font-semibold text-white">
            {pending ? "Enviando..." : "Confirmar pedido"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}
