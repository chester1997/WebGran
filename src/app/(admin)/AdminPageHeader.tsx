"use client";

import { ReactNode, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export interface AdminPageHeaderProps {
  children?: ReactNode;
  portalId?: string;
  title?: string;
  badge?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

const emptySubscribe = () => () => {};

export default function AdminPageHeader({
  children,
  portalId = "admin-page-header-portal",
  title,
  badge,
  subtitle,
  actions,
  className = "",
}: AdminPageHeaderProps) {
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
    <header className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full h-full ${className}`}>
      <div className="min-w-0 flex flex-col justify-center">
        <div className="flex flex-wrap items-center gap-2.5">
          {title && (
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              {title}
            </h1>
          )}
          {badge}
        </div>
        {subtitle && (
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </header>
  );

  return createPortal(content, portalTarget);
}
