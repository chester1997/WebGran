"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Loader2, Palette, Send } from "lucide-react";
import { saveBotThemeAction } from "../actions";

const SURFACE =
  "relative rounded-[14px] border border-white/[0.07] bg-[linear-gradient(180deg,#191a1f_0%,#121317_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_1px_2px_rgba(0,0,0,0.45),0_14px_30px_-16px_rgba(0,0,0,0.9)]";

type ThemeId = "xds" | null;

/** Selo "Em uso" */
function InUse() {
  return (
    <span className="absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1 h-6 px-2 rounded-[6px] bg-[#3b82f6] text-white text-[11px] font-bold">
      <Check className="w-3.5 h-3.5" /> Em uso
    </span>
  );
}

/** Miniatura desenhada do Tema XDs (logo + nome, categorias, destaque grande, fileiras e menu) */
function XdsMock() {
  return (
    <span aria-hidden="true" className="absolute inset-0 flex flex-col bg-[#111216] p-2.5 gap-2">
      <span className="flex items-center gap-1.5">
        <span className="w-4 h-4 rounded-[4px] bg-[#3b82f6]/70" />
        <span className="h-2.5 w-16 rounded bg-white/70" />
      </span>
      <span className="flex gap-1">
        {[18, 14, 16, 20].map((w, i) => (
          <span key={i} className="h-3.5 rounded-[3px] border border-white/15 bg-white/[0.06]" style={{ width: `${w}%` }} />
        ))}
      </span>
      <span className="relative flex gap-1.5 h-[44%]">
        <span className="w-[6%] rounded-[5px] bg-white/[0.07]" />
        <span className="flex-1 rounded-[6px] bg-[linear-gradient(160deg,#3b82f6_0%,#1e293b_55%,#0b0d12_100%)] flex items-end p-1.5">
          <span className="h-1.5 w-1/2 rounded bg-white/70" />
        </span>
        <span className="w-[6%] rounded-[5px] bg-white/[0.07]" />
      </span>
      <span className="h-2 w-14 rounded bg-white/50" />
      <span className="grid grid-cols-3 gap-1 flex-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="rounded-[4px] bg-white/[0.08]" />
        ))}
      </span>
      <span className="h-5 -mx-2.5 -mb-2.5 border-t border-white/10 bg-[#15161a] flex items-center justify-around px-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`w-2 h-2 rounded-[2px] ${i === 0 ? "bg-white" : "bg-white/25"}`} />
        ))}
      </span>
    </span>
  );
}

/**
 * Bot → Temas do Mini App. Padrão (o visual atual) e Tema XDs (em teste, só nos bots da conta proprietária).
 * Tema V2 aparece como "Em breve".
 */
