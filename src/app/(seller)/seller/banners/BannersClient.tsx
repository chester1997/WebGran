"use client";

import React, { useState } from "react";
import { 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  Edit2, 
  Loader2, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  createBannerAction, 
  updateBannerAction, 
  deleteBannerAction, 
  reorderBannersAction, 
  updateBannerIntervalAction 
} from "./actions";

interface BannerItem {
  id: string;
  storeId: string;
  title: string;
  imageUrl: string;
  linkType: string | null;
  linkValue: string | null;
  position: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface BannersClientProps {
  initialBanners: BannerItem[];
  initialInterval: number;
  maxLimit: number;
}

export default function BannersClient({ initialBanners, initialInterval, maxLimit }: BannersClientProps) {
  const [bannersList, setBannersList] = useState<BannerItem[]>(initialBanners);
  const [bannerInterval, setBannerInterval] = useState<number>(initialInterval);
  const [isSavingInterval, setIsSavingInterval] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    imageUrl: "",
    linkType: "none",
    linkValue: "",
  });

  const activeCount = bannersList.filter(b => b.status === "active").length;
  const isLimitReached = bannersList.length >= maxLimit;

  // Auto-dismiss feedback
  const showFeedback = (msg: string, isError = false) => {
    if (isError) setErrorMsg(msg);
    else setSuccessMsg(msg);
    setTimeout(() => {
      setErrorMsg(null);
      setSuccessMsg(null);
    }, 4000);
  };

  // Handle Interval Change
  const handleIntervalChange = async (seconds: number) => {
    try {
      setIsSavingInterval(true);
      setBannerInterval(seconds);
      await updateBannerIntervalAction(seconds);
      showFeedback(`Intervalo atualizado para ${seconds} segundos.`);
    } catch (err: any) {
      showFeedback(err.message || "Erro ao atualizar intervalo", true);
    } finally {
      setIsSavingInterval(false);
    }
  };

  // Open Add Modal
  const openAddModal = () => {
    if (isLimitReached) {
      showFeedback("Você pode cadastrar no máximo 5 banners.", true);
      return;
    }
    setFormData({ title: "", imageUrl: "", linkType: "none", linkValue: "" });
    setEditingBanner(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (b: BannerItem) => {
    setFormData({
      title: b.title || "",
      imageUrl: b.imageUrl || "",
      linkType: b.linkType || "none",
      linkValue: b.linkValue || "",
    });
    setEditingBanner(b);
    setIsAddModalOpen(true);
  };

  // Submit Form (Create or Edit)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.imageUrl.trim()) {
      showFeedback("Informe a URL da imagem do banner.", true);
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingBanner) {
        await updateBannerAction({
          id: editingBanner.id,
          title: formData.title,
          imageUrl: formData.imageUrl,
          linkType: formData.linkType === "none" ? undefined : formData.linkType,
          linkValue: formData.linkValue,
        });
        setBannersList(prev => prev.map(b => b.id === editingBanner.id ? {
          ...b,
          title: formData.title || b.title,
          imageUrl: formData.imageUrl,
          linkType: formData.linkType === "none" ? null : formData.linkType,
          linkValue: formData.linkValue || null,
        } : b));
        showFeedback("Banner atualizado com sucesso!");
      } else {
        await createBannerAction({
          title: formData.title,
          imageUrl: formData.imageUrl,
          linkType: formData.linkType === "none" ? undefined : formData.linkType,
          linkValue: formData.linkValue,
        });
        showFeedback("Banner cadastrado com sucesso!");
        // Reload list client-side or trigger window reload
        window.location.reload();
      }
      setIsAddModalOpen(false);
    } catch (err: any) {
      showFeedback(err.message || "Erro ao salvar banner", true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async (b: BannerItem) => {
    const nextStatus = b.status === "active" ? "inactive" : "active";
    try {
      setBannersList(prev => prev.map(item => item.id === b.id ? { ...item, status: nextStatus } : item));
      await updateBannerAction({ id: b.id, status: nextStatus });
      showFeedback(`Banner ${nextStatus === "active" ? "ativado" : "desativado"}.`);
    } catch (err: any) {
      showFeedback(err.message || "Erro ao alterar status", true);
      window.location.reload();
    }
  };

  // Delete Banner
  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este banner?")) return;
    try {
      setBannersList(prev => prev.filter(b => b.id !== id));
      await deleteBannerAction(id);
      showFeedback("Banner excluído.");
    } catch (err: any) {
      showFeedback(err.message || "Erro ao excluir banner", true);
      window.location.reload();
    }
  };

  // Reorder Banners (Move Up / Down)
  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= bannersList.length) return;

    const newList = [...bannersList];
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;

    // Update positions
    newList.forEach((item, idx) => {
      item.position = idx;
    });

    setBannersList(newList);

    try {
      const orderedIds = newList.map(b => b.id);
      await reorderBannersAction(orderedIds);
      showFeedback("Ordem dos banners atualizada.");
    } catch (err: any) {
      showFeedback(err.message || "Erro ao reordenar banners", true);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl pb-16">
      {/* Toast Feedback */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/80 border border-red-500/30 text-red-200 flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm font-medium">{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-200 flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm font-medium">{successMsg}</p>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Banners</h1>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
              {bannersList.length} de {maxLimit} banners
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Configure os banners exibidos no topo da sua loja no Mini App.
          </p>
        </div>

        <Button
          onClick={openAddModal}
          disabled={isLimitReached}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl px-5 py-2.5 shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Adicionar Banner
        </Button>
      </div>

      {/* Interval Setting Control */}
      <div className="bg-[#121216] border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 shrink-0">
            <Clock className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Intervalo do Slider</h3>
            <p className="text-xs text-zinc-400">Tempo em segundos de transição automática no Mini App.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {[3, 5, 7, 10].map(seconds => (
            <button
              key={seconds}
              onClick={() => handleIntervalChange(seconds)}
              disabled={isSavingInterval}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                bannerInterval === seconds
                  ? "bg-red-600 text-white border-red-500 shadow-md shadow-red-600/20"
                  : "bg-[#1A1A22] text-zinc-400 border-white/5 hover:text-white hover:border-white/20"
              }`}
            >
              {seconds}s
            </button>
          ))}
        </div>
      </div>

      {/* Banners List Grid */}
      {bannersList.length === 0 ? (
        <div className="bg-[#121216] border border-white/5 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <ImageIcon className="w-12 h-12 text-zinc-600 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">Nenhum banner cadastrado</h3>
          <p className="text-xs text-zinc-400 max-w-sm mb-6">
            Sua loja atualmente não possui banners cadastrados. Adicione o primeiro banner para exibi-lo no topo do Mini App.
          </p>
          <Button
            onClick={openAddModal}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl px-5 py-2"
          >
            + Adicionar Primeiro Banner
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {bannersList.map((banner, index) => {
            const isActive = banner.status === "active";
            return (
              <div
                key={banner.id}
                className={`bg-[#121216] border rounded-2xl overflow-hidden transition-all flex flex-col justify-between ${
                  isActive ? "border-white/10 shadow-md" : "border-white/5 opacity-60"
                }`}
              >
                {/* Banner Image Preview Container */}
                <div className="relative w-full aspect-[2.2/1] bg-black/40 overflow-hidden border-b border-white/5">
                  <img
                    src={banner.imageUrl}
                    alt={banner.title}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLElement).setAttribute("src", "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000");
                    }}
                  />
                  {/* Position Badge */}
                  <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-xs font-bold text-white">
                    #{index + 1}
                  </div>
                  {/* Status Badge */}
                  <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg backdrop-blur-md border text-xs font-semibold flex items-center gap-1.5 ${
                    isActive 
                      ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/30" 
                      : "bg-zinc-900/80 text-zinc-400 border-white/10"
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-400" : "bg-zinc-500"}`} />
                    {isActive ? "Ativo" : "Inativo"}
                  </div>
                </div>

                {/* Info & Actions Footer */}
                <div className="p-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-white truncate">{banner.title || `Banner #${index + 1}`}</h4>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{banner.imageUrl}</p>
                  </div>

                  {/* Actions Button Row */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                    {/* Reorder Up/Down */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMove(index, "up")}
                        disabled={index === 0}
                        title="Subir posição"
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-white/5 transition-all"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMove(index, "down")}
                        disabled={index === bannersList.length - 1}
                        title="Descer posição"
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-white/5 transition-all"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Toggle Status */}
                      <button
                        onClick={() => handleToggleStatus(banner)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                          isActive 
                            ? "bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 border-white/10" 
                            : "bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {isActive ? "Desativar" : "Ativar"}
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => openEditModal(banner)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/5 transition-all"
                        title="Editar Banner"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(banner.id)}
                        className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-500/20 transition-all"
                        title="Excluir Banner"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Banner Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingBanner ? "Editar Banner" : "Adicionar Novo Banner"}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Título do Banner (Opcional)
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Promoção de Lançamento"
                  className="w-full bg-[#181820] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  URL da Imagem (Recomendado 16:9) <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  required
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://exemplo.com/imagem.png"
                  className="w-full bg-[#181820] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500 transition-all"
                />
              </div>

              {formData.imageUrl && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Pré-visualização</label>
                  <div className="w-full aspect-[2.2/1] rounded-xl overflow-hidden border border-white/10 bg-black/60">
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).setAttribute("src", "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000");
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl px-5 py-2 shadow-lg shadow-red-600/20"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingBanner ? (
                    "Salvar Alterações"
                  ) : (
                    "Cadastrar Banner"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
