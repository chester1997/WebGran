export const instant = false;
import { requireAdmin } from "@/lib/auth";
import AdminDashboardClient from "./AdminDashboardClient";

export default async function AdminDashboardPage() {
  await requireAdmin();

  return <AdminDashboardClient />;
}
