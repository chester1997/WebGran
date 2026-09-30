import { db } from "@/db";
import { telegramBotChats, telegramBots, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { TelegramBotService } from "./bot";
import { decrypt } from "@/lib/encryption";

export interface BotChatData {
  id: string;
  storeId: string;
  botId: string;
  telegramChatId: string;
  title: string;
  type: string;
  username: string | null;
  photoUrl: string | null;
  botStatus: string;
  canInviteUsers: boolean;
  isActive: boolean;
  lastSyncedAt: Date;
}

/**
 * Handles incoming my_chat_member updates from Telegram webhook.
 */
export async function handleMyChatMemberUpdate(botDbRecord: { id: string; storeId: string; botId: string; tokenEncrypted: string }, update: any) {
  const myChatMember = update.my_chat_member;
  if (!myChatMember || !myChatMember.chat) return null;

  const chat = myChatMember.chat;
  const chatType = chat.type; // 'group' | 'supergroup' | 'channel' | 'private'
  
  // Ignore private chats
  if (chatType === 'private') return null;

  const telegramChatId = String(chat.id);
  const botToken = decrypt(botDbRecord.tokenEncrypted);
  const botService = new TelegramBotService(botToken);

  let botStatus = 'left';
  let canInviteUsers = false;
  let title = chat.title || chat.username || `Chat ${telegramChatId}`;
  let username = chat.username || null;
  let photoUrl: string | null = null;

  try {
    // Re-query latest getChat & getChatMember from Telegram API for full accuracy
    const freshChat = await botService.getChat(telegramChatId);
    if (freshChat) {
      if (freshChat.title) title = freshChat.title;
      if (freshChat.username) username = freshChat.username;
    }

    const memberInfo = await botService.getChatMember(telegramChatId, botDbRecord.botId);
    if (memberInfo) {
      botStatus = memberInfo.status || 'left';
      const isAdmin = botStatus === 'administrator' || botStatus === 'creator';
      canInviteUsers = isAdmin && Boolean(memberInfo.can_invite_users || memberInfo.status === 'creator');
    }
  } catch (err) {
    console.warn(`[handleMyChatMemberUpdate] Error fetching fresh details for chat ${telegramChatId}:`, err);
    // Fallback to update payload values if API call fails
    const newMember = myChatMember.new_chat_member;
    if (newMember) {
      botStatus = newMember.status || 'left';
      const isAdmin = botStatus === 'administrator' || botStatus === 'creator';
      canInviteUsers = isAdmin && Boolean(newMember.can_invite_users || newMember.status === 'creator');
    }
  }

  const isAdmin = botStatus === 'administrator' || botStatus === 'creator';
  const isActive = isAdmin && canInviteUsers;

  return saveOrUpdateBotChat({
    storeId: botDbRecord.storeId,
    botId: botDbRecord.id, // reference to telegramBots.id (uuid)
    telegramChatId,
    title,
    type: chatType,
    username,
    photoUrl,
    botStatus,
    canInviteUsers,
    isActive,
  });
}

/**
 * Saves or updates a telegram_bot_chats record safely.
 */
export async function saveOrUpdateBotChat(data: {
  storeId: string;
  botId: string; // uuid
  telegramChatId: string;
  title: string;
  type: string;
  username?: string | null;
  photoUrl?: string | null;
  botStatus: string;
  canInviteUsers: boolean;
  isActive: boolean;
}) {
  const existing = await db.query.telegramBotChats.findFirst({
    where: and(
      eq(telegramBotChats.botId, data.botId),
      eq(telegramBotChats.telegramChatId, data.telegramChatId)
    ),
  });

  const now = new Date();

  if (existing) {
    const [updated] = await db.update(telegramBotChats)
      .set({
        storeId: data.storeId,
        title: data.title,
        type: data.type,
        username: data.username ?? existing.username,
        photoUrl: data.photoUrl ?? existing.photoUrl,
        botStatus: data.botStatus,
        canInviteUsers: data.canInviteUsers,
        isActive: data.isActive,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(telegramBotChats.id, existing.id))
      .returning();

    return updated;
  } else {
    const [inserted] = await db.insert(telegramBotChats)
      .values({
        storeId: data.storeId,
        botId: data.botId,
        telegramChatId: data.telegramChatId,
        title: data.title,
        type: data.type,
        username: data.username || null,
        photoUrl: data.photoUrl || null,
        botStatus: data.botStatus,
        canInviteUsers: data.canInviteUsers,
        isActive: data.isActive,
        lastSyncedAt: now,
      })
      .returning();

    return inserted;
  }
}

/**
 * Manually syncs all known chats for a bot by inspecting existing records and products.
 */
export async function syncBotChats(storeId: string, botDbId: string) {
  // 1. Verify Bot belongs to Store
  const bot = await db.query.telegramBots.findFirst({
    where: and(
      eq(telegramBots.id, botDbId),
      eq(telegramBots.storeId, storeId)
    ),
  });

  if (!bot) {
    throw new Error("Bot não encontrado ou sem permissão de acesso.");
  }

  const botToken = decrypt(bot.tokenEncrypted);
  const botService = new TelegramBotService(botToken);

  // 2. Collect existing registered chats
  const existingChats = await db.query.telegramBotChats.findMany({
    where: and(
      eq(telegramBotChats.botId, bot.id),
      eq(telegramBotChats.storeId, storeId)
    ),
  });

  // 3. Also collect chat IDs configured in store products for this bot (as fallback/discovery)
  const storeProducts = await db.query.products.findMany({
    where: and(
      eq(products.storeId, storeId),
      eq(products.botId, bot.id)
    ),
  });

  const productChatIds = storeProducts
    .filter(p => p.deliveryType === 'telegram' && p.deliveryValue && !p.deliveryValue.startsWith('http'))
    .map(p => String(p.deliveryValue).trim());

  const allChatIdsToSync = new Set<string>();
  existingChats.forEach(c => allChatIdsToSync.add(c.telegramChatId));
  productChatIds.forEach(id => {
    if (id && id !== 'null') allChatIdsToSync.add(id);
  });

  const results: any[] = [];

  for (const chatId of Array.from(allChatIdsToSync)) {
    try {
      const chatInfo = await botService.getChat(chatId);
      const memberInfo = await botService.getChatMember(chatId, bot.botId);

      const botStatus = memberInfo?.status || 'left';
      const isAdmin = botStatus === 'administrator' || botStatus === 'creator';
      const canInviteUsers = isAdmin && Boolean(memberInfo?.can_invite_users || memberInfo?.status === 'creator');
      const isActive = isAdmin && canInviteUsers;

      const updated = await saveOrUpdateBotChat({
        storeId,
        botId: bot.id,
        telegramChatId: chatId,
        title: chatInfo.title || chatInfo.username || `Chat ${chatId}`,
        type: chatInfo.type || 'group',
        username: chatInfo.username || null,
        botStatus,
        canInviteUsers,
        isActive,
      });

      results.push(updated);
    } catch (err: any) {
      console.warn(`[syncBotChats] Could not sync chat ${chatId}:`, err.message);
      // Mark as inaccessible if bot was removed or chat deleted
      const existing = existingChats.find(c => c.telegramChatId === chatId);
      if (existing) {
        const [deactivated] = await db.update(telegramBotChats)
          .set({
            botStatus: 'kicked',
            canInviteUsers: false,
            isActive: false,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(telegramBotChats.id, existing.id))
          .returning();
        results.push(deactivated);
      }
    }
  }

  // Return updated list of active/known chats for this bot
  return getBotChats(storeId, bot.id);
}

/**
 * Retrieves all registered chats for a specific bot belonging to a store.
 */
export async function getBotChats(storeId: string, botDbId: string) {
  return db.query.telegramBotChats.findMany({
    where: and(
      eq(telegramBotChats.botId, botDbId),
      eq(telegramBotChats.storeId, storeId)
    ),
    orderBy: (chats, { desc }) => [desc(chats.updatedAt)],
  });
}
