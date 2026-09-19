import React from "react";
import { PlayCircle, Lock, AlertTriangle, RefreshCw, ShoppingCart, CheckCircle2 } from "lucide-react";
import { getMiniAppSession } from "@/lib/telegram/session";
import { AccessService } from "@/lib/orders/access-service";
import Link from "next/link";
import { db } from "@/db";
import { stores, telegramCustomers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { formatAccessExpirationBR } from "@/lib/orders/expiration-service";

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {accesses.map((acc) => {
            const expInfo = formatAccessExpirationBR(acc.expiresAt, acc.status);
            const isExpired = acc.status === 'EXPIRED' || expInfo.isExpired;
            const isFailedDelivery = acc.deliveryStatus === 'FAILED';
            const isPendingDelivery = acc.deliveryStatus === 'PENDING';
            const hasDirectLink = acc.inviteLink || (acc.product.deliveryValue && acc.product.deliveryValue.startsWith('http'));
            const accessUrl = acc.inviteLink || (acc.product.deliveryValue?.startsWith('http') ? acc.product.deliveryValue : `/miniapp/${storeSlug}/product/${acc.product.slug}`);

            return (
              <div key={acc.id} className="relative aspect-[16/10] sm:aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 group flex flex-col justify-between">
                <div 
                  className="absolute inset-0 bg-cover bg-center" 
                  style={{ backgroundImage: `url(${acc.product.coverUrl || ''})` }} 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
                
                {/* Header Status Badges */}
                <div className="relative z-10 p-3 flex items-center justify-between">
                  {isExpired ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full border border-red-500/30 backdrop-blur-md">
                      🔴 Acesso expirado
                    </span>
                  ) : isFailedDelivery || isPendingDelivery ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full border border-amber-500/30 backdrop-blur-md">
                      🟡 Entrega pendente
                    </span>
                  ) : expInfo.isLifetime ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/30 backdrop-blur-md">
                      🟢 Acesso vitalício
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/30 backdrop-blur-md">
                      🟢 Acesso ativo
                    </span>
                  )}
                </div>

                {/* Footer Content & Actions */}
                <div className="relative z-10 p-4 flex flex-col justify-end">
                  <h3 className="font-bold text-base leading-tight text-white line-clamp-2 drop-shadow mb-1">
                    {acc.product.title}
                  </h3>

                  {/* Expiration date text */}
                  <div className="text-xs text-zinc-400 mb-3 space-y-0.5">
                    {expInfo.isLifetime ? (
                      <p className="text-emerald-400 font-medium">Vitalício • Sem data limite</p>
                    ) : isExpired ? (
                      <p className="text-red-400 font-medium">{expInfo.dateFormatted}</p>
                    ) : (
                      <p className="text-zinc-300">
                        {expInfo.dateFormatted}
                        {expInfo.daysRemaining !== null && (
                          <span className="text-zinc-400 ml-1.5">({expInfo.daysRemaining} {expInfo.daysRemaining === 1 ? 'dia restante' : 'dias restantes'})</span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Action Button */}
                  {isExpired ? (
                    <Link
                      href={`/miniapp/${storeSlug}/product/${acc.product.slug}`}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Comprar novamente
                    </Link>
                  ) : isFailedDelivery ? (
                    <Link
                      href={`/miniapp/${storeSlug}/product/${acc.product.slug}`}
                      className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Tentar liberar acesso
                    </Link>
                  ) : (
                    <a 
                      href={accessUrl}
                      target={hasDirectLink ? "_blank" : "_self"}
                      rel={hasDirectLink ? "noopener noreferrer" : undefined}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow"
                    >
                      <PlayCircle className="w-4 h-4" />
                      Acessar Conteúdo
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
