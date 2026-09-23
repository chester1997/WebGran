export const dynamic = 'force-dynamic';
import { ThemeEngineFavorites } from "@/components/themes/engine";

export default async function MiniAppFavorites({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  return <ThemeEngineFavorites storeSlug={resolvedParams.slug} />;
}
