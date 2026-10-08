import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ProductManualDeepLinkService } from "@/lib/products/manual-deep-link-service";
import { db } from "@/db";
import { telegramBots } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    if (!ProductManualDeepLinkService.isAuthorized(user.role)) {
      return NextResponse.json(
        { error: "Acesso negado. A geração manual de Deep Link é exclusiva para SUPER_ADMIN." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { productId, botId } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId é obrigatório." }, { status: 400 });
    }

    let botUsername = body.botUsername;
    if (!botUsername && botId) {
      const bot = await db.query.telegramBots.findFirst({
        where: eq(telegramBots.id, botId),
      });
      botUsername = bot?.username;
    }

    const result = ProductManualDeepLinkService.generateDeepLink({
      productId,
      botUsername,
      shortName: "shorts",
      userRole: user.role,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json({ deepLink: result.url });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
