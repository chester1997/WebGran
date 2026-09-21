import React from "react";
import { PlayCircle, Lock } from "lucide-react";
import { getMiniAppSession } from "@/lib/telegram/session";
import { AccessService } from "@/lib/orders/access-service";
import Link from "next/link";
import { db } from "@/db";
import { stores, telegramCustomers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { StudioAccessCard } from "./StudioAccessCard";
import { AccessLifecycleService } from "@/lib/orders/access-lifecycle-service";

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

  // Pre-resolve destination URLs in parallel for active items
  const accessesWithDestinations = await Promise.all(
    accesses.map(async (acc) => {
      if (acc.status === 'EXPIRED') {
        return {
          access: acc,
          destinationUrl: null,
          destinationType: 'EXPIRED',
        };
      }
      try {
        const res = await AccessLifecycleService.resolveAccessDestination(acc.id, storeSlug);
        return {
          access: acc,
          destinationUrl: res.destinationUrl,
          destinationType: res.destinationType,
        };
      } catch {
        return {
          access: acc,
          destinationUrl: acc.inviteLink || null,
          destinationType: 'INVITE',
        };
      }
    })
  );

  return (
    <div className="p-4 pt-8 text-white bg-transparent w-full min-h-[80vh]">
      <h1 className="text-2xl font-bold mb-6">Meus Acessos</h1>
      
      {accessesWithDestinations.length === 0 ? (
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
          {accessesWithDestinations.map(({ access, destinationUrl, destinationType }) => (
            <StudioAccessCard
              key={access.id}
              access={access}
              storeSlug={storeSlug}
              initialDestinationUrl={destinationUrl}
              initialDestinationType={destinationType}
            />
          ))}
        </div>
      )}
    </div>
  );
}
