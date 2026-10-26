"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { combos, comboProducts, products, comboTiers, orderItems } from "@/db/schema";
import { eq, and, inArray, desc, asc, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getStorageProvider, generateMultiTenantStoragePath } from "@/lib/storage/provider";
import { StorageUsageService } from "@/lib/storage/storage-usage-service";

export type ComboType = "curated" | "progressive";
export type EligibilityMode = "all_products" | "specific_products";

export interface ComboProductSummary {
  id: string;
  title: string;
  price: string;
  coverUrl: string | null;
  status: string;
  position: number;
}

export interface ComboTierDTO {
  id?: string;
  minQuantity: number;
  price: string;
  position: number;
}

export interface ComboItem {
  id: string;
  storeId: string;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  price: string;
  type: ComboType;
  eligibilityMode: EligibilityMode;
  status: string;
  position: number;
  normalPrice: number;
  savings: number;
  savingsPercentage: number;
  products: ComboProductSummary[];
  tiers?: ComboTierDTO[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TierInput {
  minQuantity: number;
  price: number;
}

export interface CreateComboInput {
  title: string;
  slug?: string;
  description?: string | null;
  coverUrl?: string | null;
  price?: number;
  type?: "curated" | "progressive";
  eligibilityMode?: "all_products" | "specific_products";
  productIds?: string[];
  tiers?: TierInput[];
  status?: "active" | "inactive";
  position?: number;
}

export interface UpdateComboInput {
  title?: string;
  slug?: string;
  description?: string | null;
  coverUrl?: string | null;
  price?: number;
  type?: "curated" | "progressive";
  eligibilityMode?: "all_products" | "specific_products";
  productIds?: string[];
  tiers?: TierInput[];
  status?: "active" | "inactive";
  position?: number;
}

async function processImageUrl(
  rawUrl: string | null,
  storeId: string,
  sellerId: string,
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

    const storagePath = generateMultiTenantStoragePath(storeId, "products", `${prefix}-${Date.now()}.webp`);
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
      throw new Error(`Upload de imagem do combo falhou: ${err?.message || "Erro no storage"}`);
    }
  }
  return trimmed;
}

function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/**
 * Lists all active and inactive combos for the authenticated seller's store.
 */
export async function getCombosAction(): Promise<ComboItem[]> {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) {
    throw new Error("Loja não encontrada.");
  }

  const storeCombos = await db.query.combos.findMany({
    where: and(eq(combos.storeId, store.id), ne(combos.status, "archived")),
    orderBy: [asc(combos.position), desc(combos.createdAt)],
    with: {
      products: {
        with: {
          product: true,
        },
        orderBy: [asc(comboProducts.position)],
      },
      tiers: {
        orderBy: [asc(comboTiers.minQuantity)],
      },
    },
  });

  return storeCombos.map((combo) => {
    const componentProducts: ComboProductSummary[] = (combo.products || [])
      .filter((cp) => Boolean(cp.product))
      .map((cp) => ({
        id: cp.product.id,
        title: cp.product.title,
        price: cp.product.price,
        coverUrl: cp.product.coverUrl,
        status: cp.product.status,
        position: cp.position,
      }));

    const mappedTiers: ComboTierDTO[] = (combo.tiers || []).map((t) => ({
      id: t.id,
      minQuantity: t.minQuantity,
      price: t.price,
      position: t.position,
    }));

    const normalPrice = componentProducts.reduce(
      (sum, p) => sum + parseFloat(p.price || "0"),
      0
    );
    const promoPrice = parseFloat(combo.price || "0");
    const savings = Math.max(0, normalPrice - promoPrice);
    const savingsPercentage = normalPrice > 0 ? Math.round((savings / normalPrice) * 100) : 0;

    return {
      id: combo.id,
      storeId: combo.storeId,
      title: combo.title,
      slug: combo.slug,
      description: combo.description,
      coverUrl: combo.coverUrl,
      price: combo.price,
      type: (combo.type as "curated" | "progressive") || "curated",
      eligibilityMode: (combo.eligibilityMode as "all_products" | "specific_products") || "all_products",
      status: combo.status,
      position: combo.position,
      normalPrice,
      savings,
      savingsPercentage,
      products: componentProducts,
      tiers: mappedTiers,
      createdAt: combo.createdAt,
      updatedAt: combo.updatedAt,
    };
  });
}

/**
 * Lists all active products of the store to populate the combo product selector.
 */
