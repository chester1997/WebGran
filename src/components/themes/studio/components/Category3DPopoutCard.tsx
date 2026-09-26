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

import { ICON_MAP } from "@/lib/carousel-icons";

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
  let IconComp: LucideIcon = Tv;
  let gradientClass = "from-zinc-700 via-zinc-800 to-zinc-950";
  let iconColor = "text-zinc-100";

  if (iconName && ICON_MAP[iconName]) {
    IconComp = ICON_MAP[iconName];
    const norm = iconName.toLowerCase();

    if (norm.includes("heart") || norm.includes("romance")) {
      gradientClass = "from-red-500 via-rose-600 to-pink-900";
      iconColor = "text-white";
    } else if (norm.includes("flame") || norm.includes("fire")) {
      gradientClass = "from-red-600 via-orange-600 to-amber-500";
      iconColor = "text-amber-100";
    } else if (norm.includes("star") || norm.includes("trophy") || norm.includes("award")) {
      gradientClass = "from-amber-400 via-yellow-500 to-amber-900";
      iconColor = "text-amber-100";
    } else if (norm.includes("crown") || norm.includes("gem") || norm.includes("sparkles")) {
      gradientClass = "from-fuchsia-500 via-purple-600 to-indigo-950";
      iconColor = "text-white";
    } else if (norm.includes("film") || norm.includes("clapperboard") || norm.includes("video") || norm.includes("play")) {
      gradientClass = "from-blue-600 via-indigo-700 to-slate-950";
      iconColor = "text-blue-100";
    } else if (norm.includes("zap") || norm.includes("sword") || norm.includes("gamepad")) {
      gradientClass = "from-indigo-500 via-purple-600 to-pink-900";
      iconColor = "text-indigo-100";
    } else if (norm.includes("rocket") || norm.includes("ufo") || norm.includes("eye") || norm.includes("wand")) {
      gradientClass = "from-cyan-500 via-blue-700 to-slate-950";
      iconColor = "text-cyan-100";
    } else if (norm.includes("popcorn") || norm.includes("smile") || norm.includes("laugh")) {
      gradientClass = "from-yellow-500 via-amber-600 to-red-900";
      iconColor = "text-yellow-100";
    } else if (norm.includes("ghost") || norm.includes("skull")) {
      gradientClass = "from-zinc-900 via-red-950 to-black";
      iconColor = "text-red-400";
    } else if (norm.includes("globe") || norm.includes("users") || norm.includes("tag")) {
      gradientClass = "from-emerald-500 via-teal-700 to-slate-950";
      iconColor = "text-emerald-100";
    } else if (norm.includes("music") || norm.includes("headphones") || norm.includes("radio")) {
      gradientClass = "from-purple-500 via-violet-700 to-indigo-950";
      iconColor = "text-purple-100";
    } else if (norm.includes("baby")) {
      gradientClass = "from-sky-400 via-blue-500 to-indigo-800";
      iconColor = "text-sky-100";
    } else {
      gradientClass = "from-indigo-600 via-purple-700 to-slate-950";
      iconColor = "text-white";
    }
  } else {
    const norm = (name || "").toLowerCase();

    if (norm.includes("romance") || norm.includes("coração") || norm.includes("heart")) {
      IconComp = Heart;
      gradientClass = "from-red-500 via-rose-600 to-pink-900";
      iconColor = "text-white";
    } else if (norm.includes("suspense") || norm.includes("terror") || norm.includes("ghost")) {
      IconComp = Ghost;
      gradientClass = "from-zinc-800 via-red-950 to-black";
      iconColor = "text-red-400";
    } else if (norm.includes("drama") || norm.includes("teatro") || norm.includes("theater")) {
      IconComp = Theater;
      gradientClass = "from-purple-600 via-indigo-800 to-slate-950";
      iconColor = "text-purple-200";
    } else if (norm.includes("ação") || norm.includes("acao") || norm.includes("zap") || norm.includes("film")) {
      IconComp = Zap;
      gradientClass = "from-amber-500 via-orange-600 to-red-950";
      iconColor = "text-amber-100";
    } else if (norm.includes("comédia") || norm.includes("comedia") || norm.includes("popcorn")) {
      IconComp = Popcorn;
      gradientClass = "from-yellow-500 via-amber-600 to-red-900";
      iconColor = "text-yellow-100";
    } else if (norm.includes("ficção") || norm.includes("ficcao") || norm.includes("ufo") || norm.includes("rocket")) {
      IconComp = Rocket;
      gradientClass = "from-cyan-500 via-blue-700 to-slate-950";
      iconColor = "text-cyan-100";
    } else if (norm.includes("bilionário") || norm.includes("bilionario") || norm.includes("ceo") || norm.includes("crown")) {
      IconComp = Crown;
      gradientClass = "from-amber-400 via-yellow-600 to-amber-950";
      iconColor = "text-amber-100";
    } else if (norm.includes("brasileiras") || norm.includes("users") || norm.includes("globe")) {
      IconComp = Globe;
      gradientClass = "from-emerald-500 via-teal-700 to-slate-950";
      iconColor = "text-emerald-100";
    } else if (norm.includes("lgbt") || norm.includes("sparkles") || norm.includes("gem")) {
      IconComp = Sparkles;
      gradientClass = "from-pink-500 via-purple-600 to-indigo-950";
      iconColor = "text-pink-100";
    }
  }

  return (
    <div 
      className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${gradientClass} flex items-center justify-center p-3 shadow-md relative transition-all duration-300`}
    >
      <IconComp className={`w-full h-full ${iconColor} relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]`} />
    </div>
  );
}

function Category3DPopoutCardBase({ category, storeSlug }: Category3DPopoutCardProps) {
  return (
    <Link
      href={`/miniapp/${storeSlug}/category/${category.slug}`}
      className="shrink-0 flex flex-col items-center gap-1.5 group select-none transition-transform duration-200 active:scale-95 block"
      style={{ minWidth: "72px", maxWidth: "88px" }}
    >
      {/* 3D Icon / Image */}
      <div className="relative transition-all duration-300 group-hover:scale-105">
        {category.imageUrl ? (
          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shadow-md transition-all duration-300">
            <img
              src={category.imageUrl}
              alt={category.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="relative rounded-2xl transition-all duration-300">
            <Category3DIconRenderer name={category.name} iconName={category.iconName} />
          </div>
        )}
      </div>

      {/* Category Name */}
      <span className="text-[10px] sm:text-[11px] font-black tracking-wider uppercase text-center truncate max-w-full leading-tight text-zinc-400 group-hover:text-white transition-colors duration-200">
        {category.name}
      </span>
    </Link>
  );
}

export const Category3DPopoutCard = React.memo(Category3DPopoutCardBase);
