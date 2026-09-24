"use client";

import React, { useState } from "react";
import { Play, Check, ShoppingCart } from "lucide-react";
import { useCart, CartItem } from "@/components/miniapp/CartProvider";

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
    
    console.log("[CART DEBUG] 1 - click recebido no AddToCartButton");
    console.log("[CART DEBUG] 2 - produto recebido no botão:", product);

    if (!product || !product.id) {
      console.error("[CART DEBUG] ERROR: produto sem ID válido", product);
      return;
    }

    const rawPrice = product.price;
    const parsedPrice = Number(rawPrice);
    const validPrice = Number.isFinite(parsedPrice) ? Math.max(0, parsedPrice) : 0;

    const cartItemToInsert: CartItem = {
      id: String(product.id),
      slug: String(product.slug || ""),
      title: String(product.title || "Produto"),
      price: validPrice,
      quantity: 1,
      coverUrl: product.coverUrl || product.bannerUrl || null,
      storeId: String(product.storeId || ""),
    };

    console.log("[CART DEBUG] 3 - antes do addToCart, objeto formatado:", cartItemToInsert);

    try {
      addToCart(cartItemToInsert);
      console.log("[CART DEBUG] 4 - depois do addToCart executado com sucesso");
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
    } catch (err) {
      console.error("[CART DEBUG] ERROR na execução de addToCart:", err);
    }
  };

  if (variant === "icon") {
    return (
      <button 
        type="button"
        onClick={handleClick}
        aria-label="Adicionar ao Carrinho"
        title="Adicionar ao Carrinho"
        className="bg-red-600 hover:bg-red-500 text-white p-1.5 rounded-lg text-center transition-colors flex items-center justify-center shrink-0 cursor-pointer active:scale-95 z-30 shadow-md border border-white/20"
      >
        {justAdded ? (
          <Check className="w-3.5 h-3.5 text-white" />
        ) : (
          <ShoppingCart className="w-3.5 h-3.5 text-white" />
        )}
      </button>
    );
  }

  if (variant === "card") {
    return (
      <button 
        type="button"
        onClick={handleClick}
        className="flex-1 bg-[#1A1A1E] border border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white text-[10px] font-semibold py-1.5 rounded-md text-center transition-colors flex items-center justify-center gap-1 cursor-pointer active:scale-95 z-30"
      >
        {justAdded ? <Check className="w-3 h-3 text-emerald-400" /> : "+ Carrinho"}
      </button>
    );
  }

  return (
    <button 
      type="button"
      onClick={handleClick}
      className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-semibold py-3 rounded-md hover:bg-red-700 transition-colors cursor-pointer z-30"
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
