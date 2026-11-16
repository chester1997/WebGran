"use client";

import React, { useState, useMemo, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Tags,
  Search,
  Image as ImageIcon,
  LayoutGrid,
  Plus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Check,
  CheckCircle2,
  Package,
  Grid,
  List,
  Loader2,
  Upload,
  X,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  Toolbar,
  SearchInput,
  SegmentedControl,
  Chip,
  Button,
  IconButton,
  RowMenu,
  ConfirmDialog,
  EmptyState,
  Toast,
  ToastType,
} from "@/components/seller-v2";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  updateCategoryDisplayStyleAction,
  toggleCategoryStatusAction,
} from "./actions";
import { IconSelector } from "./IconSelector";
import { ICON_MAP, CAROUSEL_ICONS } from "@/lib/carousel-icons";
import { SolarSellerCategoriesIcon } from "@/components/icons/solar/seller-icons";

export interface SerializedProduct {
  id: string;
  title: string;
  price: string | number;
  coverUrl?: string | null;
  categoryId?: string | null;
}

export interface CategoryData {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  iconName?: string | null;
  status: string;
  position?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CategoriesClientV2Props {
  allCategories: CategoryData[];
  serializedProducts: SerializedProduct[];
  initialStyle: "IMAGE" | "ICON";
  hideHeader?: boolean;
}

export default function CategoriesClientV2({
  allCategories,
  serializedProducts,
  initialStyle,
  hideHeader = false,
}: CategoriesClientV2Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Display style state (IMAGE vs ICON in Mini App)
  const [displayStyle, setDisplayStyle] = useState<"IMAGE" | "ICON">(initialStyle || "IMAGE");
  const [isUpdatingStyle, setIsUpdatingStyle] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryData | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Toast feedback state
  const [toast, setToast] = useState<{
    id: string;
    type: ToastType;
    title?: string;
    message: string;
  } | null>(null);

  const showToast = (message: string, type: ToastType = "success", title?: string) => {
    setToast({ id: Date.now().toString(), type, message, title });
  };

  // Operational metrics
  const totalCategories = allCategories.length;
  const activeCategoriesCount = useMemo(() => {
    return allCategories.filter((c) => c.status === "active").length;
  }, [allCategories]);

  const categorizedProductsCount = useMemo(() => {
    return serializedProducts.filter((p) => Boolean(p.categoryId)).length;
  }, [serializedProducts]);

  const categorizedPercentage = useMemo(() => {
    if (!serializedProducts.length) return 0;
    return Math.round((categorizedProductsCount / serializedProducts.length) * 100);
  }, [categorizedProductsCount, serializedProducts.length]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return allCategories.filter((cat) => {
      // Status filter
      if (statusFilter === "active" && cat.status !== "active") return false;
      if (statusFilter === "inactive" && cat.status === "active") return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = cat.name?.toLowerCase().includes(query);
        const matchesSlug = cat.slug?.toLowerCase().includes(query);
        const matchesDesc = cat.description?.toLowerCase().includes(query);
        if (!matchesName && !matchesSlug && !matchesDesc) return false;
      }

      return true;
    });
  }, [allCategories, statusFilter, searchQuery]);

  // Handle display style change
  const handleStyleChange = async (newStyle: "IMAGE" | "ICON") => {
    if (newStyle === displayStyle) return;
    setDisplayStyle(newStyle);
    setIsUpdatingStyle(true);

    try {
      await updateCategoryDisplayStyleAction(newStyle);
      showToast(
        `Estilo de exibição alterado para ${
          newStyle === "IMAGE" ? "Imagens (1:1)" : "Ícones + Nomes"
        }.`
      );
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setDisplayStyle(displayStyle); // Revert
      showToast(err.message || "Erro ao atualizar estilo de exibição.", "error");
    } finally {
      setIsUpdatingStyle(false);
    }
  };

  // Handle quick toggle category status
  const handleToggleStatus = async (categoryId: string) => {
    setActionLoadingId(`toggle-${categoryId}`);
    try {
      const res = await toggleCategoryStatusAction(categoryId);
      if (res?.success) {
        showToast(
          `Categoria ${res.status === "active" ? "ativada" : "ocultada"} no Mini App.`
        );
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (err: any) {
      showToast(err.message || "Erro ao alterar visibilidade da categoria.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle confirm delete category
  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);
    try {
      await deleteCategoryAction(categoryToDelete.id);
      showToast(`Categoria "${categoryToDelete.name}" excluída com sucesso.`);
      setCategoryToDelete(null);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      showToast(err.message || "Erro ao excluir categoria.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 fade-in w-full pb-20">
      {/* 1. Header Principal V2 */}
      {!hideHeader && (
        <PageHeader
          title="Categorias"
          subtitle="Organize seus produtos em categorias e personalize a navegação na vitrine do seu Mini App."
          badge={
            <span className="px-2 py-0.5 rounded-full text-xs font-sans font-medium tabular-nums bg-blue-500/10 text-blue-400 border border-blue-500/25">
              {totalCategories} {totalCategories === 1 ? "categoria" : "categorias"}
            </span>
          }
          actions={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Categoria</span>
            </Button>
          }
        />
      )}

      {/* 2. StatCards — Métricas Operacionais V2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          label="Total de Categorias"
          value={totalCategories}
          icon={<SolarSellerCategoriesIcon className="w-4 h-4" />}
          accent="blue"
          subtext="Cadastradas na loja"
        />
        <StatCard
          label="Categorias Ativas"
          value={activeCategoriesCount}
          icon={<CheckCircle2 className="w-4 h-4" />}
          accent="green"
          subtext="Visíveis no catálogo do Mini App"
        />
        <StatCard
          label="Produtos Categorizados"
          value={categorizedProductsCount}
          icon={<Package className="w-4 h-4" />}
          accent="purple"
          subtext={`${categorizedPercentage}% do catálogo da loja`}
        />
        <StatCard
          label="Estilo no Mini App"
          value={displayStyle === "IMAGE" ? "Imagens (1:1)" : "Ícones"}
          icon={
            displayStyle === "IMAGE" ? (
              <ImageIcon className="w-4 h-4" />
            ) : (
              <LayoutGrid className="w-4 h-4" />
            )
          }
          accent="amber"
          subtext={
            displayStyle === "IMAGE"
              ? "Exibição com imagens de capa"
              : "Exibição com ícones e rótulos"
          }
        />
      </div>

      {/* 3. Card de Configuração de Estilo Visual da Vitrine */}
      <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>Estilo de Exibição no Mini App</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Escolha como suas categorias serão apresentadas para os clientes na vitrine da loja.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#17171A] border border-white/10 rounded-xl shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={() => handleStyleChange("IMAGE")}
              disabled={isUpdatingStyle}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                displayStyle === "IMAGE"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <ImageIcon className="w-4 h-4 shrink-0" />
              <span className="truncate">Imagens (1:1)</span>
              {displayStyle === "IMAGE" && <Check className="w-3.5 h-3.5 ml-0.5 shrink-0" />}
            </button>

            <button
              type="button"
              onClick={() => handleStyleChange("ICON")}
              disabled={isUpdatingStyle}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                displayStyle === "ICON"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              <span className="truncate">Ícones + Nomes</span>
              {displayStyle === "ICON" && <Check className="w-3.5 h-3.5 ml-0.5 shrink-0" />}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Toolbar V2 — Busca, Filtros e Alternância de Visualização */}
      <Toolbar
        searchSlot={
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Buscar por nome ou slug da categoria..."
            className="w-full sm:w-72"
          />
        }
        filterSlot={
          <SegmentedControl
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { id: "all", label: "Todas" },
              { id: "active", label: "Ativas" },
              { id: "inactive", label: "Inativas" },
            ]}
          />
        }
        actionSlot={
          <div className="flex items-center gap-1.5 bg-[#171717] border border-white/[0.08] p-1 rounded-xl">
            <IconButton
              icon={<Grid className="w-4 h-4" />}
              aria-label="Visualização em Grade"
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className={viewMode === "grid" ? "bg-white/10 text-white" : "text-zinc-400"}
            />
            <IconButton
              icon={<List className="w-4 h-4" />}
              aria-label="Visualização em Lista"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className={viewMode === "list" ? "bg-white/10 text-white" : "text-zinc-400"}
            />
          </div>
        }
      />

      {/* 5. Lista / Grade de Categorias */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Tags className="w-5 h-5 text-blue-400" />
            <span>Categorias da Loja</span>
            <span className="text-xs font-normal text-zinc-500">
              ({filteredCategories.length} {filteredCategories.length === 1 ? "categoria" : "categorias"})
            </span>
          </h3>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Criar Categoria</span>
          </Button>
        </div>

        {filteredCategories.length === 0 ? (
          searchQuery || statusFilter !== "all" ? (
            <EmptyState
              icon={<Search className="w-7 h-7 text-zinc-500" />}
              title="Nenhuma categoria encontrada"
              description="Nenhuma categoria corresponde aos critérios de busca ou filtros selecionados."
              action={{
                label: "Limpar Filtros",
                onClick: () => {
                  setSearchQuery("");
                  setStatusFilter("all");
                },
              }}
            />
          ) : (
            <EmptyState
              icon={<SolarSellerCategoriesIcon className="w-8 h-8 text-zinc-500" />}
              title="Nenhuma categoria criada"
              description="Você precisa de categorias para organizar seus produtos e facilitar a descoberta na vitrine do Mini App."
              action={{
                label: "Criar Primeira Categoria",
                onClick: () => setIsCreateModalOpen(true),
                icon: <Plus className="w-4 h-4" />,
              }}
            />
          )
        ) : viewMode === "grid" ? (
          /* Visualização em Grade */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            {filteredCategories.map((cat) => {
              const assignedProducts = serializedProducts.filter((p) => p.categoryId === cat.id);
              const isActionLoading = actionLoadingId === `toggle-${cat.id}`;
              const IconComp = cat.iconName ? ICON_MAP[cat.iconName] || Tags : Tags;

              return (
                <div
                  key={cat.id}
                  className="bg-[#121214] border border-white/[0.08] hover:border-white/20 rounded-2xl p-4 shadow-xl flex flex-col justify-between space-y-4 transition-all duration-200"
                >
                  <div>
                    {/* Header do Card: Imagem / Ícone + Nome e Status */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {cat.imageUrl ? (
                          <img
                            src={cat.imageUrl}
                            alt={cat.name}
                            className="w-12 h-12 rounded-xl object-cover bg-[#17171A] border border-white/10 shrink-0 shadow-sm"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 shadow-sm">
                            <IconComp className="w-6 h-6" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-white text-sm truncate">{cat.name}</h4>
                          <p className="text-[11px] text-zinc-500 font-mono truncate">
                            /{cat.slug}
                          </p>
                        </div>
                      </div>

                      <Chip
                        label={cat.status === "active" ? "Ativa" : "Inativa"}
                        variant={cat.status === "active" ? "active" : "inactive"}
                        size="sm"
                      />
                    </div>

                    {/* Descrição e produtos vinculados */}
                    <div className="bg-[#17171A] rounded-xl p-3 border border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-xs text-zinc-400 pb-1 border-b border-white/5">
                        <span className="font-medium">Produtos Associados</span>
                        <span className="font-semibold text-white tabular-nums">
                          {assignedProducts.length} item{assignedProducts.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {assignedProducts.length === 0 ? (
                        <div className="py-2.5 text-center">
                          <p className="text-zinc-500 text-xs font-medium">Nenhum produto associado</p>
                          <p className="text-[11px] text-zinc-600 mt-0.5">
                            Edite esta categoria para vincular produtos.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                          {assignedProducts.slice(0, 3).map((prod) => (
                            <div
                              key={prod.id}
                              className="flex items-center justify-between text-xs py-1 px-1.5 rounded-lg bg-[#121214] border border-white/5"
                            >
                              <span className="text-zinc-300 truncate max-w-[170px]">
                                {prod.title}
                              </span>
                              <span className="text-emerald-400 font-semibold tabular-nums ml-2 shrink-0">
                                R$ {Number(prod.price).toFixed(2).replace(".", ",")}
                              </span>
                            </div>
                          ))}
                          {assignedProducts.length > 3 && (
                            <p className="text-[11px] text-zinc-500 text-center pt-0.5 font-medium">
                              + {assignedProducts.length - 3} outros produtos
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rodapé de Ações */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                    <span className="text-[11px] text-zinc-500 truncate max-w-[150px]">
                      {cat.description || "Sem descrição"}
                    </span>

                    <div className="flex items-center gap-1">
                      <IconButton
                        icon={
                          cat.status === "active" ? (
                            <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-zinc-500" />
                          )
                        }
                        aria-label={cat.status === "active" ? "Ocultar categoria" : "Ativar categoria"}
                        variant="ghost"
                        size="sm"
                        disabled={isActionLoading}
                        onClick={() => handleToggleStatus(cat.id)}
                      />
                      <IconButton
                        icon={<Edit3 className="w-3.5 h-3.5 text-zinc-300" />}
                        aria-label="Editar categoria"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingCategory(cat)}
                      />
                      <IconButton
                        icon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}
                        aria-label="Excluir categoria"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCategoryToDelete(cat)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Visualização em Lista */
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#17171A] border-b border-white/5 text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">URL (Slug)</th>
                    <th className="py-3 px-4 w-28">Status</th>
                    <th className="py-3 px-4 w-32">Produtos</th>
                    <th className="py-3 px-4 hidden md:table-cell">Descrição</th>
                    <th className="py-3 px-4 text-right w-36">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-200">
                  {filteredCategories.map((cat) => {
                    const assignedProducts = serializedProducts.filter(
                      (p) => p.categoryId === cat.id
                    );
                    const isActionLoading = actionLoadingId === `toggle-${cat.id}`;
                    const IconComp = cat.iconName ? ICON_MAP[cat.iconName] || Tags : Tags;

                    return (
                      <tr key={cat.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            {cat.imageUrl ? (
                              <img
                                src={cat.imageUrl}
                                alt={cat.name}
                                className="w-9 h-9 rounded-lg object-cover bg-[#17171A] border border-white/10 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                                <IconComp className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-white">{cat.name}</p>
                              <p className="text-[11px] text-zinc-500 truncate max-w-[200px]">
                                {cat.description || "Sem descrição"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-zinc-400 text-[11px]">
                          /{cat.slug}
                        </td>
                        <td className="py-3.5 px-4">
                          <Chip
                            label={cat.status === "active" ? "Ativa" : "Inativa"}
                            variant={cat.status === "active" ? "active" : "inactive"}
                            size="sm"
                          />
                        </td>
                        <td className="py-3.5 px-4 text-zinc-300 font-medium tabular-nums">
                          {assignedProducts.length} produto{assignedProducts.length !== 1 ? "s" : ""}
                        </td>
                        <td className="py-3.5 px-4 hidden md:table-cell text-zinc-400 truncate max-w-xs">
                          {cat.description || "—"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <IconButton
                              icon={
                                cat.status === "active" ? (
                                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5 text-zinc-500" />
                                )
                              }
                              aria-label={
                                cat.status === "active" ? "Ocultar categoria" : "Ativar categoria"
                              }
                              variant="ghost"
                              size="sm"
                              disabled={isActionLoading}
                              onClick={() => handleToggleStatus(cat.id)}
                            />
                            <IconButton
                              icon={<Edit3 className="w-3.5 h-3.5 text-zinc-300" />}
                              aria-label="Editar categoria"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingCategory(cat)}
                            />
                            <IconButton
                              icon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}
                              aria-label="Excluir categoria"
                              variant="ghost"
                              size="sm"
                              onClick={() => setCategoryToDelete(cat)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 6. Modal de Criação / Edição de Categoria */}
      <CategoryFormModal
        isOpen={isCreateModalOpen || !!editingCategory}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingCategory(null);
        }}
        category={editingCategory}
        storeProducts={serializedProducts}
        onSuccess={(msg) => {
          showToast(msg);
          setIsCreateModalOpen(false);
          setEditingCategory(null);
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* 7. Diálogo de Confirmação de Exclusão */}
      <ConfirmDialog
        isOpen={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Categoria?"
        description={
          <span>
            Tem certeza que deseja excluir a categoria{" "}
            <strong className="text-white">"{categoryToDelete?.name}"</strong>? Os produtos
            associados a ela <strong className="text-zinc-200">não serão excluídos</strong> do seu
            catálogo; eles apenas ficarão sem categoria atribuída no Mini App.
          </span>
        }
        confirmLabel="Excluir Categoria"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* 8. Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50">
          <Toast
            type={toast.type}
            title={toast.title}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
}

// ==========================================
// Subcomponente: Modal de Criação / Edição de Categoria V2
// ==========================================
interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: CategoryData | null;
  storeProducts: SerializedProduct[];
  onSuccess: (message: string) => void;
}

function CategoryFormModal({
  isOpen,
  onClose,
  category,
  storeProducts,
  onSuccess,
}: CategoryFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [name, setName] = useState(category?.name || "");
  const [description, setDescription] = useState(category?.description || "");
  const [status, setStatus] = useState(category?.status || "active");
  const [imageUrl, setImageUrl] = useState(category?.imageUrl || "");
  const [iconName, setIconName] = useState(category?.iconName || "Tv");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!category;

  // Sync state on open
  React.useEffect(() => {
    if (isOpen) {
      setName(category?.name || "");
      setDescription(category?.description || "");
      setStatus(category?.status || "active");
      setImageUrl(category?.imageUrl || "");
      setIconName(category?.iconName || "Tv");
      const assigned = category
        ? storeProducts.filter((p) => p.categoryId === category.id).map((p) => p.id)
        : [];
      setSelectedProductIds(assigned);
      setProductSearch("");
      setErrorMessage(null);
    }
  }, [isOpen, category, storeProducts]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLoading(true);
      try {
        const { uploadOptimizedImage } = await import("@/lib/image-optimizer");
        const result = await uploadOptimizedImage(file, "categories");
        setImageUrl(result.url);
      } catch (err: any) {
        console.error(err);
        setErrorMessage(err.message || "Erro ao fazer upload da imagem de categoria.");
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.length === storeProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(storeProducts.map((p) => p.id));
    }
  };

  const filteredProducts = useMemo(() => {
    return storeProducts.filter((p) =>
      p.title.toLowerCase().includes(productSearch.toLowerCase())
    );
  }, [storeProducts, productSearch]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("O nome da categoria é obrigatório.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("description", description.trim());
    formData.set("imageUrl", imageUrl);
    formData.set("iconName", iconName);
    formData.set("status", status);

    selectedProductIds.forEach((id) => {
      formData.append("selectedProductIds", id);
    });

    try {
      if (isEditing) {
        await updateCategoryAction(category.id, formData);
        onSuccess(`Categoria "${name.trim()}" atualizada com sucesso!`);
      } else {
        await createCategoryAction(formData);
        onSuccess(`Categoria "${name.trim()}" criada com sucesso!`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar categoria.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl w-[94vw] bg-[#121214] border border-white/10 p-0 overflow-hidden text-zinc-100 shadow-2xl flex flex-col max-h-[90vh] rounded-2xl">
        <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
          <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
            <Tags className="w-5 h-5 text-blue-400" />
            <span>{isEditing ? "Editar Categoria" : "Nova Categoria"}</span>
          </DialogTitle>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/30 text-red-200 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Imagem de Capa e Ícone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#17171A] border border-white/5">
              {/* Imagem de Capa 1:1 */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Imagem de Capa (1:1)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />

                {imageUrl ? (
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/10 bg-[#121214] group">
                    <img
                      src={imageUrl}
                      alt="Capa da Categoria"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="absolute top-1 right-1 p-1 rounded-lg bg-black/70 text-white hover:bg-red-600 transition-colors cursor-pointer"
                      title="Remover imagem"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-x-0 bottom-0 py-1 bg-black/60 text-[10px] text-zinc-300 hover:text-white text-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="w-24 h-24 rounded-xl border border-dashed border-white/20 hover:border-blue-500/50 flex flex-col items-center justify-center gap-1 text-zinc-400 hover:text-white hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <Upload className="w-5 h-5 text-zinc-500" />
                    <span className="text-[10px] font-medium">Upload</span>
                  </button>
                )}
                <p className="text-[10px] text-zinc-500">Formato quadrado recomendado (ex: 500x500px).</p>
              </div>

              {/* Seletor de Ícone */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Ícone Representativo
                </label>
                <IconSelector value={iconName} onChange={setIconName} />
                <p className="text-[10px] text-zinc-500">
                  Usado caso o Mini App esteja no modo "Ícones + Nomes".
                </p>
              </div>
            </div>

            {/* Nome da Categoria e Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Cursos, Mentorias, E-books"
                  required
                  className="w-full bg-[#181820] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Status
                </label>
                <button
                  type="button"
                  onClick={() => setStatus(status === "active" ? "inactive" : "active")}
                  className={`w-full py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    status === "active"
                      ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/30"
                      : "bg-zinc-800 text-zinc-400 border-white/10"
                  }`}
                >
                  {status === "active" ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-emerald-400" /> Ativa
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-zinc-400" /> Inativa
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Descrição (Opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve descrição da categoria exibida para o cliente..."
                rows={2}
                className="w-full bg-[#181820] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 placeholder:text-zinc-600 resize-none"
              />
            </div>

            {/* Gestão de Produtos Vinculados */}
            <div className="space-y-3 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
                    Vincular Produtos ({selectedProductIds.length} selecionados)
                  </label>
                  <p className="text-[11px] text-zinc-500">
                    Selecione quais produtos da sua loja farão parte desta categoria.
                  </p>
                </div>
                {storeProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                  >
                    {selectedProductIds.length === storeProducts.length
                      ? "Desmarcar Todos"
                      : "Selecionar Todos"}
                  </button>
                )}
              </div>

              {/* Busca de produtos */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Pesquisar produto pelo nome..."
                  className="w-full bg-[#181820] border border-white/10 rounded-xl pl-8 pr-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
                />
              </div>

              {/* Lista de Produtos */}
              {storeProducts.length === 0 ? (
                <div className="p-4 text-center bg-[#181820] border border-white/5 rounded-xl text-zinc-500 text-xs">
                  Sua loja ainda não possui produtos cadastrados.
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-4 text-center bg-[#181820] border border-white/5 rounded-xl text-zinc-500 text-xs">
                  Nenhum produto corresponde à busca.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                  {filteredProducts.map((p) => {
                    const isSelected = selectedProductIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleProduct(p.id)}
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? "bg-blue-600/15 border-blue-500/40 text-white"
                            : "bg-[#181820] border-white/5 text-zinc-300 hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate min-w-0 flex-1 mr-2">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? "bg-blue-600 border-blue-500 text-white"
                                : "border-white/20 bg-black/20"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          {p.coverUrl ? (
                            <img
                              src={p.coverUrl}
                              alt={p.title}
                              className="w-6 h-6 rounded object-cover shrink-0 bg-black/20"
                            />
                          ) : (
                            <Package className="w-4 h-4 text-zinc-500 shrink-0" />
                          )}
                          <span className="truncate">{p.title}</span>
                        </div>
                        <span className="text-emerald-400 font-semibold tabular-nums shrink-0">
                          R$ {Number(p.price).toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-white/5 shrink-0 flex items-center justify-end gap-2.5 bg-[#121214]">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-zinc-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Salvando...
                </>
              ) : isEditing ? (
                "Salvar Alterações"
              ) : (
                "Criar Categoria"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

