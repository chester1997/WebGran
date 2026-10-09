"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ShieldAlert, 
  Bot, 
  QrCode, 
  Sparkles, 
  ShieldCheck, 
  CreditCard, 
  Loader2, 
  Check, 
  Copy, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlanInfo {
  id?: string;
  name?: string;
  price?: number;
  currency?: string;
  billingInterval?: string;
}

interface InvoiceInfo {
  id?: string;
  invoiceId?: string;
  externalId?: string | null;
  amount?: number;
  status?: string;
  qrCode?: string | null;
  qrCodeText?: string | null;
  expiresAt?: string | null;
}

interface ExpiredPaywallProps {
  plan?: PlanInfo | null;
  latestInvoice?: InvoiceInfo | null;
  onPaymentSuccess?: () => void;
}

export function ExpiredPaywall({ plan, latestInvoice, onPaymentSuccess }: ExpiredPaywallProps) {
  const planPrice = typeof plan?.price === "number" ? plan.price : 0;
  const formattedPrice = planPrice > 0 
    ? `R$ ${planPrice.toFixed(2).replace(".", ",")}`
    : null;

  const [generatingPix, setGeneratingPix] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<InvoiceInfo | null>(
    latestInvoice && latestInvoice.status === "PENDING" ? latestInvoice : null
  );
  const [copiedPix, setCopiedPix] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);

  // Sync active invoice if latestInvoice prop updates
  useEffect(() => {
    if (latestInvoice && latestInvoice.status === "PENDING") {
      setActiveInvoice(latestInvoice);
    }
  }, [latestInvoice]);

  // Live timer for active invoice expiration
  useEffect(() => {
    if (!activeInvoice || activeInvoice.status !== "PENDING" || !activeInvoice.expiresAt) {
      setTimeLeftSeconds(null);
      return;
    }

    const calculateTimeLeft = () => {
      const expiresMs = new Date(activeInvoice.expiresAt!).getTime();
      const nowMs = Date.now();
      return Math.max(0, Math.floor((expiresMs - nowMs) / 1000));
    };

    const initial = calculateTimeLeft();
    setTimeLeftSeconds(initial);

    if (initial <= 0) return;

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeftSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeInvoice]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleGeneratePix = async (forceNew = false) => {
    setGeneratingPix(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceNew }),
      });
      const data = await res.json();

      if (data.success && data.invoice) {
        setActiveInvoice(data.invoice);
      } else {
        setErrorMessage(data.error || "Não foi possível gerar a cobrança no gateway.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro de conexão ao gerar o PIX.");
    } finally {
      setGeneratingPix(false);
    }
  };

  const handleCopyPix = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  const handleVerifyPayment = async () => {
    const invId = activeInvoice?.invoiceId || activeInvoice?.id;
    if (!invId) return;

    setVerifyingPayment(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/billing/subscription/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invId }),
      });
      const data = await res.json();

      if (data.success) {
        setPaymentSuccess(true);
        setActiveInvoice(null);
        setTimeout(() => {
          if (onPaymentSuccess) {
            onPaymentSuccess();
          } else {
            window.location.reload();
          }
        }, 1500);
      } else {
        setErrorMessage(data.error || "Pagamento ainda não identificado no gateway. Tente novamente após pagar.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro de conexão ao verificar o pagamento.");
    } finally {
      setVerifyingPayment(false);
    }
  };

  const qrImageUrl = activeInvoice?.qrCode || (
    activeInvoice?.qrCodeText 
      ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(activeInvoice.qrCodeText)}` 
      : null
  );

  return (
    <div className="min-h-[560px] flex items-center justify-center p-4 sm:p-6 fade-in">
      <div className="max-w-4xl w-full bg-[#0E0E11]/95 border border-rose-500/20 rounded-3xl p-6 sm:p-8 md:p-10 shadow-[0_0_60px_rgba(225,29,72,0.12)] space-y-8 relative overflow-hidden backdrop-blur-xl">
        
        {/* Glow ambient background light */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Badge & Title */}
        <div className="text-center sm:text-left space-y-3 border-b border-white/[0.08] pb-6 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider w-max mx-auto sm:mx-0">
              <ShieldAlert className="w-4 h-4" />
              <span>Período de Teste Expirado</span>
            </div>
            {formattedPrice && (
              <span className="text-xs font-semibold text-zinc-400">
                Plano Oficial WebGran SaaS
              </span>
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Sua loja precisa de uma assinatura ativa
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-2xl">
              Seu período de teste gratuito de 3 dias chegou ao fim. Para continuar vendendo no Telegram, gerenciando seus produtos e usando o atendimento automático, ative sua mensalidade.
            </p>
          </div>
        </div>

        {/* Controlled Error Alert if No Price or Config Error */}
        {(!formattedPrice || errorMessage) && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-2xl text-xs flex items-start gap-3 relative z-10">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-white">Atenção</p>
              <p>{errorMessage || "Nenhum preço de assinatura ativo foi retornado pelo servidor. Entre em contato com o suporte."}</p>
            </div>
          </div>
        )}

        {/* Main Grid: Benefits vs Checkout Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch relative z-10">
          
          {/* Left Column: Plan Benefits & Value Proposition */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              
              {/* Price Highlight Banner */}
              <div className="bg-[#141418] border border-white/[0.08] rounded-2xl p-5 flex items-center justify-between shadow-inner">
                <div>
                  <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                    Valor da Assinatura Mensal
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                      {formattedPrice || "—"}
                    </span>
                    <span className="text-xs text-zinc-400 font-medium">/ mês</span>
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <span className="inline-block px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                    PIX • Liberação Imediata
                  </span>
                  <span className="text-[11px] text-zinc-400 block mt-1">Cancele quando quiser</span>
                </div>
              </div>

              {/* Benefits List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  O que está incluído no seu plano:
                </h4>

                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#141418]/80 border border-white/[0.05]">
                    <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">Bot Telegram & Miniapp Ativos</h5>
                      <p className="text-[11px] text-zinc-400 leading-normal">
                        Catálogo interativo e atendimento automatizado 24 horas por dia para seus clientes.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#141418]/80 border border-white/[0.05]">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">Vendas & PIX Direto</h5>
                      <p className="text-[11px] text-zinc-400 leading-normal">
                        Receba os pagamentos de vendas diretamente no seu gateway sem intermediários.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#141418]/80 border border-white/[0.05]">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">Recursos & Catálogo Ilimitados</h5>
                      <p className="text-[11px] text-zinc-400 leading-normal">
                        Produtos, categorias, clientes, cupons e envio de vídeos/mídia sem restrições.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#141418]/80 border border-white/[0.05]">
                    <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 shrink-0 mt-0.5">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">Suporte & Atualizações</h5>
                      <p className="text-[11px] text-zinc-400 leading-normal">
                        Manutenção contínua da infraestrutura, novas ferramentas e suporte técnico dedicado.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Right Column: Interactive PIX Checkout Box */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="bg-[#141418] border border-rose-500/30 rounded-2xl p-6 flex flex-col justify-between space-y-5 shadow-2xl h-full relative overflow-hidden">
              
              {/* Payment Success View */}
              {paymentSuccess ? (
                <div className="my-auto py-8 text-center space-y-4 fade-in">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white">Pagamento Confirmado!</h3>
                    <p className="text-xs text-emerald-400">Sua assinatura foi ativada com sucesso.</p>
                  </div>
                  <p className="text-[11px] text-zinc-400 animate-pulse">
                    Liberando seu acesso ao sistema...
                  </p>
                </div>
              ) : activeInvoice ? (
                /* Active Pending PIX Invoice View */
                <div className="space-y-4 fade-in">
                  <div className="text-center space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                      Cobrança PIX Gerada
                    </span>
                    <h4 className="text-sm font-bold text-white pt-1">Escaneie o QR Code abaixo</h4>
                    <p className="text-[11px] text-zinc-400">
                      Valor: <strong className="text-white">{formattedPrice}</strong>
                    </p>
                  </div>

                  {/* QR Code Graphic */}
                  {qrImageUrl && (
                    <div className="bg-white p-3 rounded-xl max-w-[200px] mx-auto shadow-md border border-white/20">
                      <img 
                        src={qrImageUrl} 
                        alt="QR Code PIX para Assinatura WebGran" 
                        className="w-full h-auto aspect-square object-contain mx-auto" 
                      />
                    </div>
                  )}

                  {/* Copia e Cola Code */}
                  {activeInvoice.qrCodeText && (
                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold text-zinc-300">
                        Código PIX Copia e Cola:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={activeInvoice.qrCodeText}
                          className="w-full bg-[#18181C] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none select-all"
                        />
                        <Button
                          type="button"
                          onClick={() => handleCopyPix(activeInvoice.qrCodeText!)}
                          className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-3 py-2 rounded-xl shrink-0 cursor-pointer flex items-center gap-1.5"
                        >
                          {copiedPix ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Countdown Timer */}
                  {timeLeftSeconds !== null && (
                    <div className="flex items-center justify-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 py-2 px-3 rounded-xl font-mono">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>Este código PIX expira em: <strong>{formatCountdown(timeLeftSeconds)}</strong></span>
                    </div>
                  )}

                  {/* Verification CTA */}
                  <div className="space-y-2 pt-2">
                    <Button
                      type="button"
                      disabled={verifyingPayment}
                      onClick={handleVerifyPayment}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {verifyingPayment ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Verificando pagamento...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Já fiz o pagamento (Verificar)</span>
                        </>
                      )}
                    </Button>

                    <button
                      type="button"
                      disabled={generatingPix}
                      onClick={() => handleGeneratePix(true)}
                      className="w-full text-center text-xs text-zinc-400 hover:text-white pt-1 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Gerar novo código PIX</span>
                    </button>
                  </div>

                </div>
              ) : (
                /* Initial View: Trigger Payment */
                <div className="my-auto space-y-6 text-center py-4 fade-in">
                  <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-500 shadow-md">
                    <CreditCard className="w-7 h-7" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-white">Ativar Assinatura Agora</h3>
                    <p className="text-xs text-zinc-400">
                      Gere o código PIX instantâneo com liberação automática da sua conta após a confirmação.
                    </p>
                  </div>

                  <Button
                    type="button"
                    disabled={generatingPix || !formattedPrice}
                    onClick={() => handleGeneratePix(false)}
                    className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xl shadow-rose-600/25 transition-all cursor-pointer flex items-center justify-center gap-2 overflow-hidden"
                  >
                    {generatingPix ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
                        <span className="truncate">Gerando PIX com SyncPay...</span>
                      </>
                    ) : (
                      <>
                        <QrCode className="w-4.5 h-4.5 shrink-0" />
                        <span className="truncate">Pagar via PIX ({formattedPrice || "R$ --"})</span>
                      </>
                    )}
                  </Button>

                  <div className="pt-2 border-t border-white/[0.06]">
                    <Link
                      href="/seller/settings?tab=assinatura"
                      className="text-xs text-zinc-400 hover:text-rose-400 transition-colors inline-block"
                    >
                      Ver detalhes na aba de Configurações →
                    </Link>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
