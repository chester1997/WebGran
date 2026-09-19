import React from "react";
import { PlayCircle, Lock, AlertTriangle } from "lucide-react";
import { getMiniAppSession } from "@/lib/telegram/session";
import { AccessService } from "@/lib/orders/access-service";
import Link from "next/link";
import { db } from "@/db";
import { stores, telegramCustomers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
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

  let customerId = session.customerId;
  if (!customerId && session.telegramId) {
    const customer = await db.query.telegramCustomers.findFirst({
      where: and(
        eq(telegramCustomers.storeId, store.id),
        eq(telegramCustomers.telegramUserId, session.telegramId)
      )
    });
    if (customer) {
      customerId = customer.id;
    }
  }

  const accesses = customerId ? await AccessService.getCustomerAccesses(store.id, customerId) : [];

  return (
    <div className="p-4 pt-8 text-white bg-zinc-950 w-full min-h-[80vh]">
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
          {accesses.map((acc) => {
            const hasDirectLink = acc.inviteLink || (acc.product.deliveryValue && acc.product.deliveryValue.startsWith('http'));
            const accessUrl = acc.inviteLink || (acc.product.deliveryValue?.startsWith('http') ? acc.product.deliveryValue : `/miniapp/${storeSlug}/product/${acc.product.slug}`);
            const isFailedDelivery = acc.deliveryStatus === 'FAILED';

            return (
              <div key={acc.id} className="relative aspect-[2/3] rounded-md overflow-hidden bg-zinc-900 border border-zinc-800 group flex flex-col">
                <div 
                  className="absolute inset-0 bg-cover bg-center" 
                  style={{ backgroundImage: `url(${acc.product.coverUrl || ''})` }} 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                
                <div className="relative z-10 flex-1 flex flex-col justify-end p-3">
                  {isFailedDelivery && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 mb-2 w-fit">
                      <AlertTriangle className="w-3 h-3" />
                      Entrega pendente
                    </span>
                  )}
                  <h3 className="font-bold text-sm leading-tight text-white line-clamp-2 drop-shadow mb-3">
                    {acc.product.title}
                  </h3>
                  <a 
                    href={accessUrl}
                    target={hasDirectLink ? "_blank" : "_self"}
                    rel={hasDirectLink ? "noopener noreferrer" : undefined}
                    className={`w-full text-white font-semibold text-xs py-2 rounded flex items-center justify-center gap-1 transition-colors shadow ${
                      isFailedDelivery && !hasDirectLink
                        ? "bg-zinc-700 hover:bg-zinc-600"
                        : "bg-blue-600 hover:bg-blue-500"
                    }`}
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    {isFailedDelivery && !hasDirectLink ? "Ver Detalhes" : "Acessar Conteúdo"}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
