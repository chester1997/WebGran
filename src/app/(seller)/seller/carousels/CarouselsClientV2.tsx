"use client";

import React, { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Layers,
  Trophy,
  Plus,
  Search,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Edit3,
  Trash2,
  Sparkles,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Grid,
  List,
  Loader2,
  Package,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  Toolbar,
  SearchInput,
  SegmentedControl,
  Chip,
  Button,
  IconButton,
  RowMenu,
  ConfirmDialog,
  EmptyState,
  Toast,
  ToastType,
} from "@/components/seller-v2";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createCarouselAction,
  updateCarouselAction,
  deleteCarouselAction,
  moveCarouselPositionAction,
  updateRankingCarouselAction,
  toggleCarouselStatusAction,
} from "./actions";
import { CarouselIconRenderer } from "@/lib/carousel-icons";
import { getProductBadge } from "@/lib/product-badge";
import { IconPickerModal } from "./IconPickerModal";
import { SolarSellerCarouselsIcon } from "@/components/icons/solar/seller-icons";

export interface ProductOption {
  id: string;
  title: string;
  price: string | number;
  badge?: string | null;
}

export interface CarouselItem {
  id?: string;
  productId: string;
  position: number;
  product?: ProductOption | null;
}

export interface StandardCarousel {
  id: string;
  name: string;
  status: string;
  position: number;
  indicatorType?: string | null;
  iconName?: string | null;
  iconColor?: string | null;
  items?: CarouselItem[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface RankingCarousel {
  id: string;
  name: string;
  status: string;
  position?: number;
  indicatorType?: string | null;
  iconName?: string | null;
  iconColor?: string | null;
  items?: CarouselItem[];
}

export interface CarouselsClientV2Props {
  rankingCarousel: RankingCarousel | null;
  standardCarousels: StandardCarousel[];
  storeProducts: ProductOption[];
  hideHeader?: boolean;
}

export default function CarouselsClientV2({
  rankingCarousel,
  standardCarousels,
  storeProducts,
  hideHeader = false,
}: CarouselsClientV2Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Toolbar & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Toast feedback state
  const [toast, setToast] = useState<{
    id: string;
    type: ToastType;
    title?: string;
    message: string;
  } | null>(null);

  const showToast = (message: string, type: ToastType = "success", title?: string) => {
    setToast({ id: Date.now().toString(), type, message, title });
  };

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCarousel, setEditingCarousel] = useState<StandardCarousel | null>(null);
  const [isRankingModalOpen, setIsRankingModalOpen] = useState(false);
  const [carouselToDelete, setCarouselToDelete] = useState<StandardCarousel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Ranking data derived
  const rankingActiveProducts = useMemo(() => {
    return rankingCarousel?.items?.map((i) => i.product).filter(Boolean) as ProductOption[] || [];
  }, [rankingCarousel]);

  const rankingSelectedIds = useMemo(() => {
    return rankingCarousel?.items?.map((i) => i.productId) || [];
  }, [rankingCarousel]);

  // Total products in all standard carousels
  const totalStandardProductsCount = useMemo(() => {
    return standardCarousels.reduce((acc, c) => acc + (c.items?.length || 0), 0);
  }, [standardCarousels]);

  // Total sections
  const totalSections = standardCarousels.length + (rankingCarousel ? 1 : 0);

  // Active carousels count
  const activeCarouselsCount = useMemo(() => {
    const activeStandards = standardCarousels.filter((c) => c.status === "active").length;
    const rankingActive = rankingCarousel?.status === "active" ? 1 : 0;
    return activeStandards + rankingActive;
  }, [standardCarousels, rankingCarousel]);

  // Filtered standard carousels
  const filteredCarousels = useMemo(() => {
    return standardCarousels.filter((c) => {
      // Status filter
      if (statusFilter === "active" && c.status !== "active") return false;
      if (statusFilter === "inactive" && c.status === "active") return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = c.name.toLowerCase().includes(query);
        const matchesProducts = c.items?.some((item) =>
          item.product?.title?.toLowerCase().includes(query)
        );
        if (!matchesName && !matchesProducts) return false;
      }

      return true;
    });
  }, [standardCarousels, statusFilter, searchQuery]);

