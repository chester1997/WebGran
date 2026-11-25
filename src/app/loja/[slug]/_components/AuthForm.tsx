"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { loginAction, registerAction } from "../actions";
import { AUTH_CARD, BTN_PRIMARY, ErrorBox, INPUT as BASE_INPUT, Label } from "./ui";

// Telas baixas (notebook): tudo um pouco mais compacto para caber sem rolar
const INPUT = `${BASE_INPUT} [@media(max-height:860px)]:h-10`;
import { LEAD_SOURCES } from "@/lib/webstore/lead-sources";
import { LeadSourceIcon } from "@/components/webstore/LeadSourceIcon";

export function AuthForm({ slug, mode, next }: { slug: string; mode: "login" | "register"; next: string }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", password: "", whatsapp: "", telegram: "", leadSource: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceMissing, setSourceMissing] = useState(false);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const target = next === "carrinho" ? `/loja/${slug}/carrinho` : `/loja/${slug}/conta`;
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  const isLogin = mode === "login";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin && !f.leadSource) {
      setSourceMissing(true);
      setError("Conte pra gente de onde você conheceu a loja.");
      return;
    }
    start(async () => {
      setError(null);
      const res = isLogin ? await loginAction(slug, f.email, f.password) : await registerAction(slug, f);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(target);
      router.refresh();
    });
  };

  const Icon = isLogin ? LogIn : UserPlus;

  return (
    <div className="mx-auto w-full max-w-[460px]">
      <div className={`${AUTH_CARD} [@media(max-height:860px)]:p-5 [@media(max-height:860px)]:sm:p-6`}>
        <div className="flex items-center gap-3.5">
          <span className={`w-11 h-11 [@media(max-height:860px)]:w-10 [@media(max-height:860px)]:h-10 rounded-[13px] bg-[linear-gradient(160deg,#4f8ff7,#2563eb)] text-white flex items-center justify-center shrink-0 shadow-[0_14px_30px_-12px_rgba(59,130,246,0.9)]`}>
            <Icon className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[21px] font-bold tracking-tight leading-tight">{isLogin ? "Bem-vindo de volta" : "Criar sua conta"}</h1>
            <p className="mt-0.5 text-[13px] text-zinc-400">{isLogin ? "Entre para assistir seus conteúdos." : "Leva menos de um minuto."}</p>
          </div>
        </div>

        <form onSubmit={submit} className={`mt-5 [@media(max-height:860px)]:mt-4 ${isLogin ? "space-y-4" : `space-y-3 [@media(max-height:860px)]:space-y-2.5`}`}>
          {!isLogin && (
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
            <Label hint={!isLogin ? "mínimo 6 caracteres" : undefined}>Senha</Label>
            <span className="relative block">
              <input
                type={show ? "text" : "password"}
                value={f.password}
                onChange={set("password")}
                className={`${INPUT} pr-11`}
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                minLength={!isLogin ? 6 : undefined}
                maxLength={100}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Esconder senha" : "Mostrar senha"}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-[8px] flex items-center justify-center text-zinc-500 hover:text-white"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </span>
          </label>
          {isLogin && (
            <div className="-mt-2 text-right">
              <Link href={`/loja/${slug}/recuperar`} className="text-[12.5px] text-[#7fb0ff] hover:underline">
                Esqueci minha senha
              </Link>
            </div>
          )}
          {!isLogin && (
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
              <p className="text-[11.5px] text-zinc-500 -mt-1 leading-snug [@media(max-height:800px)]:hidden">Preencha pelo menos um: é por ele que a loja fala com você.</p>

              <fieldset>
                <legend className="w-full">
                  <Label hint={<span className={sourceMissing && !f.leadSource ? "text-red-300" : ""}>obrigatório</span>}>Como você conheceu a loja?</Label>
                </legend>
                <div
                  role="radiogroup"
                  aria-label="Como você conheceu a loja"
                  className={`grid grid-cols-5 gap-1 sm:gap-1.5 rounded-[12px] p-1 sm:p-1.5 border transition-colors ${
                    sourceMissing && !f.leadSource ? "border-red-500/40 bg-red-500/[0.04]" : "border-white/[0.07] bg-black/20"
                  }`}
                >
                  {LEAD_SOURCES.map((s) => {
                    const on = f.leadSource === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          setF((v) => ({ ...v, leadSource: s.id }));
                          if (sourceMissing) setError(null);
                        }}
                        className={`min-w-0 h-[52px] [@media(max-height:860px)]:h-[46px] rounded-[9px] flex flex-col items-center justify-center gap-1.5 border transition-colors ${
                          on
                            ? "bg-[#3b82f6]/15 border-[#3b82f6]/70 text-white"
                            : "bg-white/[0.02] border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                        }`}
                      >
                        <LeadSourceIcon source={s.id} size={19} className={on ? "text-[#3b82f6]" : ""} />
                        <span className="text-[9.5px] min-[400px]:text-[10.5px] font-medium leading-none tracking-tight truncate max-w-full">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </>
          )}
          {error && <ErrorBox>{error}</ErrorBox>}
          <button type="submit" className={`${BTN_PRIMARY} w-full h-12 [@media(max-height:860px)]:h-11 text-[15px] rounded-[10px]`} disabled={pending}>
            {pending ? "Aguarde..." : isLogin ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <div className={`mt-5 pt-4 [@media(max-height:860px)]:mt-4 [@media(max-height:860px)]:pt-3 border-t border-white/[0.06] text-center text-[13.5px] text-zinc-500`}>
          {isLogin ? (
            <>
              Ainda não tem conta?{" "}
              <Link href={`/loja/${slug}/cadastro${q}`} className="text-[#7fb0ff] hover:underline font-semibold">
                Criar conta grátis
              </Link>
            </>
          ) : (
            <>
              Já tem conta?{" "}
              <Link href={`/loja/${slug}/entrar${q}`} className="text-[#7fb0ff] hover:underline font-semibold">
                Entrar
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
