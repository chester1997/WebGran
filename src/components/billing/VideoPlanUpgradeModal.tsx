"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Check,
  HardDrive,
  Sparkles,
  Loader2,
  QrCode,
  Copy,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface VideoPlanItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  priceCents: number;
  billingCycle: string;
  storageQuotaGb: number;
  isUnlimited: boolean;
}

interface VideoPlanUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlanName?: string | null;
  onSuccess?: () => void;
}

export function VideoPlanUpgradeModal({
  isOpen,
  onClose,
  currentPlanName,
  onSuccess,
}: VideoPlanUpgradeModalProps) {
  const [plans, setPlans] = useState<VideoPlanItem[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsLoadingPlans(true);
    fetch("/api/seller/video-plans")
      .then((res) => res.json())
      .then((data) => {
        if (mounted && data.success && Array.isArray(data.plans)) {
          setPlans(data.plans);
        }
      })
      .catch((err) => {
        console.error("[VideoPlanModal] Fetch plans error:", err);
      })
      .finally(() => {
        if (mounted) setIsLoadingPlans(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  // Payment Verification Polling
  useEffect(() => {
    if (!activeInvoice || activeInvoice.status === "PAID") return;

    const interval = setInterval(async () => {
      try {
        setIsVerifying(true);
        const res = await fetch("/api/seller/video-subscriptions/verify", { method: "POST" });
        const data = await res.json();
        if (data.success && data.status === "ACTIVE") {
          setActiveInvoice((prev: any) => ({ ...prev, status: "PAID" }));
          setSuccessMsg("Pagamento da Biblioteca confirmado! Armazenamento liberado.");
          setTimeout(() => {
            if (onSuccess) onSuccess();
            onClose();
          }, 2500);
        }
      } catch (err) {
        // Silent polling
      } finally {
        setIsVerifying(false);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeInvoice, onClose, onSuccess]);

  if (!isOpen) return null;

  const handleSelectPlan = async (plan: VideoPlanItem) => {
    setSelectedPlanId(plan.id);
    setIsGeneratingPix(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/seller/video-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Falha ao gerar Pix para contratação.");
      }

      setActiveInvoice(data.invoice);
    } catch (err: any) {
      console.error("[VideoPlanModal] Error generating Pix:", err);
      setErrorMsg(err.message || "Erro ao gerar cobrança.");
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const handleCopyPix = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#0F0F12] border border-violet-500/20 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold uppercase tracking-wider">
            <Film className="w-3.5 h-3.5" /> PLANOS DA BIBLIOTECA DE VÍDEOS
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">Escolha um plano de armazenamento</h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto">
            Hospede seus vídeos no Bunny Stream, vincule aos produtos e realize a entrega automática após a compra.
          </p>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/80 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Payment Screen if Active Invoice */}
        {activeInvoice ? (
          <div className="bg-[#16161C] border border-violet-500/30 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Pagamento da Assinatura via SyncPay</h4>
                  <p className="text-xs text-zinc-400">
                    Valor: <strong className="text-white">R$ {Number(activeInvoice.amount).toFixed(2).replace(".", ",")}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Aguardando Pagamento
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* QR Code */}
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-white/10 shadow-inner">
                {activeInvoice.qrCode ? (
                  <img
                    src={activeInvoice.qrCode}
                    alt="QR Code PIX SyncPay"
                    className="w-48 h-48 object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-zinc-600 text-xs font-semibold">
                    Gerando QR Code...
                  </div>
                )}
                <span className="text-[11px] text-zinc-600 font-semibold mt-2">
                  Escaneie o QR Code no app do seu banco
                </span>
              </div>

              {/* Pix Copia e Cola */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Pix Copia e Cola
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={activeInvoice.qrCodeText || ""}
                      className="w-full bg-[#121214] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-zinc-300 select-all"
                    />
                    <Button
                      type="button"
                      onClick={() => handleCopyPix(activeInvoice.qrCodeText || "")}
                      className="bg-violet-600 hover:bg-violet-500 text-white text-xs px-4 rounded-xl shrink-0"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copiado!" : "Copiar"}
                    </Button>
                  </div>
                </div>

                <div className="pt-2 text-xs text-zinc-400 space-y-1">
                  <p className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    A cota de armazenamento será liberada imediatamente após a confirmação financeira.
                  </p>
                  {isVerifying && (
                    <p className="text-[11px] text-violet-400 font-mono animate-pulse">
                      Verificando confirmação no SyncPay...
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => setActiveInvoice(null)}
                  variant="outline"
                  className="w-full bg-[#121214] border-white/10 text-zinc-300 hover:text-white text-xs rounded-xl"
                >
                  Escolher outro plano
                </Button>
              </div>
            </div>
          </div>
        ) : isLoadingPlans ? (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin mx-auto" />
            <p className="text-xs text-zinc-400 font-mono">Carregando planos da Biblioteca...</p>
          </div>
        ) : (
          /* Plans Grid */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isCurrent = currentPlanName && plan.name.toLowerCase() === currentPlanName.toLowerCase();
              const quotaText = plan.storageQuotaGb === -1 ? "Ilimitado" : `${plan.storageQuotaGb} GB`;

              return (
                <div
                  key={plan.id}
                  className={`bg-[#16161C] border rounded-2xl p-6 flex flex-col justify-between space-y-6 transition-all duration-200 relative ${
                    isCurrent
                      ? "border-emerald-500/50 bg-emerald-950/10 shadow-lg shadow-emerald-500/5"
                      : "border-white/5 hover:border-violet-500/30"
                  }`}
                >
                  {isCurrent && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-black font-black text-[10px] uppercase tracking-wider shadow">
                      Seu Plano Atual
                    </span>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xl font-bold text-white uppercase">{plan.name}</h3>
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{plan.description}</p>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white">
                        R$ {plan.price.toFixed(2).replace(".", ",")}
                      </span>
                      <span className="text-xs text-zinc-400 font-medium">/ mês</span>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-white/5 text-xs text-zinc-300">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-violet-400 shrink-0" />
                        <span>Armazenamento: <strong className="text-white font-mono">{quotaText}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Film className="w-4 h-4 text-violet-400 shrink-0" />
                        <span>Hospedagem Bunny CDN: <strong className="text-emerald-400 font-bold">Inclusa</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
                        <span>Entrega Automática: <strong className="text-emerald-400 font-bold">Inclusa</strong></span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {isCurrent ? (
                      <Button
                        disabled
                        className="w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs rounded-xl py-2.5"
                      >
                        <Check className="w-4 h-4 mr-1.5" /> Plano Ativo
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleSelectPlan(plan)}
                        disabled={isGeneratingPix && selectedPlanId === plan.id}
                        className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl py-2.5 shadow-lg shadow-violet-600/30"
                      >
                        {isGeneratingPix && selectedPlanId === plan.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                            <span>Gerando Pix...</span>
                          </>
                        ) : (
                          <>
                            <span>Contratar Plano</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
