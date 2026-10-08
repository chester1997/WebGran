import { connection } from "next/server";
import { VideoPlaybackClient } from "./VideoPlaybackClient";

export default async function MiniAppVideoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; videoId: string }>;
  searchParams?: Promise<{ token?: string; triggerToken?: string; t?: string }>;
}) {
  await connection();
  const { slug, videoId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const token = resolvedSearchParams.token || resolvedSearchParams.triggerToken || resolvedSearchParams.t || "";

  return <VideoPlaybackClient storeSlug={slug} videoId={videoId} initialToken={token} />;
}
