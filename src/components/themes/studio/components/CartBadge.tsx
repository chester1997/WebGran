"use client";

import React from "react";
import { useCart } from "@/components/miniapp/CartProvider";

interface CartBadgeProps {
  active?: boolean;
}

export function CartBadge({ active = false }: CartBadgeProps) {
  const { itemCount } = useCart();

  if (itemCount === 0) return null;

  return (
    <div
      className={`absolute top-1 right-2 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
        active
          ? "bg-white text-red-600 shadow-sm"
          : "bg-red-600 text-white"
      }`}
    >
      {itemCount > 9 ? "9+" : itemCount}
    </div>
  );
}
