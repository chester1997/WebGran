"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Ticket,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Percent,
  DollarSign,
  TrendingUp,
  Tag,
  Copy,
  Check,
  Search,
  RotateCcw,
  LayoutGrid,
  List,
  Power,
  X,
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
  Toast,
  RowMenu,
  SegmentedControl,
} from "@/components/seller-v2";

import {
  createCouponAction,
  toggleCouponStatusAction,
  deleteCouponAction,
} from "./actions";
import { formatBusinessDate } from "@/lib/analytics/timezone-utils";

export interface CouponItem {
  id: string;
  storeId: string;
  code: string;
  discountType: string;
  discountValue: string;
  minOrderValue: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date | string | null;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CouponsClientV2Props {
  initialCoupons: CouponItem[];
  hideHeader?: boolean;
}

export default function CouponsClientV2({ initialCoupons, hideHeader = false }: CouponsClientV2Props) {
  const router = useRouter();

  // Lista local e estados de filtros
  const [couponsList, setCouponsList] = useState<CouponItem[]>(initialCoupons);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [discountTypeFilter, setDiscountTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modais e Diálogos
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState<CouponItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Notificações e feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Estados do formulário de criação
  const [formCode, setFormCode] = useState("");
  const [formDiscountType, setFormDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [formDiscountValue, setFormDiscountValue] = useState("");
  const [formMinOrderValue, setFormMinOrderValue] = useState("");
  const [formMaxUses, setFormMaxUses] = useState("");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setFormCode("");
    setFormDiscountType("percentage");
    setFormDiscountValue("");
    setFormMinOrderValue("");
    setFormMaxUses("");
    setFormExpiresAt("");
    setFormError(null);
  };

  // Cópia de código
  const handleCopyCode = (code: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Métricas calculadas para os StatCards
  const stats = useMemo(() => {
    const total = couponsList.length;
    let active = 0;
    let inactive = 0;
    let totalUses = 0;

    couponsList.forEach((c) => {
      if (c.status === "active") {
        active++;
      } else {
        inactive++;
      }
      totalUses += c.usedCount || 0;
    });

    return { total, active, inactive, totalUses };
  }, [couponsList]);

  // Filtros aplicados
  const filteredCoupons = useMemo(() => {
    return couponsList.filter((coupon) => {
      // 1. Busca por código
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        if (!coupon.code.toLowerCase().includes(query)) {
          return false;
        }
      }

      // 2. Filtro por status
      if (statusFilter !== "all" && coupon.status !== statusFilter) {
        return false;
      }

      // 3. Filtro por tipo de desconto
      if (discountTypeFilter !== "all" && coupon.discountType !== discountTypeFilter) {
        return false;
      }

      return true;
    });
  }, [couponsList, searchQuery, statusFilter, discountTypeFilter]);

  // Contagem de filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (statusFilter !== "all") count++;
    if (discountTypeFilter !== "all") count++;
    return count;
  }, [searchQuery, statusFilter, discountTypeFilter]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDiscountTypeFilter("all");
  };

