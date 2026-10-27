"use server";

import { cookies } from "next/headers";
import { getMiniAppSession } from "@/lib/telegram/session";
import { CheckoutService, CheckoutItemInput, CheckoutResult } from "@/lib/orders/checkout-service";

export type { CheckoutItemInput, CheckoutResult };

export async function createCheckoutSession(
  storeSlug: string,
  items: CheckoutItemInput[],
  couponCode?: string,
  paymentGateway?: "mercadopago" | "pushinpay" | "syncpay"
): Promise<CheckoutResult> {
  try {
    const session = await getMiniAppSession();
    if (!session?.storeId || !session?.customerId) {
      return { success: false, error: "Sessão não encontrada. Reinicie o Mini App." };
    }

    const cookieStore = await cookies();
    const sessionId =
      cookieStore.get(`wg_sid_${storeSlug}`)?.value ||
      cookieStore.get("wg_session_id")?.value ||
      null;

    return await CheckoutService.createCheckout({
      storeId: session.storeId,
      customerId: session.customerId,
      storeSlug,
      items,
      couponCode,
      paymentGateway,
      sessionId,
    });
  } catch (error: any) {
    console.error("[actions.createCheckoutSession] Unexpected error:", error);
    return { success: false, error: error.message || "Erro interno ao processar pedido" };
  }
}
