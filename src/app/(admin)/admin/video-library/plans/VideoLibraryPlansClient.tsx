"use client";

import { useState, useEffect } from "react";
import {
  Film,
  HardDrive,
  Plus,
  Edit3,
  CheckCircle2,
  XCircle,
  Users,
  DollarSign,
  Loader2,
  AlertCircle,
  InfinityIcon,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

interface VideoPlanItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  billingInterval: string;
  active: boolean;
  storageQuotaGb: number; // -1 for unlimited, or GB integer
  syncpayPlanToken?: string | null;
  syncStatus?: string;
  syncError?: string | null;
  activeSubscriptionsCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function VideoLibraryPlansClient({ user }: { user: any }) {
  const [plans, setPlans] = useState<VideoPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal Plan Edit/Create
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<VideoPlanItem | null>(null);
  const [planForm, setPlanForm] = useState({
    name: "",
    slug: "",
    price: "39.90",
    description: "",
    billingInterval: "month",
    storageQuotaGb: "100",
    isUnlimited: false,
    active: true,
  });
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/video-library/plans");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar planos de armazenamento.");
      setPlans(data.plans || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingPlan(null);
    setPlanForm({
      name: "",
      slug: "",
      price: "39.90",
      description: "",
      billingInterval: "month",
      storageQuotaGb: "100",
      isUnlimited: false,
      active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (plan: VideoPlanItem) => {
    setEditingPlan(plan);
    const isUnlim = plan.storageQuotaGb === -1;
    setPlanForm({
      name: plan.name,
      slug: plan.slug,
      price: plan.price.toFixed(2),
      description: plan.description || "",
      billingInterval: plan.billingInterval || "month",
      storageQuotaGb: isUnlim ? "100" : String(plan.storageQuotaGb),
      isUnlimited: isUnlim,
      active: plan.active,
    });
    setIsModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPlan(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        id: editingPlan ? editingPlan.id : undefined,
        name: planForm.name,
        slug: planForm.slug,
        price: planForm.price,
        description: planForm.description,
        billingInterval: planForm.billingInterval,
        storageQuotaGb: planForm.isUnlimited ? -1 : Number(planForm.storageQuotaGb) || 50,
        active: planForm.active,
      };

      const res = await fetch("/api/admin/video-library/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar plano.");

      setSuccessMsg(
        editingPlan
          ? `Plano "${planForm.name}" atualizado com sucesso!`
          : `Plano "${planForm.name}" criado com sucesso!`
      );
      setIsModalOpen(false);
      fetchPlans();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleToggleActive = async (plan: VideoPlanItem) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const payload = {
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        price: plan.price,
        description: plan.description,
        billingInterval: plan.billingInterval,
        storageQuotaGb: plan.storageQuotaGb,
        active: !plan.active,
      };

      const res = await fetch("/api/admin/video-library/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao alterar status do plano.");

      setSuccessMsg(`Plano "${plan.name}" ${!plan.active ? "ativado" : "desativado"} com sucesso.`);
      fetchPlans();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const totalSubscribers = plans.reduce((acc, p) => acc + (p.activeSubscriptionsCount || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-violet-900/40 via-purple-900/30 to-zinc-900 p-6 rounded-2xl border border-violet-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-violet-600/20 rounded-xl border border-violet-500/30 text-violet-400">
              <Film className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Biblioteca de Vídeos — Planos de Armazenamento
              </h1>
              <p className="text-sm text-zinc-400">
                Administração exclusiva dos planos comerciais e cotas de armazenamento GB para vídeos.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl shadow-lg shadow-violet-600/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Plano de Armazenamento</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900/70 border border-zinc-800 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium uppercase tracking-wider">
            <span>Total de Planos</span>
            <Film className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{plans.length}</div>
          <p className="text-xs text-zinc-500">Planos cadastrados na plataforma</p>
        </div>

        <div className="bg-zinc-900/70 border border-zinc-800 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium uppercase tracking-wider">
            <span>Vendedores Assinantes</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{totalSubscribers}</div>
          <p className="text-xs text-zinc-500">Assinaturas ativas vinculadas aos planos</p>
        </div>

        <div className="bg-zinc-900/70 border border-zinc-800 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium uppercase tracking-wider">
            <span>Regra de Isenção</span>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-300 flex items-center gap-1.5 pt-1">
            <InfinityIcon className="w-5 h-5" /> SUPER_ADMIN
          </div>
          <p className="text-xs text-zinc-500">Super Admins possuem cota Ilimitada automatizada</p>
        </div>
      </div>

      {/* Plans List / Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-zinc-400 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          <p className="text-sm">Carregando planos de armazenamento...</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-12 text-center space-y-4">
          <HardDrive className="w-12 h-12 text-zinc-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-white">Nenhum plano cadastrado</h3>
            <p className="text-sm text-zinc-400">
              Crie o primeiro plano de armazenamento para comercialização da Biblioteca de Vídeos.
            </p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl text-sm"
          >
            <Plus className="w-4 h-4" />
            Criar Plano agora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-zinc-900/80 border ${
                plan.active ? "border-zinc-800 hover:border-violet-500/40" : "border-zinc-800/60 opacity-75"
              } rounded-2xl p-6 flex flex-col justify-between space-y-6 transition-all shadow-lg`}
            >
              {/* Header card */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-violet-950/80 text-violet-300 border border-violet-800/50 inline-block mb-2">
                      /{plan.slug}
                    </span>
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                      plan.active
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                    }`}
                  >
                    {plan.active ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> ATIVO
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" /> INATIVO
                      </>
                    )}
                  </span>
                </div>

                <p className="text-sm text-zinc-400 min-h-[40px] line-clamp-2">
                  {plan.description || "Sem descrição informada."}
                </p>

                {/* Storage & Price metrics */}
                <div className="bg-zinc-950/60 rounded-xl p-4 border border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400 font-medium">Capacidade:</span>
                    <span className="text-base font-extrabold text-white flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-violet-400" />
                      {plan.storageQuotaGb === -1 ? (
                        <span className="text-amber-300 flex items-center gap-1">
                          <InfinityIcon className="w-4 h-4" /> ILIMITADO
                        </span>
                      ) : (
                        `${plan.storageQuotaGb} GB`
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
                    <span className="text-xs text-zinc-400 font-medium">Preço Comercial:</span>
                    <span className="text-lg font-bold text-emerald-400 flex items-baseline gap-1">
                      R$ {plan.price.toFixed(2).replace(".", ",")}
                      <span className="text-xs text-zinc-500 font-normal">
                        /{plan.billingInterval === "year" ? "ano" : "mês"}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                  <span>Vendedores Ativos:</span>
                  <span className="font-semibold text-zinc-200">
                    {plan.activeSubscriptionsCount} assinaturas
                  </span>
                </div>
              </div>

              {/* Action buttons & SyncPay status */}
              <div className="pt-4 border-t border-zinc-800/60 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-medium">Gateway SyncPay:</span>
                  {plan.syncStatus === "SYNCED" ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Sincronizado
                    </span>
                  ) : plan.syncStatus === "SYNC_ERROR" ? (
                    <span className="inline-flex items-center gap-1 font-bold text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/20" title={plan.syncError || ""}>
                      <XCircle className="w-3.5 h-3.5" /> Erro de Sincronização
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                      <AlertCircle className="w-3.5 h-3.5" /> Aguardando Sincronização
                    </span>
                  )}
                </div>

                {plan.syncStatus !== "SYNCED" && (
                  <button
                    onClick={async () => {
                      setError(null);
                      setSuccessMsg(null);
                      try {
                        const res = await fetch("/api/admin/video-library/plans", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "sync", id: plan.id }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Falha ao sincronizar com SyncPay.");
                        setSuccessMsg(`Plano "${plan.name}" sincronizado com sucesso na SyncPay!`);
                        fetchPlans();
                      } catch (err: any) {
                        setError(err.message);
                      }
                    }}
                    className="w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Sincronizar com SyncPay
                  </button>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    onClick={() => handleToggleActive(plan)}
                    className={`text-xs font-medium px-3 py-2 rounded-xl transition-colors cursor-pointer border ${
                      plan.active
                        ? "bg-zinc-800/60 hover:bg-red-500/10 text-zinc-300 hover:text-red-400 border-zinc-700 hover:border-red-500/30"
                        : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    }`}
                  >
                    {plan.active ? "Desativar" : "Ativar Plano"}
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(plan)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 font-medium rounded-xl text-xs border border-violet-500/30 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Editar Plano
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Create / Edit Plan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Film className="w-5 h-5 text-violet-400" />
                <h2 className="text-lg font-bold text-white">
                  {editingPlan ? `Editar Plano: ${editingPlan.name}` : "Criar Plano da Biblioteca"}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Nome do Plano
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Starter, Pro, Business"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Slug Identificador
                  </label>
                  <input
                    type="text"
                    placeholder="ex: starter-video"
                    value={planForm.slug}
                    onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="39.90"
                    value={planForm.price}
                    onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Periodicidade
                  </label>
                  <select
                    value={planForm.billingInterval}
                    onChange={(e) => setPlanForm({ ...planForm, billingInterval: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="month">Mensal</option>
                    <option value="year">Anual</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Armazenamento (GB)
                  </label>
                  <input
                    type="number"
                    disabled={planForm.isUnlimited}
                    min="1"
                    placeholder="100"
                    value={planForm.isUnlimited ? "" : planForm.storageQuotaGb}
                    onChange={(e) => setPlanForm({ ...planForm, storageQuotaGb: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 disabled:opacity-40"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-zinc-950/60 rounded-xl border border-zinc-800">
                <input
                  type="checkbox"
                  id="isUnlimitedCheck"
                  checked={planForm.isUnlimited}
                  onChange={(e) => setPlanForm({ ...planForm, isUnlimited: e.target.checked })}
                  className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 bg-zinc-900 border-zinc-700"
                />
                <label htmlFor="isUnlimitedCheck" className="text-xs text-zinc-200 cursor-pointer select-none">
                  Armazenamento Ilimitado (-1 GB)
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Descrição do Plano
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: Ideal para produtores de conteúdo com alta demanda de vídeos."
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={planForm.active}
                  onChange={(e) => setPlanForm({ ...planForm, active: e.target.checked })}
                  className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 bg-zinc-900 border-zinc-700"
                />
                <label htmlFor="activeCheck" className="text-xs text-zinc-200 cursor-pointer select-none">
                  Plano Ativo (Visível para contratação pelos vendedores)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={savingPlan}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl text-sm shadow-lg shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingPlan ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Plano"
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
