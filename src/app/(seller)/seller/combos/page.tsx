import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { isOwnerAccount } from "@/lib/auth/owner-access";
import SetupStoreClient from "../SetupStoreClient";
import CombosClient from "./CombosClient";
import CombosClientV2 from "./CombosClientV2";
import { getCombosAction, getStoreActiveProductsAction } from "./actions";

export default async function SellerCombosPage() {
  await connection();
  const user = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  const [combosList, activeProducts] = await Promise.all([
    getCombosAction(),
    getStoreActiveProductsAction(),
  ]);
  const isOwner = isOwnerAccount(user);

  if (isOwner) {
    return (
      <div className="w-full">
        <CombosClientV2
          initialCombos={combosList}
          activeProducts={activeProducts}
          storeSlug={store.slug}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <CombosClient 
        initialCombos={combosList} 
        activeProducts={activeProducts}
        storeSlug={store.slug}
      />
    </div>
  );
}
