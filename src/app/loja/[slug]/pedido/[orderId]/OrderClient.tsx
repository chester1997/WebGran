"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, Loader2, PlayCircle } from "lucide-react";
import { orderStatusAction, type OrderView } from "../../actions";
import { useCart } from "../../_components/cart";
import { brl, BTN_GHOST, BTN_PRIMARY, CARD } from "../../_components/ui";

export function OrderClient({ slug, initial }: { slug: string; initial: OrderView }) {
  const [order, setOrder] = useState(initial);
  const [copied, setCopied] = useState(false);
  const { clear, ready } = useCart();
  const cleared = useRef(false);

  // Carrinho é limpo assim que o PIX é gerado.
  useEffect(() => {
    if (ready && !cleared.current) {
      cleared.current = true;
      clear();
    }
  }, [ready, clear]);

  useEffect(() => {
    if (order.status !== "pending") return;
    const t = window.setInterval(async () => {
      const r = await orderStatusAction(slug, order.id);
      if (r.ok) setOrder(r.order);
    }, 5000);
    return () => window.clearInterval(t);
  }, [slug, order.id, order.status]);

  const copy = async () => {
    if (!order.pixQrCode) return;
    try {
      await navigator.clipboard.writeText(order.pixQrCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // ignora
    }
  };

  return (
    <div className="mx-auto max-w-[480px] px-4 py-10 sm:py-14">
      <div className={`${CARD} p-6 sm:p-7 text-center`}>
        {order.status === "paid" ? (
          <>
            <CheckCircle2 className="w-14 h-14 text-[#3b82f6] mx-auto" />
            <h1 className="mt-4 text-[22px] font-semibold">Pagamento confirmado</h1>
            <p className="mt-1.5 text-[14px] text-zinc-400">Seu acesso já está liberado na sua conta.</p>
            <Link href={`/loja/${slug}/conta`} className={`${BTN_PRIMARY} w-full h-12 mt-6 text-[15px]`}>
              <PlayCircle className="w-5 h-5" /> Ver meus produtos
            </Link>
          </>
        ) : order.status === "pending" ? (
          <>
            <p className="text-[13px] font-medium text-zinc-500">Pedido #{order.id.slice(0, 8).toUpperCase()}</p>
            <h1 className="mt-1 text-[22px] font-semibold">Pague com PIX</h1>
            <p className="mt-1 text-[28px] font-bold tabular-nums">{brl(order.total)}</p>
            {order.discount > 0 && <p className="text-[12.5px] text-[#9cc2ff]">Você economizou {brl(order.discount)}</p>}
            {order.pixQrCodeBase64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={order.pixQrCodeBase64.startsWith("data:") ? order.pixQrCodeBase64 : `data:image/png;base64,${order.pixQrCodeBase64}`}
                alt="QR Code do PIX"
                className="mx-auto mt-5 w-[220px] h-[220px] rounded-[14px] bg-white p-2.5"
              />
            ) : (
              <div className="mx-auto mt-5 w-[220px] h-[220px] rounded-[14px] bg-white/[0.04] flex items-center justify-center text-[12.5px] text-zinc-500">QR indisponível. Use o código abaixo.</div>
            )}
            {order.pixQrCode && (
              <>
                <p className="mt-5 text-[12px] text-zinc-500 break-all line-clamp-2 px-2 font-mono">{order.pixQrCode}</p>
                <button type="button" onClick={copy} className={`${BTN_PRIMARY} w-full h-12 mt-3 text-[15px]`}>
                  <Copy className="w-[18px] h-[18px]" /> {copied ? "Código copiado!" : "Copiar código PIX"}
                </button>
              </>
            )}
            <p className="mt-5 inline-flex items-center gap-2 text-[13px] text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin text-[#7fb0ff]" /> Aguardando o pagamento. Esta página atualiza sozinha.
            </p>
            {order.pixExpiresAt && (
              <p className="mt-1 text-[12px] text-zinc-600">
                Válido até {new Date(order.pixExpiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </>
        ) : (
          <>
            <AlertCircle className="w-14 h-14 text-red-400 mx-auto" />
            <h1 className="mt-4 text-[22px] font-semibold">Pagamento não concluído</h1>
            <p className="mt-1.5 text-[14px] text-zinc-400">O PIX expirou ou foi cancelado. Você pode montar o carrinho de novo.</p>
            <Link href={`/loja/${slug}`} className={`${BTN_GHOST} w-full mt-6`}>
              Voltar para a loja
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
