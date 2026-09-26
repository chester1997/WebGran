import crypto from "crypto";

export interface StorageUploadResult {
  url: string;
  path: string;
  sizeBytes: number;
}

export interface StorageProvider {
  upload(file: Buffer, path: string, contentType: string): Promise<StorageUploadResult>;
  delete(path: string): Promise<boolean>;
  exists(path: string): Promise<boolean>;
  getPublicUrl(path: string): string;
}

/**
 * Bunny Storage & CDN Implementation
 */
export class BunnyStorageProvider implements StorageProvider {
  private apiKey: string;
  private zoneName: string;
  private cdnUrl: string;

  constructor(apiKey: string, zoneName: string, cdnUrl: string) {
    this.apiKey = apiKey;
    this.zoneName = zoneName;
    this.cdnUrl = cdnUrl.replace(/\/$/, "");
  }

  async upload(file: Buffer, path: string, contentType: string): Promise<StorageUploadResult> {
    const cleanPath = path.replace(/^\//, "");
    const url = `https://storage.bunny.net/${this.zoneName}/${cleanPath}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        AccessKey: this.apiKey,
        "Content-Type": contentType || "application/octet-stream",
      },
      body: new Uint8Array(file),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Bunny Storage upload failed (${response.status}): ${errorText}`);
    }

    const publicUrl = `${this.cdnUrl}/${cleanPath}`;
    return {
      url: publicUrl,
      path: cleanPath,
      sizeBytes: file.length,
    };
  }

  async delete(path: string): Promise<boolean> {
    const cleanPath = path.replace(/^\//, "");
    const url = `https://storage.bunny.net/${this.zoneName}/${cleanPath}`;

    try {
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          AccessKey: this.apiKey,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async exists(path: string): Promise<boolean> {
    const publicUrl = this.getPublicUrl(path);
    try {
      const res = await fetch(publicUrl, { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }

  getPublicUrl(path: string): string {
    const cleanPath = path.replace(/^\//, "");
    return `${this.cdnUrl}/${cleanPath}`;
  }
}

/**
 * Fallback Local / Data URL Provider (Used when external Storage env vars are not set)
 */
export class FallbackStorageProvider implements StorageProvider {
  async upload(file: Buffer, path: string, contentType: string): Promise<StorageUploadResult> {
    const base64 = file.toString("base64");
    const mime = contentType || "image/webp";
    const dataUrl = `data:${mime};base64,${base64}`;

    return {
      url: dataUrl,
      path: path.replace(/^\//, ""),
      sizeBytes: file.length,
    };
  }

  async delete(_path: string): Promise<boolean> {
    return true;
  }

  async exists(_path: string): Promise<boolean> {
    return true;
  }

  getPublicUrl(path: string): string {
    return path;
  }
}

/**
 * Factory for Storage Provider Selection
 */
export function getStorageProvider(): StorageProvider {
  const apiKey = process.env.BUNNY_STORAGE_API_KEY;
  const zoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
  const cdnUrl = process.env.BUNNY_CDN_URL || process.env.NEXT_PUBLIC_BUNNY_CDN_URL;

  if (apiKey && zoneName && cdnUrl) {
    return new BunnyStorageProvider(apiKey, zoneName, cdnUrl);
  }

  // Graceful fallback for local development or unconfigured CDN
  return new FallbackStorageProvider();
}

/**
 * Generates a safe multi-tenant file path for WebGran
 */
export function generateMultiTenantStoragePath(
  storeId: string,
  entityType: "products" | "banners" | "categories" | "store" | "profiles",
  fileName: string
): string {
  const cleanStoreId = storeId.replace(/[^a-zA-Z0-9_-]/g, "");
  const hash = crypto.randomBytes(6).toString("hex");
  const ext = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() || "webp" : "webp";
  const cleanName = fileName
    .split(".")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 30);

  return `stores/${cleanStoreId}/${entityType}/${cleanName}-${hash}.${ext}`;
}
