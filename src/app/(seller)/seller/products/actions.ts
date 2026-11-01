"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { products, productVideos, productCarousels, carouselProducts } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq, and, count, inArray } from "drizzle-orm";
import { getStorageProvider, generateMultiTenantStoragePath } from "@/lib/storage/provider";
import { checkLimit } from "@/lib/entitlements/entitlement-service";
import { MediaLifecycleService } from "@/lib/storage/lifecycle-service";
import { StorageUsageService } from "@/lib/storage/storage-usage-service";
import { ProductVideoService } from "@/lib/videos/product-video-service";

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

export type CreateProductActionResult = {
  success: boolean;
  error?: string;
  product?: {
    id: string;
    title: string;
  };
};

export type UpdateProductActionResult = {
  success: boolean;
  error?: string;
};

export async function createProductAction(formData: FormData): Promise<CreateProductActionResult> {
  let seller;
  let store;
  try {
    seller = await requireSeller();
    store = await getCurrentStore();
  } catch {
    return { success: false, error: "Sessão expirada ou não autenticada. Faça login novamente." };
  }

  if (!store) {
    return { success: false, error: "Loja não encontrada." };
  }

  // Enforcement: max_products
  try {
    const prodCountRes = await db
      .select({ count: count() })
      .from(products)
      .where(eq(products.storeId, store.id));
    const currentCount = prodCountRes[0]?.count || 0;
    const limitCheck = await checkLimit(seller.id, "max_products", currentCount);
    if (!limitCheck.allowed) {
      return {
        success: false,
        error: `Limite de produtos atingido. Seu plano permite ${limitCheck.limit} produtos e você já possui ${currentCount}. Faça upgrade do seu plano para cadastrar novos produtos.`,
      };
    }
  } catch (limitErr: any) {
    console.error("[createProductAction] Erro ao verificar limite de produtos:", limitErr);
    return { success: false, error: "Erro ao consultar limites do seu plano. Tente novamente." };
  }

  const title = (formData.get("title") as string)?.trim();
  if (!title) {
    return { success: false, error: "O título do produto é obrigatório." };
  }

  const priceStr = formData.get("price") as string;
  const price = parseFloat(priceStr);
  if (isNaN(price) || price < 0) {
    return { success: false, error: "Informe um preço válido maior ou igual a zero." };
  }

  const deliveryType = (formData.get("deliveryType") as string) || "telegram";
  const deliveryValue = (formData.get("deliveryValue") as string)?.trim() || null;

  if (deliveryType !== "product_video" && !deliveryValue) {
    return {
      success: false,
      error: deliveryType === "telegram"
        ? "Informe o ID do Grupo/Canal do Telegram (Ex: -1001234567890)."
        : "Informe o Link externo para entrega após o pagamento.",
    };
  }

  const videoIdsRaw = (formData.get("videoIds") as string) || (formData.get("selectedVideoIds") as string);
  let videoIds: string[] = [];
  if (videoIdsRaw) {
    try {
      videoIds = JSON.parse(videoIdsRaw);
    } catch {}
  }

  if (deliveryType === "product_video") {
    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return {
        success: false,
        error: "Produtos do tipo Vídeo exigem pelo menos um vídeo com status PRONTO associado.",
      };
    }

    try {
      for (const vid of videoIds) {
        const v = await db.query.productVideos.findFirst({
          where: and(eq(productVideos.id, vid), eq(productVideos.storeId, store.id)),
        });
        if (!v) {
          return { success: false, error: "Vídeo não encontrado ou não pertence a esta loja." };
        }
        if (v.status !== "READY") {
          return {
            success: false,
            error: `O vídeo "${v.title}" ainda não está pronto para entrega (status: ${v.status}).`,
          };
        }
      }
    } catch (vidErr: any) {
      console.error("[createProductAction] Erro ao validar vídeos:", vidErr);
      return { success: false, error: "Erro ao consultar vídeos da biblioteca. Tente novamente." };
    }
  }

  const botId = (formData.get("botId") as string) || null;
  if (botId) {
    try {
      const { telegramBots } = await import("@/db/schema");
      const botRecord = await db.query.telegramBots.findFirst({
        where: and(eq(telegramBots.id, botId), eq(telegramBots.storeId, store.id))
      });
      if (!botRecord) {
        return { success: false, error: "O bot selecionado não pertence a esta loja." };
      }
    } catch (botErr: any) {
      console.error("[createProductAction] Erro ao validar bot selecionado:", botErr);
      return { success: false, error: "Erro ao consultar dados do bot selecionado." };
    }
  }

  // Validate Telegram Chat & Bot Permissions on Product Creation
  if ((deliveryType === "telegram" || deliveryType === "TELEGRAM_CHAT") && deliveryValue) {
    if (!deliveryValue.startsWith("http://") && !deliveryValue.startsWith("https://")) {
      try {
        const { validateProductTelegramChat } = await import("@/lib/telegram/product-chat-validator");
        const validation = await validateProductTelegramChat(store.id, deliveryValue, botId);
        if (!validation.success) {
          return {
            success: false,
            error: validation.error || "Falha ao validar grupo/canal no Telegram.",
          };
        }
      } catch (chatValErr: any) {
        console.error("[createProductAction] Erro na validação Telegram:", chatValErr);
        return {
          success: false,
          error: chatValErr?.message || "Erro ao conectar com o Telegram para validar o grupo/canal.",
        };
      }
    }
  }

  // Pre-validate Carousel associations BEFORE inserting product to prevent orphaned duplicates
  const rawCarouselIds = (formData.get("carouselIds") as string) || null;
  const hasCarouselSelection = formData.has("carouselIds") || formData.has("carouselIds_initialized");
  let selectedCarouselIds: string[] = [];

  if (rawCarouselIds) {
    try {
      const parsed = JSON.parse(rawCarouselIds);
      if (Array.isArray(parsed)) {
        selectedCarouselIds = parsed.filter((id) => typeof id === "string" && id.trim().length > 0);
      } else if (typeof parsed === "string" && parsed.trim().length > 0) {
        selectedCarouselIds = [parsed.trim()];
      }
    } catch {
      selectedCarouselIds = formData.getAll("carouselIds").map(String).filter((id) => id.trim().length > 0);
    }
  } else if (hasCarouselSelection) {
    selectedCarouselIds = formData.getAll("carouselIds").map(String).filter((id) => id.trim().length > 0);
  }

  selectedCarouselIds = Array.from(new Set(selectedCarouselIds));

  if (selectedCarouselIds.length > 0) {
    try {
      const validCarousels = await db.query.productCarousels.findMany({
        where: and(
          eq(productCarousels.storeId, store.id),
          eq(productCarousels.isRanking, false),
          inArray(productCarousels.id, selectedCarouselIds)
        ),
        columns: { id: true },
      });

      if (validCarousels.length !== selectedCarouselIds.length) {
        return {
          success: false,
          error: "Um ou mais carrosséis selecionados são inválidos ou não pertencem a esta loja.",
        };
      }
    } catch (carErr: any) {
      console.error("[createProductAction] Erro ao validar carrosséis:", carErr);
      return { success: false, error: "Erro ao consultar carrosséis da loja." };
    }
  }

  // Generate safe, collision-resistant slug
  const baseSlug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "") || "produto";
  const uniqueSuffix = `${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;
  const slug = `${baseSlug}-${uniqueSuffix}`;

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
  const status = (formData.get("status") as string) || "active";
  const duration = (formData.get("duration") as string) || "lifetime";
  const badge = (formData.get("badge") as string) || null;
  const rawCoverUrl = (formData.get("coverUrl") as string) || (formData.get("imageUrl") as string) || null;
  const rawBannerUrl = (formData.get("bannerUrl") as string) || null;

  let coverUrl: string | null = null;
  let bannerUrl: string | null = null;
  try {
    coverUrl = await processImageUrl(rawCoverUrl, store.id, seller.id, "products", "cover");
    bannerUrl = await processImageUrl(rawBannerUrl, store.id, seller.id, "products", "banner");
  } catch (imgErr: any) {
    console.error("[createProductAction] Erro no upload de imagem:", imgErr);
    return {
      success: false,
      error: imgErr?.message || "Falha no upload ou armazenamento da imagem do produto.",
    };
  }

  const showViews = formData.get("showViews") === "on" || formData.get("showViews") === "true" || formData.get("showViews") === "1";
  const viewsCountStr = formData.get("viewsCount") as string;
  const viewsCount = viewsCountStr ? parseInt(viewsCountStr, 10) : 0;
  const showFire = formData.get("showFire") === "on" || formData.get("showFire") === "true" || formData.get("showFire") === "1";
  const fireCountStr = formData.get("fireCount") as string;
  const fireCount = fireCountStr ? parseInt(fireCountStr, 10) : 0;

  let createdProduct: any;
  try {
    const [inserted] = await db
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
    createdProduct = inserted;
  } catch (dbErr: any) {
    console.error("[createProductAction] Erro ao gravar produto no Neon:", dbErr);
    if (dbErr?.code === "23505") {
      return { success: false, error: "Já existe um produto com identificador conflitante. Tente novamente." };
    }
    return { success: false, error: "Erro ao gravar produto no banco de dados. Tente novamente." };
  }

  if (deliveryType === "product_video" && Array.isArray(videoIds) && videoIds.length > 0) {
    try {
      await ProductVideoService.assignVideosToProduct(store.id, createdProduct.id, videoIds, seller.id);
    } catch (err: any) {
      console.warn("[createProductAction] Video assignment warning:", err.message);
    }
  }

  if (selectedCarouselIds.length > 0) {
    try {
      const recordsToInsert = selectedCarouselIds.map((cId, idx) => ({
        carouselId: cId,
        productId: createdProduct.id,
        position: idx,
      }));
      await db.insert(carouselProducts).values(recordsToInsert);
    } catch (carouselErr: any) {
      console.error("[createProductAction] Erro ao associar carrosséis:", carouselErr);
    }
  }

  try {
    revalidatePath("/seller/products");
    revalidatePath("/seller/carousels");
    revalidatePath("/miniapp/[slug]", "layout");
  } catch (revalErr) {
    console.warn("[createProductAction] Revalidation notice:", revalErr);
  }

  return { success: true, product: { id: createdProduct.id, title: createdProduct.title } };
}

export async function updateProductAction(productId: string, formData: FormData): Promise<UpdateProductActionResult> {
  let seller;
  let store;
  try {
    seller = await requireSeller();
    store = await getCurrentStore();
  } catch {
    return { success: false, error: "Sessão expirada ou não autenticada. Faça login novamente." };
  }

  if (!store) {
    return { success: false, error: "Loja não encontrada." };
  }

  const title = (formData.get("title") as string)?.trim();
  if (!title) {
    return { success: false, error: "O título do produto é obrigatório." };
  }

  const priceStr = formData.get("price") as string;
  const price = parseFloat(priceStr);
  if (isNaN(price) || price < 0) {
    return { success: false, error: "Informe um preço válido maior ou igual a zero." };
  }

  const deliveryType = (formData.get("deliveryType") as string) || "telegram";
  const deliveryValue = (formData.get("deliveryValue") as string)?.trim() || null;

  if (deliveryType !== "product_video" && !deliveryValue) {
    return {
      success: false,
      error: deliveryType === "telegram"
        ? "Informe o ID do Grupo/Canal do Telegram (Ex: -1001234567890)."
        : "Informe o Link externo para entrega após o pagamento.",
    };
  }

  if (deliveryType === "product_video") {
    const videoIdsRaw = (formData.get("videoIds") as string) || (formData.get("selectedVideoIds") as string);
    if (videoIdsRaw) {
      try {
        const videoIds = JSON.parse(videoIdsRaw);
        if (Array.isArray(videoIds) && videoIds.length > 0) {
          await ProductVideoService.assignVideosToProduct(store.id, productId, videoIds, seller.id);
        }
      } catch (err: any) {
        console.error("[updateProductAction] Erro ao vincular vídeos:", err);
        return { success: false, error: err?.message || "Erro ao vincular vídeos ao produto." };
      }
    }

    try {
      const assignedVideos = await ProductVideoService.listProductVideos(store.id, productId);
      if (!assignedVideos || assignedVideos.length === 0) {
        return { success: false, error: "Produtos do tipo Vídeo exigem pelo menos um vídeo com status PRONTO associado." };
      }

      for (const v of assignedVideos) {
        if (v.status !== "READY") {
          return {
            success: false,
            error: `O vídeo "${v.title}" ainda não está pronto para entrega (status: ${v.status}).`,
          };
        }
      }
    } catch (vidErr: any) {
      console.error("[updateProductAction] Erro ao listar vídeos:", vidErr);
      return { success: false, error: "Erro ao consultar vídeos vinculados ao produto." };
    }
  }

  const botId = (formData.get("botId") as string) || null;
  if (botId) {
    try {
      const { telegramBots } = await import("@/db/schema");
      const botRecord = await db.query.telegramBots.findFirst({
        where: and(eq(telegramBots.id, botId), eq(telegramBots.storeId, store.id))
      });
      if (!botRecord) {
        return { success: false, error: "O bot selecionado não pertence a esta loja." };
      }
    } catch (botErr: any) {
      console.error("[updateProductAction] Erro ao validar bot:", botErr);
      return { success: false, error: "Erro ao consultar dados do bot selecionado." };
    }
  }

  // Validate Telegram Chat & Bot Permissions on Product Update
  if ((deliveryType === "telegram" || deliveryType === "TELEGRAM_CHAT") && deliveryValue) {
    if (!deliveryValue.startsWith("http://") && !deliveryValue.startsWith("https://")) {
      try {
        const { validateProductTelegramChat } = await import("@/lib/telegram/product-chat-validator");
        const validation = await validateProductTelegramChat(store.id, deliveryValue, botId);
        if (!validation.success) {
          return {
            success: false,
            error: validation.error || "Falha ao validar grupo/canal no Telegram.",
          };
        }
      } catch (chatValErr: any) {
        console.error("[updateProductAction] Erro na validação Telegram:", chatValErr);
        return {
          success: false,
          error: chatValErr?.message || "Erro ao conectar com o Telegram para validar o grupo/canal.",
        };
      }
    }
  }

  // Pre-validate Carousel associations BEFORE updating product
  const hasCarouselSelection = formData.has("carouselIds") || formData.has("carouselIds_initialized");
  let selectedCarouselIds: string[] = [];
  if (hasCarouselSelection) {
    const rawCarouselIds = (formData.get("carouselIds") as string) || null;

    if (rawCarouselIds) {
      try {
        const parsed = JSON.parse(rawCarouselIds);
        if (Array.isArray(parsed)) {
          selectedCarouselIds = parsed.filter((id) => typeof id === "string" && id.trim().length > 0);
        } else if (typeof parsed === "string" && parsed.trim().length > 0) {
          selectedCarouselIds = [parsed.trim()];
        }
      } catch {
        selectedCarouselIds = formData.getAll("carouselIds").map(String).filter((id) => id.trim().length > 0);
      }
    } else {
      selectedCarouselIds = formData.getAll("carouselIds").map(String).filter((id) => id.trim().length > 0);
    }

    selectedCarouselIds = Array.from(new Set(selectedCarouselIds));

    // Multi-tenant check: all selected carousels must belong to this store and must NOT be ranking
    if (selectedCarouselIds.length > 0) {
      try {
        const validCarousels = await db.query.productCarousels.findMany({
          where: and(
            eq(productCarousels.storeId, store.id),
            eq(productCarousels.isRanking, false),
            inArray(productCarousels.id, selectedCarouselIds)
          ),
          columns: { id: true },
        });

        if (validCarousels.length !== selectedCarouselIds.length) {
          return {
            success: false,
            error: "Um ou mais carrosséis selecionados são inválidos ou não pertencem a esta loja.",
          };
        }
      } catch (carErr: any) {
        console.error("[updateProductAction] Erro ao validar carrosséis:", carErr);
        return { success: false, error: "Erro ao consultar carrosséis da loja." };
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
  const status = (formData.get("status") as string) || "active";
  const duration = (formData.get("duration") as string) || "lifetime";
  const badge = (formData.get("badge") as string) || null;
  const rawCoverUrl = (formData.get("coverUrl") as string) || (formData.get("imageUrl") as string) || null;
  const rawBannerUrl = (formData.get("bannerUrl") as string) || null;

  let coverUrl: string | null = null;
  let bannerUrl: string | null = null;
  try {
    coverUrl = await processImageUrl(rawCoverUrl, store.id, seller.id, "products", "cover");
    bannerUrl = await processImageUrl(rawBannerUrl, store.id, seller.id, "products", "banner");
  } catch (imgErr: any) {
    console.error("[updateProductAction] Erro no processamento de imagens:", imgErr);
    return {
      success: false,
      error: imgErr?.message || "Falha no upload ou armazenamento da imagem do produto.",
    };
  }

  const showViews = formData.get("showViews") === "on" || formData.get("showViews") === "true" || formData.get("showViews") === "1";
  const viewsCountStr = formData.get("viewsCount") as string;
  const viewsCount = viewsCountStr ? parseInt(viewsCountStr, 10) : 0;
  const showFire = formData.get("showFire") === "on" || formData.get("showFire") === "true" || formData.get("showFire") === "1";
  const fireCountStr = formData.get("fireCount") as string;
  const fireCount = fireCountStr ? parseInt(fireCountStr, 10) : 0;

  let existing: any = null;
  try {
    existing = await db.query.products.findFirst({
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
  } catch (updateErr: any) {
    console.error("[updateProductAction] Erro ao atualizar produto no banco:", updateErr);
    return { success: false, error: "Erro ao atualizar produto no banco de dados. Tente novamente." };
  }

  // Media Replacement Cleanup
  if (existing) {
    try {
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
    } catch (mediaErr) {
      console.warn("[updateProductAction] Erro não crítico no ciclo de vida de mídia:", mediaErr);
    }
  }

  // Handle Carousel associations sync
  if (hasCarouselSelection) {
    try {
      // Retrieve all custom carousels of this store
      const storeCustomCarousels = await db.query.productCarousels.findMany({
        where: and(
          eq(productCarousels.storeId, store.id),
          eq(productCarousels.isRanking, false)
        ),
        columns: { id: true },
      });
      const customCarouselIds = storeCustomCarousels.map((c) => c.id);

      // Delete existing custom carousel associations for this product (Top 15 ranking is strictly preserved!)
      if (customCarouselIds.length > 0) {
        await db.delete(carouselProducts).where(
          and(
            eq(carouselProducts.productId, productId),
            inArray(carouselProducts.carouselId, customCarouselIds)
          )
        );
      }

      // Insert new custom carousel associations
      if (selectedCarouselIds.length > 0) {
        const recordsToInsert = selectedCarouselIds.map((cId, idx) => ({
          carouselId: cId,
          productId,
          position: idx,
        }));
        await db.insert(carouselProducts).values(recordsToInsert);
      }
    } catch (carouselErr: any) {
      console.error("[updateProductAction] Erro ao sincronizar carrosséis:", carouselErr);
    }
  }

  try {
    revalidatePath("/seller/products");
    revalidatePath("/seller/carousels");
    revalidatePath("/miniapp/[slug]", "layout");
  } catch (revalErr) {
    console.warn("[updateProductAction] Revalidation notice:", revalErr);
  }

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
  revalidatePath("/seller/carousels");
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
    if (!bot) {
      return {
        success: false,
        error: "O bot selecionado não foi encontrado ou não pertence a esta loja."
      };
    }
  } else {
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
    if (!targetBot) {
      return [];
    }
  } else {
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
    if (!targetBot) {
      throw new Error("O bot selecionado não foi encontrado ou não pertence a esta loja.");
    }
  } else {
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

