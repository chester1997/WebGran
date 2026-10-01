"use client";

import { useState, useEffect } from "react";
import { 
  Sliders, 
  Plus, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  Layers, 
  Search 
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

export default function AdminFeaturesClient({ user }: { user: any }) {
  const [features, setFeatures] = useState<FeatureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  const filteredFeatures = features.filter((f) => 
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.key.toLowerCase().includes(search.toLowerCase()) ||
    f.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-red-400 font-semibold text-sm mb-1">
            <Sliders className="w-4 h-4" />
            <span>Catálogo de Recursos</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Features & Entitlements</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Defina o catálogo global de recursos comercializáveis do WebGran.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white font-medium text-sm hover:from-red-500 hover:to-red-600 transition shadow-lg shadow-red-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Feature</span>
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

      {/* Search Input */}
      <div className="flex items-center gap-3 bg-[#141416] border border-[#27272A] px-4 py-2.5 rounded-xl">
        <Search className="w-4 h-4 text-zinc-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar feature por nome, chave ou categoria..."
          className="bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none w-full"
        />
      </div>

      {/* Table */}
      <div className="bg-[#141416] border border-[#27272A] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-zinc-400 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-red-500" />
            <span>Carregando catálogo de recursos...</span>
          </div>
        ) : filteredFeatures.length === 0 ? (
          <div className="p-12 text-center text-zinc-400">Nenhuma feature encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-[#1C1C21] text-xs uppercase text-zinc-400 border-b border-[#27272A]">
                <tr>
                  <th className="px-6 py-4 font-semibold">Nome & Descrição</th>
                  <th className="px-6 py-4 font-semibold">Chave (Key)</th>
                  <th className="px-6 py-4 font-semibold">Tipo</th>
                  <th className="px-6 py-4 font-semibold">Categoria</th>
                  <th className="px-6 py-4 font-semibold">Default Global</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A]">
                {filteredFeatures.map((feat) => (
                  <tr key={feat.id} className="hover:bg-[#18181C] transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{feat.name}</div>
                      {feat.description && (
                        <div className="text-xs text-zinc-400">{feat.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-red-400">
                      {feat.key}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {feat.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium uppercase text-zinc-400">
                      {feat.category}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-white">
                      {feat.type === "BOOLEAN"
                        ? (feat.defaultValue ? "Ativado (true)" : "Desativado (false)")
                        : (feat.defaultValue === -1 ? "Ilimitado (-1)" : feat.defaultValue)}
                    </td>
                    <td className="px-6 py-4">
                      {feat.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ativa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                          <XCircle className="w-3.5 h-3.5" /> Inativa
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(feat)}
                        className="p-2 rounded-lg bg-[#27272A] text-zinc-200 hover:text-white hover:bg-[#323238] transition"
                        title="Editar Feature"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#27272A] w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
              <h2 className="text-lg font-bold text-white">
                {editingFeature ? "Editar Feature" : "Nova Feature no Catálogo"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFeature} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Chave Única (Key)
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingFeature)}
                  value={featureForm.key}
                  onChange={(e) => setFeatureForm({ ...featureForm, key: e.target.value })}
                  placeholder="ex: max_products"
                  className="w-full bg-[#1A1A1E] border border-[#27272A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 disabled:opacity-50 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                  Nome do Recurso
                </label>
                <input
                  type="text"
                  required
                  value={featureForm.name}
                  onChange={(e) => setFeatureForm({ ...featureForm, name: e.target.value })}
                  placeholder="Ex: Limite de Produtos"
                  className="w-full bg-[#1A1A1E] border border-[#27272A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                    Tipo do Recurso
                  </label>
                  <select
                    disabled={Boolean(editingFeature)}
                    value={featureForm.type}
                    onChange={(e) => setFeatureForm({ 
                      ...featureForm, 
                      type: e.target.value as any,
                      defaultValue: e.target.value === "BOOLEAN" ? "true" : "0"
                    })}
                    className="w-full bg-[#1A1A1E] border border-[#27272A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 disabled:opacity-50 font-mono"
                  >
                    <option value="BOOLEAN">BOOLEAN (Liga/Desliga)</option>
                    <option value="LIMIT">LIMIT (Numérico/Ilimitado)</option>
                    <option value="QUOTA">QUOTA (Armazenamento/Tráfego)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">
                    Categoria
                  </label>
                  <select
                    value={featureForm.category}
                    onChange={(e) => setFeatureForm({ ...featureForm, category: e.target.value })}
                    className="w-full bg-[#1A1A1E] border border-[#27272A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
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
                  Valor Padrão Global (Default)
                </label>
                {featureForm.type === "BOOLEAN" ? (
                  <select
                    value={featureForm.defaultValue}
                    onChange={(e) => setFeatureForm({ ...featureForm, defaultValue: e.target.value })}
                    className="w-full bg-[#1A1A1E] border border-[#27272A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
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
                    className="w-full bg-[#1A1A1E] border border-[#27272A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono"
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
                  className="w-full bg-[#1A1A1E] border border-[#27272A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="featActive"
                  checked={featureForm.isActive}
                  onChange={(e) => setFeatureForm({ ...featureForm, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-[#27272A] bg-[#1A1A1E] text-red-600 focus:ring-red-500"
                />
                <label htmlFor="featActive" className="text-sm font-medium text-zinc-200">
                  Feature ativa no catálogo
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#27272A]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#27272A] text-zinc-300 text-sm font-medium hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
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
