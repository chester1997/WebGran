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

function resolveIcon(iconName?: string | null, name?: string | null): LucideIcon {
  const norm = (iconName || name || "").toLowerCase();

  if (norm.includes("romance") || norm.includes("coração") || norm.includes("amor") || norm.includes("heart")) return Heart;
  if (norm.includes("suspense") || norm.includes("terror") || norm.includes("horror") || norm.includes("ghost")) return Ghost;
  if (norm.includes("drama") || norm.includes("teatro")) return Theater;
  if (norm.includes("ação") || norm.includes("acao") || norm.includes("action") || norm.includes("zap")) return Zap;
  if (norm.includes("comédia") || norm.includes("comedia") || norm.includes("comedy") || norm.includes("popcorn")) return Popcorn;
  if (norm.includes("ficção") || norm.includes("ficcao") || norm.includes("sci-fi") || norm.includes("scifi") || norm.includes("rocket")) return Rocket;
  if (norm.includes("bilionário") || norm.includes("bilionario") || norm.includes("ceo") || norm.includes("crown") || norm.includes("rei") || norm.includes("queen")) return Crown;
  if (norm.includes("globe") || norm.includes("world") || norm.includes("international")) return Globe;
  if (norm.includes("lgbt") || norm.includes("sparkles") || norm.includes("gem")) return Sparkles;
  if (norm.includes("música") || norm.includes("musica") || norm.includes("music")) return Music;
  if (norm.includes("guerra") || norm.includes("luta") || norm.includes("batalha") || norm.includes("sword")) return Swords;
  if (norm.includes("anime") || norm.includes("manga") || norm.includes("star")) return Star;
  if (norm.includes("infantil") || norm.includes("kids") || norm.includes("criança") || norm.includes("baby")) return Baby;
  if (norm.includes("humor") || norm.includes("laugh")) return Laugh;
  if (norm.includes("crime") || norm.includes("skull")) return Skull;
  if (norm.includes("ciência") || norm.includes("ciencia") || norm.includes("flask")) return FlaskConical;
  if (norm.includes("livro") || norm.includes("book") || norm.includes("história")) return BookOpen;
  if (norm.includes("documentary") || norm.includes("document") || norm.includes("camera")) return Camera;
  if (norm.includes("esporte") || norm.includes("sport")) return Volleyball;
  if (norm.includes("flame") || norm.includes("hot") || norm.includes("trending")) return Flame;
  if (norm.includes("fam") || norm.includes("famil") || norm.includes("users")) return Users;
  if (norm.includes("gem") || norm.includes("premium")) return Gem;
  if (norm.includes("film") || norm.includes("movie") || norm.includes("cine")) return Film;

  return Tv;
}

export function CategoryIconCard({ category, storeSlug, isActive = false }: CategoryIconCardProps) {
  const IconComp = resolveIcon(category.iconName, category.name);

  return (
    <Link
      href={`/miniapp/${storeSlug}/category/${category.slug}`}
      className="shrink-0 flex flex-col items-center gap-2 select-none group active:scale-95 transition-transform duration-150"
      style={{ minWidth: "60px", maxWidth: "72px" }}
    >
      {/* Icon card — square, dark, no text inside */}
      <div
        className={`
          w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200
          ${isActive
            ? "bg-white/15 border border-white/30 shadow-[0_0_14px_rgba(255,255,255,0.12)]"
            : "bg-white/6 border border-white/10 group-hover:bg-white/10 group-hover:border-white/20"
          }
        `}
      >
        <IconComp
          className={`w-7 h-7 transition-colors duration-200 ${
            isActive ? "text-white" : "text-white/60 group-hover:text-white/90"
          }`}
          strokeWidth={1.5}
        />
      </div>

      {/* Category name — outside the card, below */}
      <span
        className={`
          text-center text-[11px] font-semibold leading-tight
          max-w-full line-clamp-2 transition-colors duration-200
          ${isActive ? "text-white" : "text-white/55 group-hover:text-white/80"}
        `}
        style={{ wordBreak: "break-word" }}
      >
        {category.name}
      </span>
    </Link>
  );
}
