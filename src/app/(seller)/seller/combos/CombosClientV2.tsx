"use client";

import { useState, useMemo, useRef } from "react";
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
  Layers,
  Power,
  Tag,
  LayoutGrid,
  List,
  RotateCcw,
  Upload,
  Link as LinkIcon,
  Eye,
  EyeOff,
  Check,
  Percent,
  DollarSign,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  Toolbar,
  SearchInput,
  Button,
  IconButton,
  Card,
  Chip,
  RowMenu,
  EmptyState,
  ConfirmDialog,
  Toast,
  SegmentedControl,
} from "@/components/seller-v2";
import {
  ComboItem,
  ComboType,
  EligibilityMode,
  TierInput,
  toggleComboStatusAction,
  deleteComboAction,
  getCombosAction,
  createComboAction,
  updateComboAction,
} from "./actions";

export interface ActiveProduct {
  id: string;
  title: string;
  price: string;
  coverUrl: string | null;
  status: string;
}

export interface CombosClientV2Props {
  initialCombos: ComboItem[];
  activeProducts: ActiveProduct[];
  storeSlug: string;
  hideHeader?: boolean;
}

interface EditableTier {
  id?: string;
  minQuantity: number;
  price: string;
}

export default function CombosClientV2({
  initialCombos,
  activeProducts,
  storeSlug,
  hideHeader = false,
}: CombosClientV2Props) {
  // Lista de combos e estado de dados
  const [combosList, setCombosList] = useState<ComboItem[]>(initialCombos);

  // Filtros e busca
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "curated" | "progressive">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Estado de Ações e Feedback
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [comboToDelete, setComboToDelete] = useState<ComboItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [comboToEdit, setComboToEdit] = useState<ComboItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Formulário do Modal
  const [comboType, setComboType] = useState<ComboType>("curated");
  const [eligibilityMode, setEligibilityMode] = useState<EligibilityMode>("all_products");
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [formDescription, setFormDescription] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [imageInputMode, setImageInputMode] = useState<"upload" | "url">("upload");
  const [formStatus, setFormStatus] = useState<"active" | "inactive">("active");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [formPromoPrice, setFormPromoPrice] = useState("");
  const [tiers, setTiers] = useState<EditableTier[]>([
    { minQuantity: 3, price: "12.00" },
    { minQuantity: 5, price: "18.00" },
  ]);
  const [modalProductSearch, setModalProductSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Atualizar lista após mutações
  const refreshCombos = async () => {
    try {
      const updated = await getCombosAction();
      setCombosList(updated);
    } catch (err: any) {
      console.error("Erro ao atualizar lista de combos:", err);
    }
  };

  // Métricas para StatCards
  const stats = useMemo(() => {
    const total = combosList.length;
    const active = combosList.filter((c) => c.status === "active").length;
    const inactive = combosList.filter((c) => c.status === "inactive").length;
    const progressive = combosList.filter((c) => c.type === "progressive").length;
    const curated = combosList.filter((c) => c.type === "curated" || !c.type).length;
    return { total, active, inactive, progressive, curated };
  }, [combosList]);

  // Contagem de filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (typeFilter !== "all") count++;
    if (statusFilter !== "all") count++;
    return count;
  }, [searchQuery, typeFilter, statusFilter]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
  };

  // Filtragem dos Combos
  const filteredCombos = useMemo(() => {
    return combosList.filter((combo) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        combo.title.toLowerCase().includes(query) ||
        combo.slug.toLowerCase().includes(query) ||
        combo.products.some((p) => p.title.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "all" ? true : combo.status === statusFilter;

      const matchesType =
        typeFilter === "all" ? true : (combo.type || "curated") === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [combosList, searchQuery, typeFilter, statusFilter]);

  // Abertura do Modal de Criação
  const openCreateModal = () => {
    setComboToEdit(null);
    setComboType("curated");
    setEligibilityMode("all_products");
    setFormTitle("");
    setFormSlug("");
    setSlugManuallyEdited(false);
    setFormDescription("");
    setFormImageUrl("");
    setImageInputMode("upload");
    setFormStatus("active");
    setSelectedProductIds([]);
    setFormPromoPrice("");
    setTiers([
      { minQuantity: 3, price: "12.00" },
      { minQuantity: 5, price: "18.00" },
    ]);
    setModalProductSearch("");
    setModalError(null);
    setIsModalOpen(true);
  };

  // Abertura do Modal de Edição
  const openEditModal = (combo: ComboItem) => {
    setComboToEdit(combo);
    setComboType(combo.type || "curated");
    setEligibilityMode(combo.eligibilityMode || "all_products");
    setFormTitle(combo.title);
    setFormSlug(combo.slug);
    setSlugManuallyEdited(true);
    setFormDescription(combo.description || "");
    setFormImageUrl(combo.coverUrl || "");
    setImageInputMode(combo.coverUrl?.startsWith("data:") ? "upload" : "url");
    setFormStatus((combo.status as "active" | "inactive") || "active");
    setSelectedProductIds(combo.products.map((p) => p.id));
    setFormPromoPrice(parseFloat(combo.price || "0").toFixed(2));

    if (combo.tiers && combo.tiers.length > 0) {
      setTiers(
        combo.tiers.map((t) => ({
          id: t.id,
          minQuantity: t.minQuantity,
          price: parseFloat(String(t.price)).toFixed(2),
        }))
      );
    } else {
      setTiers([
        { minQuantity: 3, price: "12.00" },
        { minQuantity: 5, price: "18.00" },
      ]);
    }
    setModalProductSearch("");
    setModalError(null);
    setIsModalOpen(true);
  };

  // Geração automática de slug a partir do título
  const handleTitleChange = (val: string) => {
    setFormTitle(val);
    if (!slugManuallyEdited) {
      const generated = val
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      setFormSlug(generated);
    }
  };

  // Manipulação de Upload de Imagem no Modal
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setModalError("A imagem da promoção deve ter no máximo 5MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setFormImageUrl((event.target?.result as string) || "");
      setModalError(null);
    };
    reader.readAsDataURL(file);
  };

  // Alternar produto selecionado
  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  // Manipulação de Tiers (Faixas Progressivas)
  const handleAddTier = () => {
    const maxQty = tiers.reduce((max, t) => (t.minQuantity > max ? t.minQuantity : max), 2);
    setTiers([...tiers, { minQuantity: maxQty + 2, price: "" }]);
  };

  const handleRemoveTier = (index: number) => {
    if (tiers.length <= 1) {
      setModalError("A oferta progressiva deve conter pelo menos uma faixa configurada.");
      return;
    }
    setTiers(tiers.filter((_, i) => i !== index));
    setModalError(null);
  };

  const handleTierChange = (index: number, field: "minQuantity" | "price", val: string) => {
    setModalError(null);
    setTiers((prev) =>
      prev.map((tier, i) => {
        if (i !== index) return tier;
        if (field === "minQuantity") {
          const parsed = parseInt(val, 10);
          return { ...tier, minQuantity: isNaN(parsed) ? 0 : parsed };
        } else {
          return { ...tier, price: val };
        }
      })
    );
  };

  // Cálculos financeiros em tempo real para Curated Combo
  const modalSelectedProducts = activeProducts.filter((p) =>
    selectedProductIds.includes(p.id)
  );

  const modalNormalPrice = modalSelectedProducts.reduce(
    (sum, p) => sum + parseFloat(p.price || "0"),
    0
  );

  const parsedPromoPrice = parseFloat(formPromoPrice.replace(",", ".")) || 0;
  const modalSavings = Math.max(0, modalNormalPrice - parsedPromoPrice);
  const modalSavingsPercentage =
    modalNormalPrice > 0 && parsedPromoPrice > 0 && parsedPromoPrice < modalNormalPrice
      ? Math.round((modalSavings / modalNormalPrice) * 100)
      : 0;

  // Validação do Formulário
  const validateForm = (): string | null => {
    if (!formTitle.trim()) {
      return "O nome da promoção/combo é obrigatório.";
    }

    if (comboType === "curated") {
      if (selectedProductIds.length < 2) {
        return "Selecione pelo menos 2 produtos para compor o combo tradicional fixo.";
      }
      if (isNaN(parsedPromoPrice) || parsedPromoPrice <= 0) {
        return "Informe um preço promocional válido e maior que zero.";
      }
      if (parsedPromoPrice >= modalNormalPrice) {
        return `O preço promocional (R$ ${parsedPromoPrice.toFixed(2)}) deve ser estritamente menor que a soma dos produtos (R$ ${modalNormalPrice.toFixed(2)}).`;
      }
    } else {
      if (tiers.length === 0) {
        return "Adicione pelo menos uma faixa de desconto configurada.";
      }

      const seenQuantities = new Set<number>();
      for (let i = 0; i < tiers.length; i++) {
        const t = tiers[i];
        if (!t.minQuantity || t.minQuantity < 2) {
          return `A faixa #${i + 1} deve ter quantidade mínima de pelo menos 2 itens.`;
        }
        if (seenQuantities.has(t.minQuantity)) {
          return `A quantidade ${t.minQuantity} unidades está duplicada nas faixas.`;
        }
        seenQuantities.add(t.minQuantity);

        const priceNum = parseFloat(String(t.price).replace(",", "."));
        if (isNaN(priceNum) || priceNum <= 0) {
          return `Informe um preço válido e maior que zero para a faixa de ${t.minQuantity} itens.`;
        }
      }

      if (eligibilityMode === "specific_products" && selectedProductIds.length === 0) {
        return "No modo 'Produtos selecionados', escolha pelo menos 1 produto participante.";
      }
    }

    return null;
  };

  // Submissão do Formulário (Salvar)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const validationErr = validateForm();
    if (validationErr) {
      setModalError(validationErr);
      return;
    }

    setIsSaving(true);
    try {
      if (comboType === "curated") {
        const payload = {
          title: formTitle.trim(),
          slug: formSlug.trim(),
          description: formDescription.trim() || null,
          coverUrl: formImageUrl.trim() || null,
          price: parsedPromoPrice,
          productIds: selectedProductIds,
          status: formStatus,
          type: "curated" as const,
          eligibilityMode: "specific_products" as const,
        };

        if (comboToEdit) {
          await updateComboAction(comboToEdit.id, payload);
          setToast({ type: "success", message: `Combo "${formTitle}" atualizado com sucesso.` });
        } else {
          await createComboAction(payload);
          setToast({ type: "success", message: `Combo "${formTitle}" criado com sucesso.` });
        }
      } else {
        const formattedTiers: TierInput[] = tiers.map((t) => ({
          minQuantity: t.minQuantity,
          price: parseFloat(String(t.price).replace(",", ".")),
        }));

        const payload = {
          title: formTitle.trim(),
          slug: formSlug.trim(),
          description: formDescription.trim() || null,
          coverUrl: formImageUrl.trim() || null,
          status: formStatus,
          type: "progressive" as const,
          eligibilityMode,
          tiers: formattedTiers,
          productIds: eligibilityMode === "specific_products" ? selectedProductIds : [],
        };

        if (comboToEdit) {
          await updateComboAction(comboToEdit.id, payload);
          setToast({ type: "success", message: `Oferta progressiva "${formTitle}" atualizada com sucesso.` });
        } else {
          await createComboAction(payload);
          setToast({ type: "success", message: `Oferta progressiva "${formTitle}" criada com sucesso.` });
        }
      }

      await refreshCombos();
      setIsModalOpen(false);
    } catch (err: any) {
      setModalError(err.message || "Erro ao salvar oferta.");
    } finally {
      setIsSaving(false);
    }
  };

  // Alternar Status (Ativar / Desativar)
  const handleToggleStatus = async (combo: ComboItem) => {
    setLoadingActionId(combo.id);
    try {
      const res = await toggleComboStatusAction(combo.id);
      if (res.success) {
        setCombosList((prev) =>
          prev.map((c) => (c.id === combo.id ? { ...c, status: res.status } : c))
        );
        setToast({
          type: "success",
          message: `Oferta "${combo.title}" ${res.status === "active" ? "ativada" : "pausada"} com sucesso.`,
        });
      }
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "Erro ao alterar status da oferta.",
      });
    } finally {
      setLoadingActionId(null);
    }
  };

  // Confirmar Exclusão
  const handleConfirmDelete = async () => {
    if (!comboToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteComboAction(comboToDelete.id);
      if (res.success) {
        setCombosList((prev) => prev.filter((c) => c.id !== comboToDelete.id));
        setToast({
          type: "success",
          message: res.message || `Oferta "${comboToDelete.title}" excluída com sucesso.`,
        });
        setComboToDelete(null);
      }
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "Erro ao excluir oferta.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtro de produtos no modal
  const filteredModalProducts = activeProducts.filter((p) =>
    p.title.toLowerCase().includes(modalProductSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 w-full min-w-0 pb-16">
      {/* 1. Header Padronizado V2 */}
      {!hideHeader && (
        <PageHeader
          title="Combos e Ofertas"
          subtitle="Crie combos de produtos ou descontos progressivos para aumentar o ticket médio e impulsionar vendas."
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {stats.total} {stats.total === 1 ? "oferta cadastrada" : "ofertas cadastradas"}
            </span>
          }
          actions={
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
              onClick={openCreateModal}
            >
              Nova oferta
            </Button>
          }
        />
      )}

      {/* 2. Métricas / StatCards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total de Promoções"
          value={stats.total}
          accent="blue"
          icon={<Boxes className="w-5 h-5" />}
          subtext={`${stats.curated} combos fixos cadastrados`}
        />
        <StatCard
          label="Ofertas Ativas"
          value={stats.active}
          accent="green"
          icon={<CheckCircle2 className="w-5 h-5" />}
          subtext="Exibidas no bot e mini app"
        />
        <StatCard
          label="Ofertas Pausadas"
          value={stats.inactive}
          accent="zinc"
          icon={<EyeOff className="w-5 h-5" />}
          subtext="Ocultas temporariamente"
        />
        <StatCard
          label="Ofertas Progressivas"
          value={stats.progressive}
          accent="purple"
          icon={<TrendingUp className="w-5 h-5" />}
          subtext="Compre mais e pague menos"
        />
      </div>

      {/* 3. Toolbar Completa */}
      <Toolbar
        searchSlot={
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery("")}
            placeholder={`Buscar em ${combosList.length} ofertas por nome, slug ou produto...`}
          />
        }
        filterSlot={
          <>
            {/* Filtro por Tipo */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              aria-label="Filtrar por Tipo de Oferta"
              className="h-10 bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-xs text-[#f4f4f5] rounded-xl px-3 transition-colors outline-none cursor-pointer"
            >
              <option value="all">Todos os Tipos</option>
              <option value="curated">Combos Fixos</option>
              <option value="progressive">Ofertas Progressivas</option>
            </select>

            {/* Filtro por Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              aria-label="Filtrar por Status"
              className="h-10 bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-xs text-[#f4f4f5] rounded-xl px-3 transition-colors outline-none cursor-pointer"
            >
              <option value="all">Todos os Status</option>
              <option value="active">Ativas</option>
              <option value="inactive">Pausadas</option>
            </select>

            {/* Botão Limpar Filtros */}
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                leftIcon={<RotateCcw className="w-3.5 h-3.5 text-[#9a9aa2]" />}
                className="text-xs text-[#9a9aa2] hover:text-[#f4f4f5]"
              >
                Limpar ({activeFiltersCount})
              </Button>
            )}
          </>
        }
        actionSlot={
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#71717a] tabular-nums hidden sm:inline-block">
              {filteredCombos.length} de {combosList.length}
            </span>
            <div className="flex items-center bg-[#16161a] p-1 rounded-xl border border-[#26262a]">
              <IconButton
                size="sm"
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                icon={<LayoutGrid className="w-4 h-4" />}
                aria-label="Visualização em Grade"
                onClick={() => setViewMode("grid")}
                className={viewMode === "grid" ? "bg-[#26262a] text-white" : "text-[#71717a]"}
              />
              <IconButton
                size="sm"
                variant={viewMode === "list" ? "secondary" : "ghost"}
                icon={<List className="w-4 h-4" />}
                aria-label="Visualização em Lista"
                onClick={() => setViewMode("list")}
                className={viewMode === "list" ? "bg-[#26262a] text-white" : "text-[#71717a]"}
              />
            </div>
          </div>
        }
      />

      {/* 4. Conteúdo: Grade, Lista ou Estado Vazio */}
      {filteredCombos.length === 0 ? (
        <EmptyState
          icon={combosList.length === 0 ? <Boxes className="w-8 h-8" /> : <Search className="w-8 h-8" />}
          title={combosList.length === 0 ? "Nenhuma oferta cadastrada" : "Nenhuma oferta encontrada"}
          description={
            combosList.length === 0
              ? "Crie seu primeiro combo tradicional ou oferta progressiva para incentivar seus clientes a comprarem mais produtos juntos."
              : "Nenhuma oferta corresponde aos filtros de busca aplicados. Tente ajustar os termos ou limpar os filtros."
          }
          action={
            combosList.length === 0
              ? {
                  label: "Nova oferta",
                  icon: <Plus className="w-4 h-4" />,
                  onClick: openCreateModal,
                }
              : {
                  label: "Limpar filtros",
                  icon: <RotateCcw className="w-4 h-4" />,
                  onClick: handleClearFilters,
                }
          }
        />
      ) : viewMode === "grid" ? (
        /* Visualização em Grade */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCombos.map((combo) => {
            const isProgressive = combo.type === "progressive";
            const isActive = combo.status === "active";

            const menuItems = [
              {
                id: "edit",
                label: "Editar oferta",
                icon: <Edit2 className="w-4 h-4 text-[#9a9aa2]" />,
                onClick: () => openEditModal(combo),
              },
              {
                id: "toggle",
                label: isActive ? "Pausar oferta" : "Ativar oferta",
                icon: <Power className="w-4 h-4 text-[#9a9aa2]" />,
                onClick: () => handleToggleStatus(combo),
              },
              {
                id: "delete",
                label: "Excluir oferta",
                icon: <Trash2 className="w-4 h-4 text-[#f87171]" />,
                danger: true,
                onClick: () => setComboToDelete(combo),
              },
            ];

            return (
              <Card
                key={combo.id}
                padding="none"
                interactive
                className="flex flex-col justify-between overflow-hidden group space-y-0"
              >
                {/* Banner / Imagem do Combo */}
                <div className="relative aspect-[16/9] w-full bg-[#16161a] overflow-hidden border-b border-[#26262a]">
                  {combo.coverUrl ? (
                    <img
                      src={combo.coverUrl}
                      alt={combo.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#71717a] gap-2 p-4">
                      {isProgressive ? (
                        <TrendingUp className="w-8 h-8 text-purple-400/50" />
                      ) : (
                        <Boxes className="w-8 h-8 text-emerald-400/50" />
                      )}
                      <span className="text-xs text-[#9a9aa2] text-center font-medium line-clamp-1">
                        {combo.title}
                      </span>
                    </div>
                  )}

                  {/* Badges Superiores */}
                  <div className="absolute top-2.5 left-2.5 z-10 flex flex-wrap items-center gap-1.5">
                    {/* Badge de Tipo */}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-md border ${
                        isProgressive
                          ? "bg-purple-950/80 text-purple-300 border-purple-500/30"
                          : "bg-emerald-950/80 text-emerald-300 border-emerald-500/30"
                      }`}
                    >
                      {isProgressive ? "Oferta Progressiva" : "Combo Fixo"}
                    </span>

                    {/* Desconto / Economia */}
                    {!isProgressive && combo.savingsPercentage > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-black text-[10px] font-extrabold shadow-sm">
                        -{combo.savingsPercentage}%
                      </span>
                    )}
                  </div>

                  {/* Status no Canto Direito */}
                  <div className="absolute top-2.5 right-2.5 z-10">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-md border ${
                        isActive
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-zinc-900/80 text-zinc-400 border-zinc-700/50"
                      }`}
                    >
                      {isActive ? "Ativa" : "Pausada"}
                    </span>
                  </div>
                </div>

                {/* Conteúdo do Card */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    {/* Título & Slug */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3
                          className="text-sm font-semibold text-[#f4f4f5] truncate tracking-tight group-hover:text-white transition-colors"
                          title={combo.title}
                        >
                          {combo.title}
                        </h3>
                        <p className="text-[11px] text-[#71717a] font-mono truncate mt-0.5">
                          /{combo.slug}
                        </p>
                      </div>
                    </div>

                    {/* Descrição se houver */}
                    {combo.description && (
                      <p className="text-xs text-[#9a9aa2] line-clamp-2 mt-2 leading-relaxed">
                        {combo.description}
                      </p>
                    )}

                    {/* Preços e Condições */}
                    <div className="mt-3.5 p-3 rounded-xl bg-[#16161a] border border-[#26262a]">
                      {!isProgressive ? (
                        <div className="flex items-baseline justify-between gap-2">
                          <div>
                            <span className="text-[10px] uppercase font-semibold tracking-wider text-[#71717a] block">
                              Preço Promocional
                            </span>
                            <span className="text-lg font-bold text-emerald-400 tabular-nums">
                              R$ {parseFloat(combo.price || "0").toFixed(2)}
                            </span>
                          </div>
                          {combo.normalPrice > 0 && (
                            <div className="text-right">
                              <span className="text-[10px] uppercase font-semibold tracking-wider text-[#71717a] block">
                                De:
                              </span>
                              <span className="text-xs line-through text-[#71717a] tabular-nums">
                                R$ {combo.normalPrice.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[10px] uppercase font-semibold tracking-wider text-purple-400">
                              Desconto Progressivo
                            </span>
                            <span className="text-[11px] text-[#9a9aa2] tabular-nums">
                              {combo.eligibilityMode === "all_products"
                                ? "Toda a loja"
                                : `${combo.products.length} selecionados`}
                            </span>
                          </div>
                          {combo.tiers && combo.tiers.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {combo.tiers.map((t, i) => {
                                const total = parseFloat(String(t.price)) || 0;
                                const qty = t.minQuantity || 1;
                                const brl = (v: number) =>
                                  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                                return (
                                  <span
                                    key={i}
                                    className="flex flex-col px-2.5 py-1.5 rounded-lg bg-[#222228] border border-[#2e2e34] text-[11px] text-[#a1a1aa] tabular-nums"
                                  >
                                    <span>
                                      {qty} por <b className="text-[#f4f4f5]">{brl(total)}</b>
                                    </span>
                                    <span className="text-purple-300">{brl(total / qty)} cada</span>
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-xs text-[#71717a]">Faixas não configuradas</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Produtos Inclusos */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-[#71717a] mb-1.5">
                        <span>Produtos participantes</span>
                        <span className="font-semibold text-[#9a9aa2] tabular-nums">
                          {combo.products.length} itens
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        {combo.products.slice(0, 4).map((p) => (
                          <div
                            key={p.id}
                            title={`${p.title} (R$ ${parseFloat(p.price || "0").toFixed(2)})`}
                            className="w-7 h-7 rounded-lg bg-[#26262a] border border-[#3a3a40] overflow-hidden shrink-0 flex items-center justify-center text-[9px] font-bold text-[#9a9aa2]"
                          >
                            {p.coverUrl ? (
                              <img src={p.coverUrl} alt={p.title} className="w-full h-full object-cover" />
                            ) : (
                              <span>{p.title.charAt(0)}</span>
                            )}
                          </div>
                        ))}
                        {combo.products.length > 4 && (
                          <span className="text-[10px] text-[#71717a] font-medium">
                            +{combo.products.length - 4} mais
                          </span>
                        )}
                        {combo.products.length === 0 && combo.eligibilityMode === "all_products" && (
                          <span className="text-[11px] text-[#9a9aa2] italic">
                            Aplicável em todos os produtos da loja
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações do Card */}
                  <div className="pt-3 border-t border-[#26262a] flex items-center justify-between gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                      onClick={() => openEditModal(combo)}
                      className="text-xs"
                    >
                      Editar
                    </Button>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(combo)}
                        disabled={loadingActionId === combo.id}
                        className={`text-xs ${
                          isActive
                            ? "text-[#9a9aa2] hover:text-[#f4f4f5]"
                            : "text-emerald-400 hover:text-emerald-300"
                        }`}
                      >
                        {isActive ? "Pausar" : "Ativar"}
                      </Button>

                      <RowMenu
                        items={menuItems}
                        ariaLabel={`Ações para oferta ${combo.title}`}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Visualização em Lista / Tabela */
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#26262a] bg-[#121215] text-[11px] font-semibold text-[#71717a] uppercase tracking-wider">
                  <th className="py-3 px-4">Oferta</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Preço / Condição</th>
                  <th className="py-3 px-4">Produtos</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#26262a] text-xs">
                {filteredCombos.map((combo) => {
                  const isProgressive = combo.type === "progressive";
                  const isActive = combo.status === "active";

                  const menuItems = [
                    {
                      id: "edit",
                      label: "Editar oferta",
                      icon: <Edit2 className="w-4 h-4 text-[#9a9aa2]" />,
                      onClick: () => openEditModal(combo),
                    },
                    {
                      id: "toggle",
                      label: isActive ? "Pausar oferta" : "Ativar oferta",
                      icon: <Power className="w-4 h-4 text-[#9a9aa2]" />,
                      onClick: () => handleToggleStatus(combo),
                    },
                    {
                      id: "delete",
                      label: "Excluir oferta",
                      icon: <Trash2 className="w-4 h-4 text-[#f87171]" />,
                      danger: true,
                      onClick: () => setComboToDelete(combo),
                    },
                  ];

                  return (
                    <tr
                      key={combo.id}
                      className="hover:bg-[#16161a] transition-colors group"
                    >
                      {/* Oferta: Miniatura e Título */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-[#16161a] border border-[#26262a] overflow-hidden shrink-0 flex items-center justify-center">
                            {combo.coverUrl ? (
                              <img
                                src={combo.coverUrl}
                                alt={combo.title}
                                className="w-full h-full object-cover"
                              />
                            ) : isProgressive ? (
                              <TrendingUp className="w-5 h-5 text-purple-400" />
                            ) : (
                              <Boxes className="w-5 h-5 text-emerald-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-[#f4f4f5] truncate block">
                              {combo.title}
                            </span>
                            <span className="text-[11px] text-[#71717a] font-mono">
                              /{combo.slug}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                            isProgressive
                              ? "bg-purple-950/60 text-purple-300 border-purple-500/30"
                              : "bg-emerald-950/60 text-emerald-300 border-emerald-500/30"
                          }`}
                        >
                          {isProgressive ? "Progressiva" : "Combo Fixo"}
                        </span>
                      </td>

                      {/* Preço / Condição */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {!isProgressive ? (
                          <div>
                            <span className="font-bold text-emerald-400 tabular-nums">
                              R$ {parseFloat(combo.price || "0").toFixed(2)}
                            </span>
                            {combo.normalPrice > 0 && (
                              <span className="text-[11px] line-through text-[#71717a] ml-2 tabular-nums">
                                R$ {combo.normalPrice.toFixed(2)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] text-[#9a9aa2] tabular-nums">
                            {combo.tiers?.length || 0} faixas configuradas
                          </div>
                        )}
                      </td>

                      {/* Produtos */}
                      <td className="py-3 px-4 whitespace-nowrap text-[#9a9aa2]">
                        {combo.eligibilityMode === "all_products"
                          ? "Todos da loja"
                          : `${combo.products.length} selecionados`}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            isActive
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : "bg-zinc-800 text-zinc-400 border-zinc-700"
                          }`}
                        >
                          {isActive ? "Ativa" : "Pausada"}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            size="sm"
                            variant="ghost"
                            icon={<Edit2 className="w-3.5 h-3.5" />}
                            aria-label={`Editar ${combo.title}`}
                            onClick={() => openEditModal(combo)}
                          />
                          <RowMenu
                            items={menuItems}
                            ariaLabel={`Ações para oferta ${combo.title}`}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 5. Modal de Criação e Edição V2 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121215] border border-[#26262a] w-full max-w-2xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header do Modal */}
            <div className="px-5 py-4 border-b border-[#26262a] flex items-center justify-between bg-[#16161a]">
              <div>
                <h3 className="text-base font-bold text-[#f4f4f5]">
                  {comboToEdit ? "Editar Oferta" : "Nova Oferta / Promoção"}
                </h3>
                <p className="text-xs text-[#9a9aa2] mt-0.5">
                  Configure os detalhes da oferta para impulsionar suas vendas.
                </p>
              </div>
              <IconButton
                size="sm"
                variant="ghost"
                icon={<XCircle className="w-5 h-5 text-[#9a9aa2] hover:text-white" />}
                aria-label="Fechar modal"
                onClick={() => setIsModalOpen(false)}
              />
            </div>

            {/* Formulário com scroll */}
            <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto p-5 space-y-5">
              {modalError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Seletor de Tipo de Oferta */}
              <div>
                <label className="text-xs font-semibold text-[#f4f4f5] block mb-2">
                  Tipo de Oferta
                </label>
                <SegmentedControl
                  value={comboType}
                  onChange={(val) => setComboType(val as ComboType)}
                  options={[
                    { id: "curated", label: "Combo Tradicional Fixo" },
                    { id: "progressive", label: "Oferta Progressiva" },
                  ]}
                />
                <p className="text-[11px] text-[#71717a] mt-1.5">
                  {comboType === "curated"
                    ? "Agrupa produtos específicos vendidos juntos por um preço total promocional único."
                    : "Concede descontos progressivos escalonados conforme a quantidade adquirida (Compre Mais, Pague Menos)."}
                </p>
              </div>

              {/* Nome e Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-[#f4f4f5] block mb-1.5">
                    Nome da Promoção <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Ex: Combo Especial Gamer"
                    className="w-full h-10 bg-[#16161a] border border-[#26262a] focus:border-[#3b82f6] text-xs text-[#f4f4f5] rounded-xl px-3 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#f4f4f5] block mb-1.5">
                    Slug da URL <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formSlug}
                    onChange={(e) => {
                      setFormSlug(e.target.value);
                      setSlugManuallyEdited(true);
                    }}
                    placeholder="combo-especial-gamer"
                    className="w-full h-10 bg-[#16161a] border border-[#26262a] focus:border-[#3b82f6] text-xs text-[#f4f4f5] font-mono rounded-xl px-3 outline-none"
                  />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="text-xs font-semibold text-[#f4f4f5] block mb-1.5">
                  Descrição (opcional)
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder="Explique o benefício do combo para seus compradores..."
                  className="w-full bg-[#16161a] border border-[#26262a] focus:border-[#3b82f6] text-xs text-[#f4f4f5] rounded-xl p-3 outline-none resize-none"
                />
              </div>

              {/* Imagem do Combo */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-[#f4f4f5]">
                    Capa da Promoção
                  </label>
                  <div className="flex items-center gap-1 bg-[#16161a] p-0.5 rounded-lg border border-[#26262a]">
                    <button
                      type="button"
                      onClick={() => setImageInputMode("upload")}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        imageInputMode === "upload" ? "bg-[#26262a] text-white" : "text-[#71717a]"
                      }`}
                    >
                      Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageInputMode("url")}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        imageInputMode === "url" ? "bg-[#26262a] text-white" : "text-[#71717a]"
                      }`}
                    >
                      URL
                    </button>
                  </div>
                </div>

                {imageInputMode === "upload" ? (
                  <div className="border border-dashed border-[#26262a] hover:border-[#3b82f6]/50 rounded-xl p-4 text-center bg-[#16161a] transition-colors">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="combo-image-upload"
                    />
                    <label
                      htmlFor="combo-image-upload"
                      className="cursor-pointer flex flex-col items-center gap-1.5 text-xs text-[#9a9aa2]"
                    >
                      <Upload className="w-5 h-5 text-[#3b82f6]" />
                      <span className="font-medium text-[#f4f4f5]">
                        Clique para escolher a imagem (máx 5MB)
                      </span>
                      <span className="text-[10px] text-[#71717a]">
                        PNG, JPG, WebP em proporção 16:9 recomendada
                      </span>
                    </label>
                  </div>
                ) : (
                  <input
                    type="url"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="https://exemplo.com/imagem-combo.webp"
                    className="w-full h-10 bg-[#16161a] border border-[#26262a] focus:border-[#3b82f6] text-xs text-[#f4f4f5] rounded-xl px-3 outline-none"
                  />
                )}

                {formImageUrl && (
                  <div className="mt-2.5 relative aspect-[16/9] w-full max-w-xs rounded-xl overflow-hidden border border-[#26262a]">
                    <img src={formImageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormImageUrl("")}
                      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/80 text-white hover:bg-black text-[10px]"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>

              {/* Seção Específica: COMBO TRADICIONAL FIXO */}
              {comboType === "curated" && (
                <div className="space-y-4 pt-2 border-t border-[#26262a]">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-[#f4f4f5]">
                        Selecione os Produtos do Combo (mínimo 2) <span className="text-red-400">*</span>
                      </label>
                      <span className="text-xs text-emerald-400 font-semibold tabular-nums">
                        {selectedProductIds.length} selecionados
                      </span>
                    </div>

                    {/* Busca de produtos */}
                    <div className="mb-2">
                      <input
                        type="text"
                        value={modalProductSearch}
                        onChange={(e) => setModalProductSearch(e.target.value)}
                        placeholder="Filtrar produtos disponíveis..."
                        className="w-full h-9 bg-[#16161a] border border-[#26262a] focus:border-[#3b82f6] text-xs text-[#f4f4f5] rounded-xl px-3 outline-none"
                      />
                    </div>

                    {/* Lista com checkbox/seleção */}
                    <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-[#16161a] border border-[#26262a] rounded-xl">
                      {filteredModalProducts.length === 0 ? (
                        <p className="text-xs text-[#71717a] text-center py-4">
                          Nenhum produto ativo encontrado.
                        </p>
                      ) : (
                        filteredModalProducts.map((p) => {
                          const isSelected = selectedProductIds.includes(p.id);
                          return (
                            <div
                              key={p.id}
                              onClick={() => toggleProduct(p.id)}
                              className={`p-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                isSelected
                                  ? "bg-emerald-500/10 border border-emerald-500/30 text-white"
                                  : "hover:bg-[#222228] text-[#9a9aa2]"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                    isSelected
                                      ? "bg-emerald-500 border-emerald-500 text-black"
                                      : "border-[#3a3a40] bg-[#1a1a1e]"
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <span className="text-xs truncate font-medium">{p.title}</span>
                              </div>
                              <span className="text-xs font-semibold tabular-nums shrink-0 text-[#f4f4f5]">
                                R$ {parseFloat(p.price || "0").toFixed(2)}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Resumo Financeiro & Preço Promocional */}
                  <div className="p-4 rounded-xl bg-[#16161a] border border-[#26262a] space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#9a9aa2]">Soma dos preços individuais:</span>
                      <span className="font-bold text-[#f4f4f5] tabular-nums">
                        R$ {modalNormalPrice.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[#f4f4f5] block mb-1.5">
                        Preço Promocional do Combo (R$) <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formPromoPrice}
                        onChange={(e) => setFormPromoPrice(e.target.value)}
                        placeholder="Ex: 49.90"
                        className="w-full h-10 bg-[#121215] border border-[#26262a] focus:border-emerald-500 text-sm font-bold text-emerald-400 rounded-xl px-3 outline-none"
                      />
                    </div>

                    {parsedPromoPrice > 0 && parsedPromoPrice < modalNormalPrice && (
                      <div className="flex items-center justify-between text-xs pt-2 border-t border-[#26262a]">
                        <span className="text-emerald-400 font-semibold">
                          Economia do cliente: R$ {modalSavings.toFixed(2)}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                          -{modalSavingsPercentage}% de desconto
                        </span>
                      </div>
                    )}

                    {parsedPromoPrice >= modalNormalPrice && modalNormalPrice > 0 && (
                      <p className="text-[11px] text-red-400 font-medium">
                        O preço promocional deve ser menor que a soma individual (R$ {modalNormalPrice.toFixed(2)}).
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Seção Específica: OFERTA PROGRESSIVA */}
              {comboType === "progressive" && (
                <div className="space-y-4 pt-2 border-t border-[#26262a]">
                  <div>
                    <label className="text-xs font-semibold text-[#f4f4f5] block mb-1.5">
                      Elegibilidade de Produtos
                    </label>
                    <SegmentedControl
                      value={eligibilityMode}
                      onChange={(val) => setEligibilityMode(val as EligibilityMode)}
                      options={[
                        { id: "all_products", label: "Toda a Loja" },
                        { id: "specific_products", label: "Produtos Específicos" },
                      ]}
                    />
                  </div>

                  {eligibilityMode === "specific_products" && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-[#f4f4f5]">
                          Selecione os Produtos Participantes
                        </label>
                        <span className="text-xs text-purple-400 font-semibold tabular-nums">
                          {selectedProductIds.length} selecionados
                        </span>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-[#16161a] border border-[#26262a] rounded-xl">
                        {filteredModalProducts.map((p) => {
                          const isSelected = selectedProductIds.includes(p.id);
                          return (
                            <div
                              key={p.id}
                              onClick={() => toggleProduct(p.id)}
                              className={`p-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                isSelected
                                  ? "bg-purple-500/10 border border-purple-500/30 text-white"
                                  : "hover:bg-[#222228] text-[#9a9aa2]"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                    isSelected
                                      ? "bg-purple-500 border-purple-500 text-white"
                                      : "border-[#3a3a40] bg-[#1a1a1e]"
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <span className="text-xs truncate font-medium">{p.title}</span>
                              </div>
                              <span className="text-xs font-semibold tabular-nums shrink-0 text-[#f4f4f5]">
                                R$ {parseFloat(p.price || "0").toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Faixas de Desconto (Tiers) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-[#f4f4f5]">
                        Faixas de Desconto Progressivo
                      </label>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        leftIcon={<Plus className="w-3.5 h-3.5" />}
                        onClick={handleAddTier}
                        className="text-xs"
                      >
                        Adicionar faixa
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {tiers.map((t, idx) => {
                        const priceNum = parseFloat(String(t.price).replace(",", ".")) || 0;
                        const perUnit = t.minQuantity > 0 && priceNum > 0 ? (priceNum / t.minQuantity).toFixed(2) : null;

                        return (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-[#16161a] border border-[#26262a] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5"
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-xs font-bold text-purple-400 shrink-0">
                                #{idx + 1}
                              </span>
                              <div className="flex-1">
                                <label className="text-[10px] text-[#71717a] block mb-0.5">
                                  Qtd mínima
                                </label>
                                <input
                                  type="number"
                                  min={2}
                                  value={t.minQuantity}
                                  onChange={(e) =>
                                    handleTierChange(idx, "minQuantity", e.target.value)
                                  }
                                  className="w-full h-8 bg-[#121215] border border-[#26262a] focus:border-purple-500 text-xs text-[#f4f4f5] font-semibold rounded-lg px-2 outline-none"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="text-[10px] text-[#71717a] block mb-0.5">
                                  Preço total da faixa (R$)
                                </label>
                                <input
                                  type="text"
                                  value={t.price}
                                  onChange={(e) =>
                                    handleTierChange(idx, "price", e.target.value)
                                  }
                                  placeholder="Ex: 18.00"
                                  className="w-full h-8 bg-[#121215] border border-[#26262a] focus:border-purple-500 text-xs text-purple-300 font-bold rounded-lg px-2 outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                              {perUnit && (
                                <span className="text-[11px] text-[#9a9aa2]">
                                  (R$ {perUnit}/un)
                                </span>
                              )}
                              <IconButton
                                size="sm"
                                variant="ghost"
                                icon={<Trash2 className="w-3.5 h-3.5 text-[#f87171]" />}
                                aria-label={`Remover faixa ${idx + 1}`}
                                onClick={() => handleRemoveTier(idx)}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="pt-2 border-t border-[#26262a]">
                <label className="text-xs font-semibold text-[#f4f4f5] block mb-1.5">
                  Status Inicial
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-[#f4f4f5]">
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      checked={formStatus === "active"}
                      onChange={() => setFormStatus("active")}
                      className="accent-[#3b82f6]"
                    />
                    <span>Ativa (visível imediatamente)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-[#9a9aa2]">
                    <input
                      type="radio"
                      name="status"
                      value="inactive"
                      checked={formStatus === "inactive"}
                      onChange={() => setFormStatus("inactive")}
                      className="accent-[#3b82f6]"
                    />
                    <span>Pausada (oculta)</span>
                  </label>
                </div>
              </div>

              {/* Rodapé do Modal */}
              <div className="pt-4 border-t border-[#26262a] flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSaving}
                >
                  {isSaving ? "Salvando..." : comboToEdit ? "Salvar alterações" : "Criar oferta"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Diálogo de Confirmação de Exclusão */}
      <ConfirmDialog
        isOpen={Boolean(comboToDelete)}
        title="Excluir Oferta"
        description={`Tem certeza que deseja excluir "${comboToDelete?.title}"? Se a promoção já possuir pedidos registrados, ela será arquivada para preservar seu histórico financeiro.`}
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setComboToDelete(null)}
      />

      {/* 7. Toast Flutuante de Feedback */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
