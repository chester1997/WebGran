"use client";

import React, { ReactNode } from "react";
import { X } from "lucide-react";

export type ChipVariant = "default" | "active" | "inactive" | "warning" | "danger" | "purple" | "info";
export type ChipSize = "sm" | "md";

export interface ChipProps {
  label: ReactNode;
  variant?: ChipVariant;
  size?: ChipSize;
  icon?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
  disabled?: boolean;
}

export function Chip({
  label,
  variant = "default",
  size = "md",
  icon,
  selected = false,
  onClick,
  onRemove,
  className = "",
  disabled = false,
}: ChipProps) {
  const variantStyles: Record<ChipVariant, string> = {
    default: selected
      ? "bg-[#3b82f6]/15 text-[#60a5fa] border-[#3b82f6]/40"
      : "bg-[#16161a] text-[#a1a1aa] border-[#26262a] hover:border-[#3a3a40] hover:text-[#f4f4f5]",
    active: "bg-[#22c55e]/10 text-[#4ade80] border-[#22c55e]/30",
    inactive: "bg-white/[0.04] text-[#71717a] border-white/[0.08]",
    warning: "bg-[#f59e0b]/10 text-[#fbbf24] border-[#f59e0b]/30",
    danger: "bg-[#ef4444]/10 text-[#f87171] border-[#ef4444]/30",
    purple: "bg-[#a855f7]/10 text-[#c084fc] border-[#a855f7]/30",
    info: "bg-[#3b82f6]/10 text-[#60a5fa] border-[#3b82f6]/30",
  };

  const sizeStyles: Record<ChipSize, string> = {
    sm: "h-6 px-2 text-[11px] gap-1",
    md: "h-7.5 px-3 text-xs gap-1.5",
  };

  const interactiveStyles = onClick && !disabled
    ? "cursor-pointer active:scale-95 transition-all select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3b82f6]"
    : "";

  const disabledStyles = disabled ? "opacity-40 pointer-events-none" : "";

  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`inline-flex items-center rounded-full font-medium border shrink-0 ${variantStyles[variant]} ${sizeStyles[size]} ${interactiveStyles} ${disabledStyles} ${className}`}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span className="truncate">{label}</span>
      {onRemove && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remover item"
          className="ml-0.5 p-0.5 rounded-full hover:bg-white/10 text-current transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </Component>
  );
}