  // Alternar status ativo/inativo
  const handleToggleStatus = async (coupon: CouponItem) => {
    setTogglingId(coupon.id);
    const nextStatus = coupon.status === "active" ? "inactive" : "active";
    try {
      await toggleCouponStatusAction(coupon.id, coupon.status);
      setCouponsList((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, status: nextStatus } : c))
      );
      setToast({
        type: "success",
        message: `Cupom ${coupon.code} ${nextStatus === "active" ? "ativado" : "desativado"} com sucesso.`,
      });
      router.refresh();
    } catch (err: any) {
      setToast({
        type: "error",
        message: err?.message || "Erro ao alterar o status do cupom.",
      });
    } finally {
      setTogglingId(null);
    }
  };

  // Exclusão de cupom via ConfirmDialog
  const handleConfirmDelete = async () => {
    if (!couponToDelete) return;
    setIsDeleting(true);
    try {
      await deleteCouponAction(couponToDelete.id);
      setCouponsList((prev) => prev.filter((c) => c.id !== couponToDelete.id));
      setToast({
        type: "success",
        message: `Cupom ${couponToDelete.code} excluído com sucesso.`,
      });
      setCouponToDelete(null);
      router.refresh();
    } catch (err: any) {
      setToast({
        type: "error",
        message: err?.message || "Erro ao excluir o cupom.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Criação de cupom no modal V2
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const val = parseFloat(formDiscountValue.replace(",", "."));
    if (isNaN(val) || val <= 0) {
      setFormError("Informe um valor de desconto válido e maior que zero.");
      return;
    }

    if (formDiscountType === "percentage" && val > 100) {
      setFormError("Desconto percentual não pode ultrapassar 100%.");
      return;
    }

    setIsSaving(true);
    try {
      const minVal = formMinOrderValue ? parseFloat(formMinOrderValue.replace(",", ".")) : 0;
      const maxUsesVal = formMaxUses ? parseInt(formMaxUses, 10) : null;

      await createCouponAction({
        code: formCode,
        discountType: formDiscountType,
        discountValue: val,
        minOrderValue: isNaN(minVal) ? 0 : minVal,
        maxUses: maxUsesVal && !isNaN(maxUsesVal) ? maxUsesVal : null,
        expiresAt: formExpiresAt || null,
      });

      // Atualiza lista localmente e notifica
      const newCoupon: CouponItem = {
        id: `temp-${Date.now()}`,
        storeId: "",
        code: formCode.trim().toUpperCase(),
        discountType: formDiscountType,
        discountValue: val.toString(),
        minOrderValue: isNaN(minVal) ? null : minVal.toString(),
        maxUses: maxUsesVal && !isNaN(maxUsesVal) ? maxUsesVal : null,
        usedCount: 0,
        expiresAt: formExpiresAt || null,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setCouponsList((prev) => [newCoupon, ...prev]);
      setToast({ type: "success", message: "Cupom criado com sucesso!" });
      setIsModalOpen(false);
      resetForm();
      router.refresh();
    } catch (err: any) {
      setFormError(err?.message || "Erro ao criar cupom. Verifique os dados ou o limite do seu plano.");
    } finally {
      setIsSaving(false);
    }
  };

  // Formatação de desconto
  const renderDiscountBadge = (coupon: CouponItem) => {
    const isPercentage = coupon.discountType === "percentage";
    const numVal = parseFloat(coupon.discountValue);
    const label = isPercentage
      ? `${numVal}% OFF`
      : `R$ ${numVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} OFF`;

    return (
      <span className="font-extrabold text-[#f4f4f5] text-sm tabular-nums">
        {label}
      </span>
    );
  };

  // Formatação de pedido mínimo
  const getMinOrderText = (coupon: CouponItem) => {
    if (!coupon.minOrderValue || parseFloat(coupon.minOrderValue) <= 0) {
      return "Sem mínimo";
    }
    return `Mínimo de R$ ${parseFloat(coupon.minOrderValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6 w-full min-w-0 pb-16">
      {/* Toast Notification */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
          duration={3500}
        />
      )}

      {/* 1. Header Padronizado V2 */}
      {!hideHeader && (
        <PageHeader
          title="Cupons de desconto"
          subtitle="Crie e gerencie códigos promocionais para seus clientes resgatarem no carrinho."
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums bg-[#3b82f6]/15 text-[#60a5fa] border border-[#3b82f6]/30">
              {couponsList.length} {couponsList.length === 1 ? "cupom" : "cupons"}
            </span>
          }
          actions={
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
            >
              Criar cupom
            </Button>
          }
        />
      )}

      {/* 2. Métricas / Indicadores Compactos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total de Cupons"
          value={stats.total}
          accent="blue"
          icon={<Tag className="w-5 h-5" />}
          subtext="Cupons cadastrados"
        />
        <StatCard
          label="Cupons Ativos"
          value={stats.active}
          accent="green"
          icon={<CheckCircle2 className="w-5 h-5" />}
          subtext="Prontos para uso"
        />
        <StatCard
          label="Cupons Inativos"
          value={stats.inactive}
          accent="zinc"
          icon={<AlertCircle className="w-5 h-5" />}
          subtext="Pausados ou expirados"
        />
        <StatCard
          label="Total de Resgates"
          value={stats.totalUses}
          accent="amber"
          icon={<TrendingUp className="w-5 h-5" />}
          subtext="Utilizações registradas"
        />
      </div>

      {/* 3. Toolbar Completa e Responsiva */}
      <Toolbar
        searchSlot={
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery("")}
            placeholder={`Buscar por código em ${couponsList.length} cupons...`}
          />
        }
        filterSlot={
          <>
            {/* Filtro por Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por Status"
              className="h-10 bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-xs text-[#f4f4f5] rounded-xl px-3 transition-colors outline-none cursor-pointer"
            >
              <option value="all">Todos os Status</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>

            {/* Filtro por Tipo de Desconto */}
            <select
              value={discountTypeFilter}
              onChange={(e) => setDiscountTypeFilter(e.target.value)}
              aria-label="Filtrar por Tipo de Desconto"
              className="h-10 bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-xs text-[#f4f4f5] rounded-xl px-3 transition-colors outline-none cursor-pointer"
            >
              <option value="all">Todos os Tipos</option>
              <option value="percentage">Porcentagem (%)</option>
              <option value="fixed">Valor Fixo (R$)</option>
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
              {filteredCoupons.length} de {couponsList.length}
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

      {/* 4. Conteúdo: Grade, Lista ou Empty State */}
      {filteredCoupons.length === 0 ? (
        <EmptyState
          icon={couponsList.length === 0 ? <Ticket className="w-8 h-8" /> : <Search className="w-8 h-8" />}
          title={couponsList.length === 0 ? "Nenhum cupom cadastrado" : "Nenhum cupom encontrado"}
          description={
            couponsList.length === 0
              ? "Crie seu primeiro cupom de desconto para impulsionar suas vendas e atrair novos clientes no Telegram."
              : "Nenhum cupom corresponde aos critérios da busca ou aos filtros selecionados. Tente ajustar os termos."
          }
          action={
            couponsList.length === 0
              ? {
                  label: "Criar cupom",
                  icon: <Plus className="w-4 h-4" />,
                  onClick: () => {
                    resetForm();
                    setIsModalOpen(true);
                  },
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCoupons.map((coupon) => {
            const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
            const isLimitReached = Boolean(coupon.maxUses && coupon.usedCount >= coupon.maxUses);
            const isEffectivelyActive = coupon.status === "active" && !isExpired && !isLimitReached;

            const menuItems = [
              {
                id: "toggle",
                label: coupon.status === "active" ? "Desativar cupom" : "Ativar cupom",
                icon: <Power className="w-4 h-4 text-[#9a9aa2]" />,
                onClick: () => handleToggleStatus(coupon),
              },
              {
                id: "copy",
                label: "Copiar código",
                icon: <Copy className="w-4 h-4 text-[#9a9aa2]" />,
                onClick: () => handleCopyCode(coupon.code),
              },
              {
                id: "delete",
                label: "Excluir cupom",
                icon: <Trash2 className="w-4 h-4 text-[#f87171]" />,
                danger: true,
                onClick: () => setCouponToDelete(coupon),
              },
            ];

            return (
              <Card
                key={coupon.id}
                padding="md"
                interactive
                className="flex flex-col justify-between space-y-4"
              >
                {/* Topo do Card: Código + Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-bold text-sm tracking-wider text-[#f4f4f5] bg-[#3b82f6]/10 border border-[#3b82f6]/25 px-2.5 py-1 rounded-xl flex items-center gap-1.5 truncate">
                      <Tag className="w-3.5 h-3.5 text-[#60a5fa] shrink-0" />
                      <span className="truncate">{coupon.code}</span>
                    </span>
                    <IconButton
                      size="sm"
                      variant="ghost"
                      aria-label="Copiar código do cupom"
                      icon={
                        copiedCode === coupon.code ? (
                          <Check className="w-3.5 h-3.5 text-[#4ade80]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-[#71717a]" />
                        )
                      }
                      onClick={() => handleCopyCode(coupon.code)}
                      className="hover:text-white"
                    />
                  </div>

                  <div className="shrink-0">
                    {isEffectivelyActive ? (
                      <Chip size="sm" variant="active" label="Ativo" />
                    ) : isExpired ? (
                      <Chip size="sm" variant="danger" label="Expirado" />
                    ) : isLimitReached ? (
                      <Chip size="sm" variant="warning" label="Esgotado" />
                    ) : (
                      <Chip size="sm" variant="inactive" label="Inativo" />
                    )}
                  </div>
                </div>

                {/* Valor do Desconto e Condição de Pedido */}
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    {renderDiscountBadge(coupon)}
                    <span className="text-[11px] text-[#71717a] font-medium">
                      {coupon.discountType === "percentage" ? "Percentual" : "Fixo"}
                    </span>
                  </div>
                  <p className="text-xs text-[#9a9aa2]">{getMinOrderText(coupon)}</p>
                </div>

                {/* Usos e Validade */}
                <div className="pt-2 border-t border-[#26262a] space-y-1.5 text-xs text-[#9a9aa2]">
                  <div className="flex items-center justify-between">
                    <span>Utilizações:</span>
                    <span className="font-semibold text-[#f4f4f5] tabular-nums">
                      {coupon.usedCount}
                      <span className="text-[#71717a] font-normal">
                        {coupon.maxUses ? ` / ${coupon.maxUses}` : " (Sem limite)"}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#71717a]" />
                      Validade:
                    </span>
                    <span
                      className={`tabular-nums ${
                        isExpired ? "text-[#f87171] font-semibold" : "text-[#f4f4f5]"
                      }`}
                    >
                      {coupon.expiresAt ? formatBusinessDate(coupon.expiresAt) : "Indeterminada"}
                    </span>
                  </div>
                </div>

                {/* Rodapé de Ações */}
                <div className="pt-3 border-t border-[#26262a] flex items-center justify-between gap-2">
                  <Button
                    variant={coupon.status === "active" ? "outline" : "secondary"}
                    size="sm"
                    onClick={() => handleToggleStatus(coupon)}
                    isLoading={togglingId === coupon.id}
                    leftIcon={<Power className="w-3.5 h-3.5" />}
                    className="flex-1 text-xs"
                  >
                    {coupon.status === "active" ? "Desativar" : "Ativar"}
                  </Button>
                  <RowMenu items={menuItems} ariaLabel={`Ações para cupom ${coupon.code}`} />
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Visualização em Lista / Tabela Responsiva */
        <Card padding="none" className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-[#26262a] bg-[#111113] text-[11px] uppercase tracking-wider text-[#9a9aa2] font-semibold">
                <th className="py-3.5 px-6">Código do Cupom</th>
                <th className="py-3.5 px-4">Desconto</th>
                <th className="py-3.5 px-4">Pedido Mínimo</th>
                <th className="py-3.5 px-4">Utilizações</th>
                <th className="py-3.5 px-4">Validade</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26262a] text-xs">
              {filteredCoupons.map((coupon) => {
                const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
                const isLimitReached = Boolean(coupon.maxUses && coupon.usedCount >= coupon.maxUses);
                const isEffectivelyActive = coupon.status === "active" && !isExpired && !isLimitReached;

                const menuItems = [
                  {
                    id: "toggle",
                    label: coupon.status === "active" ? "Desativar cupom" : "Ativar cupom",
                    icon: <Power className="w-4 h-4 text-[#9a9aa2]" />,
                    onClick: () => handleToggleStatus(coupon),
                  },
                  {
                    id: "copy",
                    label: "Copiar código",
                    icon: <Copy className="w-4 h-4 text-[#9a9aa2]" />,
                    onClick: () => handleCopyCode(coupon.code),
                  },
                  {
                    id: "delete",
                    label: "Excluir cupom",
                    icon: <Trash2 className="w-4 h-4 text-[#f87171]" />,
                    danger: true,
                    onClick: () => setCouponToDelete(coupon),
                  },
                ];

                return (
                  <tr key={coupon.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Código */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm tracking-wider text-[#f4f4f5] bg-[#3b82f6]/10 border border-[#3b82f6]/25 px-2.5 py-1 rounded-xl flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-[#60a5fa]" />
                          {coupon.code}
                        </span>
                        <IconButton
                          size="sm"
                          variant="ghost"
                          aria-label="Copiar código"
                          icon={
                            copiedCode === coupon.code ? (
                              <Check className="w-3.5 h-3.5 text-[#4ade80]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-[#71717a]" />
                            )
                          }
                          onClick={() => handleCopyCode(coupon.code)}
                        />
                      </div>
                    </td>

                    {/* Desconto */}
                    <td className="py-4 px-4">{renderDiscountBadge(coupon)}</td>

                    {/* Pedido Mínimo */}
                    <td className="py-4 px-4 text-[#9a9aa2]">{getMinOrderText(coupon)}</td>

                    {/* Usos */}
                    <td className="py-4 px-4">
                      <span className="font-bold text-[#f4f4f5] tabular-nums">{coupon.usedCount}</span>
                      <span className="text-[#71717a]">
                        {coupon.maxUses ? ` / ${coupon.maxUses}` : " (Sem limite)"}
                      </span>
                    </td>

                    {/* Validade */}
                    <td className="py-4 px-4">
                      {coupon.expiresAt ? (
                        <div className="flex items-center gap-1.5 text-[#9a9aa2]">
                          <Calendar className="w-3.5 h-3.5 text-[#71717a]" />
                          <span className={isExpired ? "text-[#f87171] font-semibold" : ""}>
                            {formatBusinessDate(coupon.expiresAt)}
                          </span>
                          {isExpired && <Chip size="sm" variant="danger" label="Expirado" />}
                        </div>
                      ) : (
                        <span className="text-[#71717a]">Indeterminada</span>
                      )}
                    </td>

                    {/* Status Toggle */}
                    <td className="py-4 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(coupon)}
                        disabled={togglingId === coupon.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                          isEffectivelyActive
                            ? "bg-[#22c55e]/10 text-[#4ade80] border border-[#22c55e]/30 hover:bg-[#22c55e]/20"
                            : "bg-white/[0.04] text-[#71717a] border border-white/[0.08] hover:bg-white/[0.08]"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isEffectivelyActive ? "bg-[#22c55e] animate-pulse" : "bg-[#71717a]"
                          }`}
                        />
                        {isEffectivelyActive ? "Ativo" : "Inativo"}
                      </button>
                    </td>

                    {/* Ações */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <RowMenu items={menuItems} ariaLabel={`Ações para cupom ${coupon.code}`} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* 5. Modal de Criação de Cupom V2 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#0e0e10] border border-[#26262a] rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Título do Modal */}
            <div className="flex items-center justify-between border-b border-[#26262a] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center text-[#60a5fa]">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#f4f4f5]">Criar Novo Cupom</h3>
                  <p className="text-xs text-[#9a9aa2]">Configure as regras e descontos do código promocional</p>
                </div>
              </div>
              <IconButton
                size="sm"
                variant="ghost"
                icon={<X className="w-4 h-4" />}
                aria-label="Fechar modal"
                onClick={() => setIsModalOpen(false)}
              />
            </div>

            {/* Mensagem de Erro */}
            {formError && (
              <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#f87171] p-3 rounded-xl text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#f87171]" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCoupon} className="space-y-4">
              {/* Código do Cupom */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#f4f4f5]">
                  Código do Cupom <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="EX: PROMO10, BLACKFRIDAY"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-[#f4f4f5] text-xs uppercase tracking-wider font-mono placeholder:text-[#52525b] outline-none transition-colors"
                />
              </div>

              {/* Seletor Tipo de Desconto */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#f4f4f5]">
                  Tipo de Desconto <span className="text-[#ef4444]">*</span>
                </label>
                <SegmentedControl
                  value={formDiscountType}
                  onChange={(val) => setFormDiscountType(val as "percentage" | "fixed")}
                  fullWidth
                  options={[
                    {
                      id: "percentage",
                      label: "Porcentagem (%)",
                      icon: <Percent className="w-3.5 h-3.5" />,
                    },
                    {
                      id: "fixed",
                      label: "Valor Fixo (R$)",
                      icon: <DollarSign className="w-3.5 h-3.5" />,
                    },
                  ]}
                />
              </div>

              {/* Valor do Desconto */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#f4f4f5]">
                  {formDiscountType === "percentage" ? "Porcentagem de Desconto (%)" : "Valor do Desconto (R$)"}{" "}
                  <span className="text-[#ef4444]">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={formDiscountType === "percentage" ? "100" : undefined}
                    required
                    placeholder={formDiscountType === "percentage" ? "Ex: 15" : "Ex: 25.00"}
                    value={formDiscountValue}
                    onChange={(e) => setFormDiscountValue(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-[#f4f4f5] text-xs placeholder:text-[#52525b] outline-none transition-colors"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#71717a]">
                    {formDiscountType === "percentage" ? "%" : "R$"}
                  </div>
                </div>
              </div>

              {/* Pedido Mínimo e Limite de Usos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#f4f4f5]">
                    Pedido Mínimo (R$) <span className="text-[#71717a] font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 50.00"
                    value={formMinOrderValue}
                    onChange={(e) => setFormMinOrderValue(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-[#f4f4f5] text-xs placeholder:text-[#52525b] outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#f4f4f5]">
                    Limite de Usos <span className="text-[#71717a] font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ex: 100"
                    value={formMaxUses}
                    onChange={(e) => setFormMaxUses(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-[#f4f4f5] text-xs placeholder:text-[#52525b] outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Data de Validade */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#f4f4f5]">
                  Data de Validade <span className="text-[#71717a] font-normal">(Opcional)</span>
                </label>
                <input
                  type="date"
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] text-[#f4f4f5] text-xs outline-none transition-colors"
                />
              </div>

              {/* Botões do Rodapé */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#26262a]">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSaving}
                >
                  Salvar Cupom
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal de Confirmação de Exclusão */}
      <ConfirmDialog
        isOpen={Boolean(couponToDelete)}
        onClose={() => setCouponToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Cupom"
        description={
          couponToDelete ? (
            <span>
              Tem certeza que deseja excluir o cupom{" "}
              <strong className="text-[#f4f4f5]">"{couponToDelete.code}"</strong>? Esta ação é irreversível
              e clientes não poderão mais resgatar este código no carrinho.
            </span>
          ) : (
            ""
          )
        }
        confirmLabel="Excluir cupom"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

