"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Check,
  Zap,
  HardDrive,
  Sparkles,
  Loader2,
  QrCode,
  Copy,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  ShieldCheck,
  Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PlanItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  billingInterval: string;
  storageQuotaGb: number;
  maxProducts: string | number;
  maxProductVideos: string | number;
  features?: Record<string, any>;
}

interface PlanUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlanSlug?: string;
  currentPlanId?: string;
  onSuccess?: () => void;
}

export function PlanUpgradeModal({
  isOpen,
  onClose,
  currentPlanSlug,
  currentPlanId,
  onSuccess,
}: PlanUpgradeModalProps) {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Fetch available plans
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsLoadingPlans(true);
    fetch("/api/billing/plans")
      .then((res) => res.json())
      .then((data) => {
        if (mounted && data.success && Array.isArray(data.plans)) {
          setPlans(data.plans);
        }
      })
      .catch((err) => {
        console.error("[UpgradeModal] Fetch plans error:", err);
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
    if (!activeInvoice || activeInvoice.status === "PAID" || activeInvoice.status === "EXPIRED") {
      return;
    }

    const interval = setInterval(async () => {
      try {
        setIsVerifying(true);
        const res = await fetch("/api/billing/subscription/verify", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          setActiveInvoice((prev: any) => ({ ...prev, status: "PAID" }));
          setSuccessMsg("Pagamento confirmado e plano atualizado com sucesso!");
          setTimeout(() => {
            if (onSuccess) onSuccess();
            onClose();
          }, 3000);
        }
      } catch (err) {
        // Silent polling error
      } finally {
        setIsVerifying(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [activeInvoice, onClose, onSuccess]);

  if (!isOpen) return null;

  const handleSelectPlan = async (plan: PlanItem) => {
    setSelectedPlanId(plan.id);
    setIsGeneratingPix(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, forceNew: true }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Falha ao gerar Pix para upgrade.");
      }

      setActiveInvoice(data.invoice);
    } catch (err: any) {
      console.error("[UpgradeModal] Error generating Pix:", err);
      setErrorMsg(err.message || "Erro ao gerar cobrança de upgrade.");
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

  const getQrCodeImageUrl = (inv: any) => {
    if (inv?.qrCode) return inv.qrCode;
    if (inv?.qrCodeText) {
      return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(inv.qrCodeText)}`;
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#0F0F12] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> UPGRADE DE ARMAZENAMENTO & PLANO
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">Escolha o plano ideal para a sua loja</h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto">
            Aumente a sua capacidade de armazenamento de vídeos, produtos e recursos no WebGran SaaS.
          </p>
        </div>

        {/* Toast Feedback */}
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

        {/* If Active Invoice Exists, Display SyncPay Pix Screen */}
        {activeInvoice ? (
          <div className="bg-[#16161C] border border-red-500/30 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Pagamento do Upgrade via SyncPay</h4>
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
                {getQrCodeImageUrl(activeInvoice) ? (
                  <img
                    src={getQrCodeImageUrl(activeInvoice)!}
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
                      className="bg-white/10 hover:bg-white/20 text-white text-xs px-4 rounded-xl shrink-0"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copiado!" : "Copiar"}
                    </Button>
                  </div>
                </div>

                <div className="pt-2 text-xs text-zinc-400 space-y-1">
                  <p className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    O plano será ativado automaticamente após a confirmação financeira.
                  </p>
                  {isVerifying && (
                    <p className="text-[11px] text-zinc-500 font-mono animate-pulse">
                      Verificando confirmação financeira na SyncPay...
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
            <Loader2 className="w-8 h-8 text-red-500 animate-spin mx-auto" />
            <p className="text-xs text-zinc-400 font-mono">Carregando planos disponíveis...</p>
          </div>
        ) : (
          /* Plans Grid */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isCurrent =
                (currentPlanSlug && plan.slug === currentPlanSlug) ||
                (currentPlanId && plan.id === currentPlanId);

              const quotaText =
                plan.storageQuotaGb === -1 || plan.storageQuotaGb === 9999
                  ? "Ilimitado"
                  : `${plan.storageQuotaGb} GB`;

              return (
                <div
                  key={plan.id}
                  className={`bg-[#16161C] border rounded-2xl p-6 flex flex-col justify-between space-y-6 transition-all duration-200 relative ${
                    isCurrent
                      ? "border-emerald-500/50 bg-emerald-950/10 shadow-lg shadow-emerald-500/5"
                      : "border-white/5 hover:border-white/20"
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
                        <HardDrive className="w-4 h-4 text-red-400 shrink-0" />
                        <span>Armazenamento: <strong className="text-white font-mono">{quotaText}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Film className="w-4 h-4 text-red-400 shrink-0" />
                        <span>Vídeos de Produtos: <strong className="text-white font-mono">{plan.maxProductVideos}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-red-400 shrink-0" />
                        <span>Limite de Produtos: <strong className="text-white font-mono">{plan.maxProducts}</strong></span>
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
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl py-2.5 shadow-lg shadow-red-600/20"
                      >
                        {isGeneratingPix && selectedPlanId === plan.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                            <span>Gerando Pix...</span>
                          </>
                        ) : (
                          <>
                            <span>Fazer Upgrade</span>
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
