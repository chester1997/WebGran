"use client";

import React, { useState } from "react";
import { 
  ExternalLink, 
  MoreVertical, 
  Play, 
  Pause, 
  Edit3, 
  Key, 
  Trash2, 
  Copy, 
  Check, 
  Smartphone,
  Bookmark,
  Link2
} from "lucide-react";
import BotAvatar from "./BotAvatar";

export interface BotCardData {
  id: string;
  botId: string;
  username: string;
  displayName: string;
  photoUrl: string | null;
  buttonText: string;
  status: "active" | "paused" | "disconnected";
  createdAt: string;
  mode: "PADRAO" | "MINI_APP";
  recipientsCount: number;
  chatsCount: number;
  storeSlug: string;
  storeName?: string;
}

interface BotCardProps {
  bot: BotCardData;
  onSelect: (botId: string) => void;
  onToggleStatus: (bot: BotCardData) => void;
  onOpenRename: (bot: BotCardData) => void;
  onOpenToken: (bot: BotCardData) => void;
  onOpenDelete: (bot: BotCardData) => void;
}

export default function BotCard({
  bot,
  onSelect,
  onToggleStatus,
  onOpenRename,
  onOpenToken,
  onOpenDelete,
}: BotCardProps) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = `https://t.me/${bot.username}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isRunning = bot.status === "active";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(bot.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(bot.id);
        }
      }}
      className="group relative w-full bg-[#111215] hover:bg-[#14151A] border border-white/[0.08] hover:border-[#3984FF]/40 rounded-2xl p-6 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl hover:shadow-[#3984FF]/5 flex flex-col justify-between gap-5 select-none min-h-[168px]"
    >
      {/* Linha Superior: Avatar, Identidade (Status + Nome + @user) e Ações Rápidas */}
      <div className="flex items-start justify-between gap-3.5">
        <div className="flex items-center gap-4 min-w-0">
          <BotAvatar
            photoUrl={bot.photoUrl}
            botId={bot.id}
            displayName={bot.displayName}
            username={bot.username}
            size="card"
            className="ring-2 ring-white/10 group-hover:ring-[#3984FF]/30 transition-all shrink-0"
          />

          <div className="min-w-0 space-y-1">
            {/* Status em caixa alta discreto com indicador luminoso */}
            <div className="flex items-center gap-1.5">
              {bot.status === "active" && (
                <span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  RODANDO
                </span>
              )}
              {bot.status === "paused" && (
                <span className="text-[10px] font-bold text-amber-400 tracking-wider uppercase inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  PAUSADO
                </span>
              )}
              {bot.status === "disconnected" && (
                <span className="text-[10px] font-bold text-rose-400 tracking-wider uppercase inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  DESCONECTADO
                </span>
              )}
            </div>

            {/* Nome do bot */}
            <h3 className="text-[15px] font-bold text-white group-hover:text-[#3984FF] transition-colors truncate tracking-tight">
              {bot.displayName}
            </h3>

            {/* Username do bot */}
            <p className="text-xs text-zinc-400 font-mono truncate">
              @{bot.username}
            </p>
          </div>
        </div>

        {/* Ações Rápidas no Canto Superior Direito (Copiar link, Abrir no Telegram e Menu) */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Copiar Link */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Copiar link do bot"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
          </button>

          {/* Abrir no Telegram */}
          <a
            href={`https://t.me/${bot.username}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Abrir no Telegram"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* Menu de Ações Retrátil */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Mais opções"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <>
                {/* Backdrop invisível para fechar menu ao clicar fora */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                  }}
                />

                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-8 z-50 w-48 bg-[#18181D] border border-white/10 rounded-xl shadow-2xl py-1 text-xs animate-in fade-in-50 zoom-in-95"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onToggleStatus(bot);
                    }}
                    className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-white/5 text-zinc-200 transition-colors"
                  >
                    {isRunning ? (
                      <>
                        <Pause className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pausar bot</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Reativar bot</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onOpenRename(bot);
                    }}
                    className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-white/5 text-zinc-200 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                    <span>Renomear apelido</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onOpenToken(bot);
                    }}
                    className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-white/5 text-zinc-200 transition-colors"
                  >
                    <Key className="w-3.5 h-3.5 text-violet-400" />
                    <span>Atualizar token</span>
                  </button>

                  <div className="h-px bg-white/5 my-1" />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onOpenDelete(bot);
                    }}
                    className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-rose-500/10 text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir bot</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Linha Inferior: Loja Vinculada (Tag Bookmark) e Badge Mini App */}
      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-zinc-400 font-medium min-w-0">
          <Bookmark className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span className="truncate">{bot.storeName || bot.storeSlug}</span>
        </div>

        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25 tracking-wider uppercase shrink-0">
          <Smartphone className="w-3 h-3" />
          {bot.mode === "PADRAO" ? "Venda na conversa" : "Mini App"}
        </span>
      </div>
    </div>
  );
}
