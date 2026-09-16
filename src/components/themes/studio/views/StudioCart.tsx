"use client";

import React, { useState } from "react";
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/components/miniapp/CartProvider";

export function StudioCart({ storeSlug }: { storeSlug: string }) {
  const { items, updateQuantity, removeFromCart, subtotal, total } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCheckout = async () => {
    setIsProcessing(true);
    // Aqui no futuro chamaremos o backend para validar preços e criar o pedido
    setTimeout(() => {
      alert("Integração de pagamento em breve!");
      setIsProcessing(false);
    }, 1000);
  };

  if (items.length === 0) {
    return (
      <div className="p-4 pt-12 flex flex-col items-center justify-center min-h-[60vh] text-center text-white">
        <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
          <ShoppingCart className="w-8 h-8 text-zinc-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Carrinho Vazio</h1>
        <p className="text-zinc-500 mb-8 max-w-[250px]">
          Você ainda não adicionou nenhum produto ao seu carrinho.
        </p>
        <Link href={`/miniapp/${storeSlug}`} className="bg-white text-black font-semibold px-8 py-3 rounded-md hover:bg-zinc-200 transition-colors">
          Explorar Catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 pt-6 pb-24 min-h-screen text-white bg-zinc-950">
      <h1 className="text-2xl font-bold mb-6">Seu Carrinho</h1>

      <div className="space-y-4 mb-8">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50">
            {item.coverUrl ? (
              <img src={item.coverUrl} alt={item.title} className="w-20 h-28 object-cover rounded-md" />
            ) : (
              <div className="w-20 h-28 bg-zinc-800 rounded-md flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-zinc-600" />
              </div>
            )}
            
            <div className="flex-1 flex flex-col py-1">
              <h3 className="font-semibold text-zinc-100 leading-tight mb-1">{item.title}</h3>
              <p className="text-green-500 font-medium mb-auto">R$ {item.price.toFixed(2)}</p>
              
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3 bg-zinc-950 rounded-full border border-zinc-800 px-2 py-1">
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="p-1 text-zinc-400 hover:text-white disabled:opacity-50"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="p-1 text-zinc-400 hover:text-white"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                <button 
                  onClick={() => removeFromCart(item.id)}
                  className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 mb-6 space-y-3">
        <div className="flex justify-between text-zinc-400 text-sm">
          <span>Subtotal</span>
          <span>R$ {subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg pt-3 border-t border-zinc-800">
          <span>Total</span>
          <span>R$ {total.toFixed(2)}</span>
        </div>
      </div>

      <button 
        onClick={handleCheckout}
        disabled={isProcessing}
        className="w-full flex items-center justify-center gap-2 bg-white text-black font-bold py-4 rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50"
      >
        {isProcessing ? "Processando..." : (
          <>
            Finalizar Compra
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </div>
  );
}
