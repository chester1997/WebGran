import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { sellerContacts } from "@/db/schema";

/** Contatos do vendedor (WhatsApp e Telegram) informados no cadastro. Tabela da migration 0031. */

export const onlyDigits = (s: string) => String(s || "").replace(/\D/g, "");
export const cleanTelegram = (s: string) => String(s || "").trim().replace(/^https?:\/\/t\.me\//i, "").replace(/^@/, "");

export function validateSellerContacts(whatsappRaw: string, telegramRaw: string): string | null {
  const wa = onlyDigits(whatsappRaw);
  const tg = cleanTelegram(telegramRaw);
  if (!wa) return "Informe seu WhatsApp com DDD.";
  if (wa.length < 10 || wa.length > 13) return "WhatsApp inválido. Use DDD + número.";
  if (!tg) return "Informe seu usuário do Telegram (@usuario).";
  if (!/^[A-Za-z0-9_]{4,32}$/.test(tg)) return "Usuário do Telegram inválido.";
  return null;
}

function isMissingTable(err: unknown) {
  const e = err as { code?: string; cause?: { code?: string }; message?: string } | null;
  const code = e?.code || e?.cause?.code;
  return code === "42P01" || /relation "seller_contacts" does not exist/i.test(String(e?.message || ""));
}

/** Salva os contatos. Se a migration ainda não rodou, não quebra o cadastro. */
export async function saveSellerContacts(userId: string, whatsappRaw: string, telegramRaw: string) {
  const whatsapp = onlyDigits(whatsappRaw) || null;
  const telegram = cleanTelegram(telegramRaw) || null;
  try {
    await db
      .insert(sellerContacts)
      .values({ userId, whatsapp, telegram })
      .onConflictDoUpdate({ target: sellerContacts.userId, set: { whatsapp, telegram, updatedAt: new Date() } });
  } catch (err) {
    if (isMissingTable(err)) {
      console.warn("[SellerContacts] Tabela seller_contacts ainda não existe (rode a migration 0031).");
      return;
    }
    console.error("[SellerContacts] Falha ao salvar contatos:", err);
  }
}

export async function loadSellerContacts(userIds: string[]): Promise<Map<string, { whatsapp: string | null; telegram: string | null }>> {
  const map = new Map<string, { whatsapp: string | null; telegram: string | null }>();
  if (!userIds.length) return map;
  try {
    const rows = await db.select().from(sellerContacts).where(inArray(sellerContacts.userId, userIds));
    for (const r of rows) map.set(r.userId, { whatsapp: r.whatsapp, telegram: r.telegram });
  } catch (err) {
    if (!isMissingTable(err)) console.error("[SellerContacts] Falha ao ler contatos:", err);
  }
  return map;
}