export async function getStoreActiveProductsAction() {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) {
    throw new Error("Loja não encontrada.");
  }

  return await db.query.products.findMany({
    where: and(eq(products.storeId, store.id), eq(products.status, "active")),
    orderBy: [desc(products.createdAt)],
    columns: {
      id: true,
      title: true,
      price: true,
      coverUrl: true,
      status: true,
    },
  });
}

/**
 * Creates a new combo or progressive offer.
 */
export async function createComboAction(input: CreateComboInput) {
  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) {
    throw new Error("Loja não encontrada.");
  }

  // 1. Title validation
  const title = input.title?.trim();
  if (!title) {
    throw new Error("O nome da promoção/combo é obrigatório.");
  }

  // 2. Slug generation & uniqueness
  let cleanSlug = input.slug ? sanitizeSlug(input.slug) : sanitizeSlug(title);
  if (!cleanSlug) {
    cleanSlug = `combo-${Date.now().toString().slice(-4)}`;
  }

  const existingWithSlug = await db.query.combos.findFirst({
    where: and(eq(combos.storeId, store.id), eq(combos.slug, cleanSlug)),
  });

  if (existingWithSlug) {
    if (input.slug && input.slug.trim()) {
      throw new Error("Já existe uma promoção com este slug na sua loja.");
    }
    cleanSlug = `${cleanSlug}-${Date.now().toString().slice(-4)}`;
  }

  const isProgressive = input.type === "progressive";
  const eligibilityMode = input.eligibilityMode || (isProgressive ? "all_products" : "specific_products");

  if (isProgressive) {
    // 3. Progressive tiers validation
    if (!Array.isArray(input.tiers) || input.tiers.length === 0) {
      throw new Error("A oferta progressiva deve conter pelo menos uma faixa de desconto configurada.");
    }

    const seenQuantities = new Set<number>();
    for (const t of input.tiers) {
      const q = Number(t.minQuantity);
      const p = Number(t.price);
      if (isNaN(q) || !Number.isInteger(q) || q < 2) {
        throw new Error(`Quantidade mínima da faixa inválida (${t.minQuantity}). Deve ser um número inteiro maior ou igual a 2.`);
      }
      if (isNaN(p) || p <= 0) {
        throw new Error(`Preço da faixa inválido (R$ ${t.price}). Deve ser um valor maior que zero.`);
      }
      if (seenQuantities.has(q)) {
        throw new Error(`Quantidade duplicada encontrada nas faixas: ${q} unidades já configurada.`);
      }
      seenQuantities.add(q);
    }

    const sortedTiers = [...input.tiers].sort((a, b) => a.minQuantity - b.minQuantity);

    // 4. Products validation for specific_products mode
    let uniqueProductIds: string[] = [];
    if (eligibilityMode === "specific_products") {
      if (!Array.isArray(input.productIds) || input.productIds.filter(Boolean).length === 0) {
        throw new Error("No modo de produtos específicos, selecione pelo menos um produto participante.");
      }
      uniqueProductIds = Array.from(new Set(input.productIds.filter(Boolean)));
      const dbProducts = await db.query.products.findMany({
        where: and(inArray(products.id, uniqueProductIds), eq(products.storeId, store.id)),
      });
      if (dbProducts.length !== uniqueProductIds.length) {
        throw new Error("Um ou mais produtos selecionados não pertencem a esta loja.");
      }
      const inactive = dbProducts.find((p) => p.status !== "active");
      if (inactive) {
        throw new Error(`O produto "${inactive.title}" está inativo.`);
      }
    }

    const basePrice = sortedTiers[0].price;
    const coverUrl = await processImageUrl(input.coverUrl || null, store.id, seller.id, "combo-cover");

    const newCombo = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(combos)
        .values({
          storeId: store.id,
          title,
          slug: cleanSlug,
          description: input.description?.trim() || null,
          coverUrl,
          price: basePrice.toFixed(2),
          type: "progressive",
          eligibilityMode,
          status: input.status === "inactive" ? "inactive" : "active",
          position: input.position || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (eligibilityMode === "specific_products" && uniqueProductIds.length > 0) {
        const comboProductsToInsert = uniqueProductIds.map((productId, index) => ({
          comboId: inserted.id,
          productId,
          position: index,
          createdAt: new Date(),
        }));
        await tx.insert(comboProducts).values(comboProductsToInsert);
      }

      const comboTiersToInsert = sortedTiers.map((t, index) => ({
        comboId: inserted.id,
        minQuantity: t.minQuantity,
        price: t.price.toFixed(2),
        position: index,
        createdAt: new Date(),
      }));
      await tx.insert(comboTiers).values(comboTiersToInsert);

      return inserted;
    });

    revalidatePath("/seller/combos");
    return { success: true, combo: newCombo };
  }

  // --- TRADITIONAL CURATED COMBO ---
  if (!Array.isArray(input.productIds)) {
    throw new Error("A lista de produtos do combo é obrigatória.");
  }

  const uniqueProductIds = Array.from(new Set(input.productIds.filter(Boolean)));
  if (uniqueProductIds.length < 2) {
    throw new Error("O combo tradicional deve conter pelo menos 2 produtos distintos.");
  }

  const dbProducts = await db.query.products.findMany({
    where: and(inArray(products.id, uniqueProductIds), eq(products.storeId, store.id)),
  });

  if (dbProducts.length !== uniqueProductIds.length) {
    throw new Error("Um ou mais produtos selecionados não pertencem a esta loja ou não existem.");
  }

  const inactiveProduct = dbProducts.find((p) => p.status !== "active");
  if (inactiveProduct) {
    throw new Error(`O produto "${inactiveProduct.title}" não está ativo. Apenas produtos ativos podem ser incluídos no combo.`);
  }

  const price = Number(input.price);
  if (isNaN(price) || price <= 0) {
    throw new Error("Informe um preço promocional válido e maior que zero.");
  }

  const normalPrice = dbProducts.reduce((sum, p) => sum + parseFloat(p.price || "0"), 0);
  if (price >= normalPrice) {
    throw new Error(
      `O preço promocional (R$ ${price.toFixed(2)}) deve ser menor que a soma dos produtos individuais (R$ ${normalPrice.toFixed(2)}).`
    );
  }

  const coverUrl = await processImageUrl(input.coverUrl || null, store.id, seller.id, "combo-cover");

  const newCombo = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(combos)
      .values({
        storeId: store.id,
        title,
        slug: cleanSlug,
        description: input.description?.trim() || null,
        coverUrl,
        price: price.toFixed(2),
        type: "curated",
        eligibilityMode: "specific_products",
        status: input.status === "inactive" ? "inactive" : "active",
        position: input.position || 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const comboProductsToInsert = uniqueProductIds.map((productId, index) => ({
      comboId: inserted.id,
      productId,
      position: index,
      createdAt: new Date(),
    }));

    await tx.insert(comboProducts).values(comboProductsToInsert);
    return inserted;
  });

  revalidatePath("/seller/combos");
  return { success: true, combo: newCombo };
}

