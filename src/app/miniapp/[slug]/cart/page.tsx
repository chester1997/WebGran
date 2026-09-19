export const dynamic = 'force-dynamic';
import { ThemeEngineCart } from "@/components/themes/engine";

export default async function MiniAppCart({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const resolvedParams = await params;
    return <ThemeEngineCart storeSlug={resolvedParams.slug} />;
  } catch (error: any) {
    console.error("[MiniAppCart Server Error]:", error);
    throw error;
  }
}
