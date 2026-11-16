"use client";

import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    // Base styles
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 cursor-pointer";

    // Variants
    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        "bg-[#3b82f6] hover:bg-[#2563eb] active:bg-[#1d4ed8] text-white shadow-sm shadow-blue-500/20 focus-visible:ring-[#3b82f6] border border-blue-400/30",
      secondary:
        "bg-[#16161a] hover:bg-[#1f1f24] active:bg-[#282830] text-[#f4f4f5] border border-[#26262a] hover:border-[#3a3a40] focus-visible:ring-[#60a5fa]",
      outline:
        "bg-transparent hover:bg-white/[0.04] active:bg-white/[0.08] text-[#f4f4f5] border border-[#26262a] hover:border-[#3a3a40] focus-visible:ring-[#60a5fa]",
      ghost:
        "bg-transparent hover:bg-white/[0.06] active:bg-white/[0.1] text-[#9a9aa2] hover:text-[#f4f4f5] border border-transparent focus-visible:ring-[#60a5fa]",
      danger:
        "bg-[#ef4444] hover:bg-[#dc2626] active:bg-[#b91c1c] text-white shadow-sm shadow-red-500/20 focus-visible:ring-[#ef4444] border border-red-400/30",
    };

    // Sizes
    const sizeStyles: Record<ButtonSize, string> = {
      sm: "h-8 px-3 text-xs rounded-lg gap-1.5 min-h-[32px]",
      md: "h-10 px-4 text-sm rounded-xl gap-2 min-h-[40px] sm:min-h-[38px]",
      lg: "h-12 px-5 text-base rounded-xl gap-2.5 min-h-[44px]",
    };

    const widthStyle = fullWidth ? "w-full" : "";

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" aria-hidden="true" />
        ) : (
          leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>
        )}
        <span className="truncate">{children}</span>
        {!isLoading && rightIcon && (
          <span className="shrink-0 flex items-center">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

