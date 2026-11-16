"use client";

import React, { ReactNode } from "react";
import { AlertCircle, CheckCircle2, RotateCcw, Save } from "lucide-react";
import { Button } from "./Button";

export interface UnsavedBarProps {
  hasChanges: boolean;
  changeCount?: number;
  isSaving?: boolean;
  onSave: () => void | Promise<void>;
  onReset?: () => void;
  saveLabel?: string;
  resetLabel?: string;
  successMessage?: string | null;
  errorMessage?: string | null;
  className?: string;
}

export function UnsavedBar({
  hasChanges,
  changeCount,
  isSaving = false,
  onSave,
  onReset,
  saveLabel = "Salvar alterações",
  resetLabel = "Descartar",
  successMessage,
  errorMessage,
  className = "",
}: UnsavedBarProps) {
  return (
    <div
      role="region"
      aria-label="Barra de alterações pendentes"
      className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-8 z-40 flex items-center justify-between gap-3 sm:gap-6 px-4 py-3 bg-[#111113]/95 backdrop-blur-md border border-[#26262a] rounded-2xl shadow-2xl transition-all duration-200 ${hasChanges || successMessage || errorMessage
        ? "opacity-100 translate-y-0 pointer-events-auto"
        : "opacity-80 pointer-events-auto"
        } ${className}`}
    >
      {/* Indicador de Status */}
      <div className="flex items-center gap-2.5 min-w-0">
        {errorMessage ? (
          <>
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-red-400 truncate">
              {errorMessage}
            </span>
          </>
        ) : successMessage ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-emerald-400 truncate">
              {successMessage}
            </span>
          </>
        ) : hasChanges ? (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
            <span className="text-xs sm:text-sm font-medium text-[#f4f4f5] truncate">
              {changeCount && changeCount > 1
                ? `${changeCount} alterações pendentes`
                : "Alterações não salvas"}
            </span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
            <span className="text-xs sm:text-sm text-[#71717a] truncate">
              Nenhuma alteração
            </span>
          </>
        )}
      </div>

      {/* Botões de Ação */}
      <div className="flex items-center gap-2 shrink-0">
        {onReset && hasChanges && (
          <Button
            variant="ghost"
            size="sm"
            disabled={isSaving}
            onClick={onReset}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            {resetLabel}
          </Button>
        )}

        <Button
          variant="primary"
          size="sm"
          isLoading={isSaving}
          disabled={!hasChanges || isSaving}
          onClick={onSave}
          leftIcon={<Save className="w-3.5 h-3.5" />}
        >
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

