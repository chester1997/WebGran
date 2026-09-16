import { ThemeEngineCategory } from "@/components/themes/engine";

export default async function MiniAppCategory({ 
  params 
}: { 
  params: Promise<{ slug: string, categorySlug: string }> 
}) {
  const resolvedParams = await params;
  return <ThemeEngineCategory storeSlug={resolvedParams.slug} categorySlug={resolvedParams.categorySlug} />;
}
