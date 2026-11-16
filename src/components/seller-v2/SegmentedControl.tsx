"use client";

import React, { ReactNode } from "react";

export interface SegmentOption<T extends string = string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = "md",
  fullWidth = false,
  className = "",
}: SegmentedControlProps<T>) {
  const sizeStyles = {
    sm: "h-8 p-0.5 text-xs rounded-lg",
    md: "h-10 p-1 text-sm rounded-xl",
  };

  const itemSizeStyles = {
    sm: "px-2.5 py-1 text-xs rounded-md gap-1.5",
    md: "px-3.5 py-1.5 text-sm rounded-lg gap-2",
  };

  return (
    <div
      role="tablist"
      className={`inline-flex items-center bg-[#111113] border border-[#26262a] ${sizeStyles[size]} ${fullWidth ? "w-full" : ""
        } ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            disabled={opt.disabled}
            onClick={() => onChange(opt.id)}
            className={`inline-flex items-center justify-center font-medium transition-all duration-150 select-none outline-none focus-visible:ring-1 focus-visible:ring-[#3b82f6] ${itemSizeStyles[size]
              } ${fullWidth ? "flex-1" : ""} ${opt.disabled ? "opacity-30 pointer-events-none cursor-not-allowed" : "cursor-pointer"
              } ${isSelected
                ? "bg-[#1f1f24] text-[#f4f4f5] shadow-sm border border-[#3a3a40]/60 font-semibold"
                : "text-[#9a9aa2] hover:text-[#f4f4f5] border border-transparent"
              }`}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span className="truncate">{opt.label}</span>
            {opt.badge && <span className="shrink-0 ml-1">{opt.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

