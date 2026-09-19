import { NextRequest, NextResponse } from "next/server";
import { AccessLifecycleService } from "@/lib/orders/access-lifecycle-service";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const accessId = url.searchParams.get("accessId");
    const storeSlugParam = url.searchParams.get("storeSlug") || undefined;

    if (!accessId) {
      return NextResponse.json({ success: false, error: "Parâmetro accessId é obrigatório." }, { status: 400 });
    }

    const resolution = await AccessLifecycleService.resolveAccessDestination(accessId, storeSlugParam);

    if (resolution.destinationUrl) {
      return NextResponse.redirect(resolution.destinationUrl, { status: 302 });
    }

    // Fallback URL if expired or error
    let rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.webgran.online");
    if (!rawAppUrl.startsWith("http")) rawAppUrl = `https://${rawAppUrl}`;
    const appUrl = rawAppUrl.replace(/\/+$/, "");

    if (resolution.status === 'EXPIRED' && resolution.productSlug && storeSlugParam) {
      return NextResponse.redirect(`${appUrl}/miniapp/${storeSlugParam}/product/${resolution.productSlug}`, { status: 302 });
    }

    if (storeSlugParam) {
      return NextResponse.redirect(`${appUrl}/miniapp/${storeSlugParam}/accesses`, { status: 302 });
    }

    return NextResponse.json({ success: false, error: resolution.error || resolution.message || "Acesso indisponível." }, { status: 400 });
  } catch (error: any) {
    console.error("[accessRedirect API] Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Erro ao redirecionar acesso." }, { status: 500 });
  }
}
