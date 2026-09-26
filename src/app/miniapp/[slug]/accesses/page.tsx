import { ThemeEngineAccesses } from "@/components/themes/engine";

export default async function MiniAppAccesses({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  return <ThemeEngineAccesses storeSlug={resolvedParams.slug} />;
}
