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
} from "lucide-react";

interface ProductVideoItem {
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

interface ProductVideosManagerProps {
  productId: string;
  productTitle: string;
}

export function ProductVideosManager({ productId, productTitle }: ProductVideosManagerProps) {
  const [videos, setVideos] = useState<ProductVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // New video form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  // Handle direct TUS browser upload to Bunny Stream CDN
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

      // 1. Create upload session via server API
      const sessionRes = await fetch(`/api/seller/products/${productId}/videos/upload-session`, {
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

      const { uploadSession } = sessionData;
      setUploadStatusText("Enviando vídeo diretamente ao Bunny CDN...");

      // 2. Perform direct browser TUS upload
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
          setShowAddForm(false);
          setNewTitle("");
          setNewDescription("");
          setSelectedFile(null);
          fetchVideos();
        },
      });

      tusUpload.start();
    } catch (err: any) {
      setError(err.message || "Erro no upload do vídeo.");
      setUploading(false);
    }
  };

  const handleToggleActive = async (video: ProductVideoItem) => {
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

  const handleDelete = async (videoId: string) => {
    if (!confirm("Tem certeza que deseja excluir este vídeo do produto?")) return;
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
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full dark:bg-emerald-950/40 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Pronto (READY)
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full dark:bg-red-950/40 dark:text-red-400">
            <AlertCircle className="w-3.5 h-3.5" />
            Falhou (FAILED)
          </span>
        );
      case "PROCESSING":
      case "UPLOADING":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full dark:bg-amber-950/40 dark:text-amber-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Processando
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Film className="w-5 h-5 text-primary" />
            Vídeos do Produto
          </h3>
          <p className="text-xs text-muted-foreground">
            Gerencie os episódios/vídeos entregues aos compradores de &quot;{productTitle}&quot;.
          </p>
        </div>

        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium text-xs rounded-xl hover:opacity-90 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Adicionar Vídeo
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 text-xs bg-red-50 text-red-600 rounded-xl flex items-center gap-2 dark:bg-red-950/30 dark:text-red-400 border border-red-200/50">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Add New Video Form */}
      {showAddForm && (
        <form
          onSubmit={handleUploadSubmit}
          className="p-4 rounded-2xl bg-card border border-border/60 flex flex-col gap-4 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <h4 className="text-sm font-semibold">Novo Vídeo do Produto</h4>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setError(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Título do Episódio / Vídeo *</label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ex: Episódio 01 — A Origem"
              className="px-3 py-2 rounded-xl text-xs bg-background border border-input focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Descrição (Opcional)</label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={2}
              placeholder="Breve resumo do conteúdo deste episódio..."
              className="px-3 py-2 rounded-xl text-xs bg-background border border-input focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Arquivo de Vídeo MP4/MOV *</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              required
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
            />
          </div>

          {uploading && (
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex justify-between text-xs font-medium">
                <span>{uploadStatusText}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground font-medium text-xs rounded-xl hover:opacity-90 transition disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Enviando..." : "Enviar Vídeo"}
            </button>
          </div>
        </form>
      )}

      {/* Videos List */}
      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <span className="text-xs">Carregando lista de vídeos...</span>
        </div>
      ) : videos.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Video className="w-10 h-10 opacity-40" />
          <p className="text-xs font-medium">Nenhum vídeo vinculado a este produto ainda.</p>
          <p className="text-[11px] opacity-75">
            Adicione episódios ou aulas que serão liberados automaticamente após a compra.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {videos.map((vid, idx) => (
            <div
              key={vid.id}
              className={`p-4 rounded-2xl bg-card border border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition hover:border-border ${
                !vid.active ? "opacity-60" : ""
              }`}
            >
              {/* Left Info */}
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <div className="relative w-16 h-12 rounded-lg bg-black/80 shrink-0 overflow-hidden border border-border/40 flex items-center justify-center">
                  {vid.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={vid.thumbnailUrl}
                      alt={vid.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Film className="w-6 h-6 text-muted-foreground/50" />
                  )}
                  <span className="absolute bottom-1 right-1 text-[9px] font-mono font-bold bg-black/80 text-white px-1 rounded">
                    {formatDuration(vid.durationSeconds)}
                  </span>
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-muted-foreground">
                      #{String(idx + 1).padStart(2, "0")}
                    </span>
                    <h4 className="text-sm font-semibold truncate">{vid.title}</h4>
                  </div>
                  {vid.description && (
                    <p className="text-xs text-muted-foreground truncate">{vid.description}</p>
                  )}
                  <div className="mt-1 flex items-center gap-3">
                    {getStatusBadge(vid.status)}
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(vid.durationSeconds)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                {/* Move Up/Down */}
                <button
                  disabled={idx === 0}
                  onClick={() => handleMovePosition(idx, "up")}
                  className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded-lg hover:bg-secondary transition"
                  title="Mover para cima"
                >
                  <MoveUp className="w-4 h-4" />
                </button>
                <button
                  disabled={idx === videos.length - 1}
                  onClick={() => handleMovePosition(idx, "down")}
                  className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded-lg hover:bg-secondary transition"
                  title="Mover para baixo"
                >
                  <MoveDown className="w-4 h-4" />
                </button>

                {/* Toggle Active */}
                <button
                  onClick={() => handleToggleActive(vid)}
                  className={`p-2 rounded-lg transition ${
                    vid.active
                      ? "text-emerald-500 hover:bg-emerald-500/10"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                  title={vid.active ? "Desativar vídeo" : "Ativar vídeo"}
                >
                  {vid.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(vid.id)}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition"
                  title="Excluir vídeo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