  // Handle move carousel position
  const handleMovePosition = async (carouselId: string, direction: "up" | "down") => {
    setActionLoadingId(`move-${carouselId}`);
    try {
      const res = await moveCarouselPositionAction(carouselId, direction);
      if (res?.success) {
        showToast("Ordem do carrossel atualizada com sucesso.");
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (err: any) {
      showToast(err.message || "Erro ao reordenar carrossel.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle quick toggle carousel status
  const handleToggleStatus = async (carouselId: string) => {
    setActionLoadingId(`toggle-${carouselId}`);
    try {
      const res = await toggleCarouselStatusAction(carouselId);
      if (res?.success) {
        showToast(
          `Carrossel ${res.status === "active" ? "ativado" : "ocultado"} no Mini App com sucesso.`
        );
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (err: any) {
      showToast(err.message || "Erro ao alterar visibilidade.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle quick toggle ranking status
  const handleToggleRankingStatus = async () => {
    if (!rankingCarousel) return;
    setActionLoadingId("toggle-ranking");
    try {
      const nextStatus = rankingCarousel.status === "active" ? "inactive" : "active";
      await updateRankingCarouselAction(
        rankingCarousel.id,
        rankingCarousel.name || "Top 15 Hoje",
        nextStatus,
        rankingSelectedIds,
        (rankingCarousel.indicatorType as "BAR" | "ICON" | "NONE") || "ICON",
        rankingCarousel.iconName || "Trophy",
        rankingCarousel.iconColor || "#FFD700"
      );
      showToast(
        `Ranking Editorial ${nextStatus === "active" ? "ativado" : "ocultado"} no Mini App.`
      );
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      showToast(err.message || "Erro ao alternar status do Ranking.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle confirm delete
  const handleConfirmDelete = async () => {
    if (!carouselToDelete) return;
    setIsDeleting(true);
    try {
      await deleteCarouselAction(carouselToDelete.id);
      showToast(`Carrossel "${carouselToDelete.name}" excluído com sucesso.`);
      setCarouselToDelete(null);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      showToast(err.message || "Erro ao excluir carrossel.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 fade-in w-full pb-20">
      {/* 1. Header Principal V2 */}
      {!hideHeader && (
        <PageHeader
          title="Carrosséis"
          subtitle="Personalize a seção de Ranking Editorial e organize carrosséis temáticos no Mini App da sua loja."
          badge={
            <span className="px-2 py-0.5 rounded-full text-xs font-sans font-medium tabular-nums bg-blue-500/10 text-blue-400 border border-blue-500/25">
              {totalSections} seções
            </span>
          }
          actions={
            <div className="flex items-center gap-2.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsRankingModalOpen(true)}
                className="gap-2 border-amber-500/20 hover:border-amber-500/40 text-amber-300 hover:text-amber-200"
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Configurar Ranking</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Carrossel</span>
              </Button>
            </div>
          }
        />
      )}

      {/* 2. StatCards — Métricas Operacionais V2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          label="Total de Seções"
          value={totalSections}
          icon={<Layers className="w-4 h-4" />}
          accent="blue"
          subtext="Ranking e carrosséis padrão"
        />
        <StatCard
          label="Carrosséis Ativos"
          value={activeCarouselsCount}
          icon={<CheckCircle2 className="w-4 h-4" />}
          accent="green"
          subtext="Visíveis no catálogo do Mini App"
        />
        <StatCard
          label="Ranking Editorial"
          value={
            rankingCarousel?.status === "active" ? "Ativo" : "Oculto"
          }
          icon={<Trophy className="w-4 h-4" />}
          accent="amber"
          subtext={`${rankingActiveProducts.length} de 15 produtos vinculados`}
        />
        <StatCard
          label="Produtos Vinculados"
          value={totalStandardProductsCount + rankingActiveProducts.length}
          icon={<Package className="w-4 h-4" />}
          accent="purple"
          subtext="Distribuídos nas seções"
        />
      </div>

      {/* 3. Destaque Especial: Ranking Editorial (Top 15) */}
      {rankingCarousel && (
        <div className="bg-gradient-to-r from-[#171018] via-[#15121A] to-[#121216] border border-amber-500/25 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
                {rankingCarousel.indicatorType === "ICON" ? (
                  <CarouselIconRenderer
                    iconName={rankingCarousel.iconName || "Trophy"}
                    color={rankingCarousel.iconColor || "#FFD700"}
                    size={24}
                  />
                ) : rankingCarousel.indicatorType === "NONE" ? (
                  <span className="text-xs text-zinc-500 font-medium">—</span>
                ) : (
                  <div
                    className="w-2 h-7 rounded-full"
                    style={{ backgroundColor: rankingCarousel.iconColor || "#FFD700" }}
                  />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    Ranking Editorial
                  </span>
                  <Chip
                    label={rankingCarousel.status === "active" ? "Ativo na Home" : "Oculto"}
                    variant={rankingCarousel.status === "active" ? "active" : "inactive"}
                    size="sm"
                  />
                  <span className="text-xs text-zinc-400 tabular-nums">
                    {rankingActiveProducts.length} de 15 produtos
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mt-1 truncate">
                  {rankingCarousel.name || "Top 15 Hoje"}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleToggleRankingStatus}
                disabled={actionLoadingId === "toggle-ranking"}
                className="gap-1.5 text-xs text-zinc-300 hover:text-white"
                title={
                  rankingCarousel.status === "active"
                    ? "Ocultar ranking do Mini App"
                    : "Ativar ranking no Mini App"
                }
              >
                {actionLoadingId === "toggle-ranking" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : rankingCarousel.status === "active" ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="hidden sm:inline">Ocultar</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">Ativar</span>
                  </>
                )}
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsRankingModalOpen(true)}
                className="gap-2 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 border-0 shadow-lg shadow-red-600/20 text-xs"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-300" />
                <span>Gerenciar Top 15</span>
              </Button>
            </div>
          </div>

          {/* Prévia dos produtos do ranking */}
          <div className="bg-[#101014]/90 rounded-xl p-3.5 border border-white/5 space-y-2">
            {rankingActiveProducts.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-zinc-500 text-xs">
                  Nenhum produto selecionado no Ranking. Clique em "Gerenciar Top 15" para adicionar até 15 produtos.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-2">
                {rankingActiveProducts.slice(0, 6).map((prod, idx) => {
                  const badge = getProductBadge(prod.badge);
                  return (
                    <div
                      key={prod.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-[#181820] border border-white/5 text-xs min-w-0"
                    >
                      <span
                        className={`w-5 h-5 rounded flex items-center justify-center font-extrabold text-[10px] shrink-0 ${
                          idx === 0
                            ? "bg-red-600 text-white"
                            : idx === 1
                            ? "bg-orange-600 text-white"
                            : idx === 2
                            ? "bg-amber-600 text-white"
                            : idx < 5
                            ? "bg-yellow-600 text-white"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="text-zinc-200 font-medium truncate flex-1">{prod.title}</span>
                      {badge && (
                        <span
                          className={`text-[9px] font-bold px-1 rounded uppercase shrink-0 ${badge.sellerBadgeClass}`}
                        >
                          {badge.label}
                        </span>
                      )}
                    </div>
                  );
                })}
                {rankingActiveProducts.length > 6 && (
                  <div className="flex items-center justify-center p-2 rounded-lg bg-[#181820]/60 border border-white/5 text-xs text-amber-400 font-medium">
                    + {rankingActiveProducts.length - 6} outros produtos no ranking
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Toolbar V2 — Busca, Filtros e Alternância de Visualização */}
      <Toolbar
        searchSlot={
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Buscar por nome do carrossel ou produto..."
            className="w-full sm:w-72"
          />
        }
        filterSlot={
          <SegmentedControl
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { id: "all", label: "Todos" },
              { id: "active", label: "Ativos" },
              { id: "inactive", label: "Ocultos" },
            ]}
          />
        }
        actionSlot={
          <div className="flex items-center gap-1.5 bg-[#171717] border border-white/[0.08] p-1 rounded-xl">
            <IconButton
              icon={<Grid className="w-4 h-4" />}
              aria-label="Visualização em Grade"
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className={viewMode === "grid" ? "bg-white/10 text-white" : "text-zinc-400"}
            />
            <IconButton
              icon={<List className="w-4 h-4" />}
              aria-label="Visualização em Lista"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className={viewMode === "list" ? "bg-white/10 text-white" : "text-zinc-400"}
            />
          </div>
        }
      />

      {/* 5. Lista / Grade de Carrosséis Padrão */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <SolarSellerCarouselsIcon className="w-5 h-5 text-blue-400" />
            <span>Carrosséis Temáticos da Loja</span>
            <span className="text-xs font-normal text-zinc-500">
              ({filteredCarousels.length} {filteredCarousels.length === 1 ? "carrossel" : "carrosséis"})
            </span>
          </h3>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Criar Carrossel</span>
          </Button>
        </div>

        {filteredCarousels.length === 0 ? (
          searchQuery || statusFilter !== "all" ? (
            <EmptyState
              icon={<Search className="w-7 h-7 text-zinc-500" />}
              title="Nenhum carrossel encontrado"
              description="Nenhum carrossel corresponde aos critérios de pesquisa ou filtros selecionados."
              action={{
                label: "Limpar Filtros",
                onClick: () => {
                  setSearchQuery("");
                  setStatusFilter("all");
                },
              }}
            />
          ) : (
            <EmptyState
              icon={<SolarSellerCarouselsIcon className="w-8 h-8 text-zinc-500" />}
              title="Nenhum carrossel padrão criado"
              description="Crie carrosséis de produtos personalizados como 'Lançamentos', 'Mais Vendidos' ou 'Ofertas da Semana' para enriquecer o catálogo do seu Mini App."
              action={{
                label: "Criar Primeiro Carrossel",
                onClick: () => setIsCreateModalOpen(true),
                icon: <Plus className="w-4 h-4" />,
              }}
            />
          )
        ) : viewMode === "grid" ? (
          /* Visualização em Grade */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            {filteredCarousels.map((carousel, idx) => {
              const activeProducts =
                carousel.items?.map((i) => i.product).filter(Boolean) as ProductOption[] || [];
              const isFirst = idx === 0;
              const isLast = idx === filteredCarousels.length - 1;
              const isActionLoading =
                actionLoadingId === `move-${carousel.id}` ||
                actionLoadingId === `toggle-${carousel.id}`;

              return (
                <div
                  key={carousel.id}
                  className="bg-[#121214] border border-white/[0.08] hover:border-white/20 rounded-2xl p-4 shadow-xl flex flex-col justify-between space-y-4 transition-all duration-200"
                >
                  <div>
                    {/* Header do Card */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {carousel.indicatorType === "ICON" ? (
                          <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                            <CarouselIconRenderer
                              iconName={carousel.iconName || "Flame"}
                              color={carousel.iconColor || "#8B5CF6"}
                              size={16}
                            />
                          </div>
                        ) : carousel.indicatorType === "NONE" ? null : (
                          <div
                            className="w-1.5 h-6 rounded-full shrink-0"
                            style={{ backgroundColor: carousel.iconColor || "#8B5CF6" }}
                          />
                        )}
                        <h4 className="font-bold text-white text-sm uppercase tracking-tight truncate">
                          {carousel.name}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Chip
                          label={carousel.status === "active" ? "Ativo" : "Oculto"}
                          variant={carousel.status === "active" ? "active" : "inactive"}
                          size="sm"
                        />
                      </div>
                    </div>

                    {/* Contagem e lista de produtos */}
                    <div className="bg-[#17171A] rounded-xl p-3 border border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-xs text-zinc-400 pb-1 border-b border-white/5">
                        <span className="font-medium">Produtos no Carrossel</span>
                        <span className="font-semibold text-white tabular-nums">
                          {activeProducts.length} item{activeProducts.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {activeProducts.length === 0 ? (
                        <div className="py-3 text-center space-y-1">
                          <p className="text-zinc-500 text-xs font-medium">Nenhum produto vinculado</p>
                          <p className="text-[11px] text-zinc-600">
                            Edite o carrossel ou vincule produtos pela tela de Produtos.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                          {activeProducts.slice(0, 4).map((prod) => (
                            <div
                              key={prod.id}
                              className="flex items-center justify-between text-xs py-1 px-1.5 rounded-lg bg-[#121214] border border-white/5"
                            >
                              <span className="text-zinc-300 truncate max-w-[170px]">
                                {prod.title}
                              </span>
                              <span className="text-emerald-400 font-semibold tabular-nums ml-2 shrink-0">
                                R$ {Number(prod.price).toFixed(2).replace(".", ",")}
                              </span>
                            </div>
                          ))}
                          {activeProducts.length > 4 && (
                            <p className="text-[11px] text-zinc-500 text-center pt-1 font-medium">
                              + {activeProducts.length - 4} outros produtos
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rodapé de Ações */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                    {/* Botões de Reordenação */}
                    <div className="flex items-center gap-1 bg-[#1A1A1E] px-1.5 py-1 rounded-xl border border-white/5">
                      <span className="text-[11px] font-bold text-zinc-400 px-1 select-none tabular-nums">
                        {idx + 1}º
                      </span>
                      <button
                        type="button"
                        disabled={isFirst || isActionLoading}
                        onClick={() => handleMovePosition(carousel.id, "up")}
                        className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 hover:bg-white/10 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                        title="Mover para cima"
                        aria-label="Mover para cima"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast || isActionLoading}
                        onClick={() => handleMovePosition(carousel.id, "down")}
                        className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 hover:bg-white/10 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                        title="Mover para baixo"
                        aria-label="Mover para baixo"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Botões de Ação Direta */}
                    <div className="flex items-center gap-1">
                      <IconButton
                        icon={
                          carousel.status === "active" ? (
                            <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-zinc-500" />
                          )
                        }
                        aria-label={carousel.status === "active" ? "Ocultar carrossel" : "Ativar carrossel"}
                        variant="ghost"
                        size="sm"
                        disabled={isActionLoading}
                        onClick={() => handleToggleStatus(carousel.id)}
                      />
                      <IconButton
                        icon={<Edit3 className="w-3.5 h-3.5 text-zinc-300" />}
                        aria-label="Editar carrossel"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingCarousel(carousel)}
                      />
                      <IconButton
                        icon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}
                        aria-label="Excluir carrossel"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCarouselToDelete(carousel)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Visualização em Lista */
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#17171A] border-b border-white/5 text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 w-20">Ordem</th>
                    <th className="py-3 px-4">Carrossel</th>
                    <th className="py-3 px-4 w-28">Status</th>
                    <th className="py-3 px-4 w-32">Produtos</th>
                    <th className="py-3 px-4 hidden md:table-cell">Prévia dos Itens</th>
                    <th className="py-3 px-4 text-right w-36">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-200">
                  {filteredCarousels.map((carousel, idx) => {
                    const activeProducts =
                      carousel.items?.map((i) => i.product).filter(Boolean) as ProductOption[] || [];
                    const isFirst = idx === 0;
                    const isLast = idx === filteredCarousels.length - 1;
                    const isActionLoading =
                      actionLoadingId === `move-${carousel.id}` ||
                      actionLoadingId === `toggle-${carousel.id}`;

                    return (
                      <tr key={carousel.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-zinc-400 tabular-nums w-6">
                              {idx + 1}º
                            </span>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={isFirst || isActionLoading}
                                onClick={() => handleMovePosition(carousel.id, "up")}
                                className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                                title="Subir"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={isLast || isActionLoading}
                                onClick={() => handleMovePosition(carousel.id, "down")}
                                className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                                title="Descer"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-white">
                          <div className="flex items-center gap-2.5">
                            {carousel.indicatorType === "ICON" ? (
                              <div className="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                <CarouselIconRenderer
                                  iconName={carousel.iconName || "Flame"}
                                  color={carousel.iconColor || "#8B5CF6"}
                                  size={14}
                                />
                              </div>
                            ) : carousel.indicatorType === "NONE" ? null : (
                              <div
                                className="w-1.5 h-5 rounded-full shrink-0"
                                style={{ backgroundColor: carousel.iconColor || "#8B5CF6" }}
                              />
                            )}
                            <span className="truncate max-w-[200px]">{carousel.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Chip
                            label={carousel.status === "active" ? "Ativo" : "Oculto"}
                            variant={carousel.status === "active" ? "active" : "inactive"}
                            size="sm"
                          />
                        </td>
                        <td className="py-3.5 px-4 text-zinc-300 font-medium tabular-nums">
                          {activeProducts.length} produto{activeProducts.length !== 1 ? "s" : ""}
                        </td>
                        <td className="py-3.5 px-4 hidden md:table-cell text-zinc-400">
                          {activeProducts.length === 0 ? (
                            <span className="text-zinc-600 italic">Nenhum</span>
                          ) : (
                            <span className="truncate block max-w-xs">
                              {activeProducts.map((p) => p.title).join(", ")}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <IconButton
                              icon={
                                carousel.status === "active" ? (
                                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5 text-zinc-500" />
                                )
                              }
                              aria-label={
                                carousel.status === "active" ? "Ocultar carrossel" : "Ativar carrossel"
                              }
                              variant="ghost"
                              size="sm"
                              disabled={isActionLoading}
                              onClick={() => handleToggleStatus(carousel.id)}
                            />
                            <IconButton
                              icon={<Edit3 className="w-3.5 h-3.5 text-zinc-300" />}
                              aria-label="Editar carrossel"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingCarousel(carousel)}
                            />
                            <IconButton
                              icon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}
                              aria-label="Excluir carrossel"
                              variant="ghost"
                              size="sm"
                              onClick={() => setCarouselToDelete(carousel)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 6. Modal de Criação / Edição de Carrossel Padrão */}
      <CarouselFormModal
        isOpen={isCreateModalOpen || !!editingCarousel}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingCarousel(null);
        }}
        carousel={editingCarousel}
        storeProducts={storeProducts}
        onSuccess={(msg) => {
          showToast(msg);
          setIsCreateModalOpen(false);
          setEditingCarousel(null);
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* 7. Modal de Configuração do Ranking Editorial (Top 15) */}
      {rankingCarousel && (
        <RankingFormModal
          isOpen={isRankingModalOpen}
          onClose={() => setIsRankingModalOpen(false)}
          rankingCarousel={rankingCarousel}
          storeProducts={storeProducts}
          onSuccess={(msg) => {
            showToast(msg);
            setIsRankingModalOpen(false);
            startTransition(() => {
              router.refresh();
            });
          }}
        />
      )}

      {/* 8. Diálogo de Confirmação de Exclusão */}
      <ConfirmDialog
        isOpen={!!carouselToDelete}
        onClose={() => setCarouselToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Carrossel?"
        description={
          <span>
            Tem certeza que deseja excluir o carrossel{" "}
            <strong className="text-white">"{carouselToDelete?.name}"</strong>? Os produtos
            associados não serão apagados do seu catálogo, apenas a seção será removida do Mini App.
          </span>
        }
        confirmLabel="Excluir Carrossel"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* 9. Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50">
          <Toast
            type={toast.type}
            title={toast.title}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
}

// ==========================================
// Subcomponente: Modal de Criação / Edição de Carrossel
// ==========================================
interface CarouselFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  carousel: StandardCarousel | null;
  storeProducts: ProductOption[];
  onSuccess: (message: string) => void;
}

function CarouselFormModal({
  isOpen,
  onClose,
  carousel,
  storeProducts,
  onSuccess,
}: CarouselFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [name, setName] = useState(carousel?.name || "");
  const [status, setStatus] = useState(carousel?.status || "active");
  const [indicatorType, setIndicatorType] = useState<"BAR" | "ICON" | "NONE">(
    (carousel?.indicatorType as "BAR" | "ICON" | "NONE") || "BAR"
  );
  const [iconName, setIconName] = useState<string>(carousel?.iconName || "Flame");
  const [iconColor, setIconColor] = useState<string>(carousel?.iconColor || "#8B5CF6");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");

  const isEditing = !!carousel;

  // Sync state when opening
  React.useEffect(() => {
    if (isOpen) {
      setName(carousel?.name || "");
      setStatus(carousel?.status || "active");
      setIndicatorType((carousel?.indicatorType as "BAR" | "ICON" | "NONE") || "BAR");
      setIconName(carousel?.iconName || "Flame");
      setIconColor(carousel?.iconColor || "#8B5CF6");
      const ids = carousel?.items?.map((i) => i.productId) || [];
      setSelectedProductIds(ids);
      setProductSearch("");
      setErrorMessage(null);
    }
  }, [isOpen, carousel]);

  // Available products to add
  const availableProducts = useMemo(() => {
    return storeProducts.filter(
      (p) =>
        !selectedProductIds.includes(p.id) &&
        p.title.toLowerCase().includes(productSearch.toLowerCase())
    );
  }, [storeProducts, selectedProductIds, productSearch]);

  const handleAddProduct = (id: string) => {
    setSelectedProductIds((prev) => [...prev, id]);
  };

  const handleRemoveProduct = (id: string) => {
    setSelectedProductIds((prev) => prev.filter((pId) => pId !== id));
  };

  const handleMoveProduct = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedProductIds.length) return;

    const newList = [...selectedProductIds];
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;
    setSelectedProductIds(newList);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("O nome do carrossel é obrigatório.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      if (isEditing) {
        await updateCarouselAction(
          carousel.id,
          name.trim(),
          selectedProductIds,
          indicatorType,
          iconName,
          iconColor,
          status
        );
        onSuccess(`Carrossel "${name.trim()}" atualizado com sucesso!`);
      } else {
        await createCarouselAction(
          name.trim(),
          selectedProductIds,
          indicatorType,
          iconName,
          iconColor
        );
        onSuccess(`Carrossel "${name.trim()}" criado com sucesso!`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar carrossel.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl w-[94vw] bg-[#121214] border border-white/10 p-0 overflow-hidden text-zinc-100 shadow-2xl flex flex-col max-h-[90vh] rounded-2xl">
        <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
          <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <span>{isEditing ? "Editar Carrossel" : "Novo Carrossel"}</span>
          </DialogTitle>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Nome do Carrossel e Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Nome do Carrossel *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Lançamentos, Mais Vendidos, Doramas"
                  required
                  className="w-full bg-[#181820] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
                />
              </div>

              {isEditing && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setStatus(status === "active" ? "inactive" : "active")}
                    className={`w-full py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      status === "active"
                        ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/30"
                        : "bg-zinc-800 text-zinc-400 border-white/10"
                    }`}
                  >
                    {status === "active" ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-400" /> Ativo
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-zinc-400" /> Oculto
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Indicador Visual / Ícone */}
            <IconPickerModal
              indicatorType={indicatorType}
              iconName={iconName}
              iconColor={iconColor}
              onChangeIndicatorType={setIndicatorType}
              onChangeIconName={setIconName}
              onChangeIconColor={setIconColor}
            />

            {/* Gestão e Ordenação de Produtos */}
            <div className="space-y-3 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
                  Produtos Associados ({selectedProductIds.length})
                </label>
                <span className="text-[11px] text-zinc-500">
                  Arraste ou ordene pelos botões
                </span>
              </div>

              {/* Lista dos produtos selecionados */}
              {selectedProductIds.length === 0 ? (
                <div className="p-4 text-center bg-[#181820] border border-white/5 rounded-xl text-zinc-500 text-xs">
                  Nenhum produto associado ainda. Escolha produtos abaixo para incluir neste carrossel.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {selectedProductIds.map((pId, idx) => {
                    const prod = storeProducts.find((p) => p.id === pId);
                    if (!prod) return null;
                    return (
                      <div
                        key={pId}
                        className="flex items-center justify-between p-2 rounded-xl bg-[#181820] border border-white/5 text-xs text-white"
                      >
                        <div className="flex items-center gap-2 truncate min-w-0 flex-1 mr-2">
                          <span className="w-5 h-5 rounded bg-zinc-800 text-zinc-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {idx + 1}
                          </span>
                          <span className="truncate">{prod.title}</span>
                          <span className="text-emerald-400 font-semibold tabular-nums ml-1 shrink-0">
                            R$ {Number(prod.price).toFixed(2).replace(".", ",")}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveProduct(idx, "up")}
                            className="p-1 text-zinc-400 hover:text-white disabled:opacity-20 rounded"
                            title="Subir posição"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === selectedProductIds.length - 1}
                            onClick={() => handleMoveProduct(idx, "down")}
                            className="p-1 text-zinc-400 hover:text-white disabled:opacity-20 rounded"
                            title="Descer posição"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveProduct(pId)}
                            className="p-1 text-red-400 hover:text-red-300 rounded ml-1"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Seletor de produtos disponíveis */}
              <div className="space-y-2 pt-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Adicionar produto da loja ao carrossel..."
                    className="w-full bg-[#181820] border border-white/10 rounded-xl pl-8 pr-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
                  />
                </div>

                {availableProducts.length > 0 && (
                  <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-1">
                    {availableProducts.slice(0, 8).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleAddProduct(p.id)}
                        className="flex items-center justify-between p-2 rounded-xl bg-[#181820] hover:bg-white/10 border border-white/5 text-xs text-zinc-200 cursor-pointer transition-all"
                      >
                        <span className="truncate mr-2">{p.title}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-emerald-400 font-semibold tabular-nums">
                            R$ {Number(p.price).toFixed(2).replace(".", ",")}
                          </span>
                          <Plus className="w-4 h-4 text-blue-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dica sobre vinculação pela tela de produtos */}
              <div className="bg-[#1A1A1E] rounded-xl p-3 border border-white/5 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Você também pode associar produtos a este carrossel diretamente no cadastro e edição de cada produto na tela de <strong className="text-zinc-200">Produtos</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-white/5 shrink-0 flex items-center justify-end gap-2.5 bg-[#121214]">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-zinc-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Salvando...
                </>
              ) : isEditing ? (
                "Salvar Alterações"
              ) : (
                "Criar Carrossel"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// Subcomponente: Modal de Configuração do Ranking (Top 15)
// ==========================================
interface RankingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  rankingCarousel: RankingCarousel;
  storeProducts: ProductOption[];
  onSuccess: (message: string) => void;
}

function RankingFormModal({
  isOpen,
  onClose,
  rankingCarousel,
  storeProducts,
  onSuccess,
}: RankingFormModalProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [name, setName] = useState(rankingCarousel.name || "Top 15 Hoje");
  const [status, setStatus] = useState(rankingCarousel.status || "active");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [indicatorType, setIndicatorType] = useState<"BAR" | "ICON" | "NONE">(
    (rankingCarousel.indicatorType as "BAR" | "ICON" | "NONE") || "ICON"
  );
  const [iconName, setIconName] = useState<string>(rankingCarousel.iconName || "Trophy");
  const [iconColor, setIconColor] = useState<string>(rankingCarousel.iconColor || "#FFD700");

  const maxLimit = 15;
  const isLimitReached = selectedIds.length >= maxLimit;

  // Sync state on open
  React.useEffect(() => {
    if (isOpen) {
      setName(rankingCarousel.name || "Top 15 Hoje");
      setStatus(rankingCarousel.status || "active");
      const ids = rankingCarousel.items?.map((i) => i.productId) || [];
      setSelectedIds(ids);
      setIndicatorType((rankingCarousel.indicatorType as "BAR" | "ICON" | "NONE") || "ICON");
      setIconName(rankingCarousel.iconName || "Trophy");
      setIconColor(rankingCarousel.iconColor || "#FFD700");
      setSearchTerm("");
      setErrorMessage(null);
    }
  }, [isOpen, rankingCarousel]);

  // Filter available products not yet selected
  const availableProducts = useMemo(() => {
    return storeProducts.filter(
      (p) => !selectedIds.includes(p.id) && p.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [storeProducts, selectedIds, searchTerm]);

  const handleAddProduct = (productId: string) => {
    if (selectedIds.length >= maxLimit) {
      setErrorMessage("Esta seção permite no máximo 15 produtos.");
      return;
    }
    setSelectedIds([...selectedIds, productId]);
    setErrorMessage(null);
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedIds(selectedIds.filter((id) => id !== productId));
    setErrorMessage(null);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedIds.length) return;

    const newList = [...selectedIds];
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;
    setSelectedIds(newList);
  };

  const handleSave = () => {
    if (!name.trim()) {
      setErrorMessage("Informe um nome para a seção de ranking.");
      return;
    }

    if (selectedIds.length > maxLimit) {
      setErrorMessage("Esta seção permite no máximo 15 produtos.");
      return;
    }

    startTransition(async () => {
      try {
        await updateRankingCarouselAction(
          rankingCarousel.id,
          name.trim(),
          status,
          selectedIds,
          indicatorType,
          iconName,
          iconColor
        );
        onSuccess("Ranking Top 15 atualizado com sucesso!");
      } catch (err: any) {
        setErrorMessage(err.message || "Erro ao atualizar ranking.");
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-20px)] sm:w-full sm:max-w-2xl bg-[#121216] border border-white/10 text-white max-h-[calc(100dvh-20px)] sm:max-h-[90vh] flex flex-col rounded-2xl shadow-2xl p-0 overflow-hidden box-border">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/5 shrink-0 bg-[#121216] pr-12 relative">
          <DialogHeader className="pr-0">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2.5 text-white">
              <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Configurar Ranking Editorial (Top 15)</span>
            </DialogTitle>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Personalize o nome da seção, escolha o indicador visual/ícone e selecione a ordem manual dos até 15 produtos mais relevantes.
            </p>
          </DialogHeader>
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5 custom-scrollbar">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/30 text-red-200 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Nome e Status */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3.5 w-full">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 block uppercase tracking-wider">
                Nome da Seção no Mini App
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Top 15 Hoje, Em Alta, Em Destaque"
                className="w-full bg-[#181820] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="w-full sm:w-auto shrink-0 space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 block uppercase tracking-wider">
                Status no Mini App
              </label>
              <button
                type="button"
                onClick={() => setStatus(status === "active" ? "inactive" : "active")}
                className={`w-full sm:w-auto min-h-[42px] py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  status === "active"
                    ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/30"
                    : "bg-zinc-800 text-zinc-400 border-white/10"
                }`}
              >
                {status === "active" ? (
                  <>
                    <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Ativo no Mini App</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-4 h-4 shrink-0" />
                    <span>Oculto</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Indicador Visual / Ícone */}
          <IconPickerModal
            indicatorType={indicatorType}
            iconName={iconName}
            iconColor={iconColor}
            onChangeIndicatorType={setIndicatorType}
            onChangeIconName={setIconName}
            onChangeIconColor={setIconColor}
          />

          {/* Lista de Produtos Selecionados (Até 15) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <span>Produtos Selecionados no Ranking</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    isLimitReached
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-white/5 text-zinc-400 border-white/10"
                  }`}
                >
                  {selectedIds.length} / {maxLimit} produtos
                </span>
              </h4>
              {isLimitReached && (
                <span className="text-[11px] text-amber-400 font-medium">
                  Limite máximo de 15 atingido
                </span>
              )}
            </div>

            {selectedIds.length === 0 ? (
              <div className="p-6 text-center bg-[#181820] border border-white/5 rounded-xl text-zinc-500 text-xs">
                Nenhum produto selecionado para o ranking. Busque produtos abaixo para começar.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                {selectedIds.map((id, index) => {
                  const prod = storeProducts.find((p) => p.id === id);
                  if (!prod) return null;
                  const isTop5 = index < 5;
                  const badgeConfig = getProductBadge(prod.badge);

                  return (
                    <div
                      key={id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all gap-2 ${
                        isTop5
                          ? "bg-gradient-to-r from-red-950/30 to-[#181820] border-red-500/30"
                          : "bg-[#181820] border-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0 ${
                            index === 0
                              ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                              : index === 1
                              ? "bg-orange-600 text-white shadow-md shadow-orange-600/30"
                              : index === 2
                              ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                              : index < 5
                              ? "bg-yellow-600 text-white"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </div>
                        <span className="text-xs font-semibold text-white truncate min-w-0">
                          {prod.title}
                        </span>
                        {badgeConfig && (
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border uppercase shrink-0 ${badgeConfig.sellerBadgeClass}`}
                          >
                            {badgeConfig.label}
                          </span>
                        )}
                        <span className="text-emerald-400 text-xs font-semibold tabular-nums ml-auto mr-2 shrink-0">
                          R$ {Number(prod.price).toFixed(2).replace(".", ",")}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMove(index, "up")}
                          disabled={index === 0}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white disabled:opacity-30 transition-all flex items-center justify-center cursor-pointer"
                          title="Subir posição"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(index, "down")}
                          disabled={index === selectedIds.length - 1}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white disabled:opacity-30 transition-all flex items-center justify-center cursor-pointer"
                          title="Descer posição"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(id)}
                          className="w-7 h-7 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 transition-all flex items-center justify-center cursor-pointer ml-0.5"
                          title="Remover do ranking"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Adicionar produtos disponíveis */}
          {!isLimitReached && (
            <div className="space-y-3 pt-3 border-t border-white/5">
              <h4 className="text-xs font-semibold text-zinc-300 block uppercase tracking-wider">
                Adicionar Produtos ao Ranking
              </h4>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar produto por nome..."
                  className="w-full bg-[#181820] border border-white/10 rounded-xl pl-8 pr-4 py-2 text-xs text-white focus:outline-none focus:border-red-500 placeholder:text-zinc-600"
                />
              </div>

              <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                {availableProducts.length === 0 ? (
                  <p className="text-zinc-500 text-xs py-3 text-center">Nenhum produto disponível.</p>
                ) : (
                  availableProducts.map((p) => {
                    const badgeConfig = getProductBadge(p.badge);
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleAddProduct(p.id)}
                        className="flex items-center justify-between p-2 rounded-xl bg-[#181820] hover:bg-white/10 border border-white/5 text-xs text-zinc-200 cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2 truncate min-w-0 flex-1 mr-2">
                          <span className="truncate">{p.title}</span>
                          {badgeConfig && (
                            <span
                              className={`text-[9px] font-extrabold px-1 rounded border uppercase shrink-0 ${badgeConfig.sellerBadgeClass}`}
                            >
                              {badgeConfig.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-emerald-400 font-semibold tabular-nums">
                            R$ {Number(p.price).toFixed(2).replace(".", ",")}
                          </span>
                          <Plus className="w-4 h-4 text-red-400" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-white/5 shrink-0 bg-[#121216] flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xs"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl px-5 shadow-lg shadow-red-600/20"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Salvando...
              </>
            ) : (
              "Salvar Ranking Top 15"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
