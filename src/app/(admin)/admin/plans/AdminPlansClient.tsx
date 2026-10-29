"use client";

import { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  Sliders,
  Layers,
  Info,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  Users,
  X
} from "lucide-react";

interface PlanItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  billingInterval: string;
  active: boolean;
  configuredFeaturesCount: number;
  activeSubscriptionsCount: number;
}

interface FeatureConfigItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  type: "BOOLEAN" | "LIMIT" | "QUOTA";
  category: string;
  defaultValue: any;
  isActive: boolean;
  isConfigured: boolean;
  configuredValue: any;
}

export default function AdminPlansClient({ user }: { user: any }) {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal Plan Edit/Create
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "features">("info");
  const [planForm, setPlanForm] = useState({
    name: "",
    slug: "",
    price: "",
    description: "",
    billingInterval: "month",
    active: true,
  });
  const [savingPlan, setSavingPlan] = useState(false);

  // Features list for Plan modal
  const [allCatalogFeatures, setAllCatalogFeatures] = useState<FeatureConfigItem[]>([]);
  const [featureFormValues, setFeatureFormValues] = useState<Record<string, any>>({});
  const [loadingModalFeatures, setLoadingModalFeatures] = useState(false);

  // Modal Configure Features (Standalone)
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
  const [selectedPlanForFeatures, setSelectedPlanForFeatures] = useState<PlanItem | null>(null);
  const [savingPlanFeatures, setSavingPlanFeatures] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/plans");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar planos WebGran");
      setPlans(data.plans || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFeaturesForPlan = async (planId?: string) => {
    setLoadingModalFeatures(true);
    try {
      if (planId) {
        const res = await fetch(`/api/admin/plans/${planId}/features`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.features)) {
          setAllCatalogFeatures(data.features);
          const initialVals: Record<string, any> = {};
          for (const f of data.features) {
            initialVals[f.id] = f.configuredValue;
          }
          setFeatureFormValues(initialVals);
          return;
        }
      }

      // Fallback or new plan: load generic feature catalog
      const resFeats = await fetch("/api/admin/features");
      const dataFeats = await resFeats.json();
      if (resFeats.ok && Array.isArray(dataFeats.features)) {
        const formatted = dataFeats.features.map((f: any) => ({
          ...f,
          configuredValue: f.defaultValue,
        }));
        setAllCatalogFeatures(formatted);
        const initialVals: Record<string, any> = {};
        for (const f of formatted) {
          initialVals[f.id] = f.defaultValue;
        }
        setFeatureFormValues(initialVals);
      }
    } catch (err) {
      console.error("Error loading catalog features:", err);
    } finally {
      setLoadingModalFeatures(false);
    }
  };

  const handleOpenCreatePlan = () => {
    setEditingPlan(null);
    setActiveTab("info");
    setPlanForm({
      name: "",
      slug: "",
      price: "",
      description: "",
      billingInterval: "month",
      active: true,
    });
    setIsPlanModalOpen(true);
    loadFeaturesForPlan();
  };

  const handleOpenEditPlan = (plan: PlanItem) => {
    setEditingPlan(plan);
    setActiveTab("info");
    setPlanForm({
      name: plan.name,
      slug: plan.slug,
      price: plan.price.toString(),
      description: plan.description || "",
      billingInterval: plan.billingInterval || "month",
      active: plan.active,
    });
    setIsPlanModalOpen(true);
    loadFeaturesForPlan(plan.id);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPlan(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const featureValuesArray = Object.entries(featureFormValues).map(([featureId, value]) => ({
        featureId,
        value,
      }));

      const payload = {
        id: editingPlan?.id,
        ...planForm,
        featureValues: featureValuesArray,
      };

      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar plano WebGran.");

      setSuccessMsg(editingPlan ? "Plano WebGran atualizado com sucesso!" : "Novo plano WebGran criado com sucesso!");
      setIsPlanModalOpen(false);
      fetchPlans();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleDeletePlan = async (plan: PlanItem) => {
    if (!confirm(`Deseja realmente excluir o plano "${plan.name}"?`)) return;

    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/admin/plans/${plan.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao excluir plano.");

      setSuccessMsg("Plano WebGran excluído com sucesso!");
      fetchPlans();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleOpenConfigureFeatures = async (plan: PlanItem) => {
    setSelectedPlanForFeatures(plan);
    setIsFeatureModalOpen(true);
    loadFeaturesForPlan(plan.id);
  };

  const handleSavePlanFeatures = async () => {
    if (!selectedPlanForFeatures) return;
    setSavingPlanFeatures(true);
    setError(null);

    try {
      const payload = {
        featureValues: Object.entries(featureFormValues).map(([featureId, value]) => ({
          featureId,
          value,
        })),
      };

      const res = await fetch(`/api/admin/plans/${selectedPlanForFeatures.id}/features`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar recursos do plano.");

      setSuccessMsg("Recursos do plano salvos com sucesso!");
      setIsFeatureModalOpen(false);
      fetchPlans();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPlanFeatures(false);
    }
  };

  // Group features by category
  const groupedFeatures = allCatalogFeatures.reduce((acc, feat) => {
    const cat = feat.category || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(feat);
    return acc;
  }, {} as Record<string, FeatureConfigItem[]>);

  const categoryLabels: Record<string, string> = {
    catalog: "Catálogo & Produtos",
    integrations: "Integrações & Telegram",
    media: "Mídia & Vídeos",
    marketing: "Marketing & Cupons",
    customization: "Personalização & Temas",
    payments: "Gateways de Pagamento",
    analytics: "Relatórios & Métricas",
    general: "Configurações Gerais",
  };

  // Compute live summary of included features for preview box
  const getIncludedFeaturesPreview = () => {
    const previewList: string[] = [];

    for (const feat of allCatalogFeatures) {
      const val = featureFormValues[feat.id];
      if (val === undefined || val === null || val === false) continue;

      if (feat.type === "BOOLEAN" && val === true) {
        previewList.push(feat.name);
      } else if (feat.type === "LIMIT") {
        if (val === -1) {
          previewList.push(`${feat.name}: Ilimitado`);
        } else if (typeof val === "number" && val > 0) {
          previewList.push(`${feat.name}: ${val}`);
        }
      } else if (feat.type === "QUOTA") {
        if (val === -1) {
          previewList.push(`${feat.name}: Ilimitado GB`);
        } else if (typeof val === "number" && val > 0) {
          previewList.push(`${feat.name}: ${val} GB`);
        }
      }
    }

    return previewList;
  };

  return (
    <div className="space-y-6 pb-12 text-zinc-100 fade-in">
      {/* ==================================================== */}
      {/* 1. HEADER (Integrado ao fundo, sem caixa card) */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              Planos WebGran
            </h1>
            <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Planos Comerciais
            </span>
          </div>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">
            Configure os pacotes comerciais da plataforma, limites, recursos inclusos e regras de contratação
          </p>
        </div>

        <button
          onClick={handleOpenCreatePlan}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-sm cursor-pointer h-9 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Plano WebGran</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. OVERVIEW CARDS */}
      {/* ==================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Total de Planos */}
        <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
              Total de Planos
            </span>
            <div className="p-2 rounded-xl border bg-white/5 border-white/[0.08] text-zinc-300 shrink-0">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-white tracking-tight block">
            {plans.length}
          </span>
          <span className="text-[10px] text-zinc-500 block truncate pt-0.5">
            Modelos cadastrados na plataforma
          </span>
        </div>

        {/* Planos Ativos */}
        <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
              Planos Ativos
            </span>
            <div className="p-2 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight block">
            {plans.filter((p) => p.active).length}
          </span>
          <span className="text-[10px] text-zinc-500 block truncate pt-0.5">
            Disponíveis para contratação
          </span>
        </div>

        {/* Vendedores em Planos */}
        <div className="p-4 rounded-2xl bg-[#14141B] border border-blue-500/30 shadow-lg shadow-blue-500/5 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
              Vendedores em Planos
            </span>
            <div className="p-2 rounded-xl border bg-blue-500/10 border-blue-500/20 text-blue-400 shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-white tracking-tight block">
            {plans.reduce((acc, curr) => acc + curr.activeSubscriptionsCount, 0)}
          </span>
          <span className="text-[10px] text-zinc-500 block truncate pt-0.5">
            Assinaturas ativas no total
          </span>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 3. PLANS TABLE */}
      {/* ==================================================== */}
      <div className="bg-[#111116] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Catálogo de Planos ({plans.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-zinc-400 flex items-center justify-center gap-3 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span>Carregando planos WebGran...</span>
          </div>
        ) : plans.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs">
            Nenhum plano WebGran cadastrado.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-white/[0.02] text-[11px] uppercase tracking-wider text-zinc-400 border-b border-white/[0.06]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Plano</th>
                  <th className="px-5 py-3 font-semibold">Preço</th>
                  <th className="px-5 py-3 font-semibold">Ciclo</th>
                  <th className="px-5 py-3 font-semibold">Recursos</th>
                  <th className="px-5 py-3 font-semibold">Assinantes</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-white text-xs">{plan.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">slug: {plan.slug}</div>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-emerald-400 font-mono">
                      R$ {plan.price.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-300">
                      {plan.billingInterval === "year" ? "Anual" : "Mensal"}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => handleOpenConfigureFeatures(plan)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer"
                        title="Clique para configurar recursos"
                      >
                        <Sliders className="w-3 h-3" />
                        <span>{plan.configuredFeaturesCount} configurados</span>
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-300 font-mono text-[11px]">
                      {plan.activeSubscriptionsCount} vendedor(es)
                    </td>
                    <td className="px-5 py-3.5">
                      {plan.active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                          <XCircle className="w-3 h-3" /> Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1.5">
                      <button
                        onClick={() => handleOpenConfigureFeatures(plan)}
                        className="p-1.5 rounded-lg bg-white/5 text-zinc-300 hover:text-white hover:bg-blue-600/20 transition cursor-pointer"
                        title="Configurar Recursos do Plano"
                      >
                        <Sliders className="w-3.5 h-3.5 text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleOpenEditPlan(plan)}
                        className="p-1.5 rounded-lg bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                        title="Editar Plano WebGran"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan)}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition cursor-pointer"
                        title="Excluir Plano"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 4. MODAL: CREATE / EDIT PLAN WEBGRAN */}
      {/* ==================================================== */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111116] border border-white/[0.08] w-full max-w-4xl rounded-2xl p-6 shadow-2xl space-y-5 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {editingPlan ? `Editar Plano: ${editingPlan.name}` : "Novo Plano WebGran"}
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Defina as informações comerciais e selecione os recursos do pacote
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPlanModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs Navigation */}
            <div className="flex border-b border-white/[0.08] gap-4 flex-shrink-0 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("info")}
                className={`pb-2.5 transition-all relative border-b-2 ${
                  activeTab === "info"
                    ? "border-blue-500 text-white"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                1. Informações do Plano
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("features")}
                className={`pb-2.5 transition-all relative border-b-2 flex items-center gap-2 ${
                  activeTab === "features"
                    ? "border-blue-500 text-white"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <span>2. Recursos do Pacote</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {Object.keys(featureFormValues).length} recursos
                </span>
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar text-xs">
              {/* TAB 1: INFORMAÇÕES DO PLANO */}
              {activeTab === "info" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                        Nome do Plano <span className="text-blue-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={planForm.name}
                        onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                        placeholder="Ex: Plano Pro, Plano Starter, Business"
                        className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                        Slug (Identificador URL) <span className="text-blue-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={planForm.slug}
                        onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                        placeholder="ex: plano-pro"
                        className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                        Preço Comercial (R$) <span className="text-blue-400">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={planForm.price}
                        onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                        className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                        Ciclo de Cobrança <span className="text-blue-400">*</span>
                      </label>
                      <select
                        value={planForm.billingInterval}
                        onChange={(e) => setPlanForm({ ...planForm, billingInterval: e.target.value })}
                        className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="month">Mensal</option>
                        <option value="year">Anual</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                      Descrição do Plano
                    </label>
                    <textarea
                      rows={3}
                      value={planForm.description}
                      onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                      placeholder="Descrição dos benefícios e diferenciais do plano..."
                      className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-2.5 pt-1">
                    <input
                      type="checkbox"
                      id="activePlanCheck"
                      checked={planForm.active}
                      onChange={(e) => setPlanForm({ ...planForm, active: e.target.checked })}
                      className="w-4 h-4 rounded border-white/[0.1] bg-[#16161D] text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="activePlanCheck" className="text-xs text-zinc-300 cursor-pointer select-none">
                      Plano ativo para novas contratações pelos vendedores
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 2: RECURSOS DO PLANO */}
              {activeTab === "features" && (
                <div className="space-y-5">
                  {loadingModalFeatures ? (
                    <div className="p-12 text-center text-zinc-400 flex items-center justify-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                      <span>Carregando recursos do catálogo...</span>
                    </div>
                  ) : Object.keys(groupedFeatures).length === 0 ? (
                    <div className="p-8 text-center text-zinc-500">
                      Nenhum recurso cadastrado no catálogo.
                    </div>
                  ) : (
                    Object.entries(groupedFeatures).map(([category, items]) => (
                      <div key={category} className="bg-[#141418] border border-white/[0.06] rounded-xl p-4 space-y-3">
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-blue-400 border-b border-white/[0.06] pb-2">
                          {categoryLabels[category] || category}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {items.map((feat) => {
                            const currentVal = featureFormValues[feat.id];

                            return (
                              <div key={feat.id} className="bg-[#16161D] border border-white/[0.06] p-3 rounded-xl space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-white">{feat.name}</span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/[0.06]">
                                    {feat.type}
                                  </span>
                                </div>
                                {feat.description && (
                                  <p className="text-[11px] text-zinc-400">{feat.description}</p>
                                )}

                                {feat.type === "BOOLEAN" && (
                                  <div className="pt-1">
                                    <select
                                      value={currentVal ? "true" : "false"}
                                      onChange={(e) => setFeatureFormValues({
                                        ...featureFormValues,
                                        [feat.id]: e.target.value === "true",
                                      })}
                                      className="w-full bg-[#111116] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                                    >
                                      <option value="true">Liberado (✓ Ativado)</option>
                                      <option value="false">Bloqueado (✕ Desativado)</option>
                                    </select>
                                  </div>
                                )}

                                {feat.type === "LIMIT" && (
                                  <div className="pt-1 space-y-1.5">
                                    <input
                                      type="number"
                                      disabled={currentVal === -1}
                                      value={currentVal === -1 ? "" : currentVal}
                                      onChange={(e) => setFeatureFormValues({
                                        ...featureFormValues,
                                        [feat.id]: parseInt(e.target.value) || 0,
                                      })}
                                      placeholder={currentVal === -1 ? "Ilimitado" : "0"}
                                      className="w-full bg-[#111116] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 font-mono"
                                    />
                                    <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={currentVal === -1}
                                        onChange={(e) => setFeatureFormValues({
                                          ...featureFormValues,
                                          [feat.id]: e.target.checked ? -1 : 100,
                                        })}
                                        className="rounded border-white/[0.1] bg-[#111116] text-blue-600 focus:ring-blue-500"
                                      />
                                      <span>Ilimitado (-1)</span>
                                    </label>
                                  </div>
                                )}

                                {feat.type === "QUOTA" && (
                                  <div className="pt-1 space-y-1.5">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        disabled={currentVal === -1}
                                        value={currentVal === -1 ? "" : currentVal}
                                        onChange={(e) => setFeatureFormValues({
                                          ...featureFormValues,
                                          [feat.id]: parseInt(e.target.value) || 0,
                                        })}
                                        placeholder={currentVal === -1 ? "Ilimitado" : "0"}
                                        className="flex-1 bg-[#111116] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 font-mono"
                                      />
                                      <span className="text-[11px] text-zinc-400 font-bold">GB</span>
                                    </div>
                                    <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={currentVal === -1}
                                        onChange={(e) => setFeatureFormValues({
                                          ...featureFormValues,
                                          [feat.id]: e.target.checked ? -1 : 50,
                                        })}
                                        className="rounded border-white/[0.1] bg-[#111116] text-blue-600 focus:ring-blue-500"
                                      />
                                      <span>Ilimitado (-1 GB)</span>
                                    </label>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* PREVISUALIZAÇÃO: RECURSOS INCLUÍDOS */}
              <div className="bg-[#141418] border border-blue-500/20 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-blue-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Recursos incluídos no plano (Pré-visualização)</span>
                </div>
                {getIncludedFeaturesPreview().length === 0 ? (
                  <p className="text-[11px] text-zinc-500">Nenhum recurso ativo selecionado.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {getIncludedFeaturesPreview().map((item, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[11px] text-zinc-200 bg-[#111116] p-2 rounded-lg border border-white/[0.06]">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate">{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08] flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingPlan && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Salvar Plano WebGran</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. MODAL: STANDALONE FEATURE CONFIGURATION */}
      {/* ==================================================== */}
      {isFeatureModalOpen && selectedPlanForFeatures && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111116] border border-white/[0.08] w-full max-w-3xl rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Recursos do Plano: <span className="text-blue-400">{selectedPlanForFeatures.name}</span>
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Defina os limites, permissões e quotas atreladas a este plano
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFeatureModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar text-xs">
              {loadingModalFeatures ? (
                <div className="p-12 text-center text-zinc-400 flex items-center justify-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Carregando recursos...</span>
                </div>
              ) : Object.keys(groupedFeatures).length === 0 ? (
                <div className="p-8 text-center text-zinc-500">
                  Nenhuma feature cadastrada no catálogo.
                </div>
              ) : (
                Object.entries(groupedFeatures).map(([category, items]) => (
                  <div key={category} className="bg-[#141418] border border-white/[0.06] rounded-xl p-4 space-y-3">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-blue-400 border-b border-white/[0.06] pb-2">
                      {categoryLabels[category] || category}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {items.map((feat) => {
                        const currentVal = featureFormValues[feat.id];

                        return (
                          <div key={feat.id} className="bg-[#16161D] border border-white/[0.06] p-3 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-white">{feat.name}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/[0.06]">
                                {feat.type}
                              </span>
                            </div>
                            {feat.description && (
                              <p className="text-[11px] text-zinc-400">{feat.description}</p>
                            )}

                            {feat.type === "BOOLEAN" && (
                              <div className="pt-1">
                                <select
                                  value={currentVal ? "true" : "false"}
                                  onChange={(e) => setFeatureFormValues({
                                    ...featureFormValues,
                                    [feat.id]: e.target.value === "true",
                                  })}
                                  className="w-full bg-[#111116] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                                >
                                  <option value="true">Liberado (✓ Ativado)</option>
                                  <option value="false">Bloqueado (✕ Desativado)</option>
                                </select>
                              </div>
                            )}

                            {feat.type === "LIMIT" && (
                              <div className="pt-1 space-y-1.5">
                                <input
                                  type="number"
                                  disabled={currentVal === -1}
                                  value={currentVal === -1 ? "" : currentVal}
                                  onChange={(e) => setFeatureFormValues({
                                    ...featureFormValues,
                                    [feat.id]: parseInt(e.target.value) || 0,
                                  })}
                                  placeholder={currentVal === -1 ? "Ilimitado" : "0"}
                                  className="w-full bg-[#111116] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 font-mono"
                                />
                                <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={currentVal === -1}
                                    onChange={(e) => setFeatureFormValues({
                                      ...featureFormValues,
                                      [feat.id]: e.target.checked ? -1 : 100,
                                    })}
                                    className="rounded border-white/[0.1] bg-[#111116] text-blue-600 focus:ring-blue-500"
                                  />
                                  <span>Ilimitado (-1)</span>
                                </label>
                              </div>
                            )}

                            {feat.type === "QUOTA" && (
                              <div className="pt-1 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    disabled={currentVal === -1}
                                    value={currentVal === -1 ? "" : currentVal}
                                    onChange={(e) => setFeatureFormValues({
                                      ...featureFormValues,
                                      [feat.id]: parseInt(e.target.value) || 0,
                                    })}
                                    placeholder={currentVal === -1 ? "Ilimitado" : "0"}
                                    className="flex-1 bg-[#111116] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                                  />
                                  <span className="text-[11px] text-zinc-400 font-bold">GB</span>
                                </div>
                                <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={currentVal === -1}
                                    onChange={(e) => setFeatureFormValues({
                                      ...featureFormValues,
                                      [feat.id]: e.target.checked ? -1 : 50,
                                    })}
                                    className="rounded border-white/[0.1] bg-[#111116] text-blue-600 focus:ring-blue-500"
                                  />
                                  <span>Ilimitado (-1 GB)</span>
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08] flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsFeatureModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePlanFeatures}
                disabled={savingPlanFeatures}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {savingPlanFeatures && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Salvar Recursos do Plano</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
