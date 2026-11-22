/**
 * Placas de faturamento da WebGran (Premiações).
 * Lista única usada pelo card "Volume de vendas", pela página /seller/premiacoes e pelo admin.
 */

export type PlaqueTheme = {
  /** Cor principal (bordas, cursor, selos). */
  main: string;
  /** Tom claro para textos. */
  light: string;
  /** "r,g,b" para montar rgba(). */
  rgb: string;
  /** Preenchimento da barra de progresso. */
  gradient: string;
};

export type Plaque = {
  value: number;
  /** Selo curto: "50K", "1,5M". */
  short: string;
  /** Nome do nível: "Bronze", "Ouro". */
  level: string;
  theme: PlaqueTheme;
  /**
   * Arte oficial em /public (ex.: "/premiacoes/placa-50k.png").
   * null enquanto a arte não foi enviada: a página mostra a placa desenhada em código.
   */
  art: string | null;
};

export const PLAQUES: Plaque[] = [
  {
    value: 50_000,
    short: "50K",
    level: "Bronze",
    art: null,
    theme: { main: "#cd7f45", light: "#f0a66e", rgb: "205,127,69", gradient: "linear-gradient(90deg, #7c3f1d 0%, #cd7f45 60%, #f5b27a 100%)" },
  },
  {
    value: 250_000,
    short: "250K",
    level: "Prata",
    art: null,
    theme: { main: "#b8c0cc", light: "#e2e8f0", rgb: "184,192,204", gradient: "linear-gradient(90deg, #4b5563 0%, #b8c0cc 60%, #f1f5f9 100%)" },
  },
  {
    value: 500_000,
    short: "500K",
    level: "Ouro",
    art: null,
    theme: { main: "#e0b24a", light: "#f5d27a", rgb: "224,178,74", gradient: "linear-gradient(90deg, #8a6420 0%, #e0b24a 60%, #fbe7a6 100%)" },
  },
  {
    value: 1_000_000,
    short: "1M",
    level: "Safira",
    art: null,
    theme: { main: "#3b82f6", light: "#60a5fa", rgb: "59,130,246", gradient: "linear-gradient(90deg, #1d4ed8 0%, #3b82f6 60%, #93c5fd 100%)" },
  },
  {
    value: 1_500_000,
    short: "1,5M",
    level: "Black Diamond",
    art: null,
    theme: { main: "#a5b4fc", light: "#c7d2fe", rgb: "165,180,252", gradient: "linear-gradient(90deg, #312e81 0%, #818cf8 55%, #e0e7ff 100%)" },
  },
];

export const PLAQUE_VALUES = PLAQUES.map((p) => p.value);

export function getPlaque(value: number): Plaque | undefined {
  return PLAQUES.find((p) => p.value === value);
}

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Nome da placa por extenso: "R$ 50 mil", "R$ 1,5 mi". */
export function formatPlaqueLong(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  return `R$ ${Math.round(value / 1000).toLocaleString("pt-BR")} mil`;
}

/** Percentual legível: uma casa decimal abaixo de 10%, inteiro acima (limitado a 100%). */
export function formatGoalPercent(revenue: number, goal: number): string {
  if (goal <= 0) return "0%";
  const pct = Math.min(100, Math.max(0, (revenue / goal) * 100));
  if (pct > 0 && pct < 10) return `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return `${Math.floor(pct).toLocaleString("pt-BR")}%`;
}

export type PlaqueProgress = {
  /** Próxima placa ainda não alcançada (a última, quando todas já foram). */
  next: Plaque;
  allReached: boolean;
  /** Maior placa conquistada (null se nenhuma). */
  current: Plaque | null;
  reachedCount: number;
};

export function plaqueProgress(revenue: number): PlaqueProgress {
  const reached = PLAQUES.filter((p) => revenue >= p.value);
  const next = PLAQUES.find((p) => revenue < p.value);
  return {
    next: next ?? PLAQUES[PLAQUES.length - 1],
    allReached: !next,
    current: reached[reached.length - 1] ?? null,
    reachedCount: reached.length,
  };
}

/** Status do pedido de resgate da placa física. */
export const REDEMPTION_STATUSES = ["PENDING", "PRODUCING", "SHIPPED", "DELIVERED", "CANCELED"] as const;
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number];

export const REDEMPTION_STATUS_LABEL: Record<RedemptionStatus, string> = {
  PENDING: "Pedido recebido",
  PRODUCING: "Em produção",
  SHIPPED: "Enviada",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
};
