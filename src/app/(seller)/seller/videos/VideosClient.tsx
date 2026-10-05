"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Search,
  RefreshCw,
  HardDrive,
  Check,
  MoreVertical,
  Play,
  LayoutGrid,
  List,
  AlertTriangle,
  Layers,
  CloudUpload,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductVideoPlayer } from "@/components/miniapp/ProductVideoPlayer";
import { TusVideoUploader } from "@/lib/bunny/client-upload";
import { PlanUpgradeModal } from "@/components/billing/PlanUpgradeModal";
import { VideoPlanUpgradeModal } from "@/components/billing/VideoPlanUpgradeModal";
import { InlineVideoLibraryOnboarding } from "./InlineVideoLibraryOnboarding";

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

interface VideosClientProps {
  initialVideos: LibraryVideoItem[];
  initialUsage: VideoStorageUsage;
}

const GB = 1024 * 1024 * 1024;
const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Accepts either the UI shape (usedGB/quotaGB/freeGB/percentage) or the raw
 * service shape returned by /api/seller/videos (usedBytes/quotaGb/remainingBytes/percentUsed)
 * and always returns a fully-populated VideoStorageUsage.
 */
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
  return { usedBytes, quotaBytes, reservedBytes, usedGB, quotaGB, freeGB, percentage };
}

