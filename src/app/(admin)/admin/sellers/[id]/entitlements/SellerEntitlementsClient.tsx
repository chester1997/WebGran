"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  User, 
  ShieldCheck, 
  Package, 
  Sliders, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Clock,
  Zap,
  Info
} from "lucide-react";

interface EntitlementItem {
  featureId: string;
  featureKey: string;
  featureName: string;
  category: string;
  type: "BOOLEAN" | "LIMIT" | "QUOTA";
  planValue: any;
  overrideValue: any;
  effectiveValue: any;
  effectiveSource: "ADMIN_EXEMPT" | "OVERRIDE" | "PLAN" | "DEFAULT" | "INACTIVE" | "NOT_FOUND";
  isUnlimited: boolean;
  overrideReason: string | null;
  overrideExpiresAt: string | null;
  isOverrideExpired: boolean;
  hasOverride: boolean;
}

interface SellerInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface SubscriptionInfo {
  id: string;
  planId: string;
  planName: string;
  status: string;
}

interface AvailablePlan {
  id: string;
  name: string;
  price: number;
}

export default function SellerEntitlementsClient({
  user,
  sellerId,
}: {
  user: any;
  sellerId: string;
}) {
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [currentSub, setCurrentSub] = useState<SubscriptionInfo | null>(null);
  const [availablePlans, setAvailablePlans] = useState<AvailablePlan[]>([]);
  const [entitlements, setEntitlements] = useState<EntitlementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Plan change
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [changingPlan, setChangingPlan] = useState(false);

  // Override modal
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    featureKey: "",
    overrideValue: "",
    reason: "",
    expiresAt: "",
  });
  const [savingOverride, setSavingOverride] = useState(false);

  useEffect(() => {
    fetchData();
  }, [sellerId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/entitlements`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar entitlements do vendedor.");

      setSeller(data.seller);
      setCurrentSub(data.currentSubscription);
      setAvailablePlans(data.availablePlans || []);
      setEntitlements(data.entitlements || []);

      if (data.currentSubscription?.planId) {
        setSelectedPlanId(data.currentSubscription.planId);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePlan = async () => {
    if (!selectedPlanId) return;
    setChangingPlan(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/entitlements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlanId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao alterar plano.");

      setSuccessMsg(data.message || "Plano alterado com sucesso!");
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setChangingPlan(false);
    }
  };

  const handleOpenAddOverride = (featureKey?: string) => {
    const defaultFeat = featureKey || (entitlements[0]?.featureKey || "");
    const featObj = entitlements.find((e) => e.featureKey === defaultFeat);

    let defaultValStr = "true";
    if (featObj?.type === "BOOLEAN") defaultValStr = "true";
    else if (featObj?.type === "LIMIT" || featObj?.type === "QUOTA") defaultValStr = "100";

    setOverrideForm({
      featureKey: defaultFeat,
      overrideValue: defaultValStr,
      reason: "",
      expiresAt: "",
    });
    setIsOverrideModalOpen(true);
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOverride(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const selectedFeat = entitlements.find((e) => e.featureKey === overrideForm.featureKey);
      let parsedValue: any = overrideForm.overrideValue;

      if (selectedFeat?.type === "BOOLEAN") {
        parsedValue = overrideForm.overrideValue === "true";
      } else if (selectedFeat?.type === "LIMIT" || selectedFeat?.type === "QUOTA") {
        parsedValue = parseInt(overrideForm.overrideValue);
      }

      const res = await fetch(`/api/admin/sellers/${sellerId}/entitlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          featureKey: overrideForm.featureKey,
          overrideValue: parsedValue,
          reason: overrideForm.reason,
          expiresAt: overrideForm.expiresAt || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar override.");

      setSuccessMsg("Override criado com sucesso!");
      setIsOverrideModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingOverride(false);
    }
  };

  const handleRemoveOverride = async (featureKey: string) => {
    if (!confirm(`Deseja remover o override para a feature "${featureKey}"?`)) return;

    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/entitlements?featureKey=${encodeURIComponent(featureKey)}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao remover override.");

      setSuccessMsg("Override removido com sucesso!");
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const renderSourceBadge = (source: EntitlementItem["effectiveSource"]) => {
    switch (source) {
      case "ADMIN_EXEMPT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Zap className="w-3 h-3" /> Isento (Admin)
          </span>
        );
      case "OVERRIDE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            Override
          </span>
        );
      case "PLAN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Plano
          </span>
        );
      case "DEFAULT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
            Default
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            Inativo
          </span>
        );
    }
  };

  const renderValueText = (type: string, val: any, isUnlimited: boolean) => {
    if (isUnlimited || val === -1) return <span className="text-emerald-400 font-bold">Ilimitado</span>;
    if (type === "BOOLEAN") return val ? <span className="text-emerald-400">Ativado</span> : <span className="text-red-400">Desativado</span>;
    if (type === "QUOTA") return <span>{val} GB</span>;
    return <span>{val}</span>;
  };

  const selectedFeatureObj = entitlements.find((e) => e.featureKey === overrideForm.featureKey);

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <Link
          href="/admin/sellers"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Lista de Vendedores</span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-red-400 font-semibold text-sm mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Permissões & Entitlements</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Vendedor: <span className="text-red-400">{seller?.name || "Carregando..."}</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-1">{seller?.email}</p>
        </div>

        <button
          onClick={() => handleOpenAddOverride()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white font-medium text-sm hover:from-red-500 hover:to-red-600 transition shadow-lg shadow-red-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar Override</span>
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

      {/* Plan Assignment Box */}
      <div className="bg-[#141416] border border-[#27272A] p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
            <Package className="w-4 h-4 text-red-400" />
            Plano de Assinatura Atual
          </h3>
          <p className="text-xs text-zinc-400">
            Plano ativo: <span className="text-white font-semibold">{currentSub?.planName || "Sem Plano Vinculado"}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            className="bg-[#1C1C21] border border-[#27272A] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500"
          >
            <option value="">Selecione um plano...</option>
            {availablePlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (R$ {p.price.toFixed(2)})
              </option>
            ))}
          </select>
          <button
            onClick={handleChangePlan}
            disabled={changingPlan || !selectedPlanId}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition disabled:opacity-50 flex items-center gap-2"
          >
            {changingPlan && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Alterar Plano</span>
          </button>
        </div>
      </div>

      {/* Entitlements Table */}
      <div className="bg-[#141416] border border-[#27272A] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-[#27272A] flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Matriz de Recursos Efetivos
          </h3>
          <span className="text-xs text-zinc-400">
            {entitlements.length} recursos calculados
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-zinc-400 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-red-500" />
            <span>Calculando permissões e overrides...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-[#1C1C21] text-xs uppercase text-zinc-400 border-b border-[#27272A]">
                <tr>
                  <th className="px-6 py-4 font-semibold">Recurso</th>
                  <th className="px-6 py-4 font-semibold">Plano</th>
                  <th className="px-6 py-4 font-semibold">Override</th>
                  <th className="px-6 py-4 font-semibold">Valor Efetivo</th>
                  <th className="px-6 py-4 font-semibold">Origem</th>
                  <th className="px-6 py-4 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A]">
                {entitlements.map((item) => (
                  <tr key={item.featureId} className="hover:bg-[#18181C] transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{item.featureName}</div>
                      <div className="text-xs font-mono text-zinc-500">{item.featureKey}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-400">
                      {renderValueText(item.type, item.planValue, item.planValue === -1)}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {item.hasOverride ? (
                        <div className="space-y-1">
                          <div>{renderValueText(item.type, item.overrideValue, item.overrideValue === -1)}</div>
                          {item.isOverrideExpired ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              <Clock className="w-3 h-3" /> Expirado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              Ativo
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-bold text-white">
                      {renderValueText(item.type, item.effectiveValue, item.isUnlimited)}
                    </td>
                    <td className="px-6 py-4">
                      {renderSourceBadge(item.effectiveSource)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {item.hasOverride ? (
                        <button
                          onClick={() => handleRemoveOverride(item.featureKey)}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition text-xs font-medium inline-flex items-center gap-1"
                          title="Remover Override"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remover
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenAddOverride(item.featureKey)}
                          className="p-1.5 rounded-lg bg-[#27272A] text-zinc-300 hover:text-white hover:bg-[#323238] transition text-xs font-medium inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Override
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: ADD OVERRIDE */}
      {isOverrideModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#27272A] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
              <h2 className="text-lg font-bold text-white">Adicionar Override por Vendedor</h2>
              <button
                onClick={() => setIsOverrideModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOverride} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Recurso (Feature)
                </label>
                <select
                  value={overrideForm.featureKey}
                  onChange={(e) => {
                    const featKey = e.target.value;
                    const featObj = entitlements.find((item) => item.featureKey === featKey);
                    let defaultValStr = "true";
                    if (featObj?.type === "BOOLEAN") defaultValStr = "true";
                    else if (featObj?.type === "LIMIT" || featObj?.type === "QUOTA") defaultValStr = "100";

                    setOverrideForm({
                      ...overrideForm,
                      featureKey: featKey,
                      overrideValue: defaultValStr,
                    });
                  }}
                  className="w-full bg-[#1A1A1E] border border-[#27272A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono"
                >
                  {entitlements.map((e) => (
                    <option key={e.featureKey} value={e.featureKey}>
                      {e.featureName} ({e.featureKey})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Valor do Override
                </label>
                {selectedFeatureObj?.type === "BOOLEAN" ? (
                  <select
                    value={overrideForm.overrideValue}
                    onChange={(e) => setOverrideForm({ ...overrideForm, overrideValue: e.target.value })}
                    className="w-full bg-[#1A1A1E] border border-[#27272A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="true">Liberar (Ativado / true)</option>
                    <option value="false">Bloquear (Desativado / false)</option>
                  </select>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="number"
                      required
                      value={overrideForm.overrideValue}
                      onChange={(e) => setOverrideForm({ ...overrideForm, overrideValue: e.target.value })}
                      placeholder="Ex: 500 (ou -1 para ilimitado)"
                      className="w-full bg-[#1A1A1E] border border-[#27272A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono"
                    />
                    <div className="text-[10px] text-zinc-400">
                      Use <span className="font-mono text-red-400">-1</span> para conceder limite ilimitado.
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Motivo da Concessão
                </label>
                <input
                  type="text"
                  value={overrideForm.reason}
                  onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                  placeholder="Ex: Cortesia comercial / Bônus de migração"
                  className="w-full bg-[#1A1A1E] border border-[#27272A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Data de Expiração (Opcional)
                </label>
                <input
                  type="date"
                  value={overrideForm.expiresAt}
                  onChange={(e) => setOverrideForm({ ...overrideForm, expiresAt: e.target.value })}
                  className="w-full bg-[#1A1A1E] border border-[#27272A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#27272A]">
                <button
                  type="button"
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#27272A] text-zinc-300 text-sm font-medium hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingOverride}
                  className="px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {savingOverride && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Salvar Override</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
