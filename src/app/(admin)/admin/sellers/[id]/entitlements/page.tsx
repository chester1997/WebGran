import { connection } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import SellerEntitlementsClient from "./SellerEntitlementsClient";

export default async function SellerEntitlementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const user = await requirePlatformAdmin();
  const { id: sellerId } = await params;

  return <SellerEntitlementsClient user={user} sellerId={sellerId} />;
}
