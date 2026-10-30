"use client";

import { useState } from "react";
import Link from "next/link";
import { formatBusinessDate } from "@/lib/analytics/timezone-utils";
import {
  CreditCard,
  Palette,
  ShieldCheck,
  Zap,
  ArrowRight,
  Lock,
  Edit3,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  Key,
  Trash2,
  Check,
  ExternalLink,
  DollarSign,
  AlertCircle,
  HelpCircle,
  Server
} from "lucide-react";

interface PlanItem {
  id: string;
  name: string;
  slug: string;
  price: string;
  description: string | null;
  billingInterval: string;
  active: boolean;
}

interface MercadoPagoStatus {
  isConnected: boolean;
  status: string;
  mpUserId: string | null;
  mpUserEmail: string | null;
  connectedAt: string | null;
  updatedAt: string | null;
}

interface AdminSettingsClientProps {
  user: {
    name?: string | null;
    email?: string | null;
  };
  initialPlans: PlanItem[];
  defaultTheme: {
    name: string;
    slug: string;
  } | null;
  initialMercadoPago: MercadoPagoStatus;
}

export default function AdminSettingsClient({
  user,
  initialPlans,
  defaultTheme,
  initialMercadoPago
}: AdminSettingsClientProps) {
  // Plan Modal State
  const [plans, setPlans] = useState<PlanItem[]>(initialPlans);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);
  const [planForm, setPlanForm] = useState({
    id: "",
    name: "WebGran",
    price: "89.90",
    description: "Plano Único WebGran SaaS",
    billingInterval: "month"
  });
  const [savingPlan, setSavingPlan] = useState(false);

  // Mercado Pago State
  const [mp, setMp] = useState<MercadoPagoStatus>(initialMercadoPago);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [isDisconnectConfirmOpen, setIsDisconnectConfirmOpen] = useState(false);
  const [tokenForm, setTokenForm] = useState({
    accessToken: "",
    email: ""
  });
  const [savingToken, setSavingToken] = useState(false);
  const [disconnectingMp, setDisconnectingMp] = useState(false);
  const [testingMp, setTestingMp] = useState(false);

  // Feedback Messages
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const activePlan = plans.find(p => p.slug === "webgran") || plans[0] || {
    id: "webgran",
    name: "WebGran",
    slug: "webgran",
    price: "89.90",
    description: "Plano Único WebGran SaaS",
    billingInterval: "month",
    active: true
  };

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 6000);
  };

  // Open Edit Plan Modal
  const openEditPlan = (plan: PlanItem) => {
    setEditingPlan(plan);
    setPlanForm({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      description: plan.description || "",
      billingInterval: plan.billingInterval || "month"
    });
    setIsPlanModalOpen(true);
  };

  // Save Subscription Plan
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPlan(true);

    try {
      const res = await fetch("/api/admin/subscription-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planForm)
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao salvar plano");

      const listRes = await fetch("/api/admin/subscription-plans");
      const listJson = await listRes.json();
      if (listJson.plans) setPlans(listJson.plans);

      setIsPlanModalOpen(false);
      showNotification("success", `Plano salvo com sucesso! O valor de R$ ${Number(planForm.price).toFixed(2).replace('.', ',')} será refletido no painel dos vendedores.`);
    } catch (err: any) {
      showNotification("error", `Erro ao salvar plano: ${err.message}`);
    } finally {
      setSavingPlan(false);
    }
  };

  // OAuth Connect Trigger
  const handleOAuthConnect = async () => {
    try {
      const res = await fetch("/api/admin/payments/mercadopago/connect");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        showNotification("error", data.error || "Erro ao iniciar conexão OAuth com Mercado Pago");
      }
    } catch (err: any) {
      showNotification("error", `Erro de conexão: ${err.message}`);
    }
  };

  // Save Access Token Direct
  const handleSaveTokenDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingToken(true);

    try {
      const res = await fetch("/api/admin/payments/mercadopago/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenForm)
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao conectar token");

      setMp({
        isConnected: true,
        status: "CONNECTED",
        mpUserId: json.mpUserId || "CONECTADO",
        mpUserEmail: tokenForm.email || "Proprietário WebGran",
        connectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      setIsTokenModalOpen(false);
      setTokenForm({ accessToken: "", email: "" });
      showNotification("success", "Mercado Pago conectado com sucesso para recebimento das assinaturas!");
    } catch (err: any) {
      showNotification("error", err.message || "Erro ao salvar credenciais do Mercado Pago");
    } finally {
      setSavingToken(false);
    }
  };

  // Test Connection
  const handleTestConnection = async () => {
    setTestingMp(true);
    try {
      const res = await fetch("/api/admin/payments/mercadopago/status");
      const data = await res.json();
      if (data.isConnected) {
        setMp({
          isConnected: true,
          status: "CONNECTED",
          mpUserId: data.mpUserId,
          mpUserEmail: data.mpUserEmail,
          connectedAt: data.connectedAt,
          updatedAt: data.updatedAt
        });
        showNotification("success", "Conexão Mercado Pago ativa e operacional!");
      } else {
        setMp({
          isConnected: false,
          status: "DISCONNECTED",
          mpUserId: null,
          mpUserEmail: null,
          connectedAt: null,
          updatedAt: null
        });
        showNotification("error", "Mercado Pago desconectado ou credenciais inválidas.");
      }
    } catch (err: any) {
      showNotification("error", `Erro ao testar conexão: ${err.message}`);
    } finally {
      setTestingMp(false);
    }
  };

  // Disconnect Mercado Pago
  const handleDisconnectMp = async () => {
    setDisconnectingMp(true);
    try {
      const res = await fetch("/api/admin/payments/mercadopago/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Falha ao desconectar");

      setMp({
        isConnected: false,
        status: "DISCONNECTED",
        mpUserId: null,
        mpUserEmail: null,
        connectedAt: null,
        updatedAt: null
      });

      setIsDisconnectConfirmOpen(false);
      showNotification("success", "Mercado Pago desconectado com sucesso.");
    } catch (err: any) {
      showNotification("error", `Erro ao desconectar: ${err.message}`);
    } finally {
      setDisconnectingMp(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 text-zinc-100 fade-in max-w-6xl">
      {/* ==================================================== */}
      {/* 1. HEADER (Integrado ao fundo, sem caixa card) */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              Configurações da Plataforma
            </h1>
            <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Plataforma WebGran
            </span>
          </div>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">
            Gerencie planos de assinatura SaaS, recebimento da plataforma e credenciais de segurança global
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/admin/subscriptions"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.08] text-zinc-300 hover:text-white text-xs font-semibold transition-colors shadow-xs"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ver Cobranças de Assinatura</span>
          </Link>

          <div className="px-2.5 py-1 rounded-xl bg-[#0F1014] border border-white/[0.08] flex items-center gap-2 text-xs text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[11px] font-mono">SUPER_ADMIN</span>
          </div>
        </div>
      </div>

      {/* Notifications Banner */}
      {notification && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between gap-3 ${
            notification.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 hover:opacity-80"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. SECTION 1: ASSINATURA & TEMAS */}
      {/* ==================================================== */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Assinatura SaaS e Layout Global
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* CARD 1: ASSINATURA WEBGRAN SAAS */}
          <div className="bg-[#0F1014] p-5 rounded-2xl border border-white/[0.08] shadow-xl space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Plano de Assinatura SaaS</h3>
                    <p className="text-[11px] text-zinc-400">Cobrança padrão para lojistas na plataforma</p>
                  </div>
                </div>

                <button
                  onClick={() => openEditPlan(activePlan)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.08] text-xs font-semibold text-zinc-200 hover:text-white transition-all cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Editar</span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-[#15171D] border border-white/[0.06] space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Nome do Plano</span>
                  <span className="font-bold text-white">{activePlan.name}</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
                  <span className="text-zinc-400">Preço Mensal</span>
                  <span className="font-black text-emerald-400 text-sm font-mono">
                    R$ {Number(activePlan.price).toFixed(2).replace('.', ',')} / mês
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
                  <span className="text-zinc-400">Forma de Pagamento</span>
                  <span className="font-semibold text-emerald-400">PIX via SyncPay Plataforma</span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-zinc-500 italic pt-1">
              ⚡ O valor mensal de R$ {Number(activePlan.price || 0).toFixed(2).replace('.', ',')} é gerado via PIX para manter a conta ativa.
            </div>
          </div>

          {/* CARD 2: TEMA PADRÃO DO SISTEMA */}
          <div className="bg-[#0F1014] p-5 rounded-2xl border border-white/[0.08] shadow-xl space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/[0.08] text-zinc-300">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Tema Padrão do Sistema</h3>
                  <p className="text-[11px] text-zinc-400">Layout automático atribuído às novas lojas criadas</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#15171D] border border-white/[0.06] space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Tema Ativo</span>
                  <span className="font-bold text-white">{defaultTheme?.name || "Studio"}</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
                  <span className="text-zinc-400">Identificador</span>
                  <span className="font-mono text-zinc-300 text-[11px]">slug: {defaultTheme?.slug || "studio"}</span>
                </div>
              </div>
            </div>

            <Link
              href="/admin/themes"
              className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.08] text-xs font-semibold text-zinc-200 hover:text-white transition-all cursor-pointer"
            >
              <span>Gerenciar catálogo na aba Temas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 3. SECTION 2: GATEWAYS & RECEBIMENTOS */}
      {/* ==================================================== */}
      <div className="space-y-3 pt-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Gateways e Recebimento de Assinaturas
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* CARD 3: SYNCPAY PLATAFORMA */}
          <div className="bg-[#0F1014] p-5 rounded-2xl border border-white/[0.08] shadow-xl space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">SyncPay Plataforma</h3>
                    <p className="text-[11px] text-zinc-400">Recebimento oficial das mensalidades WebGran</p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Conectado
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#15171D] border border-white/[0.06] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Status da Integração</span>
                  <span className="font-semibold text-emerald-400">Ativo & Operacional</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
                  <span className="text-zinc-400">Endpoint Webhook</span>
                  <span className="font-mono text-emerald-400 font-bold text-[10px] truncate max-w-[220px]">
                    /api/webhooks/syncpay/platform-billing
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-zinc-500">
              💡 Os lojistas operam com suas próprias credenciais isoladas de gateway.
            </div>
          </div>

          {/* CARD 4: MERCADO PAGO PLATAFORMA (FALLBACK) */}
          <div className="bg-[#0F1014] p-5 rounded-2xl border border-white/[0.08] shadow-xl space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Mercado Pago Plataforma</h3>
                    <p className="text-[11px] text-zinc-400">Gateway secundário / contingência para assinaturas</p>
                  </div>
                </div>

                {mp.isConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Conectado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Não conectado
                  </span>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-[#15171D] border border-white/[0.06] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Status Fallback</span>
                  <span className={`font-bold ${mp.isConnected ? "text-emerald-400" : "text-amber-400"}`}>
                    {mp.isConnected ? "Ativo" : "Não conectado"}
                  </span>
                </div>

                {mp.isConnected && (
                  <>
                    <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
                      <span className="text-zinc-400">Conta Mercado Pago</span>
                      <span className="font-mono text-white font-bold text-[11px] truncate max-w-[180px]">
                        {mp.mpUserEmail || mp.mpUserId || "Proprietário"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
                      <span className="text-zinc-400">Conectado em</span>
                      <span className="font-mono text-zinc-400 text-[11px]">
                        {mp.connectedAt ? formatBusinessDate(mp.connectedAt) : "Ativo"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {!mp.isConnected ? (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleOAuthConnect}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Conectar Mercado Pago (OAuth)</span>
                  </button>

                  <button
                    onClick={() => setIsTokenModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.08] text-zinc-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5 text-blue-400" />
                    <span>Inserir Access Token Direto</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTestConnection}
                      disabled={testingMp}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 text-xs font-semibold transition-all cursor-pointer"
                    >
                      {testingMp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>Testar Conexão</span>
                    </button>

                    <button
                      onClick={() => setIsDisconnectConfirmOpen(true)}
                      disabled={disconnectingMp}
                      className="p-1.5 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-all cursor-pointer"
                      title="Desconectar Mercado Pago"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06]">
                    <button
                      onClick={handleOAuthConnect}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.08] text-blue-400 text-xs font-semibold transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Reconectar OAuth</span>
                    </button>
                    <button
                      onClick={() => setIsTokenModalOpen(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.08] text-zinc-300 text-xs font-medium transition-all cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5 text-blue-400" />
                      <span>Alterar Token</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 4. SECTION 3: CREDENCIAIS & SEGURANÇA */}
      {/* ==================================================== */}
      <div className="space-y-3 pt-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Segurança e Controle de Acesso
        </h2>

        <div className="bg-[#0F1014] p-5 rounded-2xl border border-white/[0.08] shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Segurança e Perfil de Acesso</h3>
              <p className="text-[11px] text-zinc-400">Credenciais autorizadas para administração do ecossistema</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-[#15171D] border border-white/[0.06] text-xs">
              <span className="text-zinc-500 text-[10px] uppercase tracking-wider block">Administrador</span>
              <span className="font-bold text-white block mt-0.5 truncate">{user.name || "Administrador Supremo"}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#15171D] border border-white/[0.06] text-xs">
              <span className="text-zinc-500 text-[10px] uppercase tracking-wider block">E-mail Cadastrado</span>
              <span className="font-mono text-zinc-300 text-[11px] block mt-0.5 truncate">{user.email}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#15171D] border border-white/[0.06] text-xs">
              <span className="text-zinc-500 text-[10px] uppercase tracking-wider block">Papel de Permissão</span>
              <span className="font-semibold text-blue-400 text-xs block mt-0.5">SUPER_ADMIN</span>
            </div>
          </div>

          <div className="text-[11px] text-zinc-500 flex items-center gap-2 pt-1 border-t border-white/[0.06]">
            <Lock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span>Apenas contas autenticadas com nível super_admin possuem autorização para alterar configurações de rede.</span>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 5. MODALS */}
      {/* ==================================================== */}

      {/* MODAL: EDITAR PLANO DE ASSINATURA */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F1014] border border-white/[0.08] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <h3 className="text-sm font-bold text-white">
                {editingPlan ? "Editar Plano de Assinatura" : "Novo Plano de Assinatura"}
              </h3>
              <button onClick={() => setIsPlanModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Nome do Plano <span className="text-blue-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  className="w-full bg-[#15171D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Preço Mensal (R$) <span className="text-blue-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={planForm.price}
                  onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                  className="w-full bg-[#15171D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Descrição
                </label>
                <textarea
                  rows={3}
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  className="w-full bg-[#15171D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-white/5 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingPlan ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Salvar Plano</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TOKEN MERCADO PAGO */}
      {isTokenModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F1014] border border-white/[0.08] rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Configurar Mercado Pago (Proprietário)</h3>
              </div>
              <button onClick={() => setIsTokenModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTokenDirect} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Access Token da sua Conta Mercado Pago <span className="text-blue-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="APP_USR-..."
                  value={tokenForm.accessToken}
                  onChange={(e) => setTokenForm({ ...tokenForm, accessToken: e.target.value })}
                  className="w-full bg-[#15171D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Obtenha em Mercado Pago Developers -&gt; Suas Aplicações -&gt; Credenciais de Produção.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  E-mail da Conta Recebedora (Opcional)
                </label>
                <input
                  type="email"
                  placeholder="proprietario@webgran.online"
                  value={tokenForm.email}
                  onChange={(e) => setTokenForm({ ...tokenForm, email: e.target.value })}
                  className="w-full bg-[#15171D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsTokenModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-white/5 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingToken}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingToken ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Validar e Salvar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR DESCONEXÃO */}
      {isDisconnectConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F1014] border border-white/[0.08] rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Desconectar Mercado Pago?</h3>
            </div>
            <p className="text-xs text-zinc-400">
              Tem certeza de que deseja desconectar a conta do Mercado Pago? As cobranças de contingência de assinatura ficarão temporariamente indisponíveis.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setIsDisconnectConfirmOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-white/5 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDisconnectMp}
                disabled={disconnectingMp}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {disconnectingMp && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Desconectar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
