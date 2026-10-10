"use client";

import React, { useEffect } from "react";
import { X, QrCode, AlertCircle, RefreshCw } from "lucide-react";
import { PixPaymentCard, isValidPixCode } from "./PixPaymentCard";

export interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixCode?: string | null;
  qrCodeBase64?: string | null;
  amount?: number | string | null;
  orderId?: string | null;
  productTitle?: string | null;
  status?: "pending" | "paid" | "expired" | "failed";
  expiresAt?: string | null;
  onCopy?: () => void;
  onRetry?: () => void;
}

export function PixPaymentModal({
  isOpen,
  onClose,
  pixCode,
  qrCodeBase64,
  amount,
  orderId,
  productTitle,
  status = "pending",
  onCopy,
  onRetry,
}: PixPaymentModalProps) {
  // ESC key listener & body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      
      {/* Backdrop overlay click to close */}
      <div 
        className="fixed inset-0 cursor-pointer" 
        onClick={onClose} 
        aria-hidden="true" 
      />

      {/* Modal Dialog Box */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="pix-modal-title"
        className="relative w-full max-w-md bg-[#141416] dark:bg-[#141416] border border-white/10 dark:border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto custom-scrollbar text-white z-10 fade-in flex flex-col justify-between shrink-0"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 id="pix-modal-title" className="text-base font-bold text-white tracking-tight">
                Checkout PIX
              </h2>
              {productTitle && (
                <p className="text-xs text-zinc-400 truncate max-w-[210px] sm:max-w-[260px]">
                  {productTitle}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar checkout"
            className="p-2 rounded-full text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Embedded PixPaymentCard Container */}
        <div className="pt-1">
          <PixPaymentCard
            pixCode={pixCode}
            qrCodeBase64={qrCodeBase64}
            amount={amount}
            orderId={orderId}
            status={status}
            isEmbedded={true}
            onCopy={onCopy}
            onRetry={onRetry}
            onBack={onClose}
          />
        </div>

        {/* Modal Footer Note */}
        <div className="text-center pt-1.5 border-t border-white/5">
          <p className="text-[11px] text-zinc-400 leading-normal">
            Você pode fechar este modal a qualquer momento. O pagamento permanecerá ativo.
          </p>
        </div>

      </div>
    </div>
  );
}
