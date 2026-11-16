"use client";

import React from "react";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
  className = "",
}: SwitchProps) {
  const switchId = id || (label ? `switch-${String(label).toLowerCase().replace(/\s+/g, "-")}` : undefined);

  const toggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div className={`flex items-start justify-between gap-3 ${disabled ? "opacity-40" : ""} ${className}`}>
      {(label || description) && (
        <div className="flex flex-col min-w-0 flex-1">
          {label && (
            <label
              htmlFor={switchId}
              onClick={toggle}
              className={`text-sm font-medium text-[#f4f4f5] select-none ${
                disabled ? "cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              {label}
            </label>
          )}
          {description && (
            <span className="text-xs text-[#9a9aa2] mt-0.5 select-none leading-relaxed">
              {description}
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        role="switch"
        id={switchId}
        aria-checked={checked}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b] disabled:cursor-not-allowed ${
          checked ? "bg-[#22c55e]" : "bg-[#26262a]"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

