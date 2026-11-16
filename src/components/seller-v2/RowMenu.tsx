"use client";

import React, { useState, useRef, useEffect, ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { IconButton } from "./IconButton";

export interface RowMenuItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface RowMenuProps {
  items: RowMenuItem[];
  ariaLabel?: string;
  className?: string;
}

export function RowMenu({
  items,
  ariaLabel = "Ações",
  className = "",
}: RowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const toggle = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div ref={menuRef} className={`relative inline-block text-left ${className}`}>
      <IconButton
        ref={triggerRef}
        icon={<MoreVertical className="w-4 h-4" />}
        aria-label={ariaLabel}
        variant="ghost"
        size="sm"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={isOpen}
      />

      {isOpen && (
        <div
          role="menu"
          aria-label={ariaLabel}
          className="absolute right-0 mt-1 w-48 bg-[#111113] border border-[#26262a] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 focus:outline-none"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setIsOpen(false);
                item.onClick();
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium transition-colors select-none text-left cursor-pointer disabled:opacity-30 disabled:pointer-events-none ${
                item.danger
                  ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  : "text-[#9a9aa2] hover:text-[#f4f4f5] hover:bg-white/[0.06]"
              }`}
            >
              {item.icon && <span className="shrink-0 text-current">{item.icon}</span>}
              <span className="truncate flex-1">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

