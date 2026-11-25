"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  BadgeDollarSign,
  Banknote,
  ChartLine,
  CheckCircle2,
  Coins,
  CreditCard,
  Gem,
  HandCoins,
  MonitorSmartphone,
  PiggyBank,
  QrCode,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { thumb } from "@/lib/webstore/img";

/** Ícones de "dinheiro" flutuando no fundo (posição em %, tamanho em px, giro e atraso da animação). */
const FLOAT: { I: LucideIcon; top: string; left: string; size: number; r: number; d: number; tile?: boolean; mobile?: boolean }[] = [
  { I: Wallet, top: "11%", left: "5%", size: 26, r: -12, d: 0, tile: true, mobile: true },
  { I: Coins, top: "20%", left: "42%", size: 22, r: 10, d: 1.2 },
  { I: QrCode, top: "66%", left: "3%", size: 26, r: 8, d: 2.1, tile: true },
  { I: PiggyBank, top: "86%", left: "24%", size: 28, r: -6, d: 0.6, mobile: true },
  { I: CreditCard, top: "13%", left: "89%", size: 26, r: 14, d: 1.7, tile: true, mobile: true },
  { I: BadgeDollarSign, top: "46%", left: "94%", size: 24, r: -10, d: 2.8 },
  { I: TrendingUp, top: "82%", left: "87%", size: 26, r: 6, d: 0.3, tile: true, mobile: true },
  { I: Banknote, top: "40%", left: "1.5%", size: 26, r: -18, d: 3.2 },
  { I: HandCoins, top: "91%", left: "58%", size: 24, r: 12, d: 1.5 },
  { I: Gem, top: "6%", left: "64%", size: 20, r: -8, d: 2.4 },
  { I: ChartLine, top: "60%", left: "47%", size: 22, r: 4, d: 3.6 },
];

const PERKS = [
  { I: Zap, t: "Pagou no PIX, liberou na hora", s: "Sem esperar aprovação manual." },
  { I: MonitorSmartphone, t: "Assista onde quiser", s: "No celular ou no computador." },
  { I: ShieldCheck, t: "Tudo salvo na sua conta", s: "Seus conteúdos sempre à mão." },
];

