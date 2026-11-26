import { NextResponse } from "next/server";
import { appUrl, createResetToken, findUserByEmail, sendResetEmail } from "@/lib/auth/password-reset";

// Evita disparar vários e-mails seguidos para o mesmo endereço (por instância)
const last = new Map<string, number>();

/** Pede o link de nova senha. Sempre responde igual, para não revelar quais e-mails têm conta. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Digite um e-mail válido." }, { status: 400 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "A recuperação por e-mail está indisponível no momento. Fale com o suporte da WebGran para trocar sua senha." },
      { status: 503 }
    );
  }
  const now = Date.now();
  if ((last.get(email) || 0) > now - 60_000) return NextResponse.json({ ok: true });
  last.set(email, now);

  try {
    const user = await findUserByEmail(email);
    if (user && user.password) {
      const link = `${appUrl()}/redefinir-senha?token=${createResetToken(user)}`;
      await sendResetEmail(user.email, user.name, link);
    }
  } catch (err) {
    console.error("[forgot-password]", err);
  }
  return NextResponse.json({ ok: true });
}
