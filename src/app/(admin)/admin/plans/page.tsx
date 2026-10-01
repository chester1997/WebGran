import { connection } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import AdminPlansClient from "./AdminPlansClient";

export default async function AdminPlansPage() {
  await connection();
  const user = await requirePlatformAdmin();

  return <AdminPlansClient user={user} />;
}
