"use client";

import React, { useState } from "react";
import { RefreshCw, ShoppingCart, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { formatAccessExpirationBR } from "@/lib/orders/expiration-utils";

export interface AccessCardData {
  id: string;
  status: string;
  deliveryStatus: string;
  expiresAt: Date | string | null;
  inviteLink: string | null;
  createdAt: Date | string;
  product: {
    id: string;
    title: string;
    slug: string;
    coverUrl: string | null;
    deliveryType: string | null;
    deliveryValue: string | null;
    duration: string | null;
    price: string | number | null;
  };
  order?: {
    id: string;
    total: string | number | null;
    paidAt: Date | string | null;
    createdAt: Date | string;
  } | null;
}

// Status badge configuration
function getStatusBadge(
  status: string,
  deliveryStatus: string,
  expInfo: ReturnType<typeof formatAccessExpirationBR>
) {
  if (status === "EXPIRED" || expInfo.isExpired) {
    return { label: "Expirado", dot: "bg-red-500", text: "text-red-400", bg: "bg-red-500/15 border-red-500/30" };
  }
  if (deliveryStatus === "FAILED") {
    return { label: "Falha na entrega", dot: "bg-red-500", text: "text-red-400", bg: "bg-red-500/15 border-red-500/30" };
  }
  if (deliveryStatus === "PENDING" || status === "PENDING") {
    return { label: "Processando", dot: "bg-amber-400", text: "text-amber-300", bg: "bg-amber-500/15 border-amber-500/30" };
  }
  if (expInfo.isLifetime) {
    return { label: "♾ Vitalício", dot: "bg-emerald-400", text: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-500/30" };
  }
  return { label: "● Ativo", dot: "bg-emerald-400", text: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-500/30" };
}

function formatDateTimeBR(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} • ${hours}:${minutes}`;
}

function formatPriceBR(value: string | number | null | undefined): string {
  if (!value) return "";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "";
  return `R$ ${num.toFixed(2).replace(".", ",")}`;
}

function getShortOrderId(orderId: string): string {
  // Use last 6 chars of UUID (no dashes) — e.g. #WG458720
  const clean = orderId.replace(/-/g, "");
  return `#WG${clean.slice(-6).toUpperCase()}`;
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
  const [, setDestinationUrl] = useState<string | null>(initialDestinationUrl || null);

  const expiresAtDate = access.expiresAt ? new Date(access.expiresAt) : null;
  const expInfo = formatAccessExpirationBR(expiresAtDate, currentStatus);
  const isExpired = currentStatus === "EXPIRED" || expInfo.isExpired;
  const isFailedDelivery = access.deliveryStatus === "FAILED";

  // Short access code from access.id
  const accessCode = getShortOrderId(access.id);

  // Date/time: prefer order.paidAt, then order.createdAt, then access.createdAt
  const displayDate =
    access.order?.paidAt ||
    access.order?.createdAt ||
    access.createdAt;

  // Price: prefer order.total, then product.price
  const displayPrice =
    access.order?.total || access.product.price;

  const badge = getStatusBadge(currentStatus, access.deliveryStatus, expInfo);

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
        destinationUrl: data.destinationUrl,
      });

      if (!res.ok || !data.success) {
        if (data.status === "EXPIRED") {
          setCurrentStatus("EXPIRED");
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
    } catch (err: unknown) {
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
    <div className="w-full rounded-2xl bg-[#111214] border border-white/8 overflow-hidden shadow-lg">
      {/* Header row: access code + status badge */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-[13px] font-bold text-white/90 tracking-wide">{accessCode}</span>
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${badge.bg} ${badge.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} inline-block`} />
          {badge.label}
        </span>
      </div>

      {/* Date/time sub-header */}
      <div className="px-4 pb-3">
        <span className="text-[11px] text-white/35 font-medium">
          {formatDateTimeBR(displayDate)}
        </span>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-white/6" />

      {/* Content row: poster + info */}
      <div className="flex gap-3 px-4 py-3">
        {/* Poster thumbnail — aspect 2/3 */}
        <div className="relative flex-shrink-0 w-[62px] rounded-xl overflow-hidden bg-zinc-800" style={{ aspectRatio: "2/3" }}>
          {access.product.coverUrl ? (
            <Image
              src={access.product.coverUrl}
              alt={access.product.title}
              fill
              className="object-cover"
              sizes="62px"
            />
          ) : (
            <div className="absolute inset-0 bg-zinc-700 flex items-center justify-center">
              <span className="text-zinc-500 text-xs">?</span>
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="flex flex-col justify-center gap-0.5 flex-1 min-w-0">
          <h3 className="text-[14px] font-bold text-white leading-snug line-clamp-2">
            {access.product.title}
          </h3>
          {access.product.duration && (
            <p className="text-[12px] text-white/45 mt-0.5">{access.product.duration}</p>
          )}
          {displayPrice && (
            <p className="text-[15px] font-bold text-white mt-1">
              {formatPriceBR(displayPrice)}
            </p>
          )}
          {/* Expiration info */}
          {!isExpired && (
            <p className={`text-[11px] mt-1 font-medium ${expInfo.isLifetime ? "text-emerald-400" : "text-white/40"}`}>
              {expInfo.isLifetime
                ? "Vitalício • Sem data limite"
                : expInfo.dateFormatted +
                  (expInfo.daysRemaining !== null && expInfo.daysRemaining > 0
                    ? ` (${expInfo.daysRemaining}d)`
                    : "")}
            </p>
          )}
          {isExpired && (
            <p className="text-[11px] mt-1 font-medium text-red-400">
              {expInfo.dateFormatted}
            </p>
          )}
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="mx-4 mb-3">
          <p className="text-xs text-red-400 font-medium bg-red-950/60 px-3 py-2 rounded-lg border border-red-800/40">
            {errorMessage}
          </p>
        </div>
      )}

      {/* Action button */}
      <div className="px-4 pb-4">
        {isExpired ? (
          <Link
            href={`/miniapp/${storeSlug}/product/${access.product.slug}`}
            className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-semibold text-[13px] py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            Comprar novamente
          </Link>
        ) : isFailedDelivery ? (
          <Link
            href={`/miniapp/${storeSlug}/product/${access.product.slug}`}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold text-[13px] py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar liberar acesso
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleAccessContent}
            disabled={loading}
            className="w-full bg-[#229ED9] hover:bg-[#1a8bc0] disabled:opacity-50 text-white font-bold text-[13px] py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Obtendo acesso...
              </>
            ) : (
              <>
                {/* Telegram airplane icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.09 13.843l-2.963-.924c-.644-.203-.657-.644.136-.953l11.57-4.461c.537-.194 1.006.131.832.916h.029z"/>
                </svg>
                {initialDestinationType === "DIRECT_CHAT" ? "Entrar no Grupo" : "Acessar no Telegram"}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
