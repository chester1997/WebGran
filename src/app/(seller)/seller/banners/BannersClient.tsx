"use client";

import React, { useState, useRef } from "react";
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
  X,
  Upload,
  Link as LinkIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
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

const MAX_BANNER_SIZE_MB = 20;
const MAX_BANNER_SIZE_BYTES = MAX_BANNER_SIZE_MB * 1024 * 1024; // 20,971,520 bytes

export default function BannersClient({ initialBanners, initialInterval, maxLimit }: BannersClientProps) {
  const [bannersList, setBannersList] = useState<BannerItem[]>(initialBanners);
  const [bannerInterval, setBannerInterval] = useState<number>(initialInterval);
  const [isSavingInterval, setIsSavingInterval] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Upload method tab: 'upload' | 'url'
  const [inputMode, setInputMode] = useState<"upload" | "url">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSizeMB, setSelectedFileSizeMB] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    imageUrl: "",
    linkType: "none",
    linkValue: "",
  });

  const isLimitReached = bannersList.length >= maxLimit;

  // Auto-dismiss feedback
  const showFeedback = (msg: string, isError = false) => {
    if (isError) setErrorMsg(msg);
    else setSuccessMsg(msg);
    setTimeout(() => {
      setErrorMsg(null);
      setSuccessMsg(null);
    }, 6000);
  };

  // Handle File Upload Selection with 20MB validation rule
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check 20MB Size Rule
    if (file.size > MAX_BANNER_SIZE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      showFeedback(
        `A imagem excede o tamanho máximo permitido de ${MAX_BANNER_SIZE_MB}MB. O arquivo selecionado possui ${fileSizeMB}MB. Escolha uma imagem menor.`,
        true
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Convert file to Data URL
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setFormData((prev) => ({ ...prev, imageUrl: dataUrl }));
      setSelectedFileName(file.name);
      setSelectedFileSizeMB((file.size / (1024 * 1024)).toFixed(2));
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
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
    setSelectedFileName(null);
    setSelectedFileSizeMB(null);
    setInputMode("upload");
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
    setSelectedFileName(null);
    setSelectedFileSizeMB(null);
    setInputMode(b.imageUrl.startsWith("data:") ? "upload" : "url");
    setEditingBanner(b);
    setIsAddModalOpen(true);
  };

  // Submit Form (Create or Edit via API Endpoint)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.imageUrl.trim()) {
      showFeedback("Selecione uma imagem para o banner ou informe uma URL.", true);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const res = await fetch("/api/seller/banners/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingBanner ? editingBanner.id : undefined,
          title: formData.title,
          imageUrl: formData.imageUrl,
          linkType: formData.linkType,
          linkValue: formData.linkValue,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao salvar o banner.");
      }

      showFeedback(editingBanner ? "Banner atualizado com sucesso!" : "Banner cadastrado com sucesso!");
      setIsAddModalOpen(false);
      
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err: any) {
      showFeedback(err.message || "Erro ao salvar banner.", true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async (b: BannerItem) => {
    const nextStatus = b.status === "active" ? "inactive" : "active";
    try {
      setBannersList((prev) =>
        prev.map((item) => (item.id === b.id ? { ...item, status: nextStatus } : item))
      );
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
      setBannersList((prev) => prev.filter((b) => b.id !== id));
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

    newList.forEach((item, idx) => {
      item.position = idx;
    });

    setBannersList(newList);

    try {
      const orderedIds = newList.map((b) => b.id);
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
            Faça upload ou configure os banners exibidos no topo da sua loja no Mini App. Suporta arquivos de até 20MB.
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

      {/* Banner Size Recommendation Notice Card */}
      <div className="bg-[#121216] border border-red-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <span>Dimensões recomendadas para os Banners</span>
            </h4>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
              <span className="text-amber-400 font-semibold">🌟 Tamanho Ideal: 1200 x 540 px (ou 1200 x 675 px)</span>
              <span className="text-zinc-600">•</span>
              <span className="text-sky-400 font-semibold">⚡ Tamanho Mínimo: 800 x 360 px</span>
            </div>
          </div>
        </div>
        <span className="text-[11px] text-zinc-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 shrink-0">
          ⚡ Imagens maiores se ajustam perfeitamente ao card.
        </span>
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
          {[3, 5, 7, 10].map((seconds) => (
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
            Sua loja atualmente não possui banners cadastrados. Faça upload do primeiro banner (até 20MB) para exibi-lo no Mini App.
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
                      (e.target as HTMLElement).setAttribute(
                        "src",
                        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000"
                      );
                    }}
                  />
                  {/* Position Badge */}
                  <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-xs font-bold text-white">
                    #{index + 1}
                  </div>
                  {/* Status Badge */}
                  <div
                    className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg backdrop-blur-md border text-xs font-semibold flex items-center gap-1.5 ${
                      isActive
                        ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/30"
                        : "bg-zinc-900/80 text-zinc-400 border-white/10"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-400" : "bg-zinc-500"}`} />
                    {isActive ? "Ativo" : "Inativo"}
                  </div>
                </div>

                {/* Info & Actions Footer */}
                <div className="p-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-white truncate">{banner.title || `Banner #${index + 1}`}</h4>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">
                      {banner.imageUrl.startsWith("data:") ? "Imagem enviada via upload local" : banner.imageUrl}
                    </p>
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

            <form onSubmit={handleSubmitForm} className="p-6 space-y-5">
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

              {/* Mode Selection Tabs (Upload File vs External URL) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Imagem do Banner <span className="text-red-400">*</span>
                  </label>
                  <span className="text-[11px] font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                    Tamanho Máximo: 20MB
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 p-1 bg-[#181820] rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => setInputMode("upload")}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      inputMode === "upload"
                        ? "bg-red-600 text-white shadow-md"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload do Dispositivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode("url")}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      inputMode === "url"
                        ? "bg-red-600 text-white shadow-md"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    URL Externa
                  </button>
                </div>
              </div>

              {/* Input Mode: File Upload (Max 20MB) */}
              {inputMode === "upload" && (
                <div className="space-y-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-white/10 hover:border-red-500/50 bg-[#181820] hover:bg-[#1E1E28] rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      Clique para selecionar a imagem
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Formatos: PNG, JPG, WEBP, GIF (Até 20MB)
                    </p>
                    <div className="mt-2 text-[11px] font-semibold space-y-0.5">
                      <p className="text-amber-400">🌟 Tamanho Ideal: 1200 x 540 px (ou 1200 x 675 px)</p>
                      <p className="text-sky-400">⚡ Tamanho Mínimo: 800 x 360 px</p>
                    </div>
                    {selectedFileName && (
                      <div className="mt-3 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{selectedFileName} ({selectedFileSizeMB}MB)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Input Mode: External URL */}
              {inputMode === "url" && (
                <div>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://exemplo.com/imagem.png"
                    className="w-full bg-[#181820] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500 transition-all"
                  />
                  <div className="mt-2 text-[11px] font-semibold space-y-0.5">
                    <p className="text-amber-400">🌟 Tamanho Ideal: 1200 x 540 px (ou 1200 x 675 px)</p>
                    <p className="text-sky-400">⚡ Tamanho Mínimo: 800 x 360 px</p>
                  </div>
                </div>
              )}

              {/* Real-time Preview */}
              {formData.imageUrl && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                    Pré-visualização do Banner (Ajuste Automático ao Card)
                  </label>
                  <div className="w-full aspect-[2.2/1] rounded-xl overflow-hidden border border-white/10 bg-black/60 relative shadow-md flex items-center justify-center">
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover object-center"
                      onError={(e) => {
                        (e.target as HTMLElement).setAttribute(
                          "src",
                          "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000"
                        );
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Buttons */}
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
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl px-5 py-2 shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Cadastrando...</span>
                    </>
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
