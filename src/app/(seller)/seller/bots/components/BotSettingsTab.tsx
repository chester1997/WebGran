"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Key, 
  Edit3, 
  Copy, 
  Check, 
  ShieldCheck, 
  Webhook, 
  Smartphone, 
  AlertTriangle, 
  Pause, 
  Play, 
  Trash2, 
  Store, 
  ExternalLink,
  Lock,
  Radio,
  FileCode2
} from "lucide-react";

interface BotSettingsTabProps {
  bot: {
    id: string;
    botId: string;
    username: string;
    displayName: string;
    buttonText: string;
    status: "active" | "paused" | "disconnected";
    storeSlug: string;
    storeName: string;
    chatsCount: number;
    recipientsCount: number;
  };
  onOpenRename: () => void;
  onOpenToken: () => void;
  onToggleStatus: () => void;
  onOpenDelete: () => void;
  showNotification: (type: "success" | "error", message: string) => void;
}

export default function BotSettingsTab({
  bot,
  onOpenRename,
  onOpenToken,
  onToggleStatus,
  onOpenDelete,
  showNotification,
}: BotSettingsTabProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const isRunning = bot.status === "active";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://t.me/${bot.username}`);
    setCopiedLink(true);
    showNotification("success", "Link do bot copiado!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyWebhook = () => {
    const webhookUrl = "https://www.webgran.online/api/telegram/webhook";
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    showNotification("success", "Endpoint do webhook copiado!");
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ========================================================= */}
      {/* 1. IDENTIDADE E CONEXÃO                                   */}
      {/* ========================================================= */}
      <div className="bg-[#111215] border border-white/[0.08] rounded-2xl p-6 shadow-md space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-[#3984FF] flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Identidade & Conexão</h3>
              <p className="text-xs text-zinc-400">Credenciais oficiais e identificação no Telegram</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Apelido de exibição */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-zinc-500 block">Nome de Exibição</span>
              <span className="text-sm font-bold text-white truncate block">{bot.displayName}</span>
            </div>
            <button
              type="button"
              onClick={onOpenRename}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-zinc-300 hover:text-white border border-white/10 transition-colors shrink-0 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-sky-400" />
              <span>Renomear</span>
            </button>
          </div>

          {/* Nome de Usuário */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-zinc-500 block">Username no Telegram</span>
              <span className="text-sm font-mono font-bold text-white truncate block">@{bot.username}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-zinc-300 hover:text-white border border-white/10 transition-colors shrink-0 cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? "Copiado!" : "Copiar"}</span>
            </button>
          </div>

          {/* Telegram Bot ID */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <span className="text-[11px] font-medium text-zinc-500 block">Telegram Bot ID</span>
            <span className="text-xs font-mono text-zinc-300">{bot.botId}</span>
          </div>

          {/* Token Criptografado */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <span className="text-[11px] font-medium text-zinc-500 block">Token de API (BotFather)</span>
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-xs font-mono text-zinc-400">••••••••••••••••••••••••••••••••</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenToken}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-zinc-300 hover:text-white border border-white/10 transition-colors shrink-0 cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-violet-400" />
              <span>Atualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. INTEGRAÇÃO WEBHOOK                                     */}
      {/* ========================================================= */}
      <div className="bg-[#111215] border border-white/[0.08] rounded-2xl p-6 shadow-md space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Webhook className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Integração Webhook</h3>
              <p className="text-xs text-zinc-400">Comunicação bidirecional segura com os servidores do Telegram</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            OPERACIONAL
          </span>
        </div>

        <div className="space-y-4">
          {/* Endpoint registrado */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0 space-y-1">
              <span className="text-[11px] font-medium text-zinc-500 block">URL de Notificação Registrada</span>
              <span className="text-xs font-mono text-zinc-200 break-all select-all">
                https://www.webgran.online/api/telegram/webhook
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyWebhook}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-zinc-300 hover:text-white border border-white/10 transition-colors shrink-0 cursor-pointer"
            >
              {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedWebhook ? "Copiado!" : "Copiar URL"}</span>
            </button>
          </div>

          {/* Especificações técnicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
              <span className="text-[11px] font-medium text-zinc-500 block">Eventos Monitorados</span>
              <p className="text-xs font-mono text-zinc-300 leading-relaxed">
                message, callback_query, my_chat_member, chat_member
              </p>
              <p className="text-[10px] text-zinc-500">Permite atendimento de mensagens e entrega em canais.</p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
              <span className="text-[11px] font-medium text-zinc-500 block">Autenticação do Webhook</span>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs text-zinc-300 font-semibold">X-Telegram-Bot-Api-Secret-Token Ativo</span>
              </div>
              <p className="text-[10px] text-zinc-500">Proteção criptográfica contra requisições forjadas.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. FUNCIONAMENTO & MINI APP                               */}
      {/* ========================================================= */}
      <div className="bg-[#111215] border border-white/[0.08] rounded-2xl p-6 shadow-md space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Funcionamento & Mini App</h3>
              <p className="text-xs text-zinc-400">Comportamento do catálogo e integrações com o Telegram</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <span className="text-[11px] font-medium text-zinc-500 block">Modo Operacional</span>
            <span className="text-xs font-bold text-white block">MINI APP Integrado</span>
            <p className="text-[10px] text-zinc-500">Abre a vitrine nativa direto no Telegram.</p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <span className="text-[11px] font-medium text-zinc-500 block">Texto do Menu Button</span>
            <span className="text-xs font-bold text-white block">{bot.buttonText || "Abrir App"}</span>
            <p className="text-[10px] text-zinc-500">Botão principal na barra de digitação do Telegram.</p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <span className="text-[11px] font-medium text-zinc-500 block">Loja Conectada</span>
            <span className="text-xs font-bold text-[#3984FF] block truncate">{bot.storeName}</span>
            <p className="text-[10px] text-zinc-500">Slug: {bot.storeSlug}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-zinc-400">
            Deseja alterar o suporte ou configurações comerciais da loja?
          </span>
          <Link
            href="/seller/store"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3984FF] hover:underline"
          >
            <span>Ir para Configurações da Loja</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. SEGURANÇA & OPERAÇÃO                                   */}
      {/* ========================================================= */}
      <div className="bg-[#111215] border border-white/[0.08] rounded-2xl p-6 shadow-md space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Segurança & Operação</h3>
              <p className="text-xs text-zinc-400">Controles de ativação e zona de perigo</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Pausar / Reativar */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h4 className="text-xs font-bold text-white">Estado de Funcionamento</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {isRunning
                  ? "O bot está respondendo normalmente no Telegram. Você pode pausá-lo temporariamente se desejar."
                  : "O bot está pausado. Ele não responderá mensagens nem entregará produtos enquanto estiver pausado."}
              </p>
            </div>

            <button
              type="button"
              onClick={onToggleStatus}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isRunning
                  ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25"
                  : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25"
              }`}
            >
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isRunning ? "Pausar Bot" : "Reativar Bot"}</span>
            </button>
          </div>

          {/* Zona de Perigo */}
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/20 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h4 className="text-xs font-bold text-rose-300">Excluir Integração do Bot</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Remove a conexão deste bot com o WebGran. Os produtos e assinaturas cadastrados na loja continuam existindo.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenDelete}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir Bot</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

