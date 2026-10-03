"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Film,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  Search,
  CheckSquare,
  Square,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductVideoPlayer } from "@/components/miniapp/ProductVideoPlayer";

export interface AssignedProductVideo {
  id: string;
  assignmentId?: string | null;
  storeId: string;
  productId?: string | null;
  videoId: string;
  bunnyVideoId: string;
  title: string;
  description?: string | null;
  position: number;
  durationSeconds?: number | null;
  fileSizeBytes?: number | null;
  thumbnailUrl?: string | null;
  status: string;
  active: boolean;
  createdAt: string;
}

export interface LibraryVideoOption {
  id: string;
  storeId: string;
  bunnyVideoId: string;
  title: string;
  description?: string | null;
  durationSeconds?: number | null;
  fileSizeBytes?: number | null;
  thumbnailUrl?: string | null;
  status: string; // 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED'
  active: boolean;
  createdAt: string;
}

export type PendingVideo = {
  tempId: string;
  bunnyVideoId?: string;
  title?: string;
  description?: string;
  position?: number;
};

interface ProductVideosManagerProps {
  productId?: string;
  productTitle?: string;
  onSelectedVideoIdsChange?: (videoIds: string[]) => void;
  onPendingVideosChange?: (pending: any[]) => void;
}

export function ProductVideosManager({
  productId,
  productTitle = "Produto",
  onSelectedVideoIdsChange,
  onPendingVideosChange,
}: ProductVideosManagerProps) {
  const [assignedVideos, setAssignedVideos] = useState<AssignedProductVideo[]>([]);
  const [loadingAssigned, setLoadingAssigned] = useState(Boolean(productId));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selection Modal State
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [libraryVideos, setLibraryVideos] = useState<LibraryVideoOption[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedInModal, setSelectedInModal] = useState<string[]>([]);
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);

  // Preview Modal State
  const [previewVideo, setPreviewVideo] = useState<AssignedProductVideo | null>(null);
  const [previewPlayback, setPreviewPlayback] = useState<{ playbackUrl: string; directUrl: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Fetch assigned videos for existing product
  const fetchAssignedVideos = useCallback(async () => {
    if (!productId) {
      setLoadingAssigned(false);
      return;
    }
    try {
      setLoadingAssigned(true);
      const res = await fetch(`/api/seller/products/${productId}/videos`);
      const data = await res.json();
      if (data.success) {
        setAssignedVideos(data.videos || []);
      }
    } catch (err: any) {
      console.error("[ProductVideosManager] Error fetching assigned videos:", err);
    } finally {
      setLoadingAssigned(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchAssignedVideos();
  }, [fetchAssignedVideos]);

  // Fetch seller library videos for picker modal
  const fetchLibraryVideos = async () => {
    setLoadingLibrary(true);
    try {
      const res = await fetch("/api/seller/videos");
      const data = await res.json();
      if (data.success) {
        setLibraryVideos(data.videos || []);
      }
    } catch (err) {
      console.error("[ProductVideosManager] Error fetching library videos:", err);
    } finally {
      setLoadingLibrary(false);
    }
  };

  const handleOpenPicker = () => {
    setIsPickerOpen(true);
    const currentlyAssignedIds = assignedVideos.map((v) => v.id || v.videoId);
    setSelectedInModal(currentlyAssignedIds);
    fetchLibraryVideos();
  };

  // Toggle selection inside picker modal
  const toggleVideoSelection = (video: LibraryVideoOption) => {
    if (video.status !== "READY") return; // ONLY READY videos can be selected!

    setSelectedInModal((prev) => {
      if (prev.includes(video.id)) {
        return prev.filter((id) => id !== video.id);
      } else {
        return [...prev, video.id];
      }
    });
  };

  // Confirm addition from picker modal
  const handleConfirmAddVideos = async () => {
    const newlySelectedIds = selectedInModal.filter(
      (id) => !assignedVideos.some((v) => v.id === id || v.videoId === id)
    );

    if (productId) {
      // Existing Product: assign via API
      if (newlySelectedIds.length > 0) {
        setIsSavingAssignments(true);
        try {
          const res = await fetch(`/api/seller/products/${productId}/videos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoIds: newlySelectedIds }),
          });
          const data = await res.json();
          if (!data.success) {
            throw new Error(data.error || "Falha ao vincular vídeos ao produto.");
          }
          await fetchAssignedVideos();
        } catch (err: any) {
          setErrorMessage(err.message || "Erro ao adicionar vídeos ao produto.");
        } finally {
          setIsSavingAssignments(false);
        }
      }
    } else {
      // New Product: update local state & notify parent form
      const updatedList = libraryVideos.filter((v) => selectedInModal.includes(v.id));
      const formattedAssigned: AssignedProductVideo[] = updatedList.map((v, idx) => ({
        id: v.id,
        storeId: v.storeId,
        videoId: v.id,
        bunnyVideoId: v.bunnyVideoId,
        title: v.title,
        description: v.description,
        position: idx,
        durationSeconds: v.durationSeconds,
        fileSizeBytes: v.fileSizeBytes,
        thumbnailUrl: v.thumbnailUrl,
        status: v.status,
        active: v.active,
        createdAt: v.createdAt,
      }));

      setAssignedVideos(formattedAssigned);
      if (onSelectedVideoIdsChange) {
        onSelectedVideoIdsChange(selectedInModal);
      }
      if (onPendingVideosChange) {
        onPendingVideosChange(selectedInModal.map((id) => ({ tempId: id })));
      }
    }

    setIsPickerOpen(false);
  };

  // Remove Video Assignment (ONLY removes product assignment, DOES NOT delete from library or Bunny!)
  const handleRemoveAssignment = async (video: AssignedProductVideo) => {
    if (productId) {
      try {
        const res = await fetch(`/api/seller/products/${productId}/videos/${video.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || "Erro ao remover vínculo do vídeo.");
        }
        await fetchAssignedVideos();
      } catch (err: any) {
        setErrorMessage(err.message || "Erro ao remover vídeo do produto.");
      }
    } else {
      // New Product form local state removal
      const updated = assignedVideos.filter((v) => v.id !== video.id && v.videoId !== video.id);
      setAssignedVideos(updated);
      const updatedIds = updated.map((v) => v.id || v.videoId);
      if (onSelectedVideoIdsChange) {
        onSelectedVideoIdsChange(updatedIds);
      }
      if (onPendingVideosChange) {
        onPendingVideosChange(updatedIds.map((id) => ({ tempId: id })));
      }
    }
  };

  // Reorder Videos (Move Up / Move Down)
  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= assignedVideos.length) return;

    const updated = [...assignedVideos];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Recalculate position indices
    const reordered = updated.map((item, idx) => ({ ...item, position: idx }));
    setAssignedVideos(reordered);

    if (productId) {
      try {
        const orderedVideoIds = reordered.map((v) => v.id || v.videoId);
        await fetch(`/api/seller/products/${productId}/videos/reorder`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedVideoIds }),
        });
      } catch (err) {
        console.error("[ProductVideosManager] Error reordering videos:", err);
      }
    } else {
      const updatedIds = reordered.map((v) => v.id || v.videoId);
      if (onSelectedVideoIdsChange) {
        onSelectedVideoIdsChange(updatedIds);
      }
    }
  };

  // Preview video modal handler
  const handlePreview = async (video: AssignedProductVideo) => {
    setPreviewVideo(video);
    setIsLoadingPreview(true);
    setPreviewPlayback(null);

    try {
      const res = await fetch(`/api/seller/videos/${video.id}/preview`);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Falha ao carregar preview.");
      }
      setPreviewPlayback(data.playback);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao carregar preview do vídeo.");
      setPreviewVideo(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Formatting helpers
  const formatDuration = (seconds?: number | null) => {
    if (!seconds || seconds <= 0) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return "";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  // Filtered library videos for picker modal
  const filteredLibraryVideos = libraryVideos.filter((v) => {
    const matchesSearch = searchQuery
      ? v.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesStatus =
      statusFilter === "ALL" ? true : v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4 w-full text-zinc-100">
      {/* Hidden input to pass selected video IDs to HTML forms */}
      {!productId && (
        <input
          type="hidden"
          name="videoIds"
          value={JSON.stringify(assignedVideos.map((v) => v.id || v.videoId))}
        />
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION HEADER (Requirement #2) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
            <Film className="w-4 h-4 text-amber-500" />
            VÍDEOS DA ENTREGA
          </h4>
          <p className="text-xs text-zinc-400 mt-0.5">
            Selecione os vídeos da sua Biblioteca que serão liberados ao comprador após o pagamento.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleOpenPicker}
          className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs h-9 px-4 shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Selecionar da Biblioteca
        </Button>
      </div>

      {/* ASSIGNED VIDEOS LIST (Requirement #9) */}
      {loadingAssigned ? (
        <div className="p-6 text-center text-zinc-500 text-xs flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          Carregando vídeos vinculados...
        </div>
      ) : assignedVideos.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-xl p-6 text-center text-zinc-500 text-xs space-y-1">
          <p>Nenhum vídeo vinculado a este produto.</p>
          <p className="text-zinc-600">Clique em "Selecionar da Biblioteca" acima para adicionar vídeos já processados.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {assignedVideos.map((video, index) => (
            <div
              key={video.id || video.videoId || index}
              className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-zinc-700 transition"
            >
              {/* Left Info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Reorder Buttons */}
                <div className="flex flex-col gap-1 shrink-0 text-zinc-500">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMove(index, "up")}
                    className="p-1 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 transition"
                    title="Mover para cima"
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === assignedVideos.length - 1}
                    onClick={() => handleMove(index, "down")}
                    className="p-1 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 transition"
                    title="Mover para baixo"
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Thumbnail */}
                <div className="w-16 aspect-video bg-zinc-950 rounded overflow-hidden relative shrink-0 border border-zinc-800">
                  {video.thumbnailUrl ? (
                    <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                      <Film className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Title & Metas */}
                <div className="min-w-0 flex-1">
                  <h5 className="font-semibold text-zinc-100 text-xs truncate">
                    🎬 {video.title}
                  </h5>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono mt-0.5">
                    <span>{formatDuration(video.durationSeconds)}</span>
                    {video.fileSizeBytes && <span>• {formatFileSize(video.fileSizeBytes)}</span>}
                    <span>•</span>
                    <span className={video.status === "READY" ? "text-emerald-400" : "text-amber-400"}>
                      {video.status === "READY" ? "✓ Pronto" : "Processando..."}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreview(video)}
                  className="border-zinc-800 text-[11px] h-8 text-zinc-300 hover:bg-zinc-800"
                >
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  Visualizar
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveAssignment(video)}
                  className="border-zinc-800 text-[11px] h-8 text-red-400 hover:bg-red-950/40 hover:border-red-800"
                  title="Remover vínculo do produto"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Remover
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- SELECTION MODAL / DRAWER (Requirements #4, #5, #6) --- */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Film className="w-5 h-5 text-amber-500" />
                  Selecionar vídeos
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Escolha os vídeos já processados que serão entregues neste produto.
                </p>
              </div>
              <button onClick={() => setIsPickerOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="🔎 Buscar vídeo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">Todos os status</option>
                <option value="READY">Prontos</option>
                <option value="PROCESSING">Processando</option>
              </select>
            </div>

            {/* Video Cards Grid/List */}
            <div className="overflow-y-auto custom-scrollbar flex-1 space-y-2.5 pr-1">
              {loadingLibrary ? (
                <div className="p-8 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                  <span>Carregando vídeos da biblioteca...</span>
                </div>
              ) : filteredLibraryVideos.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl">
                  Nenhum vídeo encontrado na biblioteca.
                </div>
              ) : (
                filteredLibraryVideos.map((video) => {
                  const isSelected = selectedInModal.includes(video.id);
                  const isReady = video.status === "READY";
                  const isAlreadyAssigned = assignedVideos.some(
                    (v) => v.id === video.id || v.videoId === video.id
                  );

                  return (
                    <div
                      key={video.id}
                      onClick={() => isReady && toggleVideoSelection(video)}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                        !isReady
                          ? "opacity-60 bg-zinc-950/40 border-zinc-800/60 cursor-not-allowed"
                          : isSelected
                          ? "bg-amber-500/10 border-amber-500/60 cursor-pointer"
                          : "bg-zinc-950/80 border-zinc-800 hover:border-zinc-700 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Checkbox */}
                        <div className="shrink-0">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-amber-500" />
                          ) : (
                            <Square className={`w-5 h-5 ${isReady ? "text-zinc-500" : "text-zinc-700"}`} />
                          )}
                        </div>

                        {/* Thumbnail */}
                        <div className="w-16 aspect-video bg-zinc-900 rounded overflow-hidden relative shrink-0 border border-zinc-800">
                          {video.thumbnailUrl ? (
                            <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-700">
                              <Film className="w-4 h-4" />
                            </div>
                          )}
                        </div>

                        {/* Title & Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h5 className="font-semibold text-zinc-100 text-xs truncate">
                              🎬 {video.title}
                            </h5>
                            {isAlreadyAssigned && (
                              <span className="bg-zinc-800 text-zinc-400 text-[10px] px-2 py-0.5 rounded font-mono shrink-0">
                                Já adicionado
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono mt-0.5">
                            <span>{formatDuration(video.durationSeconds)}</span>
                            {video.fileSizeBytes && <span>• {formatFileSize(video.fileSizeBytes)}</span>}
                            <span>•</span>
                            {isReady ? (
                              <span className="text-emerald-400 font-bold">✓ Pronto</span>
                            ) : (
                              <span className="text-amber-400 font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Processando...
                              </span>
                            )}
                          </div>

                          {!isReady && (
                            <p className="text-[10px] text-amber-500/80 mt-1">
                              Apenas vídeos com status PRONTO podem ser vinculados.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-zinc-800 pt-4 shrink-0">
              <span className="text-xs text-zinc-400 font-mono">
                {selectedInModal.length} vídeo(s) selecionado(s)
              </span>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPickerOpen(false)}
                  className="border-zinc-800 text-zinc-300 text-xs hover:bg-zinc-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmAddVideos}
                  disabled={isSavingAssignments}
                  className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs"
                >
                  {isSavingAssignments ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Adicionar vídeos"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- PREVIEW PLAYER MODAL (Requirement #18) --- */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Film className="w-4 h-4 text-amber-500" />
                {previewVideo.title}
              </h3>
              <button onClick={() => setPreviewVideo(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-video bg-black rounded-xl overflow-hidden relative flex items-center justify-center border border-zinc-800">
              {isLoadingPreview ? (
                <div className="flex flex-col items-center text-zinc-400 space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                  <span className="text-xs">Gerando token de autorização...</span>
                </div>
              ) : previewPlayback ? (
                <ProductVideoPlayer
                  videoId={previewVideo.id || previewVideo.videoId}
                  playbackUrl={previewPlayback.playbackUrl}
                  directUrl={previewPlayback.directUrl}
                  posterUrl={previewVideo.thumbnailUrl || undefined}
                  title={previewVideo.title}
                />
              ) : (
                <span className="text-xs text-red-400">Não foi possível carregar o preview.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
