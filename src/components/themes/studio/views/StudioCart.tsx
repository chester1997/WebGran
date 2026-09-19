"use client";

import React, { useState, useEffect } from "react";
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, Copy, Check, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/components/miniapp/CartProvider";
import { createCheckoutSession } from "@/app/miniapp/[slug]/cart/actions";
import { useRouter } from "next/navigation";

export function StudioCart({ storeSlug }: { storeSlug: string }) {
  const { items, updateQuantity, removeFromCart, subtotal, total, clearCart } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [pixState, setPixState] = useState<{
    orderId: string;
    qrCode: string;
    qrCodeBase64: string;
    expiresAt: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [accessLink, setAccessLink] = useState<string | null>(null);
  const router = useRouter();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCheckout = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const result = await createCheckoutSession(storeSlug, items.map(i => ({ id: i.id, quantity: i.quantity })));
      
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
          if (data.status === 'paid') {
            setIsPaid(true);
            if (data.accesses && data.accesses.length > 0) {
              setAccessLink(data.accesses[0].inviteLink);
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

  if (isPaid) {
    return (
      <div className="p-4 pt-12 flex flex-col items-center justify-center min-h-[60vh] text-center text-white space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
          <Check className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold">Pagamento Confirmado!</h1>
        <p className="text-zinc-400 text-sm max-w-xs">
          Seu pagamento via PIX foi aprovado com sucesso. Seu acesso foi liberado!
        </p>

        {accessLink ? (
          <a
            href={accessLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full max-w-xs py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all text-sm"
          >
            <ShieldCheck className="w-5 h-5" />
            Entrar no Grupo/Canal
          </a>
        ) : (
          <Link
            href={`/miniapp/${storeSlug}/accesses`}
            className="w-full max-w-xs py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all text-sm"
          >
            <ShieldCheck className="w-5 h-5" />
            Acessar Meus Conteúdos
          </Link>
        )}
      </div>
    );
  }

  if (pixState) {
    return (
      <div className="p-4 pt-6 text-white bg-zinc-950 w-full max-w-lg mx-auto flex flex-col items-center space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Pagamento via PIX</h1>
          <p className="text-xs text-zinc-400">Escaneie o QR Code ou copie o código PIX abaixo</p>
        </div>

        {/* QR Code */}
        {pixState.qrCodeBase64 && (
          <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center justify-center">
            <img
              src={`data:image/png;base64,${pixState.qrCodeBase64}`}
              alt="PIX QR Code"
              className="w-56 h-56 object-contain"
            />
          </div>
        )}

        {/* PIX Copia e Cola Code */}
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
                copied ? 'bg-emerald-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copiar Código
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Indicator / Spinner */}
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
        <Link href={`/miniapp/${storeSlug}`} className="bg-red-600 text-white font-semibold px-8 py-3 rounded-md hover:bg-red-700 transition-colors">
          Explorar Catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 pt-6 text-white bg-zinc-950 w-full">
      <h1 className="text-2xl font-bold mb-6">Seu Carrinho</h1>

      <div className="space-y-4 mb-8">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50">
            {item.coverUrl ? (
              <img src={item.coverUrl} alt={item.title} className="w-20 h-28 object-cover rounded-md" />
            ) : (
              <div className="w-20 h-28 bg-zinc-800 rounded-md flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-zinc-600" />
              </div>
            )}
            
            <div className="flex-1 flex flex-col py-1">
              <h3 className="font-semibold text-zinc-100 leading-tight mb-1">{item.title}</h3>
              <p className="text-red-500 font-medium mb-auto">R$ {Number(item.price || 0).toFixed(2)}</p>
              
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3 bg-zinc-950 rounded-full border border-zinc-800 px-2 py-1">
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="p-1 text-zinc-400 hover:text-white disabled:opacity-50"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="p-1 text-zinc-400 hover:text-white"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                <button 
                  onClick={() => removeFromCart(item.id)}
                  className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 mb-6 space-y-3">
        <div className="flex justify-between text-zinc-400 text-sm">
          <span>Subtotal</span>
          <span>R$ {Number(subtotal || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg pt-3 border-t border-zinc-800">
          <span>Total</span>
          <span className="text-red-500">R$ {Number(total || 0).toFixed(2)}</span>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-xs text-center mb-4">
          <p className="font-semibold">{errorMessage}</p>
        </div>
      )}

      <button 
        onClick={handleCheckout}
        disabled={isProcessing}
        className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Gerando pagamento...
          </>
        ) : (
          <>
            Finalizar Compra
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </div>
  );
}
