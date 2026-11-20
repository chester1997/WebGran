"use client";

import type { ButtonColor } from "@/lib/flows/basic-config";

export type PreviewButton = { t: string; c?: ButtonColor };
export type PreviewItem =
  | { kind: "me"; text: string }
  | { kind: "sys"; text: string; wait?: boolean }
  | { kind: "proof"; text: string }
  | { kind: "bot"; html?: string; media?: { url?: string; label: string; qr?: boolean }[]; voice?: boolean; kb?: PreviewButton[][] };

/** Valores de exemplo usados só na prévia. */
export const PREVIEW_VARS: Record<string, string> = {
  "{nome}": "Lucas",
  "{saudacao}": "Boa noite",
  "{localizacao}": "São Paulo",
  "{random}": "7",
  "{link_vip}": "t.me/+Kx9vPq2m",
};

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Converte o texto do vendedor no HTML da prévia: troca variáveis, escapa tudo
 * e só então reabre as poucas tags de formatação aceitas pelo Telegram.
 */
export function previewHtml(text: string, extra: Record<string, string> = {}): string {
  let t = String(text || "");
  const vars = { ...PREVIEW_VARS, ...extra };
  for (const k of Object.keys(vars)) t = t.split(k).join(vars[k]);
  return escapeHtml(t)
    .replace(/&lt;(\/?)(b|i|u|s|code)&gt;/g, "<$1$2>")
    .replace(/\n/g, "<br>");
}

const BTN: Record<ButtonColor, string> = {
  none: "bg-white/[0.09] text-[#e5ecf3]",
  blue: "bg-[#3a7bd5] text-white",
  green: "bg-[#2e9e5b] text-white",
  red: "bg-[#d14b4b] text-white",
};

export default function TelegramPreview({ title, items }: { title: string; items: PreviewItem[] }) {
  return (
    <div className="rounded-[26px] border border-white/[0.13] bg-[#0e1621] overflow-hidden shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)]">
      <div className="flex items-center gap-2.5 px-3.5 py-3 bg-[#17212b] border-b border-black/30">
        <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#3984FF] to-[#1d4ed8] flex items-center justify-center font-bold text-[14px] text-white">
          {(title.trim()[0] || "B").toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-white truncate">{title}</p>
          <p className="text-[12px] text-[#7f91a4]">bot</p>
        </div>
      </div>
      <div
        className="px-2.5 pt-3.5 pb-4 flex flex-col gap-2 min-h-[420px] max-h-[640px] overflow-y-auto"
        style={{ backgroundImage: "radial-gradient(120% 80% at 0% 0%, rgba(57,132,255,.10), transparent 60%), radial-gradient(100% 80% at 100% 100%, rgba(99,102,241,.10), transparent 60%)" }}
      >
        {items.map((m, i) => {
          if (m.kind === "sys")
            return (
              <div key={i} className={`self-center text-center text-[11.5px] px-2.5 py-0.5 rounded-full ${m.wait ? "bg-[#3984FF]/[0.18] text-blue-200" : "bg-black/35 text-slate-300"}`}>
                {m.text}
              </div>
            );
          if (m.kind === "proof")
            return (
              <div key={i} className="self-start text-[12px] text-amber-200 bg-amber-400/[0.12] border border-amber-400/25 px-2.5 py-1.5 rounded-[10px]" dangerouslySetInnerHTML={{ __html: previewHtml(m.text) }} />
            );
          if (m.kind === "me")
            return (
              <div key={i} className="self-end max-w-[88%] bg-[#2b5278] rounded-[14px] rounded-br-[4px] px-3 py-2 text-[13.5px] text-white">
                {m.text}
                <span className="block text-right text-[10.5px] text-[#9fb3c8] mt-0.5">21:07 ✓✓</span>
              </div>
            );
          return (
            <div key={i} className="self-start max-w-[88%] flex flex-col gap-1">
              {m.voice && (
                <div className="flex items-center gap-2 bg-[#182533] rounded-[14px] px-3 py-2 text-[12px] text-[#9fb3c8]">
                  <span className="w-[30px] h-[30px] rounded-full bg-[#3a7bd5] text-white flex items-center justify-center text-[11px]">▶</span>
                  <span className="flex-1 min-w-[90px] h-4 rounded-sm opacity-80" style={{ background: "repeating-linear-gradient(90deg,#5b7a99 0 2px,transparent 2px 5px)" }} />
                  0:14
                </div>
              )}
              {m.media && m.media.length > 0 && (
                <div className={`grid gap-0.5 rounded-[14px] rounded-b-[4px] overflow-hidden ${m.media.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                  {m.media.map((x, j) =>
                    x.qr ? (
                      <div key={j} className="aspect-square bg-white flex items-center justify-center text-[11px] font-bold text-black">QR Code</div>
                    ) : x.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={j} src={x.url} alt="" loading="lazy" className={`w-full object-cover ${m.media!.length === 1 ? "aspect-[16/10]" : "aspect-square"}`} />
                    ) : (
                      <div key={j} className={`bg-gradient-to-br from-slate-700 to-slate-900 flex items-end p-1.5 text-[10.5px] text-slate-300 ${m.media!.length === 1 ? "aspect-[16/10]" : "aspect-square"}`}>{x.label}</div>
                    )
                  )}
                </div>
              )}
              {m.html && (
                <div className="bg-[#182533] rounded-[14px] rounded-bl-[4px] px-3 py-2 text-[13.5px] leading-[1.45] text-[#e5ecf3] [overflow-wrap:anywhere] [&_code]:font-mono [&_code]:text-[12px] [&_code]:bg-white/[0.08] [&_code]:px-1 [&_code]:rounded">
                  <span dangerouslySetInnerHTML={{ __html: m.html }} />
                  <span className="block text-right text-[10.5px] text-[#7f91a4] mt-0.5">21:07</span>
                </div>
              )}
              {m.kb && m.kb.length > 0 && (
                <div className="flex flex-col gap-[3px]">
                  {m.kb.map((row, r) => (
                    <div key={r} className="flex gap-[3px]">
                      {row.map((b, k) => (
                        <span key={k} className={`flex-1 text-center text-[12.5px] font-medium px-1.5 py-2 rounded-[9px] ${BTN[b.c || "none"]}`}>{b.t}</span>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
