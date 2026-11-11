import { Suspense } from "react";
import { connection } from "next/server";
import { db } from "@/db";
import { telegramBots } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentStore } from "@/lib/auth";
import { requireOwnerAccount } from "@/lib/bots/owner-guard";
import BotsListClient from "./BotsListClient";

export default async function SellerBotsPage() {
  await connection();
  // Proteção estrita: exclusivo da conta do proprietário
  await requireOwnerAccount();

  const store = await getCurrentStore();
  if (!store) {
    return null;
  }

  // Buscar todos os bots vinculados à loja
  const rawBots = await db.query.telegramBots.findMany({
    where: eq(telegramBots.storeId, store.id),
    orderBy: [desc(telegramBots.createdAt)],
    with: {
      notificationRecipients: true,
      chats: true,
    }
  });

  // Mapeamento dos modos: bots cadastrados com buttonText === "Conversa" são PADRÃO (Venda na conversa); demais são MINI_APP
  const bots = rawBots.map((bot) => ({
    id: bot.id,
    botId: bot.botId,
    username: bot.username,
    displayName: bot.displayName || bot.username,
    photoUrl: bot.photoUrl,
    buttonText: bot.buttonText || "Abrir App",
    status: (bot.status as "active" | "paused" | "disconnected") || "active",
    createdAt: bot.createdAt.toISOString(),
    // Modalidade comercial: consulta sales_mode diretamente, com fallback defensivo para a fase de transição
    mode: ((bot as any).salesMode || (bot.buttonText === "Conversa" ? "PADRAO" : "MINI_APP")) as "PADRAO" | "MINI_APP",
    recipientsCount: bot.notificationRecipients?.length || 0,
    chatsCount: bot.chats?.length || 0,
    storeSlug: store.slug,
    storeName: store.name,
  }));

  return (
    <Suspense fallback={<div className="p-8 text-zinc-400 text-sm">Carregando lista de bots...</div>}>
      <BotsListClient bots={bots} storeSlug={store.slug} />
    </Suspense>
  );
}
