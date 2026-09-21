"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  User, 
  Sparkles, 
  Camera, 
  Trash2, 
  Loader2, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  CreditCard, 
  QrCode, 
  Copy, 
  Check, 
  Clock, 
  Calendar, 
  RefreshCw, 
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SellerProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role?: string;
}

interface InvoiceHistoryItem {
  id: string;
  externalId: string | null;
  amount: number;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  qrCode?: string | null;
  qrCodeText?: string | null;
}

interface SubscriptionData {
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  };
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    billingInterval: string;
  };
  latestInvoice: InvoiceHistoryItem | null;
  invoiceHistory: InvoiceHistoryItem[];
}

interface Props {
  storeName: string;
  isExempt?: boolean;
  sellerProfile: SellerProfile;
  subscriptionData: SubscriptionData;
}

function resizeAvatarImage(file: File, maxWidth = 400, maxHeight = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/webp", 0.85));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SettingsClient({ storeName, isExempt, sellerProfile, subscriptionData }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"perfil" | "assinatura">("perfil");

  // Profile Form States
  const [name, setName] = useState(sellerProfile.name);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(sellerProfile.avatarUrl);
  const [savingProfile, setSavingProfile] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Subscription States
  const [generatingPix, setGeneratingPix] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<any>(subscriptionData.latestInvoice);
  const [copiedPix, setCopiedPix] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);

  // 10-Minute Server-Based Countdown Timer
  useEffect(() => {
    if (!activeInvoice || activeInvoice.status !== 'PENDING' || !activeInvoice.expiresAt) {
      setTimeLeftSeconds(null);
      return;
    }

    const calculateTimeLeft = () => {
      const expiresMs = new Date(activeInvoice.expiresAt).getTime();
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMessage("Por favor, selecione uma imagem no formato JPG, PNG ou WEBP.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("A imagem selecionada excede o tamanho máximo de 10MB.");
      return;
    }

    setErrorMessage(null);
    try {
      const resizedBase64 = await resizeAvatarImage(file);
      setAvatarUrl(resizedBase64);
    } catch (err) {
      setErrorMessage("Erro ao processar imagem.");
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("O nome do vendedor é obrigatório.");
      return;
    }

    setSavingProfile(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/seller/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          avatarUrl: avatarUrl
        })
      });

      const data = await res.json();

      if (data.success) {
        showToast("Perfil atualizado com sucesso.");
        window.dispatchEvent(new Event("seller-profile-updated"));
        router.refresh();
      } else {
        setErrorMessage(data.error || "Erro ao salvar perfil.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar perfil.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleGeneratePixPayment = async (forceNew = false) => {
    setGeneratingPix(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/billing/subscription", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceNew })
      });
      const data = await res.json();

      if (data.success && data.invoice) {
        setActiveInvoice(data.invoice);
        showToast(forceNew ? "Novo PIX gerado com sucesso via Cora!" : "Cobrança PIX gerada com sucesso via Cora.");
      } else {
        setErrorMessage(data.error || "Erro ao gerar PIX para assinatura.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao comunicar com servidor de pagamento.");
    } finally {
      setGeneratingPix(false);
    }
  };

  const handleCopyPix = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  const handleVerifyPayment = async () => {
    if (!activeInvoice?.invoiceId && !activeInvoice?.id) return;
    const invId = activeInvoice.invoiceId || activeInvoice.id;

    setVerifyingPayment(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/billing/subscription/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invId })
      });

      const data = await res.json();

      if (data.success) {
        showToast("Pagamento verificado e assinatura ativada com sucesso!");
        setActiveInvoice(null);
        router.refresh();
      } else {
        setErrorMessage(data.error || "Pagamento ainda não identificado no sistema Cora.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro de conexão ao consultar status.");
    } finally {
      setVerifyingPayment(false);
    }
  };

  const firstLetter = (name || sellerProfile.email || "V").charAt(0).toUpperCase();
  const subStatus = subscriptionData.subscription.status;
  const planPrice = subscriptionData.plan.price;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-500 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-sm font-semibold animate-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <User className="w-7 h-7 text-red-500" />
          Configurações
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Gerencie o seu perfil e a sua assinatura WebGran SaaS.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("perfil")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === "perfil"
              ? "border-red-500 text-white bg-red-500/10 rounded-t-xl font-semibold"
              : "border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.02]"
          }`}
        >
          <User className="w-4 h-4" />
          Perfil do Vendedor
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("assinatura")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === "assinatura"
              ? "border-red-500 text-white bg-red-500/10 rounded-t-xl font-semibold"
              : "border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.02]"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Assinatura WebGran
        </button>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tab 1: Perfil do Vendedor */}
      {activeTab === "perfil" && (
        <form onSubmit={handleSaveProfile} className="bg-[#121214] border border-white/5 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="border-b border-white/5 pb-4">
            <h3 className="text-base font-bold text-white">Perfil do vendedor</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Gerencie as informações da sua conta.</p>
          </div>

          {/* Avatar Section */}
          <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-white/5">
            <div className="relative group shrink-0">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 bg-[#16161C] flex items-center justify-center shadow-lg">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Foto do Vendedor" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-white uppercase">{firstLetter}</span>
                )}
              </div>

              <label 
                htmlFor="avatar-upload" 
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer text-white text-[11px] font-semibold gap-1"
                title="Alterar foto"
              >
                <Camera className="w-5 h-5 text-white" />
                <span>Alterar</span>
              </label>

              <input 
                id="avatar-upload" 
                type="file" 
                accept="image/jpeg,image/png,image/webp" 
                onChange={handleAvatarChange} 
                className="hidden" 
              />
            </div>

            <div className="space-y-2 text-center sm:text-left min-w-0">
              <h4 className="text-sm font-bold text-white">Foto de perfil</h4>
              <p className="text-xs text-zinc-400">
                Formatos aceitos: JPG, PNG ou WEBP. Tamanho máximo: 10MB.
              </p>
              <div className="flex items-center gap-3 pt-1 justify-center sm:justify-start">
                <label
                  htmlFor="avatar-upload"
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold cursor-pointer transition-all border border-white/10"
                >
                  Alterar foto
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-all border border-red-500/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Nome do vendedor
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo ou apelido"
                className="w-full bg-[#18181C] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 transition-all placeholder:text-zinc-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                E-mail da conta
              </label>
              <input
                type="email"
                value={sellerProfile.email}
                disabled
                className="w-full bg-[#141418] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-zinc-400 cursor-not-allowed select-none"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                O e-mail é utilizado para login no sistema e não pode ser alterado diretamente.
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="pt-4 border-t border-white/5 flex items-center justify-end">
            <Button
              type="submit"
              disabled={savingProfile}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-red-600/20 cursor-pointer"
            >
              {savingProfile ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar alterações</span>
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Tab 2: Assinatura WebGran */}
      {activeTab === "assinatura" && (
        <div className="space-y-6">
          {/* Main Plan Subscription Card */}
          <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-white tracking-tight">Assinatura WebGran</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    isExempt || subStatus === "EXEMPT"
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                      : "bg-red-500/10 border border-red-500/20 text-red-400"
                  }`}>
                    {isExempt || subStatus === "EXEMPT" ? "PROPRIETÁRIO DA PLATAFORMA" : "PLANO ÚNICO"}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Gerencie sua assinatura e acompanhe seus dados no WebGran SaaS.
                </p>
              </div>

              {/* Status Badge */}
              <div>
                {(isExempt || subStatus === "EXEMPT") ? (
                  <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    ISENTO
                  </span>
                ) : (
                  <>
                    {subStatus === "ACTIVE" && (
                      <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Assinatura ativa
                      </span>
                    )}
                    {subStatus === "PENDING" && (
                      <span className="px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        Pagamento pendente
                      </span>
                    )}
                    {subStatus === "PAST_DUE" && (
                      <span className="px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-400" />
                        Pagamento atrasado
                      </span>
                    )}
                    {subStatus === "CANCELLED" && (
                      <span className="px-3.5 py-1.5 rounded-full bg-zinc-800 border border-white/10 text-zinc-400 text-xs font-bold">
                        Cancelada
                      </span>
                    )}
                    {subStatus === "EXPIRED" && (
                      <span className="px-3.5 py-1.5 rounded-full bg-zinc-800 border border-white/10 text-zinc-400 text-xs font-bold">
                        Expirada
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Plan Display Grid */}
            {(isExempt || subStatus === "EXEMPT") ? (
              <div className="p-6 rounded-2xl bg-[#18181C] border border-emerald-500/20 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider font-bold">
                      Plano Especial
                    </span>
                    <h4 className="text-2xl font-black text-white mt-1">Proprietário da Plataforma</h4>
                    <p className="text-xs text-zinc-400 mt-1">
                      Esta conta pertence ao proprietário do WebGran e possui acesso gratuito à plataforma.
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-3xl font-black text-emerald-400">R$ 0,00</span>
                    <span className="text-xs text-zinc-400 block font-medium">/ mês • ISENTO</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-zinc-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Acesso ilimitado e vitalício ao painel do vendedor sem nenhuma cobrança.</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                {/* Plan Price Box */}
                <div className="bg-[#18181C] p-5 rounded-2xl border border-white/5 flex flex-col justify-between space-y-3">
                  <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Plano Ativo</span>
                  <div>
                    <p className="text-xl font-bold text-white uppercase">WebGran</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-extrabold text-white">R$ {planPrice.toFixed(2).replace(".", ",")}</span>
                      <span className="text-xs text-zinc-400 font-medium">/ mês</span>
                    </div>
                  </div>
                  <div className="pt-2 text-xs text-zinc-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-red-500" />
                    <span>Acesso completo ao SaaS</span>
                  </div>
                </div>

                {/* Billing Period Box */}
                <div className="bg-[#18181C] p-5 rounded-2xl border border-white/5 flex flex-col justify-between space-y-3">
                  <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Próxima Cobrança</span>
                  <div>
                    <div className="flex items-center gap-2 text-white font-bold text-lg">
                      <Calendar className="w-5 h-5 text-red-500 shrink-0" />
                      <span>{formatDate(subscriptionData.subscription.currentPeriodEnd)}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">Periodicidade: Mensal</p>
                  </div>
                  <div className="pt-2 text-xs text-zinc-400">
                    <span>Renovação via PIX automático</span>
                  </div>
                </div>

                {/* Payment Method & Action Box */}
                <div className="bg-[#18181C] p-5 rounded-2xl border border-white/5 flex flex-col justify-between space-y-3">
                  <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Forma de Pagamento</span>
                  <div>
                    <div className="flex items-center gap-2 text-white font-bold text-base">
                      <QrCode className="w-5 h-5 text-red-500 shrink-0" />
                      <span>PIX via Cora</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">Confirmação automática no sistema</p>
                  </div>

                  <div className="pt-2">
                    <Button
                      onClick={() => handleGeneratePixPayment(false)}
                      disabled={generatingPix}
                      className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl text-xs gap-2 shadow-lg shadow-red-600/20 cursor-pointer"
                    >
                      {generatingPix ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Gerando PIX...</span>
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4" />
                          <span>Pagar R$ {planPrice.toFixed(2).replace(".", ",")}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Active PIX Payment Drawer / Modal Display */}
            {activeInvoice && (
              (activeInvoice.status === 'EXPIRED' || (timeLeftSeconds !== null && timeLeftSeconds <= 0)) ? (
                /* EXPIRED PIX DISPLAY */
                <div className="bg-[#16161C] border border-amber-500/30 rounded-2xl p-6 space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Pagamento Expirado</h4>
                      <p className="text-xs text-zinc-400">Este PIX não está mais disponível.</p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => handleGeneratePixPayment(true)}
                    disabled={generatingPix}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-xs gap-2 shadow-lg shadow-red-600/20 cursor-pointer"
                  >
                    {generatingPix ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Gerando novo PIX...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>GERAR NOVO PIX</span>
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                /* ACTIVE PENDING PIX DISPLAY */
                <div className="bg-[#16161C] border border-red-500/30 rounded-2xl p-6 space-y-5 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                        <QrCode className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Pagamento PIX da Assinatura</h4>
                        <p className="text-xs text-zinc-400">Valor exato: <strong className="text-white">R$ {planPrice.toFixed(2).replace(".", ",")}</strong></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {timeLeftSeconds !== null && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Expira em: {formatCountdown(timeLeftSeconds)}</span>
                        </span>
                      )}
                      <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
                        Aguardando Pagamento
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    {/* QR Code Display */}
                    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-inner border border-white/10">
                      {activeInvoice.qrCode ? (
                        <img src={activeInvoice.qrCode} alt="QR Code PIX Cora" className="w-48 h-48 object-contain" />
                      ) : (
                        <div className="w-48 h-48 flex items-center justify-center text-zinc-600 text-xs font-semibold">
                          Gerando QR Code...
                        </div>
                      )}
                      <span className="text-[11px] text-zinc-600 font-semibold mt-2">Escaneie o QR Code no app do seu banco</span>
                    </div>

                    {/* PIX Copia e Cola & Verification */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                          PIX Copia e Cola (EMV Cora)
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
                            className="bg-white/10 hover:bg-white/20 text-white text-xs px-4 rounded-xl shrink-0 cursor-pointer"
                          >
                            {copiedPix ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            <span>{copiedPix ? "Copiado!" : "Copiar"}</span>
                          </Button>
                        </div>
                      </div>

                      <div className="pt-2 space-y-2">
                        <Button
                          type="button"
                          onClick={handleVerifyPayment}
                          disabled={verifyingPayment}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                        >
                          {verifyingPayment ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Consultando Banco Cora...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Já paguei</span>
                            </>
                          )}
                        </Button>
                        <p className="text-[10px] text-zinc-500 text-center">
                          O status do pagamento é verificado em tempo real diretamente na API da Cora.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Invoice Payment History Table */}
          <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Histórico de pagamentos</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Histórico completo de mensalidades registradas para a sua conta.
              </p>
            </div>

            <div className="overflow-x-auto border border-white/5 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 bg-[#18181C]">
                    <th className="py-3.5 px-4">Data</th>
                    <th className="py-3.5 px-4">Valor</th>
                    <th className="py-3.5 px-4">Forma</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Identificador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {subscriptionData.invoiceHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-zinc-500">
                        Nenhum histórico de mensalidade registrado ainda.
                      </td>
                    </tr>
                  ) : (
                    subscriptionData.invoiceHistory.map((inv) => (
                      <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 text-zinc-300">
                          {formatDate(inv.createdAt)}
                        </td>

                        <td className="py-3.5 px-4 font-bold text-white">
                          R$ {inv.amount.toFixed(2).replace(".", ",")}
                        </td>

                        <td className="py-3.5 px-4 text-zinc-400 font-medium">
                          PIX
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {inv.status === "PAID" && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold">
                              Pago
                            </span>
                          )}
                          {inv.status === "PENDING" && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold">
                              Pendente
                            </span>
                          )}
                          {inv.status === "EXPIRED" && (
                            <span className="px-2.5 py-1 rounded-full bg-zinc-800 border border-white/10 text-zinc-400 text-[11px] font-bold">
                              Expirado
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-zinc-500 text-[11px]">
                          {inv.externalId || inv.id.slice(0, 10)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
