import type { ReactNode } from "react";

/**
 * Selo discreto ao lado do título da página (Redesign V2).
 * Neutro, sem brilho nem cor: número em destaque leve e rótulo apagado.
 */
export function HeaderMeta({ value, label, icon }: { value?: ReactNode; label: ReactNode; icon?: ReactNode }) {
  return (
    <span
      data-header-meta=""
      className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[6px] bg-white/[0.035] ring-1 ring-inset ring-white/[0.06] text-[11.5px] font-medium text-zinc-500 tabular-nums whitespace-nowrap translate-y-[1px]"
    >
      {icon && <span className="text-zinc-500 [&>svg]:w-3 [&>svg]:h-3 flex">{icon}</span>}
      {value !== undefined && <span className="text-zinc-300">{value}</span>}
      {label}
    </span>
  );
}
