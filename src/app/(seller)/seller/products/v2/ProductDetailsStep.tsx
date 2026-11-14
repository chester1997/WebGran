"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  ArrowLeft,
  ArrowRight,
  Bot,
  Link as LinkIcon,
  Tv,
  Film,
  Plus,
  Trash2,
  Upload,
  ChevronDown,
  Info,
  AlertTriangle,
  PlugZap,
  Image as ImageIcon,
  Check,
  Search,
  CheckSquare,
  Square,
  Loader2,
} from "lucide-react";
import {
  DeliveryTypeV2,
  DELIVERY_TYPE_CONFIG,
  NewProductFormStateV2,
  VideoItemV2,
} from "./types";
import { CarouselOption } from "../ProductCarouselsPicker";

interface ProductDetailsStepProps {
  state: NewProductFormStateV2;
  setState: React.Dispatch<React.SetStateAction<NewProductFormStateV2>>;
  onBack: () => void;
  onSave: () => Promise<void>;
  onClose: () => void;
  categories: any[];
  bots: any[];
  carousels: CarouselOption[];
  saving: boolean;
  saveSuccess: boolean;
  serverError: string | null;
}

export function ProductDetailsStep({
  state,
  setState,
  onBack,
  onSave,
  onClose,
  categories,
  bots,
  carousels,
  saving,
  saveSuccess,
  serverError,
}: ProductDetailsStepProps) {
  const config = DELIVERY_TYPE_CONFIG[state.deliveryType];
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Field errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [footerError, setFooterError] = useState<string | null>(null);

  // Delivery test state (Telegram)
  const [testingAccess, setTestingAccess] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Video picker state
  const [isLibraryPickerOpen, setIsLibraryPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"delivery" | "trailer">("delivery");
  const [libraryVideos, setLibraryVideos] = useState<any[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [selectedInModal, setSelectedInModal] = useState<string[]>([]);

  // Section 4 Showcase collapsed state
  const [showcaseOpen, setShowcaseOpen] = useState(false);

  // Image upload loading
  const [uploadingImage, setUploadingImage] = useState(false);

  // Clear specific error on change helper
  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      setFooterError(null);
    }
  };

  // Test Telegram connection
  const handleTestConnection = async () => {
    if (!state.deliveryValue.trim()) {
      setErrors((prev) => ({ ...prev, deliveryValue: "Informe o ID antes de testar." }));
      return;
    }

    setTestingAccess(true);
    setTestResult(null);
    clearError("deliveryValue");

    try {
      const res = await fetch("/api/seller/products/validate-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryValue: state.deliveryValue.trim(),
          botId: state.selectedBotId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: "Conexão confirmada. O bot é administrador.",
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || "Falha ao validar grupo ou canal no Telegram.",
        });
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e?.message || "Erro ao conectar com a API.",
      });
    } finally {
      setTestingAccess(false);
    }
  };

  // Open Video Picker Modal for Delivery
  const handleOpenLibraryPicker = async () => {
    setPickerMode("delivery");
    setIsLibraryPickerOpen(true);
    setSelectedInModal(state.selectedVideos.map((v) => v.id));
    setLoadingLibrary(true);
    try {
      const res = await fetch("/api/seller/videos");
      const data = await res.json();
      if (data.success) {
        setLibraryVideos(data.videos || []);
      }
    } catch (err) {
      console.error("Error fetching seller videos:", err);
    } finally {
      setLoadingLibrary(false);
    }
  };

  // Open Video Picker Modal for Trailer
  const handleOpenTrailerPicker = async () => {
    setPickerMode("trailer");
    setIsLibraryPickerOpen(true);
    setSelectedInModal(state.trailerVideoId ? [state.trailerVideoId] : []);
    setLoadingLibrary(true);
    try {
      const res = await fetch("/api/seller/videos");
      const data = await res.json();
      if (data.success) {
        setLibraryVideos(data.videos || []);
      }
    } catch (err) {
      console.error("Error fetching seller videos:", err);
    } finally {
      setLoadingLibrary(false);
    }
  };

  // Confirm video selection from library
  const handleConfirmAddVideos = () => {
    if (pickerMode === "delivery") {
      const selected = libraryVideos
        .filter((v) => selectedInModal.includes(v.id) && v.status === "READY")
        .map((v) => ({
          id: v.id,
          title: v.title,
          thumbnailUrl: v.thumbnailUrl,
          durationSeconds: v.durationSeconds,
          fileSizeBytes: v.fileSizeBytes,
          status: v.status,
        }));

      setState((prev) => ({
        ...prev,
        selectedVideos: selected,
        trailerVideoId: prev.trailerVideoId && selectedInModal.includes(prev.trailerVideoId) ? null : prev.trailerVideoId,
        trailerVideo: prev.trailerVideo && selectedInModal.includes(prev.trailerVideo.id) ? null : prev.trailerVideo,
      }));
      clearError("videos");
    } else {
      const selectedVid = libraryVideos.find((v) => selectedInModal[0] === v.id && v.status === "READY");
      if (selectedVid) {
        if (state.selectedVideos.some((v) => v.id === selectedVid.id)) {
          alert("O trailer precisa ser um arquivo separado do vídeo do produto.");
          return;
        }
        setState((prev) => ({
          ...prev,
          trailerVideoId: selectedVid.id,
          trailerVideo: {
            id: selectedVid.id,
            title: selectedVid.title,
            thumbnailUrl: selectedVid.thumbnailUrl,
            durationSeconds: selectedVid.durationSeconds,
            fileSizeBytes: selectedVid.fileSizeBytes,
            status: selectedVid.status,
          },
        }));
        clearError("trailer");
      } else {
        setState((prev) => ({
          ...prev,
          trailerVideoId: null,
          trailerVideo: null,
        }));
      }
    }
    setIsLibraryPickerOpen(false);
  };

  const handleRemoveVideo = (id: string) => {
    setState((prev) => ({
      ...prev,
      selectedVideos: prev.selectedVideos.filter((v) => v.id !== id),
    }));
  };

  // Handle local image file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, imageUrl: "A imagem deve ter no máximo 5MB." }));
      return;
    }

    setUploadingImage(true);
    try {
      const { uploadOptimizedImage } = await import("@/lib/image-optimizer");
      const res = await uploadOptimizedImage(file, "products");
      setState((prev) => ({ ...prev, imageUrl: res.url }));
      clearError("imageUrl");
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, imageUrl: err?.message || "Erro ao fazer upload da imagem." }));
    } finally {
      setUploadingImage(false);
    }
  };

  // Validation & Save Handler
  const handleValidateAndSubmit = async () => {
    const newErrors: Record<string, string> = {};

    // 1. Delivery Validation
    if (state.deliveryType === "telegram") {
      if (!state.deliveryValue.trim()) {
        newErrors.deliveryValue = "Informe o ID do grupo ou canal.";
      }
    } else if (state.deliveryType === "external") {
      const link = state.deliveryValue.trim().toLowerCase();
      if (!link || (!link.startsWith("http://") && !link.startsWith("https://"))) {
        newErrors.deliveryValue = "Informe um link válido, começando com https://";
      }
    } else if (state.deliveryType === "product_video") {
      if (state.selectedVideos.length === 0) {
        newErrors.videos = "Vincule ao menos um vídeo.";
      }
    }

    // 2. Product Name Validation
    if (!state.title.trim()) {
      newErrors.title = "Informe o nome do produto.";
    }

    // 3. Price Validation
    const numericPrice = parseFloat(state.price.replace(",", "."));
    if (isNaN(numericPrice) || numericPrice <= 0) {
      newErrors.price = "Informe um preço maior que zero.";
    }

    // 4. Specific Bot Validation
    if (state.catalogScope === "BOT_SPECIFIC" && !state.selectedBotId) {
      newErrors.selectedBotId = "Selecione o bot proprietário.";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const count = Object.keys(newErrors).length;
      setFooterError(count === 1 ? "1 campo precisa de ajuste" : `${count} campos precisam de ajuste`);

      // Scroll to first error smoothly inside modal body container
      if (bodyRef.current) {
        const firstErrorEl = bodyRef.current.querySelector("[data-error='true']") as HTMLElement | null;
        if (firstErrorEl) {
          const parentTop = bodyRef.current.getBoundingClientRect().top;
          const elemTop = firstErrorEl.getBoundingClientRect().top;
          const offset = elemTop - parentTop + bodyRef.current.scrollTop - 20;
          bodyRef.current.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
        }
      }
      return;
    }

    // Valid -> proceed to save
    setFooterError(null);
    await onSave();
  };

  return (
    <div
      style={{ ["--cc" as any]: config.cc }}
      className="w-full flex-1 min-h-0 flex flex-col select-none text-[#f4f4f5] overflow-hidden"
    >
      {/* =========================================================================
          CABEÇALHO FIXO
         ========================================================================= */}
      <div className="shrink-0 p-5 sm:px-[22px] sm:pt-5 sm:pb-[14px] border-b border-[#232326]">
        {/* Linha 1: Título e X */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] sm:text-[11px] font-medium tracking-[0.09em] uppercase text-[#71717a] mb-1 sm:mb-1.5">
              <span className="sm:hidden">PASSO 2 DE 2</span>
              <span className="hidden sm:inline">NOVO PRODUTO · PASSO 2 DE 2</span>
            </div>
            <h2 className="text-[20px] sm:text-[22px] font-medium text-[#f4f4f5] leading-tight">
              Detalhes do produto
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1 sm:p-1 text-[#9a9aa2] hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            <X className="w-5 h-5 sm:w-[18px] sm:h-[18px]" />
          </button>
        </div>

        {/* Linha 2: Chip do Tipo + Trocar Tipo */}
        <div className="mt-3 flex items-center gap-2.5">
          <div
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full"
            style={{
              color: config.cc,
              backgroundColor: config.colorMixBg12,
            }}
          >
            {state.deliveryType === "telegram" && <Bot className="w-3.5 h-3.5" />}
            {state.deliveryType === "external" && <LinkIcon className="w-3.5 h-3.5" />}
            {state.deliveryType === "product_video" && <Tv className="w-3.5 h-3.5" />}
            <span>{config.name}</span>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="text-[12px] text-[#9a9aa2] hover:text-white underline cursor-pointer transition-colors"
          >
            Trocar tipo
          </button>
        </div>
      </div>

      {/* =========================================================================
          CORPO ROLÁVEL (Seções 1 a 4)
         ========================================================================= */}
      <div
        ref={bodyRef}
        style={{
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
        className="flex-[1_1_auto] min-h-0 overflow-y-auto px-3.5 py-3 sm:px-[22px] sm:py-3 space-y-3 custom-scrollbar"
      >

        {serverError && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[#f87171] text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#f87171]" />
            <span>{serverError}</span>
          </div>
        )}

        {/* ---------------------------------------------------------------------
            SEÇÃO 1: ENTREGA
           --------------------------------------------------------------------- */}
        <div className="rounded-[14px] bg-[#0e0e10] border border-[#26262a] p-3.5 sm:p-[14px] sm:pb-4">
          <div
            className="text-[11px] font-medium tracking-[0.09em] uppercase mb-3"
            style={{ color: config.cc }}
          >
            ENTREGA · {config.name}
          </div>

          {/* TIPO 1: Grupo ou canal */}
          {state.deliveryType === "telegram" && (
            <div className="space-y-3" data-error={Boolean(errors.deliveryValue)}>
              <div>
                <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
                  ID do grupo ou canal
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={state.deliveryValue}
                    onChange={(e) => {
                      setState((prev) => ({ ...prev, deliveryValue: e.target.value }));
                      clearError("deliveryValue");
                      setTestResult(null);
                    }}
                    placeholder="-1001234567890"
                    className={`flex-1 h-[44px] sm:h-[40px] bg-[#111113] rounded-[10px] px-3 text-[16px] sm:text-[14px] text-[#f4f4f5] placeholder:text-[#71717a] font-mono transition-all border ${
                      errors.deliveryValue
                        ? "border-[#f87171] focus:border-[#f87171]"
                        : "border-[#2a2a2f] focus:border-[var(--cc)]"
                    } focus:outline-none`}
                  />
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingAccess}
                    style={{
                      borderColor: config.cc,
                      backgroundColor: config.colorMixBg12,
                      color: config.cc,
                    }}
                    className="h-[44px] sm:h-[40px] px-3.5 rounded-[10px] border text-[13px] font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-all hover:brightness-110 active:scale-[0.98] cursor-pointer"
                  >
                    <PlugZap className="w-4 h-4" />
                    <span>{testingAccess ? "Testando..." : "Testar conexão"}</span>
                  </button>
                </div>

                {errors.deliveryValue && (
                  <p className="text-[12px] text-[#f87171] mt-1.5">{errors.deliveryValue}</p>
                )}

                {testResult && (
                  <p
                    className={`text-[12px] mt-1.5 font-medium flex items-center gap-1.5 ${
                      testResult.success ? "text-[#4ade80]" : "text-[#f87171]"
                    }`}
                  >
                    {testResult.success && <Check className="w-3.5 h-3.5" />}
                    <span>{testResult.message}</span>
                  </p>
                )}

                <p className="text-[12px] text-[#71717a] mt-1.5 leading-[1.45]">
                  Como obter o ID: acesse um bot de ID no Telegram e encaminhe uma mensagem do canal ou grupo.
                </p>
              </div>

              {/* Aviso Amarelo */}
              <div
                className="rounded-[10px] p-[9px] px-3 flex items-start gap-2 text-[12px] leading-[1.45] text-[#fbbf24]"
                style={{
                  backgroundColor: "color-mix(in srgb, #fbbf24 10%, transparent)",
                }}
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  O bot de vendas precisa ser administrador do grupo ou canal para gerar os convites.
                </span>
              </div>
            </div>
          )}

          {/* TIPO 2: Link externo */}
          {state.deliveryType === "external" && (
            <div data-error={Boolean(errors.deliveryValue)}>
              <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
                Link de entrega
              </label>
              <input
                type="url"
                value={state.deliveryValue}
                onChange={(e) => {
                  setState((prev) => ({ ...prev, deliveryValue: e.target.value }));
                  clearError("deliveryValue");
                }}
                placeholder="https://meudrive.com/arquivo"
                className={`w-full h-[44px] sm:h-[40px] bg-[#111113] rounded-[10px] px-3 text-[16px] sm:text-[14px] text-[#f4f4f5] placeholder:text-[#71717a] transition-all border ${
                  errors.deliveryValue
                    ? "border-[#f87171] focus:border-[#f87171]"
                    : "border-[#2a2a2f] focus:border-[var(--cc)]"
                } focus:outline-none`}
              />
              {errors.deliveryValue && (
                <p className="text-[12px] text-[#f87171] mt-1.5">{errors.deliveryValue}</p>
              )}
              <p className="text-[12px] text-[#71717a] mt-1.5 leading-[1.45]">
                O bot envia este link ao comprador depois da confirmação do pagamento.
              </p>
            </div>
          )}

          {/* TIPO 3: Vídeo do produto */}
          {state.deliveryType === "product_video" && (
            <div data-error={Boolean(errors.videos)}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <p className="text-[13px] text-[#a1a1aa] leading-[1.45]">
                  Selecione os vídeos da sua biblioteca. Eles são liberados no mini app depois do pagamento.
                </p>
                <button
                  type="button"
                  onClick={handleOpenLibraryPicker}
                  style={{
                    borderColor: config.cc,
                    backgroundColor: config.colorMixBg12,
                    color: config.cc,
                  }}
                  className="h-[44px] sm:h-[40px] px-3.5 rounded-[10px] border text-[13px] font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-all hover:brightness-110 active:scale-[0.98] cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Selecionar da biblioteca</span>
                </button>
              </div>

              {errors.videos && (
                <p className="text-[12px] text-[#f87171] mt-2">{errors.videos}</p>
              )}

              {/* Lista de vídeos vinculados */}
              {state.selectedVideos.length > 0 ? (
                <div className="mt-2.5 space-y-2">
                  {state.selectedVideos.map((video) => (
                    <div
                      key={video.id}
                      className="flex items-center gap-2.5 bg-[#111113] border border-[#2a2a2f] rounded-[10px] p-2 px-2.5 text-[13px] text-[#f4f4f5]"
                    >
                      <Film className="w-4 h-4 shrink-0" style={{ color: config.cc }} />
                      <span className="flex-1 truncate font-medium">{video.title}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveVideo(video.id)}
                        aria-label="Remover"
                        className="text-[#71717a] hover:text-[#f87171] p-1 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                /* Estado Vazio */
                <div className="mt-2.5 border border-dashed border-[#2e2e33] rounded-[12px] p-[18px] text-center text-[12px] text-[#71717a] leading-[1.5]">
                  Nenhum vídeo vinculado. Selecione vídeos já processados da biblioteca.
                </div>
              )}

              {/* Bloco de Trailer (opcional) */}
              <div className="mt-4 pt-3.5 border-t border-[#232326]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-medium text-[#f4f4f5]">Trailer</span>
                  <span className="text-[12px] text-[#71717a]">· opcional</span>
                </div>
                <p className="text-[12px] text-[#71717a] mt-0.5 leading-[1.45]">
                  Use um arquivo separado do vídeo do produto, de 15 a 45 segundos.
                </p>

                {state.trailerVideo ? (
                  <div className="mt-2.5 flex items-center justify-between bg-[#111113] border border-[#2a2a2f] rounded-[10px] p-2 px-3 text-[13px] text-[#f4f4f5]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Film className="w-4 h-4 shrink-0" style={{ color: config.cc }} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{state.trailerVideo.title}</p>
                        {state.trailerVideo.durationSeconds ? (
                          <p className="text-[11px] text-[#71717a]">
                            {Math.floor(state.trailerVideo.durationSeconds / 60)}:
                            {String(state.trailerVideo.durationSeconds % 60).padStart(2, "0")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setState((prev) => ({ ...prev, trailerVideoId: null, trailerVideo: null }))}
                      aria-label="Remover trailer"
                      className="text-[#71717a] hover:text-[#f87171] p-1 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={handleOpenTrailerPicker}
                      className="h-[38px] px-3.5 rounded-[10px] border border-[#2a2a2f] bg-[#111113] hover:border-[#3a3a40] text-[13px] font-medium text-[#f4f4f5] inline-flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-[#71717a]" />
                      <span>Escolher da biblioteca</span>
                    </button>
                  </div>
                )}
                {errors.trailer && (
                  <p className="text-[12px] text-[#f87171] mt-1.5">{errors.trailer}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------------
            SEÇÃO 2: PRODUTO
           --------------------------------------------------------------------- */}
        <div className="rounded-[14px] bg-[#0e0e10] border border-[#26262a] p-3.5 sm:p-[14px] sm:pb-4 space-y-3">
          <div className="text-[11px] font-medium tracking-[0.09em] uppercase text-[#71717a] mb-1">
            PRODUTO
          </div>

          {/* Nome do produto */}
          <div data-error={Boolean(errors.title)}>
            <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
              Nome do produto
            </label>
            <input
              type="text"
              value={state.title}
              onChange={(e) => {
                setState((prev) => ({ ...prev, title: e.target.value }));
                clearError("title");
              }}
              placeholder="Ex.: Acesso VIP"
              className={`w-full h-[44px] sm:h-[40px] bg-[#111113] rounded-[10px] px-3 text-[16px] sm:text-[14px] text-[#f4f4f5] placeholder:text-[#71717a] transition-all border ${
                errors.title
                  ? "border-[#f87171] focus:border-[#f87171]"
                  : "border-[#2a2a2f] focus:border-[var(--cc)]"
              } focus:outline-none`}
            />
            {errors.title && <p className="text-[12px] text-[#f87171] mt-1.5">{errors.title}</p>}
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
              Descrição
            </label>
            <textarea
              rows={3}
              value={state.description}
              onChange={(e) => setState((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Detalhe tudo o que o cliente recebe ao comprar este produto..."
              className="w-full bg-[#111113] border border-[#2a2a2f] rounded-[10px] p-3 text-[15px] sm:text-[13px] text-[#f4f4f5] placeholder:text-[#71717a] focus:outline-none focus:border-[var(--cc)] transition-all resize-none"
            />
          </div>

          {/* Grade 2 Colunas: Preço e Duração */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Preço */}
            <div data-error={Boolean(errors.price)}>
              <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
                Preço (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={state.price}
                onChange={(e) => {
                  setState((prev) => ({ ...prev, price: e.target.value }));
                  clearError("price");
                }}
                placeholder="0,00"
                className={`w-full h-[44px] sm:h-[40px] bg-[#111113] rounded-[10px] px-3 text-[16px] sm:text-[14px] text-[#f4f4f5] placeholder:text-[#71717a] font-medium transition-all border ${
                  errors.price
                    ? "border-[#f87171] focus:border-[#f87171]"
                    : "border-[#2a2a2f] focus:border-[var(--cc)]"
                } focus:outline-none`}
              />
              {errors.price && <p className="text-[12px] text-[#f87171] mt-1.5">{errors.price}</p>}
            </div>

            {/* Duração */}
            <div>
              <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
                Duração
              </label>
              <select
                value={state.duration}
                onChange={(e) => setState((prev) => ({ ...prev, duration: e.target.value }))}
                className="w-full h-[44px] sm:h-[40px] bg-[#111113] border border-[#2a2a2f] rounded-[10px] px-3 text-[15px] sm:text-[14px] text-[#f4f4f5] focus:outline-none focus:border-[var(--cc)] transition-all appearance-none cursor-pointer"
              >
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="semiannual">Semestral</option>
                <option value="annual">Anual</option>
                <option value="lifetime">Vitalício</option>
              </select>
            </div>
          </div>

          {/* Grade 2 Colunas: Desconto e Imagem */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            {/* Desconto */}
            <div>
              <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
                Desconto (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={state.discount}
                onChange={(e) => setState((prev) => ({ ...prev, discount: e.target.value }))}
                placeholder="0"
                className="w-full h-[44px] sm:h-[40px] bg-[#111113] border border-[#2a2a2f] rounded-[10px] px-3 text-[16px] sm:text-[14px] text-[#f4f4f5] placeholder:text-[#71717a] focus:outline-none focus:border-[var(--cc)] transition-all"
              />
              <p className="text-[12px] text-[#71717a] mt-1.5">
                Opcional. Ex.: 10 para 10% de desconto.
              </p>
            </div>

            {/* Imagem do Produto */}
            <div data-error={Boolean(errors.imageUrl)}>
              <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
                Imagem do produto
              </label>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                style={{
                  borderColor: config.cc,
                  backgroundColor: config.colorMixBg12,
                  color: config.cc,
                }}
                className="w-full h-[44px] sm:h-[40px] rounded-[10px] border text-[13px] font-medium inline-flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>{uploadingImage ? "Enviando imagem..." : "Enviar imagem"}</span>
              </button>
              <p className="text-[12px] text-[#71717a] mt-1.5">
                600 x 600 px, até 5 MB. Ou cole uma URL.
              </p>

              {/* Campo para colar URL e Preview */}
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={state.imageUrl}
                  onChange={(e) => {
                    setState((prev) => ({ ...prev, imageUrl: e.target.value }));
                    clearError("imageUrl");
                  }}
                  placeholder="https://..."
                  className="flex-1 h-[36px] bg-[#111113] border border-[#2a2a2f] rounded-[8px] px-2.5 text-[12px] text-[#f4f4f5] placeholder:text-[#71717a] focus:outline-none focus:border-[var(--cc)]"
                />
                {state.imageUrl && (
                  <div className="relative w-9 h-9 rounded-md overflow-hidden bg-zinc-900 border border-white/10 shrink-0">
                    <img src={state.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setState((prev) => ({ ...prev, imageUrl: "" }))}
                      className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {errors.imageUrl && (
                <p className="text-[12px] text-[#f87171] mt-1.5">{errors.imageUrl}</p>
              )}
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------------
            SEÇÃO 3: ONDE APARECE
           --------------------------------------------------------------------- */}
        <div className="rounded-[14px] bg-[#0e0e10] border border-[#26262a] p-3.5 sm:p-[14px] sm:pb-4 space-y-3">
          <div className="text-[11px] font-medium tracking-[0.09em] uppercase text-[#71717a] mb-1">
            ONDE APARECE
          </div>

          {/* Disponibilidade do Catálogo (3 Cards) */}
          <div>
            <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
              Disponibilidade do catálogo
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Opção 1: Loja geral */}
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, catalogScope: "STORE_GENERAL", selectedBotId: "" }))}
                style={{
                  borderColor: state.catalogScope === "STORE_GENERAL" ? config.cc : "#26262a",
                  boxShadow: state.catalogScope === "STORE_GENERAL" ? `0 0 0 1px ${config.cc}` : "none",
                  backgroundColor: state.catalogScope === "STORE_GENERAL" ? config.colorMixBg5 : "#111113",
                }}
                className="rounded-[12px] border p-2.5 px-3 text-left transition-all cursor-pointer hover:border-[#3a3a40]"
              >
                <div className="text-[13px] font-medium text-[#f4f4f5]">Loja geral</div>
                <div className="text-[12px] text-[#9a9aa2] mt-0.5 leading-[1.4]">
                  Catálogo web geral da loja
                </div>
              </button>

              {/* Opção 2: Bot geral */}
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, catalogScope: "BOT_GENERAL", selectedBotId: "" }))}
                style={{
                  borderColor: state.catalogScope === "BOT_GENERAL" ? config.cc : "#26262a",
                  boxShadow: state.catalogScope === "BOT_GENERAL" ? `0 0 0 1px ${config.cc}` : "none",
                  backgroundColor: state.catalogScope === "BOT_GENERAL" ? config.colorMixBg5 : "#111113",
                }}
                className="rounded-[12px] border p-2.5 px-3 text-left transition-all cursor-pointer hover:border-[#3a3a40]"
              >
                <div className="text-[13px] font-medium text-[#f4f4f5]">Bot geral</div>
                <div className="text-[12px] text-[#9a9aa2] mt-0.5 leading-[1.4]">
                  Mini app de todos os bots ativos
                </div>
              </button>

              {/* Opção 3: Bot específico */}
              <button
                type="button"
                onClick={() => {
                  setState((prev) => ({
                    ...prev,
                    catalogScope: "BOT_SPECIFIC",
                    selectedBotId: prev.selectedBotId || (bots?.[0]?.id || ""),
                  }));
                }}
                style={{
                  borderColor: state.catalogScope === "BOT_SPECIFIC" ? config.cc : "#26262a",
                  boxShadow: state.catalogScope === "BOT_SPECIFIC" ? `0 0 0 1px ${config.cc}` : "none",
                  backgroundColor: state.catalogScope === "BOT_SPECIFIC" ? config.colorMixBg5 : "#111113",
                }}
                className="rounded-[12px] border p-2.5 px-3 text-left transition-all cursor-pointer hover:border-[#3a3a40]"
              >
                <div className="text-[13px] font-medium text-[#f4f4f5]">Bot específico</div>
                <div className="text-[12px] text-[#9a9aa2] mt-0.5 leading-[1.4]">
                  Pertence a um bot proprietário
                </div>
              </button>
            </div>

            {/* Dica se Bot geral */}
            {state.catalogScope === "BOT_GENERAL" && (
              <div className="text-[12px] text-[#71717a] mt-2.5 flex items-center gap-1.5 leading-snug">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>O produto será adicionado aos mini apps de todos os bots existentes hoje.</span>
              </div>
            )}

            {/* Se Bot específico: Bot proprietário + Compartilhamento */}
            {state.catalogScope === "BOT_SPECIFIC" && (
              <div className="mt-3 pt-3 border-t border-[#26262a] space-y-3">
                <div data-error={Boolean(errors.selectedBotId)}>
                  <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
                    Bot proprietário
                  </label>
                  <select
                    value={state.selectedBotId}
                    onChange={(e) => {
                      setState((prev) => ({ ...prev, selectedBotId: e.target.value }));
                      clearError("selectedBotId");
                    }}
                    className={`w-full h-[44px] sm:h-[40px] bg-[#111113] rounded-[10px] px-3 text-[15px] sm:text-[14px] text-[#f4f4f5] focus:outline-none appearance-none cursor-pointer border ${
                      errors.selectedBotId ? "border-[#f87171]" : "border-[#2a2a2f] focus:border-[var(--cc)]"
                    }`}
                  >
                    <option value="">Selecione um bot...</option>
                    {bots.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.displayName || `@${b.username}`}
                      </option>
                    ))}
                  </select>
                  {errors.selectedBotId && (
                    <p className="text-[12px] text-[#f87171] mt-1.5">{errors.selectedBotId}</p>
                  )}
                </div>

                {/* Compartilhamento */}
                <div>
                  <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
                    Compartilhamento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setState((prev) => ({ ...prev, sharingMode: "EXCLUSIVE" }))}
                      className={`p-2.5 rounded-[10px] border text-xs text-left cursor-pointer transition-colors ${
                        state.sharingMode === "EXCLUSIVE"
                          ? "border-[#4ade80] bg-[#4ade80]/10 text-[#4ade80] font-medium"
                          : "border-[#2a2a2f] bg-[#111113] text-[#9a9aa2]"
                      }`}
                    >
                      ✓ Somente este bot
                    </button>
                    <button
                      type="button"
                      onClick={() => setState((prev) => ({ ...prev, sharingMode: "ALL_EXISTING" }))}
                      className={`p-2.5 rounded-[10px] border text-xs text-left cursor-pointer transition-colors ${
                        state.sharingMode === "ALL_EXISTING"
                          ? "border-[var(--cc)] bg-[var(--cc)]/10 text-[#f4f4f5] font-medium"
                          : "border-[#2a2a2f] bg-[#111113] text-[#9a9aa2]"
                      }`}
                    >
                      🌐 Todos os bots existentes hoje
                    </button>
                  </div>
                  <p className="text-[11px] text-[#71717a] mt-1.5 leading-snug">
                    {state.sharingMode === "ALL_EXISTING"
                      ? "O produto será visível nos bots atuais da loja. Novos bots criados posteriormente não receberão automaticamente."
                      : "Visível exclusivamente no Mini App do bot proprietário."}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Grade 2 Colunas: Categoria e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
                Categoria
              </label>
              <select
                value={state.categoryId}
                onChange={(e) => setState((prev) => ({ ...prev, categoryId: e.target.value }))}
                className="w-full h-[44px] sm:h-[40px] bg-[#111113] border border-[#2a2a2f] rounded-[10px] px-3 text-[15px] sm:text-[14px] text-[#f4f4f5] focus:outline-none focus:border-[var(--cc)] appearance-none cursor-pointer"
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
                Status
              </label>
              <select
                value={state.status}
                onChange={(e) => setState((prev) => ({ ...prev, status: e.target.value as any }))}
                className="w-full h-[44px] sm:h-[40px] bg-[#111113] border border-[#2a2a2f] rounded-[10px] px-3 text-[15px] sm:text-[14px] text-[#f4f4f5] focus:outline-none focus:border-[var(--cc)] appearance-none cursor-pointer"
              >
                <option value="active">Ativo na loja</option>
                <option value="draft">Inativo (Rascunho)</option>
              </select>
            </div>
          </div>

          {/* Badge do Produto */}
          <div>
            <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
              Badge do produto
            </label>
            <select
              value={state.badge}
              onChange={(e) => setState((prev) => ({ ...prev, badge: e.target.value }))}
              className="w-full h-[44px] sm:h-[40px] bg-[#111113] border border-[#2a2a2f] rounded-[10px] px-3 text-[15px] sm:text-[14px] text-[#f4f4f5] focus:outline-none focus:border-[var(--cc)] appearance-none cursor-pointer"
            >
              <option value="">Nenhum badge</option>
              <option value="novo">🟢 Novo (Verde)</option>
              <option value="dublado">🔵 Dublado (DUB)</option>
              <option value="legendado">🔴 Legendado (LEG)</option>
              <option value="br">🇧🇷 BR (Verde e Amarelo)</option>
              <option value="em_alta">🟡 Em alta (Amarelo)</option>
              <option value="lancamento">🟣 Lançamento (Roxo)</option>
              <option value="1_temporada">1 Temporada</option>
            </select>
          </div>
        </div>

        {/* ---------------------------------------------------------------------
            SEÇÃO 4: VITRINE DO MINI APP (Recolhida por padrão)
           --------------------------------------------------------------------- */}
        <div className="rounded-[14px] bg-[#0e0e10] border border-[#26262a] overflow-hidden">
          {/* Cabeçalho clicável */}
          <div
            onClick={() => setShowcaseOpen(!showcaseOpen)}
            className="p-[14px] flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors select-none"
          >
            <div>
              <h3 className="text-[14px] font-medium text-[#f4f4f5]">Vitrine do mini app</h3>
              <p className="text-[12px] text-[#71717a] mt-0.5">Carrosséis e indicadores · opcional</p>
            </div>
            <ChevronDown
              className={`w-[18px] h-[18px] text-[#9a9aa2] transition-transform duration-200 ${
                showcaseOpen ? "rotate-180" : ""
              }`}
            />
          </div>

          {/* Conteúdo Aberto */}
          {showcaseOpen && (
            <div className="p-[14px] pt-0 space-y-4 border-t border-[#26262a]/60 mt-1">
              {/* Carrosséis */}
              <div>
                <label className="block text-[12px] font-medium text-[#a1a1aa] mb-2">
                  Em quais carrosséis este produto deve aparecer?
                </label>
                {carousels && carousels.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {carousels.map((c) => {
                      const isSelected = state.selectedCarouselIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setState((prev) => ({
                              ...prev,
                              selectedCarouselIds: isSelected
                                ? prev.selectedCarouselIds.filter((id) => id !== c.id)
                                : [...prev.selectedCarouselIds, c.id],
                            }));
                          }}
                          style={{
                            borderColor: isSelected ? config.cc : "#2a2a2f",
                            color: isSelected ? config.cc : "#a1a1aa",
                            backgroundColor: isSelected ? config.colorMixBg12 : "#111113",
                          }}
                          className="text-[12px] py-1.5 px-[11px] rounded-full border cursor-pointer transition-colors"
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12px] text-[#71717a]">Nenhum carrossel ativo cadastrado na loja.</p>
                )}
                <p className="text-[12px] text-[#71717a] mt-2.5">
                  Você pode marcar vários carrosséis ou nenhum.
                </p>
              </div>

              {/* Indicadores no card do produto */}
              <div className="pt-2 border-t border-[#26262a]/40 space-y-3">
                <label className="block text-[12px] font-medium text-[#a1a1aa]">
                  Indicadores no card do produto
                </label>
                <div className="flex flex-wrap gap-2">
                  {/* Chip Views */}
                  <button
                    type="button"
                    onClick={() => setState((prev) => ({ ...prev, showViews: !prev.showViews }))}
                    style={{
                      borderColor: state.showViews ? config.cc : "#2a2a2f",
                      color: state.showViews ? config.cc : "#a1a1aa",
                      backgroundColor: state.showViews ? config.colorMixBg12 : "#111113",
                    }}
                    className="text-[12px] py-1.5 px-[11px] rounded-full border cursor-pointer transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>👁 Visualizações</span>
                  </button>

                  {/* Chip Fire */}
                  <button
                    type="button"
                    onClick={() => setState((prev) => ({ ...prev, showFire: !prev.showFire }))}
                    style={{
                      borderColor: state.showFire ? config.cc : "#2a2a2f",
                      color: state.showFire ? config.cc : "#a1a1aa",
                      backgroundColor: state.showFire ? config.colorMixBg12 : "#111113",
                    }}
                    className="text-[12px] py-1.5 px-[11px] rounded-full border cursor-pointer transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>🔥 Foguinho em alta</span>
                  </button>
                </div>

                {/* Inputs numéricos dos indicadores */}
                {(state.showViews || state.showFire) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {state.showViews && (
                      <div>
                        <label className="block text-[11px] text-[#a1a1aa] mb-1">
                          Número de Views (👁)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={state.viewsCount}
                          onChange={(e) =>
                            setState((prev) => ({ ...prev, viewsCount: Number(e.target.value) || 0 }))
                          }
                          placeholder="Ex.: 4500"
                          className="w-full h-[38px] bg-[#111113] border border-[#2a2a2f] rounded-[8px] px-3 text-[13px] text-[#f4f4f5] focus:outline-none focus:border-[var(--cc)]"
                        />
                      </div>
                    )}
                    {state.showFire && (
                      <div>
                        <label className="block text-[11px] text-[#a1a1aa] mb-1">
                          Número do Foguinho (🔥)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={state.fireCount}
                          onChange={(e) =>
                            setState((prev) => ({ ...prev, fireCount: Number(e.target.value) || 0 }))
                          }
                          placeholder="Ex.: 1200"
                          className="w-full h-[38px] bg-[#111113] border border-[#2a2a2f] rounded-[8px] px-3 text-[13px] text-[#f4f4f5] focus:outline-none focus:border-[var(--cc)]"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          RODAPÉ FIXO (Desktop e Mobile)
         ========================================================================= */}
      {/* Desktop Footer */}
      <div className="hidden sm:flex shrink-0 p-[14px] px-[22px] border-t border-[#1e1e22] items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-[14px] text-[#9a9aa2] hover:text-[#f4f4f5] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>

        <div className="flex items-center gap-3">
          {footerError && (
            <span className="text-[13px] text-[#f87171] font-medium">{footerError}</span>
          )}
          {saveSuccess && (
            <span className="text-[13px] text-[#4ade80] font-medium">Produto salvo com sucesso!</span>
          )}
          {saving && (
            <span className="text-[13px] text-[#9a9aa2] font-medium">Salvando produto...</span>
          )}
          <button
            type="button"
            onClick={handleValidateAndSubmit}
            disabled={saving}
            style={{ backgroundColor: config.cc }}
            className="text-[14px] font-medium text-[#0a0a0b] px-[18px] py-[9px] rounded-[10px] transition-all hover:brightness-105 active:scale-[0.98] cursor-pointer shadow-sm"
          >
            {saving ? "Salvando..." : "Salvar produto"}
          </button>
        </div>
      </div>

      {/* Mobile Footer */}
      <div className="flex sm:hidden shrink-0 flex-col p-3.5 pt-2 pb-[calc(14px+env(safe-area-inset-bottom,0px))] border-t border-[#1e1e22]">
        {footerError && (
          <span className="text-[13px] text-[#f87171] font-medium text-center mb-2">
            {footerError}
          </span>
        )}
        {saveSuccess && (
          <span className="text-[13px] text-[#4ade80] font-medium text-center mb-2">
            Produto salvo com sucesso!
          </span>
        )}
        <button
          type="button"
          onClick={handleValidateAndSubmit}
          disabled={saving}
          style={{ backgroundColor: config.cc }}
          className="w-full h-[50px] rounded-[14px] text-[15px] font-medium text-[#0a0a0b] inline-flex items-center justify-center transition-all active:scale-[0.98] cursor-pointer shadow-lg"
        >
          {saving ? "Salvando..." : "Salvar produto"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-[13px] text-[#9a9aa2] hover:text-[#f4f4f5] pt-3 text-center transition-colors"
        >
          Voltar
        </button>
      </div>

      {/* =========================================================================
          MODAL SELETOR DA BIBLIOTECA DE VÍDEOS
         ========================================================================= */}
      {isLibraryPickerOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#111113] border border-[#26262a] rounded-[18px] max-w-xl w-full p-4 sm:p-5 flex flex-col max-h-[88dvh] shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#232326]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Film className="w-4 h-4" style={{ color: config.cc }} />
                  {pickerMode === "trailer" ? "Selecionar trailer da biblioteca" : "Selecionar vídeos da biblioteca"}
                </h3>
                <p className="text-xs text-[#9a9aa2] mt-0.5">
                  {pickerMode === "trailer"
                    ? "Escolha um vídeo PRONTO de 15 a 45s separado dos vídeos de entrega."
                    : "Apenas vídeos com status PRONTO podem ser vinculados."}
                </p>
              </div>
              <button
                onClick={() => setIsLibraryPickerOpen(false)}
                className="text-[#9a9aa2] hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="my-3 relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar vídeo..."
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#16161C] border border-[#2a2a2f] rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--cc)]"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[200px]">
              {loadingLibrary ? (
                <div className="p-8 text-center text-zinc-400 text-xs flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: config.cc }} />
                  <span>Carregando biblioteca...</span>
                </div>
              ) : libraryVideos.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-xs border border-dashed border-[#26262a] rounded-xl">
                  Nenhum vídeo cadastrado na sua biblioteca.
                </div>
              ) : (
                libraryVideos
                  .filter((v) =>
                    librarySearch ? v.title?.toLowerCase().includes(librarySearch.toLowerCase()) : true
                  )
                  .map((video) => {
                    const isSelected = selectedInModal.includes(video.id);
                    const isReady = video.status === "READY";
                    const isAssignedToDelivery = pickerMode === "trailer" && state.selectedVideos.some((v) => v.id === video.id);
                    const isDisabled = !isReady || isAssignedToDelivery;

                    return (
                      <div
                        key={video.id}
                        onClick={() => {
                          if (isDisabled) return;
                          if (pickerMode === "trailer") {
                            setSelectedInModal(isSelected ? [] : [video.id]);
                          } else {
                            setSelectedInModal((prev) =>
                              prev.includes(video.id)
                                ? prev.filter((id) => id !== video.id)
                                : [...prev, video.id]
                            );
                          }
                        }}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                          isDisabled
                            ? "opacity-50 bg-[#16161A]/50 border-white/5 cursor-not-allowed"
                            : isSelected
                            ? "bg-[#16161A] border-[var(--cc)] cursor-pointer"
                            : "bg-[#111113] border-[#26262a] hover:border-[#3a3a40] cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="shrink-0">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4" style={{ color: config.cc }} />
                            ) : (
                              <Square className="w-4 h-4 text-zinc-600" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="font-medium text-white text-xs truncate">
                              🎬 {video.title}
                            </h5>
                            <span
                              className={`text-[10px] font-semibold ${
                                isAssignedToDelivery
                                  ? "text-[#f87171]"
                                  : isReady
                                  ? "text-[#4ade80]"
                                  : "text-[#fbbf24]"
                              }`}
                            >
                              {isAssignedToDelivery
                                ? "Já usado na entrega"
                                : isReady
                                ? "✓ Pronto para entrega"
                                : "Processando..."}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-[#232326] flex items-center justify-between mt-2">
              <span className="text-xs text-[#9a9aa2]">
                {selectedInModal.length} {selectedInModal.length === 1 ? "vídeo selecionado" : "vídeos selecionados"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsLibraryPickerOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-[#9a9aa2] hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAddVideos}
                  style={{ backgroundColor: config.cc }}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold text-[#0a0a0b] hover:brightness-105 active:scale-[0.98]"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

