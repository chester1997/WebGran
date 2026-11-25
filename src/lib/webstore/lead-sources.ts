/** De onde o cliente da Loja Web conheceu a loja (escolhido no cadastro). */
export const LEAD_SOURCES = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "kwai", label: "Kwai" },
  { id: "facebook", label: "Facebook" },
  { id: "youtube", label: "YouTube" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "telegram", label: "Telegram" },
  { id: "google", label: "Google" },
  { id: "indicacao", label: "Indicação" },
  { id: "outro", label: "Outro" },
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number]["id"];

export function isLeadSource(v: unknown): v is LeadSource {
  return typeof v === "string" && LEAD_SOURCES.some((s) => s.id === v);
}

export function leadSourceLabel(v: string | null | undefined): string {
  return LEAD_SOURCES.find((s) => s.id === v)?.label || "Não informado";
}
