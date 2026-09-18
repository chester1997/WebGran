"use server";

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { AccessDeliveryService } from "@/lib/delivery/access-delivery-service";
import { revalidatePath } from "next/cache";

export async function retryDeliveryAction(accessId: string) {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    throw new Error("Store not found");
  }

  const result = await AccessDeliveryService.retryAccessDelivery(accessId, store.id);
  revalidatePath("/seller/orders");
  return result;
}
