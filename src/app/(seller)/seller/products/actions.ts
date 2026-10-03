"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { products } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq, and, count } from "drizzle-orm";
import { getStorageProvider, generateMultiTenantStoragePath } from "@/lib/storage/provider";
import { checkLimit } from "@/lib/entitlements/entitlement-service";
import { MediaLifecycleService } from "@/lib/storage/lifecycle-service";
import { StorageUsageService } from "@/lib/storage/storage-usage-service";

async function processImageUrl(
  rawUrl: string | null,
  storeId: string,
  sellerId: string,
  entityType: "products" | "banners" | "categories",
  prefix: string
): Promise<string | null> {
  if (!rawUrl || !rawUrl.trim()) return null;
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("data:")) {
    const parts = trimmed.split(",");
    const meta = parts[0];
    const base64Data = parts[1] || "";
    const matchMime = meta.match(/data:(.*?);/);
    const mimeType = matchMime ? matchMime[1] : "image/webp";
    const buffer = Buffer.from(base64Data, "base64");
    const actualBytes = buffer.length;

    const reservation = await StorageUsageService.reserveStorageForUpload({
      sellerId,
      storeId,
      bytes: actualBytes,
      referenceType: "image_upload",
    });

    if (!reservation.allowed) {
      throw new Error(reservation.reason || "Capacidade de armazenamento excedida para o seu plano.");
    }

    const storagePath = generateMultiTenantStoragePath(storeId, entityType, `${prefix}-${Date.now()}.webp`);
    const provider = getStorageProvider();
    try {
      const uploadRes = await provider.upload(buffer, storagePath, mimeType);
      if (reservation.reservationId) {
        await StorageUsageService.confirmReservation(reservation.reservationId, uploadRes.sizeBytes || actualBytes);
      }
      return uploadRes.url;
    } catch (err: any) {
      if (reservation.reservationId) {
        await StorageUsageService.releaseReservation(reservation.reservationId);
      }
      console.error("[Storage Upload Error]:", err);
      throw new Error(`Upload de imagem do produto falhou: ${err?.message || "Erro no storage"}`);
    }
  }
  return trimmed;
}

export async function createProductAction(formData: FormData) {
  const seller = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Store not found");
  }

  // Enforcement: max_products
  const prodCountRes = await db
    .select({ count: count() })
    .from(products)
    .where(eq(products.storeId, store.id));
  const currentCount = prodCountRes[0]?.count || 0;
  const limitCheck = await checkLimit(seller.id, "max_products", currentCount);
  if (!limitCheck.allowed) {
    throw new Error(`Limite de produtos atingido. Seu plano permite ${limitCheck.limit} produtos e você já possui ${currentCount}.`);
  }

  const title = (formData.get("title") as string)?.trim();
  if (!title) {
    throw new Error("O título do produto é obrigatório.");
  }

  const priceStr = formData.get("price") as string;
  const price = parseFloat(priceStr);
  if (isNaN(price) || price < 0) {
    throw new Error("Informe um preço válido.");
  }

  const deliveryType = (formData.get("deliveryType") as string) || "telegram";
  const deliveryValue = (formData.get("deliveryValue") as string)?.trim();

  if (!deliveryValue) {
    throw new Error(
      deliveryType === "telegram"
        ? "Informe o ID do Grupo/Canal do Telegram (Ex: -1001234567890)."
        : "Informe o Link externo para entrega após o pagamento."
    );
  }

  // Validate Telegram Chat & Bot Permissions on Product Creation
  if (deliveryType === "telegram" || deliveryType === "TELEGRAM_CHAT") {
    if (!deliveryValue.startsWith("http://") && !deliveryValue.startsWith("https://")) {
      const botId = (formData.get("botId") as string) || null;
      const { validateProductTelegramChat } = await import("@/lib/telegram/product-chat-validator");
      const validation = await validateProductTelegramChat(store.id, deliveryValue, botId);
      if (!validation.success) {
        throw new Error(validation.error || "Falha ao validar grupo/canal no Telegram.");
      }
    }
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now().toString().slice(-4);
  const shortDescription = (formData.get("shortDescription") as string) || null;
  const description = (formData.get("description") as string) || null;
  const discountStr = formData.get("discount") as string;
  const discount = discountStr ? parseFloat(discountStr) : 0;

  let compareAtPrice: string | null = null;
  if (discount > 0 && discount < 100) {
    const originalPrice = price / (1 - (discount / 100));
    compareAtPrice = originalPrice.toFixed(2);
  }

  const categoryId = (formData.get("categoryId") as string) || null;
  const botId = (formData.get("botId") as string) || null;
  const status = (formData.get("status") as string) || "active";
  const duration = (formData.get("duration") as string) || "lifetime";
  const badge = (formData.get("badge") as string) || null;
  const rawCoverUrl = (formData.get("coverUrl") as string) || (formData.get("imageUrl") as string) || null;
  const rawBannerUrl = (formData.get("bannerUrl") as string) || null;

  const coverUrl = await processImageUrl(rawCoverUrl, store.id, seller.id, "products", "cover");
  const bannerUrl = await processImageUrl(rawBannerUrl, store.id, seller.id, "products", "banner");

  const showViews = formData.get("showViews") === "on" || formData.get("showViews") === "true" || formData.get("showViews") === "1";
  const viewsCountStr = formData.get("viewsCount") as string;
  const viewsCount = viewsCountStr ? parseInt(viewsCountStr, 10) : 0;
  const showFire = formData.get("showFire") === "on" || formData.get("showFire") === "true" || formData.get("showFire") === "1";
  const fireCountStr = formData.get("fireCount") as string;
  const fireCount = fireCountStr ? parseInt(fireCountStr, 10) : 0;

  const [createdProduct] = await db
    .insert(products)
    .values({
      storeId: store.id,
      botId: botId || null,
      title,
      slug,
      shortDescription,
      description,
      price: price.toString(),
      compareAtPrice,
      categoryId: categoryId || null,
      status,
      duration,
      badge,
      coverUrl,
      bannerUrl,
      deliveryType,
      deliveryValue,
      showViews,
      viewsCount: isNaN(viewsCount) ? 0 : viewsCount,
      showFire,
      fireCount: isNaN(fireCount) ? 0 : fireCount,
      position: 0,
    })
    .returning();

  revalidatePath("/seller/products");
  revalidatePath("/miniapp/[slug]", "layout");
  return { success: true, product: { id: createdProduct.id, title: createdProduct.title } };
}

