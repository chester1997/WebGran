"use client";

import React from "react";
import { Play, Check } from "lucide-react";
import { useCart, CartItem } from "@/components/miniapp/CartProvider";
import { useRouter } from "next/navigation";

export function AddToCartButton({ 
  product, 
  storeSlug 
}: { 
  product: Omit<CartItem, 'quantity'>; 
  storeSlug: string;
}) {
  const { items, addToCart } = useCart();
  const router = useRouter();

  const isAlreadyInCart = items.some(i => i.id === product.id);

  const handleClick = () => {
    if (isAlreadyInCart) {
      router.push(`/miniapp/${storeSlug}/cart`);
    } else {
      addToCart({ ...product, quantity: 1 });
      router.push(`/miniapp/${storeSlug}/cart`);
    }
  };

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
            <span>Comprar por R$ {product.price.toFixed(2)}</span>
            {product.price < (product as any).compareAtPrice && (
              <span className="text-[10px] line-through text-zinc-500 font-normal">
                de R$ {(product as any).compareAtPrice.toFixed(2)}
              </span>
            )}
          </div>
        </>
      )}
    </button>
  );
}
