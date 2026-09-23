"use client";

import React, { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import Link from "next/link";
import { ProductCard } from "../components/ProductCard";

export function StudioFavorites({ storeSlug }: { storeSlug: string }) {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`webgran_favorites_${storeSlug}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setFavorites(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load favorites", e);
    }
    setIsLoaded(true);
  }, [storeSlug]);

  if (!isLoaded) {
    return null;
  }

  return (
    <div className="p-4 pt-6 text-white bg-transparent w-full min-h-[80vh]">
      <div className="flex items-center gap-2 mb-6">
        <Heart className="w-6 h-6 text-red-500 fill-red-500" />
        <h1 className="text-2xl font-bold">Meus Favoritos</h1>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <Heart className="w-16 h-16 text-zinc-800 mb-4" />
          <p className="text-zinc-500 max-w-[250px]">
            Você ainda não adicionou nenhum título aos seus favoritos.
          </p>
          <Link
            href={`/miniapp/${storeSlug}/search`}
            className="mt-6 bg-red-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-red-500 transition-colors"
          >
            Explorar Catálogo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          {favorites.map((prod) => (
            <div key={prod.id} className="flex justify-center">
              <ProductCard storeSlug={storeSlug} product={prod} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