export default function BotThemesTab({ botId, botUsername, currentTheme, ready }: { botId: string; botUsername: string; currentTheme: ThemeId; ready: boolean }) {
  const router = useRouter();
  const [theme, setTheme] = useState<ThemeId>(currentTheme);
  const [saving, setSaving] = useState<ThemeId | "padrao" | "">("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [, start] = useTransition();

  const apply = (next: ThemeId) => {
    setSaving(next || "padrao");
    setMessage(null);
    start(async () => {
      const r = await saveBotThemeAction(botId, next);
      setSaving("");
      if (r.success) {
        setTheme(next);
        setMessage({ ok: true, text: r.message || "Tema aplicado." });
        router.refresh();
      } else {
        setMessage({ ok: false, text: r.error || "Não foi possível trocar o tema." });
      }
    });
  };

  const ApplyButton = ({ id }: { id: ThemeId }) => {
    const active = theme === id;
    const busy = saving === (id || "padrao");
    if (active) {
      return <span className="h-8 px-3 inline-flex items-center rounded-[8px] text-[12px] font-semibold text-[#3b82f6]">Em uso</span>;
    }
    return (
      <button
        type="button"
        disabled={!ready || saving !== ""}
        onClick={() => apply(id)}
        className="h-8 px-3 inline-flex items-center gap-1.5 rounded-[8px] bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-60 text-white text-[12px] font-semibold"
      >
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Usar este tema
      </button>
    );
  };

  return (
    <section className={`${SURFACE} p-5`}>
      <div className="flex flex-wrap items-start gap-3 mb-5">
        <div className="mr-auto max-w-[640px]">
          <h3 className="text-[15px] font-semibold flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#3b82f6]" /> Temas do Mini App
          </h3>
          <p className="text-[12.5px] text-zinc-500 mt-0.5">O tema define o visual da tela inicial do Mini App deste bot. As seções do Tema XDs (Destaque, cards grandes e Coleção) são montadas em Carrosséis.</p>
        </div>
        {botUsername && (
          <a
            href={`https://t.me/${botUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[9px] border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.07] text-[13px] font-medium text-zinc-200"
          >
            <Send className="w-4 h-4" /> Abrir o bot
          </a>
        )}
      </div>

      {!ready && (
        <p className="mb-4 text-[12.5px] text-amber-400/90">Falta rodar a migration da Personalização no Neon para trocar de tema.</p>
      )}
      {message && <p className={`mb-4 text-[12.5px] ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-[860px]">
        {/* Padrão */}
        <article className={`rounded-[12px] border overflow-hidden ${theme === null ? "border-[#3b82f6]/60 bg-[#3b82f6]/[0.06]" : "border-white/[0.07] bg-black/20"}`}>
          <div className="relative aspect-[9/14] bg-[#0b0d12] border-b border-white/[0.06]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/miniapp-themes/padrao.webp" alt="Prévia do tema Padrão do Mini App" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover object-top" />
            {theme === null && <InUse />}
          </div>
          <div className="p-3.5 flex flex-wrap items-center gap-2">
            <div className="mr-auto min-w-0">
              <p className="text-[14px] font-semibold">Padrão</p>
              <p className="text-[12px] text-zinc-500 mt-0.5">Banner no topo, Top 15 da semana e fileiras de títulos.</p>
            </div>
            <ApplyButton id={null} />
          </div>
        </article>

        {/* Tema XDs */}
        <article className={`rounded-[12px] border overflow-hidden ${theme === "xds" ? "border-[#3b82f6]/60 bg-[#3b82f6]/[0.06]" : "border-white/[0.07] bg-black/20"}`}>
          <div className="relative aspect-[9/14] bg-[#0b0d12] border-b border-white/[0.06] overflow-hidden">
            <XdsMock />
            {theme === "xds" && <InUse />}
          </div>
          <div className="p-3.5 flex flex-wrap items-center gap-2">
            <div className="mr-auto min-w-0">
              <p className="text-[14px] font-semibold">Tema XDs</p>
              <p className="text-[12px] text-zinc-500 mt-0.5">Destaques grandes passando sozinhos, categorias no topo, coleções e Top 15 com emblema.</p>
            </div>
            <ApplyButton id="xds" />
          </div>
        </article>

        {/* Tema V2 */}
        <article className="rounded-[12px] border border-white/[0.07] bg-black/20 overflow-hidden">
          <div className="relative aspect-[9/14] bg-[#0b0d12] border-b border-white/[0.06] flex items-center justify-center overflow-hidden">
            <span aria-hidden="true" className="absolute inset-0 p-3 flex flex-col gap-2 opacity-40">
              <span className="h-6 rounded-[6px] bg-white/[0.08]" />
              <span className="h-[22%] rounded-[8px] bg-[linear-gradient(135deg,rgba(59,130,246,0.18),rgba(255,255,255,0.03))]" />
              <span className="h-2.5 w-20 rounded bg-white/[0.08] mt-1" />
              <span className="grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="aspect-[2/3] rounded-[4px] bg-white/[0.06]" />
                ))}
              </span>
              <span className="mt-auto h-7 rounded-[8px] bg-white/[0.07]" />
            </span>
            <span className="relative inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-white/[0.12] bg-black/70 backdrop-blur-sm text-[12px] font-semibold text-zinc-200">
              <Clock className="w-3.5 h-3.5 text-[#3b82f6]" /> Em breve
            </span>
          </div>
          <div className="p-3.5 flex flex-wrap items-center gap-2">
            <div className="mr-auto min-w-0">
              <p className="text-[14px] font-semibold text-zinc-300">Tema V2</p>
              <p className="text-[12px] text-zinc-500 mt-0.5">Novo visual para o seu Mini App.</p>
            </div>
            <button type="button" disabled className="h-8 px-3 rounded-[8px] border border-white/[0.08] text-[12px] text-zinc-500 cursor-not-allowed">
              Em breve
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
