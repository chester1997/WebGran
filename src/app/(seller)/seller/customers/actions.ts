"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { telegramCustomers } from "@/db/schema";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { isOwnerAccount } from "@/lib/auth/owner-access";
import { CustomerBlockService, isMissingTableError } from "@/lib/customers/customer-block-service";

type ActionResult = { success: true } | { success: false; error: string };

const TABLE_MISSING =
  "O bloqueio ainda não está ativo no banco de dados. Rode a migration 0023_customer_blocks.sql no Neon e tente de novo.";

/** Garante vendedor dono da conta (Redesign V2) e que o cliente é desta loja. */
async function resolveContext(telegramUserId: string) {
  const seller = await requireSeller();
  if (!isOwnerAccount(seller)) return { error: "Recurso ainda não liberado para esta conta." } as const;

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." } as const;

  const id = String(telegramUserId || "").trim();
  if (!id) return { error: "Cliente inválido." } as const;

  const customer = await db.query.telegramCustomers.findFirst({
    where: and(eq(telegramCustomers.storeId, store.id), eq(telegramCustomers.telegramUserId, id)),
    columns: { id: true },
  });
  if (!customer) return { error: "Cliente não encontrado nesta loja." } as const;

  return { seller, store, telegramUserId: id } as const;
}

export async function blockCustomerAction(telegramUserId: string, reason?: string): Promise<ActionResult> {
  const ctx = await resolveContext(telegramUserId);
  if ("error" in ctx) return { success: false, error: ctx.error as string };
  try {
    await CustomerBlockService.block({
      storeId: ctx.store.id,
      telegramUserId: ctx.telegramUserId,
      reason: reason || null,
      blockedBy: ctx.seller.id,
    });
  } catch (err) {
    if (isMissingTableError(err)) return { success: false, error: TABLE_MISSING };
    console.error("[customers] Falha ao bloquear cliente:", (err as any)?.message);
    return { success: false, error: "Não foi possível bloquear agora. Tente de novo." };
  }
  revalidatePath("/seller/customers");
  return { success: true };
}

export async function unblockCustomerAction(telegramUserId: string): Promise<ActionResult> {
  const ctx = await resolveContext(telegramUserId);
  if ("error" in ctx) return { success: false, error: ctx.error as string };
  try {
    await CustomerBlockService.unblock({ storeId: ctx.store.id, telegramUserId: ctx.telegramUserId });
  } catch (err) {
    if (isMissingTableError(err)) return { success: false, error: TABLE_MISSING };
    console.error("[customers] Falha ao desbloquear cliente:", (err as any)?.message);
    return { success: false, error: "Não foi possível desbloquear agora. Tente de novo." };
  }
  revalidatePath("/seller/customers");
  return { success: true };
}
