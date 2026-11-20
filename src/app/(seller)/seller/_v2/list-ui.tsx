"use client";

/**
 * Peças visuais compartilhadas do Redesign V2 das páginas de lista
 * (Pedidos, Financeiro e Clientes). Exclusivo da conta proprietária:
 * as páginas só renderizam estes componentes quando isOwnerAccount() é verdadeiro.
 */

import type { ReactNode } from "react";
import { Search, X } from "lucide-react";

export const V2_CARD = "bg-[#141519] border border-white/[0.08] rounded-[16px]";

export const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(v) ? v : 0);

export type StatItem = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "green" | "amber" | "red" | "blue";
  onClick?: () => void;
  active?: boolean;
};

const TONE_TEXT: Record<NonNullable<StatItem["tone"]>, string> = {
  default: "text-white",
  green: "text-emerald-400",
  amber: "text-amber-400",
  red: "text-red-400",
  blue: "text-[#60a5fa]",
};

/** Faixa de números em um único card, separados por divisórias. */
export function StatStrip({ items }: { items: StatItem[] }) {
  const cols = items.length === 4 ? "lg:grid-cols-4" : items.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";
  return (
    <div className={`${V2_CARD} grid grid-cols-2 ${cols} overflow-hidden`}>
      {items.map((item, i) => {
        const Comp = item.onClick ? "button" : "div";
        return (
          <Comp
            key={item.label}
            type={item.onClick ? "button" : undefined}
            onClick={item.onClick}
            className={`text-left px-5 py-4 sm:px-6 sm:py-5 border-white/[0.07] ${i % 2 === 1 ? "border-l" : ""} ${
              i >= 2 ? "border-t lg:border-t-0" : ""
            } ${i >= 1 ? "lg:border-l" : ""} ${
              item.onClick ? "hover:bg-white/[0.02] transition-colors cursor-pointer" : ""
            } ${item.active ? "bg-white/[0.03]" : ""}`}
          >
            <p className="text-[12.5px] text-zinc-500 flex items-center gap-1.5">
              {item.active && <span className="w-1.5 h-1.5 rounded-full bg-[#3984FF]" aria-hidden="true" />}
              {item.label}
            </p>
            <p className={`mt-1 text-[22px] sm:text-[26px] leading-tight font-semibold tracking-tight tabular-nums ${TONE_TEXT[item.tone || "default"]}`}>
              {item.value}
            </p>
            {item.hint && <p className="mt-0.5 text-[12px] text-zinc-500 tabular-nums">{item.hint}</p>}
          </Comp>
        );
      })}
    </div>
  );
}

/** Controle segmentado (filtro de status). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="flex items-center gap-0.5 p-1 rounded-[10px] bg-[#0d0e12] border border-white/[0.07] overflow-x-auto no-scrollbar max-w-full">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[12.5px] font-medium transition-colors ${
              active ? "bg-[#23252b] text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {o.label}
            {typeof o.count === "number" && (
              <span className={`tabular-nums text-[11px] ${active ? "text-zinc-300" : "text-zinc-600"}`}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  id: string;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
      <input
        type="search"
        id={id}
        name="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-lpignore="true"
        data-form-type="other"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0d0e12] border border-white/[0.08] hover:border-white/[0.14] focus:border-[#3984FF] rounded-[10px] py-2 pl-9 pr-8 text-[13px] text-white placeholder:text-zinc-500 outline-none transition-colors [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
          aria-label="Limpar busca"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

const PILL_TONE = {
  green: "text-emerald-400 bg-emerald-500/[0.08] border-emerald-500/20",
  amber: "text-amber-400 bg-amber-500/[0.08] border-amber-500/20",
  red: "text-red-400 bg-red-500/[0.08] border-red-500/20",
  zinc: "text-zinc-400 bg-white/[0.03] border-white/10",
  blue: "text-[#60a5fa] bg-[#3984FF]/[0.08] border-[#3984FF]/25",
} as const;

export function Pill({ tone, children }: { tone: keyof typeof PILL_TONE; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11.5px] font-medium whitespace-nowrap ${PILL_TONE[tone]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

/** Pagamento do pedido: paid → Aprovado, pending → Pendente, resto → Cancelado. */
export function PaymentPill({ status, paidLabel = "Aprovado" }: { status: string; paidLabel?: string }) {
  if (status === "paid") return <Pill tone="green">{paidLabel}</Pill>;
  if (status === "pending") return <Pill tone="amber">Pendente</Pill>;
  return <Pill tone="zinc">Cancelado</Pill>;
}

export function Avatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const initial = (name.trim()[0] || "?").toUpperCase();
  return (
    <span
      className="shrink-0 rounded-full overflow-hidden bg-[#3984FF]/10 border border-white/[0.08] text-[#60a5fa] font-semibold flex items-center justify-center"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {src ? <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" /> : initial}
    </span>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="py-16 px-6 flex flex-col items-center text-center">
      <span className="w-12 h-12 rounded-[12px] border border-white/[0.08] bg-white/[0.02] flex items-center justify-center text-zinc-500">
        {icon}
      </span>
      <p className="mt-3 text-[14px] font-semibold text-zinc-200">{title}</p>
      <p className="mt-1 text-[13px] text-zinc-500 max-w-xs">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Rodapé "Mostrar mais" para listas longas. */
export function LoadMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  if (shown >= total) return null;
  return (
    <div className="px-5 py-4 border-t border-white/[0.07] flex items-center justify-between gap-3">
      <span className="text-[12.5px] text-zinc-500 tabular-nums">
        Mostrando {shown} de {total}
      </span>
      <button
        type="button"
        onClick={onMore}
        className="px-3.5 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.03] hover:bg-white/[0.07] text-[13px] font-semibold text-zinc-100 transition-colors"
      >
        Mostrar mais
      </button>
    </div>
  );
}
