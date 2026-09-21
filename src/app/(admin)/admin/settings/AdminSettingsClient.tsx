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
  Upload,
  Trash2,
  Check
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

interface CoraCredentials {
  clientIdMasked: string;
  hasCert: boolean;
  hasKey: boolean;
  environment: string;
  lastVerifiedAt: string | null;
  isConnected: boolean;
  lastInvoice?: {
    id: string;
    status: string;
    amount: number;
    createdAt: string | null;
  } | null;
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
  initialCora: CoraCredentials;
}

export default function AdminSettingsClient({
  user,
  initialPlans,
  defaultTheme,
  initialCora
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

  // Cora Modal State
  const [cora, setCora] = useState<CoraCredentials>(initialCora);
  const [isCoraModalOpen, setIsCoraModalOpen] = useState(false);
  const [coraForm, setCoraForm] = useState({
    clientId: "",
    certPem: "",
    keyPem: "",
    environment: initialCora.environment || "production"
  });
  const [savingCora, setSavingCora] = useState(false);
  const [disconnectingCora, setDisconnectingCora] = useState(false);
  const [coraMessage, setCoraMessage] = useState<string | null>(null);

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

      // Reload plans
      const listRes = await fetch("/api/admin/subscription-plans");
      const listJson = await listRes.json();
      if (listJson.plans) setPlans(listJson.plans);

      setIsPlanModalOpen(false);
      alert("✅ Plano salvo com sucesso! O valor será refletido no painel dos vendedores.");
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingPlan(false);
    }
  };

  // Handle File Pickers for .pem and .key
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: "certPem" | "keyPem") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        setCoraForm((prev) => ({ ...prev, [field]: content }));
      }
    };
    reader.readAsText(file);
  };

  // Save & Test Cora Credentials
  const handleSaveCora = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCora(true);
    setCoraMessage(null);

    try {
      const res = await fetch("/api/admin/cora-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coraForm)
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao autenticar/salvar credenciais Cora.");

      setCoraMessage(json.message);
      const maskedId = coraForm.clientId.length > 4 
        ? `••••${coraForm.clientId.slice(-4)}` 
        : "••••";

      setCora({
        clientIdMasked: maskedId,
        hasCert: true,
        hasKey: true,
        environment: coraForm.environment,
        lastVerifiedAt: json.lastVerifiedAt || new Date().toISOString(),
        isConnected: true
      });

      setTimeout(() => {
        setIsCoraModalOpen(false);
        setCoraMessage(null);
      }, 2000);
    } catch (err: any) {
      setCoraMessage(`❌ ${err.message}`);
    } finally {
      setSavingCora(false);
    }
  };

  // Disconnect Cora
  const handleDisconnectCora = async () => {
    if (!confirm("Tem certeza que deseja desconectar a conta Cora Bank do WebGran?")) return;

    setDisconnectingCora(true);
    try {
      const res = await fetch("/api/admin/cora-credentials", {
        method: "DELETE"
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao desconectar Cora");

      setCora({
        clientIdMasked: "",
        hasCert: false,
        hasKey: false,
        environment: "production",
        lastVerifiedAt: null,
        isConnected: false
      });

      alert("✅ Conta Cora desconectada com sucesso.");
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setDisconnectingCora(false);
    }
  };

  const activePlan = plans[0] || { name: "WebGran", price: "89.90", description: "Plano Único WebGran SaaS" };

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Configurações Globais</h1>
            <span className="px-2.5 py-1 text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-full">
              SaaS Admin
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Gestão dinâmica de planos de assinatura, gateway Cora mTLS e tema do sistema
          </p>
        </div>
      </div>

      {/* SETTINGS CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* CARD 1: ASSINATURA WEBGRAN SAAS (EDITÁVEL) */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Plano de Assinatura SaaS</h3>
                  <p className="text-xs text-gray-400">Refletido dinamicamente no painel dos lojistas</p>
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
                <span className="text-xs text-gray-400 font-medium">Intervalo</span>
                <span className="text-xs font-semibold text-gray-300">Mensal (PIX Cora)</span>
              </div>
              {activePlan.description && (
                <div className="border-t border-[#27272A] pt-2 text-[11px] text-gray-400">
                  {activePlan.description}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-gray-400 italic">
              ⚡ Alterações refletem instantaneamente no `/seller/settings`.
            </span>

            <button
              onClick={openAddPlan}
              className="flex items-center gap-1 text-xs font-bold text-gray-300 hover:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Novo Plano
            </button>
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

        {/* CARD 3: INTEGRAÇÃO BANCO CORA (CONECTAR CONTA REAL) */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Integração Direta Banco Cora</h3>
                  <p className="text-xs text-gray-400">Autenticação mTLS via Certificado & Chave RSA</p>
                </div>
              </div>

              {cora.isConnected ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  Cora Conectada
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <XCircle className="w-3 h-3" />
                  Pendente
                </span>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Client ID Cora</span>
                <span className="text-xs font-mono text-white font-bold">
                  {cora.clientIdMasked || "Não configurado"}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                <span className="text-xs text-gray-400">Certificado Digital (.pem)</span>
                <span className="text-xs font-semibold text-gray-300 flex items-center gap-1">
                  {cora.hasCert ? (
                    <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Configurado</span>
                  ) : (
                    <span className="text-amber-400">Ausente</span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                <span className="text-xs text-gray-400">Chave Privada (.key)</span>
                <span className="text-xs font-semibold text-gray-300 flex items-center gap-1">
                  {cora.hasKey ? (
                    <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Configurada</span>
                  ) : (
                    <span className="text-amber-400">Ausente</span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                <span className="text-xs text-gray-400">Ambiente</span>
                <span className="text-xs font-bold text-sky-400 uppercase">
                  {cora.environment === "stage" ? "Staging / Testes" : "Produção (Conta Real)"}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                <span className="text-xs text-gray-400">Última Validação</span>
                <span className="text-xs font-mono text-gray-300">
                  {cora.lastVerifiedAt 
                    ? new Date(cora.lastVerifiedAt).toLocaleString("pt-BR")
                    : "Nunca"}
                </span>
              </div>
              {cora.lastInvoice && (
                <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                  <span className="text-xs text-gray-400">Última Invoice Cora</span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    {cora.lastInvoice.id.slice(0, 14)}... ({cora.lastInvoice.status})
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => setIsCoraModalOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-900/30 transition-all"
            >
              <Key className="w-3.5 h-3.5" />
              {cora.isConnected ? "Testar / Alterar Conexão" : "Conectar Conta Real Cora"}
            </button>

            {cora.isConnected && (
              <button
                onClick={handleDisconnectCora}
                disabled={disconnectingCora}
                className="px-3 py-2.5 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-bold transition-all"
                title="Desconectar Conta Cora"
              >
                {disconnectingCora ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
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

      {/* MODAL 1: EDITAR / ADICIONAR PLANO */}
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
                <label className="text-xs font-bold text-gray-300 block mb-1">Nome do Plano</label>
                <input
                  type="text"
                  required
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  placeholder="Ex: WebGran"
                  className="w-full px-3.5 py-2.5 bg-[#18181B] border border-[#27272A] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Preço Mensal (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={planForm.price}
                  onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                  placeholder="89.90"
                  className="w-full px-3.5 py-2.5 bg-[#18181B] border border-[#27272A] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  placeholder="Descrição do plano SaaS..."
                  className="w-full px-3.5 py-2.5 bg-[#18181B] border border-[#27272A] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-[#27272A] bg-[#18181B] hover:bg-[#27272A] text-gray-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-900/30 flex items-center justify-center gap-2"
                >
                  {savingPlan ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Salvar Plano"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONECTAR CONTA REAL CORA (mTLS INTEGRAÇÃO DIRETA) */}
      {isCoraModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141416] border border-[#27272A] rounded-2xl w-full max-w-xl p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">⚡ Conectar Conta Real Cora Bank</h3>
                  <p className="text-xs text-gray-400">Integração Direta via mTLS (Certificado + Chave RSA)</p>
                </div>
              </div>
              <button onClick={() => setIsCoraModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-sky-500/5 border border-sky-500/20 text-sky-300 text-xs leading-relaxed space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-sky-400" />
                Sem Client Secret • Autenticação de Alto Nível mTLS
              </p>
              <p className="text-[11px] text-gray-400">
                A Integração Direta Cora utiliza o Client ID + Certificado Digital (`.pem`) e Chave Privada (`.key`). 
                Os arquivos e chaves são armazenados com segurança no banco de dados e nunca são expostos ao navegador.
              </p>
            </div>

            <form onSubmit={handleSaveCora} className="space-y-4">
              {/* CLIENT ID */}
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Cora Client ID</label>
                <input
                  type="text"
                  required
                  value={coraForm.clientId}
                  onChange={(e) => setCoraForm({ ...coraForm, clientId: e.target.value })}
                  placeholder="Ex: client-id-123456789..."
                  className="w-full px-3.5 py-2.5 bg-[#18181B] border border-[#27272A] rounded-xl text-xs text-white placeholder-gray-500 font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* CERTIFICADO PEM */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-300">Certificado Digital (.pem)</label>
                  <label className="cursor-pointer text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1">
                    <Upload className="w-3 h-3" />
                    Carregar arquivo .pem
                    <input
                      type="file"
                      accept=".pem,.crt"
                      onChange={(e) => handleFileUpload(e, "certPem")}
                      className="hidden"
                    />
                  </label>
                </div>
                <textarea
                  rows={4}
                  required
                  value={coraForm.certPem}
                  onChange={(e) => setCoraForm({ ...coraForm, certPem: e.target.value })}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;Cole o conteúdo do seu certificado certificado.pem aqui ou carregue o arquivo acima&#10;-----END CERTIFICATE-----"
                  className="w-full px-3.5 py-2.5 bg-[#18181B] border border-[#27272A] rounded-xl text-[11px] text-white placeholder-gray-600 font-mono focus:outline-none focus:border-sky-500 leading-relaxed"
                />
              </div>

              {/* CHAVE PRIVADA KEY */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-300">Chave Privada RSA (.key)</label>
                  <label className="cursor-pointer text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1">
                    <Upload className="w-3 h-3" />
                    Carregar arquivo .key
                    <input
                      type="file"
                      accept=".key,.pem"
                      onChange={(e) => handleFileUpload(e, "keyPem")}
                      className="hidden"
                    />
                  </label>
                </div>
                <textarea
                  rows={4}
                  required
                  value={coraForm.keyPem}
                  onChange={(e) => setCoraForm({ ...coraForm, keyPem: e.target.value })}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;Cole o conteúdo da sua chave privada chave.key aqui ou carregue o arquivo acima&#10;-----END RSA PRIVATE KEY-----"
                  className="w-full px-3.5 py-2.5 bg-[#18181B] border border-[#27272A] rounded-xl text-[11px] text-white placeholder-gray-600 font-mono focus:outline-none focus:border-sky-500 leading-relaxed"
                />
              </div>

              {/* AMBIENTE */}
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Ambiente de Operação</label>
                <select
                  value={coraForm.environment}
                  onChange={(e) => setCoraForm({ ...coraForm, environment: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#18181B] border border-[#27272A] rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="production">Produção (Conta Real - https://matls-clients.api.cora.com.br)</option>
                  <option value="stage">Staging / Sandbox (https://matls-clients.stage.cora.com.br)</option>
                </select>
              </div>

              {coraMessage && (
                <div className={`p-3.5 rounded-xl border text-xs font-semibold leading-relaxed ${
                  coraMessage.includes("🟢")
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border-red-500/20 text-red-300"
                }`}>
                  {coraMessage}
                </div>
              )}

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsCoraModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-[#27272A] bg-[#18181B] hover:bg-[#27272A] text-gray-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCora}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-900/30 flex items-center justify-center gap-2"
                >
                  {savingCora ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Testando mTLS com Cora...</span>
                    </>
                  ) : (
                    "Salvar e Testar Conexão"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
