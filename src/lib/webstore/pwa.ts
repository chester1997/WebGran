import { createHash } from "crypto";
import { getWebStore } from "./web-store";
import { getWebBranding } from "./settings";

/** Fundo da Loja Web (o mesmo do StoreShell): splash e barra de status do app. */
export const STORE_APP_BG = "#07080a";
export const STORE_APP_ACCENT = "#3b82f6";

export type StoreIconVariant = "192" | "512" | "maskable-192" | "maskable-512" | "apple-180";
export const STORE_ICON_VARIANTS: StoreIconVariant[] = ["192", "512", "maskable-192", "maskable-512", "apple-180"];

export interface StorePwaInfo {
  slug: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  /** Muda quando a logo muda: entra na URL dos ícones para furar o cache. */
  iconVersion: string;
  base: string;
}

/** Dados do app instalável de uma loja (null se a loja não existe ou não pode ser vista). */
export async function getStorePwaInfo(slug: string): Promise<StorePwaInfo | null> {
  const store = await getWebStore(slug);
  if (!store) return null;
  const look = await getWebBranding(store.id).catch(() => null);
  const name = (look?.branding.displayName || store.name || "Loja").trim();
  const logoUrl = look?.branding.logoUrl || store.logoUrl || null;
  return {
    slug: store.slug,
    name,
    shortName: shortAppName(name),
    logoUrl,
    iconVersion: createHash("sha1").update(logoUrl || "default").digest("hex").slice(0, 10),
    base: `/loja/${store.slug}`,
  };
}

/** Nome curto para a tela inicial (até 12 caracteres sem cortar no meio da palavra, quando der). */
export function shortAppName(name: string): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length <= 12) return clean;
  const words = clean.split(" ");
  let out = "";
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > 12) break;
    out = next;
  }
  return out || clean.slice(0, 12);
}

export function storeIconUrl(info: Pick<StorePwaInfo, "base" | "iconVersion">, variant: StoreIconVariant) {
  return `${info.base}/app-icon/${variant}?v=${info.iconVersion}`;
}

export function buildStoreManifest(info: StorePwaInfo) {
  const icon = (variant: StoreIconVariant, size: number, purpose: "any" | "maskable") => ({
    src: storeIconUrl(info, variant),
    sizes: `${size}x${size}`,
    type: "image/png",
    purpose,
  });
  return {
    id: `${info.base}/`,
    name: info.name,
    short_name: info.shortName,
    description: `Seus vídeos e planos da ${info.name}`,
    start_url: `${info.base}?source=pwa`,
    scope: info.base,
    display: "standalone",
    orientation: "portrait",
    background_color: STORE_APP_BG,
    theme_color: STORE_APP_BG,
    lang: "pt-BR",
    categories: ["entertainment", "shopping"],
    icons: [icon("192", 192, "any"), icon("512", 512, "any"), icon("maskable-192", 192, "maskable"), icon("maskable-512", 512, "maskable")],
  };
}

/** Ícone padrão (sacola branca no azul da plataforma), sem depender de fontes no servidor. */
function defaultIconSvg(size: number) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="${STORE_APP_ACCENT}"/>
      <path d="M33 40h34l-3 30a4 4 0 0 1-4 3.6H40a4 4 0 0 1-4-3.6z" fill="#fff"/>
      <path d="M41 42v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    </svg>`
  );
}

async function fetchLogo(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 0 && buf.length < 15 * 1024 * 1024 ? buf : null;
  } catch {
    return null;
  }
}

/**
 * Gera o PNG do ícone. A logo fica centralizada sobre o fundo da loja:
 * maskable usa margem maior (zona segura do Android), apple-180 é opaco (o iOS arredonda sozinho).
 */
export async function renderStoreIcon(logoUrl: string | null, variant: StoreIconVariant): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const size = variant === "apple-180" ? 180 : variant.endsWith("512") ? 512 : 192;
  const logo = logoUrl ? await fetchLogo(logoUrl) : null;
  if (logo) {
    try {
      // Corta bordas vazias; logo quadrada (já tem cara de ícone) ocupa quase tudo, logo comprida ganha margem
      const trimmed = await sharp(logo).trim().png().toBuffer().catch(() => logo);
      const meta = await sharp(trimmed).metadata();
      const aspect = meta.width && meta.height ? meta.width / meta.height : 1;
      const squareish = aspect > 0.85 && aspect < 1.18;
      const ratio = variant.startsWith("maskable") ? (squareish ? 0.8 : 0.62) : variant === "apple-180" ? (squareish ? 0.92 : 0.76) : squareish ? 0.96 : 0.82;
      const inner = Math.round(size * ratio);
      const resized = await sharp(trimmed)
        .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      return await sharp({ create: { width: size, height: size, channels: 4, background: STORE_APP_BG } })
        .composite([{ input: resized, gravity: "center" }])
        .png()
        .toBuffer();
    } catch {
      // logo em formato que o sharp não lê: cai no ícone padrão
    }
  }
  return sharp(defaultIconSvg(size)).png().toBuffer();
}