export async function updateProductAction(productId: string, formData: FormData) {
  const seller = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Store not found");
  }

  const title = (formData.get("title") as string)?.trim();
  if (!title) {
    throw new Error("O título do produto é obrigatório.");
  }

  const priceStr = formData.get("price") as string;
  const price = parseFloat(priceStr);
  if (isNaN(price) || price < 0) {
    throw new Error("Informe um preço válido.");
  }

  const deliveryType = (formData.get("deliveryType") as string) || "telegram";
  const deliveryValue = (formData.get("deliveryValue") as string)?.trim();

  if (!deliveryValue) {
    throw new Error(
      deliveryType === "telegram"
        ? "Informe o ID do Grupo/Canal do Telegram (Ex: -1001234567890)."
        : "Informe o Link externo para entrega após o pagamento."
    );
  }

  // Validate Telegram Chat & Bot Permissions on Product Update
  if (deliveryType === "telegram" || deliveryType === "TELEGRAM_CHAT") {
    if (!deliveryValue.startsWith("http://") && !deliveryValue.startsWith("https://")) {
      const botId = (formData.get("botId") as string) || null;
      const { validateProductTelegramChat } = await import("@/lib/telegram/product-chat-validator");
      const validation = await validateProductTelegramChat(store.id, deliveryValue, botId);
      if (!validation.success) {
        throw new Error(validation.error || "Falha ao validar grupo/canal no Telegram.");
      }
    }
  }

  const shortDescription = (formData.get("shortDescription") as string) || null;
  const description = (formData.get("description") as string) || null;
  const discountStr = formData.get("discount") as string;
  const discount = discountStr ? parseFloat(discountStr) : 0;

  let compareAtPrice: string | null = null;
  if (discount > 0 && discount < 100) {
    const originalPrice = price / (1 - (discount / 100));
    compareAtPrice = originalPrice.toFixed(2);
  }

  const categoryId = (formData.get("categoryId") as string) || null;
  const botId = (formData.get("botId") as string) || null;
  const status = (formData.get("status") as string) || "active";
  const duration = (formData.get("duration") as string) || "lifetime";
  const badge = (formData.get("badge") as string) || null;
  const rawCoverUrl = (formData.get("coverUrl") as string) || (formData.get("imageUrl") as string) || null;
  const rawBannerUrl = (formData.get("bannerUrl") as string) || null;

  const coverUrl = await processImageUrl(rawCoverUrl, store.id, seller.id, "products", "cover");
  const bannerUrl = await processImageUrl(rawBannerUrl, store.id, seller.id, "products", "banner");

  const showViews = formData.get("showViews") === "on" || formData.get("showViews") === "true" || formData.get("showViews") === "1";
  const viewsCountStr = formData.get("viewsCount") as string;
  const viewsCount = viewsCountStr ? parseInt(viewsCountStr, 10) : 0;
  const showFire = formData.get("showFire") === "on" || formData.get("showFire") === "true" || formData.get("showFire") === "1";
  const fireCountStr = formData.get("fireCount") as string;
  const fireCount = fireCountStr ? parseInt(fireCountStr, 10) : 0;

  const existing = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.storeId, store.id)),
  });

  await db.update(products).set({
    botId: botId || null,
    title,
    shortDescription,
    description,
    price: price.toString(),
    compareAtPrice,
    categoryId: categoryId || null,
    status,
    duration,
    badge,
    coverUrl,
    bannerUrl,
    deliveryType,
    deliveryValue,
    showViews,
    viewsCount: isNaN(viewsCount) ? 0 : viewsCount,
    showFire,
    fireCount: isNaN(fireCount) ? 0 : fireCount,
    updatedAt: new Date(),
  }).where(and(eq(products.id, productId), eq(products.storeId, store.id)));

  // Media Replacement Cleanup
  if (existing) {
    if (coverUrl && existing.coverUrl && coverUrl !== existing.coverUrl) {
      await MediaLifecycleService.handleImageReplacement({
        oldUrl: existing.coverUrl,
        newUrl: coverUrl,
        storeId: store.id,
        excludeEntityId: productId,
      });
    }
    if (bannerUrl && existing.bannerUrl && bannerUrl !== existing.bannerUrl) {
      await MediaLifecycleService.handleImageReplacement({
        oldUrl: existing.bannerUrl,
        newUrl: bannerUrl,
        storeId: store.id,
        excludeEntityId: productId,
      });
    }
  }

  revalidatePath("/seller/products");
  revalidatePath("/miniapp/[slug]", "layout");
  return { success: true };
}

