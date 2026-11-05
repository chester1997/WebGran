"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Bot, 
  Key, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Eye, 
  EyeOff, 
  Loader2, 
  Sparkles, 
  Smartphone, 
  MessageSquare, 
  Workflow, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  ShieldCheck
} from "lucide-react";
import { validateBotTokenAction, createNewBotAction } from "../actions";

export default function NewBotClient() {
  const router = useRouter();

  // Etapa atual: 1, 2 ou 3
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Dados do formulário
  const [connectionMethod, setConnectionMethod] = useState<"token" | "telegram">("token");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [buttonText, setButtonText] = useState("Abrir App");
  const [selectedMode, setSelectedMode] = useState<"MINI_APP">("MINI_APP");

  // Estados de validação
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [botPreview, setBotPreview] = useState<{
    numericId: string;
    username: string;
    firstName: string;
    photoUrl: string | null;
  } | null>(null);

  // Ação Etapa 2 -> Validar Token no Telegram
  const handleValidateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    const trimmed = token.trim();
    if (!trimmed) {
      setErrorMessage("Por favor, cole o token do bot fornecido pelo BotFather.");
      return;
    }

    setValidating(true);
    try {
      const res = await validateBotTokenAction(trimmed);
      if (res.success && res.data) {
        setBotPreview(res.data);
        setStep(3); // Avança para a Etapa 3
      } else {
        setErrorMessage(res.error || "Token inválido ou não reconhecido pelo Telegram.");
      }
    } catch {
      setErrorMessage("Erro ao conectar com o serviço do Telegram. Tente novamente.");
    } finally {
      setValidating(false);
    }
  };

  // Ação Etapa 3 -> Concluir Cadastro
  const handleFinalize = async () => {
    setErrorMessage("");
    setSaving(true);
    try {
      const res = await createNewBotAction({
        token: token.trim(),
        mode: "MINI_APP",
        buttonText: buttonText.trim() || "Abrir App",
      });

      if (res.success && res.data?.botId) {
        router.push(`/seller/bots/${res.data.botId}`);
      } else {
        setErrorMessage(res.error || "Erro ao salvar o bot no sistema.");
        setSaving(false);
      }
    } catch {
      setErrorMessage("Erro ao concluir cadastro do bot.");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 fade-in pb-16">
      {/* Botão de Retorno e Topo */}
      <div className="flex items-center justify-between">
        <Link
          href="/seller/bots"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para listagem de bots</span>
        </Link>

        <span className="text-xs font-semibold text-zinc-500">
          Etapa {step} de 3
        </span>
      </div>

      {/* Barra de Progresso com 3 Etapas */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 1 ? "bg-[#3984FF]" : "bg-white/10"}`} />
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 2 ? "bg-[#3984FF]" : "bg-white/10"}`} />
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 3 ? "bg-[#3984FF]" : "bg-white/10"}`} />
        </div>

        <div className="flex justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1">
          <span className={step === 1 ? "text-[#3984FF]" : ""}>1. Conexão</span>
          <span className={step === 2 ? "text-[#3984FF]" : ""}>2. Token</span>
          <span className={step === 3 ? "text-[#3984FF]" : ""}>3. Modo de Operação</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ETAPA 1: COMO VOCÊ QUER CONECTAR SEU BOT?                 */}
      {/* ========================================================= */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Como você quer conectar seu bot?
            </h1>
            <p className="text-sm text-zinc-400">
              Escolha o método mais adequado para integrar o bot do Telegram à sua loja WebGran.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            {/* OPÇÃO A — CRIAR PELO TELEGRAM (EM BREVE) */}
            <div className="bg-[#121215] border border-white/[0.06] rounded-2xl p-6 flex flex-col justify-between opacity-50 cursor-not-allowed relative">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400">
                    <Bot className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase tracking-wider">
                    EM BREVE
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-bold text-white">Criar pelo Telegram</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    O Telegram cria o bot para você. Basta seguir as instruções e conectar seu novo bot à WebGran.
                  </p>
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 text-zinc-500 text-xs font-bold cursor-not-allowed border border-white/5"
                >
                  Indisponível no momento
                </button>
              </div>
            </div>

            {/* OPÇÃO B — COLAR O TOKEN (DISPONÍVEL) */}
            <div 
              onClick={() => {
                setConnectionMethod("token");
                setStep(2);
              }}
              className="bg-[#121215] hover:bg-[#15151D] border-2 border-[#3984FF]/40 hover:border-[#3984FF] rounded-2xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-200 group shadow-xl relative"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-[#3984FF]/10 border border-[#3984FF]/25 flex items-center justify-center text-[#3984FF] group-hover:scale-105 transition-transform">
                    <Key className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                    DISPONÍVEL
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-bold text-white group-hover:text-[#3984FF] transition-colors">
                    Colar o token
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Se você já possui um bot criado pelo BotFather, basta inserir o token para conectá-lo à WebGran.
                  </p>
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="button"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#3984FF] hover:bg-[#2563EB] text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <span>Continuar com token</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ETAPA 2: COLE O TOKEN DO SEU BOT                          */}
      {/* ========================================================= */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Cole o token do seu bot
            </h1>
            <p className="text-sm text-zinc-400">
              É a chave que permite à WebGran se comunicar com seu bot no Telegram. Seu token será armazenado de forma protegida com criptografia AES-256.
            </p>
          </div>

          {/* Mensagem de Erro */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in-50">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Card Educativo: ONDE ENCONTRAR */}
          <div className="bg-[#121215] border border-white/5 rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
              <HelpCircle className="w-4 h-4 text-[#3984FF]" />
              <span>ONDE ENCONTRAR</span>
            </div>

            <ol className="space-y-2 text-xs text-zinc-400 pl-1 list-decimal list-inside">
              <li>Abra o Telegram e procure por <span className="text-white font-mono font-semibold">@BotFather</span></li>
              <li>Envie <span className="text-[#3984FF] font-mono">/mybots</span> e selecione seu bot.</li>
              <li>Para criar um novo bot, utilize <span className="text-[#3984FF] font-mono">/newbot</span>.</li>
              <li>Acesse <span className="text-white font-semibold">API Token</span>.</li>
              <li>Copie o token e cole no campo abaixo.</li>
            </ol>
          </div>

          {/* Formulário de Token */}
          <form onSubmit={handleValidateToken} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">
                Token da API do Bot (BotFather)
              </label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  required
                  placeholder="123456789:ABCDefGHIjklmnoPQRstUVwxYZ..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full bg-[#18181B] border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-[#3984FF] pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                  title={showToken ? "Ocultar token" : "Mostrar token"}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                type="submit"
                disabled={validating || !token.trim()}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#3984FF] hover:bg-[#2563EB] text-white text-xs font-bold transition-all disabled:opacity-50 shadow-lg"
              >
                {validating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verificando no Telegram...</span>
                  </>
                ) : (
                  <>
                    <span>Verificar token</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* ETAPA 3: ESCOLHA DO MODO DE FUNCIONAMENTO                 */}
      {/* ========================================================= */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Escolha o modo de funcionamento
            </h1>
            <p className="text-sm text-zinc-400">
              Defina como seus clientes irão interagir com seu bot no Telegram.
            </p>
          </div>

          {/* Card com Bot Reconhecido */}
          {botPreview && (
            <div className="p-4 rounded-xl bg-[#3984FF]/10 border border-[#3984FF]/25 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#3984FF]/20 flex items-center justify-center font-bold text-sm text-[#3984FF] shrink-0">
                {botPreview.photoUrl ? (
                  <img src={botPreview.photoUrl} alt="Bot" className="w-full h-full rounded-xl object-cover" />
                ) : (
                  (botPreview.firstName || "B").charAt(0)
                )}
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  Bot Identificado com Sucesso
                </span>
                <span className="text-sm font-bold text-white">
                  {botPreview.firstName} (@{botPreview.username})
                </span>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-400 ml-auto shrink-0" />
            </div>
          )}

          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in-50">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Grid de 3 Modos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
            
            {/* MODO 1: BÁSICO (EM BREVE) */}
            <div className="bg-[#121215] border border-white/[0.06] rounded-2xl p-6 flex flex-col justify-between opacity-50 cursor-not-allowed">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    PADRÃO
                  </span>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase">
                    EM BREVE
                  </span>
                </div>

                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400">
                  <MessageSquare className="w-6 h-6" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-bold text-white">Venda na conversa</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    O bot apresenta os produtos diretamente nas mensagens do Telegram e conduz o cliente durante a conversa.
                  </p>
                </div>
              </div>

              <div className="pt-6">
                <span className="text-[11px] text-zinc-500 font-medium">Fluxo conversacional em desenvolvimento</span>
              </div>
            </div>

            {/* MODO 2: MINI APP (DISPONÍVEL & SELECIONADO) */}
            <div className="bg-[#121215] border-2 border-[#3984FF] rounded-2xl p-6 flex flex-col justify-between shadow-2xl shadow-[#3984FF]/10 relative">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#3984FF] uppercase tracking-wider">
                    MINI APP
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-[#3984FF]/20 text-[#3984FF] border border-[#3984FF]/40 uppercase flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    SELECIONADO
                  </span>
                </div>

                <div className="w-12 h-12 rounded-xl bg-[#3984FF]/10 border border-[#3984FF]/25 flex items-center justify-center text-[#3984FF]">
                  <Smartphone className="w-6 h-6" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-bold text-white">Loja dentro do Telegram</h3>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Uma loja completa dentro do Telegram, com produtos, imagens, planos e recursos de compra integrados.
                  </p>
                </div>
              </div>

              <div className="pt-6 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Nome do Botão Azul no Telegram
                  </label>
                  <input
                    type="text"
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                    placeholder="Abrir App"
                    className="w-full bg-[#18181B] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#3984FF]"
                  />
                </div>
              </div>
            </div>

            {/* MODO 3: WEBFLOW (EM BREVE) */}
            <div className="bg-[#121215] border border-white/[0.06] rounded-2xl p-6 flex flex-col justify-between opacity-50 cursor-not-allowed">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    WEBFLOW
                  </span>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase">
                    EM BREVE
                  </span>
                </div>

                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400">
                  <Workflow className="w-6 h-6" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-bold text-white">Fluxos avançados</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Crie experiências automatizadas com fluxos visuais, nós conectáveis e sistema de arrastar e soltar.
                  </p>
                </div>
              </div>

              <div className="pt-6">
                <span className="text-[11px] text-zinc-500 font-medium">Editor visual de nós em desenvolvimento</span>
              </div>
            </div>

          </div>

          {/* Botões de Ação Final */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>

            <button
              type="button"
              onClick={handleFinalize}
              disabled={saving}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-[#3984FF] hover:bg-[#2563EB] text-white text-xs font-bold transition-all shadow-xl shadow-[#3984FF]/25 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Configurando Webhooks e Mini App...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Concluir e Abrir Gerenciamento</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

