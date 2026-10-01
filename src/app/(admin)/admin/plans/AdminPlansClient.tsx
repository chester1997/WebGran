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
  Search, 
  Layers, 
  Info,
  Check,
  AlertCircle,
  Loader2
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
  const [planForm, setPlanForm] = useState({
    name: "",
    slug: "",
    price: "89.90",
    description: "",
    billingInterval: "month",
    active: true,
  });
  const [savingPlan, setSavingPlan] = useState(false);

  // Modal Configure Features
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
  const [selectedPlanForFeatures, setSelectedPlanForFeatures] = useState<PlanItem | null>(null);
  const [planFeaturesList, setPlanFeaturesList] = useState<FeatureConfigItem[]>([]);
  const [featureFormValues, setFeatureFormValues] = useState<Record<string, any>>({});
  const [loadingPlanFeatures, setLoadingPlanFeatures] = useState(false);
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
      if (!res.ok) throw new Error(data.error || "Erro ao carregar planos");
      setPlans(data.plans || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm({
      name: "",
      slug: "",
      price: "89.90",
      description: "",
      billingInterval: "month",
      active: true,
    });
    setIsPlanModalOpen(true);
  };

  const handleOpenEditPlan = (plan: PlanItem) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      slug: plan.slug,
      price: plan.price.toString(),
      description: plan.description || "",
      billingInterval: plan.billingInterval || "month",
      active: plan.active,
    });
    setIsPlanModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPlan(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        id: editingPlan?.id,
        ...planForm,
      };

      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar plano.");

      setSuccessMsg(editingPlan ? "Plano atualizado com sucesso!" : "Novo plano criado com sucesso!");
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

      setSuccessMsg("Plano excluído com sucesso!");
      fetchPlans();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleOpenConfigureFeatures = async (plan: PlanItem) => {
    setSelectedPlanForFeatures(plan);
    setIsFeatureModalOpen(true);
    setLoadingPlanFeatures(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/plans/${plan.id}/features`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar recursos do plano");

      const feats: FeatureConfigItem[] = data.features || [];
      setPlanFeaturesList(feats);

      const initialVals: Record<string, any> = {};
      for (const f of feats) {
        initialVals[f.id] = f.configuredValue;
      }
      setFeatureFormValues(initialVals);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingPlanFeatures(false);
    }
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
  const groupedFeatures = planFeaturesList.reduce((acc, feat) => {
    const cat = feat.category || "Geral";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(feat);
    return acc;
  }, {} as Record<string, FeatureConfigItem[]>);

  const categoryLabels: Record<string, string> = {
    catalog: "Catálogo & Produtos",
    integrations: "Integrações & Telegram",
    media: "Mídia & Vídeo (Clips)",
    marketing: "Marketing & Cupons",
    customization: "Personalização & Temas",
    payments: "Gateways de Pagamento",
    analytics: "Relatórios & Métricas",
    general: "Configurações Gerais",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-red-400 font-semibold text-sm mb-1">
            <Package className="w-4 h-4" />
            <span>Gestão Comercial</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Planos de Assinatura</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Configure planos comerciais, limites, permissões e quotas para os vendedores.
          </p>
        </div>

        <button
          onClick={handleOpenCreatePlan}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white font-medium text-sm hover:from-red-500 hover:to-red-600 transition shadow-lg shadow-red-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Plano</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#141416] border border-[#27272A] p-5 rounded-xl">
          <div className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Total de Planos</div>
          <div className="text-2xl font-bold text-white mt-1">{plans.length}</div>
        </div>
        <div className="bg-[#141416] border border-[#27272A] p-5 rounded-xl">
          <div className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Planos Ativos</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{plans.filter((p) => p.active).length}</div>
        </div>
        <div className="bg-[#141416] border border-[#27272A] p-5 rounded-xl">
          <div className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Vendedores em Planos</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">
            {plans.reduce((acc, curr) => acc + curr.activeSubscriptionsCount, 0)}
          </div>
        </div>
      </div>

      {/* Plans Table */}
      <div className="bg-[#141416] border border-[#27272A] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-zinc-400 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-red-500" />
            <span>Carregando planos...</span>
          </div>
        ) : plans.length === 0 ? (
          <div className="p-12 text-center text-zinc-400">Nenhum plano cadastrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-[#1C1C21] text-xs uppercase text-zinc-400 border-b border-[#27272A]">
                <tr>
                  <th className="px-6 py-4 font-semibold">Plano</th>
                  <th className="px-6 py-4 font-semibold">Preço</th>
                  <th className="px-6 py-4 font-semibold">Ciclo</th>
                  <th className="px-6 py-4 font-semibold">Recursos</th>
                  <th className="px-6 py-4 font-semibold">Vendedores</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A]">
                {plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-[#18181C] transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{plan.name}</div>
                      <div className="text-xs text-zinc-500 font-mono">slug: {plan.slug}</div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">
                      R$ {plan.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      {plan.billingInterval === "year" ? "Anual" : "Mensal"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                        <Sliders className="w-3.5 h-3.5" />
                        {plan.configuredFeaturesCount} configurados
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      {plan.activeSubscriptionsCount} assinantes
                    </td>
                    <td className="px-6 py-4">
                      {plan.active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                          <XCircle className="w-3.5 h-3.5" /> Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenConfigureFeatures(plan)}
                        className="p-2 rounded-lg bg-[#27272A] text-zinc-200 hover:text-white hover:bg-[#323238] transition"
                        title="Configurar Recursos do Plano"
                      >
                        <Sliders className="w-4 h-4 text-red-400" />
                      </button>
                      <button
                        onClick={() => handleOpenEditPlan(plan)}
                        className="p-2 rounded-lg bg-[#27272A] text-zinc-200 hover:text-white hover:bg-[#323238] transition"
                        title="Editar Plano"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan)}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                        title="Excluir Plano"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: CREATE / EDIT PLAN */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#27272A] w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
              <h2 className="text-lg font-bold text-white">
                {editingPlan ? "Editar Plano" : "Novo Plano de Assinatura"}
              </h2>
              <button
                onClick={() => setIsPlanModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Nome do Plano
                </label>
                <input
                  type="text"
                  required
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  placeholder="Ex: Plano Pro"
                  className="w-full bg-[#1A1A1E] border border-[#27272A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Slug (Identificador URL)
                </label>
                <input
                  type="text"
                  value={planForm.slug}
                  onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                  placeholder="ex: plano-pro"
                  className="w-full bg-[#1A1A1E] border border-[#27272A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={planForm.price}
                    onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                    className="w-full bg-[#1A1A1E] border border-[#27272A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                    Ciclo de Cobrança
                  </label>
                  <select
                    value={planForm.billingInterval}
                    onChange={(e) => setPlanForm({ ...planForm, billingInterval: e.target.value })}
                    className="w-full bg-[#1A1A1E] border border-[#27272A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="month">Mensal</option>
                    <option value="year">Anual</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Descrição
                </label>
                <textarea
                  rows={3}
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  placeholder="Descrição das vantagens e limites comerciais..."
                  className="w-full bg-[#1A1A1E] border border-[#27272A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={planForm.active}
                  onChange={(e) => setPlanForm({ ...planForm, active: e.target.checked })}
                  className="w-4 h-4 rounded border-[#27272A] bg-[#1A1A1E] text-red-600 focus:ring-red-500"
                />
                <label htmlFor="activeCheck" className="text-sm font-medium text-zinc-200">
                  Plano ativo para novas assinaturas
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#27272A]">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#27272A] text-zinc-300 text-sm font-medium hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {savingPlan && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Salvar Plano</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIGURE PLAN FEATURES DYNAMICALLY */}
      {isFeatureModalOpen && selectedPlanForFeatures && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#27272A] w-full max-w-3xl rounded-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-4 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Recursos do Plano: <span className="text-red-400">{selectedPlanForFeatures.name}</span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Defina os limites, permissões e quotas atreladas a este plano.
                </p>
              </div>
              <button
                onClick={() => setIsFeatureModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
              {loadingPlanFeatures ? (
                <div className="p-12 text-center text-zinc-400 flex items-center justify-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-red-500" />
                  <span>Carregando recursos...</span>
                </div>
              ) : Object.keys(groupedFeatures).length === 0 ? (
                <div className="p-8 text-center text-zinc-400">
                  Nenhuma feature cadastrada no catálogo.
                </div>
              ) : (
                Object.entries(groupedFeatures).map(([category, items]) => (
                  <div key={category} className="bg-[#1A1A1E] border border-[#27272A] rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 border-b border-[#27272A] pb-2">
                      {categoryLabels[category] || category}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {items.map((feat) => {
                        const currentVal = featureFormValues[feat.id];

                        return (
                          <div key={feat.id} className="bg-[#141416] border border-[#27272A] p-4 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm text-white">{feat.name}</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                                {feat.type}
                              </span>
                            </div>
                            {feat.description && (
                              <p className="text-xs text-zinc-400">{feat.description}</p>
                            )}

                            {/* CONTROLS BASED ON FEATURE TYPE */}
                            {feat.type === "BOOLEAN" && (
                              <div className="pt-2">
                                <select
                                  value={currentVal ? "true" : "false"}
                                  onChange={(e) => setFeatureFormValues({
                                    ...featureFormValues,
                                    [feat.id]: e.target.value === "true",
                                  })}
                                  className="w-full bg-[#1C1C21] border border-[#27272A] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
                                >
                                  <option value="true">Liberado (Ativado)</option>
                                  <option value="false">Bloqueado (Desativado)</option>
                                </select>
                              </div>
                            )}

                            {feat.type === "LIMIT" && (
                              <div className="pt-2 space-y-2">
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
                                    className="flex-1 bg-[#1C1C21] border border-[#27272A] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500 disabled:opacity-50 font-mono"
                                  />
                                </div>
                                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={currentVal === -1}
                                    onChange={(e) => setFeatureFormValues({
                                      ...featureFormValues,
                                      [feat.id]: e.target.checked ? -1 : 100,
                                    })}
                                    className="rounded border-[#27272A] bg-[#1C1C21] text-red-600 focus:ring-red-500"
                                  />
                                  <span>Ilimitado (-1)</span>
                                </label>
                              </div>
                            )}

                            {feat.type === "QUOTA" && (
                              <div className="pt-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={currentVal}
                                    onChange={(e) => setFeatureFormValues({
                                      ...featureFormValues,
                                      [feat.id]: parseInt(e.target.value) || 0,
                                    })}
                                    className="flex-1 bg-[#1C1C21] border border-[#27272A] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                                  />
                                  <span className="text-xs text-zinc-400 font-bold">GB</span>
                                </div>
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

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#27272A] flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsFeatureModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#27272A] text-zinc-300 text-sm font-medium hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePlanFeatures}
                disabled={savingPlanFeatures}
                className="px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition disabled:opacity-50 flex items-center gap-2"
              >
                {savingPlanFeatures && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Salvar Recursos do Plano</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
