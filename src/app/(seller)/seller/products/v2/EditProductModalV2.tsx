"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  X,
  Bot,
  Link as LinkIcon,
  Tv,
  Film,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  Upload,
  Eye,
  Loader2,
  Search,
  CheckSquare,
  Square,
  Edit3,
} from "lucide-react";
import {
  DeliveryTypeV2,
  VideoItemV2,
  DELIVERY_TYPE_CONFIG,
} from "./types";
import { CarouselOption } from "../ProductCarouselsPicker";
import { updateProductAction, getProductVisibilitiesAction } from "../actions";

export interface EditProductModalV2Props {
  product: any;
  categories: any[];
  bots: any[];
  carousels?: CarouselOption[];
}

type TabType = "geral" | "entrega" | "catalogo" | "vitrine";

export function EditProductModalV2({
  product,
  categories = [],
  bots = [],
  carousels = [],
}: EditProductModalV2Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("geral");

  // Form State
  const initialDeliveryType: DeliveryTypeV2 =
    product?.deliveryType === "product_video"
      ? "product_video"
      : product?.deliveryType === "external"
      ? "external"
      : "telegram";

  const [deliveryType, setDeliveryType] = useState<DeliveryTypeV2>(initialDeliveryType);
  const [deliveryValue, setDeliveryValue] = useState<string>(product?.deliveryValue || "");
  const [selectedVideos, setSelectedVideos] = useState<VideoItemV2[]>([]);

  const [title, setTitle] = useState<string>(product?.title || "");
  const [description, setDescription] = useState<string>(product?.description || "");
  const [price, setPrice] = useState<string>(
    product?.price != null ? String(product.price).replace(".", ",") : ""
  );
  const [duration, setDuration] = useState<string>(product?.duration || "lifetime");
  const [imageUrl, setImageUrl] = useState<string>(product?.coverUrl || "");
  const [bannerUrl, setBannerUrl] = useState<string>(product?.bannerUrl || "");

  const initialScope: "STORE_GENERAL" | "BOT_GENERAL" | "BOT_SPECIFIC" =
    (product?.catalogScope as any) || (product?.botId ? "BOT_SPECIFIC" : "STORE_GENERAL");
  const [catalogScope, setCatalogScope] = useState<"STORE_GENERAL" | "BOT_GENERAL" | "BOT_SPECIFIC">(initialScope);
  const [selectedBotId, setSelectedBotId] = useState<string>(product?.botId || "");
  const [sharingMode, setSharingMode] = useState<"EXCLUSIVE" | "ALL_EXISTING" | "CUSTOM">(
    product?.sharingMode || (product?.botId ? "CUSTOM" : "EXCLUSIVE")
  );

  const initialSelectedBotIds = useMemo<string[]>(() => {
    if (Array.isArray(product?.botVisibilities) && product.botVisibilities.length > 0) {
      return product.botVisibilities.map((v: any) => v.botId);
    }
    if (product?.botId) {
      return [product.botId];
    }
    return bots?.[0]?.id ? [bots[0].id] : [];
  }, [product?.botVisibilities, product?.botId, bots]);

  const [selectedBotIds, setSelectedBotIds] = useState<string[]>(initialSelectedBotIds);
  const [botSearch, setBotSearch] = useState<string>("");

  const filteredBots = useMemo(() => {
    if (!botSearch.trim()) return bots;
    const term = botSearch.toLowerCase().trim();
    return bots.filter((b) => {
      const name = (b.displayName || "").toLowerCase();
      const user = (b.username || "").toLowerCase();
      return name.includes(term) || user.includes(term);
    });
  }, [bots, botSearch]);
  const [categoryId, setCategoryId] = useState<string>(product?.categoryId || "");
  const [status, setStatus] = useState<"active" | "draft">(
    product?.status === "draft" ? "draft" : "active"
  );
  const [badge, setBadge] = useState<string>(product?.badge || "");

  const [selectedCarouselIds, setSelectedCarouselIds] = useState<string[]>(
    Array.isArray(product?.carouselIds) ? product.carouselIds : []
  );
  const [showViews, setShowViews] = useState<boolean>(Boolean(product?.showViews));
  const [viewsCount, setViewsCount] = useState<number>(Number(product?.viewsCount || 0));
  const [showFire, setShowFire] = useState<boolean>(Boolean(product?.showFire));
  const [fireCount, setFireCount] = useState<number>(Number(product?.fireCount || 0));

  // Delivery switcher (Part D)
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [pendingType, setPendingType] = useState<DeliveryTypeV2>(initialDeliveryType);

  // Video Library Picker Modal
  const [isLibraryPickerOpen, setIsLibraryPickerOpen] = useState(false);
  const [libraryVideos, setLibraryVideos] = useState<any[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [selectedInModal, setSelectedInModal] = useState<string[]>([]);

  // Video Preview modal
  const [previewVideo, setPreviewVideo] = useState<{ url: string; title: string } | null>(null);

  // Image Uploading
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Telegram Access test
  const [testingAccess, setTestingAccess] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [footerError, setFooterError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);

  const config = DELIVERY_TYPE_CONFIG[deliveryType];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch initial videos for product_video
  useEffect(() => {
    if (!isOpen) return;

    if (initialDeliveryType === "product_video") {
      fetch(`/api/seller/videos`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.videos)) {
            // Fetch assigned videos for this product
            fetch(`/api/seller/products/${product.id}/videos`)
              .then((r) => r.json())
              .then((assignedData) => {
                if (assignedData.success && Array.isArray(assignedData.videos)) {
                  setSelectedVideos(
                    assignedData.videos.map((v: any) => ({
                      id: v.id,
                      title: v.title,
                      thumbnailUrl: v.thumbnailUrl,
                      durationSeconds: v.durationSeconds,
                      fileSizeBytes: v.fileSizeBytes,
                      status: v.status,
                    }))
                  );
                }
              })
              .catch(() => {});
          }
        })
        .catch((err) => console.error("Error loading videos:", err));
    }
  }, [isOpen, product.id, initialDeliveryType]);

  // Fetch initial visibilities for multi-bot
  useEffect(() => {
    if (!isOpen || !product?.id) return;
    getProductVisibilitiesAction(product.id)
      .then((res) => {
        if (res.success && Array.isArray(res.visibilities) && res.visibilities.length > 0) {
          setSelectedBotIds(res.visibilities.map((v: any) => v.botId));
        }
      })
      .catch(() => {});
  }, [isOpen, product?.id]);

  // Reset when opening
  const handleOpen = () => {
    setActiveTab("geral");
    setDeliveryType(initialDeliveryType);
    setDeliveryValue(product?.deliveryValue || "");
    setTitle(product?.title || "");
    setDescription(product?.description || "");
    setPrice(product?.price != null ? String(product.price).replace(".", ",") : "");
    setDuration(product?.duration || "lifetime");
    setImageUrl(product?.coverUrl || "");
    setBannerUrl(product?.bannerUrl || "");
    setCatalogScope(initialScope);
    setSelectedBotId(product?.botId || "");
    setSharingMode(product?.sharingMode || (product?.botId ? "CUSTOM" : "EXCLUSIVE"));
    setSelectedBotIds(initialSelectedBotIds);
    setBotSearch("");
    setCategoryId(product?.categoryId || "");
    setStatus(product?.status === "draft" ? "draft" : "active");
    setBadge(product?.badge || "");
    setSelectedCarouselIds(Array.isArray(product?.carouselIds) ? product.carouselIds : []);
    setShowViews(Boolean(product?.showViews));
    setViewsCount(Number(product?.viewsCount || 0));
    setShowFire(Boolean(product?.showFire));
    setFireCount(Number(product?.fireCount || 0));
    setIsSwitcherOpen(false);
    setPendingType(initialDeliveryType);
    setSaving(false);
    setSaveSuccess(false);
    setFooterError(null);
    setErrors({});
    setShowDiscardConfirm(false);
    setIsOpen(true);
  };

  // Change Tracker (diffCount)
  const diffCount = useMemo(() => {
    let count = 0;
    if (title.trim() !== (product?.title || "").trim()) count++;
    if ((description || "").trim() !== (product?.description || "").trim()) count++;
    const origPrice = product?.price != null ? String(product.price).replace(".", ",") : "";
    if (price.trim() !== origPrice.trim()) count++;
    if (duration !== (product?.duration || "lifetime")) count++;
    if (imageUrl !== (product?.coverUrl || "")) count++;
    if (bannerUrl !== (product?.bannerUrl || "")) count++;
    if (deliveryType !== initialDeliveryType) count++;
    if (deliveryType !== "product_video" && deliveryValue.trim() !== (product?.deliveryValue || "").trim()) count++;
    if (catalogScope !== initialScope) count++;
    if (catalogScope === "BOT_SPECIFIC") {
      if (selectedBotId !== (product?.botId || "")) count++;
      const botsChanged =
        selectedBotIds.length !== initialSelectedBotIds.length ||
        selectedBotIds.some((id) => !initialSelectedBotIds.includes(id));
      if (botsChanged) count++;
    }
    if (categoryId !== (product?.categoryId || "")) count++;
    if (status !== (product?.status === "draft" ? "draft" : "active")) count++;
    if (badge !== (product?.badge || "")) count++;

    const initialCarousels = Array.isArray(product?.carouselIds) ? product.carouselIds : [];
    if (
      selectedCarouselIds.length !== initialCarousels.length ||
      selectedCarouselIds.some((id) => !initialCarousels.includes(id))
    ) {
      count++;
    }

    if (showViews !== Boolean(product?.showViews)) count++;
    if (viewsCount !== Number(product?.viewsCount || 0)) count++;
    if (showFire !== Boolean(product?.showFire)) count++;
    if (fireCount !== Number(product?.fireCount || 0)) count++;

    return count;
  }, [
    title,
    description,
    price,
    duration,
    imageUrl,
    bannerUrl,
    deliveryType,
    deliveryValue,
    catalogScope,
    selectedBotId,
    selectedBotIds,
    initialSelectedBotIds,
    sharingMode,
    categoryId,
    status,
    badge,
    selectedCarouselIds,
    showViews,
    viewsCount,
    showFire,
    fireCount,
    initialDeliveryType,
    initialScope,
    product,
  ]);

  const handleClose = () => {
    if (diffCount > 0 && !saveSuccess) {
      setShowDiscardConfirm(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    setIsOpen(false);
  };

  // Delivery switcher confirmation (Part D)
  const handleConfirmTypeSwitch = () => {
    if (pendingType === deliveryType) {
      setIsSwitcherOpen(false);
      return;
    }
    setDeliveryType(pendingType);
    setDeliveryValue("");
    setSelectedVideos([]);
    setIsSwitcherOpen(false);
  };

  // Video Library Modal handlers
  const handleOpenLibraryForDelivery = async () => {
    setIsLibraryPickerOpen(true);
    setSelectedInModal(selectedVideos.map((v) => v.id));
    setLoadingLibrary(true);
    try {
      const res = await fetch("/api/seller/videos");
      const data = await res.json();
      if (data.success && Array.isArray(data.videos)) {
        setLibraryVideos(data.videos);
      }
    } catch (err) {
      console.error("Error loading library videos:", err);
    } finally {
      setLoadingLibrary(false);
    }
  };

  const handleConfirmLibraryModal = () => {
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

    setSelectedVideos(selected);
    setIsLibraryPickerOpen(false);
  };

  const handleRemoveVideo = (id: string) => {
    setSelectedVideos((prev) => prev.filter((v) => v.id !== id));
  };

  // Image Upload handler
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, imageUrl: "A imagem deve ter no máximo 10MB." }));
      return;
    }
    setUploadingImage(true);
    try {
      const { uploadOptimizedImage } = await import("@/lib/image-optimizer");
      const res = await uploadOptimizedImage(file, "products");
      setImageUrl(res.url);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.imageUrl;
        return next;
      });
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, imageUrl: err?.message || "Erro no upload da imagem." }));
    } finally {
      setUploadingImage(false);
    }
  };

  // Test Telegram Chat
  const handleTestChatAccess = async () => {
    if (!deliveryValue.trim()) return;
    setTestingAccess(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/seller/products/validate-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryValue: deliveryValue.trim(),
          botId: selectedBotId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, message: "Conexão confirmada. O bot é administrador." });
      } else {
        setTestResult({ success: false, message: data.error || "Falha ao validar grupo ou canal." });
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e?.message || "Erro de conexão com o Telegram." });
    } finally {
      setTestingAccess(false);
    }
  };

  // Save changes
  const handleSave = async () => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = "Informe o título do produto.";
    }

    const numPrice = parseFloat(price.replace(",", "."));
    if (isNaN(numPrice) || numPrice <= 0) {
      newErrors.price = "Informe um preço válido.";
    }

    if (deliveryType === "telegram" && !deliveryValue.trim()) {
      newErrors.deliveryValue = "Informe o ID do grupo ou canal.";
    } else if (deliveryType === "external") {
      const link = deliveryValue.trim().toLowerCase();
      if (!link || (!link.startsWith("http://") && !link.startsWith("https://"))) {
        newErrors.deliveryValue = "Informe um link válido com https://";
      }
    } else if (deliveryType === "product_video") {
      if (selectedVideos.length === 0) {
        newErrors.videos = "Vincule pelo menos um vídeo pronto para entrega.";
      }
    }

    if (catalogScope === "BOT_SPECIFIC") {
      if (!selectedBotId) {
        newErrors.selectedBotId = "Selecione o bot proprietário.";
      }
      if (selectedBotIds.length === 0) {
        newErrors.selectedBots = "Selecione pelo menos um bot para disponibilizar o produto.";
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const count = Object.keys(newErrors).length;
      setFooterError(count === 1 ? "1 campo precisa de ajuste" : `${count} campos precisam de ajuste`);

      // Switch to first erroneous tab
      if (newErrors.title || newErrors.price || newErrors.imageUrl) {
        setActiveTab("geral");
      } else if (newErrors.deliveryValue || newErrors.videos) {
        setActiveTab("entrega");
      } else if (newErrors.selectedBotId || newErrors.selectedBots) {
        setActiveTab("catalogo");
      }

      // Scroll smoothly with 90px offset
      setTimeout(() => {
        if (bodyRef.current) {
          const errEl = bodyRef.current.querySelector("[data-error='true']") as HTMLElement | null;
          if (errEl) {
            const parentTop = bodyRef.current.getBoundingClientRect().top;
            const elemTop = errEl.getBoundingClientRect().top;
            const offset = elemTop - parentTop + bodyRef.current.scrollTop - 90;
            bodyRef.current.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
          }
        }
      }, 50);
      return;
    }

    setSaving(true);
    setFooterError(null);

    try {
      const formData = new FormData();
      formData.set("title", title.trim());
      formData.set("description", description);
      formData.set("price", price.replace(",", "."));
      formData.set("duration", duration);
      formData.set("coverUrl", imageUrl);
      formData.set("bannerUrl", bannerUrl);

      formData.set("deliveryType", deliveryType);
      if (deliveryType === "product_video") {
        formData.set("deliveryValue", selectedVideos[0]?.id || "");
        formData.set("videoIds", JSON.stringify(selectedVideos.map((v) => v.id)));
      } else {
        formData.set("deliveryValue", deliveryValue.trim());
      }

      formData.set("catalogScope", catalogScope);
      if (catalogScope === "BOT_SPECIFIC") {
        if (selectedBotId) {
          formData.set("botId", selectedBotId);
        }
        const mode =
          selectedBotIds.length === 1 && selectedBotIds[0] === selectedBotId
            ? "EXCLUSIVE"
            : "CUSTOM";
        formData.set("sharingMode", mode);
        formData.set("targetBotIds", JSON.stringify(selectedBotIds));
      } else {
        formData.set("sharingMode", sharingMode);
      }
      if (categoryId) formData.set("categoryId", categoryId);
      formData.set("status", status);
      if (badge) formData.set("badge", badge);

      if (selectedCarouselIds.length > 0) {
        formData.set("carouselIds", JSON.stringify(selectedCarouselIds));
      } else {
        formData.set("carouselIds_initialized", "true");
      }

      formData.set("showViews", showViews ? "true" : "false");
      formData.set("viewsCount", String(viewsCount || 0));
      formData.set("showFire", showFire ? "true" : "false");
      formData.set("fireCount", String(fireCount || 0));

      const res = await updateProductAction(product.id, formData);
      if (!res?.success) {
        setFooterError(res?.error || "Erro ao salvar alterações.");
        setSaving(false);
        return;
      }

      setSaveSuccess(true);
      setSaving(false);

      setTimeout(() => {
        router.refresh();
        setIsOpen(false);
      }, 700);
    } catch (err: any) {
      console.error("[EditProductModalV2] Save error:", err);
      setFooterError(err?.message || "Ocorreu um erro inesperado ao salvar.");
      setSaving(false);
    }
  };

  const modalContent = isOpen && mounted ? (
    <div
      data-testid="edit-product-modal-v2"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) {
          handleClose();
        }
      }}
    >
      <div
        style={{ ["--cc" as any]: config.cc }}
        className="bg-[#0e0e10] border border-[#232326] sm:rounded-[18px] rounded-t-[20px] max-w-[620px] w-full flex flex-col max-h-[92dvh] sm:max-h-[90dvh] overflow-hidden shadow-2xl animate-in zoom-in-95 text-[#f4f4f5]"
      >
        {/* =========================================================================
            CABEÇALHO FIXO
           ========================================================================= */}
        <div className="shrink-0 p-4 sm:px-5 sm:pt-4 sm:pb-3 border-b border-[#232326]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Product Cover Thumbnail */}
              <div className="w-11 h-11 rounded-[10px] overflow-hidden bg-[#18181b] border border-[#2a2a2f] shrink-0 flex items-center justify-center">
                {imageUrl ? (
                  <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <Film className="w-5 h-5 text-zinc-600" />
                )}
              </div>

              <div className="min-w-0">
                <div className="text-[10px] font-medium tracking-[0.09em] uppercase text-[#71717a]">
                  EDITAR PRODUTO
                </div>
                <h2 className="text-[17px] font-semibold text-[#f4f4f5] truncate leading-tight">
                  {title || "Sem título"}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {/* Delivery pill */}
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                    style={{
                      color: config.cc,
                      backgroundColor: config.colorMixBg12,
                    }}
                  >
                    {deliveryType === "telegram" && <Bot className="w-3 h-3" />}
                    {deliveryType === "external" && <LinkIcon className="w-3 h-3" />}
                    {deliveryType === "product_video" && <Tv className="w-3 h-3" />}
                    <span>{config.name}</span>
                  </span>

                  {/* Status dot */}
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-[#a1a1aa]">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        status === "active" ? "bg-emerald-400" : "bg-zinc-500"
                      }`}
                    />
                    <span>{status === "active" ? "Ativo na loja" : "Rascunho"}</span>
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              aria-label="Fechar"
              className="p-1.5 text-[#9a9aa2] hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 mt-4 -mb-3">
            {[
              { id: "geral" as const, label: "Geral", badge: null },
              { id: "entrega" as const, label: "Entrega", badge: null },
              { id: "catalogo" as const, label: "Catálogo", badge: null },
              {
                id: "vitrine" as const,
                label: "Vitrine",
                badge: selectedCarouselIds.length > 0 ? selectedCarouselIds.length : null,
              },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    borderColor: isActive ? config.cc : "transparent",
                  }}
                  className={`relative px-3.5 py-2 text-[13px] font-medium transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
                    isActive ? "text-[#f4f4f5]" : "text-[#9a9aa2] hover:text-white"
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      style={{
                        backgroundColor: config.colorMixBg12,
                        color: config.cc,
                      }}
                      className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full"
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* =========================================================================
            CORPO ROLÁVEL COM ALTURA ESTÁVEL (min-height: 392px)
           ========================================================================= */}
        <div
          ref={bodyRef}
          style={{
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
          }}
          className="flex-[1_1_auto] min-h-[392px] max-h-[calc(90dvh-170px)] overflow-y-auto px-4 py-4 sm:px-5 space-y-4 custom-scrollbar"
        >
          {/* TAB 1: GERAL */}
          {activeTab === "geral" && (
            <div className="space-y-3.5">
              {/* Título */}
              <div data-error={Boolean(errors.title)}>
                <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
                  Título
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
                  }}
                  placeholder="Nome do produto"
                  className={`w-full h-[42px] bg-[#111113] rounded-[10px] px-3 text-[14px] text-[#f4f4f5] placeholder:text-[#71717a] border transition-all ${
                    errors.title
                      ? "border-[#f87171] focus:border-[#f87171]"
                      : "border-[#2a2a2f] focus:border-[var(--cc)]"
                  } focus:outline-none`}
                />
                {errors.title && <p className="text-[12px] text-[#f87171] mt-1">{errors.title}</p>}
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
                  Descrição
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Conte um pouco sobre o produto..."
                  className="w-full bg-[#111113] rounded-[10px] p-3 text-[13px] text-[#f4f4f5] placeholder:text-[#71717a] border border-[#2a2a2f] focus:border-[var(--cc)] focus:outline-none resize-none"
                />
              </div>

              {/* Preço e Duração */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div data-error={Boolean(errors.price)}>
                  <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
                    Preço (R$)
                  </label>
                  <input
                    type="text"
                    value={price}
                    onChange={(e) => {
                      setPrice(e.target.value);
                      if (errors.price) setErrors((prev) => ({ ...prev, price: "" }));
                    }}
                    placeholder="0,00"
                    className={`w-full h-[42px] bg-[#111113] rounded-[10px] px-3 text-[14px] text-[#f4f4f5] placeholder:text-[#71717a] border transition-all ${
                      errors.price
                        ? "border-[#f87171] focus:border-[#f87171]"
                        : "border-[#2a2a2f] focus:border-[var(--cc)]"
                    } focus:outline-none`}
                  />
                  {errors.price && <p className="text-[12px] text-[#f87171] mt-1">{errors.price}</p>}
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
                    Duração
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full h-[42px] bg-[#111113] rounded-[10px] px-3 text-[13px] text-[#f4f4f5] border border-[#2a2a2f] focus:border-[var(--cc)] focus:outline-none cursor-pointer"
                  >
                    <option value="lifetime">Vitalício</option>
                    <option value="monthly">Mensal (30 dias)</option>
                    <option value="weekly">Semanal (7 dias)</option>
                    <option value="annual">Anual (365 dias)</option>
                  </select>
                </div>
              </div>

              {/* Imagem do produto */}
              <div data-error={Boolean(errors.imageUrl)}>
                <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
                  Imagem do produto
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-[10px] overflow-hidden bg-[#111113] border border-[#2a2a2f] shrink-0 flex items-center justify-center">
                    {imageUrl ? (
                      <img src={imageUrl} alt="Capa" className="w-full h-full object-cover" />
                    ) : (
                      <Film className="w-5 h-5 text-zinc-600" />
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="h-[42px] px-3.5 rounded-[10px] border border-[#2a2a2f] bg-[#111113] hover:border-[#3a3a40] text-[13px] font-medium text-[#f4f4f5] inline-flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                  >
                    {uploadingImage ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 text-zinc-400" />
                        <span>Enviar imagem</span>
                      </>
                    )}
                  </button>

                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 h-[42px] bg-[#111113] rounded-[10px] px-3 text-[13px] text-[#f4f4f5] placeholder:text-[#71717a] border border-[#2a2a2f] focus:border-[var(--cc)] focus:outline-none truncate"
                  />
                </div>
                {errors.imageUrl && (
                  <p className="text-[12px] text-[#f87171] mt-1">{errors.imageUrl}</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ENTREGA */}
          {activeTab === "entrega" && (
            <div className="space-y-4">
              {/* Part D: Delivery Type Switcher */}
              {isSwitcherOpen ? (
                <div className="p-3.5 rounded-[14px] bg-[#141416] border border-amber-500/30 space-y-3 animate-in fade-in duration-150">
                  {/* Warning banner */}
                  <div className="flex items-start gap-2 text-amber-400 text-[12px] leading-[1.45]">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <span>
                      Trocar o tipo remove a entrega configurada (vídeos, ID ou link). Você vai
                      configurar a nova entrega logo em seguida.
                    </span>
                  </div>

                  {/* 3 Type options */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {(["telegram", "external", "product_video"] as DeliveryTypeV2[]).map((t) => {
                      const cfg = DELIVERY_TYPE_CONFIG[t];
                      const isCurrent = t === deliveryType;
                      const isSelected = t === pendingType;

                      return (
                        <div
                          key={t}
                          onClick={() => {
                            if (!isCurrent) setPendingType(t);
                          }}
                          style={{
                            borderColor: isSelected ? cfg.cc : isCurrent ? "#2a2a2f" : "#222226",
                            backgroundColor: isSelected ? cfg.colorMixBg5 : "#0e0e10",
                          }}
                          className={`p-3 rounded-[12px] border transition-all text-left relative ${
                            isCurrent
                              ? "opacity-60 cursor-not-allowed"
                              : "cursor-pointer hover:border-[#3a3a40]"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              {t === "telegram" && <Bot className="w-4 h-4" style={{ color: cfg.cc }} />}
                              {t === "external" && <LinkIcon className="w-4 h-4" style={{ color: cfg.cc }} />}
                              {t === "product_video" && <Tv className="w-4 h-4" style={{ color: cfg.cc }} />}
                            </div>
                            {isCurrent ? (
                              <span className="text-[10px] text-zinc-500 font-semibold uppercase">Atual</span>
                            ) : isSelected ? (
                              <Check className="w-4 h-4" style={{ color: cfg.cc }} />
                            ) : null}
                          </div>
                          <div className="text-[13px] font-medium text-[#f4f4f5] leading-snug">
                            {cfg.title}
                          </div>
                          <div className="text-[11px] text-[#71717a] mt-0.5 leading-[1.3]">
                            {cfg.descriptionMobile}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingType(deliveryType);
                        setIsSwitcherOpen(false);
                      }}
                      className="px-3.5 py-1.5 rounded-[8px] text-[12px] font-medium text-[#9a9aa2] hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmTypeSwitch}
                      style={{ backgroundColor: DELIVERY_TYPE_CONFIG[pendingType].cc }}
                      className="px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold text-[#0a0a0b] hover:brightness-105 active:scale-[0.98]"
                    >
                      Trocar para {DELIVERY_TYPE_CONFIG[pendingType].name}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-[12px] bg-[#111113] border border-[#26262a]">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: config.colorMixBg12, color: config.cc }}
                    >
                      {deliveryType === "telegram" && <Bot className="w-4 h-4" />}
                      {deliveryType === "external" && <LinkIcon className="w-4 h-4" />}
                      {deliveryType === "product_video" && <Tv className="w-4 h-4" />}
                    </div>
                    <div>
                      <span className="text-[11px] text-[#71717a] block leading-none">Tipo de entrega</span>
                      <span className="text-[13px] font-medium text-[#f4f4f5]">{config.name}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingType(deliveryType);
                      setIsSwitcherOpen(true);
                    }}
                    className="text-[12px] text-[#9a9aa2] hover:text-white underline cursor-pointer"
                  >
                    Alterar tipo
                  </button>
                </div>
              )}

              {/* Delivery Configuration Fields */}
              {deliveryType === "telegram" && (
                <div data-error={Boolean(errors.deliveryValue)} className="space-y-2">
                  <label className="block text-[12px] font-medium text-[#a1a1aa]">
                    ID do grupo ou canal
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={deliveryValue}
                      onChange={(e) => {
                        setDeliveryValue(e.target.value);
                        if (errors.deliveryValue) setErrors((prev) => ({ ...prev, deliveryValue: "" }));
                      }}
                      placeholder="-100..."
                      className={`flex-1 h-[42px] bg-[#111113] rounded-[10px] px-3 text-[14px] text-[#f4f4f5] placeholder:text-[#71717a] border transition-all ${
                        errors.deliveryValue
                          ? "border-[#f87171] focus:border-[#f87171]"
                          : "border-[#2a2a2f] focus:border-[var(--cc)]"
                      } focus:outline-none`}
                    />
                    <button
                      type="button"
                      onClick={handleTestChatAccess}
                      disabled={testingAccess || !deliveryValue.trim()}
                      className="px-3.5 h-[42px] rounded-[10px] border border-[#2a2a2f] bg-[#111113] hover:border-[#3a3a40] text-[12px] font-medium text-[#f4f4f5] inline-flex items-center gap-1.5 transition-all shrink-0 disabled:opacity-50"
                    >
                      {testingAccess ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Testar acesso"}
                    </button>
                  </div>
                  {errors.deliveryValue && (
                    <p className="text-[12px] text-[#f87171]">{errors.deliveryValue}</p>
                  )}
                  {testResult && (
                    <p
                      className={`text-[12px] ${
                        testResult.success ? "text-emerald-400" : "text-[#f87171]"
                      }`}
                    >
                      {testResult.message}
                    </p>
                  )}
                </div>
              )}

              {deliveryType === "external" && (
                <div data-error={Boolean(errors.deliveryValue)} className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-[#a1a1aa]">
                    Link de entrega
                  </label>
                  <input
                    type="url"
                    value={deliveryValue}
                    onChange={(e) => {
                      setDeliveryValue(e.target.value);
                      if (errors.deliveryValue) setErrors((prev) => ({ ...prev, deliveryValue: "" }));
                    }}
                    placeholder="https://..."
                    className={`w-full h-[42px] bg-[#111113] rounded-[10px] px-3 text-[14px] text-[#f4f4f5] placeholder:text-[#71717a] border transition-all ${
                      errors.deliveryValue
                        ? "border-[#f87171] focus:border-[#f87171]"
                        : "border-[#2a2a2f] focus:border-[var(--cc)]"
                    } focus:outline-none`}
                  />
                  {errors.deliveryValue && (
                    <p className="text-[12px] text-[#f87171]">{errors.deliveryValue}</p>
                  )}
                  <p className="text-[11px] text-[#71717a]">
                    O link enviado ao comprador após a confirmação do pagamento.
                  </p>
                </div>
              )}

              {deliveryType === "product_video" && (
                <div className="space-y-4">
                  {/* Delivery Videos */}
                  <div data-error={Boolean(errors.videos)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[13px] font-medium text-[#f4f4f5] flex items-center gap-1.5">
                        <span>Vídeos da entrega</span>
                        <span
                          style={{ backgroundColor: config.colorMixBg12, color: config.cc }}
                          className="text-[11px] font-bold px-1.5 py-0.2 rounded-full"
                        >
                          {selectedVideos.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenLibraryForDelivery}
                        className="h-[34px] px-3 rounded-[8px] border border-[#2a2a2f] bg-[#111113] hover:border-[var(--cc)] text-[12px] font-medium text-[#f4f4f5] inline-flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" style={{ color: config.cc }} />
                        <span>Selecionar da biblioteca</span>
                      </button>
                    </div>

                    {errors.videos && (
                      <p className="text-[12px] text-[#f87171] mb-2">{errors.videos}</p>
                    )}

                    {selectedVideos.length > 0 ? (
                      <div className="space-y-2">
                        {selectedVideos.map((video) => (
                          <div
                            key={video.id}
                            className="flex items-center justify-between p-2.5 rounded-[10px] bg-[#111113] border border-[#26262a]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-10 h-10 rounded-[6px] overflow-hidden bg-black/50 shrink-0 flex items-center justify-center">
                                {video.thumbnailUrl ? (
                                  <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                                ) : (
                                  <Film className="w-4 h-4 text-zinc-500" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium text-[#f4f4f5] truncate">{video.title}</p>
                                <div className="flex items-center gap-2 text-[11px] text-[#71717a]">
                                  {video.durationSeconds ? (
                                    <span>
                                      {Math.floor(video.durationSeconds / 60)}:
                                      {String(video.durationSeconds % 60).padStart(2, "0")}
                                    </span>
                                  ) : null}
                                  <span className="text-emerald-400 font-medium">Pronto</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleRemoveVideo(video.id)}
                                aria-label="Remover vídeo"
                                className="p-1.5 text-zinc-500 hover:text-red-400 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 border border-dashed border-[#26262a] rounded-[10px] text-center text-[12px] text-[#71717a]">
                        Nenhum vídeo vinculado. Clique em Selecionar da biblioteca.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CATÁLOGO */}
          {activeTab === "catalogo" && (
            <div className="space-y-4">
              {/* Onde aparece (Scope) */}
              <div>
                <label className="block text-[12px] font-medium text-[#a1a1aa] mb-2">
                  Onde o produto aparece
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      { id: "STORE_GENERAL", title: "Loja geral", desc: "Catálogo web geral da loja" },
                      { id: "BOT_GENERAL", title: "Bot geral", desc: "Mini app de todos os bots ativos" },
                      { id: "BOT_SPECIFIC", title: "Bot específico", desc: "Pertence a um bot proprietário" },
                    ] as const
                  ).map((s) => {
                    const isSelected = catalogScope === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setCatalogScope(s.id)}
                        style={{
                          borderColor: isSelected ? config.cc : "#26262a",
                          backgroundColor: isSelected ? config.colorMixBg5 : "#111113",
                        }}
                        className="p-3 rounded-[10px] border cursor-pointer transition-all"
                      >
                        <div className="text-[13px] font-medium text-[#f4f4f5]">{s.title}</div>
                        <div className="text-[11px] text-[#71717a] mt-0.5 leading-[1.3]">{s.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bot selection for BOT_SPECIFIC */}
              {catalogScope === "BOT_SPECIFIC" && (
                <div
                  className="space-y-3.5 p-3.5 rounded-[12px] bg-[#111113] border border-[#26262a]"
                  data-error={Boolean(errors.selectedBotId || errors.selectedBots)}
                >
                  <div>
                    <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
                      Bot proprietário (dono do produto)
                    </label>
                    <select
                      value={selectedBotId}
                      onChange={(e) => {
                        const newOwnerId = e.target.value;
                        setSelectedBotId(newOwnerId);
                        if (newOwnerId && !selectedBotIds.includes(newOwnerId)) {
                          setSelectedBotIds((prev) => [...prev, newOwnerId]);
                        }
                        if (errors.selectedBotId) setErrors((prev) => ({ ...prev, selectedBotId: "" }));
                      }}
                      className="w-full h-[40px] bg-[#161618] rounded-[8px] px-3 text-[13px] text-[#f4f4f5] border border-[#2a2a2f] focus:border-[var(--cc)] focus:outline-none cursor-pointer"
                    >
                      <option value="">Selecione um bot...</option>
                      {bots.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.displayName || b.username} (@{b.username})
                        </option>
                      ))}
                    </select>
                    {errors.selectedBotId && (
                      <p className="text-[12px] text-[#f87171] mt-1">{errors.selectedBotId}</p>
                    )}
                  </div>

                  {/* Multi-bot selection list */}
                  <div className="pt-2 border-t border-[#26262a]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div>
                        <label className="block text-[12px] font-semibold text-[#f4f4f5]">
                          Disponibilidade nos Mini Apps
                        </label>
                        <p className="text-[11px] text-[#71717a] mt-0.5">
                          Selecione um ou mais bots onde este produto ficará disponível.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="text-[11px] font-medium text-[#a78bfa] bg-[#7c3aed]/10 px-2 py-0.5 rounded-full border border-[#7c3aed]/25">
                          {selectedBotIds.length} {selectedBotIds.length === 1 ? "selecionado" : "selecionados"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBotIds(bots.map((b) => b.id));
                            if (errors.selectedBots) setErrors((prev) => ({ ...prev, selectedBots: "" }));
                          }}
                          className="text-[11px] font-medium text-[#a78bfa] hover:text-[#c4b5fd] transition cursor-pointer"
                        >
                          Selecionar todos
                        </button>
                        <span className="text-[#3f3f46]">•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedBotIds([])}
                          className="text-[11px] font-medium text-[#71717a] hover:text-[#a1a1aa] transition cursor-pointer"
                        >
                          Desmarcar todos
                        </button>
                      </div>
                    </div>

                    {/* Search box */}
                    <div className="relative mb-2.5">
                      <Search className="w-3.5 h-3.5 text-[#71717a] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar por nome ou @username..."
                        value={botSearch}
                        onChange={(e) => setBotSearch(e.target.value)}
                        className="w-full bg-[#161618] border border-[#2a2a2f] rounded-[8px] pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#71717a] focus:outline-none focus:border-[#7c3aed] transition"
                      />
                    </div>

                    {/* List container */}
                    <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {filteredBots.length === 0 ? (
                        <div className="p-4 text-center text-[12px] text-[#71717a] bg-[#161618] rounded-[8px] border border-[#26262a]">
                          Nenhum bot encontrado com os termos pesquisados.
                        </div>
                      ) : (
                        filteredBots.map((b) => {
                          const isSelected = selectedBotIds.includes(b.id);
                          const isOwnerBot = b.id === selectedBotId;

                          return (
                            <div
                              key={b.id}
                              onClick={() => {
                                setSelectedBotIds((prev) => {
                                  const next = prev.includes(b.id)
                                    ? prev.filter((id) => id !== b.id)
                                    : [...prev, b.id];
                                  return next;
                                });
                                if (errors.selectedBots) {
                                  setErrors((prev) => ({ ...prev, selectedBots: "" }));
                                }
                              }}
                              className={`p-2.5 rounded-[10px] border flex items-center justify-between gap-3 transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-[#7c3aed]/10 border-[#7c3aed]/60 shadow-[0_0_12px_rgba(124,58,237,0.12)]"
                                  : "bg-[#161618] border-[#26262a] hover:border-[#3f3f46]"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                {/* Bot Avatar */}
                                <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden border border-[#2a2a2f] bg-[#222226] flex items-center justify-center relative">
                                  {b.photoUrl ? (
                                    <img
                                      src={b.photoUrl}
                                      alt={b.displayName || b.username}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLElement).style.display = "none";
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    className={`w-full h-full flex items-center justify-center font-bold text-[12px] text-[#a1a1aa] bg-gradient-to-br from-[#27272a] to-[#18181b] ${
                                      b.photoUrl ? "absolute inset-0 -z-10" : ""
                                    }`}
                                  >
                                    {(b.displayName || b.username || "B").charAt(0).toUpperCase()}
                                  </div>
                                </div>

                                {/* Bot Info */}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[13px] font-semibold text-[#f4f4f5] truncate">
                                      {b.displayName || b.username}
                                    </span>
                                    {isOwnerBot && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#7c3aed]/25 text-[#c4b5fd] border border-[#7c3aed]/40">
                                        Proprietário
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[#71717a] truncate font-mono mt-0.5">
                                    @{b.username}
                                  </div>
                                </div>
                              </div>

                              {/* Checkbox */}
                              <div
                                className={`w-5 h-5 rounded-[6px] border flex items-center justify-center shrink-0 transition-all ${
                                  isSelected
                                    ? "bg-[#7c3aed] border-[#7c3aed] text-white shadow-sm"
                                    : "border-[#3f3f46] bg-[#1a1a1e]"
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {errors.selectedBots && (
                      <p className="text-[12px] text-[#f87171] mt-1.5">{errors.selectedBots}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Categoria e Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
                    Categoria
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full h-[40px] bg-[#111113] rounded-[8px] px-3 text-[13px] text-[#f4f4f5] border border-[#2a2a2f] focus:border-[var(--cc)] focus:outline-none"
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
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full h-[40px] bg-[#111113] rounded-[8px] px-3 text-[13px] text-[#f4f4f5] border border-[#2a2a2f] focus:border-[var(--cc)] focus:outline-none"
                  >
                    <option value="active">Ativo na loja</option>
                    <option value="draft">Rascunho</option>
                  </select>
                </div>
              </div>

              {/* Badge do produto */}
              <div>
                <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
                  Badge do produto
                </label>
                <select
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  className="w-full h-[40px] bg-[#111113] rounded-[8px] px-3 text-[13px] text-[#f4f4f5] border border-[#2a2a2f] focus:border-[var(--cc)] focus:outline-none"
                >
                  <option value="">Sem badge</option>
                  <option value="NEW">Lançamento (NEW)</option>
                  <option value="HOT">Mais Vendido (HOT)</option>
                  <option value="FEATURED">Destaque</option>
                  <option value="DUB">Dublado (DUB)</option>
                  <option value="LEG">Legendado (LEG)</option>
                </select>
              </div>
            </div>
          )}

          {/* TAB 4: VITRINE */}
          {activeTab === "vitrine" && (
            <div className="space-y-4">
              {/* Carrosséis */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[12px] font-medium text-[#a1a1aa]">
                    Em quais carrosséis este produto deve aparecer?
                  </label>
                  {selectedCarouselIds.length > 0 && (
                    <span
                      style={{ backgroundColor: config.colorMixBg12, color: config.cc }}
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    >
                      {selectedCarouselIds.length} selecionados
                    </span>
                  )}
                </div>

                {carousels.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {carousels.map((car) => {
                      const isSelected = selectedCarouselIds.includes(car.id);
                      return (
                        <button
                          key={car.id}
                          type="button"
                          onClick={() => {
                            setSelectedCarouselIds((prev) =>
                              isSelected ? prev.filter((id) => id !== car.id) : [...prev, car.id]
                            );
                          }}
                          style={{
                            borderColor: isSelected ? config.cc : "#26262a",
                            backgroundColor: isSelected ? config.colorMixBg12 : "#111113",
                            color: isSelected ? config.cc : "#a1a1aa",
                          }}
                          className="px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all hover:border-[#3a3a40]"
                        >
                          {car.name || (car as any).title}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12px] text-[#71717a]">
                    Nenhum carrossel configurado na loja.
                  </p>
                )}
              </div>

              {/* Indicadores da Vitrine (Mini App) */}
              <div>
                <div className="text-[10px] font-semibold tracking-[0.09em] uppercase text-[#71717a] mb-2.5">
                  INDICADORES DA VITRINE (MINI APP)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Card Visualizações */}
                  <div className="p-3.5 rounded-[12px] bg-[#111113] border border-[#26262a] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[13px] font-medium text-[#f4f4f5]">Visualizações</div>
                        <div className="text-[11px] text-[#71717a]">Exibir número de views</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={showViews}
                        onClick={() => setShowViews((v) => !v)}
                        style={{
                          backgroundColor: showViews ? config.cc : "#2a2a2f",
                        }}
                        className="w-10 h-5 rounded-full relative transition-colors cursor-pointer"
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            showViews ? "left-[22px]" : "left-0.5"
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#71717a] mb-1">
                        Número de visualizações
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={viewsCount}
                        onChange={(e) => setViewsCount(parseInt(e.target.value, 10) || 0)}
                        className="w-full h-[36px] bg-[#161618] rounded-[8px] px-3 text-[13px] text-[#f4f4f5] border border-[#2a2a2f] focus:border-[var(--cc)] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Card Foguinho */}
                  <div className="p-3.5 rounded-[12px] bg-[#111113] border border-[#26262a] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[13px] font-medium text-[#f4f4f5]">Foguinho</div>
                        <div className="text-[11px] text-[#71717a]">Exibir destaque em alta</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={showFire}
                        onClick={() => setShowFire((v) => !v)}
                        style={{
                          backgroundColor: showFire ? config.cc : "#2a2a2f",
                        }}
                        className="w-10 h-5 rounded-full relative transition-colors cursor-pointer"
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            showFire ? "left-[22px]" : "left-0.5"
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#71717a] mb-1">
                        Número do foguinho
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={fireCount}
                        onChange={(e) => setFireCount(parseInt(e.target.value, 10) || 0)}
                        className="w-full h-[36px] bg-[#161618] rounded-[8px] px-3 text-[13px] text-[#f4f4f5] border border-[#2a2a2f] focus:border-[var(--cc)] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            RODAPÉ FIXO
           ========================================================================= */}
        <div className="shrink-0 px-4 py-3 sm:px-5 border-t border-[#232326] flex items-center justify-between gap-3">
          {/* Status text */}
          <div className="text-[12px] truncate">
            {footerError ? (
              <span className="text-[#f87171] font-medium">{footerError}</span>
            ) : saveSuccess ? (
              <span className="text-emerald-400 font-medium">Alterações salvas!</span>
            ) : diffCount === 0 ? (
              <span className="text-[#71717a]">Nenhuma alteração</span>
            ) : (
              <span className="text-amber-400 font-medium">
                {diffCount} {diffCount === 1 ? "alteração não salva" : "alterações não salvas"}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="px-3.5 py-2 rounded-[8px] text-[13px] font-medium text-[#9a9aa2] hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || diffCount === 0}
              style={{ backgroundColor: config.cc }}
              className="px-4 py-2 rounded-[8px] text-[13px] font-semibold text-[#0a0a0b] hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </div>
      </div>

      {/* Discard confirmation overlay */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16161a] border border-[#2a2a2f] rounded-[14px] p-5 max-w-sm w-full space-y-3 shadow-2xl animate-in zoom-in-95">
            <h4 className="text-[15px] font-bold text-white">Descartar alterações?</h4>
            <p className="text-[12px] text-[#a1a1aa] leading-[1.4]">
              Você tem alterações não salvas. Se sair agora, todas as modificações serão perdidas.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="px-3 py-1.5 rounded-[8px] text-[12px] text-[#9a9aa2] hover:text-white"
              >
                Continuar editando
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold bg-red-600 hover:bg-red-500 text-white"
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Library Modal */}
      {isLibraryPickerOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#111113] border border-[#26262a] rounded-[18px] max-w-xl w-full p-4 sm:p-5 flex flex-col max-h-[88dvh] shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#232326]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Film className="w-4 h-4" style={{ color: config.cc }} />
                  Selecionar vídeos da biblioteca
                </h3>
                <p className="text-xs text-[#9a9aa2] mt-0.5">
                  Apenas vídeos com status PRONTO podem ser vinculados.
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
                    const isDisabled = !isReady;

                    return (
                      <div
                        key={video.id}
                        onClick={() => {
                          if (isDisabled) return;
                          setSelectedInModal((prev) =>
                            prev.includes(video.id)
                              ? prev.filter((id) => id !== video.id)
                              : [...prev, video.id]
                          );
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
                                isReady ? "text-[#4ade80]" : "text-[#fbbf24]"
                              }`}
                            >
                              {isReady ? "✓ Pronto para entrega" : "Processando..."}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Modal Footer */}
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
                  onClick={handleConfirmLibraryModal}
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
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex-1 bg-transparent border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 h-8 text-xs font-medium rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer"
      >
        <Edit3 className="w-3.5 h-3.5 mr-2" /> Editar
      </button>

      {mounted && typeof document !== "undefined" && createPortal(modalContent, document.body)}
    </>
  );
}
