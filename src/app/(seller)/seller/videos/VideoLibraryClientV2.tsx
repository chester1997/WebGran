"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Film,
  Plus,
  Trash2,
  Eye,
  Edit2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Upload,
  RefreshCw,
  HardDrive,
  Check,
  Play,
  LayoutGrid,
  List,
  AlertTriangle,
  Layers,
  CloudUpload,
  Sparkles,
  Link as LinkIcon,
  Pause,
  RotateCcw,
  Clock,
  Power,
  ExternalLink,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  Toolbar,
  SearchInput,
  Button,
  IconButton,
  Card,
  Chip,
  RowMenu,
  EmptyState,
  ConfirmDialog,
  Toast,
} from "@/components/seller-v2";
import { ProductVideoPlayer } from "@/components/miniapp/ProductVideoPlayer";
import { VideoPlanUpgradeModal } from "@/components/billing/VideoPlanUpgradeModal";
import { InlineVideoLibraryOnboarding } from "./InlineVideoLibraryOnboarding";
import { GenerateDeepLinkModal } from "@/components/seller/GenerateDeepLinkModal";
import { BatchUploadQueue, BatchUploadItem } from "@/lib/upload/batch-upload-manager";

export interface LibraryVideoItem {
  id: string;
  storeId: string;
  bunnyVideoId: string;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  thumbnailUrl: string | null;
  status: string; // 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED'
  active: boolean;
  createdAt: string;
  updatedAt: string;
  assignmentCount?: number;
  assignedProductsCount?: number;
  assignments?: {
    id: string;
    productId: string;
    productTitle?: string;
  }[];
}

export interface VideoStorageUsage {
  usedBytes: number;
  quotaBytes: number;
  reservedBytes: number;
  usedGB: number;
  quotaGB: number;
  freeGB: number;
  percentage: number;
  hasVideoSubscription?: boolean;
  planName?: string | null;
  planPriceCents?: number | null;
  isUnlimited?: boolean;
}

export interface VideoLibraryClientV2Props {
  initialVideos: LibraryVideoItem[];
  initialUsage: VideoStorageUsage;
  hideHeader?: boolean;
}

const GB = 1024 * 1024 * 1024;
const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function normalizeUsage(raw: any): VideoStorageUsage {
  const r = raw || {};
  const usedBytes = num(r.usedBytes);
  const reservedBytes = num(r.reservedBytes);
  const quotaGB = num(r.quotaGB ?? r.quotaGb, 50) || 50;
  const quotaBytes = num(r.quotaBytes, quotaGB * GB) || quotaGB * GB;
  const usedGB = num(r.usedGB, usedBytes / GB);
  const freeGB =
    r.freeGB !== undefined
      ? num(r.freeGB)
      : r.remainingBytes !== undefined && r.remainingBytes !== null
      ? num(r.remainingBytes) / GB
      : Math.max(0, quotaGB - usedGB);
  const percentage = num(r.percentage ?? r.percentUsed);
  const isUnlimited = Boolean(r.isUnlimited);
  const hasVideoSubscription = Boolean(r.hasVideoSubscription ?? isUnlimited);
  const planName = r.planName || (isUnlimited ? "PROPRIETÁRIO / ILIMITADO" : null);
  const planPriceCents = r.planPriceCents || null;

  return {
    usedBytes,
    quotaBytes,
    reservedBytes,
    usedGB,
    quotaGB,
    freeGB,
    percentage,
    hasVideoSubscription,
    planName,
    planPriceCents,
    isUnlimited,
  };
}

