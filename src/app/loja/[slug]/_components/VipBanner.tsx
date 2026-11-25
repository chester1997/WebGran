"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Crown, Loader2 } from "lucide-react";
import { vipCheckoutAction } from "../actions";
import { brl } from "./ui";

export interface VipPlanCard {
  id: string;
  label: string;
  period: string;
  price: number;
  days: number;
}

export interface VipStatus {
  label: string;
  /** ISO; null = vitalício */
  until: string | null;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Card dos planos VIP (mesmo estilo da oferta progressiva): assina e libera todos os títulos da loja. */
export function VipBanner({ slug, plans, active, loggedIn, image }: { slug: string; plans: VipPlanCard[]; active: VipStatus | null; loggedIn: boolean; image: string | null }) {
  const router = useRouter();
  const [pick, setPick] = useState(() => plans.find((p) => p.days === 30)?.id || plans[0]?.id);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!plans.length && !active) return null;

  // "Melhor custo": menor preço por dia entre os planos com prazo (vitalício fica de fora)
  const timed = plans.filter((p) => p.days > 1);
  const best = timed.length > 1 ? timed.reduce((a, b) => (b.price / b.days < a.price / a.days ? b : a)).id : null;
  const chosen = plans.find((p) => p.id === pick) || plans[0];

  const buy = () => {
    if (!chosen) return;
    if (!loggedIn) return router.push(`/loja/${slug}/entrar`);
    setErr(null);
    start(async () => {
      const r = await vipCheckoutAction(slug, chosen.id);
      if (r.ok) router.push(`/loja/${slug}/pedido/${r.orderId}`);
      else setErr(r.error);
    });
  };

  return (
    <section className="px-4 sm:px-8 lg:px-10" aria-label="Planos VIP">
      <div className="relative overflow-hidden rounded-[10px] border border-[#3b82f6]/25 bg-[#0b0d12]">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover object-right opacity-60" />
        )}
        <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(120%_90%_at_100%_0%,rgba(59,130,246,0.22),transparent_55%),linear-gradient(90deg,#0b0d12_0%,rgba(11,13,18,0.96)_45%,rgba(11,13,18,0.7)_100%)]" />

        <div className="relative z-10 px-5 py-6 sm:px-9 sm:py-8">
          <p className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[#7fb0ff]">
            <Crown className="w-4 h-4" /> Acesso VIP
          </p>
          <h2 className="mt-2 text-[24px] sm:text-[30px] font-extrabold leading-[1.08] tracking-[-0.02em] [text-wrap:balance]">Assista tudo da loja com um plano só</h2>
          <p className="mt-1.5 max-w-[620px] text-[14px] text-zinc-400">Enquanto o plano estiver ativo, todos os títulos ficam liberados para você. Sem comprar um por um.</p>

          {active ? (
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
              <div className="flex items-center gap-3 rounded-[8px] border border-[#3b82f6]/35 bg-[#3b82f6]/[0.12] px-4 py-3">
                <Crown className="w-5 h-5 text-[#3b82f6] shrink-0" />
                <p className="text-[14px] text-zinc-200">
                  <b className="text-white">VIP {active.label} ativo</b>
                  <span className="block text-[12.5px] text-zinc-400">{active.until ? `Tudo liberado até ${fmtDate(active.until)}` : "Tudo liberado para sempre"}</span>
                </p>
              </div>
              <Link href={`/loja/${slug}/conta`} className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[6px] bg-white text-black text-[14px] font-semibold hover:bg-zinc-200 transition-colors">
                Ver meus vídeos <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <>
              {/* Celular: um plano por linha. Do tablet pra cima: colunas lado a lado */}
              <div
                role="radiogroup"
                aria-label="Escolha o plano"
                className="mt-5 flex flex-col sm:grid sm:grid-cols-4 lg:[grid-template-columns:repeat(var(--n),minmax(0,1fr))] rounded-[8px] border border-white/[0.12] bg-black/55 backdrop-blur-sm overflow-hidden"
                style={{ ["--n" as string]: plans.length }}
              >
                {plans.map((p, k) => {
                  const on = p.id === chosen?.id;
                  const per = p.days === 0 ? "pagamento único" : p.days === 1 ? "acesso por 24 horas" : `${brl(p.price / p.days)} por dia`;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setPick(p.id)}
                      className={`relative text-left flex sm:block items-center gap-3 px-4 sm:px-4 py-3 sm:pt-3.5 sm:pb-3 transition-colors ${k > 0 ? "border-t border-white/[0.1] sm:border-t-0 sm:border-l" : ""} ${
                        on ? "bg-[#3b82f6]/[0.18]" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      {on && <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px] sm:w-auto sm:bottom-auto sm:right-0 sm:h-[2px] bg-[#3b82f6]" />}
                      <span className={`sm:hidden w-[18px] h-[18px] rounded-full border-2 shrink-0 flex items-center justify-center ${on ? "border-[#3b82f6]" : "border-zinc-600"}`}>
                        {on && <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />}
                      </span>
                      <span className="min-w-0 flex-1 sm:block">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] sm:text-[12px] text-zinc-200 sm:text-zinc-400 font-medium">
                          {p.label}
                          {p.id === best && <span className="h-[18px] px-1.5 rounded-[4px] bg-[#3b82f6] text-white text-[10px] font-bold uppercase tracking-wide inline-flex items-center">Melhor custo</span>}
                        </span>
                        <span className="hidden sm:block mt-0.5 text-[20px] font-bold tabular-nums leading-tight text-white">{brl(p.price)}</span>
                        <span className="block mt-0.5 sm:mt-0 text-[12px] text-zinc-500 tabular-nums">{per}</span>
                      </span>
                      <b className="sm:hidden text-[18px] font-bold tabular-nums leading-none shrink-0">{brl(p.price)}</b>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="button"
                  onClick={buy}
                  disabled={pending || !chosen}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-5 rounded-[6px] bg-[#3b82f6] hover:bg-[#2f74ea] text-white text-[14.5px] font-semibold whitespace-nowrap transition-colors disabled:opacity-60"
                >
                  {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                  {chosen ? (
                    <>
                      Assinar <span className="hidden sm:inline">VIP </span>
                      {chosen.label} · {brl(chosen.price)}
                    </>
                  ) : (
                    "Assinar VIP"
                  )}
                </button>
                <span className="text-[12.5px] text-zinc-500">{chosen ? `Libera tudo por ${chosen.period} · pagamento via PIX` : ""}</span>
              </div>
              {err && <p className="mt-3 text-[13px] text-red-400">{err}</p>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
