import { ThemeEngineAccesses } from "@/components/themes/engine";
import { connection } from "next/server";

export default async function MiniAppAccesses({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const resolvedParams = await params;
  return <ThemeEngineAccesses storeSlug={resolvedParams.slug} />;
}
