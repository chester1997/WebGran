import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ProductForm } from "./ProductForm";

export default async function NewProductPage() {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <div>Loja não encontrada.</div>;
  }

  // Fetch categories to populate the dropdown
  const storeCategories = await db.query.categories.findMany({
    where: eq(categories.storeId, store.id),
    columns: {
      id: true,
      name: true
    }
  });

  return (
    <div className="w-full h-full">
      <ProductForm categories={storeCategories} />
    </div>
  );
}
