import { NextRequest, NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { getStorageProvider, generateMultiTenantStoragePath } from "@/lib/storage/provider";
import { StorageUsageService } from "@/lib/storage/storage-usage-service";

export async function POST(req: NextRequest) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!seller || !store) {
      return NextResponse.json(
        { success: false, error: "NÃ£o autorizado ou loja nÃ£o encontrada." },
        { status: 401 }
      );
    }

    const contentTypeHeader = req.headers.get("content-type") || "";

    let fileBuffer: Buffer | null = null;
    let fileName = "upload.webp";
    let mimeType = "image/webp";
    let entityType: "products" | "banners" | "categories" | "store" | "profiles" = "products";

    if (contentTypeHeader.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const rawEntityType = (formData.get("entityType") as string) || "products";

      if (!file) {
        return NextResponse.json(
          { success: false, error: "Nenhum arquivo enviado." },
          { status: 400 }
        );
      }

      fileName = file.name || "upload.webp";
      mimeType = file.type || "image/webp";
      fileBuffer = Buffer.from(await file.arrayBuffer());

      if (["products", "banners", "categories", "store", "profiles"].includes(rawEntityType)) {
        entityType = rawEntityType as any;
      }
    } else {
      const body = await req.json();
      const { dataUrl, name, type, entity } = body;

      if (!dataUrl || typeof dataUrl !== "string") {
        return NextResponse.json(
          { success: false, error: "ImpossÃ­vel processar dados da imagem." },
          { status: 400 }
        );
      }

      if (name) fileName = name;
      if (type) mimeType = type;
      if (entity && ["products", "banners", "categories", "store", "profiles"].includes(entity)) {
        entityType = entity;
      }

      if (dataUrl.startsWith("data:")) {
        const parts = dataUrl.split(",");
        const meta = parts[0];
        const base64Data = parts[1] || "";
        const matchMime = meta.match(/data:(.*?);/);
        if (matchMime) mimeType = matchMime[1];
        fileBuffer = Buffer.from(base64Data, "base64");
      } else {
        return NextResponse.json(
          { success: false, error: "Formato de dados de imagem invÃ¡lido." },
          { status: 400 }
        );
      }
    }

    // Validate MIME type security
    const allowedMimeTypes = ["image/webp", "image/jpeg", "image/png", "image/gif"];
    if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: "Formato de imagem nÃ£o permitido. Envie WebP, JPEG ou PNG." },
        { status: 400 }
      );
    }

    // Verify file content magic bytes (prevent executable files disguised as images)
    const isPng = fileBuffer.length >= 8 && fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x4E && fileBuffer[3] === 0x47;
    const isJpg = fileBuffer.length >= 3 && fileBuffer[0] === 0xFF && fileBuffer[1] === 0xD8 && fileBuffer[2] === 0xFF;
    const isGif = fileBuffer.length >= 4 && fileBuffer[0] === 0x47 && fileBuffer[1] === 0x49 && fileBuffer[2] === 0x46 && fileBuffer[3] === 0x38;
    const isWebp = fileBuffer.length >= 12 && fileBuffer[0] === 0x52 && fileBuffer[1] === 0x49 && fileBuffer[2] === 0x46 && fileBuffer[3] === 0x46 && fileBuffer[8] === 0x57 && fileBuffer[9] === 0x45 && fileBuffer[10] === 0x42 && fileBuffer[11] === 0x50;

    if (!isPng && !isJpg && !isGif && !isWebp) {
      return NextResponse.json(
        { success: false, error: "O arquivo enviado nÃ£o Ã© uma imagem vÃ¡lida ou contÃ©m assinatura invÃ¡lida." },
        { status: 400 }
      );
    }

    // Maximum size validation: 10MB
    if (fileBuffer.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "A imagem excede o tamanho mÃ¡ximo de 10MB." },
        { status: 400 }
      );
    }

    // Reserve Storage Quota for Seller
    const actualBytes = fileBuffer.length;
    const reservation = await StorageUsageService.reserveStorageForUpload({
      sellerId: seller.id,
      storeId: store.id,
      bytes: actualBytes,
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

    // Generate isolated multi-tenant storage key
    const storagePath = generateMultiTenantStoragePath(store.id, entityType, fileName);

    // Upload via Storage Provider (Bunny CDN or Fallback)
    const provider = getStorageProvider();
    try {
      const result = await provider.upload(fileBuffer, storagePath, mimeType);

      // Confirm reservation on success
      if (reservation.reservationId) {
        await StorageUsageService.confirmReservation(reservation.reservationId, result.sizeBytes || actualBytes);
      }

      return NextResponse.json({
        success: true,
        url: result.url,
        path: result.path,
        sizeBytes: result.sizeBytes,
        storeId: store.id,
      });
    } catch (uploadErr: any) {
      if (reservation.reservationId) {
        await StorageUsageService.releaseReservation(reservation.reservationId);
      }
      throw uploadErr;
    }
  } catch (error: any) {
    console.error("[Storage Upload API Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao processar upload da imagem." },
      { status: 500 }
    );
  }
}
