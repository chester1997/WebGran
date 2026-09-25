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
  Star,
  Music,
  Swords,
  Baby,
  Laugh,
  Skull,
  FlaskConical,
  BookOpen,
  Camera,
  Volleyball,
  type LucideIcon,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  iconName?: string | null;
}

interface CategoryIconCardProps {
  category: Category;
  storeSlug: string;
  isActive?: boolean;
}

interface IconConfig {
  IconComp: LucideIcon;
  gradientClass: string;
  iconColor: string;
}

function resolveIconAndStyle(iconName?: string | null, name?: string | null): IconConfig {
  const norm = (iconName || name || "").toLowerCase();

  if (norm.includes("romance") || norm.includes("coração") || norm.includes("amor") || norm.includes("heart")) {
    return {
      IconComp: Heart,
      gradientClass: "from-rose-500 via-red-600 to-pink-900",
      iconColor: "text-white"
    };
  }
  if (norm.includes("suspense") || norm.includes("terror") || norm.includes("horror") || norm.includes("ghost")) {
    return {
      IconComp: Ghost,
      gradientClass: "from-zinc-900 via-red-950 to-black",
      iconColor: "text-red-400"
    };
  }
  if (norm.includes("drama") || norm.includes("teatro") || norm.includes("theater")) {
    return {
      IconComp: Theater,
      gradientClass: "from-purple-600 via-indigo-800 to-slate-950",
      iconColor: "text-purple-200"
    };
  }
  if (norm.includes("ação") || norm.includes("acao") || norm.includes("action") || norm.includes("zap")) {
    return {
      IconComp: Zap,
      gradientClass: "from-amber-500 via-orange-600 to-red-950",
      iconColor: "text-amber-100"
    };
  }
  if (norm.includes("comédia") || norm.includes("comedia") || norm.includes("comedy") || norm.includes("popcorn") || norm.includes("humor") || norm.includes("laugh")) {
    return {
      IconComp: Popcorn,
      gradientClass: "from-yellow-500 via-amber-600 to-red-900",
      iconColor: "text-yellow-100"
    };
  }
  if (norm.includes("ficção") || norm.includes("ficcao") || norm.includes("sci-fi") || norm.includes("scifi") || norm.includes("rocket")) {
    return {
      IconComp: Rocket,
      gradientClass: "from-cyan-500 via-blue-700 to-slate-950",
      iconColor: "text-cyan-100"
    };
  }
  if (norm.includes("bilionário") || norm.includes("bilionario") || norm.includes("ceo") || norm.includes("crown") || norm.includes("rei") || norm.includes("queen")) {
    return {
      IconComp: Sparkles,
      gradientClass: "from-fuchsia-500 via-purple-600 to-indigo-950",
      iconColor: "text-white"
    };
  }
  if (norm.includes("doramas") || norm.includes("dorama") || norm.includes("k-drama") || norm.includes("kdrama")) {
    return {
      IconComp: Sparkles,
      gradientClass: "from-pink-500 via-rose-600 to-purple-900",
      iconColor: "text-pink-100"
    };
  }
  if (norm.includes("brasileiras") || norm.includes("nacional") || norm.includes("globe") || norm.includes("world")) {
    return {
      IconComp: Globe,
      gradientClass: "from-emerald-500 via-teal-700 to-slate-950",
      iconColor: "text-emerald-100"
    };
  }
  if (norm.includes("lgbt") || norm.includes("sparkles") || norm.includes("gem")) {
    return {
      IconComp: Sparkles,
      gradientClass: "from-pink-500 via-purple-600 to-indigo-950",
      iconColor: "text-pink-100"
    };
  }
  if (norm.includes("música") || norm.includes("musica") || norm.includes("music")) {
    return {
      IconComp: Music,
      gradientClass: "from-purple-500 via-violet-700 to-indigo-950",
      iconColor: "text-purple-100"
    };
  }
  if (norm.includes("guerra") || norm.includes("luta") || norm.includes("batalha") || norm.includes("swords")) {
    return {
      IconComp: Swords,
      gradientClass: "from-stone-600 via-zinc-800 to-stone-950",
      iconColor: "text-zinc-200"
    };
  }
  if (norm.includes("anime") || norm.includes("manga") || norm.includes("star")) {
    return {
      IconComp: Star,
      gradientClass: "from-indigo-500 via-purple-600 to-pink-900",
      iconColor: "text-indigo-100"
    };
  }
  if (norm.includes("infantil") || norm.includes("kids") || norm.includes("criança") || norm.includes("baby")) {
    return {
      IconComp: Baby,
      gradientClass: "from-sky-400 via-blue-500 to-indigo-800",
      iconColor: "text-sky-100"
    };
  }
  if (norm.includes("crime") || norm.includes("skull")) {
    return {
      IconComp: Skull,
      gradientClass: "from-zinc-800 via-stone-900 to-black",
      iconColor: "text-zinc-300"
    };
  }
  if (norm.includes("lançamento") || norm.includes("lancamento") || norm.includes("flame") || norm.includes("hot")) {
    return {
      IconComp: Flame,
      gradientClass: "from-red-600 via-orange-600 to-amber-500",
      iconColor: "text-amber-100"
    };
  }

  return {
    IconComp: Tv,
    gradientClass: "from-zinc-700 via-zinc-800 to-zinc-950",
    iconColor: "text-zinc-100"
  };
}

export function CategoryIconCard({ category, storeSlug, isActive = false }: CategoryIconCardProps) {
  const { IconComp, gradientClass, iconColor } = resolveIconAndStyle(category.iconName, category.name);

  return (
    <Link
      href={`/miniapp/${storeSlug}/category/${category.slug}`}
      className="shrink-0 flex flex-col items-center gap-1.5 group select-none transition-transform duration-200 active:scale-95 block"
      style={{ minWidth: "72px", maxWidth: "88px" }}
    >
      {/* Vibrant 3D Gradient Icon Box */}
      <div className="relative transition-all duration-300 group-hover:scale-105">
        <div className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${gradientClass} flex items-center justify-center p-3 shadow-md relative transition-all duration-300`}>
          <IconComp className={`w-full h-full ${iconColor} relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]`} />
        </div>
      </div>

      {/* Category Name below */}
      <span className="text-[10px] sm:text-[11px] font-black tracking-wider uppercase text-center truncate max-w-full leading-tight text-zinc-400 group-hover:text-white transition-colors duration-200">
        {category.name}
      </span>
    </Link>
  );
}
