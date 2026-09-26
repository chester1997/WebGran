import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { db } from "@/db";
import { stores, storeFloatingNotifications } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getStoreBySlug } from "@/lib/store-cache";

export async function GET(req: NextRequest) {
  await connection();
  try {
    const searchParams = req.nextUrl.searchParams;
    const storeSlug = searchParams.get("storeSlug");
    const storeId = searchParams.get("storeId");

    if (!storeSlug && !storeId) {
      return NextResponse.json({ success: false, error: "storeSlug or storeId required" }, { status: 400 });
    }

    let store = null;
    if (storeSlug) {
      store = await getStoreBySlug(storeSlug);
    } else if (storeId) {
      store = await db.query.stores.findFirst({
        where: eq(stores.id, storeId),
      });
    }

    if (!store) {
      return NextResponse.json({ success: false, error: "Store not found" }, { status: 404 });
    }

    if (!store.floatingNotificationsEnabled) {
      return NextResponse.json({
        success: true,
        enabled: false,
        pages: [],
        displayDuration: 5,
        intervalMin: 15,
        intervalMax: 30,
        notifications: [],
      });
    }

    const items = await db.query.storeFloatingNotifications.findMany({
      where: and(
        eq(storeFloatingNotifications.storeId, store.id),
        eq(storeFloatingNotifications.enabled, true)
      ),
      orderBy: [asc(storeFloatingNotifications.position)],
      with: {
        product: {
          columns: {
            id: true,
            title: true,
            slug: true,
            coverUrl: true,
          },
        },
      },
    });

    const pages = Array.isArray(store.floatingNotificationsPages)
      ? (store.floatingNotificationsPages as string[])
      : ["home", "product", "category", "search"];

    return NextResponse.json({
      success: true,
      enabled: store.floatingNotificationsEnabled,
      pages,
      displayDuration: store.floatingNotificationsDisplayDuration || 5,
      intervalMin: store.floatingNotificationsIntervalMin || 15,
      intervalMax: store.floatingNotificationsIntervalMax || 30,
      notifications: items.map((i) => ({
        id: i.id,
        text: i.text,
        icon: i.icon,
        countMin: i.countMin,
        countMax: i.countMax,
        productId: i.productId,
        productTitle: i.product?.title || null,
        productSlug: i.product?.slug || null,
        productCoverUrl: i.product?.coverUrl || null,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching floating notifications:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal error" },
      { status: 500 }
    );
  }
}
