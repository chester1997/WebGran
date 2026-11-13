"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  X, 
  Check, 
  Plus, 
  Bot, 
  Link2, 
  ExternalLink, 
  Play, 
  ArrowRight,
  Shield,
  Lock,
  Sparkles,
  Tv
} from "lucide-react";

export type DeliveryModality = "telegram" | "external" | "product_video";

export interface DeliveryChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModality?: (modality: DeliveryModality) => void;
}

/**
 * Ilustração vetorial do Card 1: Grupo / Canal Telegram (Azul)
 */
function TelegramChannelIllustration({ isSelected }: { isSelected: boolean }) {
  return (
    <div className="relative w-full h-32 sm:h-36 flex items-center justify-center select-none pointer-events-none overflow-hidden rounded-xl bg-gradient-to-b from-[#131B2E] via-[#0E1424] to-[#0A0D18] border border-[#3984FF]/20 group-hover:border-[#3984FF]/40 transition-colors">
      {/* Glow de fundo */}
      <div 
        className={`absolute w-32 h-32 rounded-full transition-opacity duration-300 blur-2xl ${
          isSelected ? "bg-[#3984FF]/30 opacity-100" : "bg-[#3984FF]/15 opacity-70 group-hover:opacity-100"
        }`} 
      />

      {/* Janela de Chat Estilizada */}
      <div className="relative w-48 h-24 bg-[#141A29]/90 border border-white/10 rounded-xl p-3 shadow-xl backdrop-blur-sm flex flex-col justify-between">
        {/* Barra superior com 3 pontinhos */}
        <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-white/20" />
            <div className="w-2 h-2 rounded-full bg-white/20" />
            <div className="w-2 h-2 rounded-full bg-white/20" />
          </div>
          <span className="text-[9px] font-mono text-[#3984FF] font-semibold tracking-wider flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" /> CANAL VIP
          </span>
        </div>

        {/* Bolha de mensagem simulada */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#3984FF] flex items-center justify-center text-white shrink-0 shadow-md shadow-[#3984FF]/30">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <div className="h-4 flex-1 rounded-md bg-[#3984FF]/20 border border-[#3984FF]/30 flex items-center px-2">
            <div className="h-1.5 w-16 bg-[#3984FF] rounded-full" />
          </div>
        </div>

        {/* Badge flutuante de entrada autorizada */}
        <div className="flex items-center justify-between text-[8px] text-zinc-400 pt-0.5">
          <span className="text-zinc-500">Convite automático</span>
          <span className="text-[#3984FF] font-medium flex items-center gap-0.5">
            <Shield className="w-2.5 h-2.5" /> 100% Seguro
          </span>
        </div>
      </div>

      {/* Ícone flutuante do Telegram/Cadeado no topo direito */}
      <div className="absolute top-2 right-2.5 w-7 h-7 rounded-full bg-[#3984FF]/20 border border-[#3984FF]/50 flex items-center justify-center text-[#3984FF] shadow-lg shadow-[#3984FF]/20">
        <Lock className="w-3.5 h-3.5" />
      </div>
    </div>
  );
}

/**
 * Ilustração vetorial do Card 2: Link Externo (Verde-limão)
 */
function ExternalLinkIllustration({ isSelected }: { isSelected: boolean }) {
  return (
    <div className="relative w-full h-32 sm:h-36 flex items-center justify-center select-none pointer-events-none overflow-hidden rounded-xl bg-gradient-to-b from-[#142318] via-[#0E1B12] to-[#0A120D] border border-lime-400/20 group-hover:border-lime-400/40 transition-colors">
      {/* Glow de fundo */}
      <div 
        className={`absolute w-32 h-32 rounded-full transition-opacity duration-300 blur-2xl ${
          isSelected ? "bg-lime-400/30 opacity-100" : "bg-lime-400/15 opacity-70 group-hover:opacity-100"
        }`} 
      />

      {/* Card central com URL e Link */}
      <div className="relative w-48 h-24 bg-[#142217]/90 border border-white/10 rounded-xl p-3 shadow-xl backdrop-blur-sm flex flex-col justify-between">
        {/* Barra superior de URL */}
        <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-white/20" />
            <div className="w-2 h-2 rounded-full bg-white/20" />
            <div className="w-2 h-2 rounded-full bg-white/20" />
          </div>
          <span className="text-[9px] font-mono text-lime-400 font-semibold tracking-wider flex items-center gap-1">
            <Link2 className="w-2.5 h-2.5" /> https://...
          </span>
        </div>

        {/* Ícone de link conectado */}
        <div className="flex items-center justify-center py-1">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-lime-400/15 border border-lime-400/30 text-lime-300">
            <Link2 className="w-4 h-4 text-lime-400 animate-pulse" />
            <span className="text-[10px] font-bold tracking-wide">ENTREGA DE LINK</span>
          </div>
        </div>

        {/* Rodapé auxiliar */}
        <div className="flex items-center justify-between text-[8px] text-zinc-400 pt-0.5">
          <span className="text-zinc-500">Qualquer URL externa</span>
          <span className="text-lime-400 font-medium flex items-center gap-0.5">
            <ExternalLink className="w-2.5 h-2.5" /> Redirecionamento
          </span>
        </div>
      </div>

      {/* Ícone de seta externa no topo direito */}
      <div className="absolute top-2 right-2.5 w-7 h-7 rounded-full bg-lime-400/20 border border-lime-400/50 flex items-center justify-center text-lime-400 shadow-lg shadow-lime-400/20">
        <ExternalLink className="w-3.5 h-3.5" />
      </div>
    </div>
  );
}

/**
 * Ilustração vetorial do Card 3: Vídeo do Produto (Violeta / Roxo em tom complementar)
 */
function ProductVideoIllustration({ isSelected }: { isSelected: boolean }) {
  return (
    <div className="relative w-full h-32 sm:h-36 flex items-center justify-center select-none pointer-events-none overflow-hidden rounded-xl bg-gradient-to-b from-[#22132E] via-[#1A0E24] to-[#120A1A] border border-purple-500/20 group-hover:border-purple-500/40 transition-colors">
      {/* Glow de fundo */}
      <div 
        className={`absolute w-32 h-32 rounded-full transition-opacity duration-300 blur-2xl ${
          isSelected ? "bg-purple-500/30 opacity-100" : "bg-purple-500/15 opacity-70 group-hover:opacity-100"
        }`} 
      />

      {/* Player de Vídeo em miniatura */}
      <div className="relative w-48 h-24 bg-[#1F132A]/90 border border-white/10 rounded-xl p-3 shadow-xl backdrop-blur-sm flex flex-col justify-between">
        {/* Barra superior de mídia */}
        <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-white/20" />
            <div className="w-2 h-2 rounded-full bg-white/20" />
            <div className="w-2 h-2 rounded-full bg-white/20" />
          </div>
          <span className="text-[9px] font-mono text-purple-400 font-semibold tracking-wider flex items-center gap-1">
            <Tv className="w-2.5 h-2.5" /> MINI APP
          </span>
        </div>

        {/* Botão de Play central com efeito */}
        <div className="flex items-center justify-center py-0.5">
          <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
            <Play className="w-4 h-4 ml-0.5 fill-white" />
          </div>
        </div>

        {/* Barra de progresso de vídeo */}
        <div className="space-y-1">
          <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
            <div className="h-full w-2/3 bg-purple-500 rounded-full" />
          </div>
          <div className="flex items-center justify-between text-[8px] text-zinc-400">
            <span className="text-zinc-500">Streaming protegido</span>
            <span className="text-purple-400 font-medium flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> HD / 4K
            </span>
          </div>
        </div>
      </div>

      {/* Ícone de play no topo direito */}
      <div className="absolute top-2 right-2.5 w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/50 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-500/20">
        <Play className="w-3.5 h-3.5 ml-0.5 fill-purple-400" />
      </div>
    </div>
  );
}

export function DeliveryChoiceModal({
  isOpen,
  onClose,
  onSelectModality
}: DeliveryChoiceModalProps) {
  const [selectedModality, setSelectedModality] = useState<DeliveryModality | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevenir scroll do body quando o modal estiver aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
      setFeedbackNotice(null);
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Tecla ESC para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const handleSelect = (modality: DeliveryModality) => {
    setSelectedModality(modality);
    setFeedbackNotice(null);
  };

  const handleContinue = () => {
    if (!selectedModality) return;
    if (onSelectModality) {
      onSelectModality(selectedModality);
    }
    const labelMap: Record<DeliveryModality, string> = {
      telegram: "Grupo / Canal Telegram",
      external: "Link externo",
      product_video: "Vídeo do Produto",
    };
    setFeedbackNotice(`Modalidade selecionada: "${labelMap[selectedModality]}". Aguardando definição do fluxo subsequente.`);
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delivery-modal-title"
    >
      {/* Overlay escuro com desfoque */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Container Principal do Modal */}
      <div className="relative w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] bg-[#0C0D12] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-zinc-100 z-10 animate-in zoom-in-95 duration-200">
        
        {/* Cabeçalho do Modal */}
        <div className="relative px-5 pt-6 pb-4 sm:px-8 sm:pt-8 sm:pb-5 border-b border-white/[0.08] shrink-0">
          {/* Botão de Fechar */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 sm:top-7 sm:right-7 w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[#3984FF]"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Título e Subtítulo */}
          <div className="pr-10">
            <h2 
              id="delivery-modal-title"
              className="text-lg sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight uppercase"
            >
              COMO DESEJA ENTREGAR
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-zinc-400 mt-1.5 leading-relaxed">
              Escolha como o comprador receberá o acesso ao produto após a confirmação do pagamento.
            </p>
          </div>
        </div>

        {/* Corpo Rolável com as Três Opções de Entrega */}
        <div 
          id="delivery-modal-scrollable-body"
          className="overflow-y-auto px-5 py-6 sm:px-8 sm:py-7 flex-1 space-y-6 custom-scrollbar"
        >
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            
            {/* OPÇÃO 1 — GRUPO / CANAL TELEGRAM */}
            <div
              onClick={() => handleSelect("telegram")}
              className={`group relative rounded-xl p-4 sm:p-5 cursor-pointer transition-all flex flex-col justify-between border text-left ${
                selectedModality === "telegram"
                  ? "bg-[#3984FF]/[0.08] border-[#3984FF] shadow-lg shadow-[#3984FF]/10 ring-1 ring-[#3984FF]/30"
                  : "bg-[#12141A] border-white/[0.08] hover:border-white/20 hover:bg-[#161822]"
              }`}
            >
              {/* Indicador de Seleção no Canto Superior Direito */}
              <div className="absolute top-3 right-3 z-10">
                <div 
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                    selectedModality === "telegram"
                      ? "bg-[#3984FF] text-white shadow-md shadow-[#3984FF]/30"
                      : "border border-white/25 bg-black/40"
                  }`}
                >
                  {selectedModality === "telegram" && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>

              {/* Ilustração */}
              <TelegramChannelIllustration isSelected={selectedModality === "telegram"} />

              {/* Informações da Opção */}
              <div className="flex-1 flex flex-col">
                <span className="text-[10px] font-bold tracking-wider uppercase text-[#3984FF] mb-1 block">
                  Comunidade Fechada
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white mb-2 leading-snug">
                  Grupo / Canal Telegram
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-4 flex-1">
                  Um grupo, canal ou supergrupo no Telegram. Quem paga entra na hora e quem vence sai sozinho.
                </p>
              </div>

              {/* Texto Auxiliar com Ícone */}
              <div className="pt-3 border-t border-white/[0.08] flex items-center gap-2 text-xs text-[#3984FF] font-medium">
                <Bot className="w-3.5 h-3.5 shrink-0" />
                <span className="leading-tight">Bot envia link de convite automaticamente.</span>
              </div>
            </div>

            {/* OPÇÃO 2 — LINK EXTERNO */}
            <div
              onClick={() => handleSelect("external")}
              className={`group relative rounded-xl p-4 sm:p-5 cursor-pointer transition-all flex flex-col justify-between border text-left ${
                selectedModality === "external"
                  ? "bg-lime-400/[0.08] border-lime-400 shadow-lg shadow-lime-400/10 ring-1 ring-lime-400/30"
                  : "bg-[#12141A] border-white/[0.08] hover:border-white/20 hover:bg-[#161822]"
              }`}
            >
              {/* Indicador de Seleção */}
              <div className="absolute top-3 right-3 z-10">
                <div 
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                    selectedModality === "external"
                      ? "bg-lime-400 text-black shadow-md shadow-lime-400/30"
                      : "border border-white/25 bg-black/40"
                  }`}
                >
                  {selectedModality === "external" && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>

              {/* Ilustração */}
              <ExternalLinkIllustration isSelected={selectedModality === "external"} />

              {/* Informações da Opção */}
              <div className="flex-1 flex flex-col">
                <span className="text-[10px] font-bold tracking-wider uppercase text-lime-400 mb-1 block">
                  Acesso por Link
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white mb-2 leading-snug">
                  Link externo
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-4 flex-1">
                  Entregue qualquer link ao comprador após a confirmação do pagamento.
                </p>
              </div>

              {/* Texto Auxiliar com Ícone */}
              <div className="pt-3 border-t border-white/[0.08] flex items-center gap-2 text-xs text-lime-400 font-medium">
                <Link2 className="w-3.5 h-3.5 shrink-0" />
                <span className="leading-tight">Bot envia qualquer link após pagamento.</span>
              </div>
            </div>

            {/* OPÇÃO 3 — VÍDEO DO PRODUTO */}
            <div
              onClick={() => handleSelect("product_video")}
              className={`group relative rounded-xl p-4 sm:p-5 cursor-pointer transition-all flex flex-col justify-between border text-left ${
                selectedModality === "product_video"
                  ? "bg-purple-500/[0.08] border-purple-500 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/30"
                  : "bg-[#12141A] border-white/[0.08] hover:border-white/20 hover:bg-[#161822]"
              }`}
            >
              {/* Indicador de Seleção */}
              <div className="absolute top-3 right-3 z-10">
                <div 
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                    selectedModality === "product_video"
                      ? "bg-purple-500 text-white shadow-md shadow-purple-500/30"
                      : "border border-white/25 bg-black/40"
                  }`}
                >
                  {selectedModality === "product_video" && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>

              {/* Ilustração */}
              <ProductVideoIllustration isSelected={selectedModality === "product_video"} />

              {/* Informações da Opção */}
              <div className="flex-1 flex flex-col">
                <span className="text-[10px] font-bold tracking-wider uppercase text-purple-400 mb-1 block">
                  Streaming Mini App
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white mb-2 leading-snug">
                  Vídeo do Produto
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-4 flex-1">
                  Cliente recebe acesso aos vídeos pelo Mini App.
                </p>
              </div>

              {/* Texto Auxiliar com Ícone */}
              <div className="pt-3 border-t border-white/[0.08] flex items-center gap-2 text-xs text-purple-400 font-medium">
                <Tv className="w-3.5 h-3.5 shrink-0" />
                <span className="leading-tight">Conteúdo liberado no Mini App.</span>
              </div>
            </div>

          </div>

          {/* Feedback informativo quando o botão de continuar for clicado */}
          {feedbackNotice && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs sm:text-sm flex items-center gap-3 animate-in fade-in duration-150">
              <Sparkles className="w-4 h-4 shrink-0 text-[#3984FF]" />
              <span className="flex-1">{feedbackNotice}</span>
            </div>
          )}

        </div>

        {/* Rodapé do Modal */}
        <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-white/[0.08] bg-[#0E1017] flex flex-col-reverse sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs sm:text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-all text-center"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedModality}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-all border ${
              selectedModality
                ? "bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white border-blue-500/30 cursor-pointer"
                : "bg-white/5 text-zinc-500 border-white/5 cursor-not-allowed opacity-50"
            }`}
          >
            <span>Continuar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

