"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Video,
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
  Upload,
  Film,
  Play,
  Clock,
  RefreshCw,
  FileVideo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TusVideoUploader, uploadVideoDirectly } from "@/lib/bunny/client-upload";
import { prepareClipFileForUpload, CLIP_MAX_DURATION_SECONDS } from "@/lib/clips/video-processor";

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
  createdAt: Date;
  updatedAt: Date;
}

export interface ClipsStats {
  total: number;
  published: number;
  processing: number;
  failed: number;
}

interface ClipsClientProps {
  initialClips: ClipItem[];
  initialStats: ClipsStats;
}

const MAX_FILE_SIZE_MB = 500;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024; // 524,288,000 bytes

export default function ClipsClient({ initialClips, initialStats }: ClipsClientProps) {
  const [clipsList, setClipsList] = useState<ClipItem[]>(initialClips);
  const [stats, setStats] = useState<ClipsStats>(initialStats);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Toast Feedback State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingClip, setEditingClip] = useState<ClipItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingClip, setDeletingClip] = useState<ClipItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Add / Upload Form State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload Progress & Lifecycle State
  // 'IDLE' | 'CREATING_SESSION' | 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED' | 'CANCELLED'
  const [uploadStep, setUploadStep] = useState<string>("IDLE");
  const [uploadProgressPercent, setUploadProgressPercent] = useState<number>(0);
  const [uploadProgressText, setUploadProgressText] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

  // Auto-dismiss feedback
  const showFeedback = (msg: string, isError = false) => {
    if (isError) setErrorMsg(msg);
    else setSuccessMsg(msg);
    setTimeout(() => {
      setErrorMsg(null);
      setSuccessMsg(null);
    }, 6000);
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

  // Handle File Select & Validation
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validation 1: MIME Type must be video
    if (!file.type || !file.type.toLowerCase().startsWith("video/")) {
      setUploadError("Selecione um arquivo de vídeo válido (MP4, MOV, WebM, etc.).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Validation 2: File Size must be <= 500MB
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setUploadError(`Este arquivo ultrapassa o limite máximo de ${MAX_FILE_SIZE_MB} MB. O arquivo possui ${sizeMB} MB.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    if (!formData.title) {
      // Auto-fill title from filename if empty
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setFormData((prev) => ({ ...prev, title: nameWithoutExt }));
    }
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
      setUploadError(null);
      if (!file.type || !file.type.toLowerCase().startsWith("video/")) {
        setUploadError("Selecione um arquivo de vídeo válido (MP4, MOV, WebM, etc.).");
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        setUploadError(`Este arquivo ultrapassa o limite máximo de ${MAX_FILE_SIZE_MB} MB. O arquivo possui ${sizeMB} MB.`);
        return;
      }
      setSelectedFile(file);
      if (!formData.title) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setFormData((prev) => ({ ...prev, title: nameWithoutExt }));
      }
    }
  };

  // Open Add Modal
  const openAddModal = () => {
    setFormData({ title: "", description: "" });
    setSelectedFile(null);
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
        showFeedback("Informe um título para o Clip.", true);
        return;
      }

      try {
        const res = await fetch(`/api/seller/clips/${editingClip.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title.trim(),
            description: formData.description.trim() || null,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Erro ao atualizar informações do Clip.");
        }

        showFeedback("Clip atualizado com sucesso!");
        setIsAddModalOpen(false);
        refreshClipsData();
      } catch (err: any) {
        showFeedback(err.message || "Erro ao atualizar Clip.", true);
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

    try {
      setUploadError(null);
      setUploadStep("PREPARING");
      setUploadProgressPercent(0);
      setUploadProgressText("Analisando duração do vídeo no navegador...");
      uploadAbortControllerRef.current = new AbortController();

      // Step 1: Client-Side Duration Check & Trimming to max 60s (0:00 -> 1:00)
      const finalFileToUpload = await prepareClipFileForUpload(selectedFile, {
        maxDurationSeconds: CLIP_MAX_DURATION_SECONDS,
        signal: uploadAbortControllerRef.current.signal,
        onProgress: (percentage, statusText) => {
          setUploadProgressPercent(percentage);
          setUploadProgressText(statusText);
        },
      });

      if (uploadAbortControllerRef.current.signal.aborted) {
        throw new Error("Upload cancelado pelo usuário.");
      }

      setUploadStep("CREATING_SESSION");
      setUploadProgressText("Criando sessão de upload seguro no WebGran...");

      // Step 2: POST /api/seller/clips/upload-session with actual file size & mime type
      const sessionRes = await fetch("/api/seller/clips/upload-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          contentType: finalFileToUpload.type || "video/mp4",
          fileSize: finalFileToUpload.size,
        }),
      });

      const sessionData = await sessionRes.json();
      if (!sessionRes.ok || !sessionData.success) {
        throw new Error(sessionData.error || "Falha ao criar sessão de upload.");
      }

      const { uploadSession, clip } = sessionData;

      // Step 3: Browser -> Bunny Stream Direct TUS Resumable Upload
      setUploadStep("UPLOADING");
      setUploadProgressText("Enviando vídeo diretamente para o Bunny Stream (TUS)...");

      const uploader = new TusVideoUploader();
      uploadAbortControllerRef.current.signal.addEventListener("abort", () => {
        uploader.abort();
      });

      await uploader.uploadVideo({
        file: finalFileToUpload,
        tusUploadUrl: uploadSession.tusUploadUrl || "https://video.bunnycdn.com/tusupload",
        headers: uploadSession.headers,
        signal: uploadAbortControllerRef.current.signal,
        onProgress: (p) => {
          setUploadProgressPercent(p.percentage);
          const uploadedMB = (p.bytesUploaded / (1024 * 1024)).toFixed(1);
          const totalMB = (p.totalBytes / (1024 * 1024)).toFixed(1);
          setUploadProgressText(`Enviando vídeo (TUS): ${uploadedMB} MB de ${totalMB} MB (${p.percentage}%)`);
        },
      });

      // Step 4: Direct Upload Completed -> Bunny Processing
      setUploadStep("PROCESSING");
      setUploadProgressPercent(100);
      setUploadProgressText("Upload concluído com sucesso! Vídeo em processamento pelo Bunny Stream...");

      showFeedback("Upload concluído! O vídeo agora está sendo processado pelo Bunny Stream.");
      refreshClipsData();

      // Automatically close modal after a brief pause so seller sees success
      setTimeout(() => {
        setIsAddModalOpen(false);
      }, 3000);
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

      showFeedback(`Clip ${nextState ? "ativado" : "desativado"}.`);
    } catch (err: any) {
      showFeedback(err.message || "Erro ao alterar estado do Clip", true);
      refreshClipsData();
    }
  };

  // Open Delete Confirmation Modal
  const confirmDeleteClip = (clip: ClipItem) => {
    setDeletingClip(clip);
    setIsDeleteModalOpen(true);
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

      showFeedback("Clip excluído com sucesso do Bunny Stream e do banco de dados.");
      setIsDeleteModalOpen(false);
      setDeletingClip(null);
      refreshClipsData();
    } catch (err: any) {
      showFeedback(err.message || "Erro ao excluir Clip.", true);
    } finally {
      setIsDeleting(false);
    }
  };

  // Reorder Clips (Move Up / Move Down)
  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= clipsList.length) return;

    const newList = [...clipsList];
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;

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

      showFeedback("Ordem dos clips atualizada.");
    } catch (err: any) {
      showFeedback(err.message || "Erro ao reordenar clips", true);
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

  return (
    <div className="space-y-8 w-full max-w-[1600px] mx-auto pb-16">
      {/* Toast Feedback Messages */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/90 border border-red-500/40 text-red-200 flex items-center gap-3 animate-in fade-in shadow-xl">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm font-semibold">{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 flex items-center gap-3 animate-in fade-in shadow-xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm font-semibold">{successMsg}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Clips</h1>
            <button
              onClick={() => refreshClipsData()}
              disabled={isRefreshing}
              title="Atualizar lista"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-red-400" : ""}`} />
            </button>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Gerencie os vídeos exibidos na sua loja. Envie diretamente do navegador para o Bunny Stream.
          </p>
        </div>

        <Button
          onClick={openAddModal}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl px-6 py-3 shadow-lg shadow-red-600/20 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Adicionar Clip
        </Button>
      </div>

      {/* Real-time Summary Cards (Fetched directly from Neon) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#121216] border border-white/5 rounded-2xl p-4 shadow-md flex flex-col justify-between">
          <span className="text-xs font-semibold text-zinc-400">Total de Clips</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-white">{stats.total}</span>
            <Film className="w-5 h-5 text-zinc-500" />
          </div>
        </div>

        <div className="bg-[#121216] border border-emerald-500/20 rounded-2xl p-4 shadow-md flex flex-col justify-between">
          <span className="text-xs font-semibold text-emerald-400">Publicados</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-400">{stats.published}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
        </div>

        <div className="bg-[#121216] border border-sky-500/20 rounded-2xl p-4 shadow-md flex flex-col justify-between">
          <span className="text-xs font-semibold text-sky-400">Processando</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-sky-400">{stats.processing}</span>
            <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
          </div>
        </div>

        <div className="bg-[#121216] border border-red-500/20 rounded-2xl p-4 shadow-md flex flex-col justify-between">
          <span className="text-xs font-semibold text-red-400">Falhos</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-red-400">{stats.failed}</span>
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
        </div>
      </div>

      {/* Clips List */}
      {clipsList.length === 0 ? (
        <div className="bg-[#121216] border border-white/5 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <Video className="w-12 h-12 text-zinc-600 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">Nenhum Clip cadastrado</h3>
          <p className="text-xs text-zinc-400 max-w-sm mb-6">
            Sua loja ainda não possui vídeos. Faça o upload do seu primeiro Clip de até 500MB.
          </p>
          <Button
            onClick={openAddModal}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl px-5 py-2 cursor-pointer"
          >
            + Adicionar Primeiro Clip
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {clipsList.map((clip, index) => {
            const isReady = clip.status === "READY";
            const isFailed = clip.status === "FAILED";
            const isProcessing = clip.status === "PROCESSING" || clip.status === "UPLOADING";

            return (
              <div
                key={clip.id}
                className={`bg-[#121216] border rounded-2xl p-4 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg ${
                  clip.isActive ? "border-white/10" : "border-white/5 opacity-60"
                }`}
              >
                {/* Left Side: Thumbnail & Details */}
                <div className="flex items-center gap-4 min-w-0 w-full md:w-auto flex-1">
                  {/* Thumbnail / Placeholder */}
                  <div className="relative w-24 h-32 sm:w-28 sm:h-36 rounded-xl bg-black/60 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
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
                        <span className="text-[10px] text-zinc-500">
                          {isProcessing ? "Processando..." : "Sem Thumbnail"}
                        </span>
                      </div>
                    )}

                    {/* Duration Badge */}
                    <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1 border border-white/10">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      {formatDuration(clip.duration)}
                    </div>
                  </div>

                  {/* Text Details */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Position Badge */}
                      <span className="bg-white/5 px-2 py-0.5 rounded text-[11px] font-bold text-zinc-300 border border-white/5">
                        Posição #{index + 1}
                      </span>

                      {/* Status Badge */}
                      {isReady && (
                        <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          Publicado
                        </span>
                      )}
                      {clip.status === "UPLOADING" && (
                        <span className="bg-amber-950/80 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          Enviando
                        </span>
                      )}
                      {clip.status === "PROCESSING" && (
                        <span className="bg-sky-950/80 text-sky-400 border border-sky-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                          Processando
                        </span>
                      )}
                      {isFailed && (
                        <span className="bg-red-950/80 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-red-400" />
                          Falhou
                        </span>
                      )}

                      {/* Active / Inactive Badge */}
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                          clip.isActive
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {clip.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white truncate">{clip.title}</h3>
                    {clip.description && (
                      <p className="text-xs text-zinc-400 line-clamp-2">{clip.description}</p>
                    )}

                    <p className="text-[11px] text-zinc-500 pt-1">
                      Bunny Video ID: <code className="text-zinc-400 font-mono">{clip.bunnyVideoId}</code>
                    </p>
                  </div>
                </div>

                {/* Right Side: Position & Action Buttons */}
                <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-white/5">
                  {/* Reorder Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMove(index, "up")}
                      disabled={index === 0}
                      title="Subir posição"
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-white/5 transition-all cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMove(index, "down")}
                      disabled={index === clipsList.length - 1}
                      title="Descer posição"
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-white/5 transition-all cursor-pointer"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Toggle Active/Inactive */}
                    <button
                      onClick={() => handleToggleActive(clip)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                        clip.isActive
                          ? "bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 border-white/10"
                          : "bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {clip.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {clip.isActive ? "Desativar" : "Ativar"}
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => openEditModal(clip)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/5 transition-all cursor-pointer"
                      title="Editar Clip"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => confirmDeleteClip(clip)}
                      className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-500/20 transition-all cursor-pointer"
                      title="Excluir Clip"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Clip Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingClip ? "Editar Informações do Clip" : "Adicionar Novo Clip"}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                disabled={uploadStep === "UPLOADING"}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-5">
              {uploadError && (
                <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{uploadError}</span>
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
                  placeholder="Ex: Demonstração do Produto"
                  disabled={uploadStep === "UPLOADING" || uploadStep === "CREATING_SESSION"}
                  className="w-full bg-[#181820] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500 transition-all disabled:opacity-50"
                />
              </div>

              {/* Description Input */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Descrição (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Escreva uma breve descrição..."
                  disabled={uploadStep === "UPLOADING" || uploadStep === "CREATING_SESSION"}
                  className="w-full bg-[#181820] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500 transition-all disabled:opacity-50 resize-none"
                />
              </div>

              {/* Video File Selection Zone (Only when creating new clip) */}
              {!editingClip && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-zinc-300">
                      Arquivo de Vídeo <span className="text-red-400">*</span>
                    </label>
                    <span className="text-[11px] font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                      Limite: 500 MB
                    </span>
                  </div>

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
                    className={`w-full border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                      selectedFile
                        ? "border-emerald-500/50 bg-emerald-950/10"
                        : "border-white/10 hover:border-red-500/50 bg-[#181820] hover:bg-[#1E1E28]"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-3">
                      <FileVideo className="w-6 h-6" />
                    </div>

                    {selectedFile ? (
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-white">{selectedFile.name}</p>
                        <p className="text-xs text-emerald-400 font-semibold">
                          {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • Pronto para envio direto
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white">
                          Selecione ou arraste seu vídeo aqui
                        </p>
                        <p className="text-xs text-zinc-400">
                          Formatos aceitos: MP4, MOV, WebM (Até 500MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Upload Progress Bar Component */}
              {(uploadStep === "PREPARING" ||
                uploadStep === "CREATING_SESSION" ||
                uploadStep === "UPLOADING" ||
                uploadStep === "PROCESSING") && (
                <div className="p-4 rounded-xl bg-[#181820] border border-white/10 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                      {uploadProgressText}
                    </span>
                    <span className="font-bold text-red-400">{uploadProgressPercent}%</span>
                  </div>

                  <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgressPercent}%` }}
                    />
                  </div>

                  {(uploadStep === "PREPARING" || uploadStep === "UPLOADING") && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleCancelUpload}
                        className="text-xs text-zinc-400 hover:text-red-400 underline transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Form Buttons */}
              <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={uploadStep === "PREPARING" || uploadStep === "UPLOADING" || uploadStep === "CREATING_SESSION"}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors disabled:opacity-30"
                >
                  Cancelar
                </button>

                <Button
                  type="submit"
                  disabled={
                    uploadStep === "PREPARING" ||
                    uploadStep === "CREATING_SESSION" ||
                    uploadStep === "UPLOADING" ||
                    uploadStep === "PROCESSING"
                  }
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl px-5 py-2 shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {uploadStep === "PREPARING" || uploadStep === "UPLOADING" || uploadStep === "CREATING_SESSION" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{uploadStep === "PREPARING" ? "Preparando Clip..." : "Enviando..."}</span>
                    </>
                  ) : editingClip ? (
                    "Salvar Alterações"
                  ) : (
                    "Enviar Vídeo"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && deletingClip && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-red-500/30 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Excluir este Clip?</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Esta ação removerá o vídeo <strong className="text-white">"{deletingClip.title}"</strong> permanentemente da biblioteca do Bunny Stream e removerá o registro do WebGran.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors disabled:opacity-30"
              >
                Cancelar
              </button>
              <Button
                type="button"
                onClick={handleDeleteClip}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl px-5 py-2 shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  "Confirmar Exclusão"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
