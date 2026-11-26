import { NextResponse } from "next/server";
import { findSellerForReset, setNewPassword } from "@/lib/auth/password-reset";

// Freio simples contra tentativas em massa (por instância): 10 pedidos a cada 10 min por IP
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => t > now - 10 * 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 10;
}

const BLOCKED = "Esta conta não pode trocar a senha por aqui. Fale com o suporte da WebGran.";
const NOT_FOUND = "Não encontramos uma conta com este e-mail.";

/**
 * Esqueci minha senha.
 * - { email }: só confere se o e-mail tem conta (passo 1 da tela).
 * - { email, password }: grava a nova senha, que passa a valer na hora.
 */
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  if (limited(ip)) return NextResponse.json({ error: "Muitas tentativas. Espere alguns minutos e tente de novo." }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Digite um e-mail válido." }, { status: 400 });

  const user = await findSellerForReset(email);
  if (!user) return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
  if (user.blocked) return NextResponse.json({ error: BLOCKED }, { status: 403 });

  if (body?.password === undefined) return NextResponse.json({ ok: true });

  const password = String(body.password || "");
  if (password.length < 6) return NextResponse.json({ error: "A senha precisa ter pelo menos 6 caracteres." }, { status: 400 });
  if (password.length > 128) return NextResponse.json({ error: "Senha muito longa." }, { status: 400 });
  await setNewPassword(user.id, password);
  return NextResponse.json({ ok: true, email: user.email });
}
