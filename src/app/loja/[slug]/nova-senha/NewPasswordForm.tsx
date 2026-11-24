"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { resetPasswordAction } from "../actions";
import { BTN_PRIMARY, CARD, ErrorBox, INPUT, Label } from "../_components/ui";

export function NewPasswordForm({ slug, token, email }: { slug: string; token: string; email: string }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) {
      setError("As duas senhas não são iguais.");
      return;
    }
    start(async () => {
      setError(null);
      const r = await resetPasswordAction(slug, token, pw);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/loja/${slug}/conta`);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-[440px] px-4 py-10 sm:py-16">
      <div className={`${CARD} p-6 sm:p-7`}>
        <h1 className="text-[22px] font-semibold tracking-tight">Criar nova senha</h1>
        <p className="mt-1 text-[13.5px] text-zinc-500">Conta {email}</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <Label hint="mínimo 6 caracteres">Nova senha</Label>
            <span className="relative block">
              <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} className={`${INPUT} pr-11`} autoComplete="new-password" required minLength={6} maxLength={100} />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Esconder senha" : "Mostrar senha"} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-[6px] flex items-center justify-center text-zinc-500 hover:text-white">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </span>
          </label>
          <label className="block">
            <Label>Repita a nova senha</Label>
            <input type={show ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)} className={INPUT} autoComplete="new-password" required minLength={6} maxLength={100} />
          </label>
          {error && <ErrorBox>{error}</ErrorBox>}
          <button type="submit" className={`${BTN_PRIMARY} w-full h-12 text-[15px]`} disabled={pending}>
            {pending ? "Salvando..." : "Salvar e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
