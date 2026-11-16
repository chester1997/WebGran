import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { isOwnerAccount } from "@/lib/auth/owner-access";
import { getStoreBanners } from "./actions";
import BannersClient from "./BannersClient";
import BannersClientV2 from "./BannersClientV2";
import SetupStoreClient from "../SetupStoreClient";

export default async function SellerBannersPage() {
  await connection();
  const user = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  const { banners, bannerInterval, maxLimit } = await getStoreBanners();
  const isOwner = isOwnerAccount(user);

  if (isOwner) {
    return (
      <BannersClientV2
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
