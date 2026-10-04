"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Video,
  Plus,
  Trash2,
  Eye,
  Edit2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Upload,
  Film,
  Search,
  RefreshCw,
  HardDrive,
  Clock,
  Layers,
  FileVideo,
  LayoutGrid,
  List,
  AlertTriangle,
  MoreVertical,
  Play,
  Check,
  PackageCheck,
  Sparkles,
  CloudUpload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductVideoPlayer } from "@/components/miniapp/ProductVideoPlayer";
import { TusVideoUploader } from "@/lib/bunny/client-upload";

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
}

interface VideosClientProps {
  initialVideos: LibraryVideoItem[];
  initialUsage: VideoStorageUsage;
}

export default function VideosClient({ initialVideos, initialUsage }: VideosClientProps) {
  const [videosList, setVideosList] = useState<LibraryVideoItem[]>(initialVideos);
  const [usage, setUsage] = useState<VideoStorageUsage>(initialUsage);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Filters & Views
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Feedback Messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Close active dropdown menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".video-card-menu")) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  const showFeedback = (msg: string, isError = false) => {
    if (isError) setErrorMsg(msg);
    else setSuccessMsg(msg);
    setTimeout(() => {
      setErrorMsg(null);
      setSuccessMsg(null);
    }, 4000);
  };

  // Refresh Data from API
  const refreshData = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch("/api/seller/videos");
      const data = await res.json();
      if (data.success) {
        setVideosList(data.videos || []);
        if (data.usage) setUsage(data.usage);
      }
    } catch (err) {
      console.error("[VideosClient] Refresh Error:", err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  // Poll processing videos
  const hasPendingVideos = videosList.some(
    (v) => v.status === "UPLOADING" || v.status === "PROCESSING"
  );

  useEffect(() => {
    if (!hasPendingVideos) return;
    const interval = setInterval(() => {
      refreshData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [hasPendingVideos]);

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [formData, setFormData] = useState({ title: "", description: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStep, setUploadStep] = useState<"IDLE" | "CREATING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED">("IDLE");
  const [uploadProgressPercent, setUploadProgressPercent] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  // Edit Modal State
  const [editingVideo, setEditingVideo] = useState<LibraryVideoItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete Modal State
  const [deletingVideo, setDeletingVideo] = useState<LibraryVideoItem | null>(null);
  const [deleteWarningInfo, setDeleteWarningInfo] = useState<{
    isAssigned: boolean;
    assignedCount: number;
    products: { id: string; title: string }[];
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Preview Player Modal State
  const [previewVideo, setPreviewVideo] = useState<LibraryVideoItem | null>(null);
  const [previewPlayback, setPreviewPlayback] = useState<{ playbackUrl: string; directUrl: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // --- Handlers: Upload ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setUploadError("Por favor, selecione um arquivo de vídeo válido.");
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
    if (!formData.title) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setFormData((prev) => ({ ...prev, title: nameWithoutExt }));
    }
  };

  const handleStartUpload = async () => {
    if (!selectedFile) {
      setUploadError("Selecione um arquivo de vídeo.");
      return;
    }
    if (!formData.title.trim()) {
      setUploadError("O título do vídeo é obrigatório.");
      return;
    }

    setUploadStep("CREATING");
    setUploadProgressPercent(0);
    setUploadError(null);

    const abortController = new AbortController();
    uploadAbortRef.current = abortController;

    try {
      const sessionRes = await fetch("/api/seller/videos/upload-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          fileSizeBytes: selectedFile.size,
          fileName: selectedFile.name,
        }),
        signal: abortController.signal,
      });

      const sessionData = await sessionRes.json();
      if (!sessionData.success) {
        throw new Error(sessionData.error || "Falha ao iniciar sessão de upload.");
      }

      const { uploadAuth } = sessionData;

      setUploadStep("UPLOADING");
      const uploader = new TusVideoUploader();

      await uploader.uploadVideo({
        file: selectedFile,
        tusUploadUrl: uploadAuth.tusUploadUrl || "https://video.bunnycdn.com/tusupload",
        headers: uploadAuth.headers,
        signal: abortController.signal,
        onProgress: (p) => {
          setUploadProgressPercent(p.percentage);
        },
      });

      setUploadStep("PROCESSING");
      showFeedback("Upload concluído! O vídeo está sendo processado pelo Bunny Stream.");
      setIsUploadModalOpen(false);
      resetUploadForm();
      refreshData();
    } catch (err: any) {
      console.error("[VideosClient] Upload error:", err);
      setUploadStep("FAILED");
      setUploadError(err.message || "Ocorreu um erro durante o upload.");
    }
  };

  const resetUploadForm = () => {
    setSelectedFile(null);
    setFormData({ title: "", description: "" });
    setUploadStep("IDLE");
    setUploadProgressPercent(0);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- Handlers: Edit ---
  const handleOpenEdit = (video: LibraryVideoItem) => {
    setEditingVideo(video);
    setEditTitle(video.title);
    setEditDescription(video.description || "");
    setActiveMenuId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingVideo) return;
    if (!editTitle.trim()) {
      showFeedback("O título não pode ser vazio.", true);
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

      showFeedback("Vídeo atualizado com sucesso!");
      setEditingVideo(null);
      refreshData();
    } catch (err: any) {
      showFeedback(err.message || "Erro ao salvar alterações.", true);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // --- Handlers: Delete ---
  const handleOpenDelete = (video: LibraryVideoItem) => {
    setDeletingVideo(video);
    setActiveMenuId(null);
    const assignedCount = video.assignmentCount || video.assignments?.length || 0;
    if (assignedCount > 0) {
      setDeleteWarningInfo({
        isAssigned: true,
        assignedCount,
        products: video.assignments?.map((a) => ({ id: a.productId, title: a.productTitle || "Produto" })) || [],
      });
    } else {
      setDeleteWarningInfo(null);
    }
  };

  const handleConfirmDelete = async (force = false) => {
    if (!deletingVideo) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/seller/videos/${deletingVideo.id}?force=${force ? "true" : "false"}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!data.success) {
        if (data.isAssigned) {
          setDeleteWarningInfo({
            isAssigned: true,
            assignedCount: data.assignedCount,
            products: data.products || [],
          });
          setIsDeleting(false);
          return;
        }
        throw new Error(data.error || "Erro ao excluir vídeo.");
      }

      showFeedback("Vídeo excluído da biblioteca!");
      setDeletingVideo(null);
      setDeleteWarningInfo(null);
      refreshData();
    } catch (err: any) {
      showFeedback(err.message || "Erro ao excluir vídeo.", true);
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Handlers: Preview ---
  const handleOpenPreview = async (video: LibraryVideoItem) => {
    setActiveMenuId(null);
    if (video.status !== "READY") {
      showFeedback("Este vídeo ainda está sendo processado.", true);
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
      showFeedback(err.message || "Erro ao abrir preview do vídeo.", true);
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
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  // Filtered List
  const filteredVideos = videosList.filter((v) => {
    const matchesSearch = searchQuery
      ? v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    const matchesStatus =
      statusFilter === "ALL" ? true : v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const readyCount = videosList.filter((v) => v.status === "READY").length;
  const processingCount = videosList.filter(
    (v) => v.status === "PROCESSING" || v.status === "UPLOADING"
  ).length;

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 p-4 sm:p-6 md:p-8 space-y-8">
      {/* Toast Feedbacks */}
      {errorMsg && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-red-950/90 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-sm font-medium">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase font-sans">
                  BIBLIOTECA DE VÍDEOS
                </h1>
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full tracking-widest">
                  Studio Media Manager
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                Gerencie sua biblioteca, organize seus conteúdos e conecte vídeos aos seus produtos.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshData()}
            disabled={isRefreshing}
            className="border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isRefreshing ? "animate-spin text-amber-500" : ""}`} />
            Atualizar
          </Button>

          <Button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold px-4 py-2 text-sm shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar vídeo
          </Button>
        </div>
      </div>

      {/* 2. CARD DE ARMAZENAMENTO */}
      <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-900/60 to-zinc-950/80 border border-zinc-800/80 rounded-2xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs tracking-wider uppercase">
            <HardDrive className="w-4 h-4 text-amber-500" />
            <span>ARMAZENAMENTO DE VÍDEOS</span>
          </div>
          <span className="text-xs font-mono font-medium text-zinc-300 bg-zinc-950/80 border border-zinc-800/80 px-2.5 py-1 rounded-lg">
            {usage.usedGB.toFixed(1)} GB / {usage.quotaGB > 0 ? `${usage.quotaGB} GB` : "Ilimitado"}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-zinc-950/90 border border-zinc-800/80 rounded-full h-3 overflow-hidden p-0.5 mb-2.5 relative z-10 shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              usage.percentage > 90
                ? "bg-gradient-to-r from-red-600 to-red-400"
                : usage.percentage > 75
                ? "bg-gradient-to-r from-amber-600 to-amber-400"
                : "bg-gradient-to-r from-amber-500 to-emerald-400"
            }`}
            style={{ width: `${Math.min(Math.max(usage.percentage, 2), 100)}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-xs text-zinc-400 font-mono relative z-10">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
            {usage.percentage.toFixed(1)}% utilizado
          </span>
          <span>{usage.freeGB.toFixed(1)} GB disponíveis</span>
        </div>
      </div>

      {/* 3. KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700/80 transition">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-semibold tracking-wider uppercase">VÍDEOS</span>
            <Video className="w-4 h-4 text-amber-500/80" />
          </div>
          <div>
            <span className="text-2xl font-bold text-white font-mono">{videosList.length}</span>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {videosList.length === 0 ? "Nenhum vídeo enviado" : `${videosList.length} vídeos no catálogo`}
            </p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700/80 transition">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-semibold tracking-wider uppercase">ARMAZENAMENTO</span>
            <HardDrive className="w-4 h-4 text-amber-500/80" />
          </div>
          <div>
            <span className="text-2xl font-bold text-white font-mono">{usage.usedGB.toFixed(1)} GB</span>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {usage.freeGB.toFixed(1)} GB disponíveis
            </p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700/80 transition">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-semibold tracking-wider uppercase">DISPONÍVEIS</span>
            <CloudUpload className="w-4 h-4 text-emerald-400/80" />
          </div>
          <div>
            <span className="text-2xl font-bold text-emerald-400 font-mono">{usage.freeGB.toFixed(1)} GB</span>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Quota restante no plano
            </p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700/80 transition">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-semibold tracking-wider uppercase">PRONTOS</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400/80" />
          </div>
          <div>
            <span className="text-2xl font-bold text-white font-mono">{readyCount}</span>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {readyCount === 0 ? "Nenhum processado" : `${readyCount} prontos para uso`}
            </p>
          </div>
        </div>
      </div>

      {/* 4. BARRA DE BUSCA E FILTROS */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-zinc-900/40 p-3.5 border border-zinc-800/80 rounded-xl backdrop-blur-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar vídeos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-950/80 border border-zinc-800/80 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 transition-colors"
          />
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3">
          <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
            {filteredVideos.length} {filteredVideos.length === 1 ? "vídeo" : "vídeos"}
          </span>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-amber-500/80 transition-colors cursor-pointer"
            >
              <option value="ALL">Todos</option>
              <option value="READY">Prontos</option>
              <option value="PROCESSING">Processando</option>
              <option value="UPLOADING">Enviando</option>
              <option value="FAILED">Erro</option>
            </select>

            <div className="flex items-center bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "grid" ? "bg-zinc-800 text-amber-400 shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "list" ? "bg-zinc-800 text-amber-400 shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5, 10, 14. GRID & LIST VIEWS / EMPTY STATE */}
      {filteredVideos.length === 0 ? (
        /* 10. ESTADO VAZIO PREMIUM */
        <div className="bg-gradient-to-b from-zinc-900/60 to-zinc-950/80 border border-zinc-800/80 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-lg mb-2">
            <Film className="w-8 h-8" />
          </div>

          <div className="max-w-md space-y-1.5">
            <h3 className="text-lg font-bold tracking-wider text-white uppercase">
              SEU CATÁLOGO DE VÍDEOS COMEÇA AQUI
            </h3>
            <p className="text-xs text-zinc-400">
              Envie seus vídeos uma vez e reutilize-os em vários produtos.
            </p>
          </div>

          <Button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold px-6 py-2.5 text-sm shadow-xl shadow-amber-500/20 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar primeiro vídeo
          </Button>

          <p className="text-[11px] text-zinc-500 max-w-xs pt-2">
            Seus vídeos processados ficam disponíveis na biblioteca para serem associados aos seus produtos.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* 5. GRID DE VÍDEOS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredVideos.map((video) => {
            const assignedCount = video.assignmentCount || video.assignments?.length || 0;
            return (
              <div
                key={video.id}
                className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden shadow-lg flex flex-col hover:border-zinc-700/80 hover:shadow-2xl transition-all duration-200 group relative"
              >
                {/* Thumbnail Header */}
                <div
                  className="relative aspect-video bg-zinc-950 overflow-hidden cursor-pointer group-hover:brightness-105"
                  onClick={() => video.status === "READY" && handleOpenPreview(video)}
                >
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-zinc-700 space-y-1">
                      <Film className="w-8 h-8 text-zinc-700" />
                      <span className="text-[10px] text-zinc-600 font-mono">Media Manager</span>
                    </div>
                  )}

                  {/* Play Hover Overlay */}
                  {video.status === "READY" && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>
                  )}

                  {/* 6. STATUS BADGES */}
                  <div className="absolute top-2.5 left-2.5">
                    {video.status === "READY" && (
                      <span className="bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1 shadow-md">
                        <Check className="w-3 h-3" /> PRONTO
                      </span>
                    )}
                    {video.status === "PROCESSING" && (
                      <span className="bg-amber-950/90 border border-amber-500/40 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1 shadow-md">
                        <Loader2 className="w-3 h-3 animate-spin" /> PROCESSANDO
                      </span>
                    )}
                    {video.status === "UPLOADING" && (
                      <span className="bg-amber-950/90 border border-amber-500/40 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1 shadow-md">
                        <Upload className="w-3 h-3" /> ENVIANDO
                      </span>
                    )}
                    {video.status === "FAILED" && (
                      <span className="bg-red-950/90 border border-red-500/40 text-red-300 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1 shadow-md">
                        ! ERRO
                      </span>
                    )}
                  </div>

                  {/* Duration Badge */}
                  {video.durationSeconds && video.durationSeconds > 0 && (
                    <div className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-md text-zinc-200 text-[10px] font-mono font-medium px-2 py-0.5 rounded border border-white/10">
                      {formatDuration(video.durationSeconds)}
                    </div>
                  )}
                </div>

                {/* 7 & 8. INFORMAÇÕES E AÇÕES DO CARD */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className="font-semibold text-zinc-100 text-sm line-clamp-1 group-hover:text-amber-400 transition-colors"
                        title={video.title}
                      >
                        {video.title}
                      </h3>

                      {/* 8. DROPDOWN MENU (⋮) */}
                      <div className="relative video-card-menu">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === video.id ? null : video.id);
                          }}
                          className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {activeMenuId === video.id && (
                          <div className="absolute right-0 top-7 z-30 w-44 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl py-1 text-xs text-zinc-200 animate-in fade-in zoom-in-95">
                            {video.status === "READY" && (
                              <button
                                onClick={() => handleOpenPreview(video)}
                                className="w-full text-left px-3 py-2 hover:bg-zinc-900 flex items-center gap-2 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-amber-500" /> Visualizar
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenEdit(video)}
                              className="w-full text-left px-3 py-2 hover:bg-zinc-900 flex items-center gap-2 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-zinc-400" /> Editar
                            </button>
                            <button
                              onClick={() => handleOpenDelete(video)}
                              className="w-full text-left px-3 py-2 hover:bg-red-950/40 text-red-400 flex items-center gap-2 transition-colors border-t border-zinc-900 mt-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {video.description && (
                      <p className="text-xs text-zinc-400 line-clamp-2 mt-1 font-sans">
                        {video.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                    <span>{formatFileSize(video.fileSizeBytes)}</span>
                    <span className="flex items-center gap-1 text-zinc-400 font-sans text-xs">
                      <Layers className="w-3 h-3 text-amber-500/80" />
                      {assignedCount > 0 ? `Usado em ${assignedCount} produto${assignedCount > 1 ? "s" : ""}` : "Não associado"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 14. LIST VIEW RESPONSIVA */
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden shadow-xl">
          <div className="divide-y divide-zinc-800/80">
            {filteredVideos.map((video) => {
              const assignedCount = video.assignmentCount || video.assignments?.length || 0;
              return (
                <div
                  key={video.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-850/40 transition group"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div
                      className="w-24 aspect-video bg-zinc-950 rounded-lg overflow-hidden relative shrink-0 border border-zinc-800 cursor-pointer"
                      onClick={() => video.status === "READY" && handleOpenPreview(video)}
                    >
                      {video.thumbnailUrl ? (
                        <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700">
                          <Film className="w-6 h-6" />
                        </div>
                      )}
                      {video.durationSeconds && video.durationSeconds > 0 && (
                        <span className="absolute bottom-1 right-1 bg-black/80 text-[9px] font-mono text-zinc-300 px-1 rounded">
                          {formatDuration(video.durationSeconds)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <h4
                        className="font-semibold text-zinc-100 text-sm truncate group-hover:text-amber-400 transition-colors"
                        title={video.title}
                      >
                        {video.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 font-mono">
                        <span>{formatFileSize(video.fileSizeBytes)}</span>
                        <span>•</span>
                        <span className="text-zinc-400 font-sans">
                          {assignedCount > 0 ? `Usado em ${assignedCount} produto(s)` : "Sem associação"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-800/60">
                    <div className="text-xs">
                      {video.status === "READY" && (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> PRONTO
                        </span>
                      )}
                      {video.status === "PROCESSING" && (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> PROCESSANDO
                        </span>
                      )}
                      {video.status === "UPLOADING" && (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <Upload className="w-3.5 h-3.5" /> ENVIANDO
                        </span>
                      )}
                      {video.status === "FAILED" && <span className="text-red-400 font-bold">! ERRO</span>}
                    </div>

                    <div className="flex items-center gap-2">
                      {video.status === "READY" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenPreview(video)}
                          className="border-zinc-800 text-xs text-zinc-300 hover:bg-zinc-800"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1 text-amber-500" /> Visualizar
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(video)}
                        className="border-zinc-800 text-xs text-zinc-300 hover:bg-zinc-800 p-2"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDelete(video)}
                        className="border-zinc-800 text-xs text-red-400 hover:bg-red-950/40 p-2"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 11. UPLOAD MODAL PREMIUM */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-wide">
                <Upload className="w-5 h-5 text-amber-500" />
                ADICIONAR VÍDEO
              </h3>
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  resetUploadForm();
                }}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="bg-red-950/80 border border-red-500/40 text-red-200 text-xs p-3.5 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Título do Vídeo *</label>
                <input
                  type="text"
                  placeholder="Ex: Aula 01 — Apresentação do Curso"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Descrição (opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Resumo ou observações..."
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Arquivo de Vídeo *</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-800 hover:border-amber-500/60 bg-zinc-950/80 hover:bg-zinc-950 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CloudUpload className="w-6 h-6" />
                  </div>
                  {selectedFile ? (
                    <div className="text-xs text-amber-400 font-mono font-medium">
                      {selectedFile.name} ({formatFileSize(selectedFile.size)})
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-zinc-200">Arraste seu vídeo aqui</div>
                      <span className="text-xs text-zinc-500">ou clique para selecionar do seu dispositivo</span>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Progress & Processing State */}
              {(uploadStep === "CREATING" || uploadStep === "UPLOADING" || uploadStep === "PROCESSING") && (
                <div className="space-y-2.5 bg-zinc-950/90 p-4 border border-zinc-800 rounded-xl">
                  <div className="flex justify-between text-xs font-mono text-zinc-300">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                      {uploadStep === "CREATING" && "Reservando quota de armazenamento..."}
                      {uploadStep === "UPLOADING" && `Enviando arquivo (${uploadProgressPercent}%)`}
                      {uploadStep === "PROCESSING" && "PROCESSANDO VÍDEO NO BUNNY STREAM..."}
                    </span>
                    <span>{uploadProgressPercent}%</span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full transition-all duration-300"
                      style={{ width: `${uploadProgressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center border-t border-zinc-800 pt-4">
              <span className="text-[11px] text-zinc-500 font-mono">
                Disponível: {usage.freeGB.toFixed(1)} GB
              </span>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    resetUploadForm();
                  }}
                  disabled={uploadStep === "UPLOADING" || uploadStep === "CREATING"}
                  className="border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleStartUpload}
                  disabled={!selectedFile || !formData.title.trim() || uploadStep === "UPLOADING" || uploadStep === "CREATING"}
                  className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold"
                >
                  {uploadStep === "CREATING" || uploadStep === "UPLOADING" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Iniciar Upload"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2 uppercase">
                <Edit2 className="w-4 h-4 text-amber-500" />
                Editar Vídeo
              </h3>
              <button onClick={() => setEditingVideo(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Título</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Descrição</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-zinc-800 pt-3">
              <Button
                variant="outline"
                onClick={() => setEditingVideo(null)}
                className="border-zinc-800 text-zinc-300"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={isSavingEdit || !editTitle.trim()}
                className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold"
              >
                {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2 uppercase">
                <Trash2 className="w-4 h-4 text-red-500" />
                Excluir da Biblioteca
              </h3>
              <button
                onClick={() => {
                  setDeletingVideo(null);
                  setDeleteWarningInfo(null);
                }}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deleteWarningInfo?.isAssigned ? (
              <div className="space-y-4">
                <div className="bg-amber-950/80 border border-amber-500/40 text-amber-200 text-xs p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-400">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>Este vídeo está vinculado a {deleteWarningInfo.assignedCount} produto(s).</span>
                  </div>
                  <p className="text-zinc-300">
                    A exclusão da biblioteca removerá o arquivo do Bunny Stream e desvinculará o vídeo dos produtos abaixo:
                  </p>
                  <ul className="list-disc list-inside font-semibold text-amber-300 pt-1 space-y-1">
                    {deleteWarningInfo.products.map((p) => (
                      <li key={p.id}>{p.title}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-300">
                Tem certeza que deseja excluir o vídeo <strong className="text-white">"{deletingVideo.title}"</strong> da sua biblioteca?
                Esta ação liberará o espaço físico e é irreversível.
              </p>
            )}

            <div className="flex justify-end gap-3 border-t border-zinc-800 pt-3">
              <Button
                variant="outline"
                onClick={() => {
                  setDeletingVideo(null);
                  setDeleteWarningInfo(null);
                }}
                className="border-zinc-800 text-zinc-300"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleConfirmDelete(deleteWarningInfo?.isAssigned ? true : false)}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : deleteWarningInfo?.isAssigned ? (
                  "Confirmar Exclusão Definitiva"
                ) : (
                  "Excluir Vídeo"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 9. PREVIEW MODAL */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Film className="w-4 h-4 text-amber-500" />
                {previewVideo.title}
              </h3>
              <button onClick={() => setPreviewVideo(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-video bg-black rounded-xl overflow-hidden relative flex items-center justify-center border border-zinc-800 shadow-2xl">
              {isLoadingPreview ? (
                <div className="flex flex-col items-center text-zinc-400 space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                  <span className="text-xs font-mono">Obtendo tokens de reprodução...</span>
                </div>
              ) : previewPlayback ? (
                <ProductVideoPlayer
                  videoId={previewVideo.id}
                  playbackUrl={previewPlayback.playbackUrl}
                  directUrl={previewPlayback.directUrl}
                  posterUrl={previewVideo.thumbnailUrl || undefined}
                  title={previewVideo.title}
                />
              ) : (
                <span className="text-xs text-red-400">Não foi possível carregar o vídeo.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
