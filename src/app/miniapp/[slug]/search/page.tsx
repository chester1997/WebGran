export const dynamic = 'force-dynamic';
import { ThemeEngineSearch } from "@/components/themes/engine";

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
  
  return <ThemeEngineSearch storeSlug={resolvedParams.slug} q={q} />;
}

