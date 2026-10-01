import { connection } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import AdminFeaturesClient from "./AdminFeaturesClient";

export default async function AdminFeaturesPage() {
  await connection();
  const user = await requirePlatformAdmin();

  return <AdminFeaturesClient user={user} />;
}
