"use client";

import { useState } from "react";
import { Bot, Copy, ExternalLink, Info, Trash2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotSettingsModal } from "./BotSettingsModal";
import { deleteBotAction } from "./actions";

export function BotCard({ store, bot }: { store: any; bot: any }) {
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const botUrl = `https://t.me/${bot.username}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(botUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpen = () => {
    window.open(botUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleting(true);
    try {
      await deleteBotAction(bot.id);
    } catch (err: any) {
      alert(err.message || "Erro ao excluir bot.");
      setDeleting(false);
    }
  };

  return (
    <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-xl flex flex-col h-full">
      {/* Card Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/5 bg-[#1A1A1E] relative">
          <img 
            src={`/api/telegram/bot-avatar?botId=${bot.id}`} 
            className="w-full h-full object-cover" 
            alt={bot.displayName || bot.username}
            onError={(e) => {
              // Fallback to store logo or Bot icon if proxy fails
              const target = e.currentTarget;
              if (store.logoUrl && target.src !== store.logoUrl) {
                target.src = store.logoUrl;
              } else {
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.bot-fallback-icon')) {
                  const fallbackDiv = document.createElement('div');
                  fallbackDiv.className = 'w-full h-full bg-[#1A1A1E] flex items-center justify-center bot-fallback-icon';
                  fallbackDiv.innerHTML = `<svg class="w-6 h-6 text-blue-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`;
                  parent.appendChild(fallbackDiv);
                }
              }
            }}
          />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-white text-base uppercase leading-tight truncate">{store.name}</h3>
          <p className="text-zinc-400 text-sm truncate">@{bot.username}</p>
        </div>
      </div>

      {/* Separator */}
      <div className="h-1 bg-blue-600 rounded-full w-full mb-5 shadow-[0_0_10px_rgba(139,92,246,0.3)]"></div>

      {/* Telegram Link Block */}
      <div className="bg-[#1A1A1E] border border-white/5 rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-xs font-medium text-zinc-400">Link do Bot no Telegram</span>
        </div>
        <p className="text-sm font-medium text-white mb-3 truncate">{botUrl}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCopy}
            className="bg-transparent border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 h-9"
          >
            {copied ? <Check className="w-3 h-3 mr-2 text-emerald-400" /> : <Copy className="w-3 h-3 mr-2" />} 
            {copied ? "Copiado!" : "Copiar link"}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleOpen}
            className="bg-transparent border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 h-9"
          >
            <ExternalLink className="w-3 h-3 mr-2" /> Abrir no Telegram
          </Button>
        </div>
      </div>

      {/* Actions Footer */}
      <div className="flex items-center gap-2 mt-auto">
        <BotSettingsModal 
          store={store} 
          bot={bot} 
          triggerText="Editar" 
          className="flex-1 bg-transparent border border-white/10 hover:bg-white/5 text-white"
        />
        <Button 
          variant="destructive" 
          size="icon" 
          onClick={handleDelete}
          disabled={deleting}
          title={confirmDelete ? "Clique novamente para confirmar" : "Excluir bot"}
          className={`shrink-0 border-transparent h-9 w-9 transition-all ${
            confirmDelete 
              ? "bg-orange-500 hover:bg-orange-600 animate-pulse" 
              : "bg-red-500 hover:bg-red-600"
          }`}
        >
          {confirmDelete ? <AlertTriangle className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
        </Button>
      </div>

      {confirmDelete && (
        <p className="text-orange-400 text-xs text-center mt-2 font-medium animate-pulse">
          Clique novamente para confirmar exclusão
        </p>
      )}
    </div>
  );
}
