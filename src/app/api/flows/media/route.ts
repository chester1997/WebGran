import { NextRequest, NextResponse } from "next/server";
import { getCurrentStore } from "@/lib/auth";
import { verifyOwnerActionAccess } from "@/lib/bots/owner-guard";
import { getStorageProvider, generateMultiTenantStoragePath } from "@/lib/storage/provider";
import { StorageUsageService } from "@/lib/storage/storage-usage-service";

/**
 * Upload de áudio e vídeo curto para os fluxos (Meus Fluxos).
 * Exclusivo da conta proprietária. Imagens continuam pelo /api/storage/upload.
 * Limite de 4 MB por causa do corpo máximo das funções da Vercel.
 */
export const maxDuration = 30;
const MAX_BYTES = 4 * 1024 * 1024;

function sniff(buf: Buffer): { kind: "audio" | "video"; mime: string; ext: string } | null {
  if (buf.length < 12) return null;
  // OGG (voz do Telegram)
  if (buf.toString("ascii", 0, 4) === "OggS") return { kind: "audio", mime: "audio/ogg", ext: "ogg" };
  // MP3 (ID3 ou frame sync)
  if (buf.toString("ascii", 0, 3) === "ID3" || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return { kind: "audio", mime: "audio/mpeg", ext: "mp3" };
  // MP4 / M4A / MOV (caixa "ftyp")
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12).toLowerCase();
    if (brand.startsWith("m4a")) return { kind: "audio", mime: "audio/mp4", ext: "m4a" };
    if (brand.startsWith("qt")) return { kind: "video", mime: "video/quicktime", ext: "mov" };
    return { kind: "video", mime: "video/mp4", ext: "mp4" };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const access = await verifyOwnerActionAccess();
  if (!access.authorized || !access.user) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
  const store = await getCurrentStore();
  if (!store) return NextResponse.json({ success: false, error: "Loja não encontrada." }, { status: 404 });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return NextResponse.json({ success: false, error: "Arquivo inválido." }, { status: 400 });
  }
  if (!file) return NextResponse.json({ success: false, error: "Envie um arquivo." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ success: false, error: "Arquivo maior que 4 MB. Use um áudio ou vídeo mais curto." }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf);
  if (!type) return NextResponse.json({ success: false, error: "Formato não aceito. Envie áudio .ogg/.mp3/.m4a ou vídeo .mp4/.mov." }, { status: 400 });

  const reservation = await StorageUsageService.reserveStorageForUpload({
    sellerId: access.user.id,
    storeId: store.id,
    bytes: buf.length,
    referenceType: "generic",
  });
  if (!reservation.allowed) {
    return NextResponse.json({ success: false, error: reservation.reason || "Espaço de armazenamento esgotado no seu plano." }, { status: 403 });
  }

  const baseName = (file.name || "midia").replace(/\.[^.]+$/, "");
  const path = generateMultiTenantStoragePath(store.id, "store", `fluxo-${baseName}.${type.ext}`);
  try {
    const result = await getStorageProvider().upload(buf, path, type.mime);
    if (reservation.reservationId) await StorageUsageService.confirmReservation(reservation.reservationId, result.sizeBytes || buf.length);
    return NextResponse.json({ success: true, url: result.url, kind: type.kind, mime: type.mime });
  } catch (err) {
    if (reservation.reservationId) await StorageUsageService.releaseReservation(reservation.reservationId);
    console.error("[flows/media] upload falhou:", (err as Error)?.message);
    return NextResponse.json({ success: false, error: "Não foi possível enviar o arquivo agora." }, { status: 500 });
  }
}
