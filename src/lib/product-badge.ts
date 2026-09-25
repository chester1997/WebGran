export interface BadgeOption {
  value: string;
  label: string;
  colorName: string;
  colorHex: string;
}

export const PRODUCT_BADGE_OPTIONS: BadgeOption[] = [
  { value: "", label: "Nenhum Badge", colorName: "Nenhum", colorHex: "#71717A" },
  { value: "novo", label: "Novo", colorName: "Verde", colorHex: "#10B981" },
  { value: "dublado", label: "Dublado (DUB)", colorName: "Azul", colorHex: "#2563EB" },
  { value: "legendado", label: "Legendado (LEG)", colorName: "Vermelho", colorHex: "#DC2626" },
  { value: "br", label: "BR", colorName: "Verde e Amarelo", colorHex: "#10B981" },
  { value: "em_alta", label: "Em alta", colorName: "Amarelo", colorHex: "#FBBF24" },
  { value: "lancamento", label: "Lançamento", colorName: "Roxo", colorHex: "#9333EA" },
];

export interface BadgeConfig {
  value: string;
  label: string;
  className: string;
  sellerBadgeClass: string;
}

export function getProductBadge(badgeValue?: string | null): BadgeConfig | null {
  if (!badgeValue) return null;
  const normalized = badgeValue.toLowerCase().trim().replace(/\s+/g, '_');

  switch (normalized) {
    case "novo":
      return {
        value: "novo",
        label: "Novo",
        className: "bg-emerald-600 text-white font-extrabold text-[8px] px-1.25 py-[1px] rounded-[2px] shadow-sm border border-emerald-400/30 tracking-wider uppercase leading-none",
        sellerBadgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      };
    case "dublado":
      return {
        value: "dublado",
        label: "DUB",
        className: "bg-blue-600 text-white font-extrabold text-[8px] px-1.25 py-[1px] rounded-[2px] shadow-sm border border-blue-400/30 tracking-wider uppercase leading-none",
        sellerBadgeClass: "bg-blue-500/20 text-blue-400 border-blue-500/30"
      };
    case "legendado":
      return {
        value: "legendado",
        label: "LEG",
        className: "bg-red-600 text-white font-extrabold text-[8px] px-1.25 py-[1px] rounded-[2px] shadow-sm border border-red-400/30 tracking-wider uppercase leading-none",
        sellerBadgeClass: "bg-red-500/20 text-red-400 border-red-500/30"
      };
    case "br":
    case "nacional":
      return {
        value: "br",
        label: "BR",
        className: "bg-gradient-to-r from-emerald-600 via-green-500 to-amber-400 text-zinc-950 font-extrabold text-[8px] px-1.25 py-[1px] rounded-[2px] shadow-sm border border-emerald-400/40 tracking-wider uppercase leading-none",
        sellerBadgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      };
    case "em_alta":
      return {
        value: "em_alta",
        label: "Em alta",
        className: "bg-amber-400 text-zinc-950 font-black text-[8px] px-1.25 py-[1px] rounded-[2px] shadow-sm border border-amber-300/60 tracking-wider uppercase leading-none",
        sellerBadgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/30"
      };
    case "lancamento":
      return {
        value: "lancamento",
        label: "Lançamento",
        className: "bg-purple-600 text-white font-extrabold text-[8px] px-1.25 py-[1px] rounded-[2px] shadow-sm border border-purple-400/30 tracking-wider uppercase leading-none",
        sellerBadgeClass: "bg-purple-500/20 text-purple-400 border-purple-500/30"
      };
    default:
      return null;
  }
}
