"use client";

import React, { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Edit3,
  Loader2,
  Clock,
  AlertCircle,
  CheckCircle2,
  X,
  Upload,
  Link as LinkIcon,
  RotateCcw,
  LayoutGrid,
  List,
  Power,
  ExternalLink,
  Tag,
  Package,
} from "lucide-react";

import {
  PageHeader,
  StatCard,
  Toolbar,
  SearchInput,
  Card,
  Chip,
  Button,
  IconButton,
  EmptyState,
  ConfirmDialog,
  Toast,
  RowMenu,
  SegmentedControl,
} from "@/components/seller-v2";

import {
  updateBannerAction,
  deleteBannerAction,
  reorderBannersAction,
  updateBannerIntervalAction,
} from "./actions";

export interface BannerItem {
  id: string;
  storeId: string;
  title: string;
  imageUrl: string;
  linkType: string | null;
  linkValue: string | null;
  position: number;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface BannersClientV2Props {
  initialBanners: BannerItem[];
  initialInterval: number;
  maxLimit: number;
  hideHeader?: boolean;
}

const MAX_BANNER_SIZE_MB = 20;
const MAX_BANNER_SIZE_BYTES = MAX_BANNER_SIZE_MB * 1024 * 1024;

export default function BannersClientV2({
  initialBanners,
  initialInterval,
  maxLimit,
  hideHeader = false,
}: BannersClientV2Props) {
  const router = useRouter();

  // Estados principais
  const [bannersList, setBannersList] = useState<BannerItem[]>(initialBanners);
  const [bannerInterval, setBannerInterval] = useState<number>(initialInterval);
  const [isSavingInterval, setIsSavingInterval] = useState(false);

  // Filtros e busca
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [linkFilter, setLinkFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modais e Diálogos
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerItem | null>(null);
  const [bannerToDelete, setBannerToDelete] = useState<BannerItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Upload e Otimização
  const [inputMode, setInputMode] = useState<"upload" | "url">("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSizeMB, setSelectedFileSizeMB] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notificações
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    imageUrl: "",
    linkType: "none",
    linkValue: "",
  });

  const isLimitReached = bannersList.length >= maxLimit;

  // Métricas calculadas para os StatCards
  const stats = useMemo(() => {
    const total = bannersList.length;
    let active = 0;
    let inactive = 0;

    bannersList.forEach((b) => {
      if (b.status === "active") active++;
      else inactive++;
    });

    return { total, active, inactive, interval: bannerInterval };
  }, [bannersList, bannerInterval]);

  // Filtros aplicados
  const filteredBanners = useMemo(() => {
    return bannersList.filter((b) => {
      // 1. Busca por título
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        if (!b.title?.toLowerCase().includes(query)) {
          return false;
        }
      }

      // 2. Filtro por status
      if (statusFilter !== "all" && b.status !== statusFilter) {
        return false;
      }

      // 3. Filtro por tipo de link
      if (linkFilter === "with_link") {
        if (!b.linkType || b.linkType === "none" || !b.linkValue?.trim()) return false;
      } else if (linkFilter === "no_link") {
        if (b.linkType && b.linkType !== "none" && b.linkValue?.trim()) return false;
      }

      return true;
    });
  }, [bannersList, searchQuery, statusFilter, linkFilter]);

