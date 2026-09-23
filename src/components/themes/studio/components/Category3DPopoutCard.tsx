"use client";

import React from "react";
import Link from "next/link";
import { 
  Heart, 
  Ghost, 
  Theater, 
  Film, 
  Zap, 
  Popcorn, 
  Rocket, 
  Crown, 
  Tv, 
  Sparkles, 
  Flame, 
  Gem, 
  Users, 
  Globe, 
  Bookmark,
  LucideIcon
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  iconName?: string | null;
}

interface Category3DPopoutCardProps {
  category: Category;
  storeSlug: string;
  isActive?: boolean;
}

// 3D Icon Visual Renderer with satin gradient background & 3D drop shadow depth
function Category3DIconRenderer({ name, iconName }: { name: string; iconName?: string | null }) {
  const norm = (iconName || name || "").toLowerCase();

  let IconComp: LucideIcon = Tv;
  let gradientClass = "from-zinc-700 via-zinc-800 to-zinc-950";
  let iconColor = "text-zinc-100";
  let glowColor = "rgba(255,255,255,0.15)";

  if (norm.includes("romance") || norm.includes("coração") || norm.includes("heart")) {
    IconComp = Heart;
    gradientClass = "from-red-500 via-rose-600 to-pink-900";
    iconColor = "text-white";
    glowColor = "rgba(239, 68, 68, 0.4)";
  } else if (norm.includes("suspense") || norm.includes("terror") || norm.includes("ghost")) {
    IconComp = Ghost;
    gradientClass = "from-zinc-800 via-red-950 to-black";
    iconColor = "text-red-400";
    glowColor = "rgba(185, 28, 28, 0.4)";
  } else if (norm.includes("drama") || norm.includes("teatro") || norm.includes("theater")) {
    IconComp = Theater;
    gradientClass = "from-purple-600 via-indigo-800 to-slate-950";
    iconColor = "text-purple-200";
    glowColor = "rgba(147, 51, 234, 0.4)";
  } else if (norm.includes("ação") || norm.includes("acao") || norm.includes("zap") || norm.includes("film")) {
    IconComp = Zap;
    gradientClass = "from-amber-500 via-orange-600 to-red-950";
    iconColor = "text-amber-100";
    glowColor = "rgba(245, 158, 11, 0.4)";
  } else if (norm.includes("comédia") || norm.includes("comedia") || norm.includes("popcorn")) {
    IconComp = Popcorn;
    gradientClass = "from-yellow-500 via-amber-600 to-red-900";
    iconColor = "text-yellow-100";
    glowColor = "rgba(234, 179, 8, 0.4)";
  } else if (norm.includes("ficção") || norm.includes("ficcao") || norm.includes("ufo") || norm.includes("rocket")) {
    IconComp = Rocket;
    gradientClass = "from-cyan-500 via-blue-700 to-slate-950";
    iconColor = "text-cyan-100";
    glowColor = "rgba(6, 182, 212, 0.4)";
  } else if (norm.includes("bilionário") || norm.includes("bilionario") || norm.includes("ceo") || norm.includes("crown")) {
    IconComp = Crown;
    gradientClass = "from-amber-400 via-yellow-600 to-amber-950";
    iconColor = "text-amber-100";
    glowColor = "rgba(251, 191, 36, 0.4)";
  } else if (norm.includes("brasileiras") || norm.includes("users") || norm.includes("globe")) {
    IconComp = Globe;
    gradientClass = "from-emerald-500 via-teal-700 to-slate-950";
    iconColor = "text-emerald-100";
    glowColor = "rgba(16, 185, 129, 0.4)";
  } else if (norm.includes("lgbt") || norm.includes("sparkles") || norm.includes("gem")) {
    IconComp = Sparkles;
    gradientClass = "from-pink-500 via-purple-600 to-indigo-950";
    iconColor = "text-pink-100";
    glowColor = "rgba(236, 72, 153, 0.4)";
  }

  return (
    <div 
      className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br ${gradientClass} flex items-center justify-center p-2.5 shadow-lg border border-white/20 relative group-hover:scale-110 transition-all duration-300`}
      style={{
        boxShadow: `0 8px 16px -2px rgba(0,0,0,0.8), 0 0 12px ${glowColor}`
      }}
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/40 via-transparent to-white/25 pointer-events-none" />
      <IconComp className={`w-full h-full ${iconColor} relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]`} />
    </div>
  );
}

export function Category3DPopoutCard({ category, storeSlug, isActive = false }: Category3DPopoutCardProps) {
  return (
    <Link
      href={`/miniapp/${storeSlug}/category/${category.slug}`}
      className="shrink-0 relative w-[105px] sm:w-[120px] pt-4 group select-none transition-all duration-300 active:scale-95 block"
    >
      {/* 3D Icon popping OUT above the top edge of the card body */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center pointer-events-none transition-all duration-300 group-hover:-translate-y-1.5 group-hover:scale-105">
        {category.imageUrl ? (
          <img
            src={category.imageUrl}
            alt={category.name}
            className="w-full h-full object-contain filter drop-shadow-[0_8px_12px_rgba(0,0,0,0.85)]"
          />
        ) : (
          <Category3DIconRenderer name={category.name} iconName={category.iconName} />
        )}
      </div>

      {/* Dark Glass Card Body sitting underneath the 3D Icon */}
      <div
        className={`relative z-10 w-full pt-8 pb-2.5 px-2 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-end text-center ${
          isActive
            ? "bg-gradient-to-b from-[#221215]/95 via-[#161214]/95 to-[#0F0A0D]/95 border-red-500/80 shadow-[0_0_18px_rgba(239,68,68,0.35)]"
            : "bg-gradient-to-b from-[#1E1E24]/90 via-[#121216]/90 to-[#0A0A0E]/95 border-white/10 shadow-lg shadow-black/70 group-hover:border-white/30 group-hover:bg-[#18181E] group-hover:shadow-black/90"
        }`}
      >
        {/* Category Name */}
        <span
          className={`text-[10px] sm:text-[11px] font-black tracking-wider uppercase truncate max-w-full leading-none transition-colors duration-200 ${
            isActive
              ? "text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]"
              : "text-zinc-300 group-hover:text-white"
          }`}
        >
          {category.name}
        </span>

        {/* Active Red Indicator Pill */}
        {isActive ? (
          <div className="w-4 h-1 mt-1.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse" />
        ) : (
          <div className="w-3 h-0.5 mt-1.5 bg-white/10 rounded-full group-hover:bg-white/30 transition-colors" />
        )}
      </div>
    </Link>
  );
}
