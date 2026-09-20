import { NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, seller.id),
    });

    return NextResponse.json({
      success: true,
      user: {
        id: seller.id,
        name: userRecord?.name || seller.name || "Vendedor",
        email: seller.email || "",
        avatarUrl: userRecord?.avatarUrl || null,
      },
      store: store ? {
        id: store.id,
        name: store.name,
      } : null,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
  }
}
