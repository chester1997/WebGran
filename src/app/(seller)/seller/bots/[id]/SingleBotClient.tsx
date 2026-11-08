"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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

import WelcomeClient from "@/app/(seller)/seller/boas-vindas/WelcomeClient";
import BannersClient from "@/app/(seller)/seller/banners/BannersClient";
import ProductsListClient from "@/app/(seller)/seller/products/ProductsListClient";
import CombosClient from "@/app/(seller)/seller/combos/CombosClient";
import VideosClient from "@/app/(seller)/seller/videos/VideosClient";
import CarouselsClient from "@/app/(seller)/seller/carousels/CarouselsClient";
import CategoriesClient from "@/app/(seller)/seller/categories/CategoriesClient";
import ClipsClient from "@/app/(seller)/seller/bot/clips/ClipsClient";
import { NotificationsClient } from "@/app/(seller)/seller/bot/notifications/NotificationsClient";
import CouponsClient from "@/app/(seller)/seller/coupons/CouponsClient";
import { BotTabData } from "../bot-tab-loaders";

export interface BotActivityEvent {
  id: string;
  type: "conversation_started" | "payment_pending" | "sale_approved";
  title: string;
  botTag: string;
  description: string;
  createdAt: string;
  status: "completed" | "pending" | "approved";
  amount?: number;
}

export interface BotOrderItem {
  id: string;
  productId: string | null;
  productTitle: string;
  productCoverUrl: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface BotOrderRecord {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  paidAt?: string | null;
  customerTelegramId?: string | null;
  customerName?: string;
  items?: BotOrderItem[];
}

export interface TopSellingProduct {
  id: string;
  title: string;
  coverUrl: string | null;
  totalQuantity: number;
  totalRevenue: number;
  revenuePercent: number;
}

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
  initialOrders: BotOrderRecord[];
  initialRecentActivity?: BotActivityEvent[];
  initialCustomers: CustomerItem[];
  initialMessages?: MessageItem[];
  totalUniqueCustomers?: number;
  activeProductsCount?: number;
  tabData?: BotTabData;
  userRole?: string;
  isAdmin: boolean;
}

