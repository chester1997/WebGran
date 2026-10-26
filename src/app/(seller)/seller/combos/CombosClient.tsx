"use client";

import { useState } from "react";
import { 
  Boxes, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Sparkles, 
  Package, 
  TrendingUp, 
  ArrowRight,
  ExternalLink,
  Layers,
  Power,
  Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComboModal } from "./ComboModal";
import { 
  ComboItem, 
  toggleComboStatusAction, 
  deleteComboAction, 
  getCombosAction 
} from "./actions";

interface ActiveProduct {
  id: string;
  title: string;
  price: string;
  coverUrl: string | null;
  status: string;
}

interface CombosClientProps {
  initialCombos: ComboItem[];
  activeProducts: ActiveProduct[];
  storeSlug: string;
}

export default function CombosClient({
  initialCombos,
  activeProducts,
  storeSlug,
}: CombosClientProps) {
  const [combosList, setCombosList] = useState<ComboItem[]>(initialCombos);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "curated" | "progressive">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [comboToEdit, setComboToEdit] = useState<ComboItem | null>(null);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshCombos = async () => {
    try {
      const updated = await getCombosAction();
      setCombosList(updated);
    } catch (err: any) {
      console.error("Erro ao atualizar lista de combos:", err);
    }
  };

  const handleOpenCreate = () => {
    setComboToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (combo: ComboItem) => {
    setComboToEdit(combo);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (comboId: string) => {
    setLoadingActionId(comboId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await toggleComboStatusAction(comboId);
      if (res.success) {
        setCombosList((prev) =>
          prev.map((c) => (c.id === comboId ? { ...c, status: res.status } : c))
        );
        setSuccessMessage(`Oferta ${res.status === "active" ? "ativada" : "desativada"} com sucesso.`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao alterar status da oferta.");
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleDeleteCombo = async (combo: ComboItem) => {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir "${combo.title}"?\nSe a promoção possuir pedidos registrados, ela será arquivada para preservar o histórico.`
    );
    if (!confirmed) return;

    setLoadingActionId(combo.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await deleteComboAction(combo.id);
      if (res.success) {
        setCombosList((prev) => prev.filter((c) => c.id !== combo.id));
        setSuccessMessage(res.message || "Oferta removida com sucesso.");
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao excluir oferta.");
    } finally {
      setLoadingActionId(null);
    }
  };

  // Metrics
  const totalCombos = combosList.length;
  const activeCombos = combosList.filter((c) => c.status === "active").length;
  const progressiveOffersCount = combosList.filter((c) => c.type === "progressive").length;

  // Filtered Combos
  const filteredCombos = combosList.filter((combo) => {
    const matchesSearch =
      combo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      combo.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      combo.products.some((p) => p.title.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" ? true : combo.status === statusFilter;

    const matchesType =
      typeFilter === "all" ? true : (combo.type || "curated") === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="w-full space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Combos e Ofertas</h1>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              Novidade
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Crie combos tradicionais ou ofertas progressivas por quantidade (Leve Mais por Menos) para aumentar o ticket médio.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 h-10 rounded-xl shadow-lg shadow-emerald-950/20 flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Oferta</span>
        </Button>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#13131A] border border-white/5 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium">Total de Promoções</p>
            <p className="text-xl font-bold text-white mt-0.5">{totalCombos}</p>
          </div>
        </div>

        <div className="bg-[#13131A] border border-white/5 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium">Ofertas Ativas</p>
            <p className="text-xl font-bold text-white mt-0.5">{activeCombos}</p>
          </div>
        </div>

        <div className="bg-[#13131A] border border-white/5 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium">Ofertas Progressivas</p>
            <p className="text-xl font-bold text-white mt-0.5">{progressiveOffersCount}</p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#13131A] border border-white/5 p-3 rounded-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, slug ou produto..."
            className="w-full bg-[#1A1A22] border border-white/5 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 placeholder:text-zinc-600 transition-colors"
          />
        </div>

        {/* Type & Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto shrink-0">
          <div className="flex items-center gap-1 bg-[#1A1A22] p-1 rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === "all"
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("curated")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === "curated"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Combos
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("progressive")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === "progressive"
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Progressivos
            </button>
          </div>

          <div className="flex items-center gap-1 bg-[#1A1A22] p-1 rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === "all"
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === "active"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Ativos
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("inactive")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === "inactive"
                  ? "bg-zinc-700/50 text-zinc-300"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Inativos
            </button>
          </div>
        </div>
      </div>

      {/* Combos Grid / List */}
      {filteredCombos.length === 0 ? (
        <div className="bg-[#13131A] border border-white/5 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-600 mb-1">
            <Boxes className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-white">Nenhuma oferta encontrada</h3>
          <p className="text-xs text-zinc-400 max-w-sm">
            {searchTerm || statusFilter !== "all" || typeFilter !== "all"
              ? "Nenhuma oferta corresponde aos filtros atuais. Tente ajustar a busca."
              : "Você ainda não criou nenhuma oferta ou combo. Comece agora para alavancar suas vendas!"}
          </p>
          {!searchTerm && statusFilter === "all" && typeFilter === "all" && (
            <Button
              onClick={handleOpenCreate}
              className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 h-9 rounded-xl"
            >
              Criar Primeira Oferta
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCombos.map((combo) => {
            const isActive = combo.status === "active";
            const isProgressive = combo.type === "progressive";
            const isLoading = loadingActionId === combo.id;

            return (
              <div
                key={combo.id}
                className={`bg-[#13131A] border rounded-2xl overflow-hidden flex flex-col transition-all group ${
                  isProgressive
                    ? "border-purple-500/20 hover:border-purple-500/40"
                    : "border-white/5 hover:border-white/10"
                }`}
              >
                {/* Header Image & Badges */}
                <div className="relative h-36 bg-[#1A1A22] overflow-hidden flex items-center justify-center border-b border-white/5">
                  {combo.coverUrl ? (
                    <img
                      src={combo.coverUrl}
                      alt={combo.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-zinc-600">
                      {isProgressive ? (
                        <>
                          <TrendingUp className="w-10 h-10 text-purple-400/60 stroke-[1.5]" />
                          <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400/60">
                            Oferta Progressiva
                          </span>
                        </>
                      ) : (
                        <>
                          <Boxes className="w-10 h-10 stroke-[1.5]" />
                          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-600">
                            Combo Tradicional
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-md border ${
                        isActive
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : "bg-zinc-800/80 text-zinc-400 border-white/10"
                      }`}
                    >
                      {isActive ? "Ativo" : "Inativo"}
                    </span>

                    {/* Type Badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-md border ${
                        isProgressive
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      }`}
                    >
                      {isProgressive ? "Progressiva" : "Combo"}
                    </span>
                  </div>

                  {/* Savings Pill for Curated Combos */}
                  {!isProgressive && combo.savingsPercentage > 0 && (
                    <div className="absolute top-3 right-3">
                      <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500 text-black shadow-lg">
                        {combo.savingsPercentage}% OFF
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="font-bold text-white text-base leading-snug line-clamp-1">
                      {combo.title}
                    </h3>
                    <p className="text-[11px] font-mono text-zinc-500 mt-0.5 truncate">
                      /{combo.slug}
                    </p>

                    {combo.description && (
                      <p className="text-xs text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                        {combo.description}
                      </p>
                    )}

                    {/* Progressive Offer Tiers Display */}
                    {isProgressive ? (
                      <div className="mt-3 pt-3 border-t border-purple-500/20 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-purple-300 uppercase tracking-wider">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            <span>Faixas de Desconto</span>
                          </span>
                          <span className="text-zinc-500">
                            {combo.eligibilityMode === "all_products"
                              ? "Toda a Loja"
                              : `${combo.products.length} produtos`}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                          {combo.tiers && combo.tiers.length > 0 ? (
                            combo.tiers.map((t, idx) => (
                              <div
                                key={idx}
                                className="px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center gap-1.5"
                              >
                                <span className="font-bold">{t.minQuantity} un:</span>
                                <span className="text-white font-mono">
                                  R$ {parseFloat(String(t.price)).toFixed(2)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-zinc-500 italic">Nenhuma faixa cadastrada</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Component Products Summary for Curated Combo */
                      <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          <span>Produtos Inclusos</span>
                          <span className="text-zinc-500">{combo.products.length} itens</span>
                        </div>
                        <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                          {combo.products.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-[#16161E] border border-white/5"
                            >
                              <span className="text-zinc-300 truncate max-w-[180px] text-[11px]">
                                {p.title}
                              </span>
                              <span className="text-zinc-500 text-[10px] font-semibold shrink-0">
                                R$ {parseFloat(p.price).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pricing / Tiers Footer Block */}
                  <div className="pt-3 border-t border-white/5">
                    {isProgressive ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
                            Regra da Oferta
                          </span>
                          <span className="text-xs font-bold text-purple-300">
                            {combo.eligibilityMode === "all_products"
                              ? "Válido p/ todos os produtos"
                              : "Válido p/ produtos marcados"}
                          </span>
                        </div>
                        <div className="text-[11px] text-purple-300/90 font-medium flex items-center justify-between bg-purple-500/10 px-2.5 py-1.5 rounded-lg border border-purple-500/20">
                          <span>Desconto Progressivo:</span>
                          <span className="font-bold text-white">Calculado no Carrinho</span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline justify-between">
                          <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                              Preço Normal
                            </span>
                            <span className="text-xs line-through text-zinc-500 font-semibold">
                              R$ {combo.normalPrice.toFixed(2)}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                              Preço Promocional
                            </span>
                            <span className="text-lg font-black text-emerald-400">
                              R$ {parseFloat(combo.price).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-1 text-[11px] text-emerald-400/90 font-medium flex items-center justify-between bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                          <span>Economia do cliente:</span>
                          <span className="font-bold">R$ {combo.savings.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                        onClick={() => handleToggleStatus(combo.id)}
                        className={`h-8 text-[11px] rounded-lg border-white/5 font-medium transition-colors ${
                          isActive
                            ? "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                            : isProgressive
                            ? "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border-purple-500/20"
                            : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20"
                        }`}
                      >
                        <Power className="w-3 h-3 mr-1" />
                        {isActive ? "Pausar" : "Ativar"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                        onClick={() => handleOpenEdit(combo)}
                        className="h-8 text-[11px] rounded-lg bg-[#1A1A22] border-white/5 text-zinc-300 hover:bg-white/5 hover:text-white font-medium"
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        Editar
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                        onClick={() => handleDeleteCombo(combo)}
                        className="h-8 text-[11px] rounded-lg bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 font-medium"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Creation / Edition Modal */}
      <ComboModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        comboToEdit={comboToEdit}
        activeProducts={activeProducts}
        onSuccess={refreshCombos}
      />
    </div>
  );
}
