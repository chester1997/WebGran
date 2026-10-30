"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Sliders,
  Plus,
  Edit3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Layers,
  Search,
  X,
  Sparkles,
  Check
} from "lucide-react";

interface FeatureItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  type: "BOOLEAN" | "LIMIT" | "QUOTA";
  category: string;
  defaultValue: any;
  isActive: boolean;
}

const CATEGORY_MAP: Record<string, string> = {
  all: "Todas",
  catalog: "Catálogo",
  integrations: "Integrações",
  media: "Mídia / Vídeo",
  marketing: "Marketing",
  customization: "Personalização",
  payments: "Pagamentos",
  analytics: "Relatórios",
  general: "Geral",
};

export default function AdminFeaturesClient({ user }: { user: any }) {
  const [features, setFeatures] = useState<FeatureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<FeatureItem | null>(null);
  const [featureForm, setFeatureForm] = useState({
    key: "",
    name: "",
    description: "",
    type: "BOOLEAN" as "BOOLEAN" | "LIMIT" | "QUOTA",
    category: "catalog",
    defaultValue: "true",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/features");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao buscar recursos.");
      setFeatures(data.features || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingFeature(null);
    setFeatureForm({
      key: "",
      name: "",
      description: "",
      type: "BOOLEAN",
      category: "catalog",
      defaultValue: "true",
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (feat: FeatureItem) => {
    setEditingFeature(feat);
    let defStr = feat.defaultValue;
    if (typeof feat.defaultValue === "boolean") defStr = feat.defaultValue ? "true" : "false";
    else if (feat.defaultValue !== undefined && feat.defaultValue !== null) defStr = feat.defaultValue.toString();

    setFeatureForm({
      key: feat.key,
      name: feat.name,
      description: feat.description || "",
      type: feat.type,
      category: feat.category || "general",
      defaultValue: defStr,
      isActive: feat.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSaveFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      let parsedDefault: any = featureForm.defaultValue;
      if (featureForm.type === "BOOLEAN") {
        parsedDefault = featureForm.defaultValue === "true";
      } else if (featureForm.type === "LIMIT" || featureForm.type === "QUOTA") {
        parsedDefault = parseInt(featureForm.defaultValue) || 0;
      }

      if (editingFeature) {
        const res = await fetch(`/api/admin/features/${editingFeature.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: featureForm.name,
            description: featureForm.description,
            category: featureForm.category,
            defaultValue: parsedDefault,
            isActive: featureForm.isActive,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao atualizar recurso.");
        setSuccessMsg("Recurso atualizado com sucesso!");
      } else {
        const res = await fetch("/api/admin/features", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...featureForm,
            defaultValue: parsedDefault,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao criar recurso.");
        setSuccessMsg("Novo recurso cadastrado com sucesso!");
      }

      setIsModalOpen(false);
      fetchFeatures();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredFeatures = useMemo(() => {
    return features.filter((f) => {
      const term = search.toLowerCase();
      const matchesSearch =
        f.name.toLowerCase().includes(term) ||
        f.key.toLowerCase().includes(term) ||
        f.category.toLowerCase().includes(term);

      const matchesCat = selectedCategory === "all" || f.category.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCat;
    });
  }, [features, search, selectedCategory]);

  const totalFeatures = features.length;
  const activeFeatures = features.filter((f) => f.isActive).length;
  const categoriesCount = new Set(features.map((f) => f.category)).size;

  return (
    <div className="space-y-6 pb-12 text-zinc-100 fade-in">
      {/* ==================================================== */}
      {/* 1. HEADER (Integrado ao fundo, sem caixa card) */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              Features & Entitlements
            </h1>
            <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Catálogo Global
            </span>
          </div>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">
            Defina o catálogo global de recursos comercializáveis, limites e regras de permissão do ecossistema WebGran
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-sm cursor-pointer h-9 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Feature</span>
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
      {/* 2. SUMMARY KPI CARDS */}
      {/* ==================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Total de Features */}
        <div className="p-4 rounded-2xl bg-[#0F1014] border border-white/[0.08] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
              Total de Recursos
            </span>
            <div className="p-2 rounded-xl border bg-white/5 border-white/[0.08] text-zinc-300 shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-white tracking-tight block">
            {totalFeatures}
          </span>
          <span className="text-[10px] text-zinc-500 block truncate pt-0.5">
            Features catalogadas na plataforma
          </span>
        </div>

        {/* Features Ativas */}
        <div className="p-4 rounded-2xl bg-[#0F1014] border border-white/[0.08] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
              Recursos Ativos
            </span>
            <div className="p-2 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight block">
            {activeFeatures}
          </span>
          <span className="text-[10px] text-zinc-500 block truncate pt-0.5">
            Habilitadas para vinculação
          </span>
        </div>

        {/* Categorias no Catálogo */}
        <div className="p-4 rounded-2xl bg-[#0F1014] border border-blue-500/30 shadow-lg shadow-blue-500/5 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
              Categorias Mapeadas
            </span>
            <div className="p-2 rounded-xl border bg-blue-500/10 border-blue-500/20 text-blue-400 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-white tracking-tight block">
            {categoriesCount}
          </span>
          <span className="text-[10px] text-zinc-500 block truncate pt-0.5">
            Grupos funcionais independentes
          </span>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 3. TOOLBAR: SEARCH & CATEGORY FILTER */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#0F1014] rounded-2xl border border-white/[0.08]">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, chave ou categoria..."
            className="w-full pl-9 pr-8 py-2 bg-[#15171D] border border-white/[0.08] focus:border-blue-500 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
          {Object.entries(CATEGORY_MAP).map(([catKey, catLabel]) => (
            <button
              key={catKey}
              onClick={() => setSelectedCategory(catKey)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                selectedCategory === catKey
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white bg-[#15171D] hover:bg-white/[0.04] border border-white/[0.06]"
              }`}
            >
              {catLabel}
            </button>
          ))}
        </div>
      </div>

      {/* ==================================================== */}
      {/* 4. FEATURES TABLE */}
      {/* ==================================================== */}
      <div className="bg-[#0F1014] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Catálogo de Recursos ({filteredFeatures.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-zinc-400 flex items-center justify-center gap-3 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span>Carregando catálogo de recursos...</span>
          </div>
        ) : filteredFeatures.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs">
            Nenhuma feature encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-white/[0.02] text-[11px] uppercase tracking-wider text-zinc-400 border-b border-white/[0.06]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Nome & Descrição</th>
                  <th className="px-5 py-3 font-semibold">Chave (Key)</th>
                  <th className="px-5 py-3 font-semibold">Tipo</th>
                  <th className="px-5 py-3 font-semibold">Categoria</th>
                  <th className="px-5 py-3 font-semibold">Default Global</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredFeatures.map((feat) => (
                  <tr key={feat.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Nome & Descrição */}
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-white text-xs">{feat.name}</div>
                      {feat.description && (
                        <div className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">{feat.description}</div>
                      )}
                    </td>

                    {/* Key */}
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        {feat.key}
                      </span>
                    </td>

                    {/* Tipo */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-zinc-300 border border-white/[0.08]">
                        {feat.type}
                      </span>
                    </td>

                    {/* Categoria */}
                    <td className="px-5 py-3.5 text-xs text-zinc-300">
                      {CATEGORY_MAP[feat.category] || feat.category}
                    </td>

                    {/* Default */}
                    <td className="px-5 py-3.5 font-mono text-[11px] text-white">
                      {feat.type === "BOOLEAN"
                        ? (feat.defaultValue ? "Ativado (true)" : "Desativado (false)")
                        : (feat.defaultValue === -1 ? "Ilimitado (-1)" : feat.defaultValue)}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      {feat.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Ativa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                          <XCircle className="w-3 h-3" /> Inativa
                        </span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleOpenEdit(feat)}
                        className="p-1.5 rounded-lg bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                        title="Editar Feature"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
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
      {/* 5. CREATE / EDIT MODAL */}
      {/* ==================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1014] border border-white/[0.08] w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {editingFeature ? "Editar Feature" : "Nova Feature no Catálogo"}
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Defina chave, tipo e valor padrão global
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFeature} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Chave Única (Key) <span className="text-blue-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingFeature)}
                  value={featureForm.key}
                  onChange={(e) => setFeatureForm({ ...featureForm, key: e.target.value })}
                  placeholder="ex: max_products"
                  className="w-full bg-[#15171D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Nome do Recurso <span className="text-blue-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={featureForm.name}
                  onChange={(e) => setFeatureForm({ ...featureForm, name: e.target.value })}
                  placeholder="Ex: Limite de Produtos"
                  className="w-full bg-[#15171D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                    Tipo do Recurso <span className="text-blue-400">*</span>
                  </label>
                  <select
                    disabled={Boolean(editingFeature)}
                    value={featureForm.type}
                    onChange={(e) => setFeatureForm({
                      ...featureForm,
                      type: e.target.value as any,
                      defaultValue: e.target.value === "BOOLEAN" ? "true" : "0"
                    })}
                    className="w-full bg-[#15171D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 font-mono"
                  >
                    <option value="BOOLEAN">BOOLEAN (Liga/Desliga)</option>
                    <option value="LIMIT">LIMIT (Numérico/Ilimitado)</option>
                    <option value="QUOTA">QUOTA (Armazenamento)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                    Categoria <span className="text-blue-400">*</span>
                  </label>
                  <select
                    value={featureForm.category}
                    onChange={(e) => setFeatureForm({ ...featureForm, category: e.target.value })}
                    className="w-full bg-[#15171D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="catalog">Catálogo</option>
                    <option value="integrations">Integrações</option>
                    <option value="media">Mídia / Vídeo</option>
                    <option value="marketing">Marketing</option>
                    <option value="customization">Personalização</option>
                    <option value="payments">Pagamentos</option>
                    <option value="analytics">Relatórios</option>
                    <option value="general">Geral</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Valor Padrão Global (Default) <span className="text-blue-400">*</span>
                </label>
                {featureForm.type === "BOOLEAN" ? (
                  <select
                    value={featureForm.defaultValue}
                    onChange={(e) => setFeatureForm({ ...featureForm, defaultValue: e.target.value })}
                    className="w-full bg-[#15171D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="true">Ativado (true)</option>
                    <option value="false">Desativado (false)</option>
                  </select>
                ) : (
                  <input
                    type="number"
                    value={featureForm.defaultValue}
                    onChange={(e) => setFeatureForm({ ...featureForm, defaultValue: e.target.value })}
                    placeholder="Ex: 100 (ou -1 para ilimitado)"
                    className="w-full bg-[#15171D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Descrição
                </label>
                <textarea
                  rows={2}
                  value={featureForm.description}
                  onChange={(e) => setFeatureForm({ ...featureForm, description: e.target.value })}
                  placeholder="Descrição do propósito deste recurso..."
                  className="w-full bg-[#15171D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="featActive"
                  checked={featureForm.isActive}
                  onChange={(e) => setFeatureForm({ ...featureForm, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-white/[0.1] bg-[#15171D] text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="featActive" className="text-xs text-zinc-300 cursor-pointer select-none">
                  Feature ativa no catálogo
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Salvar Feature</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
