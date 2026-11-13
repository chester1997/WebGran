"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Package, 
  Search, 
  Image as ImageIcon, 
  LayoutGrid, 
  List, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Tag,
  Link2,
  Check,
  Bot,
  Globe,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewProductModal } from "./NewProductModal";
import { DeliveryChoiceModal } from "./DeliveryChoiceModal";
import { EditProductModal } from "./EditProductModal";
import { deleteProductAction } from "./actions";
import SellerPageHeader from "@/components/layout/SellerPageHeader";

import { getProductBadge } from "@/lib/product-badge";
import { ProductManualDeepLinkService } from "@/lib/products/manual-deep-link-service";

interface ProductItem {
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
}

interface Props {
  storeName: string;
  products: ProductItem[];
  categories: { id: string; name: string }[];
  bots: { id: string; username: string; displayName?: string | null }[];
  userRole?: string | null;
  carousels?: any[];
  hideHeader?: boolean;
}

function renderCatalogBadge(prod: ProductItem, bots: { id: string; username: string; displayName?: string | null }[]) {
  const scope = prod.catalogScope || (prod.botId ? "BOT_SPECIFIC" : "STORE_GENERAL");

  if (scope === "STORE_GENERAL") {
    return (
      <span className="text-[10px] text-zinc-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded font-medium flex items-center gap-1" title="Disponível na Loja Geral (catálogo web)">
        <Globe className="w-3 h-3 shrink-0" />
        <span>Loja Geral</span>
      </span>
    );
  }

  if (scope === "BOT_GENERAL") {
    return (
      <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded font-medium flex items-center gap-1" title="Bot Geral: Disponível em todos os bots ativos">
        <Bot className="w-3 h-3 shrink-0" />
        <span>Bot Geral</span>
      </span>
    );
  }

  // BOT_SPECIFIC
  const targetBot = bots.find((b) => b.id === prod.botId);
  const botLabel = targetBot?.displayName || (targetBot?.username ? `@${targetBot.username}` : "Bot");
  const isShared = prod.sharingMode === "ALL_EXISTING" || prod.isOwnerOfCurrentBot === false;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-[10px] text-[#3984FF] bg-[#3984FF]/10 border border-[#3984FF]/20 px-1.5 py-0.5 rounded font-medium flex items-center gap-1 max-w-[130px] truncate" title={`Bot Proprietário: ${botLabel}`}>
        <Bot className="w-3 h-3 shrink-0" />
        <span className="truncate">{botLabel}</span>
      </span>
      {isShared && (
        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 rounded font-medium">
          Compartilhado
        </span>
      )}
      {prod.canDeliverInCurrentBot === false && (
        <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1 py-0.5 rounded font-medium" title="Bot atual não possui permissão no canal">
          Entrega Indisponível
        </span>
      )}
    </div>
  );
}

const durationMap: Record<string, string> = {
  lifetime: 'Vitalício',
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual'
};

