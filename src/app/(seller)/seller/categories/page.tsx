import { connection } from "next/server";
import { redirect } from "next/navigation";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { isOwnerAccount } from "@/lib/auth/owner-access";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import SetupStoreClient from "../SetupStoreClient";
import CategoriesClient from "./CategoriesClient";
import CategoriesClientV2 from "./CategoriesClientV2";

export default async function SellerCategoriesPage() {
  await connection();
  const user = await requireSeller();

  const role = (user.role || "").toLowerCase();
  if (role !== "admin" && role !== "super_admin") {
    redirect("/seller");
  }

  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  const allCategories = await db.query.categories.findMany({
    where: eq(categories.storeId, store.id),
    orderBy: [asc(categories.position)]
  });

  const storeProducts = await db.query.products.findMany({
    where: eq(products.storeId, store.id),
    orderBy: [asc(products.title)]
  });

  const serializedProducts = storeProducts.map((p) => ({
    id: p.id,
    title: p.title,
    price: p.price,
    coverUrl: p.coverUrl,
    categoryId: p.categoryId,
  }));

  const isOwner = isOwnerAccount(user);

  // Ponto de integração V2 (Etapa 4 - exclusivo conta proprietária):
  if (isOwner) {
    return (
      <CategoriesClientV2
        allCategories={allCategories}
        serializedProducts={serializedProducts}
        initialStyle={(store.categoryDisplayStyle as "IMAGE" | "ICON") || "IMAGE"}
      />
    );
  }

  return (
    <CategoriesClient
      allCategories={allCategories}
      serializedProducts={serializedProducts}
      initialStyle={(store.categoryDisplayStyle as "IMAGE" | "ICON") || "IMAGE"}
    />
  );
}
