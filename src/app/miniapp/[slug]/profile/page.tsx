export const dynamic = 'force-dynamic';
import { ThemeEngineProfile } from "@/components/themes/engine";

export default async function MiniAppProfile({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  return <ThemeEngineProfile storeSlug={resolvedParams.slug} />;
}

