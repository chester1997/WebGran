"use client";

import React, { useEffect, useRef, useState } from "react";
import { Film } from "lucide-react";

export interface ProductCoverImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatioClass?: string;
  priority?: boolean;
}

/**
 * Robust, resilient product cover component for Mini App cards.
 * Prevents native browser broken image icons and overlapping alt text
 * when remote CDN or storage endpoints return 403, 404, or are suspended.
 * Preserves 2:3 portrait aspect ratio and graceful cinematic fallbacks.
 */
export function ProductCoverImage({
  src,
  alt,
  className = "w-full h-full object-cover transition-transform duration-500 group-hover:scale-105",
  containerClassName = "",
  aspectRatioClass = "aspect-[2/3]",
  priority = false,
}: ProductCoverImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // A imagem pode terminar de carregar antes da página ficar interativa (hidratação): aí o onLoad
  // não dispara e a capa ficaria invisível. Ao montar, confere se ela já está pronta.
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.complete) return;
    if (img.naturalWidth > 0) setIsLoaded(true);
    else setHasError(true);
  }, [src]);

  const cleanSrc = src?.trim();
  const hasValidUrl = Boolean(cleanSrc && cleanSrc.length > 0 && !cleanSrc.startsWith("blob:null"));

  // If no URL exists or the browser failed to load the remote image
  if (!hasValidUrl || hasError) {
    return (
      <div
        className={`relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 text-zinc-500 overflow-hidden select-none ${aspectRatioClass} ${containerClassName}`}
        aria-label={alt}
        role="img"
      >
        {/* Subtle radial glow and cinematic backdrop pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.06),transparent_70%)] pointer-events-none" />
        <Film className="w-7 h-7 sm:w-8 sm:h-8 text-zinc-600/70 mb-1 stroke-[1.5]" />
        <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-zinc-500/80">
          Série
        </span>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden bg-zinc-900 ${aspectRatioClass} ${containerClassName}`}>
      {/* Skeleton while image is loading to prevent layout shift */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-zinc-900 animate-pulse flex items-center justify-center">
          <Film className="w-6 h-6 text-zinc-700/50 stroke-[1.5]" />
        </div>
      )}
      <img
        ref={imgRef}
        src={cleanSrc}
        alt=""
        aria-hidden="true"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`${className} ${isLoaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
