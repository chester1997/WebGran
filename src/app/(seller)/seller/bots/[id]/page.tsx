import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { telegramBots, stores, telegramCustomers, orders, telegramMessages } from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { getCurrentStore } from "@/lib/auth";
import { requireOwnerAccount } from "@/lib/bots/owner-guard";
import SingleBotClient from "./SingleBotClient";
import { loadBotTabData } from "../bot-tab-loaders";

interface SingleBotPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function SingleBotPage({ params, searchParams }: SingleBotPageProps) {
  await connection();
  // Proteção exclusiva da conta proprietária
  const user = await requireOwnerAccount();
  const store = await getCurrentStore();

  if (!store) {
    notFound();
  }

  const { id: botId } = await params;
  const { tab } = await searchParams;

  // Buscar dados completos do bot
  const botRecord = await db.query.telegramBots.findFirst({
    where: and(
      eq(telegramBots.id, botId),
      eq(telegramBots.storeId, store.id)
    ),
    with: {
      chats: true,
      notificationRecipients: true,
    }
  });

  if (!botRecord) {
    notFound();
  }

  // Buscar clientes do Telegram da loja para a aba Conversas
  const customers = await db.query.telegramCustomers.findMany({
    where: eq(telegramCustomers.storeId, store.id),
    orderBy: [desc(telegramCustomers.updatedAt)],
    limit: 50,
  });

  // Buscar mensagens recentes deste bot para enriquecer a lista de conversas
  const botMessages = await db.query.telegramMessages.findMany({
    where: and(
      eq(telegramMessages.storeId, store.id),
      eq(telegramMessages.botId, botRecord.id)
    ),
    orderBy: [desc(telegramMessages.createdAt)],
    limit: 500,
  });

  // Buscar pedidos recentes vinculados à loja
  const recentOrders = await db.query.orders.findMany({
    where: eq(orders.storeId, store.id),
    orderBy: [desc(orders.createdAt)],
    limit: 100,
  });

  // Mapear dados para o cliente
  const botData = {
    id: botRecord.id,
    botId: botRecord.botId,
    username: botRecord.username,
    displayName: botRecord.displayName || botRecord.username,
    photoUrl: botRecord.photoUrl,
    buttonText: botRecord.buttonText || "Abrir App",
    status: (botRecord.status as "active" | "paused" | "disconnected") || "active",
    createdAt: botRecord.createdAt.toISOString(),
    mode: "MINI_APP" as const,
    storeSlug: store.slug,
    storeName: store.name,
    chatsCount: botRecord.chats?.length || 0,
    recipientsCount: botRecord.notificationRecipients?.length || 0,
  };

  const initialOrders = recentOrders.map(o => ({
    id: o.id,
    status: o.status,
    totalAmount: Number(o.total || 0),
    createdAt: o.createdAt.toISOString(),
    customerTelegramId: o.customerId,
  }));

  const initialCustomers = customers.map(c => {
    const custMsgs = botMessages.filter(m => m.telegramUserId === c.telegramUserId);
    const lastMsg = custMsgs[0] || null;
    return {
      id: c.id,
      telegramUserId: c.telegramUserId,
      username: c.username,
      firstName: c.firstName,
      lastName: c.lastName,
      createdAt: c.createdAt.toISOString(),
      messagesCount: custMsgs.length,
      lastMessageText: lastMsg?.text || null,
      lastMessageAt: lastMsg?.createdAt ? lastMsg.createdAt.toISOString() : null,
      lastMessageDirection: lastMsg?.direction as "inbound" | "outbound" | null,
    };
  });

  // Mensagens iniciais do primeiro cliente selecionado
  const firstCustomerId = initialCustomers[0]?.id;
  const initialSelectedMessages = firstCustomerId
    ? botMessages
        .filter(m => m.telegramUserId === initialCustomers[0].telegramUserId)
        .reverse()
        .map(m => ({
          id: m.id,
          direction: m.direction as "inbound" | "outbound",
          messageType: m.messageType,
          text: m.text,
          status: m.status,
          createdAt: m.createdAt.toISOString(),
          errorMessage: m.errorMessage,
        }))
    : [];

  const currentTab = tab || "visao-geral";
  const tabData = await loadBotTabData(currentTab, store, user.id);

  return (
    <Suspense fallback={<div className="p-8 text-zinc-400 text-sm">Carregando painel do bot...</div>}>
      <SingleBotClient
        bot={botData}
        storeSlug={store.slug}
        initialTab={currentTab}
        initialOrders={initialOrders}
        initialCustomers={initialCustomers}
        initialMessages={initialSelectedMessages}
        tabData={tabData}
        userRole={user.role}
        isAdmin={user.role === "admin" || user.role === "super_admin"}
      />
    </Suspense>
  );
}
