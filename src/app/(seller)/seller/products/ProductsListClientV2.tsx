"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Plus,
  LayoutGrid,
  List,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Bot,
  Globe,
  Film,
  Link as LinkIcon,
  Send,
  Layers,
  Sparkles,
  Search,
  RotateCcw,
} from "lucide-react";

import {
  PageHeader,
  StatCard,
  Toolbar,
  SearchInput,
  Card,
  Chip,
  Button,
  IconButton,
  EmptyState,
  ConfirmDialog,
  RowMenu,
} from "@/components/seller-v2";

import { NewProductFlowV2 } from "./v2/NewProductFlowV2";
import { EditProductModalV2 } from "./v2/EditProductModalV2";
import { Edit3 } from "lucide-react";

/**
 * Botão "Editar" leve: o formulário completo (EditProductModalV2) só é montado no primeiro clique,
 * em vez de existir escondido em cada card. Isso deixa a lista bem mais rápida com muitos produtos.
 */
function LazyEditProductButton(props: { product: any; categories: any[]; bots: any[]; carousels?: any[] }) {
  const [active, setActive] = useState(false);
  if (active) {
    return <EditProductModalV2 {...props} triggerVariant="redesign" autoOpen />;
  }
  return (
    <button
      type="button"
      onClick={() => setActive(true)}
      aria-label={`Editar ${props.product?.title || "produto"}`}
      className="flex-1 w-full min-w-0 h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-[13px] font-semibold text-zinc-200 hover:text-white hover:bg-[#3b82f6]/15 hover:border-[#3b82f6]/40 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
    >
      <Edit3 className="w-4 h-4 shrink-0" />
      <span>Editar</span>
    </button>
  );
}
import { deleteProductAction } from "./actions";
import { getProductBadge } from "@/lib/product-badge";

export interface EnrichedProductItem {
  id: string;
  title: string;
  slug: string;
  shortDescription?: string | null;
  description?: string | null;
  price: string;
  compareAtPrice?: string | null;
  coverUrl?: string | null;
  bannerUrl?: string | null;
  duration?: string | null;
  badge?: string | null;
  status: string;
  deliveryType?: string | null;
  deliveryValue?: string | null;
  botId?: string | null;
  catalogScope?: string | null;
  sharingMode?: string | null;
  isOwnerOfCurrentBot?: boolean;
  canDeliverInCurrentBot?: boolean;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  carouselIds?: string[];
  botVisibilities?: Array<{ botId: string; canDeliver?: boolean; deliveryBlockReason?: string | null }>;
}

export interface ProductsListClientV2Props {
  storeName?: string;
  products: EnrichedProductItem[];
  categories: { id: string; name: string }[];
  bots: { id: string; username: string; displayName?: string | null; photoUrl?: string | null }[];
  userRole?: string | null;
  isOwnerAccount?: boolean;
  carousels?: any[];
}

