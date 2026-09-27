import { NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { ClipService } from "@/lib/clips/service";
import { db } from "@/db";
import { clips } from "@/db/schema";
import { eq, count } from "drizzle-orm";

export async function GET() {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    const storeClips = await ClipService.listStoreClips(store.id);

    // Calculate Summary Stats from Neon
    const total = storeClips.length;
    let published = 0;
    let processing = 0;
    let failed = 0;

    storeClips.forEach((c) => {
      if (c.status === "READY") published++;
      else if (c.status === "FAILED") failed++;
      else processing++; // UPLOADING or PROCESSING
    });

    return NextResponse.json({
      success: true,
      clips: storeClips,
      stats: {
        total,
        published,
        processing,
        failed,
      },
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized" || error?.digest === "HANGING_PROMISE_REJECTION") {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }
    console.error("[Seller Clips GET Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao carregar clips." },
      { status: 500 }
    );
  }
}
