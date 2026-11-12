import { ThemeEngineCategory } from "@/components/themes/engine";
import { getMiniAppSession } from "@/lib/telegram/session";

export default async function MiniAppCategory({ 
  params 
}: { 
  params: Promise<{ slug: string, categorySlug: string }> 
}) {
  const resolvedParams = await params;
  const session = await getMiniAppSession();
  return <ThemeEngineCategory storeSlug={resolvedParams.slug} categorySlug={resolvedParams.categorySlug} originBotId={session?.originBotId || null} />;
}
