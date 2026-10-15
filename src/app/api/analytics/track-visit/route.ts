import { NextRequest, NextResponse } from "next/server";
import { StoreTrackingService } from "@/lib/analytics/store-tracking-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let {
      sessionId,
      storeId,
      storeSlug,
      entryPath,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      startParam,
      telegramUserId,
      deviceType,
    } = body;

    if (!sessionId || (!storeId && !storeSlug)) {
      return NextResponse.json(
        { error: "sessionId and either storeId or storeSlug are required" },
        { status: 400 }
      );
    }

    if (!storeId && storeSlug) {
      const { db } = await import("@/db");
      const { stores } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      const [foundStore] = await db
        .select({ id: stores.id })
        .from(stores)
        .where(eq(stores.slug, storeSlug))
        .limit(1);

      if (!foundStore) {
        return NextResponse.json({ error: "Store not found" }, { status: 404 });
      }
      storeId = foundStore.id;
    }

    const result = await StoreTrackingService.recordSessionVisit({
      sessionId,
      storeId,
      entryPath,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      startParam,
      telegramUserId,
      deviceType,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[TrackVisitAPI] Error:", err?.message);
    return NextResponse.json(
      { error: "Internal tracking error" },
      { status: 500 }
    );
  }
}
