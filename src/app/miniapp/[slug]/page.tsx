import { ThemeEngineHome } from "@/components/themes/engine";
import { getMiniAppSession } from "@/lib/telegram/session";

export default async function MiniAppHome({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const session = await getMiniAppSession();
  return <ThemeEngineHome storeSlug={resolvedParams.slug} originBotId={session?.originBotId || null} />;
}
