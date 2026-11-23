"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { Info, Network, X, Zap } from "lucide-react";

/** Superfície dos grupos: um tom acima do fundo, linha fina. */
export const CARD = "bg-[#121316] border border-white/[0.07] rounded-[14px]";
export const INPUT =
  "w-full bg-[#0d0e11] border border-white/[0.09] hover:border-white/[0.14] focus:border-[#3b82f6] focus:ring-[3px] focus:ring-[#3b82f6]/15 rounded-[9px] px-3 py-2 text-[14px] text-white outline-none transition-[border-color,box-shadow] placeholder:text-zinc-600";
export const BTN_PRI =
  "inline-flex items-center justify-center gap-2 h-9 px-4 rounded-[9px] bg-[#3b82f6] hover:bg-[#2f74e6] text-white text-[13.5px] font-semibold transition-colors disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/50";
export const BTN_SEC =
  "inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-[9px] border border-white/[0.11] bg-[#17181c] hover:bg-[#1d1e23] text-[13.5px] font-medium text-zinc-100 transition-colors disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20";
export const BTN_GHOST =
  "inline-flex items-center justify-center gap-2 h-9 px-3 rounded-[9px] text-[13.5px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20";

export function FlowTypeIcon({ type, size = 38 }: { type: "basic" | "advanced"; size?: number }) {
  const adv = type === "advanced";
  return (
    <span
      className={`shrink-0 rounded-[11px] flex items-center justify-center ${adv ? "bg-violet-400/[0.12] text-violet-300" : "bg-[#3984FF]/[0.12] text-[#60a5fa]"}`}
      style={{ width: size, height: size }}
    >
      {adv ? <Network className="w-[45%] h-[45%]" /> : <Zap className="w-[45%] h-[45%]" />}
    </span>
  );
}

export function TypePill({ type }: { type: "basic" | "advanced" }) {
  return type === "advanced" ? (
    <span className="px-2 py-0.5 rounded-full border border-violet-400/30 bg-violet-400/[0.1] text-violet-300 text-[11px] font-semibold">Avançado</span>
  ) : (
    <span className="px-2 py-0.5 rounded-full border border-[#3984FF]/30 bg-[#3984FF]/[0.1] text-[#60a5fa] text-[11px] font-semibold">Básico</span>
  );
}

export function StatusPill({ status }: { status: "draft" | "published" }) {
  return status === "published" ? (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-400 text-[11px] font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-current" />Publicado</span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-amber-500/25 bg-amber-500/[0.08] text-amber-400 text-[11px] font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-current" />Rascunho</span>
  );
}

export function Callout({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return (
    <div className={`flex gap-2.5 px-3.5 py-3 rounded-[12px] border text-[13px] leading-relaxed ${tone === "warn" ? "bg-amber-500/[0.08] border-amber-500/25 text-amber-100/90" : "bg-[#3984FF]/[0.08] border-[#3984FF]/25 text-slate-300"}`}>
      <Info className={`w-4 h-4 shrink-0 mt-0.5 ${tone === "warn" ? "text-amber-400" : "text-[#60a5fa]"}`} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  busy,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-[#141519] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-white/[0.07]">
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold text-white">{title}</h3>
            {subtitle && <div className="text-[13px] text-zinc-500 mt-0.5">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06]" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children && <div className="px-5 py-4">{children}</div>}
        {footer && <div className="px-5 pt-3 pb-5 flex justify-end gap-2 border-t border-white/[0.07]">{footer}</div>}
      </div>
    </div>
  );
}

/** Função estável (pode entrar em dependências de efeitos). */
export function useToast() {
  return useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("flows-toast", { detail: { msg, kind } }));
  }, []);
}