/**
 * Updates an existing combo or progressive offer.
 */
export async function updateComboAction(comboId: string, input: UpdateComboInput) {
  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) {
    throw new Error("Loja não encontrada.");
  }

  const existingCombo = await db.query.combos.findFirst({
    where: and(eq(combos.id, comboId), eq(combos.storeId, store.id)),
  });

  if (!existingCombo) {
    throw new Error("Promoção não encontrada ou não pertence a esta loja.");
  }

  const title = input.title !== undefined ? input.title.trim() : existingCombo.title;
  if (!title) {
    throw new Error("O nome da promoção não pode ficar vazio.");
  }

  let cleanSlug = existingCombo.slug;
  if (input.slug !== undefined) {
    cleanSlug = sanitizeSlug(input.slug || title);
    if (!cleanSlug) cleanSlug = existingCombo.slug;

    const conflict = await db.query.combos.findFirst({
      where: and(
        eq(combos.storeId, store.id),
        eq(combos.slug, cleanSlug),
        ne(combos.id, comboId)
      ),
    });
    if (conflict) {
      throw new Error("Já existe outra promoção com este slug na sua loja.");
    }
  }

  const targetType = input.type !== undefined ? input.type : (existingCombo.type as "curated" | "progressive") || "curated";
  const targetEligibilityMode = input.eligibilityMode !== undefined
    ? input.eligibilityMode
    : (existingCombo.eligibilityMode as "all_products" | "specific_products") || "all_products";

  let coverUrl = existingCombo.coverUrl;
  if (input.coverUrl !== undefined) {
    coverUrl = await processImageUrl(input.coverUrl, store.id, seller.id, "combo-cover");
  }

  // --- PROGRESSIVE OFFER UPDATE ---
  if (targetType === "progressive") {
    let sortedTiers: TierInput[] | null = null;
    if (input.tiers !== undefined) {
      if (!Array.isArray(input.tiers) || input.tiers.length === 0) {
        throw new Error("A oferta progressiva deve conter pelo menos uma faixa configurada.");
      }
      const seenQuantities = new Set<number>();
      for (const t of input.tiers) {
        const q = Number(t.minQuantity);
        const p = Number(t.price);
        if (isNaN(q) || !Number.isInteger(q) || q < 2) {
          throw new Error(`Quantidade mínima da faixa inválida (${t.minQuantity}).`);
        }
        if (isNaN(p) || p <= 0) {
          throw new Error(`Preço da faixa inválido (R$ ${t.price}).`);
        }
        if (seenQuantities.has(q)) {
          throw new Error(`Quantidade duplicada: ${q} unidades já configurada.`);
        }
        seenQuantities.add(q);
      }
      sortedTiers = [...input.tiers].sort((a, b) => a.minQuantity - b.minQuantity);
    }

    let uniqueProductIds: string[] | null = null;
    if (targetEligibilityMode === "specific_products" && input.productIds !== undefined) {
      uniqueProductIds = Array.from(new Set(input.productIds.filter(Boolean)));
      if (uniqueProductIds.length === 0) {
        throw new Error("Selecione pelo menos um produto elegível.");
      }
      const dbProducts = await db.query.products.findMany({
        where: and(inArray(products.id, uniqueProductIds), eq(products.storeId, store.id)),
      });
      if (dbProducts.length !== uniqueProductIds.length) {
        throw new Error("Um ou mais produtos selecionados não pertencem a esta loja.");
      }
    }

    const price = sortedTiers ? sortedTiers[0].price : (input.price !== undefined ? Number(input.price) : parseFloat(existingCombo.price));

    await db.transaction(async (tx) => {
      await tx
        .update(combos)
        .set({
          title,
          slug: cleanSlug,
          description: input.description !== undefined ? input.description?.trim() || null : existingCombo.description,
          coverUrl,
          price: price.toFixed(2),
          type: "progressive",
          eligibilityMode: targetEligibilityMode,
          status: input.status !== undefined ? input.status : existingCombo.status,
          position: input.position !== undefined ? input.position : existingCombo.position,
          updatedAt: new Date(),
        })
        .where(eq(combos.id, comboId));

      if (sortedTiers) {
        await tx.delete(comboTiers).where(eq(comboTiers.comboId, comboId));
        const tiersToInsert = sortedTiers.map((t, index) => ({
          comboId,
          minQuantity: t.minQuantity,
          price: t.price.toFixed(2),
          position: index,
          createdAt: new Date(),
        }));
        await tx.insert(comboTiers).values(tiersToInsert);
      }

      if (targetEligibilityMode === "all_products") {
        await tx.delete(comboProducts).where(eq(comboProducts.comboId, comboId));
      } else if (uniqueProductIds) {
        await tx.delete(comboProducts).where(eq(comboProducts.comboId, comboId));
        const comboProductsToInsert = uniqueProductIds.map((productId, index) => ({
          comboId,
          productId,
          position: index,
          createdAt: new Date(),
        }));
        await tx.insert(comboProducts).values(comboProductsToInsert);
      }
    });

    revalidatePath("/seller/combos");
    return { success: true };
  }

  // --- TRADITIONAL CURATED COMBO UPDATE ---
  let uniqueProductIds: string[] | null = null;
  let dbProducts = null;

  if (input.productIds !== undefined) {
    if (!Array.isArray(input.productIds)) {
      throw new Error("A lista de produtos é obrigatória.");
    }
    uniqueProductIds = Array.from(new Set(input.productIds.filter(Boolean)));
    if (uniqueProductIds.length < 2) {
      throw new Error("O combo deve conter pelo menos 2 produtos distintos.");
    }

    dbProducts = await db.query.products.findMany({
      where: and(inArray(products.id, uniqueProductIds), eq(products.storeId, store.id)),
    });

    if (dbProducts.length !== uniqueProductIds.length) {
      throw new Error("Um ou mais produtos selecionados não pertencem a esta loja ou não existem.");
    }

    const inactiveProduct = dbProducts.find((p) => p.status !== "active");
    if (inactiveProduct) {
      throw new Error(`O produto "${inactiveProduct.title}" não está ativo.`);
    }
  }

  const price = input.price !== undefined ? Number(input.price) : parseFloat(existingCombo.price);
  if (isNaN(price) || price <= 0) {
    throw new Error("Informe um preço promocional válido e maior que zero.");
  }

  if (!dbProducts) {
    const currentComboProducts = await db.query.comboProducts.findMany({
      where: eq(comboProducts.comboId, comboId),
      with: { product: true },
    });
    dbProducts = currentComboProducts.map((cp) => cp.product).filter(Boolean);
  }

  const normalPrice = dbProducts.reduce((sum, p) => sum + parseFloat(p.price || "0"), 0);
  if (price >= normalPrice) {
    throw new Error(
      `O preço promocional (R$ ${price.toFixed(2)}) deve ser menor que a soma dos produtos (R$ ${normalPrice.toFixed(2)}).`
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(combos)
      .set({
        title,
        slug: cleanSlug,
        description: input.description !== undefined ? input.description?.trim() || null : existingCombo.description,
        coverUrl,
        price: price.toFixed(2),
        type: "curated",
        eligibilityMode: "specific_products",
        status: input.status !== undefined ? input.status : existingCombo.status,
        position: input.position !== undefined ? input.position : existingCombo.position,
        updatedAt: new Date(),
      })
      .where(eq(combos.id, comboId));

    if (uniqueProductIds) {
      await tx.delete(comboProducts).where(eq(comboProducts.comboId, comboId));

      const comboProductsToInsert = uniqueProductIds.map((productId, index) => ({
        comboId,
        productId,
        position: index,
        createdAt: new Date(),
      }));

      await tx.insert(comboProducts).values(comboProductsToInsert);
    }
  });

  revalidatePath("/seller/combos");
  return { success: true };
}

