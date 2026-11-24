"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Lock, Minus, Plus, ShoppingBag, Sparkles, Trash2 } from "lucide-react";
import type { CartQuote } from "@/lib/webstore/catalog";
import { checkoutAction, quoteAction } from "../actions";
import { useCart } from "../_components/cart";
import { brl, BTN_PRIMARY, CARD, ErrorBox, INPUT } from "../_components/ui";

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
        <p className="mt-2 text-[14px] text-zinc-500">Escolha seus produtos e volte aqui para pagar com PIX.</p>
        <Link href={`/loja/${slug}`} className={`${BTN_PRIMARY} mt-6`}>
          Ver produtos
        </Link>
      </div>
    );
  }

  const shown = quote?.lines || [];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 sm:pt-12">
      <h1 className="text-[26px] font-semibold tracking-tight mb-6">Carrinho</h1>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        <div className={`${CARD} divide-y divide-white/[0.06]`}>
          {!quote && <p className="p-6 text-[14px] text-zinc-500">Calculando...</p>}
          {shown.map((l) => (
            <div key={l.id} className="flex items-center gap-3 sm:gap-4 p-4">
              <span className="w-16 h-16 rounded-[12px] overflow-hidden bg-[#1a1a1d] shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.coverUrl && <img src={l.coverUrl} alt="" className="w-full h-full object-cover" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold truncate">{l.title}</p>
                <p className="text-[12.5px] text-zinc-500">
                  {l.isCombo ? "Combo · " : ""}
                  {brl(l.price)}
                </p>
                <div className="mt-2 inline-flex items-center rounded-[9px] border border-white/[0.08]">
                  <button type="button" aria-label="Diminuir" className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-30" disabled={l.quantity <= 1} onClick={() => setQty(l.id, l.quantity - 1)}>
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center text-[13px] tabular-nums">{l.quantity}</span>
                  <button type="button" aria-label="Aumentar" className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white" onClick={() => setQty(l.id, l.quantity + 1)}>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-[15px] font-semibold tabular-nums">{brl(l.total)}</span>
                <button type="button" aria-label={`Remover ${l.title}`} onClick={() => remove(l.id)} className="w-8 h-8 rounded-[8px] flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-white/[0.05]">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <aside className={`${CARD} p-5 space-y-4 lg:sticky lg:top-24`}>
          <h2 className="text-[15px] font-semibold">Resumo</h2>
          <div className="space-y-2 text-[14px]">
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal</span>
              <span className="tabular-nums">{brl(quote?.subtotal || 0)}</span>
            </div>
            {quote && quote.discount > 0 && (
              <div className="flex justify-between text-[#9cc2ff]">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> {quote.promotionTitle || "Desconto"}
                </span>
                <span className="tabular-nums">- {brl(quote.discount)}</span>
              </div>
            )}
            {quote?.nextTier && <p className="text-[12.5px] text-zinc-500">{quote.nextTier}</p>}
          </div>
          <input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Cupom de desconto (opcional)" className={INPUT} maxLength={40} />
          <div className="flex justify-between items-baseline pt-3 border-t border-white/[0.06]">
            <span className="text-[14px] text-zinc-300">Total</span>
            <span className="text-[24px] font-bold tabular-nums">{brl(quote?.total || 0)}</span>
          </div>
          {coupon && <p className="text-[12px] text-zinc-500">O cupom é aplicado ao gerar o PIX.</p>}
          {error && <ErrorBox>{error}</ErrorBox>}
          <button type="button" className={`${BTN_PRIMARY} w-full h-12 text-[15px]`} disabled={pending || !quote || shown.length === 0} onClick={checkout}>
            <Lock className="w-[18px] h-[18px]" />
            {pending ? "Gerando PIX..." : loggedIn ? "Pagar com PIX" : "Entrar e pagar com PIX"}
          </button>
          <p className="text-[12px] text-zinc-500 text-center">O acesso é liberado na sua conta assim que o PIX for confirmado.</p>
        </aside>
      </div>
    </div>
  );
}
