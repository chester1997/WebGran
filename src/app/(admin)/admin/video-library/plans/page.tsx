import { connection } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import VideoLibraryPlansClient from "./VideoLibraryPlansClient";

export default async function VideoLibraryPlansPage() {
  await connection();
  const user = await requirePlatformAdmin();

  return <VideoLibraryPlansClient user={user} />;
}