/**
 * Toggles a combo between active and inactive.
 */
export async function toggleComboStatusAction(comboId: string) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) {
    throw new Error("Loja não encontrada.");
  }

  const existingCombo = await db.query.combos.findFirst({
    where: and(eq(combos.id, comboId), eq(combos.storeId, store.id)),
  });

  if (!existingCombo) {
    throw new Error("Combo não encontrado ou não pertence a esta loja.");
  }

  const newStatus = existingCombo.status === "active" ? "inactive" : "active";

  await db
    .update(combos)
    .set({
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(combos.id, comboId));

  revalidatePath("/seller/combos");
  return { success: true, status: newStatus };
}

/**
 * Archives a combo (soft delete).
 */
export async function archiveComboAction(comboId: string) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) {
    throw new Error("Loja não encontrada.");
  }

  const existingCombo = await db.query.combos.findFirst({
    where: and(eq(combos.id, comboId), eq(combos.storeId, store.id)),
  });

  if (!existingCombo) {
    throw new Error("Combo não encontrado ou não pertence a esta loja.");
  }

  await db
    .update(combos)
    .set({
      status: "archived",
      updatedAt: new Date(),
    })
    .where(eq(combos.id, comboId));

  revalidatePath("/seller/combos");
  return { success: true };
}

/**
 * Deletes a combo or archives it if referenced in historical orders.
 */
export async function deleteComboAction(comboId: string) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) {
    throw new Error("Loja não encontrada.");
  }

  const existingCombo = await db.query.combos.findFirst({
    where: and(eq(combos.id, comboId), eq(combos.storeId, store.id)),
  });

  if (!existingCombo) {
    throw new Error("Combo não encontrado ou não pertence a esta loja.");
  }

  // Check if combo has any historical orders
  const referencedOrder = await db.query.orderItems.findFirst({
    where: eq(orderItems.comboId, comboId),
  });

  if (referencedOrder) {
    // Preserve financial history by archiving
    await db
      .update(combos)
      .set({
        status: "archived",
        updatedAt: new Date(),
      })
      .where(eq(combos.id, comboId));

    revalidatePath("/seller/combos");
    return {
      success: true,
      action: "archived",
      message: "O combo possui pedidos registrados e foi arquivado para preservar o histórico financeiro.",
    };
  }

  // Otherwise, safe to hard delete
  await db.transaction(async (tx) => {
    await tx.delete(comboProducts).where(eq(comboProducts.comboId, comboId));
    await tx.delete(combos).where(eq(combos.id, comboId));
  });

  revalidatePath("/seller/combos");
  return { success: true, action: "deleted" };
}
