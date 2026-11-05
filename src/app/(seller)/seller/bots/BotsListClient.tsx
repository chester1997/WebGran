"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Bot, 
  Plus, 
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
  Sparkles,
  ShieldCheck,
  Smartphone,
  ChevronRight,
  Layers
} from "lucide-react";
import SellerPageHeader from "@/components/layout/SellerPageHeader";
import { 
  toggleBotStatusAction, 
  renameBotAction, 
  updateBotTokenAction, 
  deleteBotAction 
} from "./actions";

export interface BotItem {
  id: string;
  botId: string;
  username: string;
  displayName: string;
  photoUrl: string | null;
  buttonText: string;
  status: "active" | "paused" | "disconnected";
  createdAt: string;
  mode: "MINI_APP";
  recipientsCount: number;
  chatsCount: number;
  storeSlug: string;
}

interface BotsListClientProps {
  bots: BotItem[];
  storeSlug: string;
}

export default function BotsListClient({ bots: initialBots, storeSlug }: BotsListClientProps) {
  const router = useRouter();
  const [bots, setBots] = useState<BotItem[]>(initialBots);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Estados de Modais
  const [renameModalBot, setRenameModalBot] = useState<BotItem | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [tokenModalBot, setTokenModalBot] = useState<BotItem | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [deleteModalBot, setDeleteModalBot] = useState<BotItem | null>(null);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleCopyLink = (username: string, botId: string) => {
    const link = `https://t.me/${username}`;
    navigator.clipboard.writeText(link);
    setCopiedId(botId);
    showNotification("success", "Link do bot copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Alternar Status (Pausar / Reativar)
  const handleToggleStatus = async (bot: BotItem) => {
    const nextStatus = bot.status === "active" ? "paused" : "active";
    setLoadingAction(bot.id);
    setActiveMenuId(null);
    try {
      const res = await toggleBotStatusAction(bot.id, nextStatus);
      if (res.success) {
        setBots((prev) =>
          prev.map((b) => (b.id === bot.id ? { ...b, status: nextStatus } : b))
        );
        showNotification("success", res.message || "Status alterado com sucesso.");
      } else {
        showNotification("error", res.error || "Erro ao alterar status.");
      }
    } catch {
      showNotification("error", "Falha de comunicação.");
    } finally {
      setLoadingAction(null);
    }
  };

  // Renomear
  const handleSaveRename = async () => {
    if (!renameModalBot) return;
    setLoadingAction(renameModalBot.id);
    try {
      const res = await renameBotAction(renameModalBot.id, renameInput);
      if (res.success) {
        setBots((prev) =>
          prev.map((b) => (b.id === renameModalBot.id ? { ...b, displayName: renameInput.trim() } : b))
        );
        showNotification("success", "Apelido atualizado com sucesso!");
        setRenameModalBot(null);
      } else {
        showNotification("error", res.error || "Erro ao renomear.");
      }
    } catch {
      showNotification("error", "Erro ao renomear bot.");
    } finally {
      setLoadingAction(null);
    }
  };

  // Atualizar Token
  const handleSaveToken = async () => {
    if (!tokenModalBot) return;
    setLoadingAction(tokenModalBot.id);
    try {
      const res = await updateBotTokenAction(tokenModalBot.id, tokenInput);
      if (res.success) {
        showNotification("success", "Token atualizado e validado!");
        setTokenModalBot(null);
        setTokenInput("");
      } else {
        showNotification("error", res.error || "Token inválido.");
      }
    } catch {
      showNotification("error", "Erro ao atualizar token.");
    } finally {
      setLoadingAction(null);
    }
  };

  // Excluir
  const handleConfirmDelete = async () => {
    if (!deleteModalBot) return;
    setLoadingAction(deleteModalBot.id);
    try {
      const res = await deleteBotAction(deleteModalBot.id);
      if (res.success) {
        setBots((prev) => prev.filter((b) => b.id !== deleteModalBot.id));
        showNotification("success", res.message || "Bot excluído.");
        setDeleteModalBot(null);
      } else {
        showNotification("error", res.error || "Erro ao excluir.");
      }
    } catch {
      showNotification("error", "Erro ao excluir bot.");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6 fade-in w-full pb-16">
      {/* Notificação Flutuante */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl border shadow-xl text-sm font-medium transition-all animate-in slide-in-from-top-2 ${
            notification.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/90 border-rose-500/30 text-rose-300"
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Header Padronizado */}
      <SellerPageHeader
        title="Bots"
        badge={
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25">
            {bots.length} {bots.length === 1 ? "bot conectado" : "bots conectados"}
          </span>
        }
        subtitle="Gerencie seus bots do Telegram, acompanhe o status de conexão, métricas de vendas e configure os modos de funcionamento."
        actions={
          <Link
            href="/seller/bots/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3984FF] hover:bg-[#2563EB] text-white text-xs font-bold transition-all shadow-lg shadow-[#3984FF]/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Bot</span>
          </Link>
        }
      />

      {/* Listagem de Bots */}
      {bots.length === 0 ? (
        <div className="bg-[#121215] border border-white/5 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#3984FF]/10 border border-[#3984FF]/20 flex items-center justify-center mx-auto text-[#3984FF]">
            <Bot className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">Nenhum bot cadastrado</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Conecte seu primeiro bot do Telegram em menos de 2 minutos para começar a vender com a loja integrada ao Mini App da WebGran.
          </p>
          <div className="pt-2">
            <Link
              href="/seller/bots/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3984FF] hover:bg-[#2563EB] text-white text-xs font-bold transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Conectar meu primeiro bot</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {bots.map((bot) => {
            const isRunning = bot.status === "active";
            const isPaused = bot.status === "paused";
            const initial = (bot.displayName || bot.username || "B").charAt(0).toUpperCase();

            return (
              <div
                key={bot.id}
                className="bg-[#121215] hover:bg-[#15151A] border border-white/[0.08] hover:border-[#3984FF]/30 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between shadow-lg relative group"
              >
                {/* Linha Superior: Avatar, Identidade e Menu */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {bot.photoUrl ? (
                        <img
                          src={bot.photoUrl}
                          alt={bot.displayName}
                          className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0 shadow-md"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-white/10 flex items-center justify-center shrink-0 font-bold text-base text-[#3984FF] shadow-md">
                          {initial}
                        </div>
                      )}

                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate tracking-tight">
                          {bot.displayName}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-zinc-400 font-mono truncate">
                            @{bot.username}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyLink(bot.username, bot.id)}
                            className="text-zinc-500 hover:text-white transition-colors"
                            title="Copiar link do bot"
                          >
                            {copiedId === bot.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Menu de Ações Retrátil */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(activeMenuId === bot.id ? null : bot.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                        title="Opções do bot"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuId === bot.id && (
                        <div className="absolute right-0 top-8 z-40 w-48 bg-[#18181C] border border-white/10 rounded-xl shadow-2xl py-1.5 text-xs animate-in fade-in-50">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(bot)}
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
                            onClick={() => {
                              setActiveMenuId(null);
                              setRenameModalBot(bot);
                              setRenameInput(bot.displayName);
                            }}
                            className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-white/5 text-zinc-200 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                            <span>Renomear apelido</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              setTokenModalBot(bot);
                              setTokenInput("");
                            }}
                            className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-white/5 text-zinc-200 transition-colors"
                          >
                            <Key className="w-3.5 h-3.5 text-violet-400" />
                            <span>Atualizar token</span>
                          </button>

                          <div className="h-px bg-white/5 my-1" />

                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              setDeleteModalBot(bot);
                            }}
                            className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-rose-500/10 text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir bot</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Badges de Modo e Status */}
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    {/* Modo MINI_APP */}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25 tracking-wider uppercase">
                      <Smartphone className="w-3 h-3" />
                      MINI APP
                    </span>

                    {/* Status Rodando / Pausado */}
                    {isRunning ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tracking-wider uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        RODANDO
                      </span>
                    ) : isPaused ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 tracking-wider uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        PAUSADO
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 tracking-wider uppercase">
                        DESCONECTADO
                      </span>
                    )}

                    <span className="text-[11px] text-zinc-500 ml-auto font-medium">
                      Conectado em {new Date(bot.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>

                {/* Linha Inferior: Botões de Ação */}
                <div className="pt-3 border-t border-white/[0.06] flex items-center gap-2">
                  <a
                    href={`https://t.me/${bot.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/[0.08] transition-all"
                  >
                    <span>Abrir no Telegram</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  </a>

                  <Link
                    href={`/seller/bots/${bot.id}?tab=conversas`}
                    className="py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/[0.08] transition-all"
                    title="Ver conversas com clientes"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                    <span>Conversas</span>
                  </Link>

                  <Link
                    href={`/seller/bots/${bot.id}`}
                    className="p-2 rounded-xl bg-[#3984FF]/10 hover:bg-[#3984FF]/20 text-[#3984FF] border border-[#3984FF]/25 transition-all"
                    title="Acessar gerenciamento do bot"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Renomear Apelido */}
      {renameModalBot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16161A] border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-bold text-white">Renomear apelido do bot</h3>
            <p className="text-xs text-zinc-400">
              Altere o nome de exibição de <span className="text-white font-mono">@{renameModalBot.username}</span> na sua área interna do WebGran.
            </p>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder="Novo apelido"
              className="w-full bg-[#1F1F24] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#3984FF]"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenameModalBot(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveRename}
                disabled={loadingAction === renameModalBot.id}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#3984FF] hover:bg-[#2563EB] text-white transition-colors disabled:opacity-50"
              >
                Salvar apelido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Atualizar Token */}
      {tokenModalBot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16161A] border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-bold text-white">Atualizar token do bot</h3>
            <p className="text-xs text-zinc-400">
              Cole o novo token gerado no BotFather para <span className="text-white font-mono">@{tokenModalBot.username}</span>. O token será criptografado e validado imediatamente no Telegram.
            </p>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="123456789:ABCDefG..."
              className="w-full bg-[#1F1F24] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-[#3984FF]"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setTokenModalBot(null);
                  setTokenInput("");
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveToken}
                disabled={loadingAction === tokenModalBot.id || !tokenInput}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#3984FF] hover:bg-[#2563EB] text-white transition-colors disabled:opacity-50"
              >
                Validar e Atualizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Excluir Bot */}
      {deleteModalBot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16161A] border border-rose-500/20 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Excluir bot @{deleteModalBot.username}?
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Esta ação removerá a integração deste bot na WebGran e desativará os webhooks vinculados. Os produtos associados a ele passarão a utilizar o bot padrão da loja.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalBot(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={loadingAction === deleteModalBot.id}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

