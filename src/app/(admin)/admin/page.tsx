import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth";
import AdminDashboardClient from "./AdminDashboardClient";

export default async function AdminDashboardPage() {
  await connection();
  await requireAdmin();

  return <AdminDashboardClient />;
}
