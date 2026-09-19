import { requireSeller, getCurrentStore } from "@/lib/auth";
import { getStoreBanners } from "./actions";
import BannersClient from "./BannersClient";

export default async function SellerBannersPage() {
  await requireSeller();
  await getCurrentStore();

  const { banners, bannerInterval, maxLimit } = await getStoreBanners();

  return (
    <BannersClient
      initialBanners={banners.map(b => ({
        ...b,
        createdAt: new Date(b.createdAt),
        updatedAt: new Date(b.updatedAt),
      }))}
      initialInterval={bannerInterval}
      maxLimit={maxLimit}
    />
  );
}
