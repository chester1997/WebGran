"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  toggleBotStatusAction,
  renameBotAction,
  updateBotTokenAction,
  deleteBotAction
} from "../actions";

import BotHeader from "../components/BotHeader";
import BotTabsNav from "../components/BotTabsNav";
import BotOverviewTab from "../components/BotOverviewTab";
import BotConversationsTab, { CustomerItem, MessageItem } from "../components/BotConversationsTab";
import BotSettingsTab from "../components/BotSettingsTab";

interface SingleBotClientProps {
  bot: {
    id: string;
    botId: string;
    username: string;
    displayName: string;
    photoUrl: string | null;
    buttonText: string;
    status: "active" | "paused" | "disconnected";
    createdAt: string;
    mode: "MINI_APP";
    storeSlug: string;
    storeName: string;
    chatsCount: number;
    recipientsCount: number;
  };
  storeSlug: string;
  initialTab: string;
  initialOrders: {
    id: string;
    status: string;
    totalAmount: number;
    createdAt: string;
    customerTelegramId: string | null;
  }[];
  initialCustomers: CustomerItem[];
  initialMessages?: MessageItem[];
  isAdmin: boolean;
}

export default function SingleBotClient({
  bot: initialBot,
  storeSlug,
  initialTab,
  initialOrders,
  initialCustomers,
  initialMessages = [],
  isAdmin,
}: SingleBotClientProps) {
  const router = useRouter();
  const [bot, setBot] = useState(initialBot);
  const [activeTab, setActiveTab] = useState(initialTab || "visao-geral");
  const [selectedPeriod, setSelectedPeriod] = useState<"today" | "week" | "month" | "year">("month");
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Estados de Modais
  const [renameModal, setRenameModal] = useState(false);
  const [renameInput, setRenameInput] = useState(bot.displayName);
  const [tokenModal, setTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [deleteModal, setDeleteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Alternar Status (Pausar / Reativar)
  const handleToggleStatus = async () => {
    const nextStatus = bot.status === "active" ? "paused" : "active";
    setActionLoading(true);
    try {
      const res = await toggleBotStatusAction(bot.id, nextStatus);
      if (res.success) {
        setBot((prev) => ({ ...prev, status: nextStatus }));
        showNotification("success", res.message || "Status alterado com sucesso.");
      } else {
        showNotification("error", res.error || "Erro ao alterar status.");
      }
    } catch {
      showNotification("error", "Erro ao comunicar com o servidor.");
    } finally {
      setActionLoading(false);
    }
  };

  // Renomear
  const handleRename = async () => {
    if (!renameInput.trim()) return;
    setActionLoading(true);
    try {
      const res = await renameBotAction(bot.id, renameInput);
      if (res.success) {
        setBot((prev) => ({ ...prev, displayName: renameInput.trim() }));
        showNotification("success", "Apelido atualizado com sucesso!");
        setRenameModal(false);
      } else {
        showNotification("error", res.error || "Erro ao renomear.");
      }
    } catch {
      showNotification("error", "Erro ao salvar.");
    } finally {
      setActionLoading(false);
    }
  };

  // Atualizar Token
  const handleUpdateToken = async () => {
    if (!tokenInput.trim()) return;
    setActionLoading(true);
    try {
      const res = await updateBotTokenAction(bot.id, tokenInput);
      if (res.success) {
        showNotification("success", "Token atualizado e validado!");
        setTokenModal(false);
        setTokenInput("");
      } else {
        showNotification("error", res.error || "Token inválido.");
      }
    } catch {
      showNotification("error", "Erro ao atualizar token.");
    } finally {
      setActionLoading(false);
    }
  };

  // Excluir
  const handleDelete = async () => {
    setActionLoading(true);
    try {
      const res = await deleteBotAction(bot.id);
      if (res.success) {
        router.push("/seller/bots");
      } else {
        showNotification("error", res.error || "Erro ao excluir.");
        setActionLoading(false);
      }
    } catch {
      showNotification("error", "Erro ao excluir.");
      setActionLoading(false);
    }
  };

  // Cálculo de Métricas por período
  const metrics = useMemo(() => {
    const now = new Date();
    const startDate = new Date();
    if (selectedPeriod === "today") startDate.setHours(0, 0, 0, 0);
    else if (selectedPeriod === "week") startDate.setDate(now.getDate() - 7);
    else if (selectedPeriod === "month") startDate.setMonth(now.getMonth() - 1);
    else if (selectedPeriod === "year") startDate.setFullYear(now.getFullYear() - 1);

    const filtered = initialOrders.filter((o) => new Date(o.createdAt) >= startDate);
    const paid = filtered.filter((o) => o.status === "paid");
    const approvedRevenue = paid.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = filtered.length;
    const conversionRate = totalOrders > 0 ? (paid.length / totalOrders) * 100 : 0;
    const clicksCount = Math.round(totalOrders * 2.4) + paid.length;
    const conversationsCount = Math.max(initialCustomers.length, totalOrders);

    return {
      approvedRevenue,
      totalOrders,
      paidCount: paid.length,
      conversionRate,
      clicksCount,
      conversationsCount,
    };
  }, [selectedPeriod, initialOrders, initialCustomers]);

  return (
    <div className="space-y-6 fade-in w-full pb-16">
      {/* Notificação Flutuante */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl border shadow-xl text-sm font-medium transition-all animate-in slide-in-from-top-2 ${notification.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/90 border-rose-500/30 text-rose-300"
            }`}
        >
          {notification.message}
        </div>
      )}

      {/* 1. CABEÇALHO UNIFICADO */}
      <BotHeader
        bot={bot}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onToggleStatus={handleToggleStatus}
        onOpenRename={() => {
          setRenameInput(bot.displayName);
          setRenameModal(true);
        }}
        onOpenToken={() => {
          setTokenInput("");
          setTokenModal(true);
        }}
        onOpenDelete={() => setDeleteModal(true)}
      />

      {/* 2. NAVEGAÇÃO HORIZONTAL DE ABAS */}
      <BotTabsNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isAdmin={isAdmin}
      />

      {/* 3. CONTEÚDO DAS ABAS */}
      {activeTab === "visao-geral" && (
        <BotOverviewTab
          bot={bot}
          metrics={metrics}
          selectedPeriod={selectedPeriod}
          onSelectPeriod={setSelectedPeriod}
          onOpenConversas={() => setActiveTab("conversas")}
        />
      )}

      {activeTab === "conversas" && (
        <BotConversationsTab
          botId={bot.id}
          botUsername={bot.username}
          initialCustomers={initialCustomers}
          initialMessages={initialMessages}
          showNotification={showNotification}
        />
      )}

      {activeTab === "configuracao" && (
        <BotSettingsTab
          bot={bot}
          onOpenRename={() => {
            setRenameInput(bot.displayName);
            setRenameModal(true);
          }}
          onOpenToken={() => {
            setTokenInput("");
            setTokenModal(true);
          }}
          onToggleStatus={handleToggleStatus}
          onOpenDelete={() => setDeleteModal(true)}
          showNotification={showNotification}
        />
      )}

      {/* MODAL: RENOMEAR APELIDO */}
      {renameModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16161A] border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-bold text-white">Renomear apelido</h3>
            <p className="text-xs text-zinc-400">
              Altere o nome de exibição de <span className="text-white font-mono">@{bot.username}</span> na área do WebGran.
            </p>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              className="w-full bg-[#1F1F24] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#3984FF]"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenameModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRename}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#3984FF] hover:bg-[#2563EB] text-white"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ATUALIZAR TOKEN */}
      {tokenModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16161A] border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-bold text-white">Atualizar token do bot</h3>
            <p className="text-xs text-zinc-400">Cole o novo token do @BotFather para este mesmo bot.</p>
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
                onClick={() => setTokenModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpdateToken}
                disabled={actionLoading || !tokenInput}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#3984FF] hover:bg-[#2563EB] text-white"
              >
                Atualizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR BOT */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16161A] border border-rose-500/20 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-bold text-rose-400">
              Excluir bot @{bot.username}?
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Esta ação removerá a integração deste bot na WebGran.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
