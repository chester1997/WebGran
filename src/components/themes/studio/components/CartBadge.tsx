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
      className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center text-[10px] font-extrabold leading-none shadow-sm ${
        active
          ? "bg-white text-red-600"
          : "bg-red-600 text-white"
      }`}
      style={{
        backgroundColor: active ? "#ffffff" : "#dc2626",
        color: active ? "#dc2626" : "#ffffff",
      }}
    >
      {itemCount > 9 ? "9+" : itemCount}
    </div>
  );
}
