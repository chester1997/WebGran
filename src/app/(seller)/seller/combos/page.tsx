import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import SetupStoreClient from "../SetupStoreClient";
import CombosClient from "./CombosClient";
import { getCombosAction, getStoreActiveProductsAction } from "./actions";

export default async function SellerCombosPage() {
  await connection();
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  const [combosList, activeProducts] = await Promise.all([
    getCombosAction(),
    getStoreActiveProductsAction(),
  ]);

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
