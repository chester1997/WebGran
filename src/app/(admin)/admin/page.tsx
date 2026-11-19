import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isOwnerUser } from "@/lib/bots/owner-guard";
import AdminDashboardClient from "./AdminDashboardClient";
import AdminDashboardClientV2 from "./AdminDashboardClientV2";

export default async function AdminDashboardPage() {
  await connection();
  const user = await requireAdmin();

  // Redesign V2 da dashboard: só a conta proprietária vê; os demais admins seguem com a versão atual.
  if (isOwnerUser(user)) {
    return <AdminDashboardClientV2 />;
  }

  return <AdminDashboardClient />;
}
