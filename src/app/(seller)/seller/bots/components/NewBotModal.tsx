"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { 
  X, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Eye, 
  EyeOff, 
  Loader2, 
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Bot as BotIcon
} from "lucide-react";
import { validateBotTokenAction, createNewBotAction } from "../actions";

interface NewBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBotCreated?: (botId: string) => void;
  initialStep?: 1 | 2 | 3;
  initialValidatedBot?: {
    numericId: string;
    username: string;
    firstName: string;
    photoUrl: string | null;
  } | null;
}

/**
 * Ilustração vetorial do Card 1: Smartphone com Robô amigável e botão +
 */
function PhoneBotIllustration() {
  return (
    <div className="relative w-full h-36 flex items-center justify-center select-none pointer-events-none">
      {/* Glow de fundo */}
      <div className="absolute w-28 h-28 rounded-full bg-sky-500/15 blur-2xl -z-10" />

      {/* Estrela brilhante superior esquerda */}
      <svg
        className="absolute top-2 left-6 w-4 h-4 text-sky-400 animate-pulse"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
      </svg>

      {/* Estrela brilhante inferior direita */}
      <svg
        className="absolute bottom-2 right-8 w-3.5 h-3.5 text-sky-400/80 animate-pulse delay-150"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
      </svg>

      <div className="relative w-28 h-36">
        {/* Smartphone mockup */}
        <div className="absolute inset-0 bg-[#161B26] border-2 border-[#2A354A] rounded-2xl shadow-xl flex flex-col p-1.5 overflow-hidden">
          {/* Top Notch / Header do celular */}
          <div className="flex items-center justify-between px-1.5 pt-0.5 pb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <div className="w-8 h-1 rounded-full bg-white/20" />
          </div>

          {/* Placeholder lines na tela */}
          <div className="space-y-1 px-1 my-1">
            <div className="w-12 h-1 rounded-full bg-white/10" />
            <div className="w-8 h-1 rounded-full bg-white/10" />
          </div>

          {/* Card azul com bot robô */}
          <div className="mt-auto bg-[#38BDF8] rounded-xl p-2 flex flex-col items-center justify-center shadow-md">
            {/* Cabeça do robô */}
            <div className="relative flex flex-col items-center">
              {/* Antena */}
              <div className="w-1 h-1.5 bg-white rounded-t-full mb-0.5" />
              {/* Rosto */}
              <div className="w-8 h-6 bg-white rounded-md flex items-center justify-center gap-1 shadow-sm px-1">
                {/* Olhos */}
                <div className="w-1.5 h-1.5 rounded-full bg-[#161B26]" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#161B26]" />
              </div>
              {/* Orelhas / parafusos */}
              <div className="absolute -left-1 top-2.5 w-1 h-2 bg-white/80 rounded-l-sm" />
              <div className="absolute -right-1 top-2.5 w-1 h-2 bg-white/80 rounded-r-sm" />
            </div>
            {/* Pílula decorativa abaixo do robô */}
            <div className="w-6 h-1 rounded-full bg-white/70 mt-1.5" />
          </div>
        </div>

        {/* Botão flutuante (+) ciano */}
        <div className="absolute -top-1 -right-3 w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-sky-300 border-2 border-[#0F131D] flex items-center justify-center shadow-lg shadow-sky-500/30">
          <svg className="w-4 h-4 text-[#0F131D] font-bold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/**
 * Ilustração vetorial do Card 2: Janela de código/browser com campo de senha e chave violeta
 */
function TokenKeyIllustration() {
  return (
    <div className="relative w-full h-36 flex items-center justify-center select-none pointer-events-none">
      {/* Glow de fundo */}
      <div className="absolute w-28 h-28 rounded-full bg-purple-500/15 blur-2xl -z-10" />

      {/* Estrela brilhante superior direita */}
      <svg
        className="absolute top-3 right-6 w-4 h-4 text-purple-400 animate-pulse"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
      </svg>

      {/* Estrela brilhante inferior esquerda */}
      <svg
        className="absolute bottom-2 left-6 w-3.5 h-3.5 text-purple-400/80 animate-pulse delay-200"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
      </svg>

      <div className="relative w-44 h-28">
        {/* Janela de browser / card escuro */}
        <div className="absolute inset-0 bg-[#161324] border-2 border-[#2D2146] rounded-2xl shadow-xl p-2.5 flex flex-col justify-between">
          {/* Barra de título com pontinhos */}
          <div className="flex items-center gap-1.5 pb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
          </div>

          {/* Campo de token/senha */}
          <div className="w-full bg-[#201A33] border border-purple-500/30 rounded-xl px-2.5 py-2 flex items-center justify-between">
            {/* Pontinhos de senha */}
            <div className="flex items-center gap-1 text-purple-300">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-300 inline-block" />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-300 inline-block" />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-300 inline-block" />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-300 inline-block" />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-300 inline-block" />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-300 inline-block" />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-300 inline-block" />
            </div>
            <div className="w-2 h-2 rounded-full bg-purple-400" />
          </div>

          <div className="w-16 h-1 rounded-full bg-white/10" />
        </div>

        {/* Chave violeta luminosa inclinada */}
        <div className="absolute -bottom-2 -right-3 w-16 h-16 drop-shadow-[0_10px_15px_rgba(168,85,247,0.4)]">
          <svg viewBox="0 0 64 64" fill="none" className="w-full h-full transform -rotate-12">
            {/* Cabeça circular da chave com furo */}
            <circle cx="24" cy="24" r="14" stroke="#C084FC" strokeWidth="5" fill="#1C1433" />
            <circle cx="24" cy="24" r="6" fill="#C084FC" />
            {/* Haste da chave */}
            <path
              d="M34 34L54 54"
              stroke="#D946EF"
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Dentes da chave */}
            <path
              d="M44 44L48 40M49 49L53 45"
              stroke="#E879F9"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function NewBotModal({ 
  isOpen, 
  onClose, 
  onBotCreated,
  initialStep = 1,
  initialValidatedBot = null
}: NewBotModalProps) {
  const router = useRouter();

  // Etapas: 1 (Escolha), 2 (Token ou Guia Telegram), 3 (Apelido Interno), 4 (Conectando / Sucesso)
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const [method, setMethod] = useState<"telegram" | "token">("telegram");

  // Dados do formulário
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [displayName, setDisplayName] = useState(initialValidatedBot?.firstName || "");

  // Estados de comunicação e feedback
  const [validating, setValidating] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectedSuccess, setConnectedSuccess] = useState(false);
  const [createdBotId, setCreatedBotId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Dados do bot validado
  const [validatedBot, setValidatedBot] = useState<{
    numericId: string;
    username: string;
    firstName: string;
    photoUrl: string | null;
  } | null>(initialValidatedBot);

  if (!isOpen) return null;

  // Fechar e resetar se necessário
  const handleClose = () => {
    if (connecting) return; // Não fecha no meio do salvamento crítico
    onClose();
  };

  // Validar Token (Passo 2)
  const handleValidateToken = async (tokenToTest?: string) => {
    const raw = tokenToTest || token;
    const cleanToken = raw.trim();

    if (!cleanToken) {
      setErrorMessage("Por favor, cole o token do bot fornecido pelo BotFather.");
      return;
    }

    setErrorMessage("");
    setValidating(true);

    try {
      const res = await validateBotTokenAction(cleanToken);
      if (res.success && res.data) {
        setValidatedBot(res.data);
        // Preenche sugestão de apelido inicial se ainda estiver em branco
        if (!displayName) {
          setDisplayName(res.data.firstName || res.data.username);
        }
        // Avança para o Passo 3
        setStep(3);
      } else {
        setErrorMessage(res.error || "Token inválido. Verifique se copiou corretamente do @BotFather.");
      }
    } catch {
      setErrorMessage("Erro ao conectar com a API do Telegram. Tente novamente.");
    } finally {
      setValidating(false);
    }
  };

  // Concluir Conexão (Passo 3)
  const handleFinalizeConnection = async () => {
    if (!token.trim()) return;
    setErrorMessage("");
    setConnecting(true);

    try {
      const res = await createNewBotAction({
        token: token.trim(),
        mode: "MINI_APP",
        displayName: displayName.trim() || validatedBot?.firstName || validatedBot?.username,
        buttonText: "Abrir App",
      });

      if (res.success && res.data?.botId) {
        setCreatedBotId(res.data.botId);
        setConnectedSuccess(true);
        if (onBotCreated) {
          onBotCreated(res.data.botId);
        }
      } else {
        setErrorMessage(res.error || "Falha ao registrar o bot.");
        setConnecting(false);
      }
    } catch {
      setErrorMessage("Erro de comunicação ao salvar o bot.");
      setConnecting(false);
    }
  };

  // Redirecionar ao concluir
  const handleFinishAndRedirect = () => {
    if (createdBotId) {
      router.push(`/seller/bots/${createdBotId}`);
    } else {
      router.push("/seller/bots");
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-[820px] max-h-[92vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 bg-[#0F131D] border border-white/[0.08] rounded-3xl p-6 md:p-8 shadow-2xl relative text-left transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================= */}
        {/* TOP BAR: PROGRESSO + BOTÃO FECHAR                         */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between pb-6 border-b border-white/[0.06]">
          {/* Indicador de 3 segmentos */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div
                className={`h-1.5 w-9 rounded-full transition-all duration-300 ${
                  step >= 1 ? "bg-[#22C55E]" : "bg-white/10"
                }`}
              />
              <div
                className={`h-1.5 w-9 rounded-full transition-all duration-300 ${
                  step >= 2 ? "bg-[#22C55E]" : "bg-white/10"
                }`}
              />
              <div
                className={`h-1.5 w-9 rounded-full transition-all duration-300 ${
                  step >= 3 ? "bg-[#22C55E]" : "bg-white/10"
                }`}
              />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Passo {step} de 3
            </span>
          </div>

          {/* Botão de Fechar */}
          <button
            type="button"
            onClick={handleClose}
            disabled={connecting}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================= */}
        {/* ESTADO DE CONECTANDO / SUCESSO FINAL                      */}
        {/* ========================================================= */}
        {connecting ? (
          <div className="py-12 px-4 flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in duration-300">
            {!connectedSuccess ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-[#3984FF]/10 border border-[#3984FF]/30 flex items-center justify-center text-[#3984FF] animate-pulse">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-xl font-bold text-white">Conectando o bot...</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Recebemos o bot que você criou. Só um instante enquanto ele entra no seu painel.
                  </p>
                  <p className="text-[11px] text-zinc-500 font-mono pt-1">
                    Configurando webhook seguro e ativando Mini App WebGran...
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-xl font-bold text-white">Bot conectado com sucesso!</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Seu bot já está configurado no modo Mini App e pronto para vender com entrega automática no Telegram.
                  </p>
                </div>

                {/* Resumo do bot conectado */}
                <div className="bg-[#141926] border border-white/10 rounded-2xl p-4 flex items-center gap-3 w-full max-w-sm mt-2 text-left">
                  {validatedBot?.photoUrl ? (
                    <Image
                      src={validatedBot.photoUrl}
                      alt={validatedBot.username}
                      width={40}
                      height={40}
                      unoptimized
                      className="w-10 h-10 rounded-full object-cover border border-white/10"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#3984FF]/20 border border-[#3984FF]/40 text-[#3984FF] font-bold flex items-center justify-center text-sm">
                      {validatedBot?.username?.charAt(0)?.toUpperCase() || "B"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">
                      {displayName || validatedBot?.firstName || validatedBot?.username}
                    </p>
                    <p className="text-xs text-[#3984FF] font-mono truncate">
                      @{validatedBot?.username}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                    Ativo
                  </span>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={handleFinishAndRedirect}
                    className="px-6 py-2.5 rounded-xl bg-[#3984FF] hover:bg-[#2F73E6] text-white text-xs font-bold transition-all shadow-lg shadow-[#3984FF]/25 flex items-center gap-2"
                  >
                    <span>Concluir e acessar bot</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {/* ========================================================= */}
            {/* ETAPA 1: COMO VOCÊ QUER PROSSEGUIR? (ESCOLHA DO MÉTODO)   */}
            {/* ========================================================= */}
            {step === 1 && (
              <div className="pt-6 space-y-6 animate-in fade-in duration-200">
                {/* Header textual */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-400">
                    NOVO BOT
                  </span>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                    Como você quer prosseguir?
                  </h2>
                  <p className="text-xs md:text-sm text-zinc-400 leading-relaxed max-w-2xl">
                    Para vender e entregar no Telegram, você precisa de um bot. Crie um agora, direto pelo Telegram, ou conecte um que você já tem.
                  </p>
                </div>

                {/* Grid dos dois grandes cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                  {/* CARD 1 — CRIAR PELO TELEGRAM */}
                  <div
                    onClick={() => {
                      setMethod("telegram");
                      setStep(2);
                    }}
                    className="group relative flex flex-col justify-between p-6 rounded-2xl bg-[#111724] border border-[#1E293B] hover:border-sky-500/50 hover:bg-[#131D2E] transition-all duration-200 cursor-pointer overflow-hidden shadow-xl"
                  >
                    {/* Glow de fundo */}
                    <div className="absolute top-0 right-0 w-44 h-44 bg-sky-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-sky-500/20 transition-all" />

                    <div className="space-y-4">
                      {/* Ilustração rica */}
                      <PhoneBotIllustration />

                      {/* Textos */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold tracking-wider uppercase text-sky-400">
                          RECOMENDADO
                        </span>
                        <h3 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
                          Criar pelo Telegram
                        </h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          O Telegram cria o bot na hora e já entrega para a gente. Você só confirma e escolhe o @, sem token passando pelas suas mãos.
                        </p>
                      </div>
                    </div>

                    {/* Rodapé do card */}
                    <div className="pt-4 mt-auto flex items-center text-sky-400 text-xs font-semibold group-hover:translate-x-1 transition-transform">
                      <span>Começar por aqui</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </div>
                  </div>

                  {/* CARD 2 — COLAR O TOKEN */}
                  <div
                    onClick={() => {
                      setMethod("token");
                      setStep(2);
                    }}
                    className="group relative flex flex-col justify-between p-6 rounded-2xl bg-[#151122] border border-[#2E1D4D] hover:border-purple-500/50 hover:bg-[#1C142E] transition-all duration-200 cursor-pointer overflow-hidden shadow-xl"
                  >
                    {/* Glow de fundo */}
                    <div className="absolute top-0 right-0 w-44 h-44 bg-purple-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/20 transition-all" />

                    <div className="space-y-4">
                      {/* Ilustração rica */}
                      <TokenKeyIllustration />

                      {/* Textos */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold tracking-wider uppercase text-purple-400">
                          JÁ TENHO UM BOT
                        </span>
                        <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                          Colar o token
                        </h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Se o bot já existe, ou se você prefere criar manualmente pelo @BotFather, cole o token dele aqui.
                        </p>
                      </div>
                    </div>

                    {/* Rodapé do card */}
                    <div className="pt-4 mt-auto flex items-center text-purple-400 text-xs font-semibold group-hover:translate-x-1 transition-transform">
                      <span>Começar por aqui</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* ETAPA 2 — FLUXO A: CRIAR PELO TELEGRAM                    */}
            {/* ========================================================= */}
            {step === 2 && method === "telegram" && (
              <div className="pt-6 space-y-6 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold tracking-wider uppercase text-sky-400">
                    CRIAR PELO TELEGRAM
                  </span>
                  <h2 className="text-2xl font-bold tracking-tight text-white">
                    O Telegram cria o bot para você
                  </h2>
                  <p className="text-xs md:text-sm text-zinc-400 leading-relaxed">
                    Siga o passo a passo de 3 etapas no Telegram oficial para gerar seu bot em menos de 1 minuto:
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Passo a passo visual numerado */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="bg-[#141926] border border-white/[0.06] rounded-2xl p-4 space-y-2">
                    <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-400 font-bold text-xs flex items-center justify-center">
                      1
                    </div>
                    <h4 className="text-xs font-bold text-white">Abra o @BotFather</h4>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Inicie uma conversa com o bot oficial do Telegram que cria e gerencia todos os bots.
                    </p>
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-semibold pt-1"
                    >
                      <span>Abrir no Telegram</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="bg-[#141926] border border-white/[0.06] rounded-2xl p-4 space-y-2">
                    <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-400 font-bold text-xs flex items-center justify-center">
                      2
                    </div>
                    <h4 className="text-xs font-bold text-white">Envie /newbot</h4>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Escolha o nome público e defina o @username terminado em <span className="text-white font-mono">bot</span> (ex: <span className="text-white font-mono">MinhaLojaBot</span>).
                    </p>
                  </div>

                  <div className="bg-[#141926] border border-white/[0.06] rounded-2xl p-4 space-y-2">
                    <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-400 font-bold text-xs flex items-center justify-center">
                      3
                    </div>
                    <h4 className="text-xs font-bold text-white">Copie o Token gerado</h4>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      O BotFather vai enviar a chave HTTP API. Copie e cole no campo abaixo para conectar.
                    </p>
                  </div>
                </div>

                {/* Campo de Token com verificação */}
                <div className="bg-[#121622] border border-white/10 rounded-2xl p-4 md:p-5 space-y-3">
                  <label className="block text-xs font-bold text-white">
                    Cole o token retornado pelo BotFather:
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? "text" : "password"}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Ex: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                      className="w-full bg-[#181F2E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-sky-400 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-2.5 text-zinc-400 hover:text-white"
                      title={showToken ? "Ocultar" : "Mostrar"}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMethod("token");
                      }}
                      className="text-xs text-zinc-400 hover:text-white underline underline-offset-4"
                    >
                      Prefiro colar o token de um bot existente
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleValidateToken()}
                        disabled={validating || !token.trim()}
                        className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-[#0F131D] text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-sky-500/20"
                      >
                        {validating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Verificando bot...</span>
                          </>
                        ) : (
                          <>
                            <span>Verificar e continuar</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* ETAPA 2 — FLUXO B: CONECTAR COM TOKEN                     */}
            {/* ========================================================= */}
            {step === 2 && method === "token" && (
              <div className="pt-6 space-y-6 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold tracking-wider uppercase text-purple-400">
                    CONECTAR COM TOKEN
                  </span>
                  <h2 className="text-2xl font-bold tracking-tight text-white">
                    Conecte o token do seu bot
                  </h2>
                  <p className="text-xs md:text-sm text-zinc-400 leading-relaxed">
                    É a chave que permite à WebGran atender por ele. Guardamos criptografada e ninguém mais lê.
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Caixa educativa: Onde encontrar o token */}
                <div className="bg-[#171424] border border-purple-500/20 rounded-2xl p-4 md:p-5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wider">
                    <HelpCircle className="w-4 h-4 text-purple-400" />
                    <span>Onde encontrar o token?</span>
                  </div>
                  <ol className="text-xs text-zinc-400 space-y-1.5 pl-4 list-decimal">
                    <li>Abra o Telegram e converse com o <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-purple-400 underline font-mono">@BotFather</a></li>
                    <li>Envie o comando <span className="text-white font-mono font-semibold">/mybots</span> e selecione seu bot</li>
                    <li>Clique em <span className="text-white font-semibold">API Token</span> e copie a chave gerada</li>
                  </ol>
                </div>

                {/* Formulário do token */}
                <div className="bg-[#141320] border border-white/10 rounded-2xl p-4 md:p-5 space-y-3">
                  <label className="block text-xs font-bold text-white">
                    Token de API do Bot
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? "text" : "password"}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Ex: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                      className="w-full bg-[#1A1828] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-purple-400 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-2.5 text-zinc-400 hover:text-white"
                      title={showToken ? "Ocultar" : "Mostrar"}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMethod("telegram");
                      }}
                      className="text-xs text-zinc-400 hover:text-white underline underline-offset-4"
                    >
                      Prefiro o passo a passo guiado pelo Telegram
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleValidateToken()}
                        disabled={validating || !token.trim()}
                        className="px-5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-purple-500/20"
                      >
                        {validating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Verificando...</span>
                          </>
                        ) : (
                          <>
                            <span>Verificar token</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* ETAPA 3: APELIDO INTERNO PARA O BOT                       */}
            {/* ========================================================= */}
            {step === 3 && (
              <div className="pt-6 space-y-6 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
                    PASSO 3 DE 3
                  </span>
                  <h2 className="text-2xl font-bold tracking-tight text-white">
                    Um apelido interno para o bot
                  </h2>
                  <p className="text-xs md:text-sm text-zinc-400 leading-relaxed">
                    Esse apelido vale só aqui no painel. No Telegram, o comprador continua vendo o nome e o @ do bot.
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Card de exibição do bot validado */}
                {validatedBot && (
                  <div className="bg-[#141926] border border-white/10 rounded-2xl p-4 flex items-center gap-3.5">
                    {validatedBot.photoUrl ? (
                      <Image
                        src={validatedBot.photoUrl}
                        alt={validatedBot.username}
                        width={48}
                        height={48}
                        unoptimized
                        className="w-12 h-12 rounded-full object-cover border border-white/10"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#3984FF]/20 border border-[#3984FF]/40 text-[#3984FF] font-bold flex items-center justify-center text-lg">
                        {validatedBot.username?.charAt(0)?.toUpperCase() || "B"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white truncate">
                          {validatedBot.firstName}
                        </p>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Identificado
                        </span>
                      </div>
                      <p className="text-xs text-[#3984FF] font-mono truncate">
                        @{validatedBot.username}
                      </p>
                    </div>
                  </div>
                )}

                {/* Campo de Apelido com contador de caracteres */}
                <div className="bg-[#121622] border border-white/10 rounded-2xl p-5 space-y-3">
                  <label className="block text-xs font-bold text-white">
                    Apelido interno no WebGran
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={40}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ex: Minha Loja Principal"
                      className="w-full bg-[#181F2E] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#3984FF]"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Identificador usado apenas para organização da sua equipe.</span>
                    <span className="font-mono">{displayName.length}/40 · dá para mudar depois</span>
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      Voltar
                    </button>

                    <button
                      type="button"
                      onClick={handleFinalizeConnection}
                      disabled={connecting}
                      className="px-6 py-2.5 rounded-xl bg-[#3984FF] hover:bg-[#2F73E6] text-white text-xs font-bold transition-all shadow-lg shadow-[#3984FF]/25 flex items-center gap-2 active:scale-[0.98]"
                    >
                      <span>Finalizar conexão</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

