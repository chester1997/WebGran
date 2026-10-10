"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, Loader2, AlertCircle, RefreshCw } from "lucide-react";

export interface PixPaymentCardProps {
  pixCode?: string | null;
  qrCodeBase64?: string | null;
  amount?: number | string | null;
  orderId?: string | null;
  status?: "pending" | "paid" | "expired" | "failed";
  expiresAt?: string | null;
  isEmbedded?: boolean;
  onCopy?: () => void;
  onRetry?: () => void;
  onBack?: () => void;
}

// Validate payload to prevent rendering empty/null/undefined QR Codes
export function isValidPixCode(pixCode?: string | null): boolean {
  return Boolean(
    pixCode &&
      typeof pixCode === "string" &&
      pixCode.trim().length > 0 &&
      pixCode !== "undefined" &&
      pixCode !== "null"
  );
}

export function PixPaymentCard({
  pixCode,
  qrCodeBase64,
  amount,
  status = "pending",
  isEmbedded = false,
  onCopy,
  onRetry,
  onBack,
}: PixPaymentCardProps) {
  const [copied, setCopied] = useState(false);

  const isCodeValid = isValidPixCode(pixCode);
  const cleanPixCode = isCodeValid ? pixCode!.trim() : "";

  const handleCopy = () => {
    if (!cleanPixCode) return;
    navigator.clipboard.writeText(cleanPixCode);
    setCopied(true);
    if (onCopy) onCopy();
    setTimeout(() => setCopied(false), 2500);
  };

  const formattedAmount =
    amount !== undefined && amount !== null
      ? typeof amount === "number"
        ? amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : `R$ ${Number(amount).toFixed(2).replace(".", ",")}`
      : null;

  if (status === "expired" || status === "failed") {
    return (
      <div className={isEmbedded ? "w-full text-center text-white space-y-4" : "w-full max-w-md mx-auto p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl text-center text-zinc-900 dark:text-white space-y-6"}>
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-500 dark:text-red-400 shadow-lg shadow-red-500/10">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Este Pix não está mais disponível</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-xs mx-auto">
            O tempo de pagamento expirou ou a cobrança foi cancelada. Por favor, gere uma nova cobrança.
          </p>
        </div>
        <div className="flex flex-col gap-3 pt-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full py-3.5 px-6 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all text-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Gerar Novo Pix
            </button>
          )}
          {onBack && (
            <button
              onClick={onBack}
              className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white underline pt-1 font-medium cursor-pointer"
            >
              Voltar para o carrinho
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!isCodeValid) {
    return (
      <div className={isEmbedded ? "w-full text-center text-white space-y-4" : "w-full max-w-md mx-auto p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl text-center text-zinc-900 dark:text-white space-y-6"}>
        <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500 dark:text-amber-400">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Código Pix indisponível</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-xs mx-auto">
            Não foi possível recuperar a chave de pagamento Pix. Tente novamente.
          </p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="w-full py-3.5 px-6 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer"
          >
            Voltar para o carrinho
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={isEmbedded ? "w-full text-zinc-900 dark:text-white flex flex-col items-center space-y-4" : "w-full max-w-md mx-auto p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl text-zinc-900 dark:text-white flex flex-col items-center space-y-5"}>
      {/* Title (Only if not embedded in modal) */}
      {!isEmbedded && (
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">PAGAMENTO VIA PIX</h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Escaneie o QR Code ou copie o código Pix abaixo
          </p>
        </div>
      )}

      {/* QR Code Container */}
      <div className="bg-white p-3.5 rounded-2xl shadow-xl flex items-center justify-center border border-zinc-200 dark:border-zinc-700/60 w-full max-w-[200px] sm:max-w-[220px] aspect-square">
        {qrCodeBase64 ? (
          <img
            src={
              qrCodeBase64.startsWith("data:")
                ? qrCodeBase64
                : `data:image/png;base64,${qrCodeBase64}`
            }
            alt="PIX QR Code"
            className="w-full h-full object-contain"
          />
        ) : (
          <QRCodeSVG
            value={cleanPixCode}
            size={200}
            bgColor="#FFFFFF"
            fgColor="#000000"
            level="M"
            marginSize={2}
            className="w-full h-full"
          />
        )}
      </div>

      {/* Amount Display */}
      {formattedAmount && (
        <div className="text-center space-y-0.5">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Valor Total</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {formattedAmount}
          </div>
        </div>
      )}

      {/* Status Box */}
      <div className="w-full bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-spin flex-shrink-0" />
        <div className="text-xs">
          <p className="font-bold text-amber-800 dark:text-amber-300">Aguardando pagamento</p>
          <p className="text-zinc-600 dark:text-zinc-400 leading-normal">A liberação ocorrerá automaticamente assim que pago.</p>
        </div>
      </div>

      {/* Pix Copia e Cola Input + Copy Button */}
      <div className="w-full space-y-2 pt-1">
        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">PIX Copia e Cola:</label>
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <input
            type="text"
            readOnly
            value={cleanPixCode}
            className="flex-1 min-w-0 w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 text-xs px-3.5 py-3 rounded-xl font-mono truncate focus:outline-none select-all"
          />
          <button
            type="button"
            onClick={handleCopy}
            className={`px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shrink-0 shadow-md min-h-[44px] w-full sm:w-auto active:scale-95 cursor-pointer ${
              copied
                ? "bg-emerald-600 text-white"
                : "bg-red-600 hover:bg-red-500 text-white"
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 shrink-0" /> <span className="whitespace-nowrap font-bold">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 shrink-0" /> <span className="whitespace-nowrap font-bold">Copiar Pix</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Back link (Only if not embedded in modal) */}
      {!isEmbedded && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 underline pt-1 transition-colors font-medium cursor-pointer"
        >
          Voltar para o carrinho
        </button>
      )}
    </div>
  );
}
