"use client";

import { Check } from "lucide-react";

export type LegacySharingMode = "EXCLUSIVE" | "CUSTOM" | "ALL_EXISTING";

type BotOption = { id: string; username: string; displayName?: string | null };

interface Props {
  bots: BotOption[];
  ownerBotId: string;
  mode: LegacySharingMode;
  onModeChange: (mode: LegacySharingMode) => void;
  extraBotIds: string[];
  onExtraBotIdsChange: (ids: string[]) => void;
  /** Sem bot proprietário escolhido, o primeiro bot marcado vira o proprietário. */
  onOwnerChange?: (id: string) => void;
}

const OPTIONS: [LegacySharingMode, string][] = [
  ["EXCLUSIVE", "Somente este bot"],
  ["CUSTOM", "Escolher bots"],
  ["ALL_EXISTING", "Todos os bots"],
];

/**
 * Compartilhamento do produto no modo "Bot Específico" (cadastro e edição do painel dos vendedores).
 * Em "Escolher bots" o produto aparece no bot proprietário e nos bots marcados.
 */
export function BotSharingPicker({ bots, ownerBotId, mode, onModeChange, extraBotIds, onExtraBotIdsChange, onOwnerChange }: Props) {
  const others = bots.filter((b) => b.id !== ownerBotId);
  const extras = extraBotIds.filter((id) => others.some((b) => b.id === id));
  const total = (ownerBotId ? 1 : 0) + extras.length;

  const toggle = (id: string) => {
    if (!ownerBotId && onOwnerChange) {
      onOwnerChange(id);
      onExtraBotIdsChange(extras.filter((x) => x !== id));
      return;
    }
    onExtraBotIdsChange(extras.includes(id) ? extras.filter((x) => x !== id) : [...extras, id]);
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Compartilhamento</label>
      {mode === "CUSTOM" && ownerBotId && (
        <input type="hidden" name="targetBotIds" value={JSON.stringify([ownerBotId, ...extras])} />
      )}
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value)}
            className={`p-2 rounded-lg border text-xs text-left transition-all ${
              mode === value
                ? "border-[#3984FF] bg-[#3984FF]/10 text-white font-medium"
                : "border-white/[0.08] bg-[#15171D] text-zinc-400 hover:border-white/20"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "CUSTOM" && (
        <div className="mt-2 flex flex-col gap-1.5">
          {others.length === 0 ? (
            <p className="text-[11px] text-zinc-500">Sua loja só tem este bot. Crie outro bot para compartilhar o produto.</p>
          ) : (
            others.map((b) => {
              const on = extras.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggle(b.id)}
                  aria-pressed={on}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs text-left transition-all ${
                    on ? "border-[#3984FF]/60 bg-[#3984FF]/10 text-white" : "border-white/[0.08] bg-[#15171D] text-zinc-300 hover:border-white/20"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      on ? "bg-[#3984FF] border-[#3984FF]" : "border-white/25"
                    }`}
                  >
                    {on && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <span className="truncate">{b.displayName || `@${b.username}`}</span>
                </button>
              );
            })
          )}
        </div>
      )}

      <p className="text-[11px] text-zinc-500 mt-1.5">
        {mode === "ALL_EXISTING"
          ? "O produto aparece em todos os bots que a loja tem hoje. Bots criados depois não recebem automaticamente."
          : mode === "CUSTOM"
            ? `O produto aparece no bot proprietário e nos bots marcados (${total} ${total === 1 ? "bot" : "bots"}).`
            : "O produto aparece só no Mini App do bot proprietário."}
      </p>
    </div>
  );
}
