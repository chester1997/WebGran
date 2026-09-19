import { NextRequest, NextResponse } from "next/server";
import { getMiniAppSession } from "@/lib/telegram/session";
import { AccessLifecycleService } from "@/lib/orders/access-lifecycle-service";

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

    const resolution = await AccessLifecycleService.resolveAccessContent(accessId, storeSlug);

    return NextResponse.json(resolution);
  } catch (error: any) {
    console.error("[openAccess API] Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Erro ao resolver acesso." }, { status: 500 });
  }
}
