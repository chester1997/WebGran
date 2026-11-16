"use client";

import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export type IconButtonVariant = "ghost" | "secondary" | "outline" | "danger" | "primary";
export type IconButtonSize = "sm" | "md" | "lg";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  isLoading?: boolean;
  icon: React.ReactNode;
  "aria-label": string; // Obrigatório para acessibilidade
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant = "ghost",
      size = "md",
      isLoading = false,
      icon,
      className = "",
      disabled,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b] active:scale-[0.95] disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100 cursor-pointer shrink-0";

    const variantStyles: Record<IconButtonVariant, string> = {
      ghost:
        "bg-transparent hover:bg-white/[0.06] active:bg-white/[0.1] text-[#9a9aa2] hover:text-[#f4f4f5] border border-transparent focus-visible:ring-[#60a5fa]",
      secondary:
        "bg-[#16161a] hover:bg-[#1f1f24] active:bg-[#282830] text-[#f4f4f5] border border-[#26262a] hover:border-[#3a3a40] focus-visible:ring-[#60a5fa]",
      outline:
        "bg-transparent hover:bg-white/[0.04] active:bg-white/[0.08] text-[#f4f4f5] border border-[#26262a] hover:border-[#3a3a40] focus-visible:ring-[#60a5fa]",
      danger:
        "bg-transparent hover:bg-red-500/10 active:bg-red-500/20 text-[#f87171] hover:text-red-400 border border-transparent hover:border-red-500/30 focus-visible:ring-[#ef4444]",
      primary:
        "bg-[#3b82f6] hover:bg-[#2563eb] active:bg-[#1d4ed8] text-white shadow-sm shadow-blue-500/20 focus-visible:ring-[#3b82f6] border border-blue-400/30",
    };

    const sizeStyles: Record<IconButtonSize, string> = {
      sm: "w-8 h-8 rounded-lg min-w-[32px] min-h-[32px] text-xs",
      md: "w-10 h-10 rounded-xl min-w-[40px] min-h-[40px] text-sm",
      lg: "w-11 h-11 rounded-xl min-w-[44px] min-h-[44px] text-base",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-label={ariaLabel}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" aria-hidden="true" />
        ) : (
          icon
        )}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";

