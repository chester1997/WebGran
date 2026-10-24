import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { SellerPushService } from "@/lib/push/seller-push-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      return NextResponse.json(
        { error: "Não autenticado." },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            Pragma: "no-cache",
          },
        }
      );
    }

    const role = (user.role || "").toLowerCase();
    if (role !== "seller" && role !== "admin" && role !== "super_admin") {
      return NextResponse.json(
        { error: "Acesso não autorizado." },
        {
          status: 403,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            Pragma: "no-cache",
          },
        }
      );
    }

    const publicKey = SellerPushService.getPublicKey();
    const hasActiveSubscription = await SellerPushService.hasActiveSubscription(user.id);

    return NextResponse.json(
      {
        configured: !!publicKey,
        publicKey,
        hasActiveSubscription,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      }
    );
  } catch (err: any) {
    if (err?.message === "Unauthorized" || err?.digest?.startsWith("NEXT_REDIRECT")) {
      return NextResponse.json(
        { error: "Não autenticado." },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            Pragma: "no-cache",
          },
        }
      );
    }
    console.error("[API Seller Push Status] Erro:", err);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      }
    );
  }
}


