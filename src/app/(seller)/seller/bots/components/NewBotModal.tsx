"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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

export type NewBotFlow = "telegram" | "token";

export interface NewBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBotCreated?: (botId: string, newBot?: any) => void;
  initialStep?: 1 | 2 | 2.5 | 3;
  initialFlow?: NewBotFlow;
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
export function PhoneBotIllustration() {
  return (
    <div className="relative w-full h-32 sm:h-36 flex items-center justify-center select-none pointer-events-none">
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

      <div className="relative w-28 h-32 sm:h-36">
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
export function TokenKeyIllustration() {
  return (
    <div className="relative w-full h-32 sm:h-36 flex items-center justify-center select-none pointer-events-none">
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

/**
 * Ilustração vetorial do Card 1 (Passo 3): Smartphone com mensagens de conversa e venda (Pix)
 */
export function PhoneChatSalesIllustration({ isSelected = true }: { isSelected?: boolean }) {
  return (
    <div className="relative w-full h-32 sm:h-36 flex items-center justify-center select-none pointer-events-none">
      {/* Glow de fundo */}
      <div className={`absolute w-28 h-28 rounded-full blur-2xl -z-10 transition-colors ${
        isSelected ? "bg-[#3984FF]/20" : "bg-white/5"
      }`} />

      {/* Smartphone */}
      <div className={`relative w-44 sm:w-48 h-28 sm:h-32 bg-[#0E131F] rounded-2xl p-2.5 shadow-xl flex flex-col justify-between overflow-hidden transition-colors ${
        isSelected ? "border border-[#3984FF]/40" : "border border-white/10"
      }`}>
        {/* Barra superior com notch */}
        <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#3984FF]" />
            <div className="w-12 h-1 rounded-full bg-white/30" />
          </div>
          <div className="w-6 h-1 rounded-full bg-white/20" />
        </div>

        {/* Mensagem 1: Balão do bot com produto */}
        <div className="bg-[#192238] border border-[#3984FF]/25 rounded-lg p-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white flex items-center gap-1 truncate">
              📦 Produto Digital
            </span>
            <span className="text-[10px] font-bold text-[#3984FF] shrink-0">R$ 49,90</span>
          </div>
          <div className="w-full h-1 rounded-full bg-white/10" />
        </div>

        {/* Mensagem 2: Cobrança Pix na conversa */}
        <div className="bg-[#0D241E] border border-emerald-500/30 rounded-lg px-2 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[9px] font-bold">
              ❖
            </div>
            <span className="text-[10px] font-semibold text-emerald-300">Pix Copia e Cola</span>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
            Gerado
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Ilustração vetorial do Card 2 (Passo 3): Smartphone representando Loja/Mini App (Ativo/Disponível)
 */
export function PhoneMiniAppStoreIllustration({ isSelected = true }: { isSelected?: boolean }) {
  return (
    <div className="relative w-full h-32 sm:h-36 flex items-center justify-center select-none pointer-events-none">
      {/* Glow de fundo */}
      <div className={`absolute w-28 h-28 rounded-full blur-2xl -z-10 transition-colors ${
        isSelected ? "bg-[#3984FF]/20" : "bg-white/5"
      }`} />

      {/* Smartphone */}
      <div className={`relative w-44 sm:w-48 h-28 sm:h-32 bg-[#0E131F] rounded-2xl p-2.5 shadow-xl flex flex-col justify-between overflow-hidden transition-colors ${
        isSelected ? "border border-[#3984FF]/40" : "border border-white/10"
      }`}>
        {/* Barra superior de loja (marquise com toque azul) */}
        <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isSelected ? "bg-[#3984FF]" : "bg-zinc-500"}`} />
            <span className="text-[9px] font-bold text-zinc-200 uppercase tracking-wider">Loja Telegram</span>
          </div>
          <div className="w-5 h-1 rounded-full bg-white/30" />
        </div>

        {/* Grade de 2 produtos com cards iluminados */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="bg-[#192238] border border-[#3984FF]/25 rounded p-1.5 space-y-1">
            <div className="w-full h-4 rounded bg-[#3984FF]/30" />
            <div className="w-8 h-1 rounded bg-white/40" />
          </div>
          <div className="bg-[#192238] border border-[#3984FF]/25 rounded p-1.5 space-y-1">
            <div className="w-full h-4 rounded bg-[#3984FF]/30" />
            <div className="w-8 h-1 rounded bg-white/40" />
          </div>
        </div>

        {/* Botão de abrir catálogo com destaque */}
        <div className="w-full bg-[#3984FF]/20 border border-[#3984FF]/30 rounded py-1 text-center">
          <span className="text-[9px] text-[#3984FF] font-semibold">Abrir Loja Completa</span>
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
  initialFlow = "telegram",
  initialValidatedBot = null
}: NewBotModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Etapas: 
  // 1: Escolha do Método
  // 2: Fluxo Telegram (Instruções BotFather) OU Fluxo Token (Colar Token)
  // 2.5: Fluxo Telegram (Concluir criação: "Seu bot foi criado no Telegram?")
  // 3: Apelido Interno (com contexto diferenciado para cada fluxo)
  const [step, setStep] = useState<1 | 2 | 2.5 | 3>(initialStep);
  const [flow, setFlow] = useState<NewBotFlow>(initialFlow);

  // Dados do formulário
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [displayName, setDisplayName] = useState(initialValidatedBot?.firstName || "");
  const [salesMode, setSalesMode] = useState<"PADRAO" | "MINI_APP">("MINI_APP");

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

  // Montagem no cliente para createPortal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Bloqueio rigoroso de scroll do documento ao abrir o modal e restauração ao fechar
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // Tecla ESC para fechar quando seguro
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !connecting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, connecting, onClose]);

  if (!mounted || !isOpen) return null;

  // Fechar com proteção durante conexão ativa
  const handleClose = () => {
    if (connecting) return;
    setStep(1);
    setFlow("telegram");
    setToken("");
    setErrorMessage("");
    onClose();
  };

  // Validar Token
  const handleValidateToken = async () => {
    const cleanToken = token.trim();
    if (!cleanToken) {
      setErrorMessage("Por favor, cole o token de API retornado pelo @BotFather.");
      return;
    }

    setErrorMessage("");
    setValidating(true);

    try {
      const res = await validateBotTokenAction(cleanToken);
      if (res.success && res.data) {
        setValidatedBot(res.data);
        if (!displayName) {
          setDisplayName(res.data.firstName || res.data.username);
        }
        setStep(3); // Avança para o Passo 3 (Apelido Interno)
      } else {
        setErrorMessage(res.error || "Token inválido. Verifique se copiou a mensagem completa do @BotFather.");
      }
    } catch {
      setErrorMessage("Não foi possível verificar o token junto ao Telegram. Tente novamente.");
    } finally {
      setValidating(false);
    }
  };

  // Finalizar Conexão no Banco
  const handleFinalizeConnection = async () => {
    if (!token.trim()) return;
    setErrorMessage("");
    setConnecting(true);

    try {
      const res = await createNewBotAction({
        token: token.trim(),
        mode: salesMode,
        displayName: displayName.trim() || validatedBot?.firstName || validatedBot?.username,
      });

      if (res.success && res.data?.botId) {
        setCreatedBotId(res.data.botId);
        setConnectedSuccess(true);
        if (onBotCreated) {
          onBotCreated(res.data.botId, res.data.bot);
        }
      } else {
        setErrorMessage(res.error || "Falha ao registrar o bot.");
        setConnecting(false);
      }
    } catch {
      setErrorMessage("Erro ao salvar o bot no sistema.");
      setConnecting(false);
    }
  };

  // Redirecionar ao concluir
  const handleFinishAndRedirect = () => {
    router.refresh();
    if (createdBotId) {
      router.push(`/seller/bots/${createdBotId}`);
    } else {
      router.push("/seller/bots");
    }
    onClose();
  };

  // Cálculo da barra de progresso visual (Passos 1, 2 ou 3)
  const displayStepNumber = step === 2.5 ? 2 : step;

  const modalContent = (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md overflow-hidden p-0 sm:p-4 md:p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      data-testid="new-bot-modal-container"
      onClick={handleClose}
    >
      {/* Janela do Modal: quase full-screen no mobile com cabeçalho fixo e scroll interno */}
      <div 
        className="w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-[820px] bg-[#0F131D] sm:border sm:border-white/[0.08] sm:rounded-3xl shadow-2xl relative text-left flex flex-col overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
        data-testid="new-bot-modal-window"
      >
        {/* ========================================================= */}
        {/* CABEÇALHO FIXO: PROGRESSO + BOTÃO FECHAR                  */}
        {/* Nunca sai da tela nem é coberto pelo layout pai           */}
        {/* ========================================================= */}
        <header className="flex-shrink-0 flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5 border-b border-white/[0.08] bg-[#0F131D]/95 backdrop-blur-md z-20">
          {/* Indicador de 3 segmentos */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex items-center gap-1.5" data-testid="progress-bar-segments">
              <div
                className={`h-1.5 w-8 sm:w-9 rounded-full transition-all duration-300 ${
                  displayStepNumber >= 1 ? "bg-[#22C55E]" : "bg-white/10"
                }`}
              />
              <div
                className={`h-1.5 w-8 sm:w-9 rounded-full transition-all duration-300 ${
                  displayStepNumber >= 2 ? "bg-[#22C55E]" : "bg-white/10"
                }`}
              />
              <div
                className={`h-1.5 w-8 sm:w-9 rounded-full transition-all duration-300 ${
                  displayStepNumber >= 3 ? "bg-[#22C55E]" : "bg-white/10"
                }`}
              />
            </div>
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400">
              Passo {displayStepNumber} de 3
            </span>
          </div>

          {/* Botão de Fechar */}
          <button
            type="button"
            onClick={handleClose}
            disabled={connecting}
            className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
            aria-label="Fechar modal"
            data-testid="close-modal-button"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* ========================================================= */}
        {/* CONTEÚDO ROLÁVEL INTERNO                                  */}
        {/* ========================================================= */}
        <div 
          className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:pb-8 scrollbar-thin scrollbar-thumb-white/10"
          data-testid="new-bot-modal-scrollable-content"
        >
          {/* ========================================================= */}
          {/* ESTADO DE CONEXÃO ATIVA OU SUCESSO FINAL                  */}
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
                      {flow === "telegram"
                        ? "Recebemos o bot que você criou. Só um instante enquanto ele entra no seu painel."
                        : "Recebemos o token do seu bot. Só um instante enquanto ele entra no seu painel."}
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
                    <h3 className="text-xl font-bold text-white">
                      {flow === "telegram" ? "Bot criado e conectado com sucesso!" : "Bot conectado com sucesso!"}
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {salesMode === "PADRAO"
                        ? "Seu bot já está configurado no modo Venda na conversa e pronto para vender com entrega automática no Telegram."
                        : "Seu bot já está configurado no modo Mini App e pronto para vender com entrega automática no Telegram."}
                    </p>
                  </div>

                  {/* Resumo do bot conectado */}
                  <div className="bg-[#141926] border border-white/10 rounded-2xl p-4 flex items-center gap-3.5 w-full max-w-sm mt-2 text-left">
                    {validatedBot?.photoUrl ? (
                      <Image
                        src={validatedBot.photoUrl}
                        alt={validatedBot.username}
                        width={44}
                        height={44}
                        unoptimized
                        className="w-11 h-11 rounded-full object-cover border border-white/10"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-[#3984FF]/20 border border-[#3984FF]/40 text-[#3984FF] font-bold flex items-center justify-center text-sm">
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
                      className="w-full sm:w-auto px-7 py-3 rounded-xl bg-[#3984FF] hover:bg-[#2F73E6] text-white text-xs font-bold transition-all shadow-lg shadow-[#3984FF]/25 flex items-center justify-center gap-2 cursor-pointer"
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
              {/* ETAPA 1: ESCOLHA DO MÉTODO                                */}
              {/* ========================================================= */}
              {step === 1 && (
                <div className="space-y-6 animate-in fade-in duration-200" data-testid="step-1-method-selection">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-400">
                      NOVO BOT
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                      Como você quer prosseguir?
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-2xl">
                      Para vender e entregar no Telegram, você precisa de um bot. Crie um agora, direto pelo Telegram, ou conecte um que você já tem.
                    </p>
                  </div>

                  {/* Grid de Cards (empilhados no mobile, lado a lado no desktop) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 pt-1">
                    {/* CARD 1 — CRIAR PELO TELEGRAM */}
                    <div
                      onClick={() => {
                        setFlow("telegram");
                        setStep(2);
                      }}
                      className="group relative flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-[#111724] border border-[#1E293B] hover:border-sky-500/50 hover:bg-[#131D2E] transition-all duration-200 cursor-pointer overflow-hidden shadow-xl"
                      data-testid="card-create-by-telegram"
                    >
                      <div className="absolute top-0 right-0 w-44 h-44 bg-sky-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-sky-500/20 transition-all" />

                      <div className="space-y-4">
                        <PhoneBotIllustration />

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

                      <div className="pt-4 mt-auto flex items-center text-sky-400 text-xs font-semibold group-hover:translate-x-1 transition-transform">
                        <span>Começar por aqui</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </div>
                    </div>

                    {/* CARD 2 — COLAR O TOKEN */}
                    <div
                      onClick={() => {
                        setFlow("token");
                        setStep(2);
                      }}
                      className="group relative flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-[#151122] border border-[#2E1D4D] hover:border-purple-500/50 hover:bg-[#1C142E] transition-all duration-200 cursor-pointer overflow-hidden shadow-xl"
                      data-testid="card-paste-token"
                    >
                      <div className="absolute top-0 right-0 w-44 h-44 bg-purple-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/20 transition-all" />

                      <div className="space-y-4">
                        <TokenKeyIllustration />

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

                      <div className="pt-4 mt-auto flex items-center text-purple-400 text-xs font-semibold group-hover:translate-x-1 transition-transform">
                        <span>Começar por aqui</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* FLUXO A — PASSO 2: PREPARAÇÃO E CRIAÇÃO NO TELEGRAM       */}
              {/* ========================================================= */}
              {step === 2 && flow === "telegram" && (
                <div className="space-y-6 animate-in fade-in duration-200" data-testid="flow-telegram-step-2">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-sky-400">
                      CRIAR PELO TELEGRAM · PASSO 2 DE 3
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                      O Telegram cria o bot para você
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                      Siga as 3 etapas rápidas abaixo para criar seu bot oficial no Telegram e conectá-lo à WebGran:
                    </p>
                  </div>

                  {/* 3 Passos Numerados com destaque visual */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* Passo 1 */}
                    <div className="bg-[#141926] border border-sky-500/20 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <div className="w-7 h-7 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-400 font-bold text-xs flex items-center justify-center">
                          1
                        </div>
                        <h4 className="text-sm font-bold text-white">Abra o @BotFather</h4>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Inicie uma conversa com o bot oficial do Telegram responsável por criar e gerenciar todos os bots.
                        </p>
                      </div>

                      <a
                        href="https://t.me/BotFather"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-xs text-sky-400 font-semibold transition-colors mt-2"
                        data-testid="link-open-botfather"
                      >
                        <span>Abrir no Telegram</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {/* Passo 2 */}
                    <div className="bg-[#141926] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <div className="w-7 h-7 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-400 font-bold text-xs flex items-center justify-center">
                          2
                        </div>
                        <h4 className="text-sm font-bold text-white">Envie /newbot</h4>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Escolha o nome público do bot e defina o @username terminado obrigatoriamente em <span className="text-white font-mono font-semibold">bot</span> (ex: <span className="text-white font-mono">MinhaLojaBot</span>).
                        </p>
                      </div>
                      <div className="py-2 px-3 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-zinc-400 font-mono">
                        Comando: /newbot
                      </div>
                    </div>

                    {/* Passo 3 */}
                    <div className="bg-[#141926] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <div className="w-7 h-7 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-400 font-bold text-xs flex items-center justify-center">
                          3
                        </div>
                        <h4 className="text-sm font-bold text-white">Copie o Token de API</h4>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          O BotFather confirmará a criação e enviará a chave HTTP API. Copie esse token para concluir a criação aqui.
                        </p>
                      </div>
                      <div className="py-2 px-3 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-zinc-400 font-mono truncate">
                        Formato: 123456:ABC...
                      </div>
                    </div>
                  </div>

                  {/* Ações inferiores da etapa de preparação */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                      data-testid="button-back-to-step-1"
                    >
                      Voltar à escolha
                    </button>

                    <button
                      type="button"
                      onClick={() => setStep(2.5)}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-[#0F131D] text-xs font-bold transition-all shadow-md shadow-sky-500/25 flex items-center justify-center gap-2 cursor-pointer"
                      data-testid="button-advance-to-token-creation"
                    >
                      <span>Já criei meu bot no Telegram →</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* FLUXO A — PASSO 2.5: CONCLUIR CRIAÇÃO DO NOVO BOT         */}
              {/* Mantém o contexto de criação até o fim                    */}
              {/* ========================================================= */}
              {step === 2.5 && flow === "telegram" && (
                <div className="space-y-6 animate-in fade-in duration-200" data-testid="flow-telegram-step-conclusion">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-sky-400">
                      CONCLUIR CRIAÇÃO DO BOT · PASSO 2 DE 3
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                      Seu bot foi criado no Telegram?
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                      Agora cole aqui o token que o BotFather acabou de fornecer para conectar seu novo bot à WebGran.
                    </p>
                  </div>

                  {errorMessage && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Card do formulário de token de criação */}
                  <div className="bg-[#121622] border border-sky-500/20 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
                    <label className="block text-xs font-bold text-white">
                      Token HTTP API do novo bot:
                    </label>

                    <div className="relative">
                      <input
                        type={showToken ? "text" : "password"}
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Ex: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                        className="w-full bg-[#181F2E] border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-sky-400 pr-11"
                        data-testid="input-new-bot-token"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3.5 top-3.5 text-zinc-400 hover:text-white"
                        title={showToken ? "Ocultar" : "Mostrar"}
                      >
                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Guardamos sua chave criptografada com AES-256 e protegida contra leitura externa.</span>
                    </p>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        Voltar ao passo anterior
                      </button>

                      <button
                        type="button"
                        onClick={handleValidateToken}
                        disabled={validating || !token.trim()}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-[#0F131D] text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-sky-500/25 cursor-pointer"
                        data-testid="button-connect-new-bot"
                      >
                        {validating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Validando novo bot...</span>
                          </>
                        ) : (
                          <>
                            <span>Conectar meu novo bot</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* FLUXO B — PASSO 2: CONECTAR COM TOKEN (BOT EXISTENTE)     */}
              {/* ========================================================= */}
              {step === 2 && flow === "token" && (
                <div className="space-y-6 animate-in fade-in duration-200" data-testid="flow-token-step-2">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-purple-400">
                      JÁ TENHO UM BOT · PASSO 2 DE 3
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                      Conecte o token do seu bot
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                      É a chave que permite à WebGran atender por ele. Guardamos criptografada e ninguém mais lê.
                    </p>
                  </div>

                  {errorMessage && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Card didático para bot existente */}
                  <div className="bg-[#171424] border border-purple-500/20 rounded-2xl p-4 sm:p-5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wider">
                      <HelpCircle className="w-4 h-4 text-purple-400" />
                      <span>Onde encontrar o token do seu bot?</span>
                    </div>
                    <ol className="text-xs text-zinc-400 space-y-1.5 pl-4 list-decimal">
                      <li>Abra o Telegram e acesse o <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-purple-400 underline font-mono">@BotFather</a></li>
                      <li>Envie o comando <span className="text-white font-mono font-semibold">/mybots</span> e selecione seu bot existente</li>
                      <li>Clique em <span className="text-white font-semibold">API Token</span> e copie a chave gerada</li>
                    </ol>
                  </div>

                  {/* Formulário de token existente */}
                  <div className="bg-[#141320] border border-white/10 rounded-2xl p-5 space-y-4">
                    <label className="block text-xs font-bold text-white">
                      Token de API do Bot
                    </label>
                    <div className="relative">
                      <input
                        type={showToken ? "text" : "password"}
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Ex: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                        className="w-full bg-[#1A1828] border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-purple-400 pr-11"
                        data-testid="input-existing-bot-token"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3.5 top-3.5 text-zinc-400 hover:text-white"
                        title={showToken ? "Ocultar" : "Mostrar"}
                      >
                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        Voltar à escolha
                      </button>

                      <button
                        type="button"
                        onClick={handleValidateToken}
                        disabled={validating || !token.trim()}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-purple-500/25 cursor-pointer"
                        data-testid="button-verify-existing-token"
                      >
                        {validating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Verificando token...</span>
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
              )}

              {/* ========================================================= */}
              {/* PASSO 3: APELIDO INTERNO E SELEÇÃO DO MODO DE VENDA       */}
              {/* Mantém o contexto de cada fluxo (Novo vs Existente)       */}
              {/* ========================================================= */}
              {step === 3 && (
                <div className="space-y-6 animate-in fade-in duration-200" data-testid="step-3-nickname">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
                      {flow === "telegram" ? "FINALIZAR CRIAÇÃO · PASSO 3 DE 3" : "FINALIZAR CONEXÃO · PASSO 3 DE 3"}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                      {flow === "telegram" ? "Configure seu novo bot" : "Configure o bot conectado"}
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                      Defina o apelido interno para sua equipe e escolha o modo de venda no Telegram.
                    </p>
                  </div>

                  {errorMessage && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* 1. Card de identificação do bot validado */}
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
                            {flow === "telegram" ? "Bot Criado" : "Identificado"}
                          </span>
                        </div>
                        <p className="text-xs text-[#3984FF] font-mono truncate">
                          @{validatedBot.username}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 2. Campo de Apelido com contador de caracteres */}
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
                        className="w-full bg-[#181F2E] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#3984FF]"
                        data-testid="input-bot-nickname"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span>Identificador usado apenas para organização da sua equipe.</span>
                      <span className="font-mono">{displayName.length}/40 · dá para mudar depois</span>
                    </div>
                  </div>

                  {/* 3. Seção "Como você quer vender?" & 4. Cards de Seleção dos Modos de Venda */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-white tracking-tight">
                        Como você quer vender?
                      </h3>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Selecione o formato de atendimento e checkout do seu bot no Telegram.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* CARD 1 — MINI APP (Loja dentro do Telegram - FUNCIONANDO / PADRÃO) */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSalesMode("MINI_APP")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSalesMode("MINI_APP");
                          }
                        }}
                        className={`relative rounded-2xl p-5 transition-all cursor-pointer flex flex-col justify-between text-left group ${
                          salesMode === "MINI_APP"
                            ? "bg-[#131B2E] border-2 border-[#3984FF] shadow-[0_0_25px_rgba(57,132,255,0.18)]"
                            : "bg-[#12151F] border border-white/10 hover:border-white/20"
                        }`}
                        data-testid="card-mode-miniapp"
                        aria-pressed={salesMode === "MINI_APP"}
                      >
                        {/* Header do Card com Tag MINI APP e Selo Selecionado */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            MINI APP
                          </span>
                          {salesMode === "MINI_APP" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#3984FF] text-white shadow-sm shadow-[#3984FF]/40">
                              <Check className="w-3 h-3 stroke-[3]" />
                              Selecionado
                            </span>
                          )}
                        </div>

                        {/* Ilustração vetorial do smartphone com loja */}
                        <PhoneMiniAppStoreIllustration isSelected={salesMode === "MINI_APP"} />

                        {/* Textos descritivos */}
                        <div className="space-y-1.5 mt-3">
                          <h4 className="text-base font-bold text-white group-hover:text-[#3984FF] transition-colors">
                            Loja dentro do Telegram
                          </h4>
                          <p className="text-xs text-zinc-400 leading-relaxed">
                            Um botão abre uma loja com fotos, planos e pagamento, sem sair do Telegram.
                          </p>
                        </div>
                      </div>

                      {/* CARD 2 — PADRÃO (Venda na conversa - EM BREVE) */}
                      <div
                        aria-disabled="true"
                        className="relative rounded-2xl p-5 bg-[#101218]/70 border border-white/[0.06] opacity-60 cursor-not-allowed flex flex-col justify-between text-left select-none pointer-events-none"
                        data-testid="card-mode-padrao"
                      >
                        {/* Header do Card com Tag PADRÃO e Selo Em breve */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/5 text-zinc-400 border border-white/10">
                            PADRÃO
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-white/10">
                            Em breve
                          </span>
                        </div>

                        {/* Ilustração vetorial do smartphone com conversa e venda */}
                        <PhoneChatSalesIllustration isSelected={false} />

                        {/* Textos descritivos */}
                        <div className="space-y-1.5 mt-3">
                          <h4 className="text-base font-bold text-zinc-300">
                            Venda na conversa
                          </h4>
                          <p className="text-xs text-zinc-500 leading-relaxed">
                            O bot mostra os produtos em mensagens e manda o Pix ali mesmo. O cartão abre uma tela de pagamento.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5. Botões de Finalização */}
                  <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => {
                        if (flow === "telegram") {
                          setStep(2.5);
                        } else {
                          setStep(2);
                        }
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                      data-testid="button-back-to-step-2"
                    >
                      Voltar
                    </button>

                    <button
                      type="button"
                      onClick={handleFinalizeConnection}
                      disabled={connecting}
                      className="w-full sm:w-auto px-7 py-3 rounded-xl bg-[#3984FF] hover:bg-[#2F73E6] text-white text-xs font-bold transition-all shadow-lg shadow-[#3984FF]/25 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
                      data-testid="button-finalize-creation"
                    >
                      {connecting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{flow === "telegram" ? "Finalizando criação..." : "Finalizando conexão..."}</span>
                        </>
                      ) : (
                        <>
                          <span>{flow === "telegram" ? "Finalizar criação" : "Finalizar conexão"}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Renderização obrigatória via Portal diretamente no document.body
  return createPortal(modalContent, document.body);
}
