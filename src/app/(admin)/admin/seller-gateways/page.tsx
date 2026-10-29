import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SellerGatewayControlService } from "@/lib/payments/seller-gateway-control-service";
import SellerGatewaysClient from "./SellerGatewaysClient";

export default async function AdminSellerGatewaysPage() {
  await connection();

  let adminUser;
  try {
    adminUser = await requireAdmin();
  } catch (err: any) {
    if (err?.message === "UNAUTHORIZED") {
      redirect("/login");
    }
    redirect("/seller");
  }

  const controls = await SellerGatewayControlService.getAllControls();

  return <SellerGatewaysClient initialControls={controls} adminUser={adminUser} />;
}

