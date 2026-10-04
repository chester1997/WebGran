import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { ProductVideoService } from "@/lib/videos/product-video-service";
import { hasFeature } from "@/lib/entitlements/entitlement-service";
import SetupStoreClient from "../SetupStoreClient";
import VideosClient from "./VideosClient";
import { ShieldAlert } from "lucide-react";

export default async function SellerVideosPage() {
  console.log("[SELLER_VIDEOS] STEP 1 - page started");
  await connection();
  console.log("[SELLER_VIDEOS] STEP 2 - connection passed");
  const seller = await requireSeller();
  console.log("[SELLER_VIDEOS] STEP 3 - requireSeller passed");
  const store = await getCurrentStore();
  console.log("[SELLER_VIDEOS] STEP 4 - getCurrentStore passed");

  if (!store) {
    return <SetupStoreClient />;
  }

  // Verify entitlement: product_videos_enabled
  const isEnabled = await hasFeature(seller.id, "product_videos_enabled");
  console.log("[SELLER_VIDEOS] STEP 5 - entitlement passed:", isEnabled);
  if (!isEnabled) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Biblioteca de Vídeos Desativada</h2>
          <p className="text-zinc-400 max-w-md text-sm mb-6">
            A funcionalidade de Biblioteca de Vídeos do Vendedor não está ativada no seu plano atual.
            Faça um upgrade para acessar o upload e gerenciamento exclusivo de vídeos.
          </p>
        </div>
      </div>
    );
  }

  let videos: any[] = [];
  try {
    console.log("[SELLER_VIDEOS] STEP 6 - loading library");
    videos = await ProductVideoService.listSellerLibraryVideos(store.id);
    console.log("[SELLER_VIDEOS] STEP 7 - library loaded successfully, count:", videos.length);
  } catch (error) {
    console.error("[SELLER_VIDEOS] LIBRARY ERROR in listSellerLibraryVideos:", error);
    videos = [];
  }

  let rawUsage;
  try {
    console.log("[SELLER_VIDEOS] STEP 8 - loading storage usage");
    rawUsage = await ProductVideoService.getSellerVideoStorageUsage(seller.id, store.id);
    console.log("[SELLER_VIDEOS] STEP 9 - storage usage loaded successfully");
  } catch (error) {
    console.error("[SELLER_VIDEOS] STORAGE ERROR in getSellerVideoStorageUsage:", error);
    rawUsage = {
      usedBytes: 0,
      quotaGb: 50,
      quotaBytes: 50 * 1024 * 1024 * 1024,
      reservedBytes: 0,
      remainingBytes: 50 * 1024 * 1024 * 1024,
      percentUsed: 0,
    };
  }

  const usedGB = rawUsage.usedBytes / (1024 * 1024 * 1024);
  const quotaGB = rawUsage.quotaGb || 50;
  const freeGB = rawUsage.remainingBytes !== null ? rawUsage.remainingBytes / (1024 * 1024 * 1024) : Math.max(0, quotaGB - usedGB);

  const usage = {
    usedBytes: rawUsage.usedBytes,
    quotaBytes: rawUsage.quotaBytes || quotaGB * 1024 * 1024 * 1024,
    reservedBytes: rawUsage.reservedBytes,
    usedGB,
    quotaGB,
    freeGB,
    percentage: rawUsage.percentUsed,
  };

  return (
    <VideosClient
      initialVideos={videos.map((v) => ({
        ...v,
        createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: v.updatedAt ? new Date(v.updatedAt).toISOString() : new Date().toISOString(),
      }))}
      initialUsage={usage}
    />
  );
}
