import { IMG_WIDTHS, isOurCdn } from "@/lib/webstore/img";

/**
 * Reduz uma imagem do nosso Bunny para a largura pedida (WebP) e deixa a CDN da Vercel guardar.
 * Só aceita imagens do nosso Bunny e larguras fixas (não vira um proxy aberto nem gera variações infinitas).
 * Se algo falhar, redireciona para a imagem original: a vitrine nunca fica sem imagem.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const src = url.searchParams.get("u") || "";
  const w = Number(url.searchParams.get("w"));
  if (!isOurCdn(src) || !(IMG_WIDTHS as readonly number[]).includes(w)) return new Response("Bad request", { status: 400 });

  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return Response.redirect(src, 302);
    const input = Buffer.from(await res.arrayBuffer());
    const sharp = (await import("sharp")).default;
    const out = await sharp(input, { failOn: "none" }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 74, effort: 4 }).toBuffer();
    return new Response(new Uint8Array(out), {
      headers: {
        "Content-Type": "image/webp",
        // Arquivos do Bunny têm nome único por envio: dá para guardar por bastante tempo
        "Cache-Control": "public, max-age=604800, s-maxage=31536000, stale-while-revalidate=31536000",
      },
    });
  } catch {
    return Response.redirect(src, 302);
  }
}
