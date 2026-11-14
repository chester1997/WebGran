"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { DeliveryTypeStep } from "./DeliveryTypeStep";
import { ProductDetailsStep } from "./ProductDetailsStep";
import {
  DeliveryTypeV2,
  NewProductFormStateV2,
  INITIAL_FORM_STATE,
} from "./types";
import { createProductAction } from "../actions";
import { CarouselOption } from "../ProductCarouselsPicker";

export interface NewProductFlowV2Props {
  isOpen: boolean;
  onClose: () => void;
  categories?: { id: string; name: string }[];
  bots?: { id: string; username: string; displayName?: string | null }[];
  carousels?: CarouselOption[];
}

export function NewProductFlowV2({
  isOpen,
  onClose,
  categories = [],
  bots = [],
  carousels = [],
}: NewProductFlowV2Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [formState, setFormState] = useState<NewProductFormStateV2>(INITIAL_FORM_STATE);
  const [previousDeliveryType, setPreviousDeliveryType] = useState<DeliveryTypeV2>("telegram");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset form when modal closes or opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFormState(INITIAL_FORM_STATE);
      setPreviousDeliveryType("telegram");
      setSaving(false);
      setSaveSuccess(false);
      setServerError(null);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while modal is open, without affecting modal's internal scroll
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);


  // When step 1 delivery type changes, we record it
  const handleSelectType = (type: DeliveryTypeV2) => {
    setFormState((prev) => {
      if (prev.deliveryType !== type) {
        // If type changed, reset delivery-specific fields but KEEP all product fields
        return {
          ...prev,
          deliveryType: type,
          deliveryValue: "",
          selectedVideos: [],
        };
      }
      return prev;
    });
  };

  const handleContinueToStep2 = () => {
    setPreviousDeliveryType(formState.deliveryType);
    setServerError(null);
    setStep(2);
  };

  const handleBackToStep1 = () => {
    setServerError(null);
    setStep(1);
  };

  const handleSaveProduct = async () => {
    setSaving(true);
    setServerError(null);

    try {
      const formData = new FormData();

      // Basic product details
      formData.append("title", formState.title.trim());
      if (formState.description) {
        formData.append("description", formState.description);
      }
      formData.append("price", formState.price.replace(",", "."));
      formData.append("duration", formState.duration);
      if (formState.discount) {
        formData.append("discount", formState.discount);
      }
      if (formState.imageUrl) {
        formData.append("coverUrl", formState.imageUrl);
      }
      if (formState.bannerUrl) {
        formData.append("bannerUrl", formState.bannerUrl);
      }

      // Delivery setup
      formData.append("deliveryType", formState.deliveryType);
      if (formState.deliveryType === "product_video") {
        const firstVidId = formState.selectedVideos[0]?.id || "";
        formData.append("deliveryValue", firstVidId);
        const videoIds = formState.selectedVideos.map((v) => v.id);
        formData.append("videoIds", JSON.stringify(videoIds));
      } else {
        formData.append("deliveryValue", formState.deliveryValue.trim());
      }

      // Placement & Visibility
      formData.append("catalogScope", formState.catalogScope);
      if (formState.catalogScope === "BOT_SPECIFIC" && formState.selectedBotId) {
        formData.append("botId", formState.selectedBotId);
      }
      formData.append("sharingMode", formState.sharingMode);
      if (formState.categoryId) {
        formData.append("categoryId", formState.categoryId);
      }
      formData.append("status", formState.status);
      if (formState.badge) {
        formData.append("badge", formState.badge);
      }

      // Mini App Showcase
      if (formState.selectedCarouselIds && formState.selectedCarouselIds.length > 0) {
        formData.append("carouselIds", JSON.stringify(formState.selectedCarouselIds));
      } else {
        // Mark as initialized empty so carousels aren't ignored
        formData.append("carouselIds_initialized", "true");
      }
      formData.append("showViews", formState.showViews ? "true" : "false");
      formData.append("viewsCount", String(formState.viewsCount || 0));
      formData.append("showFire", formState.showFire ? "true" : "false");
      formData.append("fireCount", String(formState.fireCount || 0));

      const res = await createProductAction(formData);

      if (!res.success) {
        setServerError(res.error || "Erro ao salvar produto.");
        setSaving(false);
        return;
      }

      // Success
      setSaveSuccess(true);
      setSaving(false);

      setTimeout(() => {
        router.refresh();
        onClose();
      }, 700);
    } catch (err: any) {
      console.error("[NewProductFlowV2] Erro inesperado:", err);
      setServerError(err?.message || "Ocorreu um erro inesperado ao salvar o produto.");
      setSaving(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const content = (
    <div
      data-testid="new-product-flow-v2-modal"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      {step === 1 ? (
        /* =====================================================================
           PASSO 1: MODAL DESKTOP / BOTTOM SHEET MOBILE
           ===================================================================== */
        <div
          data-testid="step-1-delivery-type"
          className="relative w-full sm:max-w-[760px] max-h-[92dvh] sm:max-h-[90dvh] bg-[#111113] border-t sm:border border-[#26262a] rounded-t-[24px] sm:rounded-2xl p-4 sm:p-7 shadow-2xl overflow-hidden flex flex-col transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          <DeliveryTypeStep
            selectedType={formState.deliveryType}
            onSelectType={handleSelectType}
            onContinue={handleContinueToStep2}
            onClose={onClose}
          />
        </div>
      ) : (
        /* =====================================================================
           PASSO 2: DETALHES DO PRODUTO (MODAL RESPONSIVO COMPLETO)
           ===================================================================== */
        <div
          data-testid="step-2-product-details"
          className="relative w-full sm:max-w-[780px] h-[92dvh] sm:h-auto max-h-[92dvh] sm:max-h-[90dvh] bg-[#111113] border-t sm:border border-[#26262a] rounded-t-[24px] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          <ProductDetailsStep
            state={formState}
            setState={setFormState}
            onBack={handleBackToStep1}
            onSave={handleSaveProduct}
            onClose={onClose}
            categories={categories}
            bots={bots}
            carousels={carousels}
            saving={saving}
            saveSuccess={saveSuccess}
            serverError={serverError}
          />
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}

