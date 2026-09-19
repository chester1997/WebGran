"use client";

import React, { useState } from "react";
import { PlayCircle, Lock, RefreshCw, ShoppingCart, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatAccessExpirationBR } from "@/lib/orders/expiration-utils";

export interface AccessCardData {
  id: string;
  status: string;
  deliveryStatus: string;
  expiresAt: Date | string | null;
  inviteLink: string | null;
  product: {
    id: string;
    title: string;
    slug: string;
    coverUrl: string | null;
    deliveryType: string | null;
    deliveryValue: string | null;
    duration: string | null;
  };
}

export function StudioAccessCard({
  access,
  storeSlug,
  initialDestinationUrl,
  initialDestinationType,
}: {
  access: AccessCardData;
  storeSlug: string;
  initialDestinationUrl?: string | null;
  initialDestinationType?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(access.status);
  const [destinationUrl, setDestinationUrl] = useState<string | null>(initialDestinationUrl || null);

  const expiresAtDate = access.expiresAt ? new Date(access.expiresAt) : null;
  const expInfo = formatAccessExpirationBR(expiresAtDate, currentStatus);
  const isExpired = currentStatus === 'EXPIRED' || expInfo.isExpired;
  const isFailedDelivery = access.deliveryStatus === 'FAILED';
  const isPendingDelivery = access.deliveryStatus === 'PENDING';

  const handleAccessContent = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const res = await fetch("/api/telegram/access/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessId: access.id, storeSlug }),
      });

      const data = await res.json();

      console.log("[WEBGRAN ACCESS OPEN]", {
        accessId: access.id,
        telegramChatId: access.product.deliveryValue,
        telegramUserId: data.telegramUserId,
        membershipStatus: data.membershipStatus,
        accessStatus: data.status,
        destinationType: data.destinationType,
        destinationUrl: data.destinationUrl
      });

      if (!res.ok || !data.success) {
        if (data.status === 'EXPIRED') {
          setCurrentStatus('EXPIRED');
        }
        setErrorMessage(data.error || data.message || "Não foi possível abrir o conteúdo.");
        setLoading(false);
        return;
      }

      if (data.destinationUrl) {
        setDestinationUrl(data.destinationUrl);
        openLink(data.destinationUrl);
      } else {
        setErrorMessage("Link de acesso não disponível.");
      }
    } catch (err: any) {
      console.error("[StudioAccessCard] Click error:", err);
      setErrorMessage("Erro ao processar acesso. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const openLink = (url: string) => {
    if (typeof window !== "undefined") {
      const tgWebApp = (window as any).Telegram?.WebApp;
      if (tgWebApp && typeof tgWebApp.openTelegramLink === "function" && url.includes("t.me")) {
        tgWebApp.openTelegramLink(url);
      } else if (tgWebApp && typeof tgWebApp.openLink === "function") {
        tgWebApp.openLink(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }
  };

  return (
    <div className="relative aspect-[16/10] sm:aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 group flex flex-col justify-between">
      <div 
        className="absolute inset-0 bg-cover bg-center" 
        style={{ backgroundImage: `url(${access.product.coverUrl || ''})` }} 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
      
      {/* Header Status Badges */}
      <div className="relative z-10 p-3 flex items-center justify-between">
        {isExpired ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full border border-red-500/30 backdrop-blur-md">
            🔴 Acesso expirado
          </span>
        ) : isFailedDelivery || isPendingDelivery ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full border border-amber-500/30 backdrop-blur-md">
            🟡 Entrega pendente
          </span>
        ) : expInfo.isLifetime ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/30 backdrop-blur-md">
            🟢 Acesso vitalício
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/30 backdrop-blur-md">
            🟢 Acesso ativo
          </span>
        )}
      </div>

      {/* Footer Content & Actions */}
      <div className="relative z-10 p-4 flex flex-col justify-end">
        <h3 className="font-bold text-base leading-tight text-white line-clamp-2 drop-shadow mb-1">
          {access.product.title}
        </h3>

        {/* Expiration date text */}
        <div className="text-xs text-zinc-400 mb-3 space-y-0.5">
          {expInfo.isLifetime ? (
            <p className="text-emerald-400 font-medium">Vitalício • Sem data limite</p>
          ) : isExpired ? (
            <p className="text-red-400 font-medium">{expInfo.dateFormatted}</p>
          ) : (
            <p className="text-zinc-300">
              {expInfo.dateFormatted}
              {expInfo.daysRemaining !== null && (
                <span className="text-zinc-400 ml-1.5">({expInfo.daysRemaining} {expInfo.daysRemaining === 1 ? 'dia restante' : 'dias restantes'})</span>
              )}
            </p>
          )}
        </div>

        {errorMessage && (
          <p className="text-xs text-red-400 mb-2 font-medium bg-red-950/60 p-1.5 rounded border border-red-800/40">
            {errorMessage}
          </p>
        )}

        {/* Action Button */}
        {isExpired ? (
          <Link
            href={`/miniapp/${storeSlug}/product/${access.product.slug}`}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow"
          >
            <ShoppingCart className="w-4 h-4" />
            Comprar novamente
          </Link>
        ) : isFailedDelivery ? (
          <Link
            href={`/miniapp/${storeSlug}/product/${access.product.slug}`}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar liberar acesso
          </Link>
        ) : (
          <button 
            type="button"
            onClick={handleAccessContent}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Obtendo acesso...
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4" />
                {initialDestinationType === 'DIRECT_CHAT' ? 'Entrar no Grupo' : 'Acessar Conteúdo'}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
