"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, User, ShoppingBag, ArrowRight, Loader2, ShieldCheck, Phone, AtSign, Eye, EyeOff, LogIn, Store, type LucideIcon } from "lucide-react";
import { AuthShowcase } from "./AuthShowcase";

// Telas baixas (notebook): campos um pouco mais compactos para caber sem rolar
const INPUT =
  "w-full h-11 [@media(max-height:860px)]:h-10 bg-[#0f1116] border border-white/[0.09] rounded-[10px] pl-10 pr-4 text-[14px] text-white placeholder:text-zinc-600 outline-none focus:border-[#3b82f6]/70 focus:ring-[3px] focus:ring-[#3b82f6]/15 transition";
const LABEL = "flex items-baseline justify-between gap-2 mb-1.5 text-[12.5px] font-medium text-zinc-300";

function Field({ label, hint, icon: I, children }: { label: string; hint?: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={LABEL}>
        <span>{label}</span>
        {hint && <span className="text-[11px] font-normal text-zinc-500">{hint}</span>}
      </span>
      <span className="relative block">
        <I className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        {children}
      </span>
    </label>
  );
}

interface AuthContainerProps {
  initialMode?: "login" | "register";
}

export function AuthContainer({ initialMode = "login" }: AuthContainerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";

  const [mode, setMode] = useState<"login" | "register">(initialMode);
  
  // Login Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Register Form State
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regStoreName, setRegStoreName] = useState("");
  const [regWhatsapp, setRegWhatsapp] = useState("");
  const [regTelegram, setRegTelegram] = useState("");
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    const res = await signIn("credentials", {
      redirect: false,
      email: loginEmail,
      password: loginPassword,
      callbackUrl,
    });

    if (res?.error) {
      setLoginError("Credenciais inválidas. Verifique seu e-mail e senha.");
      setLoginLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  };

  // Handle Register Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    setRegError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          storeName: regStoreName,
          whatsapp: regWhatsapp,
          telegram: regTelegram,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ocorreu um erro ao criar a conta.");
      }

      // Auto login after register
      const loginRes = await signIn("credentials", {
        redirect: false,
        email: regEmail,
        password: regPassword,
      });

      if (loginRes?.error) {
        throw new Error("Conta criada com sucesso! Faça login para continuar.");
      }

      router.push("/seller");
      router.refresh();
    } catch (err) {
      setRegError(err instanceof Error ? err.message : "Ocorreu um erro ao criar a conta.");
      setRegLoading(false);
    }
  };

  const isLogin = mode === "login";
  const switchTo = (m: "login" | "register") => {
    setMode(m);
    setLoginError("");
    setRegError("");
  };
  const eye = (
    <button
      type="button"
      onClick={() => setShowPass((v) => !v)}
      aria-label={showPass ? "Esconder senha" : "Mostrar senha"}
      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-[8px] flex items-center justify-center text-zinc-500 hover:text-white"
    >
      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
  const submitBtn = (loading: boolean, idle: string, busy: string) => (
    <button
      type="submit"
      disabled={loading}
      className="group w-full h-12 [@media(max-height:860px)]:h-11 rounded-[11px] bg-[linear-gradient(180deg,#4b8ef8,#2f6fe6)] hover:brightness-110 text-white font-semibold text-[15px] flex items-center justify-center gap-2 shadow-[0_14px_30px_-12px_rgba(59,130,246,0.9),inset_0_1px_0_rgba(255,255,255,0.25)] transition disabled:opacity-60 cursor-pointer"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {busy}
        </>
      ) : (
        <>
          {idle}
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
  const errorBox = (msg: string) =>
    msg ? <p className="rounded-[10px] border border-red-500/25 bg-red-500/[0.07] px-3.5 py-2.5 text-[13px] text-red-300">{msg}</p> : null;

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-[#05060a] text-zinc-100 font-sans">
      {/* Fundo: aurora azul, grade em perspectiva e estrelas */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-[35%] left-[10%] w-[1000px] h-[800px] bg-[radial-gradient(closest-side,rgba(59,130,246,0.22),transparent)]" />
        <div className="absolute -bottom-[40%] right-[-10%] w-[900px] h-[800px] bg-[radial-gradient(closest-side,rgba(37,99,235,0.16),transparent)]" />
        <div className="absolute inset-x-0 bottom-0 h-[55%] [perspective:700px] [mask-image:linear-gradient(to_top,black_10%,transparent)]">
          <div className="absolute inset-x-[-50%] bottom-0 h-[160%] origin-bottom [transform:rotateX(62deg)] bg-[linear-gradient(rgba(59,130,246,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.14)_1px,transparent_1px)] bg-[size:56px_56px]" />
        </div>
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(1px_1px_at_12%_18%,#fff,transparent),radial-gradient(1px_1px_at_68%_9%,#9cc2ff,transparent),radial-gradient(1px_1px_at_85%_34%,#fff,transparent),radial-gradient(1px_1px_at_32%_44%,#9cc2ff,transparent),radial-gradient(1px_1px_at_52%_22%,#fff,transparent),radial-gradient(1px_1px_at_92%_12%,#fff,transparent),radial-gradient(1px_1px_at_6%_52%,#9cc2ff,transparent)]" />
      </div>

      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <header className="lg:absolute lg:inset-x-0 lg:top-0 lg:z-10 flex items-center justify-between gap-3 px-4 sm:px-8 h-16 lg:h-[68px] [@media(max-height:860px)]:lg:h-[52px]">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo-webgran-icon.png" alt="WebGran" width={34} height={34} priority className="w-[34px] h-[34px] object-contain" />
            <span className="text-[18px] font-extrabold tracking-tight">WebGran</span>
          </Link>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[12px] text-zinc-500">
            <ShieldCheck className="w-4 h-4 text-[#3b82f6]" /> Ambiente seguro
          </span>
        </header>

        <main className="flex-1 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] items-center gap-10 xl:gap-16 w-full max-w-[1180px] mx-auto px-4 sm:px-8 py-4 sm:py-8 lg:py-[60px] [@media(max-height:860px)]:lg:py-[50px]">
          <AuthShowcase />

          <div className="mx-auto w-full max-w-[460px]">
            <div className="relative rounded-[22px] p-px bg-[linear-gradient(160deg,rgba(59,130,246,0.55),rgba(255,255,255,0.06)_35%,rgba(255,255,255,0.04)_70%,rgba(59,130,246,0.35))] shadow-[0_40px_100px_-40px_rgba(0,0,0,0.95),0_0_80px_-30px_rgba(59,130,246,0.45)]">
              <div className="rounded-[21px] bg-[#0b0d12]/95 backdrop-blur-md p-6 sm:p-7 [@media(max-height:860px)]:p-5 [@media(max-height:860px)]:sm:p-6">
                {/* Abas com indicador que desliza */}
                <div role="tablist" className="relative grid grid-cols-2 p-1 rounded-[12px] bg-black/40 border border-white/[0.07]">
                  <span
                    aria-hidden
                    className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-[9px] bg-[linear-gradient(180deg,#4b8ef8,#2f6fe6)] shadow-[0_8px_20px_-8px_rgba(59,130,246,0.9)] transition-transform duration-300 ease-out ${isLogin ? "translate-x-0" : "translate-x-full"}`}
                  />
                  {(["login", "register"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={mode === m}
                      onClick={() => switchTo(m)}
                      className={`relative z-10 h-9 rounded-[9px] text-[13px] font-semibold transition-colors ${mode === m ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`}
                    >
                      {m === "login" ? "Entrar" : "Criar conta"}
                    </button>
                  ))}
                </div>

                <div className="mt-5 [@media(max-height:860px)]:mt-4 flex items-center gap-3.5">
                  <span className="w-11 h-11 [@media(max-height:860px)]:w-10 [@media(max-height:860px)]:h-10 rounded-[13px] bg-[#3b82f6]/12 border border-[#3b82f6]/30 text-[#3b82f6] flex items-center justify-center shrink-0">
                    {isLogin ? <LogIn className="w-5 h-5" /> : <Store className="w-5 h-5" />}
                  </span>
                  <div className="min-w-0">
                    <h1 className="text-[21px] font-bold tracking-tight leading-tight">{isLogin ? "Bem-vindo de volta" : "Crie sua loja WebGran"}</h1>
                    <p className="mt-0.5 text-[13px] text-zinc-400">{isLogin ? "Entre para ver suas vendas e sua loja." : "Grátis para começar. Leva 1 minuto."}</p>
                  </div>
                </div>

                <div key={mode} className="animate-[wg-fade_.25s_ease-out]">
                  {isLogin ? (
                    <form onSubmit={handleLoginSubmit} className="mt-5 space-y-4">
                      {errorBox(loginError)}
                      <Field label="E-mail" icon={Mail}>
                        <input type="email" required autoComplete="email" placeholder="nome@exemplo.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className={INPUT} />
                      </Field>
                      <Field label="Senha" icon={Lock}>
                        <input type={showPass ? "text" : "password"} required autoComplete="current-password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className={`${INPUT} pr-11`} />
                        {eye}
                      </Field>
                      <div className="pt-1">{submitBtn(loginLoading, "Entrar", "Entrando...")}</div>
                    </form>
                  ) : (
                    <form onSubmit={handleRegisterSubmit} className="mt-5 [@media(max-height:860px)]:mt-4 space-y-3 [@media(max-height:860px)]:space-y-2.5">
                      {errorBox(regError)}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Seu nome" icon={User}>
                          <input type="text" required autoComplete="name" placeholder="Seu nome" value={regName} onChange={(e) => setRegName(e.target.value)} className={INPUT} />
                        </Field>
                        <Field label="Nome da loja" icon={ShoppingBag}>
                          <input type="text" required placeholder="Minha Loja VIP" value={regStoreName} onChange={(e) => setRegStoreName(e.target.value)} className={INPUT} />
                        </Field>
                      </div>
                      <Field label="E-mail de acesso" icon={Mail}>
                        <input type="email" required autoComplete="email" placeholder="seu@email.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className={INPUT} />
                      </Field>
                      <Field label="Senha" hint="mínimo 6 caracteres" icon={Lock}>
                        <input type={showPass ? "text" : "password"} required minLength={6} autoComplete="new-password" placeholder="••••••••" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className={`${INPUT} pr-11`} />
                        {eye}
                      </Field>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="WhatsApp" icon={Phone}>
                          <input type="tel" inputMode="tel" required autoComplete="tel" maxLength={20} placeholder="(11) 99999-9999" value={regWhatsapp} onChange={(e) => setRegWhatsapp(e.target.value)} className={INPUT} />
                        </Field>
                        <Field label="Telegram" icon={AtSign}>
                          <input type="text" required maxLength={33} placeholder="seuusuario" value={regTelegram} onChange={(e) => setRegTelegram(e.target.value.replace(/^@+/, ""))} className={INPUT} />
                        </Field>
                      </div>
                      <p className="-mt-1 text-[11.5px] text-zinc-500">Usamos só para falar com você sobre a sua conta.</p>
                      <div className="pt-1">{submitBtn(regLoading, "Criar minha loja", "Criando sua loja...")}</div>
                    </form>
                  )}
                </div>

                <p className="mt-5 [@media(max-height:860px)]:mt-4 pt-4 [@media(max-height:860px)]:pt-3 border-t border-white/[0.06] text-center text-[13px] text-zinc-500">
                  {isLogin ? "Ainda não tem conta? " : "Já tem uma conta? "}
                  <button type="button" onClick={() => switchTo(isLogin ? "register" : "login")} className="text-[#7fb0ff] hover:underline font-semibold">
                    {isLogin ? "Criar minha loja grátis" : "Entrar"}
                  </button>
                </p>
              </div>
            </div>
          </div>
        </main>

        <footer className="lg:absolute lg:inset-x-0 lg:bottom-0 px-4 sm:px-8 py-5 lg:py-3 text-center text-[12px] text-zinc-600">
          © {new Date().getFullYear()} WebGran · Feito para criadores e vendedores
        </footer>
      </div>
    </div>
  );
}