/** Tela cheia das páginas de entrar/cadastro/senha: sem o menu da loja, com fundo próprio. */
export function AuthScene({ store, children }: { store: { slug: string; name: string; logoUrl: string | null }; children: ReactNode }) {
  const base = `/loja/${store.slug}`;
  const initial = store.name.trim().charAt(0).toUpperCase();

  return (
    <div className="relative min-h-[100dvh] w-full max-w-[100vw] overflow-hidden bg-[#05060a] text-zinc-100">
      {/* Fundo: brilhos azuis, grade sutil e ícones flutuando */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-[30%] left-1/2 -translate-x-1/2 w-[1100px] h-[800px] bg-[radial-gradient(closest-side,rgba(59,130,246,0.20),transparent)]" />
        <div className="absolute -bottom-[35%] -right-[10%] w-[800px] h-[700px] bg-[radial-gradient(closest-side,rgba(59,130,246,0.13),transparent)]" />
        <div className="absolute -bottom-[30%] -left-[15%] w-[700px] h-[600px] bg-[radial-gradient(closest-side,rgba(37,99,235,0.10),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]" />
        {FLOAT.map(({ I, top, left, size, r, d, tile, mobile }, i) => (
          <span
            key={i}
            className={`absolute ${mobile ? "flex" : "hidden md:flex"} items-center justify-center animate-[wg-float_9s_ease-in-out_infinite] ${
              tile
                ? "rounded-[16px] p-3 bg-[linear-gradient(160deg,rgba(59,130,246,0.16),rgba(59,130,246,0.03))] border border-[#3b82f6]/20 text-[#7fb0ff]/80 shadow-[0_18px_40px_-18px_rgba(59,130,246,0.6)]"
                : "text-[#3b82f6]/35"
            } ${mobile ? "opacity-60 md:opacity-100" : ""}`}
            style={{ top, left, animationDelay: `-${d}s`, ["--r" as string]: `${r}deg` }}
          >
            <I size={size} strokeWidth={1.8} />
          </span>
        ))}
      </div>

      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <header className="lg:absolute lg:inset-x-0 lg:top-0 lg:z-10 flex items-center justify-between gap-3 px-4 sm:px-8 h-16 lg:h-[68px] [@media(max-height:860px)]:lg:h-[52px]">
          <Link href={base} className="flex items-center gap-3 min-w-0">
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb(store.logoUrl, 160)} alt="" decoding="async" className="w-10 h-10 rounded-[12px] object-cover ring-1 ring-white/10 shrink-0" />
            ) : (
              <span className="w-10 h-10 rounded-[12px] bg-[#3b82f6] text-white text-[16px] font-black flex items-center justify-center shrink-0 shadow-[0_8px_24px_-6px_rgba(59,130,246,0.7)]">{initial}</span>
            )}
            <span className="font-extrabold tracking-tight text-[16px] truncate">{store.name}</span>
          </Link>
          <Link
            href={base}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[13px] font-medium text-zinc-300 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar à loja</span>
            <span className="sm:hidden">Loja</span>
          </Link>
        </header>

        <main className="flex-1 grid lg:grid-cols-[1fr_minmax(0,460px)] items-center gap-10 xl:gap-20 w-full max-w-[1160px] mx-auto px-4 sm:px-8 py-4 sm:py-8 lg:py-[60px] [@media(max-height:860px)]:lg:py-[50px]">
          {/* Lado da marca (computador) */}
          <section className="hidden lg:block">
            <span className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-[#3b82f6]/10 border border-[#3b82f6]/25 text-[12.5px] font-semibold text-[#9cc2ff]">
              <QrCode className="w-3.5 h-3.5" /> Pagamento via PIX
            </span>
            <h2 className="mt-5 text-[44px] xl:text-[52px] leading-[1.04] font-extrabold tracking-tight">
              Seus conteúdos,
              <br />a um <span className="text-[#3b82f6]">PIX</span> de distância.
            </h2>
            <p className="mt-4 max-w-[440px] text-[15.5px] text-zinc-400 leading-relaxed">Entre ou crie sua conta na {store.name} e tenha acesso imediato a tudo que comprar.</p>
            <ul className="mt-7 space-y-3.5">
              {PERKS.map(({ I, t, s }) => (
                <li key={t} className="flex items-center gap-3.5">
                  <span className="w-11 h-11 rounded-[12px] bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#3b82f6] shrink-0">
                    <I className="w-5 h-5" />
                  </span>
                  <span>
                    <span className="block text-[14.5px] font-semibold">{t}</span>
                    <span className="block text-[13px] text-zinc-500">{s}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div
              className="mt-8 inline-flex items-center gap-3.5 rounded-[16px] border border-white/[0.08] bg-[#0d0f15]/80 pl-3.5 pr-5 py-3.5 shadow-[0_24px_60px_-24px_rgba(59,130,246,0.55)] animate-[wg-float_7s_ease-in-out_infinite]"
              style={{ ["--r" as string]: "-2deg" }}
            >
              <span className="w-10 h-10 rounded-full bg-[#3b82f6]/15 flex items-center justify-center text-[#3b82f6]">
                <CheckCircle2 className="w-5 h-5" />
              </span>
              <span>
                <span className="block text-[13.5px] font-semibold">Pagamento aprovado</span>
                <span className="block text-[12px] text-zinc-500">Acesso liberado na sua conta</span>
              </span>
            </div>
          </section>

          <div className="w-full">{children}</div>
        </main>

        <footer className="lg:absolute lg:inset-x-0 lg:bottom-0 px-4 sm:px-8 py-5 lg:py-3 text-center text-[12px] text-zinc-600">
          © {new Date().getFullYear()} {store.name} · Pagamento seguro via PIX
        </footer>
      </div>
    </div>
  );
}
