import { buildStoreManifest, getStorePwaInfo } from "@/lib/webstore/pwa";

/** Ficha do app instalável desta loja (nome, ícone e cores do vendedor; abre direto na loja). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const info = await getStorePwaInfo(slug);
  if (!info) return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify(buildStoreManifest(info)), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
