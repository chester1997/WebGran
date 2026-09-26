import { ThemeEngineProfile } from "@/components/themes/engine";
import { connection } from "next/server";

export default async function MiniAppProfile({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const resolvedParams = await params;
  return <ThemeEngineProfile storeSlug={resolvedParams.slug} />;
}
