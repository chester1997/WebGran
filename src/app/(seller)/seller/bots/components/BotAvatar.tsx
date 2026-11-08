"use client";

import React, { useState } from "react";

interface BotAvatarProps {
  photoUrl?: string | null;
  botId?: string | null;
  displayName?: string | null;
  username?: string | null;
  size?: "sm" | "md" | "card" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "w-9 h-9 text-xs rounded-full",
  md: "w-12 h-12 text-sm rounded-full",
  card: "w-14 h-14 text-base rounded-full",
  lg: "w-16 h-16 text-lg rounded-full",
  xl: "w-20 h-20 text-xl rounded-full",
};

export default function BotAvatar({
  photoUrl,
  botId,
  displayName,
  username,
  size = "md",
  className = "",
}: BotAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const initial = (displayName || username || "B").trim().charAt(0).toUpperCase();

  // Prioriza a imagem real do bot quando disponível no sistema ou via proxy
  const resolvedPhoto = photoUrl || (botId && photoUrl !== null && photoUrl !== undefined ? `/api/telegram/bot-avatar?botId=${botId}` : null);

  if (resolvedPhoto && !imageError) {
    return (
      <img
        src={resolvedPhoto}
        alt={displayName || username || "Bot"}
        className={`${sizeClasses[size]} object-cover shrink-0 shadow-md ${className}`}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#0A0F1D] border border-white/10 flex items-center justify-center shrink-0 font-bold text-[#3984FF] shadow-md select-none ${className}`}
    >
      {initial}
    </div>
  );
}
