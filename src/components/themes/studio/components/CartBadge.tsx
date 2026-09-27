"use client";

import React from "react";
import { useCart } from "@/components/miniapp/CartProvider";

interface CartBadgeProps {
  active?: boolean;
}

export function CartBadge({ active = false }: CartBadgeProps) {
  const { itemCount } = useCart();

  if (itemCount === 0) return null;

  const bg = active ? "#ffffff" : "#dc2626";
  const fg = active ? "#cc0000" : "#ffffff";

  return (
    <div
      className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-0.5 rounded-full flex items-center justify-center shadow-md z-20 pointer-events-none"
      style={{
        backgroundColor: bg,
      }}
    >
      <span
        className="text-[10px] font-black leading-none select-none tracking-tighter"
        style={{
          color: fg,
        }}
      >
        {itemCount > 9 ? "9+" : itemCount}
      </span>
    </div>
  );
}
