import { ThemeEngineProduct } from "@/components/themes/engine";
import { getMiniAppSession } from "@/lib/telegram/session";

export default async function MiniAppProduct({ 
  params 
}: { 
  params: Promise<{ slug: string, productSlug: string }> 
}) {
  const resolvedParams = await params;
  const session = await getMiniAppSession();
  return <ThemeEngineProduct storeSlug={resolvedParams.slug} productSlug={resolvedParams.productSlug} originBotId={session?.originBotId || null} />;
}
