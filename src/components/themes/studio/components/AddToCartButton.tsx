"use client";

import React, { useState } from "react";
import { Play, Check, ShoppingCart } from "lucide-react";
import { useCart } from "@/components/miniapp/CartProvider";

export function AddToCartButton({ 
  product, 
  storeSlug,
  variant = "full"
}: { 
  product: any; 
  storeSlug?: string;
  variant?: "full" | "card" | "icon";
}) {
  const { items, addToCart } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  if (!product || !product.id) return null;

  const isAlreadyInCart = items.some(i => i.id === product.id) || justAdded;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    addToCart({ 
      id: product.id,
      slug: product.slug || "",
      title: product.title || "Produto",
      price: Number(product.price || 0),
      quantity: 1,
      coverUrl: product.coverUrl || product.bannerUrl || null,
      storeId: product.storeId || "",
    });

    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  if (variant === "icon") {
    return (
      <button 
        type="button"
        onClick={handleClick}
        aria-label="Adicionar ao Carrinho"
        title="Adicionar ao Carrinho"
        className="bg-[#1A1A1E] border border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white p-1.5 rounded-md text-center transition-colors flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
      >
        {justAdded ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <ShoppingCart className="w-3.5 h-3.5 text-zinc-300" />
        )}
      </button>
    );
  }

  if (variant === "card") {
    return (
      <button 
        type="button"
        onClick={handleClick}
        className="flex-1 bg-[#1A1A1E] border border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white text-[10px] font-semibold py-1.5 rounded-md text-center transition-colors flex items-center justify-center gap-1 cursor-pointer active:scale-95"
      >
        {justAdded ? <Check className="w-3 h-3 text-emerald-400" /> : "+ Carrinho"}
      </button>
    );
  }

  return (
    <button 
      type="button"
      onClick={handleClick}
      className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-semibold py-3 rounded-md hover:bg-red-700 transition-colors cursor-pointer"
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
            <span>Comprar por R$ {Number(product.price || 0).toFixed(2).replace('.', ',')}</span>
          </div>
        </>
      )}
    </button>
  );
}
