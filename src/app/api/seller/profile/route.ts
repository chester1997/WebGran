import { NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";


export async function GET() {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, seller.id),
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: seller.id,
          name: userRecord?.name || seller.name || "Vendedor",
          email: seller.email || "",
          avatarUrl: userRecord?.avatarUrl || null,
          role: userRecord?.role || seller.role || "seller",
        },
        store: store ? {
          id: store.id,
          name: store.name,
        } : null,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const seller = await requireSeller();
    const body = await req.json();
    const { name, avatarUrl } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "O nome é obrigatório." }, { status: 400 });
    }

    const updatedAvatar = avatarUrl !== undefined ? (avatarUrl ? avatarUrl.trim() : null) : undefined;

    await db
      .update(users)
      .set({
        name: name.trim(),
        ...(updatedAvatar !== undefined ? { avatarUrl: updatedAvatar } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, seller.id));

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, seller.id),
    });

    return NextResponse.json({
      success: true,
      user: {
        id: seller.id,
        name: updatedUser?.name || name.trim(),
        email: seller.email || "",
        avatarUrl: updatedUser?.avatarUrl || null,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Erro ao atualizar perfil" }, { status: 500 });
  }
}
