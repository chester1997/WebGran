"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CheckCircle2, LifeBuoy, ShoppingBag, Store, UserRound } from "lucide-react";
import { CartProvider, useCart } from "./cart";
import { SupportModal } from "./SupportModal";

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
}

export function StoreShell({ store, customer, children }: { store: ShellStore; customer: ShellCustomer | null; children: ReactNode }) {
  return (
    <CartProvider slug={store.slug}>
      <Inner store={store} customer={customer}>
        {children}
      </Inner>
    </CartProvider>
  );
}

function Inner({ store, customer, children }: { store: ShellStore; customer: ShellCustomer | null; children: ReactNode }) {
  const { count, ready, toast } = useCart();
  const pathname = usePathname();
  const [support, setSupport] = useState(false);
  const base = `/loja/${store.slug}`;
  const hideFab = pathname?.startsWith(`${base}/entrar`) || pathname?.startsWith(`${base}/cadastro`);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#09090b] text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#09090b]/85 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl h-16 px-4 sm:px-6 flex items-center gap-3">
          <Link href={base} className="flex items-center gap-2.5 min-w-0 mr-auto">
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt="" className="w-9 h-9 rounded-[10px] object-cover ring-1 ring-white/10" />
            ) : (
              <span className="w-9 h-9 rounded-[10px] bg-[#3b82f6]/15 text-[#7fb0ff] flex items-center justify-center">
                <Store className="w-[18px] h-[18px]" />
              </span>
            )}
            <span className="font-semibold text-[15px] tracking-tight truncate">{store.name}</span>
          </Link>

          <Link
            href={customer ? `${base}/conta` : `${base}/entrar`}
            className="inline-flex items-center gap-2 h-10 px-3 rounded-[11px] text-[13.5px] font-medium text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <UserRound className="w-[18px] h-[18px]" />
            <span className="hidden sm:inline max-w-[140px] truncate">{customer ? customer.name.split(" ")[0] : "Entrar"}</span>
          </Link>
          <Link
            href={`${base}/carrinho`}
            aria-label={`Carrinho, ${count} itens`}
            className="relative inline-flex items-center gap-2 h-10 px-3.5 rounded-[11px] bg-[#3b82f6] hover:bg-[#2f74ea] text-white text-[13.5px] font-semibold transition-colors shadow-[0_6px_18px_-8px_rgba(59,130,246,0.8)]"
          >
            <ShoppingBag className="w-[18px] h-[18px]" />
            <span className="hidden sm:inline">Carrinho</span>
            {ready && count > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-white text-[#1d4ed8] text-[11.5px] font-bold flex items-center justify-center tabular-nums">{count}</span>
            )}
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/[0.06] mt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12.5px] text-zinc-500">
          <span>© {new Date().getFullYear()} {store.name}. Pagamento seguro via PIX.</span>
          <button type="button" onClick={() => setSupport(true)} className="text-zinc-400 hover:text-white transition-colors">
            Precisa de ajuda? Fale com o suporte
          </button>
        </div>
      </footer>

      {!hideFab && (
        <button
          type="button"
          onClick={() => setSupport(true)}
          className="fixed z-30 right-4 bottom-4 sm:right-6 sm:bottom-6 inline-flex items-center gap-2 h-12 pl-4 pr-5 rounded-full bg-[#18181b] border border-white/10 text-[13.5px] font-semibold text-zinc-100 shadow-[0_14px_34px_-12px_rgba(0,0,0,0.9)] hover:border-[#3b82f6]/60 hover:text-white transition-colors"
        >
          <LifeBuoy className="w-[18px] h-[18px] text-[#7fb0ff]" />
          Suporte
        </button>
      )}

      {toast && (
        <div role="status" className="fixed z-50 left-1/2 -translate-x-1/2 bottom-20 sm:bottom-8 inline-flex items-center gap-2 h-11 px-4 rounded-[12px] bg-[#18181b] border border-white/10 text-[13.5px] font-medium shadow-2xl">
          <CheckCircle2 className="w-4 h-4 text-[#3b82f6]" />
          {toast}
        </div>
      )}

      {support && <SupportModal store={store} customer={customer} onClose={() => setSupport(false)} />}
    </div>
  );
}
