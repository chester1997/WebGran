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
  Music,
  Swords,
  Baby,
  Laugh,
  Skull,
  FlaskConical,
  BookOpen,
  Camera,
  Volleyball,
  Globe,
  Radio,
  Headphones,
  Eye,
  Wand2,
  Gamepad2,
  Ticket,
  Popcorn,
  Shirt,
  Sparkle,
  Dumbbell,
  Laptop,
  Briefcase,
  Utensils,
  Car,
  Plane,
  Building,
  HeartHandshake,
  Glasses,
  Palette,
  LucideIcon,
} from "lucide-react";

export interface CarouselIconItem {
  id: string;
  label: string;
  icon: LucideIcon;
  category: string;
}

export const CAROUSEL_ICONS: CarouselIconItem[] = [
  // Destaques & Premium
  { id: "Trophy", label: "Troféu", icon: Trophy, category: "Destaque" },
  { id: "Flame", label: "Em Alta", icon: Flame, category: "Destaque" },
  { id: "Star", label: "Estrela / Destaque", icon: Star, category: "Destaque" },
  { id: "Sparkles", label: "Brilho / Especial", icon: Sparkles, category: "Destaque" },
  { id: "Crown", label: "Coroa VIP / CEO", icon: Crown, category: "Destaque" },
  { id: "Gem", label: "Diamante Premium", icon: Gem, category: "Destaque" },
  { id: "Award", label: "Prêmio / Oscar", icon: Award, category: "Destaque" },

  // Mídia & Entretenimento
  { id: "Film", label: "Filme / Cinema", icon: Film, category: "Mídia" },
  { id: "Clapperboard", label: "Claquete", icon: Clapperboard, category: "Mídia" },
  { id: "Video", label: "Vídeo / Câmera", icon: Video, category: "Mídia" },
  { id: "Tv", label: "Série / Novela / TV", icon: Tv, category: "Mídia" },
  { id: "PlayCircle", label: "Play / Dorama", icon: PlayCircle, category: "Mídia" },
  { id: "Popcorn", label: "Pipoca / Sessão", icon: Popcorn, category: "Mídia" },
  { id: "Ticket", label: "Ingresso / Cinema", icon: Ticket, category: "Mídia" },
  { id: "Camera", label: "Documentário", icon: Camera, category: "Mídia" },

  // Gêneros & Estilos
  { id: "Heart", label: "Romance / Coração", icon: Heart, category: "Gênero" },
  { id: "Drama", label: "Drama / Teatral", icon: Drama, category: "Gênero" },
  { id: "Ghost", label: "Terror / Sobrenatural", icon: Ghost, category: "Gênero" },
  { id: "Skull", label: "Crime / Policial", icon: Skull, category: "Gênero" },
  { id: "Zap", label: "Ação / Super-herói", icon: Zap, category: "Gênero" },
  { id: "Smile", label: "Comédia / Divertido", icon: Smile, category: "Gênero" },
  { id: "Laugh", label: "Humor / Stand-up", icon: Laugh, category: "Gênero" },
  { id: "Rocket", label: "Ficção Científica", icon: Rocket, category: "Gênero" },
  { id: "Wand2", label: "Fantasia / Magia", icon: Wand2, category: "Gênero" },
  { id: "Eye", label: "Suspense / Mistério", icon: Eye, category: "Gênero" },
  { id: "Swords", label: "Guerra / Épico / Luta", icon: Swords, category: "Gênero" },
  { id: "Gamepad2", label: "Anime / Games", icon: Gamepad2, category: "Gênero" },

  // Música & Áudio
  { id: "Music", label: "Música / Shows", icon: Music, category: "Áudio" },
  { id: "Headphones", label: "Podcast / Áudio", icon: Headphones, category: "Áudio" },
  { id: "Radio", label: "Rádio / Live", icon: Radio, category: "Áudio" },

  // Infantil & Família
  { id: "Baby", label: "Infantil / Kids", icon: Baby, category: "Família" },
  { id: "Users", label: "Família / Grupos", icon: Users, category: "Família" },

  // Estilo de Vida & Outros
  { id: "Globe", label: "Internacional / Dorama", icon: Globe, category: "Outros" },
  { id: "Volleyball", label: "Esportes / Futebol", icon: Volleyball, category: "Outros" },
  { id: "Dumbbell", label: "Fitness / Saúde", icon: Dumbbell, category: "Outros" },
  { id: "FlaskConical", label: "Ciência / Tech", icon: FlaskConical, category: "Outros" },
  { id: "BookOpen", label: "Educativo / Livros", icon: BookOpen, category: "Outros" },
  { id: "Palette", label: "Arte / Design", icon: Palette, category: "Outros" },
  { id: "Briefcase", label: "Negócios / CEO", icon: Briefcase, category: "Outros" },
  { id: "Utensils", label: "Culinária / Gastronomia", icon: Utensils, category: "Outros" },
  { id: "Glasses", label: "Geek / Nerd", icon: Glasses, category: "Outros" },

  // Ofertas & Promoções
  { id: "Tag", label: "Tag / Oferta", icon: Tag, category: "Promoções" },
  { id: "BadgePercent", label: "Desconto %", icon: BadgePercent, category: "Promoções" },
  { id: "ShoppingCart", label: "Mais Vendidos", icon: ShoppingCart, category: "Promoções" },
  { id: "Gift", label: "Presente / Bônus", icon: Gift, category: "Promoções" },

  // Navegação & Status
  { id: "Clock", label: "Lançamentos / Horário", icon: Clock, category: "Geral" },
  { id: "Calendar", label: "Agenda / Programação", icon: Calendar, category: "Geral" },
  { id: "Bookmark", label: "Salvos / Favoritos", icon: Bookmark, category: "Geral" },
  { id: "Compass", label: "Explorar", icon: Compass, category: "Geral" },
  { id: "TrendingUp", label: "Tendências", icon: TrendingUp, category: "Geral" },
  { id: "ShieldCheck", label: "Exclusivo / Verificado", icon: ShieldCheck, category: "Geral" },
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
