import { NextRequest, NextResponse } from "next/server";
import { getMiniAppSession } from "@/lib/telegram/session";
import { ProductVideoService } from "@/lib/videos/product-video-service";
import { db } from "@/db";
import { stores, telegramCustomers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { validateInitData } from "@/lib/telegram/validation";

async function resolveSession(req: NextRequest) {
  let session = await getMiniAppSession();
  if (session?.customerId && session?.storeId) {
    return session;
  }

  const initData = req.headers.get("x-telegram-init-data") || req.nextUrl.searchParams.get("initData");
  const storeSlug = req.headers.get("x-store-slug") || req.nextUrl.searchParams.get("storeSlug");

  if (!initData || !storeSlug) return null;

  const store = await db.query.stores.findFirst({
    where: eq(stores.slug, storeSlug),
    with: { bots: true },
  });

  if (!store || !store.bots?.length) return null;

  let isValid = false;
  for (const bot of store.bots) {
    const token = require("@/lib/encryption").decrypt(bot.tokenEncrypted);
    if (validateInitData(initData, token)) {
      isValid = true;
      break;
    }
  }

  const isDev = process.env.NODE_ENV === "development";
  if (!isValid && !isDev) return null;

  const urlParams = new URLSearchParams(initData);
  const userStr = urlParams.get("user");
  let tgUser;
  if (userStr) {
    tgUser = JSON.parse(decodeURIComponent(userStr));
  } else if (isDev) {
    tgUser = { id: 123456789 };
  } else {
    return null;
  }

  const customer = await db.query.telegramCustomers.findFirst({
    where: and(
      eq(telegramCustomers.storeId, store.id),
      eq(telegramCustomers.telegramUserId, String(tgUser.id))
    ),
  });

  if (!customer) return null;

  return {
    customerId: customer.id,
    storeId: store.id,
    telegramId: String(tgUser.id),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const session = await resolveSession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }

    const { videoId } = await params;

    const progress = await ProductVideoService.getVideoProgress(
      session.storeId,
      session.customerId,
      videoId
    );

    return NextResponse.json({
      success: true,
      progress: progress ? {
        positionSeconds: progress.positionSeconds,
        durationSeconds: progress.durationSeconds,
        progressPercent: Number(progress.progressPercent),
        completed: progress.completed,
        lastWatchedAt: progress.lastWatchedAt,
      } : null,
    });
  } catch (error: any) {
    console.error("[MiniApp Progress GET Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const session = await resolveSession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }

    const { videoId } = await params;
    const body = await req.json();
    const { positionSeconds, durationSeconds } = body;

    const record = await ProductVideoService.upsertVideoProgress(
      session.storeId,
      session.customerId,
      videoId,
      Number(positionSeconds) || 0,
      Number(durationSeconds) || 0
    );

    return NextResponse.json({
      success: true,
      progress: {
        positionSeconds: record.positionSeconds,
        durationSeconds: record.durationSeconds,
        progressPercent: Number(record.progressPercent),
        completed: record.completed,
        lastWatchedAt: record.lastWatchedAt,
      },
    });
  } catch (error: any) {
    console.error("[MiniApp Progress POST Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
