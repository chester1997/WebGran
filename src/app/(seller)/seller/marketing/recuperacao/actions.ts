"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStore } from "@/lib/auth";
import { verifyOwnerActionAccess } from "@/lib/bots/owner-guard";
import { saveRecoverySettings, type RecoverySettings } from "@/lib/marketing/sales-recovery";

/** Salva a configuração da Recuperação de vendas (fase de testes: só a conta proprietária). */
export async function saveRecoveryAction(input: RecoverySettings): Promise<{ ok: boolean; error?: string }> {
  const auth = await verifyOwnerActionAccess();
  if (!auth.authorized) return { ok: false, error: auth.error };
  const store = await getCurrentStore();
  if (!store) return { ok: false, error: "Loja não encontrada." };
  try {
    await saveRecoverySettings(store.id, input);
    revalidatePath("/seller/marketing/recuperacao");
    return { ok: true };
  } catch (err) {
    const msg = (err as Error)?.message || "";
    if (/does not exist/i.test(msg)) return { ok: false, error: "Falta rodar a migração 0035 no banco." };
    console.error("[recovery] Falha ao salvar:", msg);
    return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };
  }
}
