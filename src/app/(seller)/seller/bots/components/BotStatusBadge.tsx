"use client";

import React from "react";

interface BotStatusBadgeProps {
  status: "active" | "paused" | "disconnected" | string;
  size?: "sm" | "default";
}

export default function BotStatusBadge({ status, size = "default" }: BotStatusBadgeProps) {
  const isRunning = status === "active";
  const isPaused = status === "paused";

  const paddingClass = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";

  if (isRunning) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 tracking-wider uppercase select-none ${paddingClass}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Rodando
      </span>
    );
  }

  if (isPaused) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25 tracking-wider uppercase select-none ${paddingClass}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Pausado
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 tracking-wider uppercase select-none ${paddingClass}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
      Desconectado
    </span>
  );
}

