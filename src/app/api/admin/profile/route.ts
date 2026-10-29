import { NextResponse } from "next/server";
import { connection } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  await connection();
  try {
    const admin = await requirePlatformAdmin();

    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, admin.id),
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: admin.id,
          name: userRecord?.name || admin.name || "Administrador",
          email: userRecord?.email || admin.email || "",
          avatarUrl: userRecord?.avatarUrl || null,
          role: userRecord?.role || admin.role || "admin",
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, error: "Sessão não autenticada." },
        { status: 401 }
      );
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: "Acesso negado. Apenas administradores podem acessar." },
        { status: 403 }
      );
    }
    console.error("[Admin Profile GET Error]:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao carregar perfil administrativo." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  await connection();
  try {
    const admin = await requirePlatformAdmin();
    const body = await req.json();
    const { name, avatarUrl } = body;

    // 1. Validate display name
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "O nome de exibição é obrigatório." },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      return NextResponse.json(
        { success: false, error: "O nome deve conter entre 2 e 80 caracteres." },
        { status: 400 }
      );
    }

    // 2. Process and validate avatar
    let updatedAvatar: string | null | undefined = undefined;

    if (avatarUrl === null || avatarUrl === "") {
      // Explicit removal of avatar
      updatedAvatar = null;
    } else if (typeof avatarUrl === "string") {
      const trimmedUrl = avatarUrl.trim();

      if (trimmedUrl.startsWith("data:")) {
        // Base64 Data URL upload
        try {
          const parts = trimmedUrl.split(",");
          const meta = parts[0];
          const base64Data = parts[1] || "";
          const matchMime = meta.match(/data:(.*?);/);
          const mimeType = matchMime ? matchMime[1].toLowerCase() : "image/webp";

          // Validate allowed image MIME types
          const allowedMimes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
          if (!allowedMimes.includes(mimeType)) {
            return NextResponse.json(
              { success: false, error: "Formato inválido. Use apenas PNG, JPEG ou WebP." },
              { status: 400 }
            );
          }

          const buffer = Buffer.from(base64Data, "base64");

          // Size limit: 5MB maximum
          if (buffer.length > 5 * 1024 * 1024) {
            return NextResponse.json(
              { success: false, error: "A imagem de perfil não pode exceder 5MB." },
              { status: 400 }
            );
          }

          // Magic bytes verification
          const isPng = buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
          const isJpg = buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
          const isWebp = buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;

          if (!isPng && !isJpg && !isWebp) {
            return NextResponse.json(
              { success: false, error: "O arquivo enviado não é uma imagem válida." },
              { status: 400 }
            );
          }

          const { getStorageProvider, generateMultiTenantStoragePath } = await import("@/lib/storage/provider");
          const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
          const storagePath = generateMultiTenantStoragePath(admin.id, "profiles", `admin-avatar-${Date.now()}.${ext}`);
          const provider = getStorageProvider();
          const uploadRes = await provider.upload(buffer, storagePath, mimeType);
          updatedAvatar = uploadRes.url;
        } catch (uploadErr: any) {
          console.error("[Admin Avatar Storage Upload Error]:", uploadErr);
          return NextResponse.json(
            { success: false, error: uploadErr?.message || "Erro ao salvar a imagem no storage." },
            { status: 500 }
          );
        }
      } else if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
        // Keep existing valid URL
        updatedAvatar = trimmedUrl;
      } else {
        return NextResponse.json(
          { success: false, error: "URL de avatar inválida." },
          { status: 400 }
        );
      }
    }

    // 3. Persist update in database (strictly preserves id, email, role)
    await db
      .update(users)
      .set({
        name: trimmedName,
        ...(updatedAvatar !== undefined ? { avatarUrl: updatedAvatar } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, admin.id));

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, admin.id),
    });

    return NextResponse.json({
      success: true,
      user: {
        id: admin.id,
        name: updatedUser?.name || trimmedName,
        email: updatedUser?.email || admin.email || "",
        avatarUrl: updatedUser?.avatarUrl || null,
        role: updatedUser?.role || admin.role || "admin",
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, error: "Sessão não autenticada." },
        { status: 401 }
      );
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: "Acesso negado. Apenas administradores podem acessar." },
        { status: 403 }
      );
    }
    console.error("[Admin Profile POST Error]:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao atualizar perfil administrativo." },
      { status: 500 }
    );
  }
}
