"use client";

import React, { ReactNode } from "react";

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  backAction?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  backAction,
  className = "",
}: PageHeaderProps) {
  return (
    <header className={`w-full flex flex-col gap-4 pb-4 border-b border-[#1e1e22] ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        {/* Lado Esquerdo: Back + Título + Badge */}
        <div className="flex items-center gap-3 min-w-0">
          {backAction && <div className="shrink-0">{backAction}</div>}
          <div className="flex flex-col min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
                {title}
              </h1>
              {badge && <div className="shrink-0">{badge}</div>}
            </div>
            {subtitle && (
              <p className="text-xs sm:text-sm text-[#9a9aa2] mt-0.5 max-w-2xl line-clamp-2">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Lado Direito: Ações (Botões) */}
        {actions && (
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

