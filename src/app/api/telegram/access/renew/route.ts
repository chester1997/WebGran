import { NextRequest, NextResponse } from "next/server";
import { getMiniAppSession } from "@/lib/telegram/session";
import { db } from "@/db";
import { accesses, stores, telegramBots } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { AccessDeliveryService } from "@/lib/delivery/access-delivery-service";

export async function POST(req: NextRequest) {
  try {
    const { accessId, storeSlug } = await req.json();

    if (!accessId || !storeSlug) {
      return NextResponse.json({ success: false, error: "Parâmetros inválidos." }, { status: 400 });
    }

    const session = await getMiniAppSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Sessão não encontrada." }, { status: 401 });
    }

    const store = await db.query.stores.findFirst({
      where: eq(stores.slug, storeSlug)
    });

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const accessRecord = await db.query.accesses.findFirst({
      where: and(
        eq(accesses.id, accessId),
        eq(accesses.storeId, store.id)
      ),
      with: {
        product: true,
        customer: true,
      }
    });

    if (!accessRecord) {
      return NextResponse.json({ success: false, error: "Registro de acesso não encontrado." }, { status: 404 });
    }

    // Check if access is expired
    const now = new Date();
    if (accessRecord.expiresAt && accessRecord.expiresAt.getTime() <= now.getTime()) {
      return NextResponse.json({ 
        success: false, 
        error: "Este acesso expirou. Por favor, adquira novamente para renovar o conteúdo." 
      }, { status: 403 });
    }

    // Force clear existing inviteLink so AccessDeliveryService generates a fresh invite
    await db.update(accesses).set({
      inviteLink: null,
      updatedAt: new Date()
    }).where(eq(accesses.id, accessRecord.id));

    const bot = await db.query.telegramBots.findFirst({
      where: eq(telegramBots.storeId, store.id)
    });

    const result = await AccessDeliveryService.retryAccessDelivery(accessRecord.id, store.id);

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("[renewAccess API] Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Erro ao renovar link." }, { status: 500 });
  }
}
