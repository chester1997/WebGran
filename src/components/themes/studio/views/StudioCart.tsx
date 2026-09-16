import React from "react";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";

export function StudioCart({ storeSlug }: { storeSlug: string }) {
  return (
    <div className="p-4 pt-12 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
        <ShoppingCart className="w-8 h-8 text-zinc-600" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Carrinho Vazio</h1>
      <p className="text-zinc-500 mb-8 max-w-[250px]">
        Você ainda não adicionou nenhum título ao seu carrinho.
      </p>
      <Link href={`/miniapp/${storeSlug}`} className="bg-white text-black font-semibold px-8 py-3 rounded-md hover:bg-zinc-200 transition-colors">
        Explorar Catálogo
      </Link>
    </div>
  );
}
