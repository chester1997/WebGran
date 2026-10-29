import { connection } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import SellersClient from "./SellersClient";
import { redirect } from "next/navigation";
import { loadAdminSellersList } from "@/lib/commission/seller-admin-query";

export default async function AdminSellersPage() {
  await connection();

  try {
    await requirePlatformAdmin();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      redirect("/login");
    }
    redirect("/seller");
  }

  const formattedSellers = await loadAdminSellersList();

  return <SellersClient initialSellers={formattedSellers} />;
}