export default function VideosClient({ initialVideos, initialUsage }: VideosClientProps) {
  const [videosList, setVideosList] = useState<LibraryVideoItem[]>(initialVideos);
  const [usage, setUsage] = useState<VideoStorageUsage>(() => normalizeUsage(initialUsage));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Filters & Views
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Feedback Messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isVideoPlanModalOpen, setIsVideoPlanModalOpen] = useState(false);

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
        setVideosList(Array.isArray(data.videos) ? data.videos : []);
        if (data.usage) setUsage(normalizeUsage(data.usage));
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

  // Upload & Upgrade Modal State
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
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
          fileSize: selectedFile.size,
          fileSizeBytes: selectedFile.size,
          contentType: selectedFile.type || "video/mp4",
          fileName: selectedFile.name,
        }),
        signal: abortController.signal,
      });

      const sessionData = await sessionRes.json();
      if (!sessionData.success) {
        throw new Error(sessionData.error || "Falha ao iniciar sessão de upload.");
      }

      const uploadAuth = sessionData.uploadSession || sessionData.uploadAuth;
      if (!uploadAuth) {
        throw new Error("Sessão de upload inválida (parâmetros de autenticação ausentes).");
      }

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
      showFeedback("Upload concluído! O vídeo está sendo processado.");
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
    const assignedCount = video.assignedProductsCount || video.assignmentCount || video.assignments?.length || 0;
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

  return (
    <div className="space-y-6 fade-in w-full max-w-full overflow-hidden min-w-0 pb-16">
      {/* Toast Feedbacks */}
      {errorMsg && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-red-950/90 border border-red-500/30 text-red-200 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-xs font-medium">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-emerald-950/90 border border-emerald-500/30 text-emerald-200 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium">{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 5. HEADER (Standardized WebGran Header) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400 flex items-center justify-center font-bold">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-xl text-white">BIBLIOTECA DE VÍDEOS</h1>
              {usage.hasVideoSubscription && (
                <span className="bg-violet-600/20 border border-violet-500/30 text-violet-400 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {videosList.length} vídeos
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">Gerencie seus vídeos e utilize-os na entrega automática de produtos digitais.</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshData()}
            disabled={isRefreshing}
            className="bg-[#16161C] border-white/10 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs rounded-xl"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin text-violet-500" : ""}`} />
            Atualizar
          </Button>

          {usage.hasVideoSubscription && (
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl px-4 py-2 shadow-lg shadow-violet-600/20 transition-all"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Adicionar vídeo
            </Button>
          )}
        </div>
      </div>

      {/* PAYWALL / LOCK SCREEN FOR UN-SUBSCRIBED SELLERS */}
      {!usage.hasVideoSubscription && !usage.isUnlimited ? (
        <InlineVideoLibraryOnboarding
          onSubscriptionSuccess={() => refreshData()}
        />
      ) : (
        <>
          {/* ACTIVE SUBSCRIPTION STORAGE BAR */}
          {(() => {
            const isUnlimited = Boolean(usage.isUnlimited);
            const isOverQuota = !isUnlimited && usage.usedGB > usage.quotaGB;
            const isFull = !isUnlimited && (usage.percentage >= 100 || isOverQuota);
            const isNearFull = !isUnlimited && usage.percentage >= 90 && usage.percentage < 100;
            const isWarning = !isUnlimited && usage.percentage >= 80 && usage.percentage < 90;

            return (
              <div className="bg-[#0F0F12] border border-white/5 rounded-2xl p-5 shadow-lg relative overflow-hidden space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-zinc-300 font-bold text-xs uppercase tracking-wider">
                    <HardDrive className="w-4 h-4 text-violet-400" />
                    <span>PLANO: {usage.planName || (isUnlimited ? "ADMIN / ILIMITADO" : "ATIVO")}</span>
                    {usage.planPriceCents && (
                      <span className="text-[10px] text-zinc-400 font-normal">
                        (R$ {(usage.planPriceCents / 100).toFixed(2).replace(".", ",")} / mês)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-zinc-300 font-bold">
                      {usage.usedGB.toFixed(1)} GB / {isUnlimited ? "ILIMITADO" : `${usage.quotaGB} GB`}
                    </span>
                    {!isUnlimited && (
                      <Button
                        size="sm"
                        onClick={() => setIsVideoPlanModalOpen(true)}
                        className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl px-3 py-1 shadow-md shadow-violet-600/20"
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                        FAZER UPGRADE
                      </Button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-[#16161C] border border-white/10 rounded-full h-3 overflow-hidden p-0.5 shadow-inner">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isFull ? "bg-red-600 animate-pulse" : isNearFull ? "bg-orange-500" : isWarning ? "bg-amber-500" : "bg-violet-500"
                    }`}
                    style={{ width: `${isUnlimited ? 100 : Math.min(Math.max(usage.percentage, 1), 100)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-xs text-zinc-400 font-mono">
                  <span>{isUnlimited ? "Uso sem restrições" : `${usage.percentage.toFixed(1)}% utilizado`}</span>
                  <span>{isUnlimited ? "Ilimitado" : `${usage.freeGB.toFixed(1)} GB disponíveis`}</span>
                </div>

                {/* Warnings Banners */}
                {isOverQuota && (
                  <div className="mt-2 p-3 rounded-xl bg-red-950/80 border border-red-500/30 text-red-200 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>Seu plano atual possui {usage.quotaGB} GB, mas você utiliza {usage.usedGB.toFixed(1)} GB. Exclua arquivos ou faça upgrade para continuar enviando vídeos.</span>
                    </div>
                    <Button size="sm" onClick={() => setIsVideoPlanModalOpen(true)} className="bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg shrink-0">
                      Aumentar Armazenamento
                    </Button>
                  </div>
                )}

                {!isOverQuota && isFull && (
                  <div className="mt-2 p-3 rounded-xl bg-red-950/80 border border-red-500/30 text-red-200 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>Seu armazenamento está cheio. Faça upgrade para continuar enviando vídeos.</span>
                    </div>
                    <Button size="sm" onClick={() => setIsVideoPlanModalOpen(true)} className="bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg shrink-0">
                      Aumentar Armazenamento
                    </Button>
                  </div>
                )}

                {!isFull && isNearFull && (
                  <div className="mt-2 p-3 rounded-xl bg-orange-950/80 border border-orange-500/30 text-orange-200 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                    <span>Seu armazenamento está quase cheio (90%).</span>
                  </div>
                )}

                {!isFull && !isNearFull && isWarning && (
                  <div className="mt-2 p-3 rounded-xl bg-amber-950/80 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Você já utilizou 80% do armazenamento.</span>
                  </div>
                )}
              </div>
            );
          })()}

      {/* 7. KPIs (Matching Dashboard KPI Grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-full">
        <div className="bg-[#0F0F12] border border-white/5 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-zinc-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">VÍDEOS</span>
            <Film className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate font-mono">{videosList.length}</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{videosList.length === 0 ? "Nenhum vídeo enviado" : `${videosList.length} vídeos no catálogo`}</p>
          </div>
        </div>

        <div className="bg-[#0F0F12] border border-white/5 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-zinc-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">ARMAZENAMENTO</span>
            <HardDrive className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate font-mono">{usage.usedGB.toFixed(1)} GB</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{usage.freeGB.toFixed(1)} GB disponíveis</p>
          </div>
        </div>

        <div className="bg-[#0F0F12] border border-white/5 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-zinc-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">DISPONÍVEIS</span>
            <CloudUpload className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate font-mono">{usage.freeGB.toFixed(1)} GB</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">Quota restante do plano</p>
          </div>
        </div>

        <div className="bg-[#0F0F12] border border-white/5 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-zinc-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">PRONTOS</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate font-mono">{readyCount}</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{readyCount === 0 ? "Nenhum processado" : `${readyCount} prontos para uso`}</p>
          </div>
        </div>
      </div>

      {/* 8. TOOLBAR (Matching Products Filter & Search Bar) */}
      <div className="flex flex-col md:flex-row items-center gap-3 bg-[#0F0F12] p-3 border border-white/5 rounded-2xl shadow-lg">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Buscar em ${videosList.length} vídeos...`}
            className="w-full bg-[#16161C] border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-red-500/50 transition-all placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>

        <div className="w-full md:w-auto shrink-0 flex items-center justify-between md:justify-end gap-2">
          <span className="text-xs text-zinc-500 font-mono hidden sm:inline mr-1">
            {filteredVideos.length} {filteredVideos.length === 1 ? "vídeo" : "vídeos"}
          </span>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#16161C] border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-red-500/50 transition-all w-full md:w-40 appearance-none"
          >
            <option value="ALL">Todos os status</option>
            <option value="READY">Prontos</option>
            <option value="PROCESSING">Processando</option>
            <option value="UPLOADING">Enviando</option>
            <option value="FAILED">Erro</option>
          </select>

          <div className="flex bg-[#16161C] p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-red-600 text-white shadow" : "text-zinc-500 hover:text-white"}`}
              title="Visualização em Grade"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-red-600 text-white shadow" : "text-zinc-500 hover:text-white"}`}
              title="Visualização em Lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 9 & 10. GRID & LIST VIEWS / COMPACT EMPTY STATE */}
      {filteredVideos.length === 0 ? (
        /* 10. COMPACT EMPTY STATE */
        <div className="py-12 text-center flex flex-col items-center justify-center bg-[#0F0F12] rounded-2xl border border-white/5 shadow-xl p-6">
          <div className="w-14 h-14 rounded-2xl bg-[#16161C] flex items-center justify-center mb-3 border border-white/5">
            <Film className="w-7 h-7 text-zinc-500" />
          </div>
          <h3 className="text-white font-bold text-sm mb-1">Nenhum vídeo encontrado</h3>
          <p className="text-zinc-500 text-xs max-w-sm mb-5">
            {videosList.length === 0
              ? "Envie seu primeiro vídeo para começar a utilizar na sua biblioteca."
              : "Nenhum vídeo corresponde aos termos da busca."}
          </p>
          <Button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl px-4 py-2 shadow-lg shadow-red-600/20"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Adicionar vídeo
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        /* 9. GRID DE VÍDEOS (Standardized WebGran Product Grid Layout) */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filteredVideos.map((video) => {
            const assignedCount = video.assignedProductsCount || video.assignmentCount || video.assignments?.length || 0;
            return (
              <div
                key={video.id}
                className={`bg-[#0F0F12] border border-white/5 rounded-2xl flex flex-col shadow-lg hover:border-white/10 transition-all duration-200 group relative ${
                  activeMenuId === video.id ? "z-40" : "z-10"
                }`}
              >
                {/* Compact Fixed Height Image Banner (h-36 = 144px) */}
                <div
                  className="w-full h-36 bg-zinc-900 relative rounded-t-2xl overflow-hidden shrink-0 border-b border-white/5 cursor-pointer"
                  onClick={() => video.status === "READY" && handleOpenPreview(video)}
                >
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-1">
                      <Film className="w-7 h-7" />
                      <span className="text-[10px]">Sem thumbnail</span>
                    </div>
                  )}

                  {/* Play Overlay */}
                  {video.status === "READY" && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                    </div>
                  )}

                  {/* Status Badges */}
                  <div className="absolute top-2.5 left-2.5 z-10">
                    {video.status === "READY" && (
                      <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md border border-emerald-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> PRONTO
                      </span>
                    )}
                    {video.status === "PROCESSING" && (
                      <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md border border-amber-500/30 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> PROCESSANDO
                      </span>
                    )}
                    {video.status === "UPLOADING" && (
                      <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md border border-blue-500/30 flex items-center gap-1">
                        <Upload className="w-3 h-3" /> ENVIANDO
                      </span>
                    )}
                    {video.status === "FAILED" && (
                      <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md border border-red-500/30">
                        ! ERRO
                      </span>
                    )}
                  </div>

                  {/* Duration Badge */}
                  {video.durationSeconds && video.durationSeconds > 0 && (
                    <div className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-md text-zinc-300 text-[10px] font-mono px-2 py-0.5 rounded border border-white/10">
                      {formatDuration(video.durationSeconds)}
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3 rounded-b-2xl">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3
                        className="text-white font-bold text-sm truncate group-hover:text-red-400 transition-colors"
                        title={video.title}
                      >
                        {video.title}
                      </h3>

                      {/* Dropdown Menu (⋮) */}
                      <div className="relative video-card-menu">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === video.id ? null : video.id);
                          }}
                          className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-[#16161C] transition"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {activeMenuId === video.id && (
                          <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-[#121216] border border-white/10 rounded-xl shadow-2xl py-1 text-xs text-zinc-200 animate-in fade-in zoom-in-95 duration-100">
                            {video.status === "READY" && (
                              <button
                                onClick={() => handleOpenPreview(video)}
                                className="w-full text-left px-3 py-2 hover:bg-[#1A1A22] flex items-center gap-2 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-red-400" /> Visualizar
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenEdit(video)}
                              className="w-full text-left px-3 py-2 hover:bg-[#1A1A22] flex items-center gap-2 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-zinc-400" /> Editar
                            </button>
                            <button
                              onClick={() => handleOpenDelete(video)}
                              className="w-full text-left px-3 py-2 hover:bg-red-950/40 text-red-400 flex items-center gap-2 transition-colors border-t border-white/5 mt-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {video.description && (
                      <p className="text-xs text-zinc-400 line-clamp-2">
                        {video.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400 font-mono">
                    <span>{formatFileSize(video.fileSizeBytes)}</span>
                    <span className="flex items-center gap-1 text-zinc-400 font-sans text-xs">
                      <Layers className="w-3 h-3 text-red-400" />
                      {assignedCount > 0 ? `Usado em ${assignedCount} produto${assignedCount > 1 ? "s" : ""}` : "Não associado"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW RESPONSIVA */
        <div className="bg-[#0F0F12] border border-white/5 rounded-2xl overflow-hidden shadow-lg">
          <div className="divide-y divide-white/5">
            {filteredVideos.map((video) => {
              const assignedCount = video.assignedProductsCount || video.assignmentCount || video.assignments?.length || 0;
              return (
                <div
                  key={video.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#16161C]/50 transition group"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div
                      className="w-24 aspect-video bg-zinc-900 rounded-xl overflow-hidden relative shrink-0 border border-white/5 cursor-pointer"
                      onClick={() => video.status === "READY" && handleOpenPreview(video)}
                    >
                      {video.thumbnailUrl ? (
                        <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
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
                        className="font-bold text-white text-sm truncate group-hover:text-red-400 transition-colors"
                        title={video.title}
                      >
                        {video.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 font-mono">
                        <span>{formatFileSize(video.fileSizeBytes)}</span>
                        <span>•</span>
                        <span className="text-zinc-400 font-sans">
                          {assignedCount > 0 ? `Usado em ${assignedCount} produto(s)` : "Não associado"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5">
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
                        <span className="text-blue-400 font-bold flex items-center gap-1">
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
                          className="bg-[#16161C] border-white/10 text-xs text-zinc-300 hover:bg-zinc-800 rounded-xl"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1 text-red-400" /> Visualizar
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(video)}
                        className="bg-[#16161C] border-white/10 text-xs text-zinc-300 hover:bg-zinc-800 rounded-xl p-2"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDelete(video)}
                        className="bg-[#16161C] border-white/10 text-xs text-red-400 hover:bg-red-950/40 rounded-xl p-2"
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
    </>
  )}

      {/* UPLOAD MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-red-500" />
                Adicionar Vídeo
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
              <div className="bg-red-950/80 border border-red-500/30 text-red-200 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Título do Vídeo *</label>
                <input
                  type="text"
                  placeholder="Ex: Aula 01 — Apresentação do Curso"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-[#16161C] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Descrição (opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Resumo ou observações..."
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-[#16161C] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Arquivo de Vídeo *</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-white/10 hover:border-red-500/50 bg-[#16161C] hover:bg-[#1A1A22] rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2"
                >
                  <Film className="w-7 h-7 text-zinc-500" />
                  {selectedFile ? (
                    <div className="text-xs text-red-400 font-mono font-bold">
                      {selectedFile.name} ({formatFileSize(selectedFile.size)})
                    </div>
                  ) : (
                    <>
                      <div className="text-xs font-bold text-white">Selecionar arquivo de vídeo</div>
                      <span className="text-[11px] text-zinc-500">Clique ou arraste um arquivo MP4, MOV...</span>
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
                <div className="space-y-2 bg-[#16161C] p-3.5 border border-white/5 rounded-xl">
                  <div className="flex justify-between text-xs font-mono text-zinc-300">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                      {uploadStep === "CREATING" && "Reservando quota..."}
                      {uploadStep === "UPLOADING" && `Enviando (${uploadProgressPercent}%)`}
                      {uploadStep === "PROCESSING" && "PROCESSANDO VÍDEO..."}
                    </span>
                    <span>{uploadProgressPercent}%</span>
                  </div>
                  <div className="w-full bg-[#0F0F12] rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-red-600 h-full transition-all duration-300"
                      style={{ width: `${uploadProgressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center border-t border-white/5 pt-3">
              <span className="text-[11px] text-zinc-500 font-mono">
                Disponível: {usage.freeGB.toFixed(1)} GB
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    resetUploadForm();
                  }}
                  disabled={uploadStep === "UPLOADING" || uploadStep === "CREATING"}
                  className="bg-[#16161C] border-white/10 text-zinc-300 text-xs rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleStartUpload}
                  disabled={!selectedFile || !formData.title.trim() || uploadStep === "UPLOADING" || uploadStep === "CREATING"}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl"
                >
                  {uploadStep === "CREATING" || uploadStep === "UPLOADING" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-red-500" />
                Editar Vídeo
              </h3>
              <button onClick={() => setEditingVideo(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Título</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-[#16161C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Descrição</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-[#16161C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500/50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
              <Button
                variant="outline"
                onClick={() => setEditingVideo(null)}
                className="bg-[#16161C] border-white/10 text-zinc-300 text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={isSavingEdit || !editTitle.trim()}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl"
              >
                {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
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
              <div className="space-y-3">
                <div className="bg-amber-950/80 border border-amber-500/30 text-amber-200 text-xs p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Este vídeo está vinculado a {deleteWarningInfo.assignedCount} produto(s).</span>
                  </div>
                  <p className="text-zinc-300 text-xs">
                    A exclusão removerá o vídeo dos produtos abaixo:
                  </p>
                  <ul className="list-disc list-inside font-semibold text-amber-300 pt-1 space-y-0.5">
                    {deleteWarningInfo.products.map((p) => (
                      <li key={p.id}>{p.title}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-300">
                Tem certeza que deseja excluir o vídeo <strong className="text-white">"{deletingVideo.title}"</strong> da sua biblioteca?
                Esta ação é irreversível.
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
              <Button
                variant="outline"
                onClick={() => {
                  setDeletingVideo(null);
                  setDeleteWarningInfo(null);
                }}
                className="bg-[#16161C] border-white/10 text-zinc-300 text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleConfirmDelete(deleteWarningInfo?.isAssigned ? true : false)}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Excluir Vídeo"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-white/10 rounded-2xl max-w-4xl w-full p-5 space-y-3 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Film className="w-4 h-4 text-red-500" />
                {previewVideo.title}
              </h3>
              <button onClick={() => setPreviewVideo(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-video bg-black rounded-xl overflow-hidden relative flex items-center justify-center border border-white/10">
              {isLoadingPreview ? (
                <div className="flex flex-col items-center text-zinc-400 space-y-2">
                  <Loader2 className="w-7 h-7 animate-spin text-red-500" />
                  <span className="text-xs font-mono">Carregando player...</span>
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

      {/* PLAN UPGRADE MODAL */}
      <PlanUpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        onSuccess={() => refreshData()}
      />

      {/* VIDEO LIBRARY PLAN UPGRADE MODAL */}
      <VideoPlanUpgradeModal
        isOpen={isVideoPlanModalOpen}
        onClose={() => setIsVideoPlanModalOpen(false)}
        onSuccess={() => refreshData()}
        currentPlanName={usage.planName}
      />
    </div>
  );
}
