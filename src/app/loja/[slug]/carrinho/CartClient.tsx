"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, Layers, Lock, Minus, Plus, ShieldCheck, ShoppingBag, Ticket, Trash2, TrendingDown } from "lucide-react";
import type { CartPromo, CartQuote } from "@/lib/webstore/catalog";
import { checkoutAction, quoteAction } from "../actions";
import { useCart } from "../_components/cart";
import { brl, BTN_PRIMARY, ErrorBox } from "../_components/ui";

const PANEL = "rounded-[10px] border border-white/[0.07] bg-[#0f1014]";

export function CartClient({ slug, loggedIn }: { slug: string; loggedIn: boolean }) {
  const { lines, ready, setQty, remove } = useCart();
  const router = useRouter();
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [coupon, setCoupon] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const key = JSON.stringify(lines);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    quoteAction(slug, JSON.parse(key)).then((r) => {
      if (alive && r.ok) setQuote(r.quote);
    });
    return () => {
      alive = false;
    };
  }, [slug, key, ready]);

  const checkout = () =>
    start(async () => {
      setError(null);
      if (!loggedIn) {
        router.push(`/loja/${slug}/entrar?next=carrinho`);
        return;
      }
      const res = await checkoutAction(slug, lines, coupon);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/loja/${slug}/pedido/${res.orderId}`);
    });

  if (ready && lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <ShoppingBag className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
        <h1 className="text-[22px] font-semibold">Seu carrinho está vazio</h1>
        <p className="mt-2 text-[14px] text-zinc-500">Escolha seus títulos e volte aqui para pagar com PIX.</p>
        <Link href={`/loja/${slug}`} className={`${BTN_PRIMARY} mt-6`}>
          Ver títulos
        </Link>
      </div>
    );
  }

  const shown = quote?.lines || [];
  const units = shown.reduce((a, l) => a + l.quantity, 0);

  return (
    <div className="w-full px-4 sm:px-8 lg:px-10 pt-8 sm:pt-12 pb-6">
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="text-[28px] font-bold tracking-tight">Carrinho</h1>
        {quote && <span className="text-[14px] text-zinc-500">{units} {units === 1 ? "item" : "itens"}</span>}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
        <div className="space-y-4 min-w-0">
          {quote?.promo && <PromoProgress slug={slug} promo={quote.promo} />}

          <div className={`${PANEL} divide-y divide-white/[0.06]`}>
            {!quote && <p className="p-6 text-[14px] text-zinc-500">Calculando...</p>}
            {shown.map((l) => (
              <div key={l.id} className="flex items-start gap-4 sm:gap-5 p-4 sm:p-5">
                <Link href={l.isCombo ? `/loja/${slug}` : `/loja/${slug}/produto/${l.slug}`} className="w-[64px] sm:w-[76px] aspect-[2/3] rounded-[5px] overflow-hidden bg-[#1a1a1d] shrink-0 ring-1 ring-white/[0.06]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {l.coverUrl && <img src={l.coverUrl} alt="" className="w-full h-full object-cover" />}
                </Link>
                <div className="min-w-0 flex-1">
                  {l.isCombo && (
                    <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7fb0ff] mb-1">
                      <Layers className="w-3 h-3" /> Combo
                    </p>
                  )}
                  <p className="text-[15px] sm:text-[16px] font-semibold leading-snug line-clamp-2">{l.title}</p>
                  {l.comboItems && <p className="mt-0.5 text-[12.5px] text-zinc-500 line-clamp-2">{l.comboItems.join(" · ")}</p>}
                  <p className="mt-1 text-[13px] text-zinc-400 tabular-nums">
                    {brl(l.price)}
                    {l.normalPrice && l.normalPrice > l.price ? <span className="ml-1.5 text-zinc-600 line-through">{brl(l.normalPrice)}</span> : null}
                  </p>
                  <div className="mt-3 inline-flex items-center rounded-[6px] border border-white/[0.1] bg-black/20">
                    <button type="button" aria-label="Diminuir" className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-30" disabled={l.quantity <= 1} onClick={() => setQty(l.id, l.quantity - 1)}>
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-9 text-center text-[14px] tabular-nums">{l.quantity}</span>
                    <button type="button" aria-label="Aumentar" className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white" onClick={() => setQty(l.id, l.quantity + 1)}>
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3 shrink-0">
                  <span className="text-[16px] font-semibold tabular-nums">{brl(l.total)}</span>
                  <button type="button" aria-label={`Remover ${l.title}`} onClick={() => remove(l.id)} className="inline-flex items-center gap-1.5 h-8 px-2 rounded-[6px] text-[12.5px] text-zinc-500 hover:text-red-300 hover:bg-white/[0.04]">
                    <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Remover</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Link href={`/loja/${slug}`} className="inline-flex items-center gap-1.5 text-[13.5px] text-[#7fb0ff] hover:underline">
            Continuar escolhendo <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <aside className="relative xl:sticky xl:top-24 rounded-[16px] border border-white/[0.08] bg-[linear-gradient(180deg,#16171c_0%,#111216_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_60px_-30px_rgba(0,0,0,0.9)]">
          {/* Parte de cima do "cupom": o valor em destaque */}
          <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[34px] sm:text-[38px] font-bold leading-none tabular-nums tracking-tight">{brl(quote?.total || 0)}</p>
                <p className="mt-2 text-[13.5px] text-zinc-400">
                  {shown.length} {shown.length === 1 ? "item" : "itens"} no pedido
                </p>
              </div>
              <Ticket className="w-6 h-6 text-[#7fb0ff] shrink-0" strokeWidth={1.6} />
            </div>
            <div className="mt-5 space-y-2 text-[13.5px]">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal</span>
                <span className="tabular-nums">{brl(quote?.subtotal || 0)}</span>
              </div>
              {quote && quote.discount > 0 && (
                <div className="flex justify-between text-[#9cc2ff]">
                  <span className="truncate pr-3">{quote.promotionTitle || "Desconto"}</span>
                  <span className="tabular-nums shrink-0">- {brl(quote.discount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Picote: recortes nas laterais e linha tracejada */}
          <div aria-hidden="true" className="relative h-0">
            <span className="absolute -left-[9px] -top-[9px] w-[18px] h-[18px] rounded-full bg-[#07080a] border border-white/[0.08] [clip-path:inset(0_0_0_50%)]" />
            <span className="absolute -right-[9px] -top-[9px] w-[18px] h-[18px] rounded-full bg-[#07080a] border border-white/[0.08] [clip-path:inset(0_50%_0_0)]" />
            <span className="absolute left-4 right-4 top-0 border-t border-dashed border-white/[0.12]" />
          </div>

          {/* Parte de baixo: cupom e pagamento */}
          <div className="px-5 sm:px-6 pt-6 pb-5 sm:pb-6 space-y-4">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              placeholder="CUPOM"
              aria-label="Cupom de desconto (opcional)"
              className="w-full h-12 rounded-[10px] border border-dashed border-white/[0.14] bg-black/25 text-center font-mono text-[14px] font-semibold tracking-[0.3em] text-zinc-200 placeholder:text-zinc-600 placeholder:tracking-[0.3em] outline-none focus:border-[#3b82f6] focus:bg-[#3b82f6]/[0.05] transition-colors"
              maxLength={40}
            />
            {coupon && <p className="text-[12px] text-zinc-500 text-center -mt-1">O cupom é aplicado ao gerar o PIX.</p>}
            {error && <ErrorBox>{error}</ErrorBox>}
            <button type="button" className={`${BTN_PRIMARY} w-full h-12 text-[15px] !rounded-[10px]`} disabled={pending || !quote || shown.length === 0} onClick={checkout}>
              <Lock className="w-[18px] h-[18px]" />
              {pending ? "Gerando PIX..." : loggedIn ? "Pagar com PIX" : "Entrar e pagar com PIX"}
            </button>
            <p className="flex items-start gap-2 text-[12.5px] text-zinc-500">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-px text-zinc-400" />
              O acesso é liberado na sua conta assim que o PIX for confirmado. Você assiste no celular ou no computador.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Mensagem da oferta progressiva, no mesmo espírito do Mini App. */
function PromoProgress({ slug, promo }: { slug: string; promo: CartPromo }) {
  const next = promo.next;
  const pct = next && next.targetQuantity > 0 ? Math.min(100, Math.round((next.current / next.targetQuantity) * 100)) : 100;
  return (
    <div className="rounded-[10px] border border-[#3b82f6]/30 bg-[linear-gradient(180deg,rgba(59,130,246,0.10),rgba(59,130,246,0.03))] overflow-hidden">
      {promo.savings > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-5 py-3.5 border-b border-[#3b82f6]/20">
          <CheckCircle2 className="w-5 h-5 text-[#3b82f6] shrink-0" />
          <div className="min-w-0 mr-auto">
            <p className="text-[14px] font-semibold truncate">{promo.title}</p>
            <p className="text-[12.5px] text-zinc-400">Oferta por volume aplicada no seu carrinho.</p>
          </div>
          <span className="text-[13px] font-semibold text-[#9cc2ff] tabular-nums">Você economiza {brl(promo.savings)}</span>
          {promo.applied.length > 0 && (
            <div className="basis-full flex flex-wrap gap-1.5 pl-9">
              {promo.applied.map((a, i) => (
                <span key={i} className="h-6 px-2 rounded-[4px] bg-black/30 border border-white/[0.08] text-[11.5px] text-zinc-300 inline-flex items-center tabular-nums">
                  {a.count > 1 ? `${a.count}× ` : ""}
                  {a.minQuantity} por {brl(a.price)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {next ? (
        <div className="px-4 sm:px-5 py-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <TrendingDown className="w-4 h-4 text-[#7fb0ff] shrink-0" />
            <p className="text-[14px] text-zinc-200 mr-auto">
              Faltam <b className="text-white">{next.remaining}</b> {next.remaining === 1 ? "título" : "títulos"} para desbloquear{" "}
              <b className="text-white">
                {next.targetQuantity} por {brl(next.targetPrice)}
              </b>
              <span className="text-zinc-500"> ({brl(next.targetPrice / next.targetQuantity)} cada)</span>
            </p>
            <Link href={`/loja/${slug}/buscar`} className="text-[13px] font-semibold text-[#7fb0ff] hover:underline">
              Escolher mais
            </Link>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
            <div className="h-full bg-[#3b82f6] transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[12px] text-zinc-500 tabular-nums">
            {next.current} de {next.targetQuantity} títulos no carrinho
          </p>
        </div>
      ) : (
        promo.savings === 0 && (
          <div className="px-4 sm:px-5 py-3.5 text-[13.5px] text-zinc-300">
            <b>{promo.title}:</b> {promo.tiers.map((t) => `${t.minQuantity} por ${brl(t.price)}`).join(" · ")}
          </div>
        )
      )}
    </div>
  );
}
