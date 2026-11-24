import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { telegramCustomers, webCustomers, webCustomerSessions, webSupportTickets } from "@/db/schema";
import { normalizeEmail, onlyDigits, type WebCustomer, type WebStore } from "./web-store";

/* ----------------------------- perfil ----------------------------- */

/** Foto do cliente: fica no cliente sombra (telegram_customers.photo_url), sem migration nova. */
export async function getWebAvatar(shadowCustomerId: string): Promise<string | null> {
  const row = await db.query.telegramCustomers.findFirst({ where: eq(telegramCustomers.id, shadowCustomerId), columns: { photoUrl: true } });
  return row?.photoUrl || null;
}

export async function setWebAvatar(shadowCustomerId: string, url: string | null) {
  await db.update(telegramCustomers).set({ photoUrl: url, updatedAt: new Date() }).where(eq(telegramCustomers.id, shadowCustomerId));
}

export interface ProfileInput {
  name: string;
  whatsapp: string;
  telegram: string;
}

export async function updateWebProfile(c: WebCustomer, raw: ProfileInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = String(raw.name || "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (name.length < 2) return { ok: false, error: "Informe seu nome." };
  const wa = onlyDigits(String(raw.whatsapp || ""));
  const tg = String(raw.telegram || "").trim().replace(/^@/, "");
  if (!wa && !tg) return { ok: false, error: "Deixe pelo menos um contato (WhatsApp ou Telegram) para o suporte falar com você." };
  if (wa && (wa.length < 10 || wa.length > 13)) return { ok: false, error: "WhatsApp inválido. Use DDD + número." };
  if (tg && !/^[A-Za-z0-9_]{4,32}$/.test(tg)) return { ok: false, error: "Usuário do Telegram inválido." };
  await db.update(webCustomers).set({ name, whatsapp: wa || null, telegram: tg || null, updatedAt: new Date() }).where(eq(webCustomers.id, c.id));
  await db.update(telegramCustomers).set({ firstName: name, updatedAt: new Date() }).where(eq(telegramCustomers.id, c.shadowCustomerId));
  return { ok: true };
}

export async function changeWebPassword(c: WebCustomer, current: string, next: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await bcrypt.compare(String(current || ""), c.passwordHash))) return { ok: false, error: "A senha atual não confere." };
  if (String(next || "").length < 6) return { ok: false, error: "A nova senha precisa ter pelo menos 6 caracteres." };
  if (next === current) return { ok: false, error: "Escolha uma senha diferente da atual." };
  const passwordHash = await bcrypt.hash(next, 10);
  await db.update(webCustomers).set({ passwordHash, updatedAt: new Date() }).where(eq(webCustomers.id, c.id));
  return { ok: true };
}

/* ------------------------- recuperar senha ------------------------- */
/*
 * Sem serviço de e-mail ainda: o cliente pede ajuda, o pedido cai no Suporte da Loja Web,
 * e o lojista gera um link de nova senha e manda pelo WhatsApp/Telegram/e-mail do cliente.
 * O link é assinado (HMAC), vale 24 h e deixa de valer assim que a senha muda.
 */

const RESET_HOURS = 24;
export const RESET_SUBJECT = "Recuperar senha";

function secret() {
  const s = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!s) throw new Error("Segredo de assinatura não configurado.");
  return s;
}

const sign = (payload: string, passwordHash: string) =>
  createHmac("sha256", secret()).update(`${payload}|${passwordHash}`).digest("base64url");

export function makeResetToken(c: { id: string; passwordHash: string }) {
  const exp = Date.now() + RESET_HOURS * 3600_000;
  const payload = Buffer.from(`${c.id}.${exp}`).toString("base64url");
  return `${payload}.${sign(payload, c.passwordHash)}`;
}

/** Cliente dono do link (ou null se inválido, vencido ou já usado). */
export async function readResetToken(storeId: string, token: string): Promise<WebCustomer | null> {
  const [payload, sig] = String(token || "").split(".");
  if (!payload || !sig) return null;
  const [id = "", expRaw = ""] = Buffer.from(payload, "base64url").toString().split(".");
  const exp = Number(expRaw);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(exp > Date.now())) return null;
  const c = await db.query.webCustomers.findFirst({ where: and(eq(webCustomers.id, id), eq(webCustomers.storeId, storeId)) });
  if (!c || c.status !== "active") return null;
  const good = Buffer.from(sign(payload, c.passwordHash));
  const got = Buffer.from(sig);
  return good.length === got.length && timingSafeEqual(good, got) ? c : null;
}

export async function resetWebPassword(storeId: string, token: string, next: string): Promise<{ ok: true; customer: WebCustomer } | { ok: false; error: string }> {
  const c = await readResetToken(storeId, token);
  if (!c) return { ok: false, error: "Este link não vale mais. Peça um novo para a loja." };
  if (String(next || "").length < 6) return { ok: false, error: "A nova senha precisa ter pelo menos 6 caracteres." };
  const passwordHash = await bcrypt.hash(next, 10);
  await db.update(webCustomers).set({ passwordHash, updatedAt: new Date() }).where(eq(webCustomers.id, c.id));
  // derruba as sessões antigas
  await db.delete(webCustomerSessions).where(eq(webCustomerSessions.webCustomerId, c.id));
  return { ok: true, customer: c };
}

/** Pedido de "esqueci minha senha": vira um pedido no Suporte da Loja Web. Resposta sempre neutra. */
export async function requestPasswordHelp(store: WebStore, emailRaw: string, contactVia: string) {
  const email = normalizeEmail(String(emailRaw || ""));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false as const, error: "E-mail inválido." };
  const c = await db.query.webCustomers.findFirst({ where: and(eq(webCustomers.storeId, store.id), eq(webCustomers.email, email)) });
  if (!c || c.status !== "active") return { ok: true as const };
  const recent = await db.query.webSupportTickets.findFirst({
    where: and(
      eq(webSupportTickets.webCustomerId, c.id),
      eq(webSupportTickets.subject, RESET_SUBJECT),
      eq(webSupportTickets.status, "open"),
      gt(webSupportTickets.createdAt, new Date(Date.now() - 6 * 3600_000))
    ),
    columns: { id: true },
  });
  if (recent) return { ok: true as const };
  const via = ["whatsapp", "telegram", "email"].includes(contactVia) ? contactVia : c.whatsapp ? "whatsapp" : c.telegram ? "telegram" : "email";
  await db.insert(webSupportTickets).values({
    storeId: store.id,
    webCustomerId: c.id,
    subject: RESET_SUBJECT,
    message: "Esqueci minha senha. Pode me mandar um link para criar uma nova?",
    contactVia: via,
  });
  return { ok: true as const };
}
