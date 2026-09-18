import React from "react";
import { PlayCircle, Lock } from "lucide-react";
import { getMiniAppSession } from "@/lib/telegram/session";
import { AccessService } from "@/lib/orders/access-service";
import Link from "next/link";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export async function StudioAccesses({ storeSlug }: { storeSlug: string }) {
  const store = await db.query.stores.findFirst({
    where: eq(stores.slug, storeSlug)
  });

  if (!store) notFound();

  const session = await getMiniAppSession();
  
  if (!session) {
    return (
      <div className="p-4 pt-8 min-h-[80vh] flex flex-col items-center justify-center text-center text-white">
        <Lock className="w-16 h-16 text-zinc-800 mb-4" />
        <h1 className="text-xl font-bold mb-2">Acesso Negado</h1>
        <p className="text-zinc-500">Sessão expirada ou não encontrada.</p>
      </div>
    );
  }

  const accesses = await AccessService.getCustomerAccesses(store.id, session.customerId);

  return (
    <div className="p-4 pt-8 pb-24 min-h-screen text-white bg-zinc-950">
      <h1 className="text-2xl font-bold mb-6">Meus Acessos</h1>
      
      {accesses.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <PlayCircle className="w-16 h-16 text-zinc-800 mb-4" />
          <p className="text-zinc-500 max-w-[250px]">
            Seus conteúdos comprados aparecerão aqui para acesso rápido.
          </p>
          <Link href={`/miniapp/${storeSlug}`} className="mt-6 bg-white text-black font-semibold px-6 py-2 rounded-md hover:bg-zinc-200 transition-colors">
            Explorar Loja
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {accesses.map((acc) => (
            <div key={acc.id} className="relative aspect-[2/3] rounded-md overflow-hidden bg-zinc-900 border border-zinc-800 group flex flex-col">
              <div 
                className="absolute inset-0 bg-cover bg-center" 
                style={{ backgroundImage: `url(${acc.product.coverUrl || ''})` }} 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              
              <div className="relative z-10 flex-1 flex flex-col justify-end p-3">
                <h3 className="font-bold text-sm leading-tight text-white line-clamp-2 drop-shadow mb-3">
                  {acc.product.title}
                </h3>
                <a 
                  href={acc.inviteLink || acc.product.deliveryValue || `/miniapp/${storeSlug}/product/${acc.product.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2 rounded flex items-center justify-center gap-1 transition-colors shadow"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  Acessar Conteúdo
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
