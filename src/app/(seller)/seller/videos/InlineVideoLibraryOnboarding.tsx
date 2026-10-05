"use client";

import React, { useState, useEffect } from "react";
import {
  Film,
  HardDrive,
  Sparkles,
  Loader2,
  QrCode,
  Copy,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Check,
  Zap,
  PlaySquare,
  Lock,
  ArrowRight,
  RefreshCw,
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
  isProvisioned?: boolean;
  syncStatus?: string;
}

interface InlineVideoLibraryOnboardingProps {
  onSubscriptionSuccess: () => void;
}

export function InlineVideoLibraryOnboarding({
  onSubscriptionSuccess,
}: InlineVideoLibraryOnboardingProps) {
  const [plans, setPlans] = useState<VideoPlanItem[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Fetch Video Library Plans
  useEffect(() => {
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
        console.error("[InlineVideoLibraryOnboarding] Fetch plans error:", err);
      })
      .finally(() => {
        if (mounted) setIsLoadingPlans(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Polling for Payment Verification
  useEffect(() => {
    if (!activeInvoice || activeInvoice.status === "PAID") return;

    const interval = setInterval(async () => {
      try {
        setIsVerifying(true);
        const res = await fetch("/api/seller/video-subscriptions/verify", { method: "POST" });
        const data = await res.json();
        if (data.success && data.status === "ACTIVE") {
          setActiveInvoice((prev: any) => ({ ...prev, status: "PAID" }));
          setSuccessMsg("Pagamento confirmado! Sua Biblioteca de Vídeos foi liberada com sucesso.");
          setTimeout(() => {
            onSubscriptionSuccess();
          }, 2000);
        }
      } catch (err) {
        // Silent polling error
      } finally {
        setIsVerifying(false);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeInvoice, onSubscriptionSuccess]);

  const handleSelectPlan = async (plan: VideoPlanItem) => {
    if (plan.isProvisioned === false) {
      setErrorMsg("Este plano está temporariamente indisponível para contratação. O pagamento está sendo configurado pelo Administrador.");
      return;
    }
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
        throw new Error(data.error || "Falha ao gerar cobrança Pix.");
      }

      setActiveInvoice(data.invoice);
    } catch (err: any) {
      console.error("[InlineVideoLibraryOnboarding] Error generating Pix:", err);
      setErrorMsg(err.message || "Erro ao gerar cobrança Pix.");
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
    <div className="space-y-8 my-4">
      {/* Toast Feedback Messages */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-950/90 border border-red-500/30 text-red-200 text-xs flex items-center justify-between shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white text-xs ml-4">
            Fechar
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/30 text-emerald-200 text-xs flex items-center justify-between shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        </div>
      )}

      {/* 1. CLEAR INSTRUCTIONS & HOW IT WORKS */}
      <div className="bg-[#0F0F12] border border-violet-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-violet-600/10 border border-violet-500/30 text-violet-400 flex items-center justify-center shrink-0 shadow-inner">
              <Film className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3" /> RECURSO ADICIONAL WEBGRAN
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Biblioteca de Vídeos & Entrega Automática
              </h2>
              <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
                A Biblioteca de Vídeos permite que você hospede conteúdos em alta resolução (Bunny Stream) com consumo otimizado e os entregue automaticamente no formato de player vertical (estilo Reels/Shorts) imediatamente após o pagamento do cliente.
              </p>
            </div>
          </div>
        </div>

        {/* STEP-BY-STEP INSTRUCTIONS GRID */}
        <div>
          <h3 className="text-xs font-bold uppercase text-zinc-400 tracking-wider mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-400" /> COMO FUNCIONA EM 4 PASSOS SIMPLES:
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#16161C] border border-white/5 rounded-2xl p-4 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-violet-600/20 text-violet-400 font-bold text-xs flex items-center justify-center">
                1
              </div>
              <h4 className="text-xs font-bold text-white">Contrate um Plano</h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Escolha abaixo a cota de armazenamento em GB necessária para sua biblioteca.
              </p>
            </div>

            <div className="bg-[#16161C] border border-white/5 rounded-2xl p-4 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-violet-600/20 text-violet-400 font-bold text-xs flex items-center justify-center">
                2
              </div>
              <h4 className="text-xs font-bold text-white">Faça Upload de Vídeos</h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Envie seus arquivos de vídeo diretamente no painel. Hospedagem profissional Bunny CDN inclusa.
              </p>
            </div>

            <div className="bg-[#16161C] border border-white/5 rounded-2xl p-4 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-violet-600/20 text-violet-400 font-bold text-xs flex items-center justify-center">
                3
              </div>
              <h4 className="text-xs font-bold text-white">Associe aos Produtos</h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                No produto cadastrado, defina a entrega como "Vídeos da Biblioteca" e selecione os vídeos.
              </p>
            </div>

            <div className="bg-[#16161C] border border-white/5 rounded-2xl p-4 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-violet-600/20 text-violet-400 font-bold text-xs flex items-center justify-center">
                4
              </div>
              <h4 className="text-xs font-bold text-white">Entrega no Player Vertical</h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Após a compra paga, seu comprador acessa o player dedicado 9:16 com marca-d'água dinâmica!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ACTIVE PIX PAYMENT INVOICE OR INLINE PLANS GRID */}
      {activeInvoice ? (
        <div className="bg-[#0F0F12] border border-violet-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <QrCode className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Pagamento da Assinatura via SyncPay</h3>
                <p className="text-xs text-zinc-400">
                  Valor da cobrança: <strong className="text-white font-mono text-sm">R$ {Number(activeInvoice.amount).toFixed(2).replace(".", ",")}</strong>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Aguardando Pagamento Pix
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* QR Code */}
            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-white/10 shadow-inner">
              {activeInvoice.qrCode ? (
                <img
                  src={activeInvoice.qrCode}
                  alt="QR Code PIX SyncPay"
                  className="w-56 h-56 object-contain"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-zinc-600 text-xs font-semibold">
                  Gerando QR Code...
                </div>
              )}
              <span className="text-xs text-zinc-600 font-semibold mt-3">
                Escaneie o QR Code no aplicativo do seu banco
              </span>
            </div>

            {/* Pix Copia e Cola */}
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  Código Pix Copia e Cola
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={activeInvoice.qrCodeText || ""}
                    className="w-full bg-[#16161C] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-zinc-300 select-all"
                  />
                  <Button
                    type="button"
                    onClick={() => handleCopyPix(activeInvoice.qrCodeText || "")}
                    className="bg-violet-600 hover:bg-violet-500 text-white text-xs px-5 rounded-xl shrink-0 font-bold"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-300 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                    {copied ? "Copiado!" : "Copiar"}
                  </Button>
                </div>
              </div>

              <div className="pt-2 text-xs text-zinc-400 space-y-2">
                <p className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  A cota de armazenamento é liberada instantaneamente após a confirmação financeira.
                </p>
                {isVerifying && (
                  <p className="text-xs text-violet-400 font-mono animate-pulse flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verificando pagamento no SyncPay...
                  </p>
                )}
              </div>

              <Button
                onClick={() => setActiveInvoice(null)}
                variant="outline"
                className="w-full bg-[#16161C] border-white/10 text-zinc-300 hover:text-white text-xs rounded-xl py-2.5"
              >
                Escolher outro plano
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* INLINE PLAN SELECTION CARDS */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" /> PLANOS DE ARMAZENAMENTO DISPONÍVEIS
              </h3>
              <p className="text-xs text-zinc-400">
                Selecione o plano ideal para a sua biblioteca e ative por pagamento mensal via Pix.
              </p>
            </div>
          </div>

          {isLoadingPlans ? (
            <div className="py-16 text-center space-y-3 bg-[#0F0F12] rounded-3xl border border-white/5">
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin mx-auto" />
              <p className="text-xs text-zinc-400 font-mono">Carregando planos da Biblioteca...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="py-12 text-center bg-[#0F0F12] rounded-3xl border border-white/5 p-6">
              <p className="text-xs text-zinc-400">Nenhum plano cadastrado no momento. Tente novamente em breve.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {plans.map((plan) => {
                const quotaText = plan.storageQuotaGb === -1 ? "Ilimitado" : `${plan.storageQuotaGb} GB`;
                const isAvailable = plan.isProvisioned !== false;

                return (
                  <div
                    key={plan.id}
                    className={`bg-[#0F0F12] border ${
                      isAvailable ? "border-white/10 hover:border-violet-500/50" : "border-amber-500/30 bg-[#141217]"
                    } rounded-3xl p-6 flex flex-col justify-between space-y-6 transition-all duration-300 shadow-xl group hover:-translate-y-1`}
                  >
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400 bg-violet-600/10 border border-violet-500/20 px-2.5 py-0.5 rounded-full">
                            PLANO BIBLIOTECA
                          </span>
                          {!isAvailable && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Lock className="w-3 h-3" /> PENDENTE
                            </span>
                          )}
                        </div>
                        <h4 className="text-xl font-black text-white uppercase mt-2">{plan.name}</h4>
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2 min-h-[32px]">{plan.description}</p>
                      </div>

                      <div className="flex items-baseline gap-1 py-2 border-y border-white/5">
                        <span className="text-3xl font-black text-white font-mono">
                          R$ {plan.price.toFixed(2).replace(".", ",")}
                        </span>
                        <span className="text-xs text-zinc-400 font-medium">/ mês</span>
                      </div>

                      <div className="space-y-2.5 text-xs text-zinc-300 pt-1">
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

                      {!isAvailable && (
                        <p className="text-[11px] text-amber-300/80 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 leading-tight">
                          Este plano está temporariamente indisponível para contratação. O pagamento está sendo configurado.
                        </p>
                      )}
                    </div>

                    <div>
                      {isAvailable ? (
                        <Button
                          onClick={() => handleSelectPlan(plan)}
                          disabled={isGeneratingPix && selectedPlanId === plan.id}
                          className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl py-3 shadow-lg shadow-violet-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          {isGeneratingPix && selectedPlanId === plan.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Gerando Pix...</span>
                            </>
                          ) : (
                            <>
                              <span>Contratar Plano</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          disabled
                          className="w-full bg-zinc-800 text-zinc-500 font-bold text-xs rounded-xl py-3 cursor-not-allowed flex items-center justify-center gap-2 border border-zinc-700/50"
                        >
                          <Lock className="w-4 h-4" />
                          <span>INDISPONÍVEL</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
