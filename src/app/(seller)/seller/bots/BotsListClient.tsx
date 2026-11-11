"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Bot, 
  Plus, 
  Sparkles,
  Smartphone,
  HelpCircle
} from "lucide-react";
import SellerPageHeader from "@/components/layout/SellerPageHeader";
import BotCard, { BotCardData } from "./components/BotCard";
import NewBotModal from "./components/NewBotModal";
import { 
  toggleBotStatusAction, 
  renameBotAction, 
  updateBotTokenAction, 
  deleteBotAction 
} from "./actions";

export type BotItem = BotCardData;

interface BotsListClientProps {
  bots: BotItem[];
  storeSlug: string;
}

export default function BotsListClient({ bots: initialBots, storeSlug }: BotsListClientProps) {
  const router = useRouter();
  const [bots, setBots] = useState<BotItem[]>(initialBots);

  // Sincronização estrita com os dados recebidos do servidor ao revalidar
  useEffect(() => {
    setBots(initialBots);
  }, [initialBots]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isNewBotModalOpen, setIsNewBotModalOpen] = useState(false);

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

  // Navegar para o bot ao clicar no card
  const handleSelectBot = (botId: string) => {
    router.push(`/seller/bots/${botId}`);
  };

  // Alternar Status (Pausar / Reativar)
  const handleToggleStatus = async (bot: BotItem) => {
    const nextStatus = bot.status === "active" ? "paused" : "active";
    setLoadingAction(bot.id);
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
          <button
            type="button"
            onClick={() => setIsNewBotModalOpen(true)}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#3984FF] hover:bg-[#2F73E6] border border-[#3984FF]/30 text-white text-xs font-semibold transition-all shadow-sm shadow-[#3984FF]/25 active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Bot</span>
          </button>
        }
      />

      {/* Banner Explicativo - Referência Gerencia VIP */}
      <div className="bg-[#111215] border border-white/[0.08] rounded-2xl p-4 md:p-5 flex items-start gap-4 shadow-sm">
        <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-400 shrink-0 mt-0.5">
          <HelpCircle className="w-4 h-4 text-zinc-300" />
        </div>
        <div className="space-y-0.5 min-w-0">
          <h4 className="text-xs md:text-sm font-bold text-white">Para que serve um bot?</h4>
          <p className="text-xs text-zinc-400 leading-relaxed">
            É por ele que o comprador compra e recebe o que comprou, dentro do Telegram. Um bot pode atender vários produtos.
          </p>
        </div>
      </div>

      {/* Listagem de Bots */}
      {bots.length === 0 ? (
        <div className="bg-[#111215] border border-white/5 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#3984FF]/10 border border-[#3984FF]/20 flex items-center justify-center mx-auto text-[#3984FF]">
            <Bot className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">Nenhum bot cadastrado</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Conecte seu primeiro bot do Telegram em menos de 2 minutos para começar a vender com a loja integrada ao Mini App da WebGran.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsNewBotModalOpen(true)}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#3984FF] hover:bg-[#2F73E6] border border-[#3984FF]/30 text-white text-xs font-semibold transition-all shadow-sm shadow-[#3984FF]/25 active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Conectar meu primeiro bot</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {bots.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              onSelect={handleSelectBot}
              onToggleStatus={handleToggleStatus}
              onOpenRename={(b) => {
                setRenameModalBot(b);
                setRenameInput(b.displayName);
              }}
              onOpenToken={(b) => {
                setTokenModalBot(b);
                setTokenInput("");
              }}
              onOpenDelete={(b) => setDeleteModalBot(b)}
            />
          ))}
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
                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-[#1C1C1C] hover:bg-[#262626] border border-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveRename}
                disabled={loadingAction === renameModalBot.id}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#3984FF] hover:bg-[#2F73E6] border border-[#3984FF]/30 text-white transition-colors disabled:opacity-50"
              >
                Salvar
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
              Insira o novo token gerado no @BotFather para o bot <span className="text-white font-mono">@{tokenModalBot.username}</span>.
            </p>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="123456789:ABCDefG..."
              className="w-full bg-[#1F1F24] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-[#3984FF]"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTokenModalBot(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-[#1C1C1C] hover:bg-[#262626] border border-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveToken}
                disabled={loadingAction === tokenModalBot.id || !tokenInput}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#3984FF] hover:bg-[#2F73E6] border border-[#3984FF]/30 text-white transition-colors disabled:opacity-50"
              >
                Validar e Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Excluir Bot */}
      {deleteModalBot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16161A] border border-rose-500/20 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-bold text-rose-400">
              Excluir bot @{deleteModalBot.username}?
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Esta ação removerá a integração deste bot na WebGran. As mensagens, configurações e canais vinculados não serão mais gerenciados por este painel.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalBot(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-[#1C1C1C] hover:bg-[#262626] border border-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={loadingAction === deleteModalBot.id}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Bot (Onboarding / Conexão em 3 passos) */}
      <NewBotModal
        isOpen={isNewBotModalOpen}
        onClose={() => setIsNewBotModalOpen(false)}
        onBotCreated={(botId, newBot) => {
          setIsNewBotModalOpen(false);
          if (newBot) {
            setBots((prev) => [newBot, ...prev.filter((b) => b.id !== newBot.id)]);
          }
          router.refresh();
          router.push(`/seller/bots/${botId}`);
        }}
      />
    </div>
  );
}
