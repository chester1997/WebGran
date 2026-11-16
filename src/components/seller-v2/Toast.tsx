"use client";

import React, { useEffect, ReactNode } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastProps {
  id?: string;
  type?: ToastType;
  title?: ReactNode;
  message: ReactNode;
  duration?: number;
  onClose: () => void;
  className?: string;
}

export function Toast({
  type = "info",
  title,
  message,
  duration = 4000,
  onClose,
  className = "",
}: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const config: Record<
    ToastType,
    { icon: React.ReactNode; border: string; bg: string; iconColor: string }
  > = {
    success: {
      icon: <CheckCircle2 className="w-5 h-5" />,
      border: "border-emerald-500/30",
      bg: "bg-[#0e1612]",
      iconColor: "text-emerald-400",
    },
    error: {
      icon: <AlertCircle className="w-5 h-5" />,
      border: "border-red-500/30",
      bg: "bg-[#180e0e]",
      iconColor: "text-red-400",
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5" />,
      border: "border-amber-500/30",
      bg: "bg-[#18150e]",
      iconColor: "text-amber-400",
    },
    info: {
      icon: <Info className="w-5 h-5" />,
      border: "border-blue-500/30",
      bg: "bg-[#0e1218]",
      iconColor: "text-blue-400",
    },
  };

  const current = config[type];

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`flex items-start gap-3 p-4 rounded-xl border ${current.border} ${current.bg} shadow-2xl backdrop-blur-md max-w-sm w-full animate-in slide-in-from-bottom-3 duration-200 ${className}`}
    >
      <div className={`shrink-0 mt-0.5 ${current.iconColor}`}>{current.icon}</div>

      <div className="flex flex-col min-w-0 flex-1">
        {title && (
          <span className="text-sm font-semibold text-[#f4f4f5] leading-tight mb-0.5">
            {title}
          </span>
        )}
        <div className="text-xs text-[#9a9aa2] leading-relaxed">{message}</div>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar notificação"
        className="shrink-0 p-1 rounded-md text-[#71717a] hover:text-[#f4f4f5] hover:bg-white/[0.08] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3b82f6]"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

