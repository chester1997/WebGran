"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  ExternalLink, 
  MessageSquare, 
  MoreVertical, 
  Play, 
  Pause, 
  Edit3, 
  Key, 
  Trash2, 
  Copy, 
  Check, 
  Link2,
  Bookmark
} from "lucide-react";
import BotAvatar from "./BotAvatar";
import BotStatusBadge from "./BotStatusBadge";
import SellerPageHeader from "@/components/layout/SellerPageHeader";

interface BotHeaderProps {
  bot: {
    id: string;
    botId: string;
    username: string;
    displayName: string;
    photoUrl: string | null;
    status: "active" | "paused" | "disconnected";
    storeName?: string;
    createdAt?: string;
  };
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onToggleStatus: () => void;
  onOpenRename: () => void;
  onOpenToken: () => void;
  onOpenDelete: () => void;
}

export default function BotHeader({
  bot,
  activeTab,
  onSelectTab,
  onToggleStatus,
  onOpenRename,
  onOpenToken,
  onOpenDelete,
}: BotHeaderProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://t.me/${bot.username}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const isRunning = bot.status === "active";

  const formattedDate = bot.createdAt
    ? new Date(bot.createdAt).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <SellerPageHeader>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full h-full relative z-30 py-1">
        {/* Bloco da Esquerda: Breadcrumb acima + Identificação do bot (Avatar, Nome, Status, Metadados) */}
        <div className="flex flex-col gap-1 min-w-0">
          {/* Breadcrumb ← Bots discreto e elegante */}
          <Link
            href="/seller/bots"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors w-fit group py-0.5"
            title="Voltar para a lista de bots"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            <span>Bots</span>
          </Link>

          {/* Identificação do Bot: Avatar + Nome + Metadados */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar circular do bot */}
            <BotAvatar
              photoUrl={bot.photoUrl}
              displayName={bot.displayName}
              username={bot.username}
              size="md"
              className="ring-2 ring-white/10 shadow-sm shrink-0 w-11 h-11"
            />

            <div className="min-w-0 space-y-0.5">
              {/* Linha 1: Nome do bot + Badge de Status */}
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white truncate max-w-[180px] sm:max-w-xs md:max-w-md">
                  {bot.displayName}
                </h1>

                <BotStatusBadge status={bot.status} size="sm" />
              </div>

              {/* Linha 2: Metadados (Loja · @username · Conectado em · Link t.me com copiar) */}
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-zinc-400 flex-wrap">
                <span className="inline-flex items-center gap-1 text-zinc-300 font-medium shrink-0">
                  <Bookmark className="w-3 h-3 text-zinc-500" />
                  {bot.storeName || "WebGran"}
                </span>

                <span className="text-zinc-600 shrink-0">•</span>
                <span className="font-mono text-zinc-400 shrink-0">@{bot.username}</span>

                {formattedDate && (
                  <>
                    <span className="text-zinc-600 shrink-0 hidden md:inline">•</span>
                    <span className="text-zinc-500 shrink-0 hidden md:inline">Conectado em {formattedDate}</span>
                  </>
                )}

                <span className="text-zinc-600 shrink-0">•</span>

                {/* Link t.me com botão de copiar */}
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono text-zinc-300 hover:border-white/20 transition-colors">
                  <Link2 className="w-3 h-3 text-[#3984FF] shrink-0" />
                  <span className="truncate max-w-[110px] sm:max-w-[150px]">t.me/{bot.username}</span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="p-0.5 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                    title="Copiar link"
                  >
                    {copiedLink ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* À direita: Conversas, Abrir no Telegram, Menu de ações */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap sm:flex-nowrap self-start lg:self-center">
          {/* Botão Conversas */}
          <button
            type="button"
            onClick={() => onSelectTab("conversas")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium border transition-all cursor-pointer h-9 group ${
              activeTab === "conversas"
                ? "bg-[#3984FF]/15 text-[#3984FF] border-[#3984FF]/40 shadow-xs"
                : "bg-[#18181B] hover:bg-[#202024] text-zinc-200 hover:text-white border-zinc-700/60 hover:border-zinc-500/80"
            }`}
          >
            <MessageSquare className={`w-4 h-4 ${activeTab === "conversas" ? "text-[#3984FF]" : "text-zinc-400 group-hover:text-zinc-200"}`} />
            <span>Conversas</span>
          </button>

          {/* Botão Abrir no Telegram */}
          <a
            href={`https://t.me/${bot.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#18181B] hover:bg-[#202024] text-zinc-200 hover:text-white border border-zinc-700/60 hover:border-zinc-500/80 text-xs sm:text-sm font-medium transition-all h-9 group"
          >
            <ExternalLink className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200" />
            <span>Abrir no Telegram</span>
          </a>

          {/* Menu de 3 Pontos */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer h-9 w-9 flex items-center justify-center shrink-0"
              title="Opções do bot"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />

                <div className="absolute right-0 top-11 z-50 w-52 bg-[#18181D] border border-white/10 rounded-2xl shadow-2xl py-2 text-xs animate-in fade-in-50 zoom-in-95">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleStatus();
                    }}
                    className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-white/5 text-zinc-200 transition-colors"
                  >
                    {isRunning ? (
                      <>
                        <Pause className="w-4 h-4 text-amber-400" />
                        <span>Pausar bot</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 text-emerald-400" />
                        <span>Reativar bot</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenRename();
                    }}
                    className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-white/5 text-zinc-200 transition-colors"
                  >
                    <Edit3 className="w-4 h-4 text-sky-400" />
                    <span>Renomear apelido</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenToken();
                    }}
                    className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-white/5 text-zinc-200 transition-colors"
                  >
                    <Key className="w-4 h-4 text-violet-400" />
                    <span>Atualizar token</span>
                  </button>

                  <div className="h-px bg-white/5 my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenDelete();
                    }}
                    className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-rose-500/10 text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Excluir bot</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </SellerPageHeader>
  );
}
