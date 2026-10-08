import { NextRequest, NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { generateMultiTenantStoragePath } from "@/lib/storage/provider";
import { StorageUsageService } from "@/lib/storage/storage-usage-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!seller || !store) {
      return NextResponse.json(
        { success: false, error: "Não autorizado ou loja não encontrada." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { fileName, mimeType, fileSize, entityType = "banners" } = body;

    if (!fileName || typeof fileName !== "string") {
      return NextResponse.json(
        { success: false, error: "Nome do arquivo é obrigatório." },
        { status: 400 }
      );
    }

    const allowedMimeTypes = ["image/webp", "image/jpeg", "image/png", "image/gif"];
    const cleanMime = (mimeType || "image/webp").toLowerCase();
    if (!allowedMimeTypes.includes(cleanMime)) {
      return NextResponse.json(
        { success: false, error: "Formato de imagem não permitido. Envie WebP, JPEG ou PNG." },
        { status: 400 }
      );
    }

    const bytes = Number(fileSize) || 500 * 1024; // Default ~500KB if not specified
    if (bytes > 20 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "A imagem excede o tamanho máximo de 20MB." },
        { status: 400 }
      );
    }

    // Reserve quota in DB
    const reservation = await StorageUsageService.reserveStorageForUpload({
      sellerId: seller.id,
      storeId: store.id,
      bytes,
      referenceType: "image_upload",
    });

    if (!reservation.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: "STORAGE_QUOTA_EXCEEDED",
          error: reservation.reason || "Capacidade de armazenamento excedida para o seu plano.",
        },
        { status: 403 }
      );
    }

    const apiKey = process.env.BUNNY_STORAGE_API_KEY;
    const zoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
    const cdnUrl = (process.env.BUNNY_CDN_URL || process.env.NEXT_PUBLIC_BUNNY_CDN_URL || "").replace(/\/$/, "");

    if (!apiKey || !zoneName || !cdnUrl) {
      return NextResponse.json(
        { success: false, error: "As credenciais do Bunny Storage não estão configuradas no ambiente." },
        { status: 500 }
      );
    }

    const storagePath = generateMultiTenantStoragePath(store.id, entityType as any, fileName);
    const cleanPath = storagePath.replace(/^\//, "");
    
    const region = process.env.BUNNY_STORAGE_REGION || "br";
    const uploadUrl = `https://${region}.storage.bunnycdn.com/${zoneName}/${cleanPath}`;
    const publicUrl = `${cdnUrl}/${cleanPath}`;

    return NextResponse.json({
      success: true,
      uploadUrl,
      publicUrl,
      path: cleanPath,
      headers: {
        AccessKey: apiKey,
        "Content-Type": cleanMime,
      },
      reservationId: reservation.reservationId,
    });
  } catch (error: any) {
    console.error("[Direct Bunny Upload Session Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao gerar sessão de upload." },
      { status: 500 }
    );
  }
}
