import { requireSeller, getCurrentStore } from "@/lib/auth";
import SetupStoreClient from "../SetupStoreClient";
import CouponsClient from "./CouponsClient";
import { getCouponsAction } from "./actions";

export default async function SellerCouponsPage() {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  const couponsList = await getCouponsAction();

  return (
    <div className="w-full">
      <CouponsClient initialCoupons={couponsList} />
    </div>
  );
}
