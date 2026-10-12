import { NextRequest, NextResponse } from "next/server";
import { getCurrentStore } from "@/lib/auth";
import { validateProductTelegramChat } from "@/lib/telegram/product-chat-validator";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deliveryValue, botId } = body;

    const currentStore = await getCurrentStore();
    if (!currentStore) {
      return NextResponse.json(
        { success: false, error: "Loja não encontrada ou usuário não autenticado." },
        { status: 401 }
      );
    }
    const targetStoreId = currentStore.id;

    const validation = await validateProductTelegramChat(targetStoreId, deliveryValue, botId || null);

    return NextResponse.json(validation);
  } catch (error: any) {
    console.error("[validate-chat API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro interno do servidor." },
      { status: 500 }
    );
  }
}
