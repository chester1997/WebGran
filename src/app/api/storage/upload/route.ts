import { NextRequest, NextResponse } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { getStorageProvider, generateMultiTenantStoragePath } from "@/lib/storage/provider";

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
          { success: false, error: "Impossível processar dados da imagem." },
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
          { success: false, error: "Formato de dados de imagem inválido." },
          { status: 400 }
        );
      }
    }

    // Validate MIME type security
    const allowedMimeTypes = ["image/webp", "image/jpeg", "image/png", "image/gif"];
    if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: "Formato de imagem não permitido. Envie WebP, JPEG ou PNG." },
        { status: 400 }
      );
    }

    // Maximum size validation: 10MB
    if (fileBuffer.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "A imagem excede o tamanho máximo de 10MB." },
        { status: 400 }
      );
    }

    // Generate isolated multi-tenant storage key
    const storagePath = generateMultiTenantStoragePath(store.id, entityType, fileName);

    // Upload via Storage Provider (Bunny CDN or Fallback)
    const provider = getStorageProvider();
    const result = await provider.upload(fileBuffer, storagePath, mimeType);

    return NextResponse.json({
      success: true,
      url: result.url,
      path: result.path,
      sizeBytes: result.sizeBytes,
      storeId: store.id,
    });
  } catch (error: any) {
    console.error("[Storage Upload API Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao processar upload da imagem." },
      { status: 500 }
    );
  }
}
