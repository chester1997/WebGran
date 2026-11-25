"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Bot, CheckCircle2, Crown, QrCode, Send, Users, Wallet, Zap, type LucideIcon } from "lucide-react";

/** Satélites das órbitas: ângulo inicial em graus. */
const INNER: { I: LucideIcon; a: number }[] = [
  { I: Send, a: 20 },
  { I: QrCode, a: 200 },
];
const OUTER: { I: LucideIcon; a: number }[] = [
  { I: Bot, a: 0 },
  { I: Users, a: 90 },
  { I: Wallet, a: 180 },
  { I: Crown, a: 270 },
];

/** Notificações ilustrativas que vão chegando (só decoração da tela de login). */
const FEED = [
  { t: "Venda aprovada", s: "Plano Mensal · via PIX", v: "R$ 29,90" },
  { t: "Acesso liberado", s: "Cliente entrou no grupo VIP", v: "agora" },
  { t: "Venda aprovada", s: "Combo 3 títulos · via PIX", v: "R$ 49,90" },
  { t: "Renovação automática", s: "Assinatura renovada", v: "R$ 19,90" },
  { t: "Venda aprovada", s: "Plano Vitalício · via PIX", v: "R$ 97,00" },
];

function Orbit({ size, duration, items, dashed }: { size: number; duration: number; items: { I: LucideIcon; a: number }[]; dashed?: boolean }) {
  const r = size / 2;
  return (
    <div
      className={`absolute left-1/2 top-1/2 rounded-full border ${dashed ? "border-dashed border-[#3b82f6]/25" : "border-white/[0.07]"}`}
      style={{ width: size, height: size, marginLeft: -r, marginTop: -r }}
    >
      <div className="absolute inset-0 animate-[wg-orbit_linear_infinite]" style={{ animationDuration: `${duration}s` }}>
        {items.map(({ I, a }) => (
          <span key={a} className="absolute left-1/2 top-1/2" style={{ transform: `rotate(${a}deg) translateX(${r}px) rotate(${-a}deg)` }}>
            <span
              className="-ml-[22px] -mt-[22px] w-11 h-11 rounded-[13px] flex items-center justify-center bg-[linear-gradient(160deg,#1b2433,#0e121a)] border border-[#3b82f6]/30 text-[#7fb0ff] shadow-[0_10px_30px_-10px_rgba(59,130,246,0.7)] animate-[wg-orbit-rev_linear_infinite]"
              style={{ animationDuration: `${duration}s`, display: "flex" }}
            >
              <I className="w-5 h-5" />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Lado esquerdo do login/cadastro da plataforma: órbita animada + feed de vendas chegando. */
export function AuthShowcase() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 2800);
    return () => window.clearInterval(id);
  }, []);
  const feed = [0, 1, 2].map((k) => ({ ...FEED[(tick + k) % FEED.length], key: tick + k }));

  return (
    <section className="hidden lg:flex flex-col justify-center min-w-0">
      <span className="self-start inline-flex items-center gap-2 h-8 px-3 rounded-full bg-[#3b82f6]/10 border border-[#3b82f6]/25 text-[12.5px] font-semibold text-[#9cc2ff]">
        <Zap className="w-3.5 h-3.5" /> SaaS de vendas no Telegram
      </span>
      <h2 className="mt-5 text-[42px] xl:text-[50px] leading-[1.04] font-extrabold tracking-tight">
        Venda no Telegram
        <br />
        no <span className="text-[#3b82f6]">piloto automático</span>.
      </h2>
      <p className="mt-4 max-w-[460px] text-[15px] text-zinc-400 leading-relaxed">PIX aprovado, acesso liberado e assinatura renovada sozinhos. Você só acompanha as vendas chegando.</p>

      {/* Sistema orbital + feed */}
      <div className="relative mt-6 h-[360px] [@media(max-height:860px)]:h-[300px] [@media(max-height:860px)]:mt-4">
        <div className="absolute left-[160px] top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] [@media(max-height:860px)]:scale-[0.8]">
          <div className="absolute inset-[22%] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.35),transparent)] animate-[wg-glow_5s_ease-in-out_infinite]" />
          <Orbit size={210} duration={26} items={INNER} dashed />
          <Orbit size={360} duration={48} items={OUTER} />
          <div className="absolute left-1/2 top-1/2 -ml-[38px] -mt-[38px] w-[76px] h-[76px] rounded-[22px] bg-[linear-gradient(160deg,#1d2a40,#0c111b)] border border-[#3b82f6]/40 flex items-center justify-center shadow-[0_0_0_8px_rgba(59,130,246,0.06),0_20px_50px_-12px_rgba(59,130,246,0.8)]">
            <Image src="/logo-webgran-icon.png" alt="" width={44} height={44} className="w-11 h-11 object-contain" />
          </div>
        </div>

        <ul className="absolute z-10 right-0 xl:right-4 top-1/2 -translate-y-1/2 w-[260px] space-y-2.5" aria-hidden>
          {feed.map((n, i) => (
            <li
              key={n.key}
              className={`flex items-center gap-3 rounded-[14px] border border-white/[0.08] bg-[#0d1017] px-3.5 py-3 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)] animate-[wg-rise_.5s_ease-out] transition-opacity duration-500 ${
                i === 0 ? "opacity-100" : i === 1 ? "opacity-[0.88]" : "opacity-[0.72]"
              }`}
            >
              <span className="w-9 h-9 rounded-full bg-[#3b82f6]/15 text-[#3b82f6] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-[18px] h-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold truncate">{n.t}</span>
                <span className="block text-[11.5px] text-zinc-500 truncate">{n.s}</span>
              </span>
              <span className="text-[12px] font-semibold tabular-nums text-zinc-200 shrink-0">{n.v}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
