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
