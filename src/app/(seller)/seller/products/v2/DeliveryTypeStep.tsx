"use client";

import React from "react";
import { Bot, Link as LinkIcon, Tv, X, Check, ArrowRight } from "lucide-react";
import { DeliveryTypeV2, DELIVERY_TYPE_CONFIG } from "./types";

interface DeliveryTypeStepProps {
  selectedType: DeliveryTypeV2;
  onSelectType: (type: DeliveryTypeV2) => void;
  onContinue: () => void;
  onClose: () => void;
}

export function DeliveryTypeStep({
  selectedType,
  onSelectType,
  onContinue,
  onClose,
}: DeliveryTypeStepProps) {
  const currentConfig = DELIVERY_TYPE_CONFIG[selectedType];

  return (
    <div className="w-full flex flex-col h-full select-none">
      {/* =========================================================================
          DESKTOP VIEW (>= 640px)
         ========================================================================= */}
      <div className="hidden sm:flex flex-col w-full">
        {/* Cabeçalho Desktop */}
        <div className="flex items-start justify-between mb-[18px]">
          <div>
            <div className="text-[11px] font-medium tracking-[0.09em] uppercase text-[#71717a] mb-[6px]">
              NOVO PRODUTO · PASSO 1 DE 2
            </div>
            <h2 className="text-[22px] font-medium text-[#f4f4f5] leading-tight">
              Como deseja entregar?
            </h2>
            <p className="text-[13px] text-[#9a9aa2] mt-1 leading-snug">
              O comprador recebe o acesso assim que o pagamento for aprovado.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1 text-[#9a9aa2] hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Grid de 3 Cards */}
        <div
          role="radiogroup"
          aria-label="Escolha a forma de entrega"
          className="grid grid-cols-3 gap-3 w-full"
        >
          {/* CARD 1: Grupo ou canal */}
          <DeliveryCardDesktop
            type="telegram"
            isSelected={selectedType === "telegram"}
            onSelect={() => onSelectType("telegram")}
            icon={<Bot className="w-3.5 h-3.5" />}
          >
            <svg viewBox="0 0 200 140" width="100%" style={{ display: "block" }} aria-hidden="true">
              <circle cx="100" cy="72" r="62" fill="#38bdf8" opacity=".06" />
              <circle cx="100" cy="72" r="44" fill="#38bdf8" opacity=".09" />
              <rect x="36" y="38" width="108" height="76" rx="9" fill="#1c1c20" stroke="#2e2e33" />
              <line x1="36" y1="54" x2="144" y2="54" stroke="#2e2e33" />
              <circle cx="47" cy="46" r="2.5" fill="#3a3a40" />
              <circle cx="56" cy="46" r="2.5" fill="#3a3a40" />
              <circle cx="65" cy="46" r="2.5" fill="#3a3a40" />
              <rect x="48" y="62" width="44" height="10" rx="5" fill="#2a2a2f" />
              <rect x="74" y="78" width="58" height="10" rx="5" fill="#38bdf8" />
              <rect x="48" y="94" width="34" height="10" rx="5" fill="#2a2a2f" />
              <circle cx="58" cy="99" r="1.8" fill="#6b6b73" />
              <circle cx="65" cy="99" r="1.8" fill="#6b6b73" />
              <circle cx="72" cy="99" r="1.8" fill="#6b6b73" />
              <circle cx="146" cy="40" r="18" fill="#38bdf8" stroke="#0e0e10" strokeWidth="3" />
              <rect x="139" y="40" width="14" height="11" rx="2.5" fill="#0a0a0b" />
              <path d="M142 40v-3.5a4 4 0 0 1 8 0V40" fill="none" stroke="#0a0a0b" strokeWidth="2" />
            </svg>
          </DeliveryCardDesktop>

          {/* CARD 2: Link externo */}
          <DeliveryCardDesktop
            type="external"
            isSelected={selectedType === "external"}
            onSelect={() => onSelectType("external")}
            icon={<LinkIcon className="w-3.5 h-3.5" />}
          >
            <svg viewBox="0 0 200 140" width="100%" style={{ display: "block" }} aria-hidden="true">
              <circle cx="100" cy="72" r="62" fill="#a3e635" opacity=".06" />
              <circle cx="100" cy="72" r="44" fill="#a3e635" opacity=".09" />
              <rect x="32" y="40" width="136" height="74" rx="9" fill="#1c1c20" stroke="#2e2e33" />
              <circle cx="43" cy="50" r="2.5" fill="#3a3a40" />
              <circle cx="52" cy="50" r="2.5" fill="#3a3a40" />
              <circle cx="61" cy="50" r="2.5" fill="#3a3a40" />
              <rect x="46" y="62" width="108" height="16" rx="8" fill="#0e0e10" stroke="#2e2e33" />
              <text x="58" y="74" fontFamily="monospace" fontSize="10" fill="#a3e635">https://...</text>
              <rect x="58" y="88" width="84" height="18" rx="9" fill="#a3e635" />
              <text x="100" y="100.5" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="500" fill="#0a0a0b">Acessar</text>
              <circle cx="160" cy="42" r="16" fill="#a3e635" stroke="#0e0e10" strokeWidth="3" />
              <path d="M155 47l10-10m0 0h-6m6 0v6" fill="none" stroke="#0a0a0b" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </DeliveryCardDesktop>

          {/* CARD 3: Vídeo do produto */}
          <DeliveryCardDesktop
            type="product_video"
            isSelected={selectedType === "product_video"}
            onSelect={() => onSelectType("product_video")}
            icon={<Tv className="w-3.5 h-3.5" />}
          >
            <svg viewBox="0 0 200 140" width="100%" style={{ display: "block" }} aria-hidden="true">
              <circle cx="100" cy="72" r="62" fill="#c084fc" opacity=".06" />
              <circle cx="100" cy="72" r="44" fill="#c084fc" opacity=".09" />
              <rect x="40" y="48" width="56" height="70" rx="8" fill="#17171a" stroke="#2e2e33" transform="rotate(-9 68 83)" />
              <rect x="104" y="48" width="56" height="70" rx="8" fill="#17171a" stroke="#2e2e33" transform="rotate(9 132 83)" />
              <rect x="64" y="30" width="72" height="92" rx="11" fill="#1c1c20" stroke="#3a3a40" />
              <rect x="72" y="40" width="56" height="42" rx="6" fill="#2a2a2f" />
              <circle cx="100" cy="61" r="14" fill="#c084fc" />
              <polygon points="95,54 95,68 107,61" fill="#0a0a0b" />
              <rect x="72" y="92" width="56" height="5" rx="2.5" fill="#2a2a2f" />
              <rect x="72" y="92" width="34" height="5" rx="2.5" fill="#c084fc" />
              <rect x="72" y="104" width="30" height="4" rx="2" fill="#2a2a2f" />
            </svg>
          </DeliveryCardDesktop>
        </div>

        {/* Rodapé Desktop */}
        <div className="mt-4 pt-[14px] border-t border-[#1e1e22] flex items-center justify-between gap-3">
          {/* Resumo da escolha à esquerda */}
          <div className="flex items-center gap-2 text-[13px] text-[#9a9aa2] min-w-0">
            <span
              className="w-2 h-2 rounded-full shrink-0 transition-colors"
              style={{ backgroundColor: currentConfig.cc }}
            />
            <span className="truncate">{currentConfig.summaryText}</span>
          </div>

          {/* Botões à direita */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="text-[14px] text-[#9a9aa2] hover:text-[#f4f4f5] px-[14px] py-[9px] rounded-[10px] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onContinue}
              style={{ backgroundColor: currentConfig.cc }}
              className="text-[14px] font-medium text-[#0a0a0b] px-[18px] py-[9px] rounded-[10px] inline-flex items-center gap-1.5 transition-all hover:brightness-105 active:scale-[0.98] cursor-pointer shadow-sm"
            >
              <span>Continuar</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MOBILE VIEW (< 640px) - Bottom Sheet
         ========================================================================= */}
      <div className="flex sm:hidden flex-col w-full pb-[env(safe-area-inset-bottom,0px)]">
        {/* Alça no topo */}
        <div className="w-9 h-1 rounded-[2px] bg-[#3a3a40] mx-auto mt-0.5 mb-3 shrink-0" />

        {/* Cabeçalho Mobile */}
        <div className="flex items-start justify-between mb-3 shrink-0">
          <div>
            <div className="text-[10px] font-medium tracking-[0.09em] uppercase text-[#71717a]">
              PASSO 1 DE 2
            </div>
            <h2 className="text-[20px] font-medium text-[#f4f4f5] leading-tight">
              Como deseja entregar?
            </h2>
            <p className="text-[12px] text-[#9a9aa2] mt-[3px] leading-[1.4]">
              O comprador recebe o acesso quando o pagamento for aprovado.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 -mr-1 text-[#9a9aa2] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista Horizontal de Opções */}
        <div
          role="radiogroup"
          aria-label="Escolha a forma de entrega"
          className="flex flex-col gap-2.5 overflow-y-auto max-h-[58dvh] custom-scrollbar pr-0.5"
        >
          {/* ITEM MOBILE 1 */}
          <DeliveryCardMobile
            type="telegram"
            isSelected={selectedType === "telegram"}
            onSelect={() => onSelectType("telegram")}
            icon={<Bot className="w-3 h-3" />}
          >
            <svg viewBox="26 22 148 106" width="92" height="66" style={{ display: "block" }} aria-hidden="true">
              <circle cx="100" cy="72" r="48" fill="#38bdf8" opacity=".09" />
              <rect x="36" y="38" width="108" height="76" rx="9" fill="#1c1c20" stroke="#2e2e33" />
              <line x1="36" y1="54" x2="144" y2="54" stroke="#2e2e33" />
              <circle cx="47" cy="46" r="2.5" fill="#3a3a40" />
              <circle cx="56" cy="46" r="2.5" fill="#3a3a40" />
              <circle cx="65" cy="46" r="2.5" fill="#3a3a40" />
              <rect x="48" y="62" width="44" height="10" rx="5" fill="#2a2a2f" />
              <rect x="74" y="78" width="58" height="10" rx="5" fill="#38bdf8" />
              <rect x="48" y="94" width="34" height="10" rx="5" fill="#2a2a2f" />
              <circle cx="146" cy="40" r="18" fill="#38bdf8" stroke="#0e0e10" strokeWidth="3" />
              <rect x="139" y="40" width="14" height="11" rx="2.5" fill="#0a0a0b" />
              <path d="M142 40v-3.5a4 4 0 0 1 8 0V40" fill="none" stroke="#0a0a0b" strokeWidth="2" />
            </svg>
          </DeliveryCardMobile>

          {/* ITEM MOBILE 2 */}
          <DeliveryCardMobile
            type="external"
            isSelected={selectedType === "external"}
            onSelect={() => onSelectType("external")}
            icon={<LinkIcon className="w-3 h-3" />}
          >
            <svg viewBox="26 22 148 106" width="92" height="66" style={{ display: "block" }} aria-hidden="true">
              <circle cx="100" cy="72" r="48" fill="#a3e635" opacity=".09" />
              <rect x="32" y="40" width="136" height="74" rx="9" fill="#1c1c20" stroke="#2e2e33" />
              <circle cx="43" cy="50" r="2.5" fill="#3a3a40" />
              <circle cx="52" cy="50" r="2.5" fill="#3a3a40" />
              <circle cx="61" cy="50" r="2.5" fill="#3a3a40" />
              <rect x="46" y="62" width="108" height="16" rx="8" fill="#0e0e10" stroke="#2e2e33" />
              <text x="58" y="74" fontFamily="monospace" fontSize="10" fill="#a3e635">https://...</text>
              <rect x="58" y="88" width="84" height="18" rx="9" fill="#a3e635" />
              <circle cx="160" cy="42" r="16" fill="#a3e635" stroke="#0e0e10" strokeWidth="3" />
              <path d="M155 47l10-10m0 0h-6m6 0v6" fill="none" stroke="#0a0a0b" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </DeliveryCardMobile>

          {/* ITEM MOBILE 3 */}
          <DeliveryCardMobile
            type="product_video"
            isSelected={selectedType === "product_video"}
            onSelect={() => onSelectType("product_video")}
            icon={<Tv className="w-3 h-3" />}
          >
            <svg viewBox="26 22 148 106" width="92" height="66" style={{ display: "block" }} aria-hidden="true">
              <circle cx="100" cy="72" r="48" fill="#c084fc" opacity=".09" />
              <rect x="40" y="48" width="56" height="70" rx="8" fill="#17171a" stroke="#2e2e33" transform="rotate(-9 68 83)" />
              <rect x="104" y="48" width="56" height="70" rx="8" fill="#17171a" stroke="#2e2e33" transform="rotate(9 132 83)" />
              <rect x="64" y="30" width="72" height="92" rx="11" fill="#1c1c20" stroke="#3a3a40" />
              <rect x="72" y="40" width="56" height="42" rx="6" fill="#2a2a2f" />
              <circle cx="100" cy="61" r="14" fill="#c084fc" />
              <polygon points="95,54 95,68 107,61" fill="#0a0a0b" />
              <rect x="72" y="92" width="56" height="5" rx="2.5" fill="#2a2a2f" />
              <rect x="72" y="92" width="34" height="5" rx="2.5" fill="#c084fc" />
            </svg>
          </DeliveryCardMobile>
        </div>

        {/* Rodapé Mobile */}
        <div className="pt-3 mt-1 shrink-0 flex flex-col">
          <button
            type="button"
            onClick={onContinue}
            style={{ backgroundColor: currentConfig.cc }}
            className="w-full h-[50px] rounded-[14px] text-[15px] font-medium text-[#0a0a0b] inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer shadow-lg"
          >
            <span>Continuar</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] text-[#9a9aa2] hover:text-[#f4f4f5] pt-3 pb-1 text-center transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente de Card Desktop
// ---------------------------------------------------------------------------
function DeliveryCardDesktop({
  type,
  isSelected,
  onSelect,
  icon,
  children,
}: {
  type: DeliveryTypeV2;
  isSelected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const config = DELIVERY_TYPE_CONFIG[type];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      role="radio"
      tabIndex={0}
      aria-checked={isSelected}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      style={{
        ["--cc" as any]: config.cc,
        backgroundColor: isSelected ? config.colorMixBg5 : "#0e0e10",
        borderColor: isSelected ? config.cc : "#26262a",
        boxShadow: isSelected ? `0 0 0 1px ${config.cc}` : "none",
      }}
      className={`group relative flex flex-col rounded-[16px] border overflow-hidden cursor-pointer transition-all duration-[180ms] hover:-translate-y-0.5 hover:border-[#3a3a40] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111113]`}
    >
      {/* Radio Top Right */}
      <div
        className="absolute top-3 right-3 z-10 w-[22px] h-[22px] rounded-full flex items-center justify-center transition-all duration-150"
        style={{
          border: isSelected ? `1.5px solid ${config.cc}` : "1.5px solid #3a3a40",
          backgroundColor: isSelected ? config.cc : "transparent",
        }}
      >
        {isSelected && <Check className="w-3.5 h-3.5 text-[#0a0a0b] stroke-[3]" />}
      </div>

      {/* Ilustração SVG */}
      <div className="w-full shrink-0 select-none pointer-events-none">
        {children}
      </div>

      {/* Corpo */}
      <div className="p-4 pt-0.5 flex-1 flex flex-col justify-between">
        <div>
          <div
            className="text-[11px] font-medium tracking-[0.09em] uppercase"
            style={{ color: config.cc }}
          >
            {config.eyebrowDesktop}
          </div>
          <h3 className="text-[17px] font-medium text-[#f4f4f5] my-1 mb-1.5 leading-snug">
            {config.title}
          </h3>
          <p className="text-[13px] text-[#9a9aa2] leading-[1.5] min-h-[60px] m-0">
            {config.descriptionDesktop}
          </p>
        </div>

        {/* Chip */}
        <div
          className="text-[12px] font-medium inline-flex items-center gap-1.5 mt-3 py-[5px] px-[10px] rounded-full self-start"
          style={{
            color: config.cc,
            backgroundColor: config.colorMixBg12,
          }}
        >
          {icon}
          <span>{config.chipText}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente de Card Mobile
// ---------------------------------------------------------------------------
function DeliveryCardMobile({
  type,
  isSelected,
  onSelect,
  icon,
  children,
}: {
  type: DeliveryTypeV2;
  isSelected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const config = DELIVERY_TYPE_CONFIG[type];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      role="radio"
      tabIndex={0}
      aria-checked={isSelected}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      style={{
        ["--cc" as any]: config.cc,
        backgroundColor: isSelected ? config.colorMixBg5 : "#0e0e10",
        borderColor: isSelected ? config.cc : "#26262a",
        boxShadow: isSelected ? `0 0 0 1px ${config.cc}` : "none",
      }}
      className="relative flex items-center gap-3 rounded-[16px] border py-2.5 pr-3 pl-2 min-h-[96px] cursor-pointer transition-all duration-150 active:scale-[0.99] focus:outline-none"
    >
      {/* Radio Top Right */}
      <div
        className="absolute top-2.5 right-2.5 z-10 w-[20px] h-[20px] rounded-full flex items-center justify-center transition-all duration-150"
        style={{
          border: isSelected ? `1.5px solid ${config.cc}` : "1.5px solid #3a3a40",
          backgroundColor: isSelected ? config.cc : "transparent",
        }}
      >
        {isSelected && <Check className="w-3 h-3 text-[#0a0a0b] stroke-[3]" />}
      </div>

      {/* Ilustração à esquerda */}
      <div className="w-[92px] h-[66px] shrink-0 select-none pointer-events-none flex items-center justify-center">
        {children}
      </div>

      {/* Conteúdo textual à direita */}
      <div className="flex-1 min-w-0 pr-4">
        <div
          className="text-[10px] font-medium tracking-[0.09em] uppercase"
          style={{ color: config.cc }}
        >
          {config.eyebrowMobile}
        </div>
        <h3 className="text-[15px] font-medium text-[#f4f4f5] my-0.5 mb-[3px] leading-snug truncate">
          {config.title}
        </h3>
        <p className="text-[12px] text-[#9a9aa2] leading-[1.4] line-clamp-2">
          {config.descriptionMobile}
        </p>

        {/* Chip */}
        <div
          className="text-[11px] font-medium inline-flex items-center gap-1 mt-1.5 py-[3px] px-2 rounded-full self-start"
          style={{
            color: config.cc,
            backgroundColor: config.colorMixBg12,
          }}
        >
          {icon}
          <span>{config.chipText}</span>
        </div>
      </div>
    </div>
  );
}

