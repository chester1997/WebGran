import { ThemeEngineSearch } from "@/components/themes/engine";
import { getMiniAppSession } from "@/lib/telegram/session";
import { resolveSafeOriginBotContext } from "@/lib/telegram/bot-context";

export default async function MiniAppSearch({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const q = typeof resolvedSearch.q === "string" ? resolvedSearch.q : "";
  const session = await getMiniAppSession();

  const botContext = await resolveSafeOriginBotContext({
    storeSlug: resolvedParams.slug,
    urlBotParam: (resolvedSearch?.b || resolvedSearch?.botId) as string | undefined,
    session,
  });
  
  return <ThemeEngineSearch storeSlug={resolvedParams.slug} q={q} originBotId={botContext.originBotId} />;
}
