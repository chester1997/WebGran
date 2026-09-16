import React from "react";
import Link from "next/link";
import { Play, Info } from "lucide-react";

interface HeroBannerProps {
  storeSlug: string;
  product: {
    id: string;
    slug: string;
    title: string;
    shortDescription: string | null;
    bannerUrl: string | null;
    coverUrl: string | null;
  };
}

export function HeroBanner({ storeSlug, product }: HeroBannerProps) {
  const bgImage = product.bannerUrl || product.coverUrl || "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop";

  return (
    <div className="relative w-full h-[60vh] min-h-[400px] max-h-[600px] flex items-end justify-center">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      {/* Cinematic Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-transparent to-transparent" />
      
      <div className="relative z-10 w-full px-4 pb-8 flex flex-col items-center text-center space-y-4">
        <h1 className="text-4xl font-bold text-white tracking-tight drop-shadow-md">
          {product.title}
        </h1>
        <p className="text-zinc-300 text-sm max-w-sm line-clamp-2 drop-shadow">
          {product.shortDescription || "Assista agora e descubra uma nova experiência."}
        </p>
        
        <div className="flex items-center gap-3 w-full justify-center mt-2">
          <Link href={`/miniapp/${storeSlug}/product/${product.slug}`} className="flex-1 max-w-[140px] flex items-center justify-center gap-2 bg-white text-black font-semibold py-2 rounded-md hover:bg-zinc-200 transition-colors">
            <Play className="w-4 h-4 fill-black" />
            Acessar
          </Link>
          <Link href={`/miniapp/${storeSlug}/product/${product.slug}`} className="flex-1 max-w-[140px] flex items-center justify-center gap-2 bg-zinc-800/80 text-white font-semibold py-2 rounded-md hover:bg-zinc-700/80 backdrop-blur-sm transition-colors">
            <Info className="w-4 h-4" />
            Saiba Mais
          </Link>
        </div>
      </div>
    </div>
  );
}
