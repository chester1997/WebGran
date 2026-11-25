/**
 * Miniaturas leves das imagens do Bunny para a Loja Web.
 * As capas são enviadas em ~1000×1300 px, mas aparecem com ~150 px na vitrine: a rota /api/img
 * reduz para a largura certa em WebP e a CDN da Vercel guarda o resultado.
 * Só imagens do nosso Bunny passam pela rota; o resto continua como está.
 */
export const IMG_WIDTHS = [160, 240, 360, 480, 720, 960, 1280, 1600, 1920] as const;

export function isOurCdn(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "webgran-images.b-cdn.net";
  } catch {
    return false;
  }
}

export function snapWidth(w: number) {
  return IMG_WIDTHS.find((x) => x >= w) || IMG_WIDTHS[IMG_WIDTHS.length - 1];
}

export function thumb(url: string | null | undefined, width: number): string {
  if (!url) return "";
  if (!isOurCdn(url)) return url;
  return `/api/img?w=${snapWidth(width)}&u=${encodeURIComponent(url)}`;
}
