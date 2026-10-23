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

    let updatedAvatar = avatarUrl !== undefined ? (avatarUrl ? avatarUrl.trim() : null) : undefined;

    if (updatedAvatar && updatedAvatar.startsWith("data:")) {
      try {
        const parts = updatedAvatar.split(",");
        const meta = parts[0];
        const base64Data = parts[1] || "";
        const matchMime = meta.match(/data:(.*?);/);
        const mimeType = matchMime ? matchMime[1] : "image/webp";
        const buffer = Buffer.from(base64Data, "base64");

        if (buffer.length > 10 * 1024 * 1024) {
          return NextResponse.json({ success: false, error: "A imagem de perfil excede o limite máximo de 10MB." }, { status: 400 });
        }

        const isPng = buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
        const isJpg = buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
        const isWebp = buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;

        if (!isPng && !isJpg && !isWebp) {
          return NextResponse.json({ success: false, error: "Formato de imagem inválido ou arquivo corrompido." }, { status: 400 });
        }

        const { getStorageProvider, generateMultiTenantStoragePath } = await import("@/lib/storage/provider");
        const storagePath = generateMultiTenantStoragePath(seller.id, "profiles", `avatar-${Date.now()}.webp`);
        const provider = getStorageProvider();
        const uploadRes = await provider.upload(buffer, storagePath, mimeType);
        updatedAvatar = uploadRes.url;
      } catch (err: any) {
        console.error("[Avatar Storage Upload Error]:", err);
        return NextResponse.json({ success: false, error: err?.message || "Erro no upload da foto de perfil para o Storage." }, { status: 500 });
      }
    }

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
