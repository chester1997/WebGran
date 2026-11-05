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
    <div className="space-y-3">
      {/* 1. Navegação de Retorno: ← Bots (Referência Gerencia VIP) */}
      <div>
        <Link
          href="/seller/bots"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Bots</span>
        </Link>
      </div>

      {/* 2. Hero Card Principal */}
      <div className="bg-[#111215] border border-white/[0.08] rounded-2xl p-5 md:p-6 shadow-xl relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Identidade Principal do Bot */}
          <div className="flex items-start sm:items-center gap-4 min-w-0">
            <BotAvatar
              photoUrl={bot.photoUrl}
              displayName={bot.displayName}
              username={bot.username}
              size="lg"
              className="ring-2 ring-white/10 shadow-lg shrink-0 mt-1 sm:mt-0"
            />

            <div className="min-w-0 space-y-1.5">
              {/* Linha 1: Nome do bot + Status Badge */}
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white truncate">
                  {bot.displayName}
                </h1>

                <BotStatusBadge status={bot.status} size="sm" />
              </div>

              {/* Linha 2: Metadados inline (Loja · @username · Conectado em data) */}
              <div className="flex items-center gap-2 text-xs text-zinc-400 flex-wrap">
                <span className="flex items-center gap-1 text-zinc-300 font-medium">
                  <Bookmark className="w-3 h-3 text-zinc-500" />
                  {bot.storeName || "WebGran"}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="font-mono text-zinc-400">@{bot.username}</span>
                {formattedDate && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-500">Conectado em {formattedDate}</span>
                  </>
                )}
              </div>

              {/* Linha 3: Barra Embutida de Link Público com Botão Copiar (Referência Gerencia VIP) */}
              <div className="flex items-center gap-2 max-w-md bg-[#0D0E12] border border-white/10 rounded-xl px-3 py-1.5 mt-2">
                <Link2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="text-xs text-zinc-300 font-mono truncate flex-1 select-all">
                  t.me/{bot.username}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
                  title="Copiar link direto do Telegram"
                >
                  {copiedLink ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Bloco de Ações Rápidas (Conversas, Abrir no Telegram e Menu) */}
          <div className="flex items-center gap-2.5 flex-wrap self-end lg:self-center">
            {/* Botão Secundário: Conversas */}
            <button
              type="button"
              onClick={() => onSelectTab("conversas")}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                activeTab === "conversas"
                  ? "bg-[#3984FF]/15 text-[#3984FF] border-[#3984FF]/40 shadow-sm"
                  : "bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border-white/10"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
              <span>Conversas</span>
            </button>

            {/* Botão Primário: Abrir no Telegram */}
            <a
              href={`https://t.me/${bot.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/10 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Abrir no Telegram</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            </a>

            {/* Menu de 3 Pontos */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
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

                  <div className="absolute right-0 top-12 z-50 w-52 bg-[#18181D] border border-white/10 rounded-2xl shadow-2xl py-2 text-xs animate-in fade-in-50 zoom-in-95">
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
      </div>
    </div>
  );
}
