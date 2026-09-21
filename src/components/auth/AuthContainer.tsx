"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Mail, 
  Lock, 
  User, 
  ShoppingBag, 
  ArrowRight, 
  Sparkles, 
  Heart,
  Loader2,
  CheckCircle2,
  ShieldCheck
} from "lucide-react";

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
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

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
    } catch (err: any) {
      setRegError(err.message);
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex items-center justify-center p-3 sm:p-6 md:p-8 font-sans">
      {/* CARD CONTAINER WITH SPLIT LAYOUT */}
      <div className="w-full max-w-5xl bg-[#121215] border border-[#27272A]/80 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 min-h-[620px]">
        
        {/* LEFT COLUMN: FORM PANEL */}
        <div className="p-6 sm:p-10 md:p-12 flex flex-col justify-between bg-[#121215]">
          <div>
            {/* BRAND HEADER */}
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-red-500 to-purple-600 flex items-center justify-center shadow-lg shadow-red-500/20">
                <Heart className="w-4 h-4 text-white fill-white" />
              </div>
              <span className="text-xl font-black tracking-tight text-white">webgran</span>
            </div>

            {/* TAB SELECTOR BAR */}
            <div className="flex items-center p-1 bg-[#18181B] rounded-xl border border-[#27272A] mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setLoginError("");
                }}
                className={`flex-1 py-2 px-4 text-xs font-bold rounded-lg transition-all ${
                  mode === "login"
                    ? "bg-[#27272A] text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setRegError("");
                }}
                className={`flex-1 py-2 px-4 text-xs font-bold rounded-lg transition-all ${
                  mode === "register"
                    ? "bg-[#27272A] text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Criar Conta
              </button>
            </div>

            {/* TITLE & TOGGLE ACTION */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {mode === "login" ? "Entrar na sua conta" : "Criar sua loja WebGran"}
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                {mode === "login" ? (
                  <>
                    Não tem uma conta?{" "}
                    <button
                      onClick={() => setMode("register")}
                      className="text-white underline font-semibold hover:text-zinc-200 transition-colors"
                    >
                      Criar uma agora
                    </button>
                  </>
                ) : (
                  <>
                    Já possui uma conta?{" "}
                    <button
                      onClick={() => setMode("login")}
                      className="text-white underline font-semibold hover:text-zinc-200 transition-colors"
                    >
                      Fazer login
                    </button>
                  </>
                )}
              </p>
            </div>

            {/* LOGIN FORM */}
            {mode === "login" && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {loginError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold animate-in fade-in-50">
                    ⚠️ {loginError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Endereço de e-mail
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="email"
                      required
                      placeholder="nome@exemplo.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full bg-[#18181B] border border-[#27272A] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Sua senha
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full bg-[#18181B] border border-[#27272A] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full py-3 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {loginLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Entrando...</span>
                      </>
                    ) : (
                      <>
                        <span>Entrar</span>
                        <ArrowRight className="w-4 h-4 text-black" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* REGISTER FORM */}
            {mode === "register" && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                {regError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold animate-in fade-in-50">
                    ⚠️ {regError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Nome Completo
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      required
                      placeholder="Seu Nome"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full bg-[#18181B] border border-[#27272A] rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    E-mail de Acesso
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="email"
                      required
                      placeholder="seu@email.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full bg-[#18181B] border border-[#27272A] rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Senha (mínimo 6 caracteres)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full bg-[#18181B] border border-[#27272A] rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Nome da sua Loja no Telegram
                  </label>
                  <div className="relative">
                    <ShoppingBag className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: Minha Loja VIP"
                      value={regStoreName}
                      onChange={(e) => setRegStoreName(e.target.value)}
                      className="w-full bg-[#18181B] border border-[#27272A] rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={regLoading}
                    className="w-full py-3 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {regLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Criando sua loja...</span>
                      </>
                    ) : (
                      <>
                        <span>Criar Minha Loja</span>
                        <ArrowRight className="w-4 h-4 text-black" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* FOOTER */}
          <div className="mt-8 pt-4 border-t border-[#27272A]/50 flex items-center justify-between text-[11px] text-zinc-500">
            <span>© {new Date().getFullYear()} WebGran SaaS</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Ambiente Seguro
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN: ATMOSPHERIC AMBIENT PANEL */}
        <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-[#1C1215] via-[#120D14] to-[#0A0A0C] border-l border-[#27272A]/80">
          {/* AMBIENT RADIAL LIGHT GLOWS */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-red-600/20 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute top-1/2 -left-20 w-80 h-80 bg-amber-600/15 rounded-full blur-[90px] pointer-events-none" />
          <div className="absolute -bottom-20 right-10 w-96 h-96 bg-purple-600/15 rounded-full blur-[110px] pointer-events-none" />

          {/* TOP TAG */}
          <div className="relative z-10 flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs font-medium backdrop-blur-md flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              SaaS de Vendas no Telegram
            </span>
          </div>

          {/* CENTER HERO HEADLINE */}
          <div className="relative z-10 my-auto py-12 space-y-4">
            <h2 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
              Sua plataforma definitiva de vendas no Telegram.
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-md">
              Automação completa de pagamentos PIX via Mercado Pago, gestão de miniapps, grupos privados e renovação automática de assinaturas.
            </p>

            <div className="pt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 100% Automático
                </span>
                <p className="text-zinc-400 text-[11px]">Liberação imediata do acesso no Telegram</p>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1">
                <span className="text-sky-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mercado Pago
                </span>
                <p className="text-zinc-400 text-[11px]">Pagamentos caem direto na sua conta</p>
              </div>
            </div>
          </div>

          {/* BOTTOM CREATOR ACKNOWLEDGEMENT */}
          <div className="relative z-10 text-[11px] text-zinc-500 font-medium tracking-wide">
            Feito com ❤️ para criadores e vendedores • WebGran
          </div>
        </div>

      </div>
    </div>
  );
}
