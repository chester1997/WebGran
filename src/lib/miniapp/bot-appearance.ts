import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { botMiniappAppearance, stores, telegramBots } from "@/db/schema";
import { isOwnerUser } from "@/lib/bots/owner-guard";

/**
 * Bot → Personalização: nome e logo no topo do Mini App, cor principal e botões extras das boas-vindas.
 *
 * Em teste: só vale para os bots da conta proprietária. Para qualquer outra loja estas funções devolvem
 * "sem personalização" (Mini App e boas-vindas exatamente como hoje). Sem a tabela (migration 0036), idem.
 */

import { DEFAULT_ACCENT } from "./appearance-colors";
export { ACCENT_COLORS, DEFAULT_ACCENT } from "./appearance-colors";

export interface BotAppearance {
  displayName: string | null;
  logoUrl: string | null;
  /** null = vermelho de sempre */
  accentColor: string | null;
  showExtraButtons: boolean;
  /** Texto do botão que abre a loja nas boas-vindas. null = "🛍️ ABRIR LOJA" */
  welcomeButtonText: string | null;
  /** Tema do Mini App: null = Padrão */
  theme: MiniAppTheme | null;
}

export type MiniAppTheme = "xds";
export const MINIAPP_THEMES: MiniAppTheme[] = ["xds"];
const normalizeTheme = (v: unknown): MiniAppTheme | null => (MINIAPP_THEMES.includes(v as MiniAppTheme) ? (v as MiniAppTheme) : null);

export const DEFAULT_OPEN_LABEL = "🛍️ ABRIR LOJA";

export const EMPTY_APPEARANCE: BotAppearance = { displayName: null, logoUrl: null, accentColor: null, showExtraButtons: false, welcomeButtonText: null, theme: null };

const isMissing = (e: unknown) => {
  const code = (e as { code?: string; cause?: { code?: string } })?.code || (e as { cause?: { code?: string } })?.cause?.code;
  return code === "42P01" || code === "42703";
};

export const normalizeHex = (v: unknown): string | null => {
  const s = String(v || "").trim();
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toUpperCase() : null;
};

/** A loja pode usar a Personalização? (em teste: só a conta proprietária) */
export async function appearanceAllowedForStore(storeId: string): Promise<boolean> {
  const s = await db.query.stores.findFirst({ where: eq(stores.id, storeId), columns: { ownerId: true } });
  return Boolean(s?.ownerId && isOwnerUser({ id: s.ownerId }));
}

/** Linha salva do bot (sem checar a conta). null se não existe ou a tabela ainda não foi criada. */
async function readRow(botId: string) {
  try {
    return (await db.query.botMiniappAppearance.findFirst({ where: eq(botMiniappAppearance.botId, botId) })) || null;
  } catch (e) {
    if (isMissing(e)) return null;
    throw e;
  }
}

/** Personalização para o painel (o que o vendedor salvou). */
export async function getBotAppearanceForEditor(botId: string): Promise<{ ready: boolean; appearance: BotAppearance }> {
  try {
    const row = await db.query.botMiniappAppearance.findFirst({ where: eq(botMiniappAppearance.botId, botId) });
    return {
      ready: true,
      appearance: row
        ? {
            displayName: row.displayName,
            logoUrl: row.logoUrl,
            accentColor: normalizeHex(row.accentColor),
            showExtraButtons: row.showExtraButtons,
            welcomeButtonText: row.welcomeButtonText?.trim() || null,
            theme: normalizeTheme(row.theme),
          }
        : EMPTY_APPEARANCE,
    };
  } catch (e) {
    if (isMissing(e)) return { ready: false, appearance: EMPTY_APPEARANCE };
    throw e;
  }
}

/**
 * Personalização efetiva de um bot no Mini App. Nunca lança: qualquer problema = sem personalização.
 * O bot precisa pertencer à loja informada.
 */
export async function getEffectiveBotAppearance(storeId: string, botId: string | null | undefined): Promise<BotAppearance> {
  if (!botId) return EMPTY_APPEARANCE;
  try {
    if (!(await appearanceAllowedForStore(storeId))) return EMPTY_APPEARANCE;
    const row = await readRow(botId);
    if (!row || row.storeId !== storeId) return EMPTY_APPEARANCE;
    const accent = normalizeHex(row.accentColor);
    return {
      displayName: row.displayName?.trim() || null,
      logoUrl: row.logoUrl?.trim() || null,
      accentColor: accent && accent !== DEFAULT_ACCENT ? accent : null,
      showExtraButtons: row.showExtraButtons,
      welcomeButtonText: row.welcomeButtonText?.trim() || null,
      theme: normalizeTheme(row.theme),
    };
  } catch (e) {
    console.warn("[bot-appearance] falha ao ler personalização (segue sem):", (e as Error)?.message || e);
    return EMPTY_APPEARANCE;
  }
}