export default function ProductsListClient({ storeName, products, categories, bots, userRole, carousels = [], hideHeader = false }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedBot, setSelectedBot] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);

  const isSuperAdmin = ProductManualDeepLinkService.isAuthorized(userRole);

  const handleCopyDeepLink = (prod: ProductItem) => {
    if (!isSuperAdmin) {
      alert("Acesso negado. A geração manual de Deep Link é exclusiva para SUPER_ADMIN.");
      return;
    }

    const targetBot = (prod.botId && bots.find(b => b.id === prod.botId)) || bots[0];
    const result = ProductManualDeepLinkService.generateDeepLink({
      productId: prod.id,
      botUsername: targetBot?.username,
      shortName: "shorts",
      userRole,
    });

    if (!result.success || !result.url) {
      alert(result.error || "Erro ao gerar o Deep Link.");
      return;
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(result.url);
    }
    setCopiedId(prod.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredProducts = products.filter((prod) => {
    const matchesSearch = 
      searchQuery === "" || 
      prod.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (prod.shortDescription && prod.shortDescription.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (prod.description && prod.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = 
      selectedCategory === "all" || 
      prod.categoryId === selectedCategory;

    const matchesBot = 
      selectedBot === "all"
        ? true
        : selectedBot === "store_general" || selectedBot === "global"
        ? (prod.catalogScope === "STORE_GENERAL" || (!prod.catalogScope && !prod.botId))
        : selectedBot === "bot_general"
        ? prod.catalogScope === "BOT_GENERAL"
        : prod.botId === selectedBot;

    const matchesStatus = 
      selectedStatus === "all" || 
      prod.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesBot && matchesStatus;
  });

  const handleDelete = async (productId: string, title: string) => {
    if (!confirm(`Tem certeza que deseja excluir o produto "${title}"?`)) {
      return;
    }
    setDeletingId(productId);
    try {
      await deleteProductAction(productId);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Erro ao excluir produto.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 fade-in w-full min-w-0 pb-16">
      {/* Header Padronizado */}
      {!hideHeader ? (
        <SellerPageHeader
          title="Catálogo de Produtos"
          badge={
            <span className="text-xs sm:text-sm text-zinc-400 font-normal tabular-nums self-center">
              {products.length} {products.length === 1 ? "produto" : "produtos"}
            </span>
          }
          subtitle="Gerencie o catálogo de produtos digitais da sua loja."
          actions={
            <button
              type="button"
              onClick={() => setDeliveryModalOpen(true)}
              className="h-10 px-4 sm:px-5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-all border border-blue-500/20"
            >
              <Plus className="w-4 h-4 shrink-0 stroke-[2.5]" />
              <span>Novo Produto</span>
            </button>
          }
        />
      ) : (
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-6">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight">
              Catálogo de Produtos
            </h2>
            <span className="text-xs sm:text-sm text-zinc-400 font-normal tabular-nums">
              {products.length} {products.length === 1 ? "produto" : "produtos"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDeliveryModalOpen(true)}
            className="h-10 px-4 sm:px-5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-all border border-blue-500/20"
          >
            <Plus className="w-4 h-4 shrink-0 stroke-[2.5]" />
            <span>Novo Produto</span>
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center gap-3 bg-[var(--seller-surface,#101218)] p-3 border border-[var(--seller-border,rgba(255,255,255,0.06))] rounded-[12px] shadow-none">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="search"
            name="search"
            id="products_search_input"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-form-type="other"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Buscar em ${products.length} produtos...`}
            className="w-full bg-[#16161C] border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="w-full md:w-auto shrink-0 flex flex-wrap md:flex-nowrap items-center gap-2">
          {/* Bot Selector */}
          <select
            value={selectedBot}
            onChange={(e) => setSelectedBot(e.target.value)}
            className="bg-[#16161C] border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-blue-500/50 transition-all w-full md:w-48 appearance-none"
          >
            <option value="all">Todos os Escopos / Bots</option>
            <option value="store_general">Loja Geral (Web)</option>
            <option value="bot_general">Bot Geral (Todos os Bots)</option>
            {bots.map((b) => (
              <option key={b.id} value={b.id}>{b.displayName || `@${b.username}`}</option>
            ))}
          </select>

          {/* Category Dropdown Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#16161C] border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-blue-500/50 transition-all w-full md:w-40 appearance-none"
          >
            <option value="all">Todas as Categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Status Dropdown Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#16161C] border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-blue-500/50 transition-all w-full md:w-36 appearance-none"
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativo na Loja</option>
            <option value="draft">Inativo (Rascunho)</option>
          </select>

          {/* View Toggle */}
          <div className="flex bg-[#16161C] p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-blue-600 text-white shadow" : "text-zinc-500 hover:text-white"}`}
              title="Visualização em Grade"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-blue-600 text-white shadow" : "text-zinc-500 hover:text-white"}`}
              title="Visualização em Lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Product Content Area */}
      {filteredProducts.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center justify-center bg-[#0F0F12] rounded-2xl border border-white/5 shadow-xl p-6">
          <div className="w-16 h-16 rounded-2xl bg-[#16161C] flex items-center justify-center mb-4 border border-white/5">
            <Package className="w-8 h-8 text-zinc-500" />
          </div>
          <h3 className="text-white font-bold text-base mb-1">Nenhum produto encontrado</h3>
          <p className="text-zinc-500 text-xs max-w-sm mb-6">
            {products.length === 0 
              ? "Cadastre seu primeiro produto para começar a vender na sua loja digital."
              : "Nenhum produto corresponde aos termos da busca."
            }
          </p>
          {products.length === 0 && (
            <NewProductModal categories={categories} bots={bots} carousels={carousels} />
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* Standardized Compact Grid Layout Responsivo e Fluido */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {filteredProducts.map((prod) => (
            <div 
              key={prod.id} 
              className="bg-[#0F0F12] border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-lg hover:border-white/10 transition-all duration-200 group relative"
            >
              {/* Compact Fixed Height Image Banner (h-36 = 144px) */}
              <div className="w-full h-36 bg-zinc-900 relative overflow-hidden shrink-0 border-b border-white/5">
                {prod.coverUrl ? (
                  <img 
                    src={prod.coverUrl} 
                    alt={prod.title} 
                    className="w-full h-full object-cover object-center" 
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-1">
                    <ImageIcon className="w-7 h-7" />
                    <span className="text-[10px]">Sem imagem</span>
                  </div>
                )}

                {/* Custom Product Badge (Novo, Dublado, Legendado, etc.) */}
                {(() => {
                  const badgeConfig = getProductBadge(prod.badge);
                  if (!badgeConfig) return null;
                  return (
                    <div className="absolute top-1 left-1 z-10">
                      <span className={badgeConfig.className}>
                        {badgeConfig.label}
                      </span>
                    </div>
                  );
                })()}

                {/* Status Badge */}
                <div className="absolute top-2.5 right-2.5 z-10">
                  {prod.status === 'active' ? (
                    <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Ativo
                    </span>
                  ) : (
                    <span className="bg-zinc-800/80 text-zinc-400 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md border border-white/10">
                      Rascunho
                    </span>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-white font-bold text-sm truncate" title={prod.title}>
                      {prod.title}
                    </h3>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold tracking-wider">
                      {storeName}
                    </span>
                    {prod.category && (
                      <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-medium truncate max-w-[120px]">
                        {prod.category.name}
                      </span>
                    )}
                    {renderCatalogBadge(prod, bots)}
                  </div>
                </div>

                <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2 h-8">
                  {prod.shortDescription || prod.description || "Nenhuma descrição cadastrada."}
                </p>

                {/* Price & Duration */}
                <div className="flex items-baseline justify-between pt-2 border-t border-white/5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-emerald-400 font-bold text-base tracking-tight">
                      R$ {Number(prod.price).toFixed(2).replace('.', ',')}
                    </span>
                    {prod.compareAtPrice && (
                      <span className="text-zinc-500 text-xs line-through">
                        R$ {Number(prod.compareAtPrice).toFixed(2).replace('.', ',')}
                      </span>
                    )}
                  </div>
                  <span className="text-zinc-400 text-[10px] font-medium uppercase bg-white/5 px-2 py-0.5 rounded">
                    {durationMap[prod.duration || 'lifetime'] || 'Vitalício'}
                  </span>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="p-2.5 border-t border-white/5 flex gap-2 bg-[#141418] shrink-0">
                {isSuperAdmin && (
                  <Button
                    onClick={() => handleCopyDeepLink(prod)}
                    variant="outline"
                    className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20 h-8 px-2.5 text-xs rounded-lg font-semibold transition-all shrink-0 flex items-center gap-1"
                    title="Copiar Deep Link do Telegram para divulgação deste produto"
                  >
                    {copiedId === prod.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Deep Link</span>
                      </>
                    )}
                  </Button>
                )}
                <EditProductModal product={prod} categories={categories} bots={bots} carousels={carousels} />
                <Button 
                  onClick={() => handleDelete(prod.id, prod.title)}
                  disabled={deletingId === prod.id}
                  variant="outline" 
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 h-8 px-3 text-xs rounded-lg font-semibold transition-all shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  {deletingId === prod.id ? "..." : "Excluir"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List Mode View */
        <div className="bg-[#0F0F12] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          <div className="divide-y divide-white/5">
            {filteredProducts.map((prod) => (
              <div key={prod.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-white/10 overflow-hidden shrink-0">
                    {prod.coverUrl ? (
                      <img src={prod.coverUrl} alt={prod.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm truncate">{prod.title}</h4>
                      {prod.status === 'active' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">Ativo</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-semibold">Rascunho</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 truncate max-w-md">
                      {prod.shortDescription || prod.description || "Sem descrição."}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 flex-wrap">
                      <span>Categoria: {prod.category?.name || 'Sem Categoria'}</span>
                      <span>•</span>
                      <span>Duração: {durationMap[prod.duration || 'lifetime']}</span>
                      <span>•</span>
                      {renderCatalogBadge(prod, bots)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right">
                    <div className="text-emerald-400 font-bold text-base">
                      R$ {Number(prod.price).toFixed(2).replace('.', ',')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isSuperAdmin && (
                      <Button
                        onClick={() => handleCopyDeepLink(prod)}
                        variant="outline"
                        className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20 h-8 px-2.5 text-xs rounded-lg font-semibold transition-all shrink-0 flex items-center gap-1"
                        title="Copiar Deep Link do Telegram para divulgação deste produto"
                      >
                        {copiedId === prod.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Link2 className="w-3.5 h-3.5" />
                            <span>Deep Link</span>
                          </>
                        )}
                      </Button>
                    )}
                    <EditProductModal product={prod} categories={categories} bots={bots} carousels={carousels} />
                    <Button 
                      onClick={() => handleDelete(prod.id, prod.title)}
                      disabled={deletingId === prod.id}
                      variant="outline" 
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 h-8 px-3 text-xs rounded-lg font-semibold transition-all shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      {deletingId === prod.id ? "..." : "Excluir"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Modal de Escolha da Modalidade de Entrega */}
      <DeliveryChoiceModal 
        isOpen={deliveryModalOpen}
        onClose={() => setDeliveryModalOpen(false)}
      />
    </div>
  );
}
