"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

export interface BannerItem {
  id: string;
  title: string;
  imageUrl: string;
  linkType?: string | null;
  linkValue?: string | null;
}

interface HeroBannerProps {
  storeSlug: string;
  banners?: BannerItem[];
  intervalSeconds?: number;
  product?: any;
}

export function HeroBanner({ storeSlug, banners = [], intervalSeconds = 5 }: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Filter only valid banners with image URLs
  const activeBanners = banners.filter(b => b && b.imageUrl);
  const totalBanners = activeBanners.length;

  // 0 Banners -> Return null (do not leave empty space)
  if (totalBanners === 0) {
    return null;
  }

  // Autoplay Effect (Only if 2 or more banners exist)
  useEffect(() => {
    if (totalBanners <= 1) return;

    const intervalMs = Math.max(3, intervalSeconds) * 1000;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalBanners);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [totalBanners, intervalSeconds]);

  // Handle Touch Swipe for Mobile / Telegram WebApp
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const deltaX = touchStartX.current - touchEndX.current;

    // Minimum swipe threshold: 40px
    if (deltaX > 40) {
      // Swiped Left -> Next Banner
      setCurrentIndex((prev) => (prev + 1) % totalBanners);
    } else if (deltaX < -40) {
      // Swiped Right -> Previous Banner
      setCurrentIndex((prev) => (prev - 1 + totalBanners) % totalBanners);
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const currentBanner = activeBanners[currentIndex] || activeBanners[0];

  // Destination link resolution
  let href: string | null = null;
  if (currentBanner.linkType === 'product' && currentBanner.linkValue) {
    href = `/miniapp/${storeSlug}/product/${currentBanner.linkValue}`;
  } else if (currentBanner.linkType === 'category' && currentBanner.linkValue) {
    href = `/miniapp/${storeSlug}/category/${currentBanner.linkValue}`;
  }

  const BannerCard = (
    <div
      onTouchStart={totalBanners > 1 ? handleTouchStart : undefined}
      onTouchMove={totalBanners > 1 ? handleTouchMove : undefined}
      onTouchEnd={totalBanners > 1 ? handleTouchEnd : undefined}
      className="relative w-full aspect-[2.2/1] sm:aspect-[2.5/1] max-h-[260px] overflow-hidden bg-zinc-900 group select-none cursor-pointer flex items-center justify-center"
    >
      {/* Banner Image with Smooth Fade Transition and Perfect Fit */}
      <img
        key={currentBanner.id || currentIndex}
        src={currentBanner.imageUrl}
        alt={currentBanner.title || "Banner"}
        className="w-full h-full object-cover object-center transition-opacity duration-500 ease-in-out"
        onError={(e) => {
          (e.target as HTMLElement).setAttribute(
            "src",
            "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000"
          );
        }}
      />
    </div>
  );

  return (
    <div className="w-full px-0 pt-0 flex flex-col items-center">
      {href ? (
        <Link href={href} className="block w-full">
          {BannerCard}
        </Link>
      ) : (
        BannerCard
      )}
    </div>
  );
}
