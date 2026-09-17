"use client";

import { useState } from "react";
import { Bot, Copy, ExternalLink, Info, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotSettingsModal } from "./BotSettingsModal";

export function BotCard({ store, bot }: { store: any; bot: any }) {
  const [copied, setCopied] = useState(false);

  const botUrl = `https://t.me/${bot.username}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(botUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpen = () => {
    window.open(botUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-xl flex flex-col h-full">
      {/* Card Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-[#1A1A1E] overflow-hidden shrink-0 border border-white/5 flex items-center justify-center">
          {store.logoUrl ? (
            <img src={store.logoUrl} className="w-full h-full object-cover" alt="Logo" />
          ) : (
            <Bot className="w-6 h-6 text-blue-400" />
          )}
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
        <Button variant="outline" size="icon" className="shrink-0 bg-transparent border-white/10 text-zinc-400 hover:text-white h-9 w-9">
          <Info className="w-4 h-4" />
        </Button>
        <Button variant="destructive" size="icon" className="shrink-0 bg-red-500 hover:bg-red-600 text-white border-transparent h-9 w-9">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
