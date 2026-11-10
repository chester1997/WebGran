"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";

interface BotAvatarProps {
  photoUrl?: string | null;
  botId?: string | null;
  displayName?: string | null;
  username?: string | null;
  size?: "sm" | "md" | "card" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "w-9 h-9 text-xs",
  md: "w-12 h-12 text-sm",
  card: "w-14 h-14 text-base",
  lg: "w-16 h-16 text-lg",
  xl: "w-20 h-20 text-xl",
};

export default function BotAvatar({
  photoUrl,
  botId,
  displayName,
  username,
  size = "md",
  className = "",
}: BotAvatarProps) {
  const imgRef = useRef<HTMLImageElement>(null);

  // Se photoUrl for explicitamente nulo sem botId, sabemos de antemão que não há foto
  const knownNoPhoto = photoUrl === null && !botId;

  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    knownNoPhoto ? "error" : "loading"
  );
  const [retryCount, setRetryCount] = useState(0);

  const initial = (displayName || username || "B").trim().charAt(0).toUpperCase();

  // Determina a URL única, consistente e segura para o avatar:
  // 1. Se botId existir, prioriza o proxy interno do servidor (com auto-atualização do Telegram e ETag)
  // 2. Se for uma URL local/upload estável (não url direta do Telegram), utiliza-a
  const resolvedPhoto = useMemo(() => {
    if (botId) {
      return `/api/telegram/bot-avatar?botId=${botId}${retryCount > 0 ? `&r=${retryCount}` : ""}`;
    }
    if (photoUrl && !photoUrl.includes("api.telegram.org")) {
      return photoUrl;
    }
    return null;
  }, [botId, photoUrl, retryCount]);

  // Checa se a imagem já foi carregada do cache do navegador (evita ficar preso em loading)
  useEffect(() => {
    if (!resolvedPhoto) {
      setStatus("error");
      return;
    }

    if (imgRef.current && imgRef.current.complete) {
      if (imgRef.current.naturalWidth > 0) {
        setStatus("loaded");
        return;
      }
    }

    setStatus(knownNoPhoto ? "error" : "loading");
    setRetryCount(0);
  }, [botId, photoUrl, resolvedPhoto, knownNoPhoto]);

  const handleError = () => {
    // Se o bot tinha foto e falhou pela primeira vez, tenta 1 revalidação fresca
    if (retryCount < 1 && botId && !knownNoPhoto) {
      setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        setStatus("loading");
      }, 1000);
    } else {
      setStatus("error");
    }
  };

  const handleLoad = () => {
    setStatus("loaded");
  };

  return (
    <div
      className={`relative ${sizeClasses[size]} rounded-full overflow-hidden shrink-0 select-none ${className}`}
      style={{ aspectRatio: "1 / 1" }}
      data-testid="bot-avatar-container"
    >
      {/* 1. Placeholder / Fallback elegante com a inicial (ativo até a imagem carregar) */}
      {status !== "loaded" && (
        <div
          data-testid={status === "error" ? "bot-avatar-fallback" : "bot-avatar-loading"}
          className={`w-full h-full bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#0A0F1D] border border-white/10 rounded-full flex items-center justify-center font-bold text-[#3984FF] shadow-md select-none ${
            status === "loading" && !knownNoPhoto ? "animate-pulse text-[#3984FF]/70" : ""
          }`}
        >
          {initial}
        </div>
      )}

      {/* 2. Imagem real do avatar com fade-in suave e object-cover perfeitamente circular */}
      {resolvedPhoto && status !== "error" && (
        <img
          ref={imgRef}
          src={resolvedPhoto}
          alt={displayName || username || "Bot"}
          onLoad={handleLoad}
          onError={handleError}
          className={`absolute inset-0 w-full h-full object-cover rounded-full shadow-md z-10 transition-opacity duration-150 ${
            status === "loaded" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}
