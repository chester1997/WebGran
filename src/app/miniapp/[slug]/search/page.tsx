import { ThemeEngineSearch } from "@/components/themes/engine";
import { getMiniAppSession } from "@/lib/telegram/session";

export default async function MiniAppSearch({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ slug: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const q = typeof resolvedSearch.q === 'string' ? resolvedSearch.q : "";
  const session = await getMiniAppSession();
  
  return <ThemeEngineSearch storeSlug={resolvedParams.slug} q={q} originBotId={session?.originBotId || null} />;
}
