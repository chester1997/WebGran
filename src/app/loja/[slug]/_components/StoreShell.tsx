"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  SolarCartLarge2BoldDuotone,
  SolarChatRoundDotsBoldDuotone,
  SolarClapperboardPlayBoldDuotone,
  SolarHomeBoldDuotone,
  SolarMagniferBoldDuotone,
  SolarSidebarBoldDuotone,
} from "@/components/icons/solar/seller-icons";
import { CartProvider, VipProvider, useCart } from "./cart";
import { SupportModal } from "./SupportModal";
import { StoreInstallApp } from "./StoreInstallApp";
import { AuthScene } from "./AuthScene";

import { thumb } from "@/lib/webstore/img";
export interface ShellStore {
  slug: string;
  name: string;
  logoUrl: string | null;
  supportType: string | null;
  supportValue: string | null;
}

export interface ShellCustomer {
  name: string;
  email: string;
  whatsapp: string | null;
  telegram: string | null;
  avatarUrl?: string | null;
}

const TAB = "min-w-0 px-1 flex flex-col items-center justify-center gap-1.5 text-[10.5px] font-medium transition-colors";

export function StoreShell({ store, customer, vip = false, children }: { store: ShellStore; customer: ShellCustomer | null; vip?: boolean; children: ReactNode }) {
  return (
    <CartProvider slug={store.slug}>
      <VipProvider vip={vip}>
        <Inner store={store} customer={customer}>
          {children}
        </Inner>
      </VipProvider>
    </CartProvider>
  );
}

