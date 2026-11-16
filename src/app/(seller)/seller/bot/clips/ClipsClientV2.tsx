"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Film,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Edit2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Play,
  Clock,
  RefreshCw,
  FileVideo,
  LayoutGrid,
  List,
  ShoppingCart,
  Search,
  Sparkles,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  Toolbar,
  SearchInput,
  SegmentedControl,
  Button,
  IconButton,
  Card,
  Chip,
  EmptyState,
  ConfirmDialog,
  Toast,
} from "@/components/seller-v2";
import { TusVideoUploader } from "@/lib/bunny/client-upload";
import {
  getVideoDuration,
  formatDurationHuman,
  CLIP_MAX_DURATION_SECONDS,
} from "@/lib/clips/video-processor";

export interface ProductOption {
  id: string;
  title: string;
  price: string | number;
  coverUrl: string | null;
  slug: string;
  status?: string;
}

export interface ClipItem {
  id: string;
  storeId: string;
  title: string;
  description: string | null;
  bunnyVideoId: string;
  thumbnailUrl: string | null;
  duration: number | null;
  status: string; // 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED'
  position: number;
  isActive: boolean;
  productId?: string | null;
  product?: ProductOption | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClipsStats {
  total: number;
  published: number;
  processing: number;
  failed: number;
}

export interface ClipsClientV2Props {
  initialClips: ClipItem[];
  initialStats: ClipsStats;
  availableProducts?: ProductOption[];
  hideHeader?: boolean;
}

export default function ClipsClientV2({
  initialClips,
  initialStats,
  availableProducts = [],
  hideHeader = false,
}: ClipsClientV2Props) {
  const [clipsList, setClipsList] = useState<ClipItem[]>(initialClips);
  const [stats, setStats] = useState<ClipsStats>(initialStats);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // View Mode: 'grid' | 'list'
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Linked Product state in form
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState<string>("");

  // Toast State
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingClip, setEditingClip] = useState<ClipItem | null>(null);
  const [deletingClip, setDeletingClip] = useState<ClipItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewClip, setPreviewClip] = useState<ClipItem | null>(null);

  // Add / Upload Form State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectedDuration, setDetectedDuration] = useState<number | null>(null);
  const [isOverDurationLimit, setIsOverDurationLimit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload Progress & Lifecycle State
  const [uploadStep, setUploadStep] = useState<string>("IDLE");
  const [uploadProgressPercent, setUploadProgressPercent] = useState<number>(0);
  const [uploadProgressText, setUploadProgressText] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
  };

  // Helper to refresh Clips list from WebGran API
  const refreshClipsData = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/seller/clips?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.clips)) {
        setClipsList(
          data.clips.map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
          }))
        );
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error("[Clips Client Refresh Error]:", err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  // Polling strategy: check status every 5 seconds if there are clips in UPLOADING or PROCESSING state
  const hasPendingClips = clipsList.some(
    (c) => c.status === "PROCESSING" || c.status === "UPLOADING"
  );

  useEffect(() => {
    if (!hasPendingClips) return;

    const intervalId = setInterval(() => {
      refreshClipsData(true);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [hasPendingClips]);

  // Handle File Select & Validation: Read duration in browser. If > 120s -> BLOCK immediately!
  const processAndValidateFile = async (file: File) => {
    setUploadError(null);
    setIsOverDurationLimit(false);
    setDetectedDuration(null);

    // Validation 1: MIME Type must be video
    if (!file.type || !file.type.toLowerCase().startsWith("video/")) {
      setUploadError("Selecione um arquivo de vídeo válido (MP4, MOV, WebM, etc.).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSelectedFile(null);
      return;
    }

    // Validation 2: Read duration in browser. If > 120s -> BLOCK immediately!
    try {
      const duration = await getVideoDuration(file);
      setDetectedDuration(duration);

      if (duration > CLIP_MAX_DURATION_SECONDS) {
        setIsOverDurationLimit(true);
        setUploadError(
          `Este vídeo tem ${formatDurationHuman(duration)} (mais de 2 minutos). Para publicar um Clip, corte o vídeo para no máximo 2 minutos usando uma ferramenta de edição e tente novamente.`
        );
        setSelectedFile(file);
        return;
      }
    } catch (err: any) {
      setUploadError(err?.message || "Não foi possível verificar a duração do vídeo.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    if (!formData.title) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setFormData((prev) => ({ ...prev, title: nameWithoutExt }));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processAndValidateFile(file);
  };

  // Drag & Drop Handler
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processAndValidateFile(file);
    }
  };

  // Open Add Modal
  const openAddModal = () => {
    setFormData({ title: "", description: "" });
    setSelectedProductId(null);
    setProductSearchQuery("");
    setSelectedFile(null);
    setDetectedDuration(null);
    setIsOverDurationLimit(false);
    setUploadStep("IDLE");
    setUploadProgressPercent(0);
    setUploadProgressText("");
    setUploadError(null);
    setEditingClip(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (c: ClipItem) => {
    setEditingClip(c);
    setFormData({
      title: c.title || "",
      description: c.description || "",
    });
    setSelectedProductId(c.productId || (c.product?.id ?? null));
    setProductSearchQuery("");
    setIsAddModalOpen(true);
  };

  // Cancel Upload Handler
  const handleCancelUpload = () => {
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
    }
    setUploadStep("CANCELLED");
    setUploadProgressText("Upload cancelado pelo usuário.");
  };

  // Handle Form Submit: Add (Upload Session -> Bunny Direct Upload) OR Edit (Update Metadata)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingClip) {
      // Handle Metadata Edit
      if (!formData.title.trim()) {
        showToast("Informe um título para o Clip.", "error");
        return;
      }

      try {
        const res = await fetch(`/api/seller/clips/${editingClip.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            productId: selectedProductId || null,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Erro ao atualizar informações do Clip.");
        }

        showToast("Clip atualizado com sucesso!", "success");
        setIsAddModalOpen(false);
        refreshClipsData();
      } catch (err: any) {
        showToast(err.message || "Erro ao atualizar Clip.", "error");
      }
      return;
    }

    // Handle New Clip Upload Flow
    if (!formData.title.trim()) {
      setUploadError("Informe um título para o Clip.");
      return;
    }

    if (!selectedFile) {
      setUploadError("Selecione um arquivo de vídeo para enviar.");
      return;
    }

    // Dual Validation: Re-evaluate duration immediately before starting upload
    try {
      const duration = await getVideoDuration(selectedFile);
      if (duration > CLIP_MAX_DURATION_SECONDS) {
        setIsOverDurationLimit(true);
        setUploadError(
          `Este vídeo tem ${formatDurationHuman(duration)} (mais de 2 minutos). Para publicar um Clip, corte o vídeo para no máximo 2 minutos usando uma ferramenta de edição e tente novamente.`
        );
        return;
      }
    } catch (err: any) {
      setUploadError(err.message || "Falha ao validar a duração do vídeo antes do envio.");
      return;
    }

    try {
      setUploadError(null);
      setUploadStep("CREATING_SESSION");
      setUploadProgressPercent(0);
      setUploadProgressText("Criando sessão de upload seguro no WebGran...");
      uploadAbortControllerRef.current = new AbortController();

      // Step 1: POST /api/seller/clips/upload-session with actual file size, mime type & productId
      const sessionRes = await fetch("/api/seller/clips/upload-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          contentType: selectedFile.type || "video/mp4",
          fileSize: selectedFile.size,
          productId: selectedProductId || null,
        }),
      });

      const sessionData = await sessionRes.json();
      if (!sessionRes.ok || !sessionData.success) {
        throw new Error(sessionData.error || "Falha ao criar sessão de upload.");
      }

      const { uploadSession } = sessionData;

      // Step 2: Browser -> Bunny Stream Direct TUS Resumable Upload
      setUploadStep("UPLOADING");
      setUploadProgressText("Enviando vídeo diretamente para o Bunny Stream (TUS)...");

      const uploader = new TusVideoUploader();
      uploadAbortControllerRef.current.signal.addEventListener("abort", () => {
        uploader.abort();
      });

      await uploader.uploadVideo({
        file: selectedFile,
        tusUploadUrl: uploadSession.tusUploadUrl || "https://video.bunnycdn.com/tusupload",
        headers: uploadSession.headers,
        signal: uploadAbortControllerRef.current.signal,
        onProgress: (p) => {
          setUploadProgressPercent(p.percentage);
          const uploadedMB = (p.bytesUploaded / (1024 * 1024)).toFixed(1);
          const totalMB = (p.totalBytes / (1024 * 1024)).toFixed(1);
          setUploadProgressText(`Enviando vídeo: ${uploadedMB} MB de ${totalMB} MB (${p.percentage}%)`);
        },
      });

      // Step 3: Direct Upload Completed -> Bunny Processing
      setUploadStep("PROCESSING");
      setUploadProgressPercent(100);
      setUploadProgressText("Upload concluído! Vídeo em processamento pelo Bunny Stream...");

      showToast("Upload concluído! O vídeo está sendo processado pelo Bunny Stream.", "success");
      refreshClipsData();

      setTimeout(() => {
        setIsAddModalOpen(false);
      }, 2500);
    } catch (err: any) {
      console.error("[Direct Upload Error]:", err);
      setUploadStep("FAILED");
      setUploadError(err.message || "Ocorreu um erro durante o upload do vídeo.");
    }
  };

  // Toggle Active Status (isActive)
  const handleToggleActive = async (clip: ClipItem) => {
    const nextState = !clip.isActive;
    try {
      setClipsList((prev) =>
        prev.map((item) => (item.id === clip.id ? { ...item, isActive: nextState } : item))
      );

      const res = await fetch(`/api/seller/clips/${clip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextState }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao alterar visibilidade.");
      }

      showToast(`Clip ${nextState ? "ativado" : "desativado"} com sucesso!`, "success");
    } catch (err: any) {
      showToast(err.message || "Erro ao alterar estado do Clip", "error");
      refreshClipsData();
    }
  };

  // Open Delete Confirmation Modal
  const confirmDeleteClip = (clip: ClipItem) => {
    setDeletingClip(clip);
  };

  // Execute Delete
  const handleDeleteClip = async () => {
    if (!deletingClip) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/seller/clips/${deletingClip.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao excluir o Clip.");
      }

      showToast("Clip excluído com sucesso do Bunny Stream e do catálogo.", "success");
      setDeletingClip(null);
      refreshClipsData();
    } catch (err: any) {
      showToast(err.message || "Erro ao excluir Clip.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Reorder Clips (Move Up / Move Down)
  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredClips.length) return;

    const movedClip = filteredClips[index];
    const targetClip = filteredClips[targetIndex];

    const fullIndexSource = clipsList.findIndex((c) => c.id === movedClip.id);
    const fullIndexTarget = clipsList.findIndex((c) => c.id === targetClip.id);

    if (fullIndexSource === -1 || fullIndexTarget === -1) return;

    const newList = [...clipsList];
    const temp = newList[fullIndexSource];
    newList[fullIndexSource] = newList[fullIndexTarget];
    newList[fullIndexTarget] = temp;

    newList.forEach((item, idx) => {
      item.position = idx;
    });

    setClipsList(newList);

    try {
      const orderedIds = newList.map((c) => c.id);
      const res = await fetch("/api/seller/clips/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipIds: orderedIds }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao reordenar clips.");
      }

      showToast("Ordem dos clips atualizada com sucesso.", "success");
    } catch (err: any) {
      showToast(err.message || "Erro ao reordenar clips", "error");
      refreshClipsData();
    }
  };

  // Format Duration in seconds to mm:ss
  const formatDuration = (seconds: number | null) => {
    if (!seconds || seconds <= 0) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Filtered Clips calculation
  const filteredClips = useMemo(() => {
    return clipsList.filter((clip) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchTitle = clip.title.toLowerCase().includes(query);
        const matchDesc = clip.description?.toLowerCase().includes(query) ?? false;
        const matchProduct = clip.product?.title.toLowerCase().includes(query) ?? false;
        const matchId = clip.bunnyVideoId.toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchProduct && !matchId) {
          return false;
        }
      }

      // Status filter
      if (statusFilter === "ready" && clip.status !== "READY") return false;
      if (
        statusFilter === "processing" &&
        clip.status !== "PROCESSING" &&
        clip.status !== "UPLOADING"
      )
        return false;
      if (statusFilter === "failed" && clip.status !== "FAILED") return false;
      if (statusFilter === "active" && !clip.isActive) return false;
      if (statusFilter === "inactive" && clip.isActive) return false;

      return true;
    });
  }, [clipsList, searchQuery, statusFilter]);

  // Options for SegmentedControl
  const filterOptions = [
    { id: "all", label: "Todos", count: clipsList.length },
    { id: "ready", label: "Publicados", count: stats.published },
    { id: "processing", label: "Processando", count: stats.processing },
    { id: "failed", label: "Falhas", count: stats.failed },
    {
      id: "active",
      label: "Ativos",
      count: clipsList.filter((c) => c.isActive).length,
    },
    {
      id: "inactive",
      label: "Inativos",
      count: clipsList.filter((c) => !c.isActive).length,
    },
  ];

  return (
    <div className="space-y-6 w-full min-w-0 pb-16">
      {/* Toast Feedback */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}

      {/* Page Header */}
      {!hideHeader && (
        <PageHeader
          title="Clips"
          subtitle="Gerencie os vídeos curtos exibidos na sua loja online e conecte produtos para aumentar conversões."
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/20">
              {stats.total} {stats.total === 1 ? "clip" : "clips"}
            </span>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="md"
                onClick={() => refreshClipsData()}
                disabled={isRefreshing}
                leftIcon={<RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#3984FF]" : ""}`} />}
              >
                <span className="hidden sm:inline">Sincronizar</span>
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={openAddModal}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                <span>Adicionar Clip</span>
              </Button>
            </div>
          }
        />
      )}

      {/* Real-time Summary StatCards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total de Clips"
          value={stats.total}
          subtext="Vídeos cadastrados na loja"
          icon={<Film className="w-5 h-5" />}
          accent="zinc"
        />
        <StatCard
          label="Publicados"
          value={stats.published}
          subtext="Prontos para reprodução"
          icon={<CheckCircle2 className="w-5 h-5" />}
          accent="green"
        />
        <StatCard
          label="Processando"
          value={stats.processing}
          subtext="Em conversão no Bunny Stream"
          icon={<Sparkles className="w-5 h-5 text-sky-400" />}
          accent="blue"
        />
        <StatCard
          label="Falhas"
          value={stats.failed}
          subtext="Erros no processamento"
          icon={<AlertCircle className="w-5 h-5 text-rose-400" />}
          accent="red"
        />
      </div>

      {/* Toolbar Controls */}
      <Toolbar
        searchSlot={
          <SearchInput
            value={searchQuery}
            onChange={(val) => setSearchQuery(val)}
            placeholder="Buscar por título, descrição ou produto..."
            aria-label="Buscar clips"
          />
        }
        filterSlot={
          <SegmentedControl
            options={filterOptions}
            value={statusFilter}
            onChange={(id) => setStatusFilter(id)}
          />
        }
        actionSlot={
          <div className="flex items-center bg-[#151821] border border-white/[0.08] rounded-xl p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Visualização em Grade"
              aria-label="Visualização em Grade"
              className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-[#3984FF] text-white shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Grade</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              title="Visualização em Lista"
              aria-label="Visualização em Lista"
              className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-[#3984FF] text-white shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Lista</span>
            </button>
          </div>
        }
      />

      {/* Clips Display Container */}
      {filteredClips.length === 0 ? (
        clipsList.length === 0 ? (
          <EmptyState
            icon={<Film className="w-12 h-12 text-zinc-500" />}
            title="Nenhum clip cadastrado"
            description="Envie vídeos curtos de até 2 minutos para engajar clientes diretamente no Mini App e aumentar suas vendas."
            action={{
              label: "Adicionar Primeiro Clip",
              onClick: openAddModal,
              icon: <Plus className="w-4 h-4" />,
            }}
          />
        ) : (
          <EmptyState
            icon={<Search className="w-10 h-10 text-zinc-500" />}
            title="Nenhum clip encontrado"
            description={`Nenhum resultado corresponde à busca "${searchQuery}" com os filtros aplicados.`}
            action={{
              label: "Limpar Filtros",
              onClick: () => {
                setSearchQuery("");
                setStatusFilter("all");
              },
            }}
          />
        )
      ) : viewMode === "grid" ? (
        /* GRID VIEW — CARDS MODERNOS COM POSTER VERTICAL */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredClips.map((clip, index) => {
            const isReady = clip.status === "READY";
            const isFailed = clip.status === "FAILED";
            const isProcessing = clip.status === "PROCESSING" || clip.status === "UPLOADING";

            return (
              <Card
                key={clip.id}
                className={`overflow-hidden flex flex-col justify-between transition-all group ${
                  clip.isActive ? "hover:border-white/20" : "opacity-70 border-white/[0.05]"
                }`}
              >
                {/* Poster / Video Thumbnail Container */}
                <div className="relative w-full aspect-[9/14] bg-black/80 overflow-hidden flex items-center justify-center group/poster">
                  {clip.thumbnailUrl ? (
                    <img
                      src={clip.thumbnailUrl}
                      alt={clip.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover/poster:scale-105"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-3 text-center text-zinc-600">
                      {isProcessing ? (
                        <Loader2 className="w-8 h-8 animate-spin text-sky-400 mb-2" />
                      ) : (
                        <Film className="w-8 h-8 text-zinc-500 mb-2" />
                      )}
                      <span className="text-xs font-medium text-zinc-400">
                        {isProcessing ? "Processando..." : "Sem Thumbnail"}
                      </span>
                    </div>
                  )}

                  {/* Position Badge - Top Left */}
                  <div className="absolute top-2.5 left-2.5 z-10 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-lg text-[11px] font-bold text-white border border-white/10 shadow-sm">
                    #{index + 1}
                  </div>

                  {/* Badges - Top Right */}
                  <div className="absolute top-2.5 right-2.5 z-10 flex flex-col items-end gap-1.5">
                    {isReady && <Chip label="Publicado" variant="active" size="sm" />}
                    {clip.status === "UPLOADING" && (
                      <Chip label="Enviando" variant="warning" size="sm" />
                    )}
                    {clip.status === "PROCESSING" && (
                      <Chip label="Processando" variant="info" size="sm" />
                    )}
                    {isFailed && <Chip label="Falha" variant="danger" size="sm" />}

                    <Chip
                      label={clip.isActive ? "Ativo" : "Inativo"}
                      variant={clip.isActive ? "active" : "inactive"}
                      size="sm"
                    />
                  </div>

                  {/* Duration Badge - Bottom Right */}
                  <div className="absolute bottom-2.5 right-2.5 z-10 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-semibold text-white flex items-center gap-1 border border-white/10 shadow-sm">
                    <Clock className="w-3 h-3 text-zinc-400" />
                    {formatDuration(clip.duration)}
                  </div>

                  {/* Quick Play Hover Trigger (for READY clips) */}
                  {isReady && (
                    <button
                      type="button"
                      onClick={() => setPreviewClip(clip)}
                      title="Visualizar vídeo"
                      aria-label={`Visualizar ${clip.title}`}
                      className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 opacity-0 group-hover/poster:opacity-100 transition-opacity cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#3984FF] text-white flex items-center justify-center shadow-xl transform group-hover/poster:scale-110 transition-transform">
                        <Play className="w-5 h-5 ml-0.5 fill-white" />
                      </div>
                    </button>
                  )}
                </div>

                {/* Content Information */}
                <div className="p-3.5 space-y-2 border-b border-white/[0.06] flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white line-clamp-1" title={clip.title}>
                      {clip.title}
                    </h3>
                    {clip.description && (
                      <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                        {clip.description}
                      </p>
                    )}

                    {/* Linked Product Badge */}
                    {clip.product && (
                      <div className="flex items-center gap-2 text-xs font-medium text-amber-300 bg-amber-950/40 border border-amber-500/20 px-2.5 py-1 rounded-lg mt-2 w-fit max-w-full">
                        {clip.product.coverUrl ? (
                          <img
                            src={clip.product.coverUrl}
                            alt={clip.product.title}
                            className="w-4 h-4 rounded-sm object-cover shrink-0"
                          />
                        ) : (
                          <ShoppingCart className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span className="truncate max-w-[140px]">{clip.product.title}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-zinc-500 font-mono truncate pt-1">
                    ID: {clip.bunnyVideoId}
                  </p>
                </div>

                {/* Card Actions Footer */}
                <div className="p-2.5 bg-white/[0.01] flex items-center justify-between gap-1">
                  {/* Reorder Buttons */}
                  <div className="flex items-center gap-1">
                    <IconButton
                      aria-label="Subir posição"
                      onClick={() => handleMove(index, "up")}
                      disabled={index === 0}
                      variant="ghost"
                      size="sm"
                      icon={<ArrowUp className="w-3.5 h-3.5" />}
                    />
                    <IconButton
                      aria-label="Descer posição"
                      onClick={() => handleMove(index, "down")}
                      disabled={index === filteredClips.length - 1}
                      variant="ghost"
                      size="sm"
                      icon={<ArrowDown className="w-3.5 h-3.5" />}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {isReady && (
                      <IconButton
                        aria-label="Pré-visualizar clip"
                        onClick={() => setPreviewClip(clip)}
                        variant="ghost"
                        size="sm"
                        icon={<Play className="w-3.5 h-3.5 text-[#3984FF]" />}
                      />
                    )}
                    <IconButton
                      aria-label={clip.isActive ? "Desativar Clip" : "Ativar Clip"}
                      onClick={() => handleToggleActive(clip)}
                      variant={clip.isActive ? "ghost" : "primary"}
                      size="sm"
                      icon={
                        clip.isActive ? (
                          <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )
                      }
                    />
                    <IconButton
                      aria-label="Editar Clip"
                      onClick={() => openEditModal(clip)}
                      variant="ghost"
                      size="sm"
                      icon={<Edit2 className="w-3.5 h-3.5" />}
                    />
                    <IconButton
                      aria-label="Excluir Clip"
                      onClick={() => confirmDeleteClip(clip)}
                      variant="danger"
                      size="sm"
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW — TABELA COMPACTA E ORGANIZADA */
        <Card className="overflow-hidden">
          <div className="divide-y divide-white/[0.06]">
            {filteredClips.map((clip, index) => {
              const isReady = clip.status === "READY";
              const isFailed = clip.status === "FAILED";
              const isProcessing = clip.status === "PROCESSING" || clip.status === "UPLOADING";

              return (
                <div
                  key={clip.id}
                  className={`p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors hover:bg-white/[0.02] ${
                    clip.isActive ? "" : "opacity-60"
                  }`}
                >
                  {/* Left: Thumbnail & Details */}
                  <div className="flex items-center gap-4 min-w-0 w-full md:w-auto flex-1">
                    {/* Thumbnail / Placeholder */}
                    <div className="relative w-20 h-28 sm:w-24 sm:h-32 rounded-xl bg-black/60 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center group/thumb">
                      {clip.thumbnailUrl ? (
                        <img
                          src={clip.thumbnailUrl}
                          alt={clip.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-2 text-center text-zinc-600">
                          {isProcessing ? (
                            <Loader2 className="w-6 h-6 animate-spin text-sky-400 mb-1" />
                          ) : (
                            <Film className="w-6 h-6 text-zinc-500 mb-1" />
                          )}
                          <span className="text-[10px] text-zinc-500">Sem Capa</span>
                        </div>
                      )}

                      {/* Duration */}
                      <div className="absolute bottom-1.5 right-1.5 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-semibold text-white flex items-center gap-1 border border-white/10">
                        <Clock className="w-2.5 h-2.5 text-zinc-400" />
                        {formatDuration(clip.duration)}
                      </div>

                      {/* Play overlay for ready clips */}
                      {isReady && (
                        <button
                          type="button"
                          onClick={() => setPreviewClip(clip)}
                          aria-label={`Reproduzir ${clip.title}`}
                          className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-full bg-[#3984FF] text-white flex items-center justify-center shadow-lg">
                            <Play className="w-4 h-4 ml-0.5 fill-white" />
                          </div>
                        </button>
                      )}
                    </div>

                    {/* Text Details */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-white/[0.06] px-2 py-0.5 rounded text-[11px] font-bold text-zinc-300 border border-white/5">
                          Posição #{index + 1}
                        </span>

                        {isReady && <Chip label="Publicado" variant="active" size="sm" />}
                        {clip.status === "UPLOADING" && (
                          <Chip label="Enviando" variant="warning" size="sm" />
                        )}
                        {clip.status === "PROCESSING" && (
                          <Chip label="Processando" variant="info" size="sm" />
                        )}
                        {isFailed && <Chip label="Falha" variant="danger" size="sm" />}

                        <Chip
                          label={clip.isActive ? "Ativo" : "Inativo"}
                          variant={clip.isActive ? "active" : "inactive"}
                          size="sm"
                        />
                      </div>

                      <h3 className="text-base font-semibold text-white truncate">{clip.title}</h3>
                      {clip.description && (
                        <p className="text-xs text-zinc-400 line-clamp-1">{clip.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                        {clip.product && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-950/40 text-amber-300 border border-amber-500/20 font-medium">
                            <ShoppingCart className="w-3 h-3 text-amber-400" />
                            <span className="truncate max-w-[180px]">{clip.product.title}</span>
                          </span>
                        )}
                        <span className="text-zinc-500 font-mono text-[11px]">
                          ID: {clip.bunnyVideoId}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-white/[0.06]">
                    {/* Reorder Buttons */}
                    <div className="flex items-center gap-1">
                      <IconButton
                        aria-label="Subir posição"
                        onClick={() => handleMove(index, "up")}
                        disabled={index === 0}
                        variant="ghost"
                        size="sm"
                        icon={<ArrowUp className="w-4 h-4" />}
                      />
                      <IconButton
                        aria-label="Descer posição"
                        onClick={() => handleMove(index, "down")}
                        disabled={index === filteredClips.length - 1}
                        variant="ghost"
                        size="sm"
                        icon={<ArrowDown className="w-4 h-4" />}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      {isReady && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setPreviewClip(clip)}
                          leftIcon={<Play className="w-3.5 h-3.5" />}
                        >
                          Assistir
                        </Button>
                      )}
                      <IconButton
                        aria-label={clip.isActive ? "Desativar Clip" : "Ativar Clip"}
                        onClick={() => handleToggleActive(clip)}
                        variant={clip.isActive ? "ghost" : "primary"}
                        size="sm"
                        icon={
                          clip.isActive ? (
                            <EyeOff className="w-4 h-4 text-zinc-400" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )
                        }
                      />
                      <IconButton
                        aria-label="Editar Clip"
                        onClick={() => openEditModal(clip)}
                        variant="ghost"
                        size="sm"
                        icon={<Edit2 className="w-4 h-4" />}
                      />
                      <IconButton
                        aria-label="Excluir Clip"
                        onClick={() => confirmDeleteClip(clip)}
                        variant="danger"
                        size="sm"
                        icon={<Trash2 className="w-4 h-4" />}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Add / Edit Clip Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">
                  {editingClip ? "Editar Informações do Clip" : "Adicionar Novo Clip"}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {editingClip
                    ? "Atualize os metadados e o produto vinculado ao clip."
                    : "Envie um vídeo vertical de até 2 minutos para a vitrine."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                disabled={uploadStep === "UPLOADING" || uploadStep === "CREATING_SESSION"}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="p-5 space-y-4 overflow-y-auto flex-1">
              {uploadError && (
                <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/30 text-red-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{uploadError}</span>
                </div>
              )}

              {/* Title Input */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Título do Clip <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Demonstração e Detalhes do Produto"
                  disabled={uploadStep === "UPLOADING" || uploadStep === "CREATING_SESSION"}
                  className="w-full bg-[#181820] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#3984FF] transition-all disabled:opacity-50"
                />
              </div>

              {/* Description Input */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Descrição (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Escreva uma breve legenda para o vídeo..."
                  disabled={uploadStep === "UPLOADING" || uploadStep === "CREATING_SESSION"}
                  className="w-full bg-[#181820] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#3984FF] transition-all disabled:opacity-50 resize-none"
                />
              </div>

              {/* Linked Product Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-300">
                  Produto Vinculado (Opcional)
                </label>

                {selectedProductId ? (
                  (() => {
                    const selectedProd =
                      availableProducts.find((p) => p.id === selectedProductId) ||
                      (editingClip?.product?.id === selectedProductId ? editingClip.product : null);

                    return (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-white">
                        <div className="flex items-center gap-3 min-w-0">
                          {selectedProd?.coverUrl ? (
                            <img
                              src={selectedProd.coverUrl}
                              alt={selectedProd.title}
                              className="w-10 h-10 object-cover rounded-lg shrink-0 border border-white/10"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 text-amber-400">
                              <ShoppingCart className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                              {selectedProd?.title || "Produto selecionado"}
                            </p>
                            {selectedProd?.price !== undefined && (
                              <p className="text-[11px] font-semibold text-emerald-400">
                                R$ {Number(selectedProd.price).toFixed(2).replace(".", ",")}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedProductId(null)}
                          title="Remover produto vinculado"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={productSearchQuery}
                        onChange={(e) => setProductSearchQuery(e.target.value)}
                        placeholder="Pesquisar produto da loja para vincular..."
                        disabled={uploadStep === "UPLOADING" || uploadStep === "CREATING_SESSION"}
                        className="w-full bg-[#181820] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#3984FF] transition-all disabled:opacity-50"
                      />
                    </div>

                    <div className="max-h-32 overflow-y-auto space-y-1 border border-white/5 rounded-xl p-1 bg-[#181820]/60">
                      {availableProducts.filter((p) =>
                        p.title.toLowerCase().includes(productSearchQuery.toLowerCase().trim())
                      ).length === 0 ? (
                        <p className="text-xs text-zinc-500 text-center py-2.5">
                          {availableProducts.length === 0
                            ? "Nenhum produto cadastrado na loja"
                            : "Nenhum produto encontrado com este termo"}
                        </p>
                      ) : (
                        availableProducts
                          .filter((p) =>
                            p.title.toLowerCase().includes(productSearchQuery.toLowerCase().trim())
                          )
                          .map((prod) => (
                            <button
                              key={prod.id}
                              type="button"
                              onClick={() => setSelectedProductId(prod.id)}
                              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/5 text-left transition-colors cursor-pointer group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {prod.coverUrl ? (
                                  <img
                                    src={prod.coverUrl}
                                    alt={prod.title}
                                    className="w-7 h-7 object-cover rounded-md shrink-0"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-500">
                                    <ShoppingCart className="w-3.5 h-3.5" />
                                  </div>
                                )}
                                <span className="text-xs font-medium text-zinc-300 group-hover:text-white truncate">
                                  {prod.title}
                                </span>
                              </div>
                              <span className="text-xs font-semibold text-emerald-400 shrink-0 ml-2">
                                R$ {Number(prod.price).toFixed(2).replace(".", ",")}
                              </span>
                            </button>
                          ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Notice Banner: 2 Minutes Limit */}
              {!editingClip && (
                <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-500/20 text-sky-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Clips têm duração máxima permitida de <strong>2 minutos (120s)</strong>.
                  </p>
                </div>
              )}

              {/* Video File Selection Zone (New Clip only) */}
              {!editingClip && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Arquivo de Vídeo <span className="text-red-400">*</span>
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                      selectedFile
                        ? "border-emerald-500/50 bg-emerald-950/10"
                        : "border-white/10 hover:border-[#3984FF]/50 bg-[#181820] hover:bg-[#1E1E28]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#3984FF]/10 border border-[#3984FF]/20 flex items-center justify-center text-[#3984FF] mb-2.5">
                      <FileVideo className="w-5 h-5" />
                    </div>

                    {selectedFile ? (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white truncate max-w-xs">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-emerald-400 font-medium">
                          {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                          {detectedDuration ? ` • ${formatDurationHuman(detectedDuration)}` : ""} • Pronto para envio
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-white">
                          Selecione ou arraste seu vídeo aqui
                        </p>
                        <p className="text-xs text-zinc-400">
                          Formatos aceitos: MP4, MOV, WebM (Máx. 2 min)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Upload Progress Bar */}
              {(uploadStep === "CREATING_SESSION" ||
                uploadStep === "UPLOADING" ||
                uploadStep === "PROCESSING") && (
                <div className="p-4 rounded-xl bg-[#181820] border border-white/10 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-white flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#3984FF]" />
                      {uploadProgressText}
                    </span>
                    <span className="font-bold text-[#3984FF]">{uploadProgressPercent}%</span>
                  </div>

                  <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-[#3984FF] to-sky-400 transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgressPercent}%` }}
                    />
                  </div>

                  {uploadStep === "UPLOADING" && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleCancelUpload}
                        className="text-xs text-zinc-400 hover:text-red-400 underline transition-colors cursor-pointer"
                      >
                        Cancelar Envio
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={uploadStep === "UPLOADING" || uploadStep === "CREATING_SESSION"}
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  isLoading={
                    uploadStep === "UPLOADING" ||
                    uploadStep === "CREATING_SESSION" ||
                    uploadStep === "PROCESSING"
                  }
                  disabled={
                    isOverDurationLimit ||
                    (!editingClip && !selectedFile) ||
                    uploadStep === "CREATING_SESSION" ||
                    uploadStep === "UPLOADING" ||
                    uploadStep === "PROCESSING"
                  }
                >
                  {editingClip ? "Salvar Alterações" : "Enviar Vídeo"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal (Player) */}
      {previewClip && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <h3 className="text-sm font-bold text-white truncate">{previewClip.title}</h3>
                <p className="text-xs text-zinc-400">
                  {formatDuration(previewClip.duration)} • Bunny ID: {previewClip.bunnyVideoId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewClip(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player Display */}
            <div className="relative w-full aspect-[9/16] max-h-[65vh] bg-black flex items-center justify-center overflow-hidden">
              {previewClip.status === "READY" ? (
                (() => {
                  const cdnHost = previewClip.thumbnailUrl
                    ? previewClip.thumbnailUrl.replace(/^https?:\/\//, "").split("/")[0]
                    : null;
                  const mp4Url = cdnHost
                    ? `https://${cdnHost}/${previewClip.bunnyVideoId}/play_360p.mp4`
                    : null;

                  return mp4Url ? (
                    <video
                      controls
                      autoPlay
                      playsInline
                      poster={previewClip.thumbnailUrl || undefined}
                      src={mp4Url}
                      className="w-full h-full object-contain"
                    />
                  ) : previewClip.thumbnailUrl ? (
                    <img
                      src={previewClip.thumbnailUrl}
                      alt={previewClip.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-4 text-zinc-500">
                      <Film className="w-12 h-12 mx-auto mb-2 text-zinc-600" />
                      <p className="text-xs">Pré-visualização disponível no Mini App.</p>
                    </div>
                  );
                })()
              ) : (
                <div className="text-center p-6 space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin text-sky-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-white">Vídeo em Processamento</p>
                  <p className="text-xs text-zinc-400 max-w-xs">
                    O Bunny Stream está convertendo as resoluções do vídeo. O preview estará disponível assim que o status for Publicado.
                  </p>
                </div>
              )}
            </div>

            {/* Footer with Product Details */}
            {previewClip.product && (
              <div className="p-3.5 bg-white/[0.02] border-t border-white/[0.08] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {previewClip.product.coverUrl ? (
                    <img
                      src={previewClip.product.coverUrl}
                      alt={previewClip.product.title}
                      className="w-8 h-8 rounded-md object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center shrink-0 text-amber-400">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {previewClip.product.title}
                    </p>
                    <p className="text-xs font-bold text-emerald-400">
                      R$ {Number(previewClip.product.price).toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-amber-300 bg-amber-950/40 border border-amber-500/20 px-2 py-0.5 rounded-full shrink-0">
                  Vinculado
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingClip)}
        title="Excluir este Clip?"
        description={`Esta ação removerá permanentemente o vídeo "${deletingClip?.title}" da biblioteca Bunny Stream e do catálogo da loja.`}
        confirmLabel={isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteClip}
        onClose={() => setDeletingClip(null)}
      />
    </div>
  );
}
