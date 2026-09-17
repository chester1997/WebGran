"use client";

import React, { useState } from "react";
import { Play, Check, ShoppingCart } from "lucide-react";
import { useCart, CartItem } from "@/components/miniapp/CartProvider";
import { useRouter } from "next/navigation";

export function AddToCartButton({ 
  product, 
  storeSlug,
  variant = "full"
}: { 
  product: any; 
  storeSlug?: string;
  variant?: "full" | "card";
}) {
  const { items, addToCart } = useCart();
  const router = useRouter();
  const [justAdded, setJustAdded] = useState(false);

  const isAlreadyInCart = items.some(i => i.id === product.id) || justAdded;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAlreadyInCart) {
      addToCart({ ...product, quantity: 1 });
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
    } else if (storeSlug) {
      router.push(`/miniapp/${storeSlug}/cart`);
    }
  };

  if (variant === "card") {
    return (
      <button 
        onClick={handleClick}
        className="flex-1 bg-[#1A1A1E] border border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white text-[11px] font-bold py-2 rounded-lg text-center transition-colors flex items-center justify-center gap-1"
      >
        {isAlreadyInCart ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : "+ Carrinho"}
      </button>
    );
  }

  return (
    <button 
      onClick={handleClick}
      className="w-full flex items-center justify-center gap-2 bg-white text-black font-semibold py-3 rounded-md hover:bg-zinc-200 transition-colors"
    >
      {isAlreadyInCart ? (
        <>
          <Check className="w-5 h-5" />
          <div className="flex flex-col items-center leading-tight">
            <span>Ver no Carrinho</span>
          </div>
        </>
      ) : (
        <>
          <Play className="w-5 h-5 fill-black" />
          <div className="flex flex-col items-center leading-tight">
            <span>Comprar por R$ {Number(product.price).toFixed(2).replace('.', ',')}</span>
          </div>
        </>
      )}
    </button>
  );
}
