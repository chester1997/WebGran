import React, { ReactNode } from "react";
import Link from "next/link";
import { Home, Search, ShoppingCart, Key, User } from "lucide-react";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CartBadge } from "./components/CartBadge";

export async function StudioLayout({ storeSlug, children }: { storeSlug: string, children: ReactNode }) {
  const store = await db.query.stores.findFirst({
    where: eq(stores.slug, storeSlug)
  });

  if (!store) {
    notFound();
  }

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 text-white font-sans overflow-hidden relative">
      {/* Scrollable Center Content Area (Only scrollable container) */}
      <main className="flex-1 min-h-0 overflow-y-auto scrollbar-hide pb-[calc(var(--bottom-nav-height)+1.5rem+env(safe-area-inset-bottom,0px))]">
        {children}
      </main>

      {/* Fixed Bottom Navigation Area */}
      <nav className="shrink-0 h-16 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 flex items-center justify-around z-50 pb-[env(safe-area-inset-bottom,0px)]">
        <Link href={`/miniapp/${storeSlug}`} className="flex flex-col items-center justify-center w-full h-full text-[10px] text-zinc-400 hover:text-white transition-colors">
          <Home className="w-5 h-5 mb-1" />
          Início
        </Link>
        <Link href={`/miniapp/${storeSlug}/search`} className="flex flex-col items-center justify-center w-full h-full text-[10px] text-zinc-400 hover:text-white transition-colors">
          <Search className="w-5 h-5 mb-1" />
          Buscar
        </Link>
        <Link href={`/miniapp/${storeSlug}/cart`} className="relative flex flex-col items-center justify-center w-full h-full text-[10px] text-zinc-400 hover:text-white transition-colors">
          <ShoppingCart className="w-5 h-5 mb-1" />
          Carrinho
          <CartBadge />
        </Link>
        <Link href={`/miniapp/${storeSlug}/accesses`} className="flex flex-col items-center justify-center w-full h-full text-[10px] text-zinc-400 hover:text-white transition-colors">
          <Key className="w-5 h-5 mb-1" />
          Acessos
        </Link>
        <Link href={`/miniapp/${storeSlug}/profile`} className="flex flex-col items-center justify-center w-full h-full text-[10px] text-zinc-400 hover:text-white transition-colors">
          <User className="w-5 h-5 mb-1" />
          Perfil
        </Link>
      </nav>
    </div>
  );
}
