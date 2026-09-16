import { ThemeEngineSearch } from "@/components/themes/engine";

export default async function MiniAppSearch({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  return <ThemeEngineSearch storeSlug={resolvedParams.slug} />;
}
