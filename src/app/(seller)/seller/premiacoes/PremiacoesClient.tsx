"use client";

import { useState, useTransition } from "react";
import { Check, Download, Gift, Lock, Sparkles, Trophy, X } from "lucide-react";
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

export default function PremiacoesClient({
  revenue,
  redemptions,
  redemptionReady,
}: {
  revenue: number;
  redemptions: RedemptionView[];
  redemptionReady: boolean;
}) {
  const { next, allReached, current, reachedCount } = plaqueProgress(revenue);
  const [redeeming, setRedeeming] = useState<Plaque | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeRedemption = (value: number) =>
    redemptions.find((r) => r.plaqueValue === value && r.status !== "CANCELED") ?? null;

  const hero = allReached ? PLAQUES[PLAQUES.length - 1] : next;
  const heroRatio = Math.min(1, revenue / hero.value);
  const t = hero.theme;

  return (
    <div className="w-full min-w-0 pb-16 flex flex-col gap-8">
      <SellerPageHeader
        title="Premiações"
        subtitle="Placas por faturamento acumulado. São permanentes e nunca resetam."
        actions={
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs"
            style={{
              borderColor: `rgba(${(current ?? PLAQUES[0]).theme.rgb},0.35)`,
              background: `rgba(${(current ?? PLAQUES[0]).theme.rgb},0.08)`,
            }}
          >
            <Trophy className="w-4 h-4" style={{ color: (current ?? PLAQUES[0]).theme.light }} />
            <span className="text-zinc-400">Seu nível atual</span>
            <span className="font-semibold text-zinc-100">
              {current ? current.level : "Iniciante"} · {brlInt(revenue)}
            </span>
          </div>
        }
      />

      {notice && (
        <div className="rounded-xl border border-[#3b82f6]/30 bg-[#3b82f6]/10 px-4 py-3 text-sm text-[#93c5fd] flex items-center justify-between gap-3">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso" className="text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Destaque: próxima conquista */}
      <section
        className="relative overflow-hidden rounded-2xl border border-white/[0.08] p-5 md:p-7 grid gap-6 md:grid-cols-[220px_1fr] items-center"
        style={{ background: `radial-gradient(80% 120% at 0% 0%, rgba(${t.rgb},0.14) 0%, #0f1117 55%, #0c0d12 100%)` }}
      >
        <div className="w-[160px] md:w-full mx-auto">
          <PlaqueArt plaque={hero} />
        </div>

        <div className="min-w-0">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border"
            style={{ color: t.light, borderColor: `rgba(${t.rgb},0.4)`, background: `rgba(${t.rgb},0.1)` }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {allReached ? "Todas as placas conquistadas" : "Sua próxima conquista"}
          </span>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold text-white tracking-tight">Placa {hero.short}</h2>
          <p className="text-sm text-zinc-400">Nível {hero.level}</p>

          <div className="mt-5 flex items-end justify-between gap-3 tabular-nums">
            <p className="text-sm text-zinc-400">
              <span className="text-lg font-bold text-white">{brlInt(revenue)}</span> de {brlInt(hero.value)}
            </p>
            <span className="text-lg font-bold" style={{ color: t.light }}>
              {formatGoalPercent(revenue, hero.value)}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-white/[0.08] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${heroRatio * 100}%`, background: t.gradient, boxShadow: `0 0 12px rgba(${t.rgb},0.6)` }}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {allReached ? (
              "Você conquistou todas as placas. Parabéns!"
            ) : (
              <>
                Faltam <span className="font-semibold text-zinc-200">{brl(hero.value - revenue)}</span> para desbloquear sua próxima placa.
              </>
            )}
          </p>

          {/* Linha do tempo dos marcos */}
          <ol className="mt-6 grid grid-cols-5 relative" aria-label="Marcos de faturamento">
            <span aria-hidden="true" className="absolute left-[10%] right-[10%] top-3 h-px bg-white/10" />
            {PLAQUES.map((p) => {
              const done = revenue >= p.value;
              const isNext = !allReached && p.value === next.value;
              return (
                <li key={p.value} className="relative flex flex-col items-center gap-1.5">
                  <span
                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center bg-[#0f1117]"
                    style={
                      done
                        ? { background: p.theme.main, borderColor: p.theme.main }
                        : isNext
                          ? { borderColor: p.theme.main, boxShadow: `0 0 10px rgba(${p.theme.rgb},0.6)` }
                          : { borderColor: "rgba(255,255,255,0.15)" }
                    }
                  >
                    {done ? (
                      <Check className="w-3.5 h-3.5 text-black/80" />
                    ) : isNext ? (
                      <span className="w-2 h-2 rounded-full" style={{ background: p.theme.main }} />
                    ) : null}
                  </span>
                  <span className={`text-[11px] font-semibold tabular-nums ${done || isNext ? "text-zinc-200" : "text-zinc-600"}`}>
                    {p.short}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Coleção */}
      <section>
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <p className="text-[10.5px] font-semibold tracking-[0.2em] text-zinc-500">COLEÇÃO</p>
            <h3 className="text-lg font-bold text-white">Suas placas</h3>
          </div>
          <span className="text-xs text-zinc-500 tabular-nums">
            {reachedCount} de {PLAQUES.length} conquistadas
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
          {PLAQUES.map((p, i) => {
            const done = revenue >= p.value;
            const isNext = !allReached && p.value === next.value;
            const red = activeRedemption(p.value);
            const pt = p.theme;
            return (
              <article
                key={p.value}
                className="relative rounded-2xl border p-4 flex flex-col gap-3 bg-[#0f1117]"
                style={{
                  borderColor: isNext ? `rgba(${pt.rgb},0.55)` : done ? `rgba(${pt.rgb},0.25)` : "rgba(255,255,255,0.07)",
                  boxShadow: isNext ? `0 0 30px -10px rgba(${pt.rgb},0.55)` : undefined,
                }}
              >
                <div className="flex items-center justify-between">
                  {done ? (
                    <Badge rgb={pt.rgb} color={pt.light}>
                      <Check className="w-3 h-3" /> Conquistada
                    </Badge>
                  ) : isNext ? (
                    <Badge rgb={pt.rgb} color={pt.light}>
                      <Sparkles className="w-3 h-3" /> Próxima
                    </Badge>
                  ) : (
                    <Badge rgb="255,255,255" color="#71717a">
                      <Lock className="w-3 h-3" /> Bloqueada
                    </Badge>
                  )}
                  <span className="text-[10.5px] font-semibold text-zinc-600 tabular-nums">#{String(i + 1).padStart(2, "0")}</span>
                </div>

                <PlaqueArt plaque={p} locked={!done && !isNext} />

                <div className="text-center">
                  <p className="font-bold text-white">Placa {p.short}</p>
                  <p className="text-xs text-zinc-500">Nível {p.level}</p>
                </div>

                <div>
                  <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(1, revenue / p.value) * 100}%`, background: done || isNext ? pt.gradient : "#3f3f46" }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10.5px] tabular-nums text-zinc-500">
                    <span>{formatGoalPercent(revenue, p.value)}</span>
                    <span>{formatPlaqueLong(p.value)}</span>
                  </div>
                </div>

                <div className="mt-auto flex flex-col gap-2">
                  {done ? (
                    <>
                      {p.art ? (
                        <a
                          href={p.art}
                          download={`placa-${p.short.toLowerCase()}.png`}
                          className="h-9 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-200 inline-flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" /> Baixar arte
                        </a>
                      ) : (
                        <span className="h-9 rounded-lg border border-white/[0.06] text-xs text-zinc-500 inline-flex items-center justify-center gap-1.5">
                          <Download className="w-3.5 h-3.5" /> Arte em breve
                        </span>
                      )}
                      {red ? (
                        <div className="rounded-lg border px-3 py-2 text-center" style={{ borderColor: `rgba(${pt.rgb},0.3)`, background: `rgba(${pt.rgb},0.08)` }}>
                          <p className="text-xs font-semibold" style={{ color: pt.light }}>
                            {REDEMPTION_STATUS_LABEL[red.status]}
                          </p>
                          {red.trackingCode && <p className="mt-0.5 text-[10.5px] text-zinc-400 break-all">Rastreio: {red.trackingCode}</p>}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRedeeming(p)}
                          className="h-9 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Gift className="w-3.5 h-3.5" /> Resgatar placa
                        </button>
                      )}
                    </>
                  ) : isNext ? (
                    <span
                      className="h-9 rounded-lg text-xs font-semibold inline-flex items-center justify-center tabular-nums text-black/85"
                      style={{ background: pt.gradient }}
                    >
                      Faltam {brlInt(p.value - revenue)}
                    </span>
                  ) : (
                    <span className="h-9 rounded-lg border border-white/[0.07] text-xs text-zinc-500 inline-flex items-center justify-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Libera em {formatPlaqueLong(p.value)}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Como funciona */}
      <section>
        <p className="text-[10.5px] font-semibold tracking-[0.2em] text-zinc-500 mb-3">COMO FUNCIONA</p>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Venda pela WebGran", "Todo pagamento aprovado soma no seu faturamento acumulado. Reembolsos e chargebacks não contam."],
            ["Bata a meta", "Ao atingir o valor, a placa é desbloqueada na hora e fica sua para sempre."],
            ["Receba em casa", "Clique em Resgatar, informe o endereço e acompanhe aqui a produção e o envio."],
          ].map(([title, text], i) => (
            <div key={title} className="rounded-xl border border-white/[0.07] bg-[#0f1117] p-4 flex gap-3">
              <span className="w-7 h-7 shrink-0 rounded-lg bg-[#3b82f6]/15 border border-[#3b82f6]/30 text-[#60a5fa] text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-zinc-100">{title}</p>
                <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

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

function Badge({ children, rgb, color }: { children: React.ReactNode; rgb: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border"
      style={{ color, borderColor: `rgba(${rgb},0.3)`, background: `rgba(${rgb},0.08)` }}
    >
      {children}
    </span>
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
