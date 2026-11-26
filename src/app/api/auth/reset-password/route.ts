import { NextResponse } from "next/server";
import { setNewPassword, verifyResetToken } from "@/lib/auth/password-reset";

/** Cadastra a nova senha a partir do link do e-mail. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body?.token || "");
  const password = String(body?.password || "");
  if (password.length < 6) return NextResponse.json({ error: "A senha precisa ter pelo menos 6 caracteres." }, { status: 400 });
  if (password.length > 128) return NextResponse.json({ error: "Senha muito longa." }, { status: 400 });
  const user = await verifyResetToken(token);
  if (!user) {
    return NextResponse.json({ error: "Este link venceu ou já foi usado. Peça um novo em “Esqueci minha senha”." }, { status: 400 });
  }
  await setNewPassword(user.id, password);
  return NextResponse.json({ ok: true, email: user.email });
}