const DURATION_LABELS: Record<string, string> = {
  lifetime: "Vitalício",
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

export default function ProductsListClientV2({
  storeName = "Minha Loja",
  products = [],
  categories = [],
  bots = [],
  userRole,
  isOwnerAccount = true,
  carousels = [],
}: ProductsListClientV2Props) {
  const router = useRouter();

  // Estados de Filtros e Busca
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedScope, setSelectedScope] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modais
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<EnrichedProductItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Mapeamento de bots para acesso rápido
  const botMap = useMemo(() => {
    const map = new Map<string, { id: string; username: string; displayName?: string | null; photoUrl?: string | null }>();
    bots.forEach((b) => map.set(b.id, b));
    return map;
  }, [bots]);

  // Contadores de estatísticas compactas
  const stats = useMemo(() => {
    const total = products.length;
    let active = 0;
    let inactive = 0;
    let multiBot = 0;

    products.forEach((p) => {
      if (p.status === "active") {
        active++;
      } else {
        inactive++;
      }

      const isMulti =
        p.catalogScope === "BOT_SPECIFIC" ||
        (p.botVisibilities && p.botVisibilities.length > 0) ||
        Boolean(p.botId);
      if (isMulti) {
        multiBot++;
      }
    });

    return { total, active, inactive, multiBot };
  }, [products]);

  // Filtro de produtos
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // 1. Busca textual
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = prod.title?.toLowerCase().includes(query);
        const matchesShort = prod.shortDescription?.toLowerCase().includes(query);
        const matchesDesc = prod.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesShort && !matchesDesc) {
          return false;
        }
      }

      // 2. Categoria
      if (selectedCategory !== "all" && prod.categoryId !== selectedCategory) {
        return false;
      }

      // 3. Status
      if (selectedStatus !== "all" && prod.status !== selectedStatus) {
        return false;
      }

      // 4. Escopo / Bot
      if (selectedScope !== "all") {
        if (selectedScope === "store_general") {
          const isGeneral = prod.catalogScope === "STORE_GENERAL" || (!prod.catalogScope && !prod.botId);
          if (!isGeneral) return false;
        } else if (selectedScope === "bot_general") {
          if (prod.catalogScope !== "BOT_GENERAL") return false;
        } else if (selectedScope === "bot_specific") {
          const isSpecific = prod.catalogScope === "BOT_SPECIFIC" || Boolean(prod.botId);
          if (!isSpecific) return false;
        } else {
          // specific bot ID
          const matchesOwner = prod.botId === selectedScope;
          const matchesVisibilities = prod.botVisibilities?.some((v) => v.botId === selectedScope);
          if (!matchesOwner && !matchesVisibilities) return false;
        }
      }

      return true;
    });
  }, [products, searchQuery, selectedCategory, selectedStatus, selectedScope]);

  // Contagem de filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedCategory !== "all") count++;
    if (selectedStatus !== "all") count++;
    if (selectedScope !== "all") count++;
    return count;
  }, [searchQuery, selectedCategory, selectedStatus, selectedScope]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedStatus("all");
    setSelectedScope("all");
  };

  // Exclusão de produto com confirmação
  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      await deleteProductAction(productToDelete.id);
      setProductToDelete(null);
      router.refresh();
    } catch (err) {
      console.error("[ProductsListClientV2] Erro ao excluir produto:", err);
      alert("Ocorreu um erro ao excluir o produto. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Renderiza o badge de entrega
  const renderDeliveryChip = (prod: EnrichedProductItem) => {
    const type = prod.deliveryType || "telegram";
    if (type === "telegram" || type === "TELEGRAM_CHAT") {
      return (
        <Chip
          size="sm"
          variant="info"
          icon={<Send className="w-3 h-3 shrink-0" />}
          label="Telegram"
        />
      );
    }
    if (type === "external_link" || type === "LINK") {
      return (
        <Chip
          size="sm"
          variant="warning"
          icon={<LinkIcon className="w-3 h-3 shrink-0" />}
          label="Link externo"
        />
      );
    }
    if (type === "video" || type === "VIDEO" || type === "product_video") {
      return (
        <Chip
          size="sm"
          variant="purple"
          icon={<Film className="w-3 h-3 shrink-0" />}
          label="Vídeo"
        />
      );
    }
    return (
      <Chip
        size="sm"
        variant="default"
        label={type}
      />
    );
  };

  // Renderiza o indicador de visibilidade Multi-Bot
  const renderBotVisibilityBadge = (prod: EnrichedProductItem) => {
    const scope = prod.catalogScope || (prod.botId ? "BOT_SPECIFIC" : "STORE_GENERAL");

    if (scope === "STORE_GENERAL") {
      return (
        <Chip
          size="sm"
          variant="inactive"
          icon={<Globe className="w-3 h-3 shrink-0 text-[#71717a]" />}
          label="Loja Geral"
          className="text-[11px]"
        />
      );
    }

    if (scope === "BOT_GENERAL") {
      return (
        <Chip
          size="sm"
          variant="purple"
          icon={<Bot className="w-3 h-3 shrink-0 text-[#c084fc]" />}
          label="Todos os Bots"
          className="text-[11px]"
        />
      );
    }

    // BOT_SPECIFIC
    const visibilities = prod.botVisibilities || [];
    const hasMultipleBots = visibilities.length > 1;
    const targetBot = prod.botId ? botMap.get(prod.botId) : null;
    const singleBotLabel = targetBot?.displayName || (targetBot?.username ? `@${targetBot.username}` : "Bot");

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {hasMultipleBots ? (
          <div className="flex items-center gap-1 bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-2 py-0.5 rounded-full text-[11px] font-medium text-[#60a5fa]">
            <Bot className="w-3 h-3 shrink-0" />
            <span>{visibilities.length} bots associados</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-2 py-0.5 rounded-full text-[11px] font-medium text-[#60a5fa] max-w-[130px] truncate" title={`Bot: ${singleBotLabel}`}>
            <Bot className="w-3 h-3 shrink-0" />
            <span className="truncate">{singleBotLabel}</span>
          </div>
        )}

        {prod.sharingMode === "ALL_EXISTING" && (
          <span className="text-[10px] text-[#4ade80] bg-[#22c55e]/10 border border-[#22c55e]/20 px-1.5 py-0.5 rounded-md font-medium">
            Compartilhado
          </span>
        )}

        {prod.canDeliverInCurrentBot === false && (
          <span className="text-[10px] text-[#fbbf24] bg-[#f59e0b]/10 border border-[#f59e0b]/20 px-1.5 py-0.5 rounded-md font-medium" title="Bot atual não possui permissão no canal">
            Entrega Bloqueada
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full min-w-0 pb-16">
      {/* 1. Header Padronizado V2 */}
      <PageHeader
        title="Produtos"
        subtitle="Gerencie o catálogo e a visibilidade dos produtos no seu Mini App e bots do Telegram."
        badge={
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums bg-[#3b82f6]/15 text-[#60a5fa] border border-[#3b82f6]/30">
            {products.length} {products.length === 1 ? "produto" : "produtos"}
          </span>
        }
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
            onClick={() => setIsNewProductOpen(true)}
          >
            Novo produto
          </Button>
        }
      />

      {/* 2. Métricas / Indicadores Compactos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total de Produtos"
          value={stats.total}
          accent="blue"
          icon={<Package className="w-5 h-5" />}
          subtext="Produtos cadastrados"
        />
        <StatCard
          label="Produtos Ativos"
          value={stats.active}
          accent="green"
          icon={<CheckCircle2 className="w-5 h-5" />}
          subtext="Visíveis para venda"
        />
        <StatCard
          label="Produtos Inativos"
          value={stats.inactive}
          accent="zinc"
          icon={<AlertCircle className="w-5 h-5" />}
          subtext="Ocultos ou rascunhos"
        />
        <StatCard
          label="Multi-Bot / Específicos"
          value={stats.multiBot}
          accent="purple"
          icon={<Bot className="w-5 h-5" />}
          subtext="Com regras de bots"
        />
      </div>

      {/* 3. Toolbar Completa e Responsiva */}
      <Toolbar
        searchSlot={
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery("")}
            placeholder={`Buscar em ${products.length} produtos por título ou descrição...`}
          />
        }
        filterSlot={
          <>
            {/* Filtro por Categoria */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filtrar por Categoria"
              className="h-10 bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-xs text-[#f4f4f5] rounded-xl px-3 transition-colors outline-none cursor-pointer"
            >
              <option value="all">Todas as Categorias</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            {/* Filtro por Status */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Filtrar por Status"
              className="h-10 bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-xs text-[#f4f4f5] rounded-xl px-3 transition-colors outline-none cursor-pointer"
            >
              <option value="all">Todos os Status</option>
              <option value="active">Ativo na Loja</option>
              <option value="draft">Inativo / Rascunho</option>
            </select>

            {/* Filtro por Escopo / Bot */}
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              aria-label="Filtrar por Escopo ou Bot"
              className="h-10 bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-xs text-[#f4f4f5] rounded-xl px-3 transition-colors outline-none cursor-pointer"
            >
              <option value="all">Todos os Escopos / Bots</option>
              <option value="store_general">Loja Geral (Web)</option>
              <option value="bot_general">Bot Geral (Todos os Bots)</option>
              <option value="bot_specific">Bot Específico (Geral)</option>
              {bots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName || `@${b.username}`}
                </option>
              ))}
            </select>

            {/* Botão Limpar Filtros quando ativos */}
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
            {/* Contador de resultados */}
            <span className="text-xs text-[#71717a] tabular-nums hidden sm:inline-block">
              {filteredProducts.length} de {products.length}
            </span>

            {/* Alternador de visualização Grid / List */}
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

      {/* 4. Conteúdo: Grid ou Lista ou Empty State */}
      {filteredProducts.length === 0 ? (
        <EmptyState
          icon={products.length === 0 ? <Package className="w-8 h-8" /> : <Search className="w-8 h-8" />}
          title={products.length === 0 ? "Nenhum produto cadastrado" : "Nenhum produto encontrado"}
          description={
            products.length === 0
              ? "Cadastre seu primeiro produto para começar a vender na sua loja digital e nos seus bots do Telegram."
              : "Nenhum produto corresponde aos critérios da busca ou aos filtros selecionados. Tente ajustar os termos."
          }
          action={
            products.length === 0
              ? {
                  label: "Novo produto",
                  icon: <Plus className="w-4 h-4" />,
                  onClick: () => setIsNewProductOpen(true),
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredProducts.map((prod) => {
            const badgeConfig = getProductBadge(prod.badge);
            const menuItems = [
              {
                id: "delete",
                label: "Excluir produto",
                icon: <Trash2 className="w-4 h-4 text-[#f87171]" />,
                danger: true,
                onClick: () => setProductToDelete(prod),
              },
            ];

            return (
              <Card
                key={prod.id}
                padding="none"
                interactive
                className="flex flex-col justify-between overflow-hidden group !rounded-[10px]"
              >
                {/* Imagem de Capa (144px compacta) */}
                <div className="w-full h-36 bg-[#16161a] relative overflow-hidden shrink-0 border-b border-[#26262a]">
                  {prod.coverUrl ? (
                    <img
                      src={prod.coverUrl}
                      alt={prod.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#71717a] gap-1">
                      <Package className="w-7 h-7 text-[#52525b]" />
                      <span className="text-[10px] text-[#71717a]">Sem imagem</span>
                    </div>
                  )}

                  {/* Badge de idioma/novidade */}
                  {badgeConfig && (
                    <div className="absolute top-2 left-2 z-10">
                      <span className={badgeConfig.className}>{badgeConfig.label}</span>
                    </div>
                  )}

                  {/* Status do Produto */}
                  <div className="absolute top-2 right-2 z-10">
                    {prod.status === "active" ? (
                      <Chip size="sm" variant="active" label="Ativo" />
                    ) : (
                      <Chip size="sm" variant="inactive" label="Rascunho" />
                    )}
                  </div>
                </div>

                {/* Corpo do Card */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <h3 className="text-[#f4f4f5] font-bold text-sm truncate" title={prod.title}>
                      {prod.title}
                    </h3>

                    {/* Linha de Categoria + Tipo de Entrega */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {prod.category && (
                        <span className="text-[11px] text-[#60a5fa] bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-2 py-0.5 rounded-md font-medium truncate max-w-[120px]">
                          {prod.category.name}
                        </span>
                      )}
                      {renderDeliveryChip(prod)}
                    </div>

                    {/* Escopo de Bot */}
                    <div className="pt-0.5">{renderBotVisibilityBadge(prod)}</div>
                  </div>

                  <p className="text-[#9a9aa2] text-xs leading-relaxed line-clamp-2 h-8">
                    {prod.shortDescription || prod.description || "Nenhuma descrição informada."}
                  </p>

                  {/* Preço e Duração */}
                  <div className="flex items-baseline justify-between pt-2 border-t border-[#26262a]">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[#4ade80] font-bold text-base tracking-tight tabular-nums">
                        R$ {Number(prod.price).toFixed(2).replace(".", ",")}
                      </span>
                      {prod.compareAtPrice && (
                        <span className="text-[#71717a] text-xs line-through tabular-nums">
                          R$ {Number(prod.compareAtPrice).toFixed(2).replace(".", ",")}
                        </span>
                      )}
                    </div>
                    <span className="text-[#71717a] text-[10px] font-medium uppercase bg-white/[0.04] px-2 py-0.5 rounded-md">
                      {DURATION_LABELS[prod.duration || "lifetime"] || "Vitalício"}
                    </span>
                  </div>
                </div>

                {/* Rodapé de Ações */}
                <div className="p-3 border-t border-[#26262a] flex items-center gap-2 bg-[#121215] shrink-0">
                  <div className="flex-1 min-w-0 flex">
                    <LazyEditProductButton
                      product={prod}
                      categories={categories}
                      bots={bots}
                      carousels={carousels}
                    />
                  </div>
                  <RowMenu items={menuItems} ariaLabel={`Ações para ${prod.title}`} />
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Visualização em Lista */
        <Card padding="none" className="overflow-hidden divide-y divide-[#26262a]">
          {filteredProducts.map((prod) => {
            const menuItems = [
              {
                id: "delete",
                label: "Excluir produto",
                icon: <Trash2 className="w-4 h-4 text-[#f87171]" />,
                danger: true,
                onClick: () => setProductToDelete(prod),
              },
            ];

            return (
              <div
                key={prod.id}
                className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  {/* Thumbnail 64x64 */}
                  <div className="w-16 h-16 rounded-xl bg-[#16161a] border border-[#26262a] overflow-hidden shrink-0 relative">
                    {prod.coverUrl ? (
                      <img src={prod.coverUrl} alt={prod.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#71717a]">
                        <Package className="w-6 h-6 text-[#52525b]" />
                      </div>
                    )}
                  </div>

                  {/* Informações centrais */}
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-[#f4f4f5] text-sm truncate">{prod.title}</h4>
                      {prod.status === "active" ? (
                        <Chip size="sm" variant="active" label="Ativo" />
                      ) : (
                        <Chip size="sm" variant="inactive" label="Rascunho" />
                      )}
                      {prod.category && (
                        <span className="text-[11px] text-[#60a5fa] bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-2 py-0.5 rounded-md font-medium">
                          {prod.category.name}
                        </span>
                      )}
                      {renderDeliveryChip(prod)}
                    </div>

                    <p className="text-xs text-[#9a9aa2] truncate max-w-xl">
                      {prod.shortDescription || prod.description || "Nenhuma descrição informada."}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-[#71717a] flex-wrap pt-0.5">
                      <span>Duração: {DURATION_LABELS[prod.duration || "lifetime"] || "Vitalício"}</span>
                      <span>•</span>
                      {renderBotVisibilityBadge(prod)}
                    </div>
                  </div>
                </div>

                {/* Preço e Ações do lado direito */}
                <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-[#26262a]">
                  <div className="text-right">
                    <div className="text-[#4ade80] font-bold text-base tabular-nums">
                      R$ {Number(prod.price).toFixed(2).replace(".", ",")}
                    </div>
                    {prod.compareAtPrice && (
                      <div className="text-[#71717a] text-xs line-through tabular-nums">
                        R$ {Number(prod.compareAtPrice).toFixed(2).replace(".", ",")}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-[150px]">
                    <LazyEditProductButton
                      product={prod}
                      categories={categories}
                      bots={bots}
                      carousels={carousels}
                    />
                    <RowMenu items={menuItems} ariaLabel={`Ações para ${prod.title}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* 5. Modal Novo Produto V2 (Fluxo de 2 passos preservado) */}
      <NewProductFlowV2
        isOpen={isNewProductOpen}
        onClose={() => setIsNewProductOpen(false)}
        categories={categories}
        bots={bots}
        carousels={carousels}
      />

      {/* 6. Modal de Confirmação de Exclusão V2 */}
      <ConfirmDialog
        isOpen={Boolean(productToDelete)}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Produto"
        description={
          productToDelete ? (
            <span>
              Tem certeza que deseja excluir o produto{" "}
              <strong className="text-[#f4f4f5]">"{productToDelete.title}"</strong>? Esta ação é irreversível
              e removerá o produto do catálogo e de todas as vitrines associadas.
            </span>
          ) : (
            ""
          )
        }
        confirmLabel="Excluir produto"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

