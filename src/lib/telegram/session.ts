import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export async function getMiniAppSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tg_session")?.value;

  if (!token) {
    return null;
  }

  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "fallback_secret");
    const { payload } = await jwtVerify(token, secret);
    
    return {
      customerId: payload.customerId as string,
      storeId: payload.storeId as string,
      telegramId: payload.telegramId as string
    };
  } catch (e) {
    return null;
  }
}

export async function resolveMiniAppCustomerSession(req: any) {
  let session = await getMiniAppSession();
  if (session?.customerId && session?.storeId) {
    return session;
  }

  const initData = req.headers.get("x-telegram-init-data") || req.nextUrl?.searchParams?.get("initData");
  const storeSlug = req.headers.get("x-store-slug") || req.nextUrl?.searchParams?.get("storeSlug");

  if (!initData || !storeSlug) return null;

  const { db } = await import("@/db");
  const { stores, telegramCustomers } = await import("@/db/schema");
  const { eq, and } = await import("drizzle-orm");
  const { validateInitData } = await import("./validation");
  const { decrypt } = await import("../encryption");

  const store = await db.query.stores.findFirst({
    where: eq(stores.slug, storeSlug),
    with: { bots: true },
  });

  if (!store || !store.bots?.length) return null;

  let isValid = false;
  for (const bot of store.bots) {
    const token = decrypt(bot.tokenEncrypted);
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