export default function VideoLibraryClientV2({
  initialVideos,
  initialUsage,
  hideHeader = false,
}: VideoLibraryClientV2Props) {
  const [videosList, setVideosList] = useState<LibraryVideoItem[]>(initialVideos);
  const [usage, setUsage] = useState<VideoStorageUsage>(() => normalizeUsage(initialUsage));
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filtros & Visualização
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Feedback Toasts
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Modais de Upgrade & Deep Link
  const [isVideoPlanModalOpen, setIsVideoPlanModalOpen] = useState(false);
  const [deepLinkModalVideo, setDeepLinkModalVideo] = useState<LibraryVideoItem | null>(null);

  // Upload em Lote (Batch)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchUploadItem[]>([]);
  const [isQueuePaused, setIsQueuePaused] = useState(false);
  const [rejectedFilesMessages, setRejectedFilesMessages] = useState<string[]>([]);
  const queueRef = useRef<BatchUploadQueue | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edição
  const [editingVideo, setEditingVideo] = useState<LibraryVideoItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Exclusão Unitária
  const [deletingVideo, setDeletingVideo] = useState<LibraryVideoItem | null>(null);
  const [deleteWarningInfo, setDeleteWarningInfo] = useState<{
    isAssigned?: boolean;
    isBlockedActiveAccesses?: boolean;
    activeAccessCount?: number;
    message?: string;
    assignedCount: number;
    products: { id: string; title: string }[];
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Exclusão em Massa (Bulk Delete)
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Preview Player
  const [previewVideo, setPreviewVideo] = useState<LibraryVideoItem | null>(null);
  const [previewPlayback, setPreviewPlayback] = useState<{ playbackUrl: string; directUrl: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Atualização de dados da API
  const refreshData = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch("/api/seller/videos");
      const data = await res.json();
      if (data.success) {
        setVideosList(Array.isArray(data.videos) ? data.videos : []);
        if (data.usage) setUsage(normalizeUsage(data.usage));
      }
    } catch (err) {
      console.error("[VideoLibraryClientV2] Refresh Error:", err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  // Polling automático para vídeos em processamento
  const hasPendingVideos = useMemo(
    () => videosList.some((v) => v.status === "UPLOADING" || v.status === "PROCESSING"),
    [videosList]
  );

  useEffect(() => {
    if (!hasPendingVideos) return;
    const interval = setInterval(() => {
      refreshData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [hasPendingVideos]);

  // Inicialização da fila de upload em lote
  useEffect(() => {
    if (!queueRef.current) {
      const freeBytes = usage.isUnlimited
        ? Number.MAX_SAFE_INTEGER
        : Math.max(0, usage.quotaBytes - usage.usedBytes - usage.reservedBytes);

      queueRef.current = new BatchUploadQueue({
        freeQuotaBytes: freeBytes,
        onQueueUpdate: (items) => {
          setBatchItems([...items]);
        },
        onItemUpdate: (item) => {
          if (queueRef.current) {
            setBatchItems(queueRef.current.getItems());
          }
          if (
            item.status === "CREATING_SESSION" ||
            item.status === "UPLOADING" ||
            item.status === "PROCESSING" ||
            item.status === "READY"
          ) {
            refreshData(true);
          }
        },
        onComplete: () => {
          const currentItems = queueRef.current ? queueRef.current.getItems() : [];
          const hasItems = currentItems.length > 0;
          const hasFailures = currentItems.some(
            (it) => it.status === "FAILED" || it.status === "CANCELED"
          );
          const allSuccessfulUploads =
            hasItems &&
            currentItems.every(
              (it) => it.status === "PROCESSING" || it.status === "READY"
            );

          refreshData(true);

          if (allSuccessfulUploads) {
            setIsUploadModalOpen(false);
            setToast({
              type: "success",
              message: "Uploads concluídos! O processamento continua na biblioteca.",
            });
          } else if (hasFailures) {
            setToast({
              type: "error",
              message: "Alguns uploads falharam. Verifique os itens no gerenciador.",
            });
          }
        },
      });
    }
  }, []);

  // Atualizar cota livre na fila
  useEffect(() => {
    if (queueRef.current) {
      const freeBytes = usage.isUnlimited
        ? Number.MAX_SAFE_INTEGER
        : Math.max(0, usage.quotaBytes - usage.usedBytes - usage.reservedBytes);
      queueRef.current.updateFreeQuota(freeBytes);
    }
  }, [usage.quotaBytes, usage.usedBytes, usage.reservedBytes, usage.isUnlimited]);

  // Contagens e KPIs
  const stats = useMemo(() => {
    const total = videosList.length;
    const ready = videosList.filter((v) => v.status === "READY").length;
    const processing = videosList.filter(
      (v) => v.status === "PROCESSING" || v.status === "UPLOADING"
    ).length;
    const failed = videosList.filter((v) => v.status === "FAILED").length;
    const active = videosList.filter((v) => v.active !== false).length;
    const inactive = videosList.filter((v) => v.active === false).length;
    return { total, ready, processing, failed, active, inactive };
  }, [videosList]);

  // Filtragem
  const filteredVideos = useMemo(() => {
    return videosList.filter((video) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        video.title.toLowerCase().includes(query) ||
        (video.description && video.description.toLowerCase().includes(query)) ||
        video.id.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" ? true : video.status === statusFilter;

      const matchesActive =
        activeFilter === "ALL"
          ? true
          : activeFilter === "ACTIVE"
          ? video.active !== false
          : video.active === false;

      return matchesSearch && matchesStatus && matchesActive;
    });
  }, [videosList, searchQuery, statusFilter, activeFilter]);

  // Contagem de filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (statusFilter !== "ALL") count++;
    if (activeFilter !== "ALL") count++;
    return count;
  }, [searchQuery, statusFilter, activeFilter]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setActiveFilter("ALL");
  };

  // Handlers de Upload em Lote
  const handleMultipleFilesSelect = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    const filesArray = Array.from(filesList);
    setRejectedFilesMessages([]);

    if (queueRef.current) {
      const res = queueRef.current.addFiles(filesArray);
      if (res.rejected.length > 0) {
        setRejectedFilesMessages(res.rejected);
      }
    }
  };

  const handleStartBatchQueue = () => {
    if (queueRef.current) {
      setIsQueuePaused(false);
      queueRef.current.start();
    }
  };

  const handlePauseBatchQueue = () => {
    if (queueRef.current) {
      setIsQueuePaused(true);
      queueRef.current.pause();
    }
  };

  const handleRemoveBatchItem = (id: string) => {
    if (queueRef.current) queueRef.current.removeItem(id);
  };

  const handleRetryBatchItem = (id: string) => {
    if (queueRef.current) queueRef.current.retryItem(id);
  };

  // Handlers de Edição
  const handleOpenEdit = (video: LibraryVideoItem) => {
    setEditingVideo(video);
    setEditTitle(video.title);
    setEditDescription(video.description || "");
  };

  const handleSaveEdit = async () => {
    if (!editingVideo) return;
    if (!editTitle.trim()) {
      setToast({ type: "error", message: "O título do vídeo não pode ficar vazio." });
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/seller/videos/${editingVideo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Erro ao atualizar vídeo.");
      }

      setToast({ type: "success", message: "Vídeo atualizado com sucesso!" });
      setEditingVideo(null);
      refreshData();
    } catch (err: any) {
      setToast({ type: "error", message: err.message || "Erro ao salvar alterações." });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Alternar Ativo/Inativo
  const handleToggleActive = async (video: LibraryVideoItem) => {
    const newActiveState = video.active === false ? true : false;
    try {
      const res = await fetch(`/api/seller/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newActiveState }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Erro ao alterar visibilidade do vídeo.");
      }
      setVideosList((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, active: newActiveState } : v))
      );
      setToast({
        type: "success",
        message: `Vídeo ${newActiveState ? "ativado" : "desativado"} com sucesso.`,
      });
    } catch (err: any) {
      setToast({ type: "error", message: err.message || "Erro ao atualizar status." });
    }
  };

  // Exclusão Unitária
  const handleOpenDelete = (video: LibraryVideoItem) => {
    setDeletingVideo(video);
    const assignedCount =
      video.assignedProductsCount || video.assignmentCount || video.assignments?.length || 0;
    if (assignedCount > 0) {
      setDeleteWarningInfo({
        isAssigned: true,
        assignedCount,
        products:
          video.assignments?.map((a) => ({
            id: a.productId,
            title: a.productTitle || "Produto vinculado",
          })) || [],
      });
    } else {
      setDeleteWarningInfo(null);
    }
  };

  const handleConfirmDelete = async (force = false) => {
    if (!deletingVideo) return;
    setIsDeleting(true);

    if (queueRef.current) {
      const queueItems = queueRef.current.getItems();
      const matched = queueItems.find(
        (it) => it.videoId === deletingVideo.id || it.bunnyVideoId === deletingVideo.bunnyVideoId
      );
      if (
        matched &&
        (matched.status === "UPLOADING" ||
          matched.status === "CREATING_SESSION" ||
          matched.status === "QUEUED")
      ) {
        queueRef.current.cancelItem(matched.id);
      }
    }

    try {
      const res = await fetch(`/api/seller/videos/${deletingVideo.id}?force=${force ? "true" : "false"}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.code === "BLOCKED_ACTIVE_ACCESSES") {
          setDeleteWarningInfo({
            isBlockedActiveAccesses: true,
            activeAccessCount: data.activeAccessCount || 1,
            assignedCount: data.assignedCount || data.products?.length || 0,
            products: data.products || [],
            message: data.message,
          });
          setIsDeleting(false);
          return;
        }

        if (data.isAssigned || data.code === "LINKED_TO_PRODUCTS") {
          setDeleteWarningInfo({
            isAssigned: true,
            assignedCount: data.assignedCount,
            products: data.products || [],
          });
          setIsDeleting(false);
          return;
        }
        throw new Error(data.error || data.message || "Erro ao excluir vídeo.");
      }

      setToast({ type: "success", message: "Vídeo excluído da biblioteca!" });
      setSelectedVideoIds((prev) => {
        const next = new Set(prev);
        next.delete(deletingVideo.id);
        return next;
      });
      setDeletingVideo(null);
      setDeleteWarningInfo(null);
      refreshData();
    } catch (err: any) {
      setToast({ type: "error", message: err.message || "Erro ao excluir vídeo." });
    } finally {
      setIsDeleting(false);
    }
  };

  // Exclusão em Massa (Bulk)
  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        if (next.size >= 50) {
          setToast({ type: "error", message: "Limite máximo de 50 vídeos por lote atingido." });
          return next;
        }
        next.add(id);
      }
      return next;
    });
  };

  const isAllFilteredSelected =
    filteredVideos.length > 0 && filteredVideos.every((v) => selectedVideoIds.has(v.id));

  const handleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      setSelectedVideoIds((prev) => {
        const next = new Set(prev);
        filteredVideos.forEach((v) => next.delete(v.id));
        return next;
      });
    } else {
      setSelectedVideoIds((prev) => {
        const next = new Set(prev);
        for (const v of filteredVideos) {
          if (next.size >= 50) break;
          next.add(v.id);
        }
        return next;
      });
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedVideoIds.size === 0) return;
    setIsBulkDeleting(true);

    try {
      const videoIdsArray = Array.from(selectedVideoIds).slice(0, 50);
      const res = await fetch("/api/seller/videos/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoIds: videoIdsArray, force: true }),
      });

      const data = await res.json();
      if (!data.results && !data.success && data.error) {
        throw new Error(data.error);
      }

      setToast({
        type: "success",
        message: `${data.successCount || 0} vídeo(s) excluído(s) com sucesso.`,
      });
      setSelectedVideoIds(new Set());
      setIsBulkDeleteModalOpen(false);
      refreshData();
    } catch (err: any) {
      setToast({ type: "error", message: err.message || "Erro na exclusão em lote." });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Preview Player
  const handleOpenPreview = async (video: LibraryVideoItem) => {
    if (video.status !== "READY") {
      setToast({ type: "info", message: "Este vídeo ainda está sendo processado." });
      return;
    }
    setPreviewVideo(video);
    setIsLoadingPreview(true);
    setPreviewPlayback(null);

    try {
      const res = await fetch(`/api/seller/videos/${video.id}/preview`);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Falha ao carregar preview do vídeo.");
      }
      setPreviewPlayback(data.playback);
    } catch (err: any) {
      setToast({ type: "error", message: err.message || "Erro ao abrir preview." });
      setPreviewVideo(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Format Helpers
  const formatDuration = (seconds: number | null) => {
    if (!seconds || seconds <= 0) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes || bytes <= 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  // Se não possuir plano de vídeo e não for ilimitado, renderiza tela de contratação
  if (!usage.hasVideoSubscription && !usage.isUnlimited) {
    return (
      <div className="w-full space-y-6 pb-16">
        {!hideHeader && (
          <PageHeader
            title="Biblioteca de Vídeos"
            subtitle="Habilite o armazenamento em nuvem para entregar conteúdos e vídeos aos seus clientes."
          />
        )}
        <InlineVideoLibraryOnboarding onSubscriptionSuccess={() => refreshData()} />
      </div>
    );
  }

  const isUnlimited = Boolean(usage.isUnlimited);
  const isOverQuota = !isUnlimited && usage.usedGB > usage.quotaGB;
  const isFull = !isUnlimited && (usage.percentage >= 100 || isOverQuota);
  const isNearFull = !isUnlimited && usage.percentage >= 90 && usage.percentage < 100;

  return (
    <div className="space-y-6 w-full min-w-0 pb-16">
      {/* 1. Header Padronizado V2 */}
      {!hideHeader && (
        <PageHeader
          title="Biblioteca de Vídeos"
          subtitle="Gerencie seus vídeos na nuvem com entrega segura e streaming de alta velocidade."
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums bg-blue-500/15 text-blue-400 border border-blue-500/30">
              {stats.total} {stats.total === 1 ? "vídeo cadastrado" : "vídeos cadastrados"}
            </span>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-400" : ""}`} />}
                onClick={() => refreshData()}
                disabled={isRefreshing}
                className="text-xs"
              >
                Atualizar
              </Button>
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
                onClick={() => setIsUploadModalOpen(true)}
              >
                Adicionar vídeo
              </Button>
            </div>
          }
        />
      )}

      {/* 2. Barra de Armazenamento V2 */}
      <Card padding="md" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#f4f4f5]">
            <HardDrive className="w-4 h-4 text-blue-400" />
            <span>PLANO: {usage.planName || (isUnlimited ? "PROPRIETÁRIO / ILIMITADO" : "ATIVO")}</span>
            {usage.planPriceCents && (
              <span className="text-[11px] text-[#71717a] font-normal">
                (R$ {(usage.planPriceCents / 100).toFixed(2).replace(".", ",")} / mês)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[#f4f4f5] font-bold">
              {usage.usedGB.toFixed(1)} GB / {isUnlimited ? "ILIMITADO" : `${usage.quotaGB} GB`}
            </span>
            {!isUnlimited && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Sparkles className="w-3.5 h-3.5 text-blue-400" />}
                onClick={() => setIsVideoPlanModalOpen(true)}
                className="text-xs"
              >
                Fazer upgrade
              </Button>
            )}
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="w-full bg-[#16161a] border border-[#26262a] rounded-full h-2.5 overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isFull ? "bg-red-500 animate-pulse" : isNearFull ? "bg-amber-500" : "bg-blue-500"
            }`}
            style={{ width: `${isUnlimited ? 100 : Math.min(Math.max(usage.percentage, 1), 100)}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-xs text-[#71717a] font-mono">
          <span>{isUnlimited ? "Uso sem restrições de quota" : `${usage.percentage.toFixed(1)}% utilizado`}</span>
          <span>{isUnlimited ? "Ilimitado" : `${usage.freeGB.toFixed(1)} GB disponíveis`}</span>
        </div>
      </Card>

      {/* 3. Métricas / StatCards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total de Vídeos"
          value={stats.total}
          accent="blue"
          icon={<Film className="w-5 h-5" />}
          subtext="Vídeos na biblioteca"
        />
        <StatCard
          label="Vídeos Prontos"
          value={stats.ready}
          accent="green"
          icon={<CheckCircle2 className="w-5 h-5" />}
          subtext="Prontos para streaming"
        />
        <StatCard
          label="Em Processamento"
          value={stats.processing}
          accent="amber"
          icon={<Loader2 className="w-5 h-5" />}
          subtext="Aguardando otimização"
        />
        <StatCard
          label="Armazenamento"
          value={`${usage.usedGB.toFixed(1)} GB`}
          accent="purple"
          icon={<HardDrive className="w-5 h-5" />}
          subtext={isUnlimited ? "Plano ilimitado" : `${usage.freeGB.toFixed(1)} GB livres`}
        />
      </div>

      {/* 4. Toolbar Completa */}
      <Toolbar
        searchSlot={
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery("")}
            placeholder={`Buscar em ${videosList.length} vídeos por título ou descrição...`}
          />
        }
        filterSlot={
          <>
            {/* Filtro por Status Bunny */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por Status"
              className="h-10 bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-xs text-[#f4f4f5] rounded-xl px-3 transition-colors outline-none cursor-pointer"
            >
              <option value="ALL">Todos os status</option>
              <option value="READY">Prontos</option>
              <option value="PROCESSING">Processando</option>
              <option value="UPLOADING">Enviando</option>
              <option value="FAILED">Com Erro</option>
            </select>

            {/* Filtro por Visibilidade */}
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              aria-label="Filtrar por Visibilidade"
              className="h-10 bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-xs text-[#f4f4f5] rounded-xl px-3 transition-colors outline-none cursor-pointer"
            >
              <option value="ALL">Todas visibilidades</option>
              <option value="ACTIVE">Ativos</option>
              <option value="INACTIVE">Inativos</option>
            </select>

            {/* Botão Selecionar Todos Exibidos */}
            {filteredVideos.length > 0 && (
              <Button
                variant={isAllFilteredSelected ? "secondary" : "ghost"}
                size="sm"
                onClick={handleSelectAllFiltered}
                leftIcon={<Check className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                {isAllFilteredSelected ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            )}

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
            <span className="text-xs text-[#71717a] tabular-nums hidden sm:inline-block">
              {filteredVideos.length} de {videosList.length}
            </span>
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

      {/* Floating Action Bar para Exclusão em Massa */}
      {selectedVideoIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#16161a]/95 border border-red-500/40 backdrop-blur-xl px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2 text-white font-semibold">
            <span className="w-6 h-6 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400 font-mono font-bold flex items-center justify-center text-xs">
              {selectedVideoIds.size}
            </span>
            <span>{selectedVideoIds.size === 1 ? "vídeo selecionado" : "vídeos selecionados"}</span>
          </div>

          <div className="h-4 w-px bg-[#26262a]" />

          <button
            onClick={() => setSelectedVideoIds(new Set())}
            className="text-[#9a9aa2] hover:text-white transition px-2 py-1 rounded-lg hover:bg-white/5 font-medium cursor-pointer"
          >
            Desmarcar todos
          </button>

          <Button
            variant="danger"
            size="sm"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => setIsBulkDeleteModalOpen(true)}
          >
            Excluir selecionados
          </Button>
        </div>
      )}

      {/* 5. Conteúdo: Grade, Lista ou Estado Vazio */}
      {filteredVideos.length === 0 ? (
        <EmptyState
          icon={videosList.length === 0 ? <Film className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
          title={videosList.length === 0 ? "Nenhum vídeo na biblioteca" : "Nenhum vídeo encontrado"}
          description={
            videosList.length === 0
              ? "Faça upload dos seus primeiros vídeos para utilizá-los na entrega e catálogo de produtos digitais."
              : "Nenhum vídeo corresponde aos termos da busca ou aos filtros aplicados. Tente ajustar os filtros."
          }
          action={
            videosList.length === 0
              ? {
                  label: "Adicionar primeiro vídeo",
                  icon: <Plus className="w-4 h-4" />,
                  onClick: () => setIsUploadModalOpen(true),
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredVideos.map((video) => {
            const isReady = video.status === "READY";
            const isProcessing = video.status === "PROCESSING";
            const isUploading = video.status === "UPLOADING";
            const isFailed = video.status === "FAILED";
            const isSelected = selectedVideoIds.has(video.id);
            const assignedCount =
              video.assignedProductsCount || video.assignmentCount || video.assignments?.length || 0;

            const menuItems = [
              ...(isReady
                ? [
                    {
                      id: "preview",
                      label: "Visualizar vídeo",
                      icon: <Play className="w-4 h-4 text-blue-400" />,
                      onClick: () => handleOpenPreview(video),
                    },
                    {
                      id: "deeplink",
                      label: "Gerar Deep Link",
                      icon: <LinkIcon className="w-4 h-4 text-purple-400" />,
                      onClick: () => setDeepLinkModalVideo(video),
                    },
                  ]
                : []),
              {
                id: "edit",
                label: "Editar detalhes",
                icon: <Edit2 className="w-4 h-4 text-[#9a9aa2]" />,
                onClick: () => handleOpenEdit(video),
              },
              {
                id: "toggle-active",
                label: video.active !== false ? "Desativar vídeo" : "Ativar vídeo",
                icon: <Power className="w-4 h-4 text-[#9a9aa2]" />,
                onClick: () => handleToggleActive(video),
              },
              {
                id: "delete",
                label: "Excluir vídeo",
                icon: <Trash2 className="w-4 h-4 text-[#f87171]" />,
                danger: true,
                onClick: () => handleOpenDelete(video),
              },
            ];

            return (
              <Card
                key={video.id}
                padding="none"
                interactive
                className={`flex flex-col justify-between overflow-hidden group space-y-0 ${
                  isSelected ? "border-red-500/50 bg-red-950/10" : ""
                }`}
              >
                {/* Thumbnail 16:9 */}
                <div
                  className="relative aspect-video w-full bg-[#16161a] overflow-hidden border-b border-[#26262a] cursor-pointer"
                  onClick={() => isReady && handleOpenPreview(video)}
                >
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#71717a] gap-1">
                      <Film className="w-7 h-7 text-[#52525b]" />
                      <span className="text-[10px]">Sem thumbnail</span>
                    </div>
                  )}

                  {/* Play Overlay */}
                  {isReady && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                    </div>
                  )}

                  {/* Badges Superiores */}
                  <div className="absolute top-2 left-2 z-10 flex flex-wrap items-center gap-1.5">
                    {isReady && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 backdrop-blur-md">
                        PRONTO
                      </span>
                    )}
                    {isProcessing && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 backdrop-blur-md flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> PROCESSANDO
                      </span>
                    )}
                    {isUploading && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 backdrop-blur-md flex items-center gap-1">
                        <Upload className="w-3 h-3" /> ENVIANDO
                      </span>
                    )}
                    {isFailed && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 backdrop-blur-md">
                        ERRO
                      </span>
                    )}
                  </div>

                  {/* Checkbox de Seleção */}
                  <div
                    onClick={(e) => handleToggleSelect(video.id, e)}
                    className={`absolute top-2 right-2 z-20 w-6 h-6 rounded-lg backdrop-blur-md border flex items-center justify-center cursor-pointer transition shadow-md ${
                      isSelected
                        ? "bg-red-600 border-red-500 text-white"
                        : "bg-black/60 hover:bg-black/80 border-white/20 text-transparent"
                    }`}
                    title={isSelected ? "Desmarcar vídeo" : "Selecionar vídeo"}
                  >
                    <Check className={`w-3.5 h-3.5 stroke-[3] ${isSelected ? "opacity-100" : "opacity-0"}`} />
                  </div>

                  {/* Duração no Canto Inferior Direito */}
                  {video.durationSeconds && video.durationSeconds > 0 && (
                    <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md text-[#f4f4f5] text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10">
                      {formatDuration(video.durationSeconds)}
                    </div>
                  )}
                </div>

                {/* Conteúdo do Card */}
                <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className="text-xs font-semibold text-[#f4f4f5] truncate group-hover:text-blue-400 transition-colors"
                        title={video.title}
                      >
                        {video.title}
                      </h3>
                    </div>
                    {video.description && (
                      <p className="text-[11px] text-[#9a9aa2] line-clamp-2 leading-relaxed">
                        {video.description}
                      </p>
                    )}
                  </div>

                  {/* Metadados: Tamanho e Produtos */}
                  <div className="pt-2 border-t border-[#26262a] flex items-center justify-between text-[11px] text-[#71717a] font-mono">
                    <span>{formatFileSize(video.fileSizeBytes)}</span>
                    <span className="flex items-center gap-1 text-[#9a9aa2] font-sans">
                      <Layers className="w-3 h-3 text-blue-400" />
                      {assignedCount > 0 ? `${assignedCount} produto(s)` : "Avulso"}
                    </span>
                  </div>

                  {/* Rodapé de Ações */}
                  <div className="pt-2 border-t border-[#26262a] flex items-center justify-between gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(video)}
                      className={`text-xs ${
                        video.active !== false
                          ? "text-[#9a9aa2] hover:text-[#f4f4f5]"
                          : "text-amber-400 hover:text-amber-300"
                      }`}
                    >
                      {video.active !== false ? "Ativo" : "Pausado"}
                    </Button>

                    <RowMenu
                      items={menuItems}
                      ariaLabel={`Ações para o vídeo ${video.title}`}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Visualização em Lista / Tabela */
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#26262a] bg-[#121215] text-[11px] font-semibold text-[#71717a] uppercase tracking-wider">
                  <th className="py-3 px-3 w-10 text-center">Sel</th>
                  <th className="py-3 px-4">Vídeo</th>
                  <th className="py-3 px-4">Duração</th>
                  <th className="py-3 px-4">Tamanho</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Produtos</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#26262a] text-xs">
                {filteredVideos.map((video) => {
                  const isReady = video.status === "READY";
                  const isSelected = selectedVideoIds.has(video.id);
                  const assignedCount =
                    video.assignedProductsCount || video.assignmentCount || video.assignments?.length || 0;

                  const menuItems = [
                    ...(isReady
                      ? [
                          {
                            id: "preview",
                            label: "Visualizar vídeo",
                            icon: <Play className="w-4 h-4 text-blue-400" />,
                            onClick: () => handleOpenPreview(video),
                          },
                          {
                            id: "deeplink",
                            label: "Gerar Deep Link",
                            icon: <LinkIcon className="w-4 h-4 text-purple-400" />,
                            onClick: () => setDeepLinkModalVideo(video),
                          },
                        ]
                      : []),
                    {
                      id: "edit",
                      label: "Editar detalhes",
                      icon: <Edit2 className="w-4 h-4 text-[#9a9aa2]" />,
                      onClick: () => handleOpenEdit(video),
                    },
                    {
                      id: "toggle-active",
                      label: video.active !== false ? "Desativar vídeo" : "Ativar vídeo",
                      icon: <Power className="w-4 h-4 text-[#9a9aa2]" />,
                      onClick: () => handleToggleActive(video),
                    },
                    {
                      id: "delete",
                      label: "Excluir vídeo",
                      icon: <Trash2 className="w-4 h-4 text-[#f87171]" />,
                      danger: true,
                      onClick: () => handleOpenDelete(video),
                    },
                  ];

                  return (
                    <tr
                      key={video.id}
                      className={`hover:bg-[#16161a] transition-colors ${
                        isSelected ? "bg-red-950/10" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <div
                          onClick={(e) => handleToggleSelect(video.id, e)}
                          className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition mx-auto ${
                            isSelected
                              ? "bg-red-600 border-red-500 text-white"
                              : "border-[#3a3a40] bg-[#16161a]"
                          }`}
                        >
                          <Check className={`w-3 h-3 stroke-[3] ${isSelected ? "opacity-100" : "opacity-0"}`} />
                        </div>
                      </td>

                      {/* Miniatura & Título */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-16 aspect-video rounded-lg bg-[#16161a] border border-[#26262a] overflow-hidden shrink-0 flex items-center justify-center cursor-pointer"
                            onClick={() => isReady && handleOpenPreview(video)}
                          >
                            {video.thumbnailUrl ? (
                              <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                            ) : (
                              <Film className="w-5 h-5 text-[#71717a]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-[#f4f4f5] truncate block">
                              {video.title}
                            </span>
                            {video.description && (
                              <span className="text-[11px] text-[#71717a] line-clamp-1">
                                {video.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Duração */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[#9a9aa2]">
                        {formatDuration(video.durationSeconds)}
                      </td>

                      {/* Tamanho */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[#9a9aa2]">
                        {formatFileSize(video.fileSizeBytes)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            video.status === "READY"
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : video.status === "PROCESSING"
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                              : video.status === "UPLOADING"
                              ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                              : "bg-red-500/15 text-red-400 border-red-500/30"
                          }`}
                        >
                          {video.status}
                        </span>
                      </td>

                      {/* Produtos */}
                      <td className="py-3 px-4 whitespace-nowrap text-[#9a9aa2]">
                        {assignedCount > 0 ? `${assignedCount} produto(s)` : "Avulso"}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {isReady && (
                            <IconButton
                              size="sm"
                              variant="ghost"
                              icon={<Play className="w-3.5 h-3.5 text-blue-400" />}
                              aria-label={`Visualizar ${video.title}`}
                              onClick={() => handleOpenPreview(video)}
                            />
                          )}
                          <RowMenu
                            items={menuItems}
                            ariaLabel={`Ações para o vídeo ${video.title}`}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 6. Modal de Upload Multi-Arquivo (Batch) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121215] border border-[#26262a] w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-[#26262a] flex items-center justify-between bg-[#16161a]">
              <div>
                <h3 className="text-base font-bold text-[#f4f4f5]">Adicionar Vídeos</h3>
                <p className="text-xs text-[#9a9aa2] mt-0.5">
                  Selecione um ou vários arquivos de vídeo (MP4, MOV, WebM, MKV).
                </p>
              </div>
              <IconButton
                size="sm"
                variant="ghost"
                icon={<X className="w-5 h-5 text-[#9a9aa2] hover:text-white" />}
                aria-label="Fechar modal de upload"
                onClick={() => setIsUploadModalOpen(false)}
              />
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {/* Dropzone */}
              <div className="border border-dashed border-[#26262a] hover:border-[#3b82f6]/50 rounded-2xl p-6 text-center bg-[#16161a] transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  multiple
                  onChange={(e) => handleMultipleFilesSelect(e.target.files)}
                  className="hidden"
                  id="batch-video-upload"
                />
                <label
                  htmlFor="batch-video-upload"
                  className="cursor-pointer flex flex-col items-center gap-2 text-xs text-[#9a9aa2]"
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <CloudUpload className="w-6 h-6" />
                  </div>
                  <span className="font-semibold text-sm text-[#f4f4f5]">
                    Clique para selecionar vídeos do computador
                  </span>
                  <span className="text-[11px] text-[#71717a]">
                    Upload simultâneo com retomada automática e streaming direto
                  </span>
                </label>
              </div>

              {/* Mensagens de Arquivos Rejeitados */}
              {rejectedFilesMessages.length > 0 && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs space-y-1">
                  {rejectedFilesMessages.map((msg, i) => (
                    <p key={i}>• {msg}</p>
                  ))}
                </div>
              )}

              {/* Fila de Upload */}
              {batchItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#f4f4f5]">
                    <span>Fila de Upload ({batchItems.length})</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={isQueuePaused ? handleStartBatchQueue : handlePauseBatchQueue}
                        className="text-xs"
                      >
                        {isQueuePaused ? "Retomar fila" : "Pausar fila"}
                      </Button>
                    </div>
                  </div>

                  <div className="divide-y divide-[#26262a] border border-[#26262a] rounded-xl overflow-hidden bg-[#16161a] max-h-60 overflow-y-auto">
                    {batchItems.map((item) => (
                      <div key={item.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#f4f4f5] truncate">{item.title}</p>
                          <div className="flex items-center gap-2 text-[11px] text-[#71717a] mt-0.5">
                            <span>{formatFileSize(item.file.size)}</span>
                            <span>•</span>
                            <span className="text-blue-400 font-medium">{item.status}</span>
                            {item.progressPercent > 0 && <span>({item.progressPercent}%)</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {item.status === "FAILED" && (
                            <IconButton
                              size="sm"
                              variant="ghost"
                              icon={<RotateCcw className="w-3.5 h-3.5 text-blue-400" />}
                              aria-label={`Tentar novamente ${item.title}`}
                              onClick={() => handleRetryBatchItem(item.id)}
                            />
                          )}
                          <IconButton
                            size="sm"
                            variant="ghost"
                            icon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}
                            aria-label={`Remover ${item.title}`}
                            onClick={() => handleRemoveBatchItem(item.id)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#26262a] flex items-center justify-end gap-2 bg-[#16161a]">
              <Button variant="ghost" size="md" onClick={() => setIsUploadModalOpen(false)}>
                Fechar
              </Button>
              {batchItems.length > 0 && (
                <Button variant="primary" size="md" onClick={handleStartBatchQueue}>
                  Iniciar uploads
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal de Edição de Vídeo */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121215] border border-[#26262a] w-full max-w-lg rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#26262a]">
              <h3 className="text-sm font-bold text-[#f4f4f5]">Editar Vídeo</h3>
              <IconButton
                size="sm"
                variant="ghost"
                icon={<X className="w-4 h-4 text-[#9a9aa2]" />}
                aria-label="Fechar modal de edição"
                onClick={() => setEditingVideo(null)}
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#f4f4f5] block mb-1">
                  Título do Vídeo
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full h-10 bg-[#16161a] border border-[#26262a] focus:border-[#3b82f6] text-xs text-[#f4f4f5] rounded-xl px-3 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#f4f4f5] block mb-1">
                  Descrição (opcional)
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-[#16161a] border border-[#26262a] focus:border-[#3b82f6] text-xs text-[#f4f4f5] rounded-xl p-3 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#26262a]">
              <Button variant="ghost" size="md" onClick={() => setEditingVideo(null)} disabled={isSavingEdit}>
                Cancelar
              </Button>
              <Button variant="primary" size="md" onClick={handleSaveEdit} disabled={isSavingEdit}>
                {isSavingEdit ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal de Preview Player */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#121215] border border-[#26262a] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[#26262a] flex items-center justify-between bg-[#16161a]">
              <div className="min-w-0 pr-4">
                <h3 className="text-sm font-bold text-[#f4f4f5] truncate">{previewVideo.title}</h3>
                <span className="text-[11px] text-[#71717a] font-mono">
                  {formatDuration(previewVideo.durationSeconds)} • {formatFileSize(previewVideo.fileSizeBytes)}
                </span>
              </div>
              <IconButton
                size="sm"
                variant="ghost"
                icon={<X className="w-4 h-4 text-[#9a9aa2]" />}
                aria-label="Fechar player"
                onClick={() => setPreviewVideo(null)}
              />
            </div>

            <div className="aspect-video w-full bg-black flex items-center justify-center">
              {isLoadingPreview ? (
                <div className="flex flex-col items-center gap-2 text-xs text-[#9a9aa2]">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  <span>Carregando reprodução segura...</span>
                </div>
              ) : previewPlayback?.playbackUrl ? (
                <ProductVideoPlayer
                  videoId={previewVideo.id}
                  playbackUrl={previewPlayback.playbackUrl}
                  title={previewVideo.title}
                  directUrl={previewPlayback.directUrl}
                />
              ) : (
                <p className="text-xs text-red-400">Falha ao carregar stream do vídeo.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9. Confirmação de Exclusão Unitária */}
      <ConfirmDialog
        isOpen={Boolean(deletingVideo)}
        title="Excluir Vídeo da Biblioteca"
        description={
          deleteWarningInfo?.isBlockedActiveAccesses ? (
            <span className="text-red-400">
              {deleteWarningInfo.message ||
                `Este vídeo possui ${deleteWarningInfo.activeAccessCount} comprador(es) com acesso ativo. A exclusão é bloqueada para proteger o histórico comercial.`}
            </span>
          ) : deleteWarningInfo?.isAssigned ? (
            <span>
              Este vídeo está vinculado a <b>{deleteWarningInfo.assignedCount}</b> produto(s). Excluir o vídeo irá desvinculá-lo permanentemente dos produtos. Deseja prosseguir?
            </span>
          ) : (
            `Tem certeza que deseja excluir o vídeo "${deletingVideo?.title}"? O arquivo será removido definitivamente do storage.`
          )
        }
        confirmLabel={deleteWarningInfo?.isBlockedActiveAccesses ? "Entendido" : "Sim, excluir"}
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={() => {
          if (deleteWarningInfo?.isBlockedActiveAccesses) {
            setDeletingVideo(null);
            setDeleteWarningInfo(null);
          } else {
            handleConfirmDelete(Boolean(deleteWarningInfo?.isAssigned));
          }
        }}
        onClose={() => {
          setDeletingVideo(null);
          setDeleteWarningInfo(null);
        }}
      />

      {/* 10. Confirmação de Exclusão em Massa */}
      <ConfirmDialog
        isOpen={isBulkDeleteModalOpen}
        title="Exclusão em Massa de Vídeos"
        description={`Tem certeza que deseja excluir os ${selectedVideoIds.size} vídeos selecionados? Esta ação não pode ser desfeita.`}
        confirmLabel="Sim, excluir selecionados"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isBulkDeleting}
        onConfirm={handleConfirmBulkDelete}
        onClose={() => setIsBulkDeleteModalOpen(false)}
      />

      {/* 11. Modal de Deep Link */}
      {deepLinkModalVideo && (
        <GenerateDeepLinkModal
          isOpen={Boolean(deepLinkModalVideo)}
          onClose={() => setDeepLinkModalVideo(null)}
          video={deepLinkModalVideo}
        />
      )}

      {/* 12. Modal de Upgrade de Plano */}
      {isVideoPlanModalOpen && (
        <VideoPlanUpgradeModal
          isOpen={isVideoPlanModalOpen}
          onClose={() => setIsVideoPlanModalOpen(false)}
          currentPlanName={usage.planName || undefined}
          onSuccess={() => {
            refreshData();
            setIsVideoPlanModalOpen(false);
          }}
        />
      )}

      {/* 13. Toast de Notificações */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

// Re-export com o nome alternativo solicitado para retrocompatibilidade
export { VideoLibraryClientV2 as VideosClientV2 };
