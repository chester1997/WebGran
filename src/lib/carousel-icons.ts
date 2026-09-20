import React from "react";
import {
  Trophy,
  Flame,
  Star,
  Sparkles,
  Rocket,
  Film,
  Clapperboard,
  Video,
  Tv,
  Heart,
  Zap,
  Drama,
  Ghost,
  Smile,
  Crown,
  Gem,
  Tag,
  BadgePercent,
  ShoppingCart,
  Gift,
  Users,
  Clock,
  Calendar,
  PlayCircle,
  Award,
  Bookmark,
  Compass,
  TrendingUp,
  ShieldCheck,
  LucideIcon,
} from "lucide-react";

export interface CarouselIconItem {
  id: string;
  label: string;
  icon: LucideIcon;
  category: string;
}

export const CAROUSEL_ICONS: CarouselIconItem[] = [
  { id: "Trophy", label: "Troféu", icon: Trophy, category: "Destaque" },
  { id: "Flame", label: "Em Alta (Fogo)", icon: Flame, category: "Destaque" },
  { id: "Star", label: "Estrela", icon: Star, category: "Destaque" },
  { id: "Sparkles", label: "Brilhos", icon: Sparkles, category: "Destaque" },
  { id: "Rocket", label: "Foguete", icon: Rocket, category: "Destaque" },
  { id: "Crown", label: "Coroa VIP", icon: Crown, category: "Destaque" },
  { id: "Gem", label: "Diamante Premium", icon: Gem, category: "Destaque" },
  { id: "Award", label: "Prêmio", icon: Award, category: "Destaque" },

  { id: "Film", label: "Filme", icon: Film, category: "Mídia" },
  { id: "Clapperboard", label: "Claquete", icon: Clapperboard, category: "Mídia" },
  { id: "Video", label: "Vídeo", icon: Video, category: "Mídia" },
  { id: "Tv", label: "Série / TV", icon: Tv, category: "Mídia" },
  { id: "PlayCircle", label: "Play", icon: PlayCircle, category: "Mídia" },

  { id: "Heart", label: "Coração / Romance", icon: Heart, category: "Gênero" },
  { id: "Ghost", label: "Terror / Fantasma", icon: Ghost, category: "Gênero" },
  { id: "Smile", label: "Comédia", icon: Smile, category: "Gênero" },
  { id: "Drama", label: "Drama", icon: Drama, category: "Gênero" },
  { id: "Zap", label: "Ação / Flash", icon: Zap, category: "Gênero" },

  { id: "Tag", label: "Tag de Oferta", icon: Tag, category: "Promoções" },
  { id: "BadgePercent", label: "Desconto %", icon: BadgePercent, category: "Promoções" },
  { id: "ShoppingCart", label: "Mais Vendidos", icon: ShoppingCart, category: "Promoções" },
  { id: "Gift", label: "Presente / Bônus", icon: Gift, category: "Promoções" },

  { id: "Users", label: "Populares", icon: Users, category: "Outros" },
  { id: "Clock", label: "Recentes / Lançamentos", icon: Clock, category: "Outros" },
  { id: "Calendar", label: "Agendados", icon: Calendar, category: "Outros" },
  { id: "Bookmark", label: "Salvos", icon: Bookmark, category: "Outros" },
  { id: "Compass", label: "Explorar", icon: Compass, category: "Outros" },
  { id: "TrendingUp", label: "Tendência", icon: TrendingUp, category: "Outros" },
  { id: "ShieldCheck", label: "Garantido", icon: ShieldCheck, category: "Outros" },
];

export const ICON_MAP: Record<string, LucideIcon> = CAROUSEL_ICONS.reduce((acc, item) => {
  acc[item.id] = item.icon;
  return acc;
}, {} as Record<string, LucideIcon>);

export const DEFAULT_CAROUSEL_PALETTE = [
  { name: "Ouro", hex: "#FFD700" },
  { name: "Laranja", hex: "#FF4500" },
  { name: "Vermelho", hex: "#EF4444" },
  { name: "Rosa", hex: "#EC4899" },
  { name: "Roxo", hex: "#8B5CF6" },
  { name: "Azul", hex: "#3B82F6" },
  { name: "Ciano", hex: "#06B6D4" },
  { name: "Esmeralda", hex: "#10B981" },
  { name: "Branco", hex: "#FFFFFF" },
];

interface CarouselIconRendererProps {
  iconName?: string | null;
  color?: string | null;
  className?: string;
  size?: number;
}

export function CarouselIconRenderer({
  iconName,
  color,
  className = "w-5 h-5",
  size = 20,
}: CarouselIconRendererProps) {
  if (!iconName) return null;

  const IconComponent = ICON_MAP[iconName] || Trophy;

  return React.createElement(IconComponent, {
    size,
    className: `${className} shrink-0`,
    style: { color: color || "currentColor" },
    strokeWidth: 2,
  });
}
