import { eq } from "drizzle-orm";
import { db } from "@/db";
import { webStoreSettings } from "@/db/schema";

export interface WebBranding {
  displayName: string | null;
  logoUrl: string | null;
  promoImageUrl: string | null;
}

const EMPTY: WebBranding = { displayName: null, logoUrl: null, promoImageUrl: null };

export function isMissingSettingsTable(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string } | null;
  const code = e?.code || e?.cause?.code;
  return code === "42P01" || /relation "web_store_settings" does not exist/i.test(String(e?.message || ""));
}

/** Aparência da Loja Web. `ready=false` quando a migration 0030 ainda não rodou (a loja usa o nome da loja). */
export async function getWebBranding(storeId: string): Promise<{ ready: boolean; branding: WebBranding }> {
  try {
    const row = await db.query.webStoreSettings.findFirst({ where: eq(webStoreSettings.storeId, storeId) });
    return {
      ready: true,
      branding: row ? { displayName: row.displayName, logoUrl: row.logoUrl, promoImageUrl: row.promoImageUrl } : EMPTY,
    };
  } catch (err) {
    if (isMissingSettingsTable(err)) return { ready: false, branding: EMPTY };
    throw err;
  }
}

const cleanUrl = (u: unknown) => {
  const s = typeof u === "string" ? u.trim() : "";
  return /^https:\/\/\S+$/i.test(s) && s.length <= 1000 ? s : null;
};

export function normalizeBranding(raw: Partial<WebBranding>): { ok: true; value: WebBranding } | { ok: false; error: string } {
  const name = typeof raw.displayName === "string" ? raw.displayName.trim().replace(/\s+/g, " ") : "";
  if (name.length > 40) return { ok: false, error: "O nome pode ter no máximo 40 caracteres." };
  return { ok: true, value: { displayName: name || null, logoUrl: cleanUrl(raw.logoUrl), promoImageUrl: cleanUrl(raw.promoImageUrl) } };
}

export async function saveWebBranding(storeId: string, v: WebBranding) {
  await db
    .insert(webStoreSettings)
    .values({ storeId, ...v, updatedAt: new Date() })
    .onConflictDoUpdate({ target: webStoreSettings.storeId, set: { ...v, updatedAt: new Date() } });
}
