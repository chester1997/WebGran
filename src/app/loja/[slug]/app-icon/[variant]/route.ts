import { getStorePwaInfo, renderStoreIcon, STORE_ICON_VARIANTS, type StoreIconVariant } from "@/lib/webstore/pwa";

// Ícones já gerados nesta instância (a CDN da Vercel guarda o resto pelo Cache-Control).
const memo = new Map<string, Buffer>();

/** Ícones do app da loja gerados a partir da logo do vendedor (192, 512, maskable e apple 180). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; variant: string }> }) {
  const { slug, variant } = await params;
  if (!STORE_ICON_VARIANTS.includes(variant as StoreIconVariant)) return new Response("Not found", { status: 404 });
  const info = await getStorePwaInfo(slug);
  if (!info) return new Response("Not found", { status: 404 });

  const key = `${info.iconVersion}:${variant}`;
  let png = memo.get(key);
  if (!png) {
    png = await renderStoreIcon(info.logoUrl, variant as StoreIconVariant);
    if (memo.size > 200) memo.clear();
    memo.set(key, png);
  }
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // A URL leva ?v=<versão da logo>: trocar a logo gera uma URL nova
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
    },
  });
}
