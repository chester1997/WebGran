"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  CreditCard, 
  Palette, 
  ShieldCheck, 
  Zap, 
  ArrowRight, 
  Lock, 
  Edit3, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  X,
  Key,
  Trash2,
  Check,
  ExternalLink,
  DollarSign
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
  const [tokenForm, setTokenForm] = useState({
    accessToken: "",
    email: ""
  });
  const [savingToken, setSavingToken] = useState(false);
  const [disconnectingMp, setDisconnectingMp] = useState(false);
  const [testingMp, setTestingMp] = useState(false);
  const [mpMessage, setMpMessage] = useState<string | null>(null);

  const activePlan = plans.find(p => p.slug === "webgran") || plans[0] || {
    id: "webgran",
    name: "WebGran",
    slug: "webgran",
    price: "89.90",
    description: "Plano Único WebGran SaaS",
    billingInterval: "month",
    active: true
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

  // Open Add Plan Modal
  const openAddPlan = () => {
    setEditingPlan(null);
    setPlanForm({
      id: "",
      name: "",
      price: "89.90",
      description: "",
      billingInterval: "month"
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
      alert("✅ Plano salvo com sucesso! O valor de R$ 89,90 será refletido no painel dos vendedores.");
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
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
        alert(data.error || "Erro ao iniciar conexão OAuth");
      }
    } catch (err: any) {
      alert(`Erro de conexão: ${err.message}`);
    }
  };

  // Save Access Token Direct
  const handleSaveTokenDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingToken(true);
    setMpMessage(null);

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
      alert("✅ Mercado Pago conectado com sucesso para recebimento das assinaturas!");
    } catch (err: any) {
      setMpMessage(err.message);
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
        alert("✅ Conexão Mercado Pago ativa e operacional!");
      } else {
        setMp({
          isConnected: false,
          status: "DISCONNECTED",
          mpUserId: null,
          mpUserEmail: null,
          connectedAt: null,
          updatedAt: null
        });
        alert("❌ Mercado Pago desconectado.");
      }
    } catch (err: any) {
      alert(`Erro ao testar conexão: ${err.message}`);
    } finally {
      setTestingMp(false);
    }
  };

  // Disconnect Mercado Pago
  const handleDisconnectMp = async () => {
    if (!confirm("Tem certeza de que deseja desconectar sua conta Mercado Pago? As cobranças de assinatura ficarão temporariamente indisponíveis.")) {
      return;
    }

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

      alert("Mercado Pago desconectado.");
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setDisconnectingMp(false);
    }
  };

  return (
    <div className="space-y-8 fade-in">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272A] pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <Lock className="w-7 h-7 text-red-500" />
            Configurações da Plataforma
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Gerencie planos de assinatura SaaS, recebimento do proprietário no Mercado Pago e segurança global.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/subscriptions"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs font-bold transition-all shadow-md"
          >
            <DollarSign className="w-4 h-4" />
            Ver Dashboard de Assinaturas
          </Link>

          <div className="px-3.5 py-2 rounded-xl bg-[#141416] border border-[#27272A] flex items-center gap-2 text-xs text-gray-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Perfil: <strong className="text-white">SUPER_ADMIN</strong></span>
          </div>
        </div>
      </div>

      {/* SETTINGS CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* CARD 1: ASSINATURA WEBGRAN SAAS */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Plano de Assinatura SaaS</h3>
                  <p className="text-xs text-gray-400">Cobrança única de R$ 89,90 / mês para os vendedores</p>
                </div>
              </div>

              <button
                onClick={() => openEditPlan(activePlan)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar Plano
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">Nome do Plano</span>
                <span className="text-sm font-bold text-white">{activePlan.name}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                <span className="text-xs text-gray-400 font-medium">Preço Atual</span>
                <span className="text-lg font-black text-emerald-400">
                  R$ {Number(activePlan.price).toFixed(2)} / mês
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                <span className="text-xs text-gray-400 font-medium">Forma de Pagamento</span>
                <span className="text-xs font-semibold text-gray-300">PIX via Mercado Pago</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-gray-400 italic">
              ⚡ O valor de R$ 89,90 é cobrado mensalmente via PIX.
            </span>
          </div>
        </div>

        {/* CARD 2: TEMA PADRÃO DO SISTEMA */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Tema Padrão do Sistema</h3>
                <p className="text-xs text-gray-400">Layout automático atribuído às novas lojas criadas</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">Tema Ativo</span>
                <span className="text-sm font-bold text-purple-400">{defaultTheme?.name || "Studio"}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                <span className="text-xs text-gray-400 font-medium">Identificador</span>
                <span className="text-xs font-mono text-gray-300">slug: {defaultTheme?.slug || "studio"}</span>
              </div>
            </div>
          </div>

          <Link
            href="/admin/themes"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-xs font-bold text-purple-400 hover:text-purple-300 transition-all"
          >
            Gerenciar Temas na aba Temas
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* CARD 3: MERCADO PAGO - ASSINATURAS WEBGRAN (CONTA DO PROPRIETÁRIO) */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Mercado Pago</h3>
                  <p className="text-xs text-gray-400">Receba as assinaturas WebGran na sua conta Mercado Pago</p>
                </div>
              </div>

              {mp.isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Conectado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Não conectado
                </span>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Status</span>
                <span className={`text-xs font-bold ${mp.isConnected ? "text-emerald-400" : "text-amber-400"}`}>
                  {mp.isConnected ? "Ativo" : "Não conectado"}
                </span>
              </div>

              {mp.isConnected && (
                <>
                  <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                    <span className="text-xs text-gray-400">Conta Mercado Pago</span>
                    <span className="text-xs font-mono text-white font-bold truncate max-w-[200px]">
                      {mp.mpUserEmail || mp.mpUserId || "Proprietário WebGran"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                    <span className="text-xs text-gray-400">Conectado em</span>
                    <span className="text-xs font-mono text-gray-300">
                      {mp.connectedAt 
                        ? new Date(mp.connectedAt).toLocaleDateString("pt-BR")
                        : "Ativo"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {!mp.isConnected ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleOAuthConnect}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md shadow-sky-900/30 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  Conectar Mercado Pago (OAuth)
                </button>

                <button
                  onClick={() => setIsTokenModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-gray-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5 text-sky-400" />
                  Inserir Access Token Direto
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestConnection}
                    disabled={testingMp}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 text-sky-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    {testingMp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Testar Conexão
                  </button>

                  <button
                    onClick={handleDisconnectMp}
                    disabled={disconnectingMp}
                    className="px-3.5 py-2 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-bold transition-all cursor-pointer"
                    title="Desconectar Mercado Pago"
                  >
                    {disconnectingMp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-[#27272A]">
                  <button
                    onClick={handleOAuthConnect}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-sky-400 text-xs font-bold transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Reconectar OAuth
                  </button>
                  <button
                    onClick={() => setIsTokenModalOpen(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-gray-300 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5 text-sky-400" />
                    Alterar Token
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CARD 4: PERFIL ADMINISTRATIVO SUPREMO */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Segurança e Perfil Admin</h3>
                <p className="text-xs text-gray-400">Credenciais de acesso ao painel de controle supremo</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Administrador</span>
                <span className="text-xs font-bold text-white">{user.name || "Administrador Supremo"}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                <span className="text-xs text-gray-400">E-mail</span>
                <span className="text-xs font-mono text-gray-300">{user.email}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                <span className="text-xs text-gray-400">Perfil</span>
                <span className="text-xs font-bold text-red-400 uppercase">SUPER_ADMIN</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-gray-400 bg-[#18181B]/50 p-3 rounded-xl border border-[#27272A] flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <span>Apenas contas com papel super_admin podem modificar configurações globais.</span>
          </div>
        </div>

      </div>

      {/* MODAL 1: EDITAR PLANO DE ASSINATURA */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#27272A] rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
              <h3 className="text-lg font-bold text-white">
                {editingPlan ? "Editar Plano de Assinatura" : "Novo Plano de Assinatura"}
              </h3>
              <button onClick={() => setIsPlanModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Nome do Plano</label>
                <input
                  type="text"
                  required
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Preço Mensal (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={planForm.price}
                  onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Descrição</label>
                <textarea
                  rows={3}
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#27272A]">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white bg-[#18181B]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 flex items-center gap-2"
                >
                  {savingPlan ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Salvar Plano
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIGURAR ACCESS TOKEN MERCADO PAGO DIRETO */}
      {isTokenModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#27272A] rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-sky-400" />
                Configurar Mercado Pago (Proprietário)
              </h3>
              <button onClick={() => setIsTokenModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {mpMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
                ⚠️ {mpMessage}
              </div>
            )}

            <form onSubmit={handleSaveTokenDirect} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Access Token da sua Conta Mercado Pago
                </label>
                <input
                  type="password"
                  required
                  placeholder="APP_USR-..."
                  value={tokenForm.accessToken}
                  onChange={(e) => setTokenForm({ ...tokenForm, accessToken: e.target.value })}
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Obtenha em Mercado Pago Developers -&gt; Suas Aplicações -&gt; Credenciais de Produção.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  E-mail da Conta Recebedora (Opcional)
                </label>
                <input
                  type="email"
                  placeholder="proprietario@webgran.online"
                  value={tokenForm.email}
                  onChange={(e) => setTokenForm({ ...tokenForm, email: e.target.value })}
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#27272A]">
                <button
                  type="button"
                  onClick={() => setIsTokenModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white bg-[#18181B]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingToken}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 flex items-center gap-2"
                >
                  {savingToken ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Validar e Salvar Conexão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
