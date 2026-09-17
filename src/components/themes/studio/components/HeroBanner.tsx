import React from "react";
import Link from "next/link";
import { Play, Info } from "lucide-react";

interface HeroBannerProps {
  storeSlug: string;
  product?: {
    id: string;
    slug: string;
    title: string;
    shortDescription: string | null;
    bannerUrl: string | null;
    coverUrl: string | null;
  };
  banner?: {
    id: string;
    title: string;
    imageUrl: string;
    linkType: string | null;
    linkValue: string | null;
  }
}

export function HeroBanner({ storeSlug, product, banner }: HeroBannerProps) {
  const bgImage = banner?.imageUrl || product?.bannerUrl || product?.coverUrl || "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop";
  const title = banner?.title || product?.title || "Destaque";
  const description = banner ? null : (product?.shortDescription || "Assista agora e descubra uma nova experiência.");
  
  let href = "#";
  if (banner) {
    if (banner.linkType === 'product' && banner.linkValue) href = `/miniapp/${storeSlug}/product/${banner.linkValue}`;
    else if (banner.linkType === 'category' && banner.linkValue) href = `/miniapp/${storeSlug}/category/${banner.linkValue}`;
  } else if (product) {
    href = `/miniapp/${storeSlug}/product/${product.slug}`;
  }

  return (
    <div className="relative w-full h-[55vh] min-h-[380px] max-h-[550px] flex items-end justify-center">


      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      {/* Cinematic Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-transparent to-transparent" />
      
      <div className="relative z-10 w-full px-4 pb-12 flex flex-col items-center text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight drop-shadow-md uppercase">
          {title}
        </h1>
      </div>

    </div>
  );
}
