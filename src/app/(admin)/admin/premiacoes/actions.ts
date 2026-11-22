"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { plaqueRedemptions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { REDEMPTION_STATUSES, type RedemptionStatus } from "@/lib/rewards/plaques";

export async function updatePlaqueRedemption(
  id: string,
  status: RedemptionStatus,
  trackingCode: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  if (!REDEMPTION_STATUSES.includes(status)) return { ok: false, error: "Status inválido." };

  try {
    await db
      .update(plaqueRedemptions)
      .set({ status, trackingCode: trackingCode.trim().slice(0, 120) || null, updatedAt: new Date() })
      .where(eq(plaqueRedemptions.id, id));
  } catch (err) {
    console.error("[updatePlaqueRedemption]", err);
    return { ok: false, error: "Não foi possível salvar." };
  }

  revalidatePath("/admin/premiacoes");
  revalidatePath("/seller/premiacoes");
  return { ok: true };
}
