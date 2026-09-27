import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { ClipService } from "@/lib/clips/service";
import SetupStoreClient from "../../SetupStoreClient";
import ClipsClient from "./ClipsClient";

export default async function SellerClipsPage() {
  await connection();
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  const clipsList = await ClipService.listStoreClips(store.id);

  // Stats calculation
  const total = clipsList.length;
  let published = 0;
  let processing = 0;
  let failed = 0;

  clipsList.forEach((c) => {
    if (c.status === "READY") published++;
    else if (c.status === "FAILED") failed++;
    else processing++; // UPLOADING or PROCESSING
  });

  return (
    <ClipsClient
      initialClips={clipsList.map((c) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
      }))}
      initialStats={{ total, published, processing, failed }}
    />
  );
}
