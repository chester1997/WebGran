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
      className={`absolute top-1 right-2 w-4 h-4 rounded-full flex items-center justify-center shadow-sm ${
        active ? "bg-white" : "bg-red-600"
      }`}
      style={{
        backgroundColor: active ? "#ffffff" : "#dc2626",
      }}
    >
      <span
        className="text-[9px] font-extrabold leading-none select-none"
        style={{
          color: active ? "#dc2626" : "#ffffff",
        }}
      >
        {itemCount > 9 ? "9+" : itemCount}
      </span>
    </div>
  );
}
