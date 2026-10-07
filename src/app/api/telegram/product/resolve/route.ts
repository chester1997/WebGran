import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, stores, accesses, productVideoAssignments, productVideos } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { resolveMiniAppCustomerSession, getMiniAppSession } from "@/lib/telegram/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { productId, storeSlug } = body;

    if (!productId || !storeSlug) {
      return NextResponse.json({ success: false, error: "Parâmetros inválidos." }, { status: 400 });
    }

    const store = await db.query.stores.findFirst({
      where: eq(stores.slug, storeSlug)
    });

    if (!store) {
      return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });
    }

    // Locate product by UUID or slug
    const product = await db.query.products.findFirst({
      where: and(
        eq(products.storeId, store.id),
        eq(products.id, productId)
      )
    }) || await db.query.products.findFirst({
      where: and(
        eq(products.storeId, store.id),
        eq(products.slug, productId)
      )
    });

    // Fallback if product does not exist
    if (!product) {
      return NextResponse.json({
        success: true,
        destinationUrl: `/miniapp/${storeSlug}`
      });
    }

    // Authenticate Telegram User Session (Optional: if valid, check for existing access)
    const session = (await resolveMiniAppCustomerSession(req)) || (await getMiniAppSession());
    const customerId = session?.customerId;

    let activeAccess = null;

    if (customerId) {
      const now = new Date();
      const userAccess = await db.query.accesses.findFirst({
        where: and(
          eq(accesses.storeId, store.id),
          eq(accesses.customerId, customerId),
          eq(accesses.productId, product.id),
          eq(accesses.status, 'ACTIVE')
        ),
        with: {
          product: true
        }
      });

      if (userAccess) {
        const isLifetime = userAccess.product?.duration === 'lifetime' || !userAccess.expiresAt;
        if (isLifetime || (userAccess.expiresAt && userAccess.expiresAt.getTime() > now.getTime())) {
          activeAccess = userAccess;
        }
      }
    }

    // USER HAS ACTIVE ACCESS -> ROUTE TO VIDEO PLAYER OR ACCESSES
    if (activeAccess) {
      if (product.deliveryType === 'product_video') {
        // Find assigned READY videos
        const assignments = await db.query.productVideoAssignments.findMany({
          where: and(
            eq(productVideoAssignments.storeId, store.id),
            eq(productVideoAssignments.productId, product.id)
          ),
          orderBy: [asc(productVideoAssignments.position)],
          with: {
            video: true
          }
        });

        const validAssignedVideo = (assignments || [])
          .map(a => a?.video)
          .find((v): v is NonNullable<typeof v> => Boolean(v && v.status === "READY" && v.active));

        let firstVideoId = validAssignedVideo?.id;

        if (!firstVideoId) {
          const legacyVideo = await db.query.productVideos.findFirst({
            where: and(
              eq(productVideos.storeId, store.id),
              eq(productVideos.productId, product.id),
              eq(productVideos.status, "READY"),
              eq(productVideos.active, true)
            ),
            orderBy: [asc(productVideos.position)]
          });
          if (legacyVideo) firstVideoId = legacyVideo.id;
        }

        const destinationUrl = firstVideoId
          ? `/miniapp/${storeSlug}/video/${firstVideoId}`
          : `/miniapp/${storeSlug}/accesses`;

        return NextResponse.json({
          success: true,
          hasAccess: true,
          destinationUrl: destinationUrl
        });
      }

      return NextResponse.json({
        success: true,
        hasAccess: true,
        destinationUrl: `/miniapp/${storeSlug}/accesses`
      });
    }

    // USER DOES NOT HAVE ACCESS -> ROUTE TO PUBLIC PRODUCT SALES PAGE
    return NextResponse.json({
      success: true,
      hasAccess: false,
      destinationUrl: `/miniapp/${storeSlug}/product/${product.slug}`
    });
  } catch (error: any) {
    console.error("[resolveProduct API] Error:", error);
    return NextResponse.json({
      success: true,
      destinationUrl: `/miniapp/${req.headers.get("x-store-slug") || ''}`
    });
  }
}
