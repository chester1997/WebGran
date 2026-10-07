import { NextRequest, NextResponse } from "next/server";
import { getMiniAppSession, resolveMiniAppCustomerSession } from "@/lib/telegram/session";
import { AccessLifecycleService } from "@/lib/orders/access-lifecycle-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const accessId = body.accessId;
    const storeSlug = body.storeSlug;

    if (!accessId || !storeSlug) {
      return NextResponse.json({ success: false, error: "Parâmetros inválidos." }, { status: 400 });
    }

    const session = (await resolveMiniAppCustomerSession(req)) || (await getMiniAppSession());
    if (!session || !session.telegramId) {
      return NextResponse.json({ success: false, error: "Sessão Telegram não autenticada." }, { status: 401 });
    }

    const resolution = await AccessLifecycleService.resolveAccessDestination(accessId, storeSlug, session.telegramId);

    if (!resolution.success) {
      if (resolution.error?.includes("não autorizado")) {
        return NextResponse.json(resolution, { status: 403 });
      }
      return NextResponse.json(resolution, { status: 400 });
    }

    return NextResponse.json(resolution);
  } catch (error: any) {
    console.error("[openAccess API] Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Erro ao resolver acesso." }, { status: 500 });
  }
}