export default function SingleBotClient({
  bot: initialBot,
  storeSlug,
  initialTab,
  initialOrders,
  initialRecentActivity = [],
  initialCustomers,
  initialMessages = [],
  totalUniqueCustomers,
  activeProductsCount,
  tabData,
  userRole,
  isAdmin,
}: SingleBotClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [bot, setBot] = useState(initialBot);
  const [activeTab, setActiveTab] = useState(initialTab || "visao-geral");
  const [tabCache, setTabCache] = useState<BotTabData>(tabData || {});
  const [selectedPeriod, setSelectedPeriod] = useState<"today" | "week" | "month" | "year">("month");
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Sincronizar cache de dados ao receber novas abas carregadas
  useEffect(() => {
    if (tabData) {
      setTabCache((prev) => ({
        ...prev,
        ...tabData,
      }));
    }
  }, [tabData]);

  // Sincronizar activeTab quando o searchParams mudar via router
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    startTransition(() => {
      router.push(`/seller/bots/${bot.id}?tab=${tabId}`, { scroll: false });
    });
  };

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

  const startDate = useMemo(() => {
    const now = new Date();
    const start = new Date();
    if (selectedPeriod === "today") start.setHours(0, 0, 0, 0);
    else if (selectedPeriod === "week") start.setDate(now.getDate() - 7);
    else if (selectedPeriod === "month") start.setMonth(now.getMonth() - 1);
    else if (selectedPeriod === "year") start.setFullYear(now.getFullYear() - 1);
    return start;
  }, [selectedPeriod]);

  // Cálculo de Métricas por período com os 3 novos indicadores: Total de Clientes, Ticket Médio e Produtos Ativos
  const metrics = useMemo(() => {
    const filtered = initialOrders.filter((o) => new Date(o.createdAt) >= startDate);
    const paid = filtered.filter((o) => o.status === "paid");
    const approvedRevenue = paid.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = filtered.length;
    const paidCount = paid.length;

    // Ticket Médio: Receita aprovada ÷ quantidade de pedidos aprovados no período
    // Quando não houver pedidos aprovados, exibir 0 (R$ 0,00)
    const averageTicket = paidCount > 0 ? approvedRevenue / paidCount : 0;

    // Total de Clientes únicos vinculados ao bot atual
    const totalCustomers = totalUniqueCustomers ?? initialCustomers.length;

    // Produtos Ativos no catálogo deste bot
    const prodsCount = activeProductsCount ?? 0;

    const conversionRate = totalOrders > 0 ? (paidCount / totalOrders) * 100 : 0;

    return {
      approvedRevenue,
      totalOrders,
      paidCount,
      conversionRate,
      totalCustomers,
      averageTicket,
      activeProductsCount: prodsCount,
    };
  }, [startDate, initialOrders, totalUniqueCustomers, initialCustomers, activeProductsCount]);

  // Atividade Recente filtrada pelo período selecionado
  const recentActivity = useMemo(() => {
    return (initialRecentActivity || []).filter(
      (e) => new Date(e.createdAt) >= startDate
    );
  }, [startDate, initialRecentActivity]);

  // Mais Vendidos filtrado pelo período a partir de pedidos pagos do bot
  const topSellingProducts = useMemo(() => {
    const paidOrders = initialOrders.filter(
      (o) => o.status === "paid" && new Date(o.createdAt) >= startDate
    );

    const productMap = new Map<string, {
      id: string;
      title: string;
      coverUrl: string | null;
      totalQuantity: number;
      totalRevenue: number;
    }>();

    paidOrders.forEach((o) => {
      if (o.items && o.items.length > 0) {
        o.items.forEach((item) => {
          const key = item.productId || item.productTitle || item.id;
          const current = productMap.get(key) || {
            id: key,
            title: item.productTitle,
            coverUrl: item.productCoverUrl,
            totalQuantity: 0,
            totalRevenue: 0,
          };
          current.totalQuantity += item.quantity || 1;
          current.totalRevenue += item.total || (item.unitPrice ? item.unitPrice * item.quantity : 0);
          if (item.productCoverUrl && !current.coverUrl) {
            current.coverUrl = item.productCoverUrl;
          }
          productMap.set(key, current);
        });
      } else {
        const key = o.id;
        const current = productMap.get(key) || {
          id: key,
          title: "Produto WebGran",
          coverUrl: null,
          totalQuantity: 0,
          totalRevenue: 0,
        };
        current.totalQuantity += 1;
        current.totalRevenue += o.totalAmount;
        productMap.set(key, current);
      }
    });

    const list = Array.from(productMap.values());
    list.sort((a, b) => b.totalRevenue - a.totalRevenue);

    const totalRevenueSum = list.reduce((sum, p) => sum + p.totalRevenue, 0);

    return list.map((p) => ({
      ...p,
      revenuePercent: totalRevenueSum > 0 ? Math.round((p.totalRevenue / totalRevenueSum) * 100) : 0,
    }));
  }, [startDate, initialOrders]);

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

      {/* 1. CABEÇALHO UNIFICADO COM NAVEGAÇÃO HORIZONTAL INTEGRADA */}
      <BotHeader
        bot={bot}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
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
        isAdmin={isAdmin}
      />

      {/* 2. CONTEÚDO DAS ABAS */}
      {/* 2.1 GERENCIAMENTO DO BOT */}
      {activeTab === "visao-geral" && (
        <BotOverviewTab
          bot={bot}
          metrics={metrics}
          recentActivity={recentActivity}
          topSellingProducts={topSellingProducts}
          selectedPeriod={selectedPeriod}
          onSelectPeriod={setSelectedPeriod}
          onOpenConversas={() => handleSelectTab("conversas")}
          isAdmin={isAdmin}
          userRole={userRole}
          showOperationalStatus={false}
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

      {activeTab === "boas-vindas" && (
        tabCache.welcomeSettings ? (
          <WelcomeClient initialSettings={tabCache.welcomeSettings} hideHeader={true} />
        ) : (
          <div className="flex items-center justify-center p-12 text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#3984FF]" />
            <span>Carregando Boas-vindas...</span>
          </div>
        )
      )}

      {/* 3.2 RECURSOS DO MINI APP */}
      {activeTab === "banners" && (
        tabCache.bannersData ? (
          <BannersClient
            initialBanners={tabCache.bannersData.banners}
            initialInterval={tabCache.bannersData.bannerInterval}
            maxLimit={tabCache.bannersData.maxLimit}
            hideHeader={true}
          />
        ) : (
          <div className="flex items-center justify-center p-12 text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#3984FF]" />
            <span>Carregando Banners...</span>
          </div>
        )
      )}

      {activeTab === "produtos" && (
        tabCache.productsData ? (
          <ProductsListClient
            storeName={bot.storeName}
            products={tabCache.productsData.products}
            categories={tabCache.productsData.categories}
            bots={tabCache.productsData.bots}
            userRole={userRole}
            carousels={tabCache.productsData.carousels}
            hideHeader={true}
          />
        ) : (
          <div className="flex items-center justify-center p-12 text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#3984FF]" />
            <span>Carregando Produtos...</span>
          </div>
        )
      )}

      {activeTab === "combos" && (
        tabCache.combosData ? (
          <CombosClient
            initialCombos={tabCache.combosData.combos}
            activeProducts={tabCache.combosData.activeProducts}
            storeSlug={storeSlug}
            hideHeader={true}
          />
        ) : (
          <div className="flex items-center justify-center p-12 text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#3984FF]" />
            <span>Carregando Combos...</span>
          </div>
        )
      )}

      {activeTab === "videos" && (
        tabCache.videosData ? (
          <VideosClient
            initialVideos={tabCache.videosData.videos}
            initialUsage={tabCache.videosData.usage}
            hideHeader={true}
          />
        ) : (
          <div className="flex items-center justify-center p-12 text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#3984FF]" />
            <span>Carregando Biblioteca de Vídeos...</span>
          </div>
        )
      )}

      {activeTab === "carrosseis" && (
        tabCache.carouselsData ? (
          <CarouselsClient
            rankingCarousel={tabCache.carouselsData.rankingCarousel}
            standardCarousels={tabCache.carouselsData.standardCarousels}
            storeProducts={tabCache.carouselsData.storeProducts}
            hideHeader={true}
          />
        ) : (
          <div className="flex items-center justify-center p-12 text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#3984FF]" />
            <span>Carregando Carrosséis...</span>
          </div>
        )
      )}

      {activeTab === "categorias" && (
        tabCache.categoriesData ? (
          <CategoriesClient
            allCategories={tabCache.categoriesData.allCategories}
            serializedProducts={tabCache.categoriesData.serializedProducts}
            initialStyle={tabCache.categoriesData.initialStyle}
            hideHeader={true}
          />
        ) : (
          <div className="flex items-center justify-center p-12 text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#3984FF]" />
            <span>Carregando Categorias...</span>
          </div>
        )
      )}

      {activeTab === "clips" && (
        tabCache.clipsData ? (
          <ClipsClient
            initialClips={tabCache.clipsData.clips}
            initialStats={tabCache.clipsData.stats}
            availableProducts={tabCache.clipsData.products}
            hideHeader={true}
          />
        ) : (
          <div className="flex items-center justify-center p-12 text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#3984FF]" />
            <span>Carregando Clipes...</span>
          </div>
        )
      )}

      {activeTab === "notificacoes" && (
        tabCache.notificationsData ? (
          <NotificationsClient
            initialSettings={tabCache.notificationsData.settings}
            notifications={tabCache.notificationsData.notifications}
            products={tabCache.notificationsData.products}
            hideHeader={true}
          />
        ) : (
          <div className="flex items-center justify-center p-12 text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#3984FF]" />
            <span>Carregando Notificações...</span>
          </div>
        )
      )}

      {activeTab === "cupons" && (
        tabCache.couponsData ? (
          <CouponsClient
            initialCoupons={tabCache.couponsData}
            hideHeader={true}
          />
        ) : (
          <div className="flex items-center justify-center p-12 text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#3984FF]" />
            <span>Carregando Cupons...</span>
          </div>
        )
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
