import { connection } from "next/server";
import { VideoPlaybackClient } from "./VideoPlaybackClient";

export default async function MiniAppVideoPage({
  params,
}: {
  params: Promise<{ slug: string; videoId: string }>;
}) {
  await connection();
  const { slug, videoId } = await params;
  return <VideoPlaybackClient storeSlug={slug} videoId={videoId} />;
}
