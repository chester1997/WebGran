import { cookies } from "next/headers";
import { isLeadSource } from "./lead-sources";
import { cache } from "react";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { stores, users, telegramCustomers, webCustomers, webCustomerSessions } from "@/db/schema";
import { isOwnerUser } from "@/lib/bots/owner-guard";

/**
 * LOJA WEB — esboço em validação.
 * Fica disponível só para a loja da conta proprietária da WebGran. Para qualquer outra loja
 * as páginas /loja/<slug> respondem 404, então nada muda para os lojistas atuais.
 */

export const WEB_PREFIX = "web:";
const SESSION_DAYS = 30;

export type WebStore = typeof stores.$inferSelect;
export type WebCustomer = typeof webCustomers.$inferSelect;

/** Postgres 42P01/42703: as tabelas da migration 0028 ainda não existem. */
export function isMissingWebTables(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string } | null;
  const code = e?.code || e?.cause?.code;
  const msg = String(e?.message || "");
  return code === "42P01" || code === "42703" || /relation "web_(customers|customer_sessions|support_tickets)" does not exist/i.test(msg);
}

/** Loja liberada para a Loja Web? (fase de testes: só a loja do proprietário) */
/** Mesma loja pedida várias vezes na mesma página (layout, página, metadados): uma consulta só. */
export const getWebStore = cache(loadWebStore);

async function loadWebStore(slug: string): Promise<WebStore | null> {
  const store = await db.query.stores.findFirst({ where: eq(stores.slug, slug) });
  if (!store || store.status !== "active") return null;
  const owner = await db.query.users.findFirst({ where: eq(users.id, store.ownerId), columns: { id: true, email: true } });
  if (!isOwnerUser(owner)) return null;
  return store;
}

/** As tabelas da Loja Web já foram criadas no banco? */
export async function webTablesReady(): Promise<boolean> {
  try {
    await db.select({ id: webCustomers.id }).from(webCustomers).limit(1);
    return true;
  } catch (err) {
    if (isMissingWebTables(err)) return false;
    throw err;
  }
}

const cookieName = (storeId: string) => `wg_loja_${storeId.replace(/-/g, "").slice(0, 12)}`;
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
export const onlyDigits = (s: string) => s.replace(/\D/g, "");

