"use client";

import React, { useState, useRef, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
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
  // Posição do menu na tela. Ele abre num portal (fora do card), então nunca é cortado
  // por um "overflow-hidden" do card ou da lista.
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    // Rolou ou mudou o tamanho da tela: fecha (a posição ficaria errada).
    const close = () => setIsOpen(false);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen]);

  const toggle = () => {
    if (isOpen) return setIsOpen(false);
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      const width = 192;
      const height = items.length * 34 + 16;
      const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
      // Sem espaço embaixo: abre para cima.
      const up = r.bottom + height + 8 > window.innerHeight && r.top > height + 8;
      setPos(up ? { bottom: window.innerHeight - r.top + 4, left } : { top: r.bottom + 4, left });
    }
    setIsOpen(true);
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

      {isOpen && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          role="menu"
          aria-label={ariaLabel}
          style={{ position: "fixed", top: pos.top, bottom: pos.bottom, left: pos.left }}
          className="w-48 bg-[#111113] border border-[#26262a] rounded-xl shadow-2xl py-1.5 z-[1000] animate-in fade-in zoom-in-95 duration-150 focus:outline-none"
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
        </div>,
        document.body
      )}
    </div>
  );
}

