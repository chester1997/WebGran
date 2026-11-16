import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { isOwnerAccount } from "@/lib/auth/owner-access";
import SetupStoreClient from "../SetupStoreClient";
import CouponsClient from "./CouponsClient";
import CouponsClientV2 from "./CouponsClientV2";
import { getCouponsAction } from "./actions";

export default async function SellerCouponsPage() {
  await connection();
  const user = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  const couponsList = await getCouponsAction();
  const isOwner = isOwnerAccount(user);

  if (isOwner) {
    return (
      <div className="w-full">
        <CouponsClientV2 initialCoupons={couponsList} />
      </div>
    );
  }

  return (
    <div className="w-full">
      <CouponsClient initialCoupons={couponsList} />
    </div>
  );
}