  // Contagem de filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (statusFilter !== "all") count++;
    if (linkFilter !== "all") count++;
    return count;
  }, [searchQuery, statusFilter, linkFilter]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setLinkFilter("all");
  };

  // Alteração do intervalo de rotação do carrossel
  const handleIntervalChange = async (seconds: number) => {
    try {
      setIsSavingInterval(true);
      setBannerInterval(seconds);
      await updateBannerIntervalAction(seconds);
      setToast({
        type: "success",
        message: `Intervalo de transição atualizado para ${seconds} segundos.`,
      });
      router.refresh();
    } catch (err: any) {
      setToast({
        type: "error",
        message: err?.message || "Erro ao atualizar o intervalo.",
      });
    } finally {
      setIsSavingInterval(false);
    }
  };

  // Abertura do Modal de Criação
  const openCreateModal = () => {
    if (isLimitReached) {
      setToast({
        type: "error",
        message: `Limite de banners atingido (${bannersList.length}/${maxLimit}).`,
      });
      return;
    }
    setEditingBanner(null);
    setFormData({
      title: "",
      imageUrl: "",
      linkType: "none",
      linkValue: "",
    });
    setSelectedFileName(null);
    setSelectedFileSizeMB(null);
    setInputMode("upload");
    setFormError(null);
    setIsModalOpen(true);
  };

  // Abertura do Modal de Edição
  const openEditModal = (b: BannerItem) => {
    setEditingBanner(b);
    setFormData({
      title: b.title || "",
      imageUrl: b.imageUrl || "",
      linkType: b.linkType || "none",
      linkValue: b.linkValue || "",
    });
    setSelectedFileName(null);
    setSelectedFileSizeMB(null);
    setInputMode(b.imageUrl.startsWith("data:") ? "upload" : "url");
    setFormError(null);
    setIsModalOpen(true);
  };

  // Upload de arquivo de imagem com validação de 20MB e otimização
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BANNER_SIZE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setFormError(
        `O arquivo selecionado (${fileSizeMB}MB) excede o limite máximo permitido de ${MAX_BANNER_SIZE_MB}MB.`
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      setIsUploading(true);
      setFormError(null);

      const { uploadOptimizedImage } = await import("@/lib/image-optimizer");
      const uploadRes = await uploadOptimizedImage(file, "banners", {
        maxWidth: 1200,
        maxHeight: 540,
        quality: 0.85,
        format: "image/webp",
      });

      setFormData((prev) => ({ ...prev, imageUrl: uploadRes.url }));
      setSelectedFileName(file.name);
      setSelectedFileSizeMB((file.size / (1024 * 1024)).toFixed(2));
    } catch (err: any) {
      console.error("[BannersClientV2] Erro no upload da imagem:", err);
      setFormError(err?.message || "Erro ao processar imagem do banner.");
    } finally {
      setIsUploading(false);
    }
  };

  // Envio do formulário (Criação ou Edição)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.imageUrl.trim()) {
      setFormError("Informe a URL da imagem ou faça upload de um arquivo.");
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      const res = await fetch("/api/seller/banners/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingBanner ? editingBanner.id : undefined,
          title: formData.title.trim(),
          imageUrl: formData.imageUrl.trim(),
          linkType: formData.linkType,
          linkValue: formData.linkValue.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao salvar o banner.");
      }

      setToast({
        type: "success",
        message: editingBanner ? "Banner atualizado com sucesso!" : "Banner cadastrado com sucesso!",
      });

      setIsModalOpen(false);

      if (editingBanner) {
        setBannersList((prev) =>
          prev.map((b) =>
            b.id === editingBanner.id
              ? {
                  ...b,
                  title: formData.title.trim() || b.title,
                  imageUrl: data.imageUrl || formData.imageUrl.trim(),
                  linkType: formData.linkType === "none" ? null : formData.linkType,
                  linkValue: formData.linkValue.trim() || null,
                  updatedAt: new Date().toISOString(),
                }
              : b
          )
        );
      } else {
        const newBanner: BannerItem = {
          id: `temp-${Date.now()}`,
          storeId: "",
          title: formData.title.trim() || `Banner ${bannersList.length + 1}`,
          imageUrl: data.imageUrl || formData.imageUrl.trim(),
          linkType: formData.linkType === "none" ? null : formData.linkType,
          linkValue: formData.linkValue.trim() || null,
          position: bannersList.length,
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setBannersList((prev) => [...prev, newBanner]);
      }

      router.refresh();
    } catch (err: any) {
      setFormError(err?.message || "Erro ao salvar banner.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alternar status ativo/inativo
  const handleToggleStatus = async (b: BannerItem) => {
    setTogglingId(b.id);
    const nextStatus = b.status === "active" ? "inactive" : "active";
    try {
      setBannersList((prev) =>
        prev.map((item) => (item.id === b.id ? { ...item, status: nextStatus } : item))
      );
      await updateBannerAction({ id: b.id, status: nextStatus });
      setToast({
        type: "success",
        message: `Banner ${nextStatus === "active" ? "ativado" : "desativado"} com sucesso.`,
      });
      router.refresh();
    } catch (err: any) {
      setToast({
        type: "error",
        message: err?.message || "Erro ao alterar o status do banner.",
      });
      router.refresh();
    } finally {
      setTogglingId(null);
    }
  };

  // Exclusão com confirmação
  const handleConfirmDelete = async () => {
    if (!bannerToDelete) return;
    setIsDeleting(true);
    try {
      await deleteBannerAction(bannerToDelete.id);
      setBannersList((prev) => prev.filter((b) => b.id !== bannerToDelete.id));
      setToast({
        type: "success",
        message: `Banner "${bannerToDelete.title}" excluído com sucesso.`,
      });
      setBannerToDelete(null);
      router.refresh();
    } catch (err: any) {
      setToast({
        type: "error",
        message: err?.message || "Erro ao excluir banner.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Reordenação (Mover para Cima / Baixo)
  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= bannersList.length) return;

    const newList = [...bannersList];
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;

    newList.forEach((item, idx) => {
      item.position = idx;
    });

    setBannersList(newList);

    try {
      const orderedIds = newList.map((b) => b.id);
      await reorderBannersAction(orderedIds);
      setToast({ type: "success", message: "Ordem dos banners atualizada." });
      router.refresh();
    } catch (err: any) {
      setToast({
        type: "error",
        message: err?.message || "Erro ao reordenar banners.",
      });
    }
  };

  // Renderização de badge de link
  const renderLinkChip = (b: BannerItem) => {
    if (!b.linkType || b.linkType === "none" || !b.linkValue?.trim()) {
      return <Chip size="sm" variant="inactive" label="Sem link" />;
    }

    if (b.linkType === "product") {
      return (
        <Chip
          size="sm"
          variant="info"
          icon={<Package className="w-3 h-3 shrink-0" />}
          label="Produto"
        />
      );
    }

    if (b.linkType === "category") {
      return (
        <Chip
          size="sm"
          variant="purple"
          icon={<Tag className="w-3 h-3 shrink-0" />}
          label="Categoria"
        />
      );
    }

    return (
      <Chip
        size="sm"
        variant="warning"
        icon={<ExternalLink className="w-3 h-3 shrink-0" />}
        label="Link Externo"
      />
    );
  };

  return (
    <div className="space-y-6 w-full min-w-0 pb-16">
      {/* Toast Notification */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
          duration={3500}
        />
      )}

      {/* 1. Header Padronizado V2 */}
      {!hideHeader && (
        <PageHeader
          title="Banners"
          subtitle="Gerencie os banners exibidos em destaque no topo do seu Mini App. Suporta imagens de até 20MB."
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums bg-[#3b82f6]/15 text-[#60a5fa] border border-[#3b82f6]/30">
              {maxLimit >= 1000
                ? `${bannersList.length} ${bannersList.length === 1 ? "banner" : "banners"}`
                : `${bannersList.length} de ${maxLimit} banners`}
            </span>
          }
          actions={
            <div className="flex items-center gap-2">
              {/* Seletor de Intervalo de Rotação */}
              <div className="flex items-center gap-1.5 bg-[#16161a] border border-[#26262a] rounded-xl px-2.5 py-1.5 text-xs text-[#9a9aa2]">
                <Clock className="w-3.5 h-3.5 text-[#60a5fa] shrink-0" />
                <span className="hidden sm:inline">Transição:</span>
                <select
                  value={bannerInterval}
                  onChange={(e) => handleIntervalChange(Number(e.target.value))}
                  disabled={isSavingInterval}
                  aria-label="Intervalo de rotação do carrossel"
                  className="bg-transparent text-[#f4f4f5] font-semibold outline-none cursor-pointer"
                >
                  <option value={3} className="bg-[#16161a]">3s</option>
                  <option value={5} className="bg-[#16161a]">5s</option>
                  <option value={7} className="bg-[#16161a]">7s</option>
                  <option value={10} className="bg-[#16161a]">10s</option>
                </select>
              </div>

              {/* Botão Novo Banner */}
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
                onClick={openCreateModal}
                disabled={isLimitReached}
              >
                Novo banner
              </Button>
            </div>
          }
        />
      )}

      {/* 2. Métricas / Indicadores Compactos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total de Banners"
          value={stats.total}
          accent="blue"
          icon={<ImageIcon className="w-5 h-5" />}
          subtext={maxLimit >= 1000 ? "Sem limite no seu plano" : `Limite: ${maxLimit} banners`}
        />
        <StatCard
          label="Banners Ativos"
          value={stats.active}
          accent="green"
          icon={<CheckCircle2 className="w-5 h-5" />}
          subtext="Exibidos na loja"
        />
        <StatCard
          label="Banners Inativos"
          value={stats.inactive}
          accent="zinc"
          icon={<EyeOff className="w-5 h-5" />}
          subtext="Ocultos no Mini App"
        />
        <StatCard
          label="Transição Automática"
          value={`${stats.interval}s`}
          accent="purple"
          icon={<Clock className="w-5 h-5" />}
          subtext="Intervalo de rotação"
        />
      </div>

      {/* 3. Toolbar Completa e Responsiva */}
      <Toolbar
        searchSlot={
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery("")}
            placeholder={`Buscar por título em ${bannersList.length} banners...`}
          />
        }
        filterSlot={
          <>
            {/* Filtro por Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por Status"
              className="h-10 bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-xs text-[#f4f4f5] rounded-xl px-3 transition-colors outline-none cursor-pointer"
            >
              <option value="all">Todos os Status</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>

            {/* Filtro por Tipo de Link */}
            <select
              value={linkFilter}
              onChange={(e) => setLinkFilter(e.target.value)}
              aria-label="Filtrar por Link"
              className="h-10 bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-xs text-[#f4f4f5] rounded-xl px-3 transition-colors outline-none cursor-pointer"
            >
              <option value="all">Todos os Links</option>
              <option value="with_link">Com link direcionado</option>
              <option value="no_link">Sem link</option>
            </select>

            {/* Botão Limpar Filtros */}
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                leftIcon={<RotateCcw className="w-3.5 h-3.5 text-[#9a9aa2]" />}
                className="text-xs text-[#9a9aa2] hover:text-[#f4f4f5]"
              >
                Limpar ({activeFiltersCount})
              </Button>
            )}
          </>
        }
        actionSlot={
          <div className="flex items-center gap-2">
            {/* Contador de resultados */}
            <span className="text-xs text-[#71717a] tabular-nums hidden sm:inline-block">
              {filteredBanners.length} de {bannersList.length}
            </span>

            {/* Alternador de visualização Grid / List */}
            <div className="flex items-center bg-[#16161a] p-1 rounded-xl border border-[#26262a]">
              <IconButton
                size="sm"
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                icon={<LayoutGrid className="w-4 h-4" />}
                aria-label="Visualização em Grade"
                onClick={() => setViewMode("grid")}
                className={viewMode === "grid" ? "bg-[#26262a] text-white" : "text-[#71717a]"}
              />
              <IconButton
                size="sm"
                variant={viewMode === "list" ? "secondary" : "ghost"}
                icon={<List className="w-4 h-4" />}
                aria-label="Visualização em Lista"
                onClick={() => setViewMode("list")}
                className={viewMode === "list" ? "bg-[#26262a] text-white" : "text-[#71717a]"}
              />
            </div>
          </div>
        }
      />

      {/* 4. Conteúdo: Grade, Lista ou Empty State */}
      {filteredBanners.length === 0 ? (
        <EmptyState
          icon={bannersList.length === 0 ? <ImageIcon className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
          title={bannersList.length === 0 ? "Nenhum banner cadastrado" : "Nenhum banner encontrado"}
          description={
            bannersList.length === 0
              ? "Cadastre seu primeiro banner para destacar promoções, novidades e produtos no topo da sua loja."
              : "Nenhum banner corresponde aos termos da busca ou filtros selecionados. Tente ajustar os filtros."
          }
          action={
            bannersList.length === 0
              ? {
                  label: "Novo banner",
                  icon: <Plus className="w-4 h-4" />,
                  onClick: openCreateModal,
                }
              : {
                  label: "Limpar filtros",
                  icon: <RotateCcw className="w-4 h-4" />,
                  onClick: handleClearFilters,
                }
          }
        />
      ) : viewMode === "grid" ? (
        /* Visualização em Grade */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBanners.map((banner, index) => {
            const isFirst = index === 0;
            const isLast = index === bannersList.length - 1;

            const menuItems = [
              {
                id: "edit",
                label: "Editar banner",
                icon: <Edit3 className="w-4 h-4 text-[#9a9aa2]" />,
                onClick: () => openEditModal(banner),
              },
              {
                id: "toggle",
                label: banner.status === "active" ? "Desativar banner" : "Ativar banner",
                icon: <Power className="w-4 h-4 text-[#9a9aa2]" />,
                onClick: () => handleToggleStatus(banner),
              },
              {
                id: "delete",
                label: "Excluir banner",
                icon: <Trash2 className="w-4 h-4 text-[#f87171]" />,
                danger: true,
                onClick: () => setBannerToDelete(banner),
              },
            ];

            return (
              <Card
                key={banner.id}
                padding="none"
                interactive
                className="flex flex-col justify-between overflow-hidden group space-y-0"
              >
                {/* Imagem do Banner (Aspect Ratio 16:9) */}
                <div className="relative aspect-[16/9] w-full bg-[#16161a] overflow-hidden border-b border-[#26262a]">
                  {banner.imageUrl ? (
                    <img
                      src={banner.imageUrl}
                      alt={banner.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#71717a] gap-1">
                      <ImageIcon className="w-8 h-8 text-[#52525b]" />
                      <span className="text-[10px]">Sem imagem</span>
                    </div>
                  )}

                  {/* Badges Superiores */}
                  <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white tabular-nums">
                      #{index + 1}
                    </span>
                  </div>

                  <div className="absolute top-2.5 right-2.5 z-10">
                    {banner.status === "active" ? (
                      <Chip size="sm" variant="active" label="Ativo" />
                    ) : (
                      <Chip size="sm" variant="inactive" label="Inativo" />
                    )}
                  </div>
                </div>

                {/* Corpo do Card */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <h3 className="text-[#f4f4f5] font-bold text-sm truncate" title={banner.title}>
                      {banner.title}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {renderLinkChip(banner)}
                      {banner.linkValue && (
                        <span className="text-[11px] text-[#71717a] truncate max-w-[150px]" title={banner.linkValue}>
                          {banner.linkValue}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rodapé do Card: Reordenação + Ações */}
                  <div className="pt-3 border-t border-[#26262a] flex items-center justify-between gap-2">
                    {/* Botões de Ordem (Subir / Descer) */}
                    <div className="flex items-center gap-1 bg-[#16161a] p-0.5 rounded-lg border border-[#26262a]">
                      <IconButton
                        size="sm"
                        variant="ghost"
                        icon={<ArrowUp className="w-3.5 h-3.5" />}
                        aria-label="Mover para cima"
                        disabled={isFirst}
                        onClick={() => handleMove(index, "up")}
                      />
                      <IconButton
                        size="sm"
                        variant="ghost"
                        icon={<ArrowDown className="w-3.5 h-3.5" />}
                        aria-label="Mover para baixo"
                        disabled={isLast}
                        onClick={() => handleMove(index, "down")}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEditModal(banner)}
                        leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                        className="text-xs"
                      >
                        Editar
                      </Button>
                      <RowMenu items={menuItems} ariaLabel={`Ações para banner ${banner.title}`} />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Visualização em Lista / Tabela */
        <Card padding="none" className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-[#26262a] bg-[#111113] text-[11px] uppercase tracking-wider text-[#9a9aa2] font-semibold">
                <th className="py-3.5 px-4 text-center w-16">Ordem</th>
                <th className="py-3.5 px-4 w-28">Preview</th>
                <th className="py-3.5 px-6">Título</th>
                <th className="py-3.5 px-4">Destino / Link</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26262a] text-xs">
              {filteredBanners.map((banner, index) => {
                const isFirst = index === 0;
                const isLast = index === bannersList.length - 1;

                const menuItems = [
                  {
                    id: "edit",
                    label: "Editar banner",
                    icon: <Edit3 className="w-4 h-4 text-[#9a9aa2]" />,
                    onClick: () => openEditModal(banner),
                  },
                  {
                    id: "toggle",
                    label: banner.status === "active" ? "Desativar banner" : "Ativar banner",
                    icon: <Power className="w-4 h-4 text-[#9a9aa2]" />,
                    onClick: () => handleToggleStatus(banner),
                  },
                  {
                    id: "delete",
                    label: "Excluir banner",
                    icon: <Trash2 className="w-4 h-4 text-[#f87171]" />,
                    danger: true,
                    onClick: () => setBannerToDelete(banner),
                  },
                ];

                return (
                  <tr key={banner.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Controles de Ordem */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <IconButton
                          size="sm"
                          variant="ghost"
                          icon={<ArrowUp className="w-3.5 h-3.5" />}
                          aria-label="Mover para cima"
                          disabled={isFirst}
                          onClick={() => handleMove(index, "up")}
                        />
                        <IconButton
                          size="sm"
                          variant="ghost"
                          icon={<ArrowDown className="w-3.5 h-3.5" />}
                          aria-label="Mover para baixo"
                          disabled={isLast}
                          onClick={() => handleMove(index, "down")}
                        />
                      </div>
                    </td>

                    {/* Preview Thumbnail */}
                    <td className="py-4 px-4">
                      <div className="aspect-[16/9] w-24 rounded-lg bg-[#16161a] border border-[#26262a] overflow-hidden relative">
                        {banner.imageUrl ? (
                          <img
                            src={banner.imageUrl}
                            alt={banner.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#71717a]">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Título */}
                    <td className="py-4 px-6">
                      <span className="font-bold text-[#f4f4f5] text-sm truncate block max-w-xs">
                        {banner.title}
                      </span>
                    </td>

                    {/* Link */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {renderLinkChip(banner)}
                        {banner.linkValue && (
                          <span className="text-[11px] text-[#71717a] truncate max-w-xs">
                            {banner.linkValue}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status Toggle */}
                    <td className="py-4 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(banner)}
                        disabled={togglingId === banner.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                          banner.status === "active"
                            ? "bg-[#22c55e]/10 text-[#4ade80] border border-[#22c55e]/30 hover:bg-[#22c55e]/20"
                            : "bg-white/[0.04] text-[#71717a] border border-white/[0.08] hover:bg-white/[0.08]"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            banner.status === "active" ? "bg-[#22c55e] animate-pulse" : "bg-[#71717a]"
                          }`}
                        />
                        {banner.status === "active" ? "Ativo" : "Inativo"}
                      </button>
                    </td>

                    {/* Ações */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditModal(banner)}
                          leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                          className="text-xs"
                        >
                          Editar
                        </Button>
                        <RowMenu items={menuItems} ariaLabel={`Ações para banner ${banner.title}`} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* 5. Modal de Criação / Edição de Banner V2 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#0e0e10] border border-[#26262a] rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Título do Modal */}
            <div className="flex items-center justify-between border-b border-[#26262a] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center text-[#60a5fa]">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#f4f4f5]">
                    {editingBanner ? "Editar Banner" : "Novo Banner"}
                  </h3>
                  <p className="text-xs text-[#9a9aa2]">
                    Dimensão recomendada: 1200x540 px (proporção ~2.2:1 / 16:9). Suporta até 20MB.
                  </p>
                </div>
              </div>
              <IconButton
                size="sm"
                variant="ghost"
                icon={<X className="w-4 h-4" />}
                aria-label="Fechar modal"
                onClick={() => setIsModalOpen(false)}
              />
            </div>

            {/* Mensagem de Erro */}
            {formError && (
              <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#f87171] p-3.5 rounded-xl text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#f87171]" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Título do Banner */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#f4f4f5]">
                  Título ou Identificador <span className="text-[#71717a] font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Promoção de Inverno"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-[#f4f4f5] text-xs placeholder:text-[#52525b] outline-none transition-colors"
                />
              </div>

              {/* Seletor de Modo de Imagem: Upload vs URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#f4f4f5]">
                  Imagem do Banner <span className="text-[#ef4444]">*</span>
                </label>
                <SegmentedControl
                  value={inputMode}
                  onChange={(val) => setInputMode(val as "upload" | "url")}
                  fullWidth
                  options={[
                    { id: "upload", label: "Upload de Arquivo", icon: <Upload className="w-3.5 h-3.5" /> },
                    { id: "url", label: "URL Direta", icon: <LinkIcon className="w-3.5 h-3.5" /> },
                  ]}
                />
              </div>

              {/* Input de Upload ou URL */}
              {inputMode === "upload" ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="banner_file_upload"
                    />
                    <label
                      htmlFor="banner_file_upload"
                      className="flex-1 cursor-pointer bg-[#16161a] hover:bg-[#1f1f24] border border-[#26262a] hover:border-[#3a3a40] rounded-xl px-4 py-3 text-xs text-[#f4f4f5] flex items-center justify-center gap-2 transition-all font-semibold"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#3b82f6]" />
                          <span>Processando imagem...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-[#60a5fa]" />
                          <span>{selectedFileName ? `Arquivo: ${selectedFileName} (${selectedFileSizeMB}MB)` : "Selecionar imagem do computador (máx. 20MB)"}</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="url"
                    placeholder="https://exemplo.com/banner.webp"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-[#f4f4f5] text-xs font-mono placeholder:text-[#52525b] outline-none transition-colors"
                  />
                </div>
              )}

              {/* Preview 16:9 */}
              <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden border border-[#26262a] bg-[#16161a] flex items-center justify-center">
                {formData.imageUrl ? (
                  <img
                    src={formData.imageUrl}
                    alt="Preview Banner"
                    className="w-full h-full object-cover"
                    onError={() => {
                      setFormError("URL de imagem inválida ou inacessível.");
                    }}
                  />
                ) : (
                  <div className="text-center p-4 space-y-1">
                    <ImageIcon className="w-6 h-6 text-[#52525b] mx-auto" />
                    <p className="text-xs text-[#71717a]">Nenhuma imagem selecionada</p>
                  </div>
                )}
              </div>

              {/* Configuração de Destino do Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#f4f4f5]">Ação ao Clicar</label>
                  <select
                    value={formData.linkType}
                    onChange={(e) => setFormData((prev) => ({ ...prev, linkType: e.target.value }))}
                    className="w-full h-10 bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-xs text-[#f4f4f5] rounded-xl px-3 outline-none cursor-pointer"
                  >
                    <option value="none">Nenhum link</option>
                    <option value="product">Abrir Produto</option>
                    <option value="category">Abrir Categoria</option>
                    <option value="external">Link Externo</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#f4f4f5]">
                    {formData.linkType === "product"
                      ? "ID do Produto"
                      : formData.linkType === "category"
                      ? "ID da Categoria"
                      : formData.linkType === "external"
                      ? "URL Externa"
                      : "Destino"}
                  </label>
                  <input
                    type="text"
                    disabled={formData.linkType === "none"}
                    placeholder={
                      formData.linkType === "product"
                        ? "Ex: prod-uuid"
                        : formData.linkType === "category"
                        ? "Ex: cat-uuid"
                        : formData.linkType === "external"
                        ? "https://..."
                        : "Sem destino"
                    }
                    value={formData.linkValue}
                    onChange={(e) => setFormData((prev) => ({ ...prev, linkValue: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-[#f4f4f5] text-xs placeholder:text-[#52525b] outline-none transition-colors disabled:opacity-40"
                  />
                </div>
              </div>

              {/* Botões do Rodapé */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#26262a]">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSubmitting}
                >
                  {editingBanner ? "Salvar alterações" : "Cadastrar banner"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal de Confirmação de Exclusão */}
      <ConfirmDialog
        isOpen={Boolean(bannerToDelete)}
        onClose={() => setBannerToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Banner"
        description={
          bannerToDelete ? (
            <span>
              Tem certeza que deseja excluir o banner{" "}
              <strong className="text-[#f4f4f5]">"{bannerToDelete.title}"</strong>? Esta ação é irreversível
              e removerá o banner imediatamente do topo do seu Mini App.
            </span>
          ) : (
            ""
          )
        }
        confirmLabel="Excluir banner"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

