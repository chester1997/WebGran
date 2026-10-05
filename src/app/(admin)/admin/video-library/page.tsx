import { connection } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import VideoLibraryOverviewClient from "./VideoLibraryOverviewClient";

export default async function VideoLibraryOverviewPage() {
  await connection();
  const user = await requirePlatformAdmin();

  return <VideoLibraryOverviewClient user={user} />;
}
