"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import * as upload from "tus-js-client";
import {
  Video,
  Upload,
  Trash2,
  MoveUp,
  MoveDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  Film,
  Plus,
  X,
  FileVideo,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ProductVideoItem {
  id: string;
  storeId: string;
  productId: string;
  bunnyVideoId: string;
  title: string;
  description?: string | null;
  position: number;
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  status: "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | string;
  active: boolean;
  createdAt: string;
}

export interface PendingVideo {
  bunnyVideoId: string;
  title: string;
  description?: string | null;
  position: number;
  tempId: string;
}

interface ProductVideosManagerProps {
  productId?: string;
  productTitle?: string;
  onPendingVideosChange?: (pending: PendingVideo[]) => void;
}

export function ProductVideosManager({
  productId,
  productTitle = "Produto",
  onPendingVideosChange,
}: ProductVideosManagerProps) {
  const [videos, setVideos] = useState<ProductVideoItem[]>([]);
  const [pendingVideos, setPendingVideos] = useState<PendingVideo[]>([]);
  const [loading, setLoading] = useState(Boolean(productId));
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // New video modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchVideos = useCallback(async () => {
    if (!productId) {
      setVideos([]);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const res = await fetch(`/api/seller/products/${productId}/videos`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Falha ao carregar vídeos do produto.");
      }
      setVideos(json.videos || []);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar vídeos.");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Sync pending videos changes with parent form (for New Product Modal)
  useEffect(() => {
    if (!productId && onPendingVideosChange) {
      onPendingVideosChange(pendingVideos);
    }
  }, [pendingVideos, productId, onPendingVideosChange]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("video/")) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError("Por favor, selecione um arquivo de vídeo válido (MP4 ou MOV).");
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setError("O título do vídeo é obrigatório.");
      return;
    }
    if (!selectedFile) {
      setError("Selecione um arquivo de vídeo para enviar.");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setUploadProgress(0);
      setUploadStatusText("Criando sessão de upload no Bunny Stream...");

      const endpointUrl = productId
        ? `/api/seller/products/${productId}/videos/upload-session`
        : `/api/seller/products/pending/videos/upload-session`;

      const sessionRes = await fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          contentType: selectedFile.type,
          fileSize: selectedFile.size,
        }),
      });

      const sessionData = await sessionRes.json();
      if (!sessionRes.ok || !sessionData.success) {
        throw new Error(sessionData.error || "Falha ao iniciar sessão de upload.");
      }

      const { uploadSession, productVideo } = sessionData;
      setUploadStatusText("Enviando vídeo diretamente ao Bunny CDN...");

      const tusUpload = new upload.Upload(selectedFile, {
        endpoint: uploadSession.tusUploadUrl || "https://video.bunnycdn.com/tusupload",
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: uploadSession.headers,
        metadata: {
          filetype: selectedFile.type,
          title: newTitle.trim(),
          collection: uploadSession.videoId,
        },
        onError: (err) => {
          console.error("[TUS Upload Error]:", err);
          setError("Erro durante o envio do arquivo. Verifique sua conexão e tente novamente.");
          setUploading(false);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
          setUploadProgress(percentage);
          setUploadStatusText(`Enviando arquivo: ${percentage}%`);
        },
        onSuccess: () => {
          setUploadStatusText("Upload concluído! Vídeo enviado para transcodificação.");
          setUploading(false);
          setShowAddModal(false);
          setNewTitle("");
          setNewDescription("");
          setSelectedFile(null);

          if (!productId) {
            // New Product Mode: store in pendingVideos list
            const newPendingItem: PendingVideo = {
              bunnyVideoId: uploadSession.videoId,
              title: newTitle.trim(),
              description: newDescription.trim() || null,
              position: pendingVideos.length,
              tempId: `pending_${uploadSession.videoId}`,
            };
            setPendingVideos((prev) => [...prev, newPendingItem]);
          } else {
            fetchVideos();
          }
        },
      });

      tusUpload.start();
    } catch (err: any) {
      setError(err.message || "Erro no upload do vídeo.");
      setUploading(false);
    }
  };

  const handleToggleActive = async (video: ProductVideoItem) => {
    if (!productId) return;
    try {
      const res = await fetch(`/api/seller/products/${productId}/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !video.active }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Falha ao atualizar status do vídeo.");
      }
      fetchVideos();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (videoId: string, bunnyVideoId?: string) => {
    if (!confirm("Tem certeza que deseja excluir este vídeo?")) return;

    if (!productId) {
      // Pending Mode delete
      const bunnyIdToDelete = bunnyVideoId || videoId.replace("pending_", "");
      setPendingVideos((prev) => prev.filter((v) => v.bunnyVideoId !== bunnyIdToDelete));
      fetch("/api/seller/products/pending/videos/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingBunnyVideoIds: [bunnyIdToDelete] }),
      }).catch(console.error);
      return;
    }

    try {
      const res = await fetch(`/api/seller/products/${productId}/videos/${videoId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Falha ao excluir vídeo.");
      }
      fetchVideos();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMovePosition = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (!productId) {
      if (targetIndex < 0 || targetIndex >= pendingVideos.length) return;
      const newOrder = [...pendingVideos];
      const temp = newOrder[index];
      newOrder[index] = newOrder[targetIndex];
      newOrder[targetIndex] = temp;
      setPendingVideos(newOrder);
      return;
    }

    if (targetIndex < 0 || targetIndex >= videos.length) return;

    const newOrder = [...videos];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    setVideos(newOrder);

    try {
      const orderedVideoIds = newOrder.map((v) => v.id);
      await fetch(`/api/seller/products/${productId}/videos/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedVideoIds }),
      });
    } catch (err) {
      console.error("Reorder failed:", err);
      fetchVideos();
    }
  };

  const formatDuration = (sec?: number | null) => {
    if (!sec || sec <= 0) return "--:--";
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s.toString().padStart(2, "0")}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "READY":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Pronto
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded-full">
            <AlertCircle className="w-3.5 h-3.5" />
            Falhou
          </span>
        );
      case "PROCESSING":
      case "UPLOADING":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Processando
          </span>
        );
    }
  };

  const currentList = productId
    ? videos
    : pendingVideos.map((p, idx) => ({
        id: p.tempId,
        storeId: "",
        productId: "pending",
        bunnyVideoId: p.bunnyVideoId,
        title: p.title,
        description: p.description,
        position: idx,
        durationSeconds: null,
        thumbnailUrl: null,
        status: "PROCESSING",
        active: true,
        createdAt: new Date().toISOString(),
      }));

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-white/5">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Film className="w-4 h-4 text-blue-500" />
            Vídeos do Produto
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Adicione episódios, aulas ou conteúdos que serão entregues automaticamente após a compra.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowAddModal(true);
            setError(null);
          }}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition shadow-md shadow-blue-600/10 self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          Adicionar vídeo
        </button>
      </div>

      {error && !showAddModal && (
        <div className="p-3 text-xs bg-red-500/10 text-red-400 rounded-xl flex items-center gap-2 border border-red-500/20">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Videos List or Elegant Compact Empty State */}
      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center text-zinc-400">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-2" />
          <span className="text-xs">Carregando vídeos...</span>
        </div>
      ) : currentList.length === 0 ? (
        <div className="p-6 rounded-2xl bg-[#1A1A1E] border border-white/5 flex flex-col items-center justify-center text-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Nenhum vídeo adicionado</p>
            <p className="text-[11px] text-zinc-400 max-w-md mt-0.5">
              Adicione episódios, aulas ou conteúdos que serão entregues automaticamente após a compra.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowAddModal(true);
              setError(null);
            }}
            className="mt-1 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 hover:text-white font-semibold text-xs rounded-xl transition"
          >
            Adicionar primeiro vídeo
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {currentList.map((vid, idx) => (
            <div
              key={vid.id}
              className={`p-3.5 rounded-xl bg-[#1A1A1E] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 transition hover:border-white/10 ${
                !vid.active ? "opacity-50" : ""
              }`}
            >
              {/* Thumbnail & Video Details */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative w-16 h-12 rounded-lg bg-black/90 border border-white/10 shrink-0 overflow-hidden flex items-center justify-center">
                  {vid.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={vid.thumbnailUrl}
                      alt={vid.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Film className="w-5 h-5 text-zinc-600" />
                  )}
                  {vid.durationSeconds ? (
                    <span className="absolute bottom-1 right-1 text-[9px] font-mono font-bold bg-black/80 text-white px-1 py-0.5 rounded">
                      {formatDuration(vid.durationSeconds)}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-zinc-500">
                      #{String(idx + 1).padStart(2, "0")}
                    </span>
                    <h4 className="text-xs sm:text-sm font-semibold text-white truncate">
                      {vid.title}
                    </h4>
                  </div>
                  {vid.description && (
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{vid.description}</p>
                  )}
                  <div className="mt-1 flex items-center gap-2.5">
                    {getStatusBadge(vid.status)}
                    {!productId && (
                      <span className="text-[10px] text-blue-400 font-semibold bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                        Pendente de associação
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => handleMovePosition(idx, "up")}
                  className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-20 rounded-lg hover:bg-white/5 transition"
                  title="Mover para cima"
                >
                  <MoveUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={idx === currentList.length - 1}
                  onClick={() => handleMovePosition(idx, "down")}
                  className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-20 rounded-lg hover:bg-white/5 transition"
                  title="Mover para baixo"
                >
                  <MoveDown className="w-4 h-4" />
                </button>

                {productId && (
                  <button
                    type="button"
                    onClick={() => handleToggleActive(vid as ProductVideoItem)}
                    className={`p-1.5 rounded-lg transition ${
                      vid.active
                        ? "text-emerald-400 hover:bg-emerald-500/10"
                        : "text-zinc-500 hover:bg-white/5"
                    }`}
                    title={vid.active ? "Desativar vídeo" : "Ativar vídeo"}
                  >
                    {vid.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(vid.id, vid.bunnyVideoId)}
                  className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                  title="Excluir vídeo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modern WebGran Dark Theme Modal "Novo Vídeo do Produto" */}
      <Dialog open={showAddModal} onOpenChange={(val) => { setShowAddModal(val); if (!val) setError(null); }}>
        <DialogContent className="sm:max-w-lg w-[94vw] max-w-[calc(100vw-1rem)] bg-[#121214] border border-white/10 p-0 overflow-hidden text-zinc-100 flex flex-col max-h-[90vh] shadow-2xl rounded-2xl">
          <div className="p-4 sm:p-5 border-b border-white/5 shrink-0 flex items-center justify-between">
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Film className="w-5 h-5 text-blue-500" />
                Novo vídeo do produto
              </DialogTitle>
              <p className="text-xs text-zinc-400 mt-0.5">Adicione um episódio ou aula</p>
            </div>
          </div>

          <div className="overflow-y-auto p-4 sm:p-5 custom-scrollbar space-y-4">
            {error && (
              <div className="p-3 text-xs bg-red-500/10 text-red-400 rounded-xl flex items-center gap-2 border border-red-500/20">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <form id="add-video-form" onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Título */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300">
                  Título *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Episódio 01 — A Origem"
                  className="w-full bg-[#1A1A1E] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
                />
              </div>

              {/* Descrição */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300">
                  Descrição (Opcional)
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                  placeholder="Breve descrição do conteúdo..."
                  className="w-full bg-[#1A1A1E] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600 resize-none custom-scrollbar"
                />
              </div>

              {/* Drag and Drop Upload Zone */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300">
                  Vídeo *
                </label>
                
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                    isDragging
                      ? "border-blue-500 bg-blue-500/10"
                      : selectedFile
                      ? "border-emerald-500/50 bg-emerald-500/5"
                      : "border-white/10 bg-[#1A1A1E] hover:border-blue-500/40 hover:bg-[#1A1A1E]/80"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      setSelectedFile(e.target.files?.[0] || null);
                      setError(null);
                    }}
                  />

                  <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-2">
                    {selectedFile ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <FileVideo className="w-5 h-5" />
                    )}
                  </div>

                  {selectedFile ? (
                    <div>
                      <p className="text-xs font-bold text-emerald-400 truncate max-w-xs">
                        {selectedFile.name}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • Clique para alterar
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">
                        Arraste o vídeo aqui
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        ou <span className="text-blue-400 underline">selecionar arquivo</span>
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-1">MP4 ou MOV</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Progress Bar */}
              {uploading && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-zinc-300">{uploadStatusText}</span>
                    <span className="text-blue-400 font-mono">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#1A1A1E] rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </form>
          </div>

          <div className="p-4 sm:p-5 border-t border-white/5 shrink-0 flex items-center justify-end gap-3 bg-[#121214]">
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                setShowAddModal(false);
                setError(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="add-video-form"
              disabled={uploading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
