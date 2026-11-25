import type { ReactNode } from "react";

export const INPUT =
  "w-full h-11 px-3.5 rounded-[8px] bg-[#121214] border border-white/[0.09] text-[14px] text-white placeholder:text-zinc-600 outline-none focus:border-[#3b82f6]/70 focus:ring-[3px] focus:ring-[#3b82f6]/15 transition";
export const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-[8px] bg-[#3b82f6] hover:bg-[#2f74ea] text-white text-[14px] font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none shadow-[0_8px_22px_-10px_rgba(59,130,246,0.85)]";
export const BTN_GHOST =
  "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 text-[14px] font-medium transition-colors disabled:opacity-50";
export const CARD = "rounded-[12px] border border-white/[0.07] bg-[#111113]";

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="flex items-baseline justify-between gap-2 mb-1.5">
      <span className="text-[13px] font-medium text-zinc-300">{children}</span>
      {hint && <span className="text-[11.5px] text-zinc-500">{hint}</span>}
    </span>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <p className="rounded-[8px] border border-red-500/25 bg-red-500/[0.07] px-3.5 py-2.5 text-[13px] text-red-300">{children}</p>;
}

export const DURATION_LABEL: Record<string, string> = {
  daily: "1 dia",
  weekly: "7 dias",
  monthly: "30 dias",
  quarterly: "3 meses",
  semiannual: "6 meses",
  annual: "1 ano",
  lifetime: "Vitalício",
};

export const DELIVERY_LABEL: Record<string, string> = {
  product_video: "Vídeos aqui na plataforma",
  telegram: "Acesso ao grupo no Telegram",
  TELEGRAM_CHAT: "Acesso ao grupo no Telegram",
  external: "Link de acesso",
};

/** Cartão das telas de entrar/cadastro/senha (fica sobre o fundo com ícones). */
export const AUTH_CARD =
  "relative rounded-[20px] border border-white/[0.08] bg-[#0c0d12]/85 backdrop-blur-md p-6 sm:p-7 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.95)] before:pointer-events-none before:absolute before:inset-x-10 before:-top-px before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#3b82f6]/80 before:to-transparent";
