"use client";

import React, { useEffect, useRef, ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  isLoading = false,
}: ConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Fechamento por tecla ESC e foco inicial
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Travar scroll do body
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focar botão cancelar por segurança
    setTimeout(() => {
      cancelBtnRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
    >
      {/* Backdrop click */}
      <div
        className="fixed inset-0 -z-10"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />

      {/* Caixa do Diálogo */}
      <div className="relative w-full max-w-md bg-[#0e0e10] border border-[#26262a] rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
        {/* Botão X fechar */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          aria-label="Fechar diálogo"
          className="absolute right-4 top-4 p-1 rounded-lg text-[#71717a] hover:text-[#f4f4f5] hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3b82f6]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Cabeçalho com Ícone */}
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              variant === "danger"
                ? "bg-red-500/10 text-[#f87171] border-red-500/20"
                : "bg-blue-500/10 text-[#60a5fa] border-blue-500/20"
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div className="flex flex-col min-w-0 pr-6">
            <h2
              id="confirm-dialog-title"
              className="text-lg font-bold text-[#f4f4f5] tracking-tight leading-snug"
            >
              {title}
            </h2>
            <div
              id="confirm-dialog-description"
              className="text-sm text-[#9a9aa2] mt-1.5 leading-relaxed"
            >
              {description}
            </div>
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#1e1e22]">
          <Button
            ref={cancelBtnRef}
            variant="ghost"
            size="md"
            disabled={isLoading}
            onClick={onClose}
          >
            {cancelLabel}
          </Button>

          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            size="md"
            isLoading={isLoading}
            onClick={async () => {
              await onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

