"use client";

import React, { useState, useEffect, useMemo } from "react";

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
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [retryCount, setRetryCount] = useState(0);

  const initial = (displayName || username || "B").trim().charAt(0).toUpperCase();

  // Determina a URL segura e estável para o avatar:
  // 1. Se botId existir, sempre prioriza o proxy interno do servidor (re-resolve no Telegram e usa cache de alta performance)
  // 2. Se for uma URL local/upload estável (não url direta do Telegram), utiliza-a
  // 3. URLs diretas da api.telegram.org expiram após 1h e vazam token; são ignoradas no cliente em favor do proxy
  const resolvedPhoto = useMemo(() => {
    if (botId) {
      return `/api/telegram/bot-avatar?botId=${botId}${retryCount > 0 ? `&r=${retryCount}` : ""}`;
    }
    if (photoUrl && !photoUrl.includes("api.telegram.org")) {
      return photoUrl;
    }
    return null;
  }, [botId, photoUrl, retryCount]);

  // Reseta o estado quando botId ou foto mudarem
  useEffect(() => {
    setStatus("loading");
    setRetryCount(0);
  }, [botId, photoUrl]);

  const handleError = () => {
    if (retryCount < 2 && botId) {
      // Tentativa automática controlada para falhas temporárias de rede
      setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        setStatus("loading");
      }, 1500 * (retryCount + 1));
    } else {
      setStatus("error");
    }
  };

  const handleLoad = () => {
    setStatus("loaded");
  };

  const showFallback = !resolvedPhoto || status === "error";

  return (
    <div
      className={`relative ${sizeClasses[size]} rounded-full overflow-hidden shrink-0 select-none ${className}`}
      style={{ aspectRatio: "1 / 1" }}
      data-testid="bot-avatar-container"
    >
      {/* 1. Fallback com a inicial ou placeholder estável durante carregamento */}
      {showFallback ? (
        <div
          data-testid="bot-avatar-fallback"
          className="w-full h-full bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#0A0F1D] border border-white/10 rounded-full flex items-center justify-center font-bold text-[#3984FF] shadow-md"
        >
          {initial}
        </div>
      ) : (
        <>
          {/* 2. Placeholder idêntico por baixo enquanto carrega para evitar layout shift e telas brancas */}
          {status === "loading" && (
            <div
              data-testid="bot-avatar-loading"
              className="absolute inset-0 w-full h-full bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#0A0F1D] border border-white/10 rounded-full flex items-center justify-center font-bold text-[#3984FF]/70 shadow-md animate-pulse"
            >
              {initial}
            </div>
          )}

          {/* 3. Imagem real com fade-in suave e object-cover perfeitamente circular */}
          <img
            src={resolvedPhoto}
            alt={displayName || username || "Bot"}
            onLoad={handleLoad}
            onError={handleError}
            className={`w-full h-full object-cover rounded-full shadow-md transition-opacity duration-200 ${
              status === "loaded" ? "opacity-100" : "opacity-0"
            }`}
          />
        </>
      )}
    </div>
  );
}