export async function openSession(storeId: string, webCustomerId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(webCustomerSessions).values({ webCustomerId, tokenHash: hashToken(token), expiresAt });
  const jar = await cookies();
  jar.set(cookieName(storeId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Cliente logado nesta loja (ou null). */
export async function getWebCustomer(storeId: string): Promise<WebCustomer | null> {
  const jar = await cookies();
  const token = jar.get(cookieName(storeId))?.value;
  if (!token) return null;
  try {
    const rows = await db
      .select({ c: webCustomers })
      .from(webCustomerSessions)
      .innerJoin(webCustomers, eq(webCustomers.id, webCustomerSessions.webCustomerId))
      .where(and(eq(webCustomerSessions.tokenHash, hashToken(token)), gt(webCustomerSessions.expiresAt, new Date())))
      .limit(1);
    const c = rows[0]?.c;
    if (!c || c.storeId !== storeId || c.status !== "active") return null;
    return c;
  } catch (err) {
    if (isMissingWebTables(err)) return null;
    throw err;
  }
}

export async function closeWebSession(storeId: string) {
  const jar = await cookies();
  const token = jar.get(cookieName(storeId))?.value;
  if (token) {
    await db.delete(webCustomerSessions).where(eq(webCustomerSessions.tokenHash, hashToken(token))).catch(() => {});
  }
  jar.delete(cookieName(storeId));
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  whatsapp?: string;
  telegram?: string;
  leadSource?: string;
}

export function validateRegister(i: RegisterInput): string | null {
  if (i.name.trim().length < 2) return "Informe seu nome.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(i.email))) return "E-mail inválido.";
  if (i.password.length < 6) return "A senha precisa ter pelo menos 6 caracteres.";
  const wa = onlyDigits(i.whatsapp || "");
  const tg = (i.telegram || "").trim().replace(/^@/, "");
  if (!wa && !tg) return "Informe seu WhatsApp ou seu Telegram para o suporte falar com você.";
  if (wa && (wa.length < 10 || wa.length > 13)) return "WhatsApp inválido. Use DDD + número.";
  if (tg && !/^[A-Za-z0-9_]{4,32}$/.test(tg)) return "Usuário do Telegram inválido.";
  if (!isLeadSource(i.leadSource)) return "Conte pra gente de onde você conheceu a loja.";
  return null;
}

export async function registerWebCustomer(store: WebStore, input: RegisterInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const err = validateRegister(input);
  if (err) return { ok: false, error: err };
  const email = normalizeEmail(input.email);
  try {
    const exists = await db.query.webCustomers.findFirst({ where: and(eq(webCustomers.storeId, store.id), eq(webCustomers.email, email)) });
    if (exists) return { ok: false, error: "Já existe uma conta com esse e-mail. Faça login." };

    const passwordHash = await bcrypt.hash(input.password, 10);
    const name = input.name.trim().slice(0, 80);
    const id = crypto.randomUUID();
    // Cliente sombra: é por ele que carrinho, pedidos e acessos funcionam (mesmo motor do Mini App).
    const [shadow] = await db
      .insert(telegramCustomers)
      .values({ storeId: store.id, telegramUserId: `${WEB_PREFIX}${id}`, firstName: name, username: null })
      .returning({ id: telegramCustomers.id });
    try {
      await db.insert(webCustomers).values({
        id,
        storeId: store.id,
        shadowCustomerId: shadow.id,
        name,
        email,
        passwordHash,
        whatsapp: onlyDigits(input.whatsapp || "") || null,
        telegram: (input.telegram || "").trim().replace(/^@/, "") || null,
        leadSource: isLeadSource(input.leadSource) ? input.leadSource : null,
        lastLoginAt: new Date(),
      });
    } catch (insertErr) {
      // Não deixa cliente sombra solto (ex.: e-mail cadastrado ao mesmo tempo em outra aba).
      await db.delete(telegramCustomers).where(eq(telegramCustomers.id, shadow.id)).catch(() => {});
      throw insertErr;
    }
    await openSession(store.id, id);
    return { ok: true };
  } catch (e) {
    if (isMissingWebTables(e)) return { ok: false, error: "A Loja Web ainda não foi ativada no banco." };
    console.error("[WebStore] Falha no cadastro:", e);
    return { ok: false, error: "Não foi possível criar sua conta agora." };
  }
}

export async function loginWebCustomer(store: WebStore, emailRaw: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normalizeEmail(emailRaw);
  try {
    const c = await db.query.webCustomers.findFirst({ where: and(eq(webCustomers.storeId, store.id), eq(webCustomers.email, email)) });
    const valid = c ? await bcrypt.compare(password, c.passwordHash) : false;
    if (!c || !valid) return { ok: false, error: "E-mail ou senha incorretos." };
    if (c.status !== "active") return { ok: false, error: "Esta conta está bloqueada. Fale com o suporte da loja." };
    await db.update(webCustomers).set({ lastLoginAt: new Date() }).where(eq(webCustomers.id, c.id));
    await openSession(store.id, c.id);
    return { ok: true };
  } catch (e) {
    if (isMissingWebTables(e)) return { ok: false, error: "A Loja Web ainda não foi ativada no banco." };
    console.error("[WebStore] Falha no login:", e);
    return { ok: false, error: "Não foi possível entrar agora." };
  }
}

/** Link de contato do cliente (para o lojista falar com ele). */
export function customerContactLinks(c: { whatsapp: string | null; telegram: string | null; email: string }) {
  const wa = c.whatsapp ? onlyDigits(c.whatsapp) : "";
  return {
    whatsapp: wa ? `https://wa.me/${wa.length <= 11 ? `55${wa}` : wa}` : null,
    telegram: c.telegram ? `https://t.me/${c.telegram}` : null,
    email: `mailto:${c.email}`,
  };
}
