import { NextRequest, NextResponse } from "next/server";
import { getCurrentStore } from "@/lib/auth";
import { verifyOwnerActionAccess } from "@/lib/bots/owner-guard";
import { getStorageProvider, generateMultiTenantStoragePath } from "@/lib/storage/provider";
import { StorageUsageService } from "@/lib/storage/storage-usage-service";

/**
 * Upload de áudio, vídeo curto e documentos para os fluxos (Meus Fluxos).
 * Exclusivo da conta proprietária. Imagens continuam pelo /api/storage/upload.
 * Limite de 4 MB por causa do corpo máximo das funções da Vercel.
 */
export const maxDuration = 30;
const MAX_BYTES = 4 * 1024 * 1024;

type Sniffed = { kind: "audio" | "video" | "file"; mime: string; ext: string };

const OFFICE: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  epub: "application/epub+zip",
  zip: "application/zip",
};

/** Documentos do bloco "Arquivo": PDF, ZIP/Office/EPUB, RAR, 7Z, TXT e CSV. */
function sniffDocument(buf: Buffer, fileName: string): Sniffed | null {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (buf.toString("ascii", 0, 5) === "%PDF-") return { kind: "file", mime: "application/pdf", ext: "pdf" };
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    const e = ext in OFFICE ? ext : "zip";
    return { kind: "file", mime: OFFICE[e], ext: e };
  }
  if (buf.toString("ascii", 0, 4) === "Rar!") return { kind: "file", mime: "application/vnd.rar", ext: "rar" };
  if (buf[0] === 0x37 && buf[1] === 0x7a && buf[2] === 0xbc && buf[3] === 0xaf) return { kind: "file", mime: "application/x-7z-compressed", ext: "7z" };
  if ((ext === "txt" || ext === "csv") && !buf.subarray(0, 4096).includes(0)) return { kind: "file", mime: ext === "csv" ? "text/csv" : "text/plain", ext };
  return null;
}

function sniff(buf: Buffer): Sniffed | null {
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
  let wantsDocument = false;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
    wantsDocument = form.get("kind") === "file";
  } catch {
    return NextResponse.json({ success: false, error: "Arquivo inválido." }, { status: 400 });
  }
  if (!file) return NextResponse.json({ success: false, error: "Envie um arquivo." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ success: false, error: "Arquivo maior que 4 MB. Envie um arquivo menor." }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const type = wantsDocument ? sniffDocument(buf, file.name || "") : sniff(buf);
  if (!type) {
    const msg = wantsDocument ? "Formato não aceito. Envie PDF, ZIP, RAR, 7Z, Word, Excel, PowerPoint, EPUB, TXT ou CSV." : "Formato não aceito. Envie áudio .ogg/.mp3/.m4a ou vídeo .mp4/.mov.";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }

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
