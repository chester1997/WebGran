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
    
    addToCart({ ...product, quantity: 1 });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  if (variant === "card") {
    return (
      <button 
        onClick={handleClick}
        className="flex-1 bg-[#1A1A1E] border border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white text-[10px] font-semibold py-1.5 rounded-md text-center transition-colors flex items-center justify-center gap-1"
      >
        {justAdded ? <Check className="w-3 h-3 text-emerald-400" /> : "+ Carrinho"}
      </button>
    );
  }

  return (
    <button 
      onClick={handleClick}
      className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-semibold py-3 rounded-md hover:bg-red-700 transition-colors"
    >
      {justAdded ? (
        <>
          <Check className="w-5 h-5 text-white" />
          <div className="flex flex-col items-center leading-tight">
            <span>Adicionado ao Carrinho!</span>
          </div>
        </>
      ) : (
        <>
          <Play className="w-5 h-5 fill-white" />
          <div className="flex flex-col items-center leading-tight">
            <span>Comprar por R$ {Number(product.price).toFixed(2).replace('.', ',')}</span>
          </div>
        </>
      )}
    </button>
  );
}