export async function deleteProductAction(productId: string) {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Store not found");
  }

  const existing = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.storeId, store.id)),
  });

  if (existing) {
    await db.delete(products).where(and(eq(products.id, productId), eq(products.storeId, store.id)));

    // Cleanup images from Bunny Storage safely
    if (existing.coverUrl) {
      await MediaLifecycleService.deleteMediaFile(existing.coverUrl, store.id, productId);
    }
    if (existing.bannerUrl) {
      await MediaLifecycleService.deleteMediaFile(existing.bannerUrl, store.id, productId);
    }
  }

  revalidatePath("/seller/products");
  return { success: true };
}

export async function testTelegramChatAccessAction(botId: string, telegramChatId: string) {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Store not found");
  }

  const { telegramBots } = await import("@/db/schema");
  const { decrypt } = await import("@/lib/encryption");
  const { TelegramDeliveryService } = await import("@/lib/delivery/telegram-delivery-service");

  let bot = null;
  if (botId) {
    bot = await db.query.telegramBots.findFirst({
      where: and(eq(telegramBots.id, botId), eq(telegramBots.storeId, store.id))
    });
  }

  if (!bot) {
    bot = await db.query.telegramBots.findFirst({
      where: eq(telegramBots.storeId, store.id)
    });
  }

  if (!bot) {
    return {
      success: false,
      error: "Nenhum bot do Telegram está conectado a esta loja."
    };
  }

  const botToken = decrypt(bot.tokenEncrypted);
  const result = await TelegramDeliveryService.validateBotAndChatPermission(botToken, telegramChatId);
  return result;
}

export async function getStoreBotsAction() {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Store not found");
  }

  const { telegramBots } = await import("@/db/schema");
  const bots = await db.query.telegramBots.findMany({
    where: eq(telegramBots.storeId, store.id),
    orderBy: (bots, { desc }) => [desc(bots.createdAt)],
  });

  return bots.map(b => ({
    id: b.id,
    botId: b.botId,
    username: b.username,
    displayName: b.displayName || `@${b.username}`,
    photoUrl: b.photoUrl,
  }));
}

export async function getBotChatsAction(botId?: string | null) {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Store not found");
  }

  const { telegramBots } = await import("@/db/schema");
  const { getBotChats } = await import("@/lib/telegram/chat-sync");

  let targetBot = null;
  if (botId) {
    targetBot = await db.query.telegramBots.findFirst({
      where: and(eq(telegramBots.id, botId), eq(telegramBots.storeId, store.id))
    });
  }

  if (!targetBot) {
    targetBot = await db.query.telegramBots.findFirst({
      where: eq(telegramBots.storeId, store.id)
    });
  }

  if (!targetBot) {
    return [];
  }

  const chats = await getBotChats(store.id, targetBot.id);
  return chats;
}

export async function syncBotChatsAction(botId?: string | null) {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Store not found");
  }

  const { telegramBots } = await import("@/db/schema");
  const { syncBotChats } = await import("@/lib/telegram/chat-sync");

  let targetBot = null;
  if (botId) {
    targetBot = await db.query.telegramBots.findFirst({
      where: and(eq(telegramBots.id, botId), eq(telegramBots.storeId, store.id))
    });
  }

  if (!targetBot) {
    targetBot = await db.query.telegramBots.findFirst({
      where: eq(telegramBots.storeId, store.id)
    });
  }

  if (!targetBot) {
    throw new Error("Nenhum bot do Telegram encontrado para esta loja.");
  }

  const chats = await syncBotChats(store.id, targetBot.id);
  return chats;
}

