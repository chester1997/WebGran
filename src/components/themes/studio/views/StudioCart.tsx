"use client";

import React, { useState, useEffect } from "react";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
  Tag,
  ChevronRight,
  X,
  CheckCircle2
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/components/miniapp/CartProvider";
import { createCheckoutSession } from "@/app/miniapp/[slug]/cart/actions";
import { useRouter } from "next/navigation";

export function StudioCart({ storeSlug }: { storeSlug: string }) {
  const { items, updateQuantity, removeFromCart, subtotal, total, clearCart } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Coupon States
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountType: string;
    discountValue: number;
    discountAmount: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [pixState, setPixState] = useState<{
    orderId: string;
    qrCode: string;
    qrCodeBase64: string;
    expiresAt: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [accessLink, setAccessLink] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const discount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const displayTotal = Math.max(0, subtotal - discount);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError(null);

    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeSlug,
          code: couponCode,
          cartTotal: subtotal,
        }),
      });

      const data = await res.json();
      if (data.success && data.coupon) {
        setAppliedCoupon(data.coupon);
        setCouponError(null);
      } else {
        setAppliedCoupon(null);
        setCouponError(data.error || "Cupom inválido.");
      }
    } catch {
      setCouponError("Erro de conexão ao validar cupom.");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);
  };

  const handleCheckout = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const result = await createCheckoutSession(
        storeSlug,
        items.map((i) => ({ id: i.id, quantity: i.quantity })),
        appliedCoupon?.code
      );

      if (result.success) {
        clearCart();
        if (result.pix) {
          setPixState({
            orderId: result.orderId,
            qrCode: result.pix.qrCode,
            qrCodeBase64: result.pix.qrCodeBase64,
            expiresAt: result.pix.expiresAt,
          });
        } else if (result.isDemoPaid) {
          setIsPaid(true);
        } else {
          router.push(`/miniapp/${storeSlug}/accesses`);
        }
      } else {
        setErrorMessage(result.error || "Não foi possível gerar o pagamento no momento.");
      }
    } catch {
      setErrorMessage("Erro de conexão. Tente novamente em alguns instantes.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Poll Order Status when PIX is active
  useEffect(() => {
    if (!pixState?.orderId || isPaid) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${pixState.orderId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "paid") {
            setIsPaid(true);
            if (data.accesses && data.accesses.length > 0) {
              setAccessLink(
                `/api/telegram/access/redirect?accessId=${data.accesses[0].id}&storeSlug=${storeSlug}`
              );
            }
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error("Error polling order status:", err);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pixState?.orderId, isPaid]);

  const handleCopyPix = () => {
    if (!pixState?.qrCode) return;
    navigator.clipboard.writeText(pixState.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  /* ── Paid state ── */
  if (isPaid) {
    return (
      <div className="p-4 pt-12 flex flex-col items-center justify-center min-h-[60vh] text-center text-white space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
          <Check className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold">Pagamento Confirmado!</h1>
        <p className="text-zinc-400 text-sm max-w-xs">
          Seu pagamento via PIX foi aprovado. Seu acesso foi liberado!
        </p>
        {accessLink ? (
          <a
            href={accessLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full max-w-xs py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all text-sm"
          >
            <ShieldCheck className="w-5 h-5" />
            Entrar no Grupo/Canal
          </a>
        ) : (
          <Link
            href={`/miniapp/${storeSlug}/accesses`}
            className="w-full max-w-xs py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all text-sm"
          >
            <ShieldCheck className="w-5 h-5" />
            Acessar Meus Conteúdos
          </Link>
        )}
      </div>
    );
  }

  /* ── PIX state ── */
  if (pixState) {
    return (
      <div className="p-4 pt-6 text-white w-full max-w-lg mx-auto flex flex-col items-center space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Pagamento via PIX</h1>
          <p className="text-xs text-zinc-400">Escaneie o QR Code ou copie o código PIX abaixo</p>
        </div>

        {pixState.qrCodeBase64 && (
          <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center justify-center">
            <img
              src={`data:image/png;base64,${pixState.qrCodeBase64}`}
              alt="PIX QR Code"
              className="w-56 h-56 object-contain"
            />
          </div>
        )}

        <div className="w-full space-y-2">
          <label className="text-xs font-semibold text-zinc-400">PIX Copia e Cola:</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={pixState.qrCode}
              className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs px-3 py-2.5 rounded-xl font-mono truncate focus:outline-none"
            />
            <button
              onClick={handleCopyPix}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                copied ? "bg-emerald-600 text-white" : "bg-red-600 hover:bg-red-700 text-white"
              }`}
            >
              {copied ? (
                <><Check className="w-4 h-4" /> Copiado!</>
              ) : (
                <><Copy className="w-4 h-4" /> Copiar Código</>
              )}
            </button>
          </div>
        </div>

        <div className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-red-500 animate-spin flex-shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-zinc-200">Aguardando confirmação do pagamento...</p>
            <p className="text-zinc-500">A liberação ocorrerá automaticamente assim que pago.</p>
          </div>
        </div>

        <button
          onClick={() => setPixState(null)}
          className="text-xs text-zinc-500 hover:text-zinc-300 underline pt-2"
        >
          Voltar para o carrinho
        </button>
      </div>
    );
  }

  /* ── Empty state ── */
  if (items.length === 0) {
    return (
      <div className="p-4 pt-12 flex flex-col items-center justify-center min-h-[60vh] text-center text-white">
        <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
          <ShoppingCart className="w-8 h-8 text-zinc-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Carrinho Vazio</h1>
        <p className="text-zinc-500 mb-8 max-w-[250px]">
          Você ainda não adicionou nenhum produto ao seu carrinho.
        </p>
        <Link
          href={`/miniapp/${storeSlug}`}
          className="bg-red-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-red-700 transition-colors"
        >
          Explorar Catálogo
        </Link>
      </div>
    );
  }

  /* ── Main cart ── */
  return (
    <div className="p-4 pt-4 text-white w-full">

      {/* Product list */}
      <div className="space-y-3 mb-5">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex gap-3 bg-[#18181c] rounded-2xl p-3 border border-white/6"
          >
            {/* Poster */}
            <div className="relative w-[60px] h-[84px] flex-shrink-0 rounded-xl overflow-hidden bg-zinc-800">
              {item.coverUrl ? (
                <Image
                  src={item.coverUrl}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="60px"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-zinc-600" />
                </div>
              )}
            </div>

            {/* Info + controls */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <h3 className="font-semibold text-[14px] text-white leading-snug line-clamp-2">
                  {item.title}
                </h3>
              </div>

              <div className="flex items-center justify-between mt-2">
                {/* Price */}
                <p className="text-[15px] font-bold text-white">
                  R$ {Number(item.price || 0).toFixed(2).replace(".", ",")}
                </p>

                {/* Qty controls + remove */}
                <div className="flex items-center gap-2">
                  {/* − qty + */}
                  <div className="flex items-center gap-1 bg-zinc-900 border border-white/10 rounded-full px-1.5 py-0.5">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-40 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[13px] font-semibold w-5 text-center text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-red-500 transition-colors rounded-full hover:bg-red-500/10"
                    aria-label="Remover produto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Coupon */}
      <div className="mb-5 space-y-2">
        <p className="text-[13px] font-semibold text-white">Cupom de desconto</p>

        {appliedCoupon ? (
          <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3.5 py-2.5 text-xs text-emerald-400">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="font-mono font-bold tracking-wider uppercase text-white bg-emerald-500/20 px-2 py-0.5 rounded">
                {appliedCoupon.code}
              </span>
              <span className="text-emerald-300 truncate">
                (- R$ {appliedCoupon.discountAmount.toFixed(2).replace(".", ",")})
              </span>
            </div>
            <button
              onClick={handleRemoveCoupon}
              className="p-1 hover:bg-emerald-500/20 rounded-lg text-emerald-400 hover:text-white transition-colors"
              title="Remover Cupom"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 bg-[#18181c] border border-white/8 rounded-xl px-3 py-2.5">
                <Tag className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyCoupon();
                    }
                  }}
                  placeholder="Digite seu cupom"
                  className="bg-transparent text-[13px] uppercase text-white placeholder:text-zinc-500 placeholder:normal-case flex-1 outline-none"
                />
              </div>
              <button
                onClick={handleApplyCoupon}
                disabled={couponLoading || !couponCode.trim()}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-[13px] rounded-xl transition-colors flex items-center gap-1.5"
              >
                {couponLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Aplicar"
                )}
              </button>
            </div>

            {couponError && (
              <p className="text-[11px] text-red-400 mt-1.5 font-medium">
                {couponError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Order summary */}
      <div className="mb-5">
        <p className="text-[13px] font-semibold text-white mb-3">Resumo do pedido</p>
        <div className="space-y-2">
          <div className="flex justify-between text-[13px] text-zinc-400">
            <span>Subtotal</span>
            <span>R$ {Number(subtotal || 0).toFixed(2).replace(".", ",")}</span>
          </div>
          <div className="flex justify-between text-[13px] text-zinc-400">
            <span>Desconto</span>
            <span className={discount > 0 ? "text-emerald-400 font-semibold" : ""}>
              - R$ {discount.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="h-px bg-white/6 my-1" />
          <div className="flex justify-between text-[16px] font-bold">
            <span>Total</span>
            <span className="text-red-500">
              R$ {Number(displayTotal || 0).toFixed(2).replace(".", ",")}
            </span>
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div className="mb-5">
        <p className="text-[13px] font-semibold text-white mb-2">Método de pagamento</p>
        <div className="flex items-center justify-between bg-[#18181c] border border-white/8 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            {/* PIX icon */}
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.5 17.5L3 21L6.5 17.5ZM17.5 6.5L21 3L17.5 6.5ZM6.5 6.5L3 3L6.5 6.5ZM17.5 17.5L21 21L17.5 17.5Z" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2Z" stroke="#10b981" strokeWidth="1.5"/>
                <path d="M8 12H16M12 8V16" stroke="#10b981" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white">PIX</p>
              <p className="text-[11px] text-zinc-500">Aprovação imediata</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-600" />
        </div>
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-xs text-center mb-4">
          <p className="font-semibold">{errorMessage}</p>
        </div>
      )}

      {/* Checkout button */}
      <button
        onClick={handleCheckout}
        disabled={isProcessing}
        className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-2xl transition-colors disabled:opacity-50 text-[15px] mb-4 cursor-pointer"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Gerando pagamento...
          </>
        ) : (
          <>
            Finalizar compra
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>

      {/* Telegram notice */}
      <div className="flex items-start gap-2.5 bg-[#18181c] border border-white/6 rounded-xl px-3 py-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-[#229ED9] flex-shrink-0 mt-0.5">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.09 13.843l-2.963-.924c-.644-.203-.657-.644.136-.953l11.57-4.461c.537-.194 1.006.131.832.916h.029z"/>
        </svg>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Após o pagamento, você recebe o acesso diretamente no seu Telegram.
        </p>
      </div>
    </div>
  );
}
