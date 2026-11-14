export type DeliveryTypeV2 = "telegram" | "external" | "product_video";

export interface VideoItemV2 {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  fileSizeBytes?: number | null;
  status: string;
}

export interface NewProductFormStateV2 {
  // Step 1
  deliveryType: DeliveryTypeV2;

  // Step 2 - Section 1: Delivery
  deliveryValue: string; // Telegram ID or External Link
  selectedVideos: VideoItemV2[]; // For product_video

  // Step 2 - Section 2: Product
  title: string;
  description: string;
  price: string;
  duration: string;
  discount: string;
  imageUrl: string;
  bannerUrl: string;

  // Step 2 - Section 3: Where it appears
  catalogScope: "STORE_GENERAL" | "BOT_GENERAL" | "BOT_SPECIFIC";
  selectedBotId: string;
  sharingMode: "EXCLUSIVE" | "ALL_EXISTING";
  categoryId: string;
  status: "active" | "draft";
  badge: string;

  // Step 2 - Section 4: Mini App Showcase
  selectedCarouselIds: string[];
  showViews: boolean;
  viewsCount: number;
  showFire: boolean;
  fireCount: number;
}

export const DELIVERY_TYPE_CONFIG: Record<
  DeliveryTypeV2,
  {
    name: string;
    cc: string; // CSS color variable
    colorMixBg5: string;
    colorMixBg12: string;
    colorMixText: string;
    eyebrowDesktop: string;
    eyebrowMobile: string;
    title: string;
    descriptionDesktop: string;
    descriptionMobile: string;
    chipText: string;
    summaryText: string;
  }
> = {
  telegram: {
    name: "Grupo ou canal",
    cc: "#38bdf8",
    colorMixBg5: "color-mix(in srgb, #38bdf8 5%, #0e0e10)",
    colorMixBg12: "color-mix(in srgb, #38bdf8 12%, transparent)",
    colorMixText: "#38bdf8",
    eyebrowDesktop: "COMUNIDADE FECHADA",
    eyebrowMobile: "COMUNIDADE FECHADA",
    title: "Grupo ou canal",
    descriptionDesktop:
      "Grupo, canal ou supergrupo no Telegram. Quem paga entra na hora e quem vence sai sozinho.",
    descriptionMobile: "Quem paga entra na hora e quem vence sai sozinho.",
    chipText: "Convite automático",
    summaryText: "Grupo ou canal · convite automático",
  },
  external: {
    name: "Link externo",
    cc: "#a3e635",
    colorMixBg5: "color-mix(in srgb, #a3e635 5%, #0e0e10)",
    colorMixBg12: "color-mix(in srgb, #a3e635 12%, transparent)",
    colorMixText: "#a3e635",
    eyebrowDesktop: "ACESSO POR LINK",
    eyebrowMobile: "ACESSO POR LINK",
    title: "Link externo",
    descriptionDesktop:
      "Entregue qualquer link ao comprador depois da confirmação do pagamento.",
    descriptionMobile: "Qualquer link enviado após a confirmação do pagamento.",
    chipText: "Link pelo bot",
    summaryText: "Link externo · enviado pelo bot",
  },
  product_video: {
    name: "Vídeo do produto",
    cc: "#c084fc",
    colorMixBg5: "color-mix(in srgb, #c084fc 5%, #0e0e10)",
    colorMixBg12: "color-mix(in srgb, #c084fc 12%, transparent)",
    colorMixText: "#c084fc",
    eyebrowDesktop: "STREAMING NO MINI APP",
    eyebrowMobile: "STREAMING NO MINI APP",
    title: "Vídeo do produto",
    descriptionDesktop:
      "O cliente assiste aos vídeos direto no mini app, com acesso protegido.",
    descriptionMobile: "Vídeos assistidos direto no mini app, com acesso protegido.",
    chipText: "Liberado no mini app",
    summaryText: "Vídeo do produto · liberado no mini app",
  },
};

export const INITIAL_FORM_STATE: NewProductFormStateV2 = {
  deliveryType: "telegram",
  deliveryValue: "",
  selectedVideos: [],
  title: "",
  description: "",
  price: "",
  duration: "lifetime",
  discount: "",
  imageUrl: "",
  bannerUrl: "",
  catalogScope: "STORE_GENERAL",
  selectedBotId: "",
  sharingMode: "EXCLUSIVE",
  categoryId: "",
  status: "active",
  badge: "",
  selectedCarouselIds: [],
  showViews: false,
  viewsCount: 0,
  showFire: false,
  fireCount: 0,
};

