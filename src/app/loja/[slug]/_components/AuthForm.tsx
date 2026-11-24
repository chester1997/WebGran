"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { loginAction, registerAction } from "../actions";
import { BTN_PRIMARY, CARD, ErrorBox, INPUT, Label } from "./ui";

export function AuthForm({ slug, mode, next }: { slug: string; mode: "login" | "register"; next: string }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", password: "", whatsapp: "", telegram: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const target = next === "carrinho" ? `/loja/${slug}/carrinho` : `/loja/${slug}/conta`;
  const q = next ? `?next=${encodeURIComponent(next)}` : "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      const res = mode === "login" ? await loginAction(slug, f.email, f.password) : await registerAction(slug, f);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(target);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-[440px] px-4 py-10 sm:py-16">
      <div className={`${CARD} p-6 sm:p-7`}>
        <h1 className="text-[22px] font-semibold tracking-tight">{mode === "login" ? "Entrar na sua conta" : "Criar sua conta"}</h1>
        <p className="mt-1 text-[13.5px] text-zinc-500">
          {mode === "login" ? "Acesse seus produtos e acompanhe seus pedidos." : "Seus produtos ficam salvos aqui depois da compra."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "register" && (
            <label className="block">
              <Label>Nome</Label>
              <input value={f.name} onChange={set("name")} className={INPUT} autoComplete="name" required maxLength={80} placeholder="Seu nome" />
            </label>
          )}
          <label className="block">
            <Label>E-mail</Label>
            <input type="email" value={f.email} onChange={set("email")} className={INPUT} autoComplete="email" required maxLength={120} placeholder="voce@email.com" />
          </label>
          <label className="block">
            <Label hint={mode === "register" ? "mínimo 6 caracteres" : undefined}>Senha</Label>
            <span className="relative block">
              <input
                type={show ? "text" : "password"}
                value={f.password}
                onChange={set("password")}
                className={`${INPUT} pr-11`}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={mode === "register" ? 6 : undefined}
                maxLength={100}
              />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Esconder senha" : "Mostrar senha"} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-[8px] flex items-center justify-center text-zinc-500 hover:text-white">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </span>
          </label>
          {mode === "register" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label>WhatsApp</Label>
                  <input value={f.whatsapp} onChange={set("whatsapp")} inputMode="tel" className={INPUT} autoComplete="tel" maxLength={20} placeholder="(11) 99999-9999" />
                </label>
                <label className="block">
                  <Label>Telegram</Label>
                  <input value={f.telegram} onChange={set("telegram")} className={INPUT} maxLength={33} placeholder="@usuario" />
                </label>
              </div>
              <p className="text-[12px] text-zinc-500 -mt-1">Preencha pelo menos um. É por ele que a loja fala com você se o acesso não chegar.</p>
            </>
          )}
          {error && <ErrorBox>{error}</ErrorBox>}
          <button type="submit" className={`${BTN_PRIMARY} w-full h-12 text-[15px]`} disabled={pending}>
            {pending ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>
        <p className="mt-5 text-center text-[13.5px] text-zinc-500">
          {mode === "login" ? (
            <>
              Ainda não tem conta?{" "}
              <Link href={`/loja/${slug}/cadastro${q}`} className="text-[#7fb0ff] hover:underline font-medium">
                Criar conta
              </Link>
            </>
          ) : (
            <>
              Já tem conta?{" "}
              <Link href={`/loja/${slug}/entrar${q}`} className="text-[#7fb0ff] hover:underline font-medium">
                Entrar
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
