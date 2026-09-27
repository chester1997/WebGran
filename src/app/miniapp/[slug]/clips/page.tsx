import { ThemeEngineClips } from "@/components/themes/engine";

export default async function MiniAppClipsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  return <ThemeEngineClips storeSlug={resolvedParams.slug} />;
}
