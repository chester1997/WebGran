"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const noop = () => () => {};

/**
 * Renderiza direto no <body>: nada do layout do painel (cabeçalho fixo,
 * containers com transform/overflow) consegue cortar ou cobrir o pop-up.
 */
export function Portal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return mounted ? createPortal(children, document.body) : null;
}

/** Mesmo uso do Modal dos fluxos, mas sempre inteiro na tela: cabeçalho e rodapé fixos, só o meio rola. */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  busy,
  wide = false,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  return (
    <Portal>
      <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/75 backdrop-blur-sm" onClick={() => !busy && onClose()}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={(e) => e.stopPropagation()}
          className={`w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} max-h-[calc(100dvh-16px)] sm:max-h-[calc(100dvh-48px)] flex flex-col bg-[#141519] border border-white/10 rounded-t-[12px] sm:rounded-[12px] shadow-2xl overflow-hidden`}
        >
          <div className="shrink-0 flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-white/[0.07]">
            <div className="min-w-0">
              <h3 className="text-[16px] font-semibold text-white">{title}</h3>
              {subtitle && <div className="text-[13px] text-zinc-500 mt-0.5">{subtitle}</div>}
            </div>
            <button type="button" onClick={onClose} disabled={busy} className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06]" aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
          </div>
          {children && <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 py-4">{children}</div>}
          {footer && <div className="shrink-0 px-5 pt-3 pb-5 flex justify-end gap-2 border-t border-white/[0.07]">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}
