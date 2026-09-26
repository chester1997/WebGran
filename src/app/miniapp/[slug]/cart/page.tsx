import { ThemeEngineCart } from "@/components/themes/engine";
import { connection } from "next/server";

export default async function MiniAppCart({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  try {
    const resolvedParams = await params;
    return <ThemeEngineCart storeSlug={resolvedParams.slug} />;
  } catch (error: any) {
    console.error("[MiniAppCart Server Error]:", error);
    throw error;
  }
}