function Inner({ store, customer, children }: { store: ShellStore; customer: ShellCustomer | null; children: ReactNode }) {
  const { count, ready, toast } = useCart();
  const pathname = usePathname() || "";
  const [support, setSupport] = useState(false);
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);
  const base = `/loja/${store.slug}`;
  const isHome = pathname === base;
  const isAuth = ["entrar", "cadastro", "recuperar", "nova-senha"].some((p) => pathname.startsWith(`${base}/${p}`));

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferência salva do menu
      if (localStorage.getItem("wg_loja_rail") === "open") setOpen(true);
    } catch {
      // armazenamento indisponível
    }
  }, []);

  // pulinho no ícone do carrinho quando entra produto novo
  const [lastCount, setLastCount] = useState(count);
  if (count !== lastCount) {
    setLastCount(count);
    if (ready && count > lastCount) setBump((b) => b + 1);
  }

  const toggleRail = () =>
    setOpen((o) => {
      try {
        localStorage.setItem("wg_loja_rail", o ? "closed" : "open");
      } catch {
        // ignora
      }
      return !o;
    });

  const initial = store.name.trim().charAt(0).toUpperCase();
  const logo = (size: string, text: string) =>
    store.logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={thumb(store.logoUrl, 160)} alt="" decoding="async" className={`${size} rounded-[11px] object-cover ring-1 ring-white/10 shrink-0`} />
    ) : (
      <span className={`${size} ${text} rounded-[11px] bg-[#3b82f6] text-white font-black flex items-center justify-center shrink-0 shadow-[0_8px_24px_-6px_rgba(59,130,246,0.7)]`}>{initial}</span>
    );

  const nav = [
    { href: base, label: "Início", icon: SolarHomeBoldDuotone, on: isHome },
    { href: `${base}/buscar`, label: "Buscar", icon: SolarMagniferBoldDuotone, on: pathname.startsWith(`${base}/buscar`) },
    { href: customer ? `${base}/conta` : `${base}/entrar`, label: "Meus vídeos", icon: SolarClapperboardPlayBoldDuotone, on: pathname.startsWith(`${base}/conta`) },
    { href: `${base}/carrinho`, label: "Carrinho", icon: SolarCartLarge2BoldDuotone, on: pathname.startsWith(`${base}/carrinho`), badge: ready && count > 0 ? count : 0 },
  ];

  // Entrar/cadastro: tela cheia, sem o menu e o topo da loja
  if (isAuth && !customer) {
    return (
      <AuthScene store={store}>
        <div key={pathname} className="animate-[wg-fade_.25s_ease-out]">
          {children}
        </div>
      </AuthScene>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-clip bg-[#07080a] text-zinc-100" style={{ ["--rail" as string]: open ? "232px" : "76px" }}>
      {/* Menu lateral (computador): recolhe e expande */}
      <nav
        aria-label="Navegação da loja"
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 w-[var(--rail)] flex-col gap-1 px-3.5 pt-4 pb-5 transition-[width,background-color] duration-300 ease-out bg-[#121317] shadow-[1px_0_0_rgba(255,255,255,0.04),8px_0_24px_-12px_rgba(0,0,0,0.8)]`}
      >
        <div className={`flex items-center h-12 mb-5 ${open ? "px-1" : "justify-center"}`}>
          <Link href={base} aria-label={store.name} className="flex items-center gap-3 min-w-0">
            {logo("w-10 h-10", "text-[16px]")}
            {open && <span className="font-extrabold tracking-tight text-[15.5px] truncate">{store.name}</span>}
          </Link>
        </div>
        {nav.map((n) => (
          <Link
            key={n.label}
            href={n.href}
            title={open ? undefined : n.label}
            aria-label={n.label}
            aria-current={n.on ? "page" : undefined}
            className={`group relative h-12 rounded-[13px] flex items-center transition-colors ${open ? "gap-3.5 px-3.5" : "justify-center"} ${
              n.on ? "text-white bg-white/[0.07]" : "text-zinc-500 hover:text-white hover:bg-white/[0.05]"
            }`}
          >
            <span key={n.badge !== undefined ? bump : undefined} className={`relative ${n.badge !== undefined && bump ? "animate-[wg-bump_.6s_ease-out]" : ""}`}>
              <n.icon size={23} className={n.on ? "text-[#3b82f6]" : ""} />
              {n.badge ? <span className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] px-1 rounded-full bg-[#3b82f6] text-white text-[10px] font-bold flex items-center justify-center tabular-nums ring-2 ring-[#07080a]">{n.badge}</span> : null}
            </span>
            {open ? (
              <span className="text-[14px] font-medium truncate">{n.label}</span>
            ) : (
              <span className="pointer-events-none absolute left-[58px] whitespace-nowrap rounded-[8px] bg-[#18191d] border border-white/10 px-2.5 py-1 text-[12px] text-white opacity-0 group-hover:opacity-100 transition-opacity">{n.label}</span>
            )}
            {n.on && !open && <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-[#3b82f6]" />}
          </Link>
        ))}
        <div className="mt-auto space-y-1">
          <button type="button" onClick={() => setSupport(true)} title={open ? undefined : "Suporte"} aria-label="Suporte" className={`group relative w-full h-12 rounded-[13px] flex items-center text-zinc-500 hover:text-white hover:bg-white/[0.05] transition-colors ${open ? "gap-3.5 px-3.5" : "justify-center"}`}>
            <SolarChatRoundDotsBoldDuotone size={23} />
            {open ? <span className="text-[14px] font-medium">Suporte</span> : <span className="pointer-events-none absolute left-[58px] whitespace-nowrap rounded-[8px] bg-[#18191d] border border-white/10 px-2.5 py-1 text-[12px] text-white opacity-0 group-hover:opacity-100 transition-opacity">Suporte</span>}
          </button>
          <button type="button" onClick={toggleRail} aria-expanded={open} aria-label={open ? "Recolher menu" : "Expandir menu"} title={open ? undefined : "Expandir menu"} className={`w-full h-11 rounded-[13px] flex items-center text-zinc-500 hover:text-white hover:bg-white/[0.05] transition-colors ${open ? "gap-3.5 px-3.5" : "justify-center"}`}>
            <SolarSidebarBoldDuotone size={21} className={open ? "" : "-scale-x-100"} />
            {open && <span className="text-[13px] font-medium">Recolher menu</span>}
          </button>
        </div>
      </nav>

      {/* Topo */}
      <header className={`fixed top-0 right-0 left-0 lg:left-[var(--rail)] z-30 h-16 flex items-center gap-3 px-4 sm:px-8 transition-[left,background-color,box-shadow] duration-300 ${solid || !isHome ? "bg-[#07080a] shadow-[0_14px_28px_-14px_rgba(0,0,0,0.95)]" : "bg-transparent"}`}>
        <Link href={base} className="flex items-center gap-2.5 min-w-0 mr-auto">
          <span className="lg:hidden">{logo("w-8 h-8", "text-[14px]")}</span>
          <span className={`font-extrabold tracking-tight text-[17px] truncate ${open ? "lg:invisible" : ""}`}>{store.name}</span>
        </Link>
        {customer ? (
          <Link href={`${base}/conta`} className="inline-flex items-center gap-2.5 h-11 pl-1 pr-3.5 rounded-[8px] bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 text-[14px] font-semibold transition-colors">
            {customer.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb(customer.avatarUrl, 160)} alt="" decoding="async" className="w-9 h-9 rounded-[6px] object-cover" />
            ) : (
              <span className="w-9 h-9 rounded-[6px] bg-[#3b82f6] text-white text-[14px] font-bold flex items-center justify-center">{customer.name.trim().charAt(0).toUpperCase()}</span>
            )}
            <span className="hidden sm:inline max-w-[140px] truncate">{customer.name.split(" ")[0]}</span>
          </Link>
        ) : (
          !isAuth && (
            <>
              <Link href={`${base}/entrar`} className="hidden sm:inline-flex items-center h-9 px-4 rounded-[10px] bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-[13px] font-semibold transition-colors">
                Entrar
              </Link>
              <Link href={`${base}/cadastro`} className="inline-flex items-center h-9 px-4 rounded-[10px] bg-[#3b82f6] hover:bg-[#2f74ea] text-[13px] font-semibold transition-colors">
                Criar conta
              </Link>
            </>
          )
        )}
      </header>

      <main className={`lg:pl-[var(--rail)] transition-[padding] duration-300 pb-[calc(84px+env(safe-area-inset-bottom))] lg:pb-0 ${isHome || pathname.startsWith(`${base}/produto/`) || pathname.startsWith(`${base}/buscar`) ? "" : "pt-16"}`}>
        {/* key = endereço: cada página entra com um fade curto, em vez de "piscar" */}
        <div key={pathname} className="animate-[wg-fade_.25s_ease-out]">
          {children}
        </div>
      </main>

      <footer className="lg:pl-[var(--rail)] transition-[padding] duration-300 border-t border-white/[0.06] mb-[calc(60px+env(safe-area-inset-bottom))] lg:mb-0">
        <div className="px-4 sm:px-8 lg:px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12.5px] text-zinc-500">
          <span>© {new Date().getFullYear()} {store.name} · Pagamento seguro via PIX · Assista no celular ou no computador</span>
          <button type="button" onClick={() => setSupport(true)} className="text-zinc-400 hover:text-white transition-colors">
            Precisa de ajuda? Fale com o suporte
          </button>
        </div>
      </footer>

      {/* Barra inferior (celular) */}
      <nav aria-label="Navegação da loja" className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#07080a]/95 backdrop-blur-xl border-t border-white/[0.07] pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 h-[60px]">
          {nav.map((n) => (
            <Link key={n.label} href={n.href} aria-current={n.on ? "page" : undefined} className={`${TAB} ${n.on ? "text-white" : "text-zinc-500"}`}>
              <span className="relative w-6 h-6 flex items-center justify-center">
                <n.icon size={22} className={n.on ? "text-[#3b82f6]" : ""} />
                {n.badge ? <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#3b82f6] text-[9.5px] font-bold text-white flex items-center justify-center ring-2 ring-[#07080a]">{n.badge}</span> : null}
              </span>
              <span className="leading-none truncate max-w-full">{n.label}</span>
            </Link>
          ))}
          <button type="button" onClick={() => setSupport(true)} className={`${TAB} text-zinc-500`}>
            <span className="w-6 h-6 flex items-center justify-center">
              <SolarChatRoundDotsBoldDuotone size={22} />
            </span>
            <span className="leading-none">Suporte</span>
          </button>
        </div>
      </nav>

      {toast && (
        <div role="status" className="fixed z-50 left-1/2 -translate-x-1/2 bottom-20 lg:bottom-8 inline-flex items-center gap-2 h-11 px-4 rounded-[12px] bg-[#18181b] border border-white/10 text-[13.5px] font-medium shadow-2xl">
          <CheckCircle2 className="w-4 h-4 text-[#3b82f6]" />
          {toast}
        </div>
      )}

      {support && <SupportModal store={store} customer={customer} onClose={() => setSupport(false)} />}
      <StoreInstallApp slug={store.slug} name={store.name} />
    </div>
  );
}

/** Espaço do topo fixo para páginas internas. */
export function PageTop({ children }: { children: ReactNode }) {
  return <div className="pt-20 sm:pt-24 px-4 sm:px-8 lg:px-10">{children}</div>;
}

