import React, { ReactNode } from "react";
import Link from "next/link";
import { Home, Search, ShoppingCart, Key, User } from "lucide-react";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export async function StudioLayout({ storeSlug, children }: { storeSlug: string, children: ReactNode }) {
  const store = await db.query.stores.findFirst({
    where: eq(stores.slug, storeSlug)
  });

  if (!store) {
    notFound();
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-zinc-950 text-white font-sans overflow-hidden">
      <main className="flex-1 overflow-y-auto pb-20 scrollbar-hide">
        {children}
      </main>
      
      {/* Cinematic Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 flex items-center justify-around z-50 pb-safe">
        <Link href={`/miniapp/${storeSlug}`} className="flex flex-col items-center justify-center w-full h-full text-[10px] text-zinc-400 hover:text-white transition-colors">
          <Home className="w-5 h-5 mb-1" />
          Início
        </Link>
        <Link href={`/miniapp/${storeSlug}/search`} className="flex flex-col items-center justify-center w-full h-full text-[10px] text-zinc-400 hover:text-white transition-colors">
          <Search className="w-5 h-5 mb-1" />
          Buscar
        </Link>
        <Link href={`/miniapp/${storeSlug}/cart`} className="flex flex-col items-center justify-center w-full h-full text-[10px] text-zinc-400 hover:text-white transition-colors">
          <ShoppingCart className="w-5 h-5 mb-1" />
          Carrinho
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
