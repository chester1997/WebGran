export const dynamic = 'force-dynamic';
import { ThemeEngineProduct } from "@/components/themes/engine";

export default async function MiniAppProduct({ 
  params 
}: { 
  params: Promise<{ slug: string, productSlug: string }> 
}) {
  const resolvedParams = await params;
  return <ThemeEngineProduct storeSlug={resolvedParams.slug} productSlug={resolvedParams.productSlug} />;
}

