"use client";

import React from "react";
import { useCart } from "@/components/miniapp/CartProvider";

export function CartBadge() {
  const { itemCount } = useCart();

  if (itemCount === 0) return null;

  return (
    <div className="absolute top-1 right-2 w-4 h-4 bg-red-600 text-white rounded-full flex items-center justify-center text-[9px] font-bold">
      {itemCount > 9 ? "9+" : itemCount}
    </div>
  );
}
