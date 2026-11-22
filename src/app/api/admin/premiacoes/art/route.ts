import crypto from "crypto";
import { NextResponse, connection } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth";
import { getStorageProvider } from "@/lib/storage/provider";
import { getPlaque, plaqueArtKey } from "@/lib/rewards/plaques";
import { detectImageType } from "@/lib/rewards/image-type";

const MAX_BYTES = 4 * 1024 * 1024;

function authError(err: unknown) {
  const msg = err instanceof Error ? err.message : "";
  if (msg === "UNAUTHORIZED") return NextResponse.json({ success: false, error: "Sessão não autenticada." }, { status: 401 });
  if (msg === "FORBIDDEN") return NextResponse.json({ success: false, error: "Acesso restrito ao admin." }, { status: 403 });
  return null;
}

function refresh() {
  revalidatePath("/seller/premiacoes");
  revalidatePath("/admin/premiacoes");
}

/** Troca a arte de uma placa. A arte anterior não é apagada do storage. */
export async function POST(req: Request) {
  await connection();
  try {
    await requirePlatformAdmin();
  } catch (err) {
    return authError(err) ?? NextResponse.json({ success: false, error: "Erro de autenticação." }, { status: 500 });
  }

  try {
    const form = await req.formData();
    const plaque = getPlaque(Number(form.get("plaqueValue")));
    if (!plaque) return NextResponse.json({ success: false, error: "Placa inválida." }, { status: 400 });

    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ success: false, error: "Escolha uma imagem." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, error: "A imagem pode ter no máximo 4 MB." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const type = detectImageType(buf);
    if (!type) return NextResponse.json({ success: false, error: "Envie uma imagem PNG, JPG ou WEBP." }, { status: 400 });

    const slug = plaque.short.toLowerCase().replace(",", "-");
    const path = `platform/premiacoes/placa-${slug}-${crypto.randomBytes(5).toString("hex")}.${type.ext}`;
    const { url } = await getStorageProvider().upload(buf, path, type.mime);

    const key = plaqueArtKey(plaque.value);
    await db
      .insert(systemSettings)
      .values({ key, value: url, updatedAt: new Date() })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: url, updatedAt: new Date() } });

    refresh();
    return NextResponse.json({ success: true, url });
  } catch (err) {
    console.error("[POST /api/admin/premiacoes/art]", err);
    return NextResponse.json({ success: false, error: "Não foi possível salvar a imagem." }, { status: 500 });
  }
}

/** Volta para a arte padrão (só remove a troca; não apaga nada do storage). */
export async function DELETE(req: Request) {
  await connection();
  try {
    await requirePlatformAdmin();
  } catch (err) {
    return authError(err) ?? NextResponse.json({ success: false, error: "Erro de autenticação." }, { status: 500 });
  }

  const plaque = getPlaque(Number(new URL(req.url).searchParams.get("plaque")));
  if (!plaque) return NextResponse.json({ success: false, error: "Placa inválida." }, { status: 400 });

  try {
    await db.delete(systemSettings).where(eq(systemSettings.key, plaqueArtKey(plaque.value)));
    refresh();
    return NextResponse.json({ success: true, url: plaque.art });
  } catch (err) {
    console.error("[DELETE /api/admin/premiacoes/art]", err);
    return NextResponse.json({ success: false, error: "Não foi possível restaurar." }, { status: 500 });
  }
}
