import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Recuperação de senha dos lojistas (login da plataforma).
 *
 * O link não fica salvo no banco: é assinado com o segredo do NextAuth e com o hash da senha
 * atual. Vale por 1 hora e só uma vez: depois que a senha muda, a assinatura deixa de bater.
 */
const TTL_MS = 60 * 60 * 1000;

function secret() {
  const s = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET ausente");
  return s;
}

function sign(userId: string, exp: number, passwordHash: string) {
  return createHmac("sha256", secret()).update(`${userId}.${exp}.${passwordHash}`).digest("base64url");
}

export function appUrl() {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://webgran.com.br").replace(/\/+$/, "");
}

export async function findUserByEmail(email: string) {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  const [u] = await db
    .select({ id: users.id, name: users.name, email: users.email, password: users.password })
    .from(users)
    .where(sql`lower(trim(${users.email})) = ${e}`)
    .limit(1);
  return u || null;
}

export function createResetToken(user: { id: string; password: string }) {
  const exp = Date.now() + TTL_MS;
  return Buffer.from(`${user.id}.${exp}.${sign(user.id, exp, user.password)}`).toString("base64url");
}

/** Confere o link e devolve o usuário, ou null se for inválido/vencido/já usado. */
export async function verifyResetToken(token: string) {
  let raw = "";
  try {
    raw = Buffer.from(String(token || ""), "base64url").toString("utf8");
  } catch {
    return null;
  }
  const [id, expStr, sig] = raw.split(".");
  const exp = Number(expStr);
  if (!id || !sig || !Number.isFinite(exp) || exp < Date.now()) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const u = await db.query.users.findFirst({ where: eq(users.id, id), columns: { id: true, email: true, password: true } });
  if (!u) return null;
  const expected = Buffer.from(sign(u.id, exp, u.password));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  return u;
}

export async function setNewPassword(userId: string, password: string) {
  const hash = await bcrypt.hash(password, 10);
  await db.update(users).set({ password: hash, updatedAt: new Date() }).where(eq(users.id, userId));
}

/** Envia o e-mail pelo Resend (RESEND_API_KEY + EMAIL_FROM na Vercel). */
export async function sendResetEmail(to: string, name: string, link: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "WebGran <onboarding@resend.dev>";
  if (!key) {
    console.warn("[password-reset] RESEND_API_KEY não configurada; e-mail não enviado.");
    return false;
  }
  const first = (name || "").trim().split(/\s+/)[0] || "";
  const html = `<!doctype html><html><body style="margin:0;background:#05060a;font-family:Arial,Helvetica,sans-serif;color:#e4e4e7">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#05060a;padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#0b0d12;border:1px solid #1f2a3d;border-radius:16px;padding:32px">
<tr><td style="font-size:20px;font-weight:800;color:#ffffff">WebGran</td></tr>
<tr><td style="padding-top:20px;font-size:16px;font-weight:700;color:#ffffff">Redefinir sua senha</td></tr>
<tr><td style="padding-top:10px;font-size:14px;line-height:22px;color:#a1a1aa">Olá${first ? ` ${first}` : ""}, recebemos um pedido para criar uma nova senha na sua conta WebGran. Clique no botão abaixo para cadastrar a nova senha.</td></tr>
<tr><td style="padding-top:24px"><a href="${link}" style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 24px;border-radius:10px">Criar nova senha</a></td></tr>
<tr><td style="padding-top:24px;font-size:12px;line-height:19px;color:#71717a">O link vale por 1 hora e só pode ser usado uma vez. Se não foi você que pediu, pode ignorar este e-mail: sua senha continua a mesma.</td></tr>
</table></td></tr></table></body></html>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Redefinir sua senha da WebGran",
        html,
        text: `Para criar uma nova senha na WebGran, abra: ${link}\nO link vale por 1 hora.`,
      }),
    });
    if (!res.ok) console.error("[password-reset] Resend respondeu", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("[password-reset] falha ao enviar", err);
    return false;
  }
}