/**
 * Botões extras (Carrinho, Meus Acessos, Catálogo, Suporte) na mensagem de boas-vindas.
 * Escondidos para todos; só aparecem quando ligados na Personalização do bot.
 */
export async function welcomeShowsExtraButtons(storeId: string, botId: string | null | undefined): Promise<boolean> {
  return (await getWelcomeKeyboardOptions(storeId, botId)).extraButtons;
}

/**
 * Opções do teclado das boas-vindas: botões extras + texto do botão que abre a loja.
 * Para todas as lojas, as boas-vindas mostram só o botão que abre a loja; Carrinho, Meus Acessos,
 * Catálogo e Suporte aparecem só quando ligados na Personalização do bot.
 */
export async function getWelcomeKeyboardOptions(storeId: string, botId: string | null | undefined): Promise<{ extraButtons: boolean; openLabel: string }> {
  const plain = { extraButtons: false, openLabel: DEFAULT_OPEN_LABEL };
  try {
    if (!botId || !(await appearanceAllowedForStore(storeId))) return plain;
    const row = await readRow(botId);
    if (!row || row.storeId !== storeId) return plain;
    return { extraButtons: Boolean(row.showExtraButtons), openLabel: row.welcomeButtonText?.trim() || DEFAULT_OPEN_LABEL };
  } catch (e) {
    console.warn("[bot-appearance] falha ao ler botões das boas-vindas (só o botão da loja):", (e as Error)?.message || e);
    return plain;
  }
}

export interface SaveAppearanceInput {
  displayName?: string | null;
  logoUrl?: string | null;
  accentColor?: string | null;
  showExtraButtons?: boolean;
  welcomeButtonText?: string | null;
}

export async function saveBotAppearance(storeId: string, botId: string, input: SaveAppearanceInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const bot = await db.query.telegramBots.findFirst({ where: and(eq(telegramBots.id, botId), eq(telegramBots.storeId, storeId)), columns: { id: true } });
  if (!bot) return { ok: false, error: "Bot não encontrado." };
  const displayName = String(input.displayName || "").trim().slice(0, 40) || null;
  const rawLogo = String(input.logoUrl || "").trim();
  if (rawLogo && !/^https:\/\//i.test(rawLogo)) return { ok: false, error: "Logo inválida. Envie a imagem de novo." };
  const accent = normalizeHex(input.accentColor) || DEFAULT_ACCENT;
  const values = {
    displayName,
    logoUrl: rawLogo || null,
    accentColor: accent,
    showExtraButtons: Boolean(input.showExtraButtons),
    // Telegram aceita até 64 bytes no texto do botão; 30 caracteres cabe com folga (inclusive emojis)
    welcomeButtonText: String(input.welcomeButtonText || "").replace(/\s+/g, " ").trim().slice(0, 30) || null,
    updatedAt: new Date(),
  };
  try {
    await db
      .insert(botMiniappAppearance)
      .values({ botId, storeId, ...values })
      .onConflictDoUpdate({ target: botMiniappAppearance.botId, set: values });
    return { ok: true };
  } catch (e) {
    if (isMissing(e)) return { ok: false, error: "Falta rodar as migrations 0036 e 0037 (Personalização do bot) no Neon." };
    throw e;
  }
}

/** Troca o tema do Mini App do bot (null = Padrão). Não mexe no resto da Personalização. */
export async function saveBotTheme(storeId: string, botId: string, theme: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const bot = await db.query.telegramBots.findFirst({ where: and(eq(telegramBots.id, botId), eq(telegramBots.storeId, storeId)), columns: { id: true } });
  if (!bot) return { ok: false, error: "Bot não encontrado." };
  const value = normalizeTheme(theme);
  try {
    await db
      .insert(botMiniappAppearance)
      .values({ botId, storeId, theme: value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: botMiniappAppearance.botId, set: { theme: value, updatedAt: new Date() } });
    return { ok: true };
  } catch (e) {
    if (isMissing(e)) return { ok: false, error: "Falta rodar a migration 0038 (Tema XDs) no Neon." };
    throw e;
  }
}
