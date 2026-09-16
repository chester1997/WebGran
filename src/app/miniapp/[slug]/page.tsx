import { ThemeEngineHome } from "@/components/themes/engine";

export default async function MiniAppHome({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  return <ThemeEngineHome storeSlug={resolvedParams.slug} />;
}
