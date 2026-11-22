"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { plaqueRedemptions } from "@/db/schema";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { isOwnerAccount } from "@/lib/auth/owner-access";
import { getPlaque } from "@/lib/rewards/plaques";
import { getStorePaidRevenue, isMissingRedemptionsTable } from "@/lib/rewards/service";
import { validateRedemptionForm } from "@/lib/rewards/validate";

export type RedemptionResult = { ok: true } | { ok: false; error: string };

/** Pedido de resgate da placa física. Só a conta proprietária enquanto a área não é liberada. */
export async function requestPlaqueRedemption(plaqueValue: number, fd: FormData): Promise<RedemptionResult> {
  const seller = await requireSeller();
  if (!isOwnerAccount(seller)) return { ok: false, error: "Área de premiações ainda não disponível." };

  const store = await getCurrentStore();
  if (!store) return { ok: false, error: "Loja não encontrada." };

  const plaque = getPlaque(Number(plaqueValue));
  if (!plaque) return { ok: false, error: "Placa inválida." };

  const revenue = await getStorePaidRevenue(store.id);
  if (revenue < plaque.value) return { ok: false, error: "Esta placa ainda não foi conquistada." };

  const parsed = validateRedemptionForm(fd);
  if (!parsed.ok) return parsed;

  try {
    const existing = await db.query.plaqueRedemptions.findFirst({
      where: and(
        eq(plaqueRedemptions.storeId, store.id),
        eq(plaqueRedemptions.plaqueValue, plaque.value),
        ne(plaqueRedemptions.status, "CANCELED"),
      ),
    });
    if (existing) return { ok: false, error: "Você já pediu esta placa. Acompanhe o status na página." };

    await db.insert(plaqueRedemptions).values({
      storeId: store.id,
      userId: seller.id,
      plaqueValue: plaque.value,
      revenueAtRequest: revenue.toFixed(2),
      ...parsed.data,
    });
  } catch (err) {
    if (isMissingRedemptionsTable(err)) {
      return { ok: false, error: "O resgate ainda não está ativo (falta rodar a migração 0027)." };
    }
    console.error("[requestPlaqueRedemption]", err);
    return { ok: false, error: "Não foi possível registrar o pedido. Tente novamente." };
  }

  revalidatePath("/seller/premiacoes");
  revalidatePath("/admin/premiacoes");
  return { ok: true };
}
