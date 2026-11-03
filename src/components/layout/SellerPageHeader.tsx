"use client";

import { ReactNode, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export interface SellerPageHeaderProps {
  portalId?: string;
  title?: ReactNode;
  badge?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

const emptySubscribe = () => () => {};

export default function SellerPageHeader({
  children,
  portalId = "seller-page-header-portal",
  title,
  badge,
  subtitle,
  actions,
  className = "",
}: SellerPageHeaderProps) {
  const portalTarget = useSyncExternalStore(
    emptySubscribe,
    () => (typeof document !== "undefined" ? document.getElementById(portalId) : null),
    () => null
  );

  if (!portalTarget) {
    return null;
  }

  const content = children ? (
    children
  ) : (
    <div className={`flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-4 w-full h-full relative z-30 overflow-visible ${className}`}>
      {/* Título e Subtítulo */}
      <div className="min-w-0 flex flex-col justify-center">
        <div className="flex flex-wrap items-center gap-2">
          {title && (
            <h1 className="text-base sm:text-xl md:text-2xl font-bold text-white tracking-tight truncate">
              {title}
            </h1>
          )}
          {badge}
        </div>
        {subtitle && (
          <p className="text-zinc-400 text-xs sm:text-sm mt-0.5 md:mt-1 truncate sm:whitespace-normal">
            {subtitle}
          </p>
        )}
      </div>

      {/* Ações / Filtros */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap relative z-30 overflow-visible">
          {actions}
        </div>
      )}
    </div>
  );

  return createPortal(content, portalTarget);
}
