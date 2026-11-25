import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { telegramBots, stores, telegramCustomers, orders, telegramMessages, botStartEvents, products } from "@/db/schema";
import { eq, and, desc, asc, or, isNull, notLike } from "drizzle-orm";
import { getCurrentStore } from "@/lib/auth";
import { requireOwnerAccount, isOwnerUser } from "@/lib/bots/owner-guard";
import { ProductManualDeepLinkService } from "@/lib/products/manual-deep-link-service";
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

  const currentTab = tab || "visao-geral";

  // Consultas independentes em paralelo (antes rodavam uma depois da outra)
  const [allStoreBots, customers, botMessages, startEvents, recentOrders, tabData] = await Promise.all([
    // Todos os bots da loja para validação de vínculo exclusivo
    db.query.telegramBots.findMany({
      where: eq(telegramBots.storeId, store.id),
      columns: { id: true },
    }),
    // Clientes do Telegram da loja para a aba Conversas
    db.query.telegramCustomers.findMany({
      // Clientes da Loja Web (web:<id>) não são do bot
      where: and(eq(telegramCustomers.storeId, store.id), or(isNull(telegramCustomers.telegramUserId), notLike(telegramCustomers.telegramUserId, "web:%"))),
      orderBy: [desc(telegramCustomers.updatedAt)],
      limit: 100,
    }),
    // Mensagens recentes deste bot para enriquecer a lista de conversas e mapear interações
    db.query.telegramMessages.findMany({
      where: and(
        eq(telegramMessages.storeId, store.id),
        eq(telegramMessages.botId, botRecord.id)
      ),
      orderBy: [desc(telegramMessages.createdAt)],
      limit: 500,
    }),
    // Eventos de /start registrados para este bot
    db.query.botStartEvents.findMany({
      where: and(
        eq(botStartEvents.storeId, store.id),
        eq(botStartEvents.botId, botRecord.id)
      ),
      orderBy: [desc(botStartEvents.createdAt)],
      limit: 100,
    }).catch(() => []),
    // Pedidos recentes vinculados à loja com itens, produtos e entregas de notificações
    db.query.orders.findMany({
      // Pedidos da Loja Web (session web:<id>) são de outro canal e não contam no bot
      where: and(eq(orders.storeId, store.id), or(isNull(orders.sessionId), notLike(orders.sessionId, "web:%"))),
      orderBy: [desc(orders.createdAt)],
      limit: 150,
      with: {
        customer: true,
        items: {
          with: {
            product: true,
          },
        },
        botNotificationDeliveries: true,
      },
    }),
    // Dados da aba aberta
    loadBotTabData(currentTab, store, user.id, botRecord.id),
  ]);
  const isOnlyBot = allStoreBots.length <= 1;

  // Set de IDs de usuários do Telegram que interagiram com este bot
  const botCustomerUserIds = new Set<string>();
  botMessages.forEach((m) => {
    if (m.telegramUserId) botCustomerUserIds.add(m.telegramUserId);
  });
  startEvents.forEach((se) => {
    if (se.telegramUserId) botCustomerUserIds.add(se.telegramUserId);
  });

  // Filtrar pedidos rigorosamente atribuídos a este bot
  const botOrders = recentOrders.filter((order) => {
    if (isOnlyBot) return true;
    if (order.botNotificationDeliveries?.some((d) => d.botId === botRecord.id)) return true;
    if (order.items?.some((item) => item.product?.botId === botRecord.id)) return true;
    if (order.customer?.telegramUserId && botCustomerUserIds.has(order.customer.telegramUserId)) return true;
    return false;
  });

  // Buscar produtos ativos vinculados ao catálogo deste bot
  const botActiveProducts = await db.query.products.findMany({
    where: and(
      eq(products.storeId, store.id),
      eq(products.status, "active"),
      isOnlyBot
        ? or(eq(products.botId, botRecord.id), isNull(products.botId))
        : eq(products.botId, botRecord.id)
    ),
    columns: { id: true },
  });
  const activeProductsCount = botActiveProducts.length;

  // Calcular clientes únicos vinculados a este bot sem duplicidade
  const botUniqueCustomerKeys = new Set<string>();
  botOrders.forEach((o) => {
    const key = o.customer?.telegramUserId || o.customerId || o.customer?.id;
    if (key) botUniqueCustomerKeys.add(key);
  });
  botMessages.forEach((m) => {
    const key = m.telegramUserId || m.customerId;
    if (key) botUniqueCustomerKeys.add(key);
  });
  startEvents.forEach((se) => {
    if (se.telegramUserId) botUniqueCustomerKeys.add(se.telegramUserId);
  });
  if (isOnlyBot) {
    customers.forEach((c) => {
      const key = c.telegramUserId || c.id;
      if (key) botUniqueCustomerKeys.add(key);
    });
  }
  const totalUniqueCustomers = botUniqueCustomerKeys.size;

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
    // Modalidade comercial: consulta exclusivamente sales_mode persistido no banco
    mode: ((botRecord as any).salesMode === "PADRAO" ? "PADRAO" : "MINI_APP") as "PADRAO" | "MINI_APP",
    storeSlug: store.slug,
    storeName: store.name,
    chatsCount: botRecord.chats?.length || 0,
    recipientsCount: botRecord.notificationRecipients?.length || 0,
  };

  const initialOrders = botOrders.map((o) => ({
    id: o.id,
    status: o.status,
    totalAmount: Number(o.total || 0),
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt ? o.paidAt.toISOString() : null,
    customerTelegramId: o.customerId,
    customerName: [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(" ") || (o.customer?.username ? `@${o.customer.username}` : "Cliente"),
    items: (o.items || []).map((item) => ({
      id: item.id,
      productId: item.productId,
      productTitle: item.product?.title || "Produto",
      productCoverUrl: item.product?.coverUrl || null,
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unitPrice || 0),
      total: Number(item.total || 0),
    })),
  }));

  // Montar lista unificada de acontecimentos recentes relacionados ao bot
  const recentActivityEvents: Array<{
    id: string;
    type: "conversation_started" | "payment_pending" | "sale_approved";
    title: string;
    botTag: string;
    description: string;
    createdAt: string;
    status: "completed" | "pending" | "approved";
    amount?: number;
  }> = [];

  // 1. Início de conversa via botStartEvents
  startEvents.forEach((se) => {
    const name = [se.telegramFirstName, se.telegramUsername ? `@${se.telegramUsername}` : null].filter(Boolean).join(" ") || "Cliente";
    recentActivityEvents.push({
      id: `start-${se.id}`,
      type: "conversation_started",
      title: name,
      botTag: botRecord.displayName || botRecord.username,
      description: "Iniciou uma conversa",
      createdAt: se.createdAt.toISOString(),
      status: "completed",
    });
  });

  // 1.1 Início de conversa para clientes que interagiram com este bot (sem evento duplicado)
  const seenUserIds = new Set(startEvents.map((se) => se.telegramUserId));
  customers.forEach((c) => {
    if (botCustomerUserIds.has(c.telegramUserId) && !seenUserIds.has(c.telegramUserId)) {
      seenUserIds.add(c.telegramUserId);
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || (c.username ? `@${c.username}` : "Cliente");
      recentActivityEvents.push({
        id: `customer-${c.id}`,
        type: "conversation_started",
        title: name,
        botTag: botRecord.displayName || botRecord.username,
        description: "Iniciou uma conversa",
        createdAt: c.createdAt.toISOString(),
        status: "completed",
      });
    }
  });

  // 2. Pedidos pendentes e aprovados do bot
  botOrders.forEach((o) => {
    const productTitle = o.items?.[0]?.product?.title;
    const customerName = [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(" ") || (o.customer?.username ? `@${o.customer.username}` : "Cliente");
    const itemTitle = productTitle || customerName;

    if (o.status === "paid") {
      recentActivityEvents.push({
        id: `order-paid-${o.id}`,
        type: "sale_approved",
        title: itemTitle,
        botTag: botRecord.displayName || botRecord.username,
        description: `Venda aprovada · Pagou R$ ${Number(o.total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        createdAt: (o.paidAt || o.createdAt).toISOString(),
        status: "approved",
        amount: Number(o.total || 0),
      });
    } else if (o.status === "pending") {
      recentActivityEvents.push({
        id: `order-pending-${o.id}`,
        type: "payment_pending",
        title: itemTitle,
        botTag: botRecord.displayName || botRecord.username,
        description: "Cobrança aguardando pagamento · Aguardando pagamento",
        createdAt: o.createdAt.toISOString(),
        status: "pending",
      });
    }
  });

  // Ordenar por data decrescente
  recentActivityEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const initialCustomers = customers.map((c) => {
    const custMsgs = botMessages.filter((m) => m.telegramUserId === c.telegramUserId);
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
      .filter((m) => m.telegramUserId === initialCustomers[0].telegramUserId)
      .reverse()
      .map((m) => ({
        id: m.id,
        direction: m.direction as "inbound" | "outbound",
        messageType: m.messageType,
        text: m.text,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
        errorMessage: m.errorMessage,
      }))
    : [];


  return (
    <Suspense fallback={<div className="p-8 text-zinc-400 text-sm">Carregando painel do bot...</div>}>
      <SingleBotClient
        bot={botData}
        storeSlug={store.slug}
        initialTab={currentTab}
        initialOrders={initialOrders}
        initialRecentActivity={recentActivityEvents}
        initialCustomers={initialCustomers}
        initialMessages={initialSelectedMessages}
        totalUniqueCustomers={totalUniqueCustomers}
        activeProductsCount={activeProductsCount}
        tabData={tabData}
        userRole={user.role}
        isAdmin={user.role === "admin" || user.role === "super_admin"}
        isOwnerAccount={ProductManualDeepLinkService.isAuthorized(user.role, user)}
        useRedesignV2={isOwnerUser(user)}
      />
    </Suspense>
  );
}
