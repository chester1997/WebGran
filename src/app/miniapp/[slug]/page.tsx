import { ThemeEngineHome } from "@/components/themes/engine";
import { getMiniAppSession } from "@/lib/telegram/session";
import { resolveSafeOriginBotContext } from "@/lib/telegram/bot-context";

export default async function MiniAppHome({ 
  params,
  searchParams
}: { 
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await params;
  const resolvedQuery = await searchParams;
  const session = await getMiniAppSession();

  const botContext = await resolveSafeOriginBotContext({
    storeSlug: resolvedParams.slug,
    urlBotParam: (resolvedQuery?.b || resolvedQuery?.botId) as string | undefined,
    session,
  });

  return <ThemeEngineHome storeSlug={resolvedParams.slug} originBotId={botContext.originBotId} />;
}
