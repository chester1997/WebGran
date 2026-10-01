"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { coupons } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hasFeature, checkLimit } from "@/lib/entitlements/entitlement-service";

export async function getCouponsAction() {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) {
    throw new Error("Loja não encontrada");
  }

  const list = await db
    .select()
    .from(coupons)
    .where(eq(coupons.storeId, store.id))
    .orderBy(desc(coupons.createdAt));

  return list;
}

export async function createCouponAction(data: {
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderValue?: number;
  maxUses?: number | null;
  expiresAt?: string | null;
}) {
  const seller = await requireSeller();
  const store = await getCurrentStore();
  if (!store) {
    throw new Error("Loja não encontrada");
  }

  const couponsAllowed = await hasFeature(seller.id, "coupons_enabled");
  if (!couponsAllowed) {
    throw new Error("A criação de cupons não está disponível no seu plano. Faça upgrade.");
  }

  const activeCoupons = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.storeId, store.id), eq(coupons.status, "active")));

  const limitCheck = await checkLimit(seller.id, "max_coupons", activeCoupons.length);
  if (!limitCheck.allowed) {
    throw new Error(`Limite de cupons ativos atingido (${limitCheck.limit}). Faça upgrade do seu plano para criar mais cupons.`);
  }

  const cleanCode = data.code.trim().toUpperCase();
  if (!cleanCode) {
    throw new Error("O código do cupom é obrigatório");
  }

  if (isNaN(data.discountValue) || data.discountValue <= 0) {
    throw new Error("O valor do desconto deve ser maior que zero");
  }

  if (data.discountType === "percentage" && data.discountValue > 100) {
    throw new Error("Desconto percentual não pode exceder 100%");
  }

  // Check unique code for store
  const existing = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.storeId, store.id), eq(coupons.code, cleanCode)));

  if (existing.length > 0) {
    throw new Error("Já existe um cupom com este código na sua loja");
  }

  await db.insert(coupons).values({
    storeId: store.id,
    code: cleanCode,
    discountType: data.discountType,
    discountValue: data.discountValue.toString(),
    minOrderValue: (data.minOrderValue || 0).toString(),
    maxUses: data.maxUses && data.maxUses > 0 ? data.maxUses : null,
    usedCount: 0,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    status: "active",
  });

  revalidatePath("/seller/coupons");
  return { success: true };
}

export async function toggleCouponStatusAction(couponId: string, currentStatus: string) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) {
    throw new Error("Loja não encontrada");
  }

  const nextStatus = currentStatus === "active" ? "inactive" : "active";

  await db
    .update(coupons)
    .set({
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(and(eq(coupons.id, couponId), eq(coupons.storeId, store.id)));

  revalidatePath("/seller/coupons");
  return { success: true };
}

export async function deleteCouponAction(couponId: string) {
  await requireSeller();
  const store = await getCurrentStore();
  if (!store) {
    throw new Error("Loja não encontrada");
  }

  await db
    .delete(coupons)
    .where(and(eq(coupons.id, couponId), eq(coupons.storeId, store.id)));

  revalidatePath("/seller/coupons");
  return { success: true };
}
