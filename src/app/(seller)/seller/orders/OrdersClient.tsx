"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { 
  Search, 
  ShoppingCart, 
  ArrowRight, 
  Check, 
  Clock, 
  XCircle, 
  Download,
  X
} from "lucide-react";
import SellerPageHeader from "@/components/layout/SellerPageHeader";
import { RetryDeliveryButton } from "./RetryDeliveryButton";
import { formatBusinessDateTime } from "@/lib/analytics/timezone-utils";

export interface SerializedOrder {
  id: string;
  createdAt: string;
  total: number | string;
  status: string;
  customer: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    photoUrl?: string | null;
  } | null;
  accesses: Array<{
    id: string;
    deliveryStatus?: string | null;
    status?: string | null;
    telegramChatId?: string | null;
    deliveryError?: string | null;
    product?: {
      id: string;
      title: string;
    } | null;
  }>;
}

interface OrdersClientProps {
  initialOrders: SerializedOrder[];
}

/**
 * Escapa um valor individual para CSV em estrita conformidade com o RFC 4180:
 * - Duplica quaisquer aspas duplas internas (") -> ("").
 * - Envolve o valor em aspas duplas para suportar com segurança vírgulas, quebras de linha e caracteres especiais.
 */
export function escapeRFC4180(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Gera o payload CSV completo dos pedidos com BOM UTF-8 (\uFEFF) e CRLF (\r\n) conforme RFC 4180.
 */
export function buildOrdersCSV(orders: SerializedOrder[]): string {
  const headers = ["ID Pedido", "Cliente", "Data", "Total (R$)", "Status", "Status Entrega"];
  const headerLine = headers.map(escapeRFC4180).join(",");

  const rows = orders.map((o) => {
    const access = o.accesses?.[0];
    const customerName = `${o.customer?.firstName || ""} ${o.customer?.lastName || ""}`.trim() || "Cliente";
    const totalFormatted = Number(o.total || 0).toFixed(2);
    const deliveryStatus = access?.deliveryStatus || access?.status || "—";
    return [
      escapeRFC4180(o.id),
      escapeRFC4180(customerName),
      escapeRFC4180(formatBusinessDateTime(o.createdAt)),
      escapeRFC4180(totalFormatted),
      escapeRFC4180(o.status),
      escapeRFC4180(deliveryStatus),
    ].join(",");
  });

  const BOM = "\uFEFF";
  return BOM + [headerLine, ...rows].join("\r\n");
}

export function OrdersClient({ initialOrders = [] }: OrdersClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending" | "cancelled">("all");

  const filteredOrders = useMemo(() => {
    return initialOrders.filter((order) => {
      // Filtro de status
      if (statusFilter !== "all") {
        if (statusFilter === "paid" && order.status !== "paid") return false;
        if (statusFilter === "pending" && order.status !== "pending") return false;
        if (statusFilter === "cancelled" && order.status !== "cancelled" && order.status !== "failed") return false;
      }

      // Filtro de busca
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase().trim();

      const matchesId = order.id.toLowerCase().includes(query);
      const customerFullName = `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.toLowerCase();
      const matchesCustomer = customerFullName.includes(query);
      const matchesProduct = order.accesses?.some((a) => a.product?.title?.toLowerCase().includes(query));

      return matchesId || matchesCustomer || matchesProduct;
    });
  }, [initialOrders, searchQuery, statusFilter]);

  // Função para exportar CSV dos pedidos visíveis com BOM UTF-8 e Blob RFC 4180
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) return;

    const csvContent = buildOrdersCSV(filteredOrders);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `pedidos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* =========================================================================
          PORTAL HEADER (Injetado acima do painel)
         ========================================================================= */}
      <SellerPageHeader
        portalId="seller-page-header-portal"
        title="Pedidos"
        badge={
          <span className="px-2 py-0.5 rounded-full text-xs font-sans font-medium tabular-nums bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {filteredOrders.length} {filteredOrders.length === 1 ? "pedido" : "pedidos"}
          </span>
        }
        subtitle="Acompanhe as vendas e pagamentos dos seus bots em tempo real."
        actions={
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredOrders.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed border border-white/[0.08] text-xs font-medium text-zinc-200 transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-400"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span>Exportar CSV</span>
          </button>
        }
      />

      {/* =========================================================================
          BARRA DE FILTRO E BUSCA
         ========================================================================= */}
      <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Input de Busca */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="search"
            name="search"
            id="orders_search_input"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por código, cliente ou produto..."
            className="w-full bg-[var(--seller-surface-raised,#181A20)] border border-[var(--seller-border,rgba(255,255,255,0.08))] hover:border-white/20 rounded-[8px] py-2 pl-9 pr-8 text-xs text-white focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Pílulas de Status */}
        <div className="flex items-center gap-1 bg-[var(--seller-surface-raised,#181A20)] p-1 rounded-[8px] border border-[var(--seller-border,rgba(255,255,255,0.06))] self-start sm:self-auto overflow-x-auto no-scrollbar max-w-full">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors ${
              statusFilter === "all"
                ? "bg-emerald-500/15 text-emerald-400 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("paid")}
            className={`px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors ${
              statusFilter === "paid"
                ? "bg-emerald-500/15 text-emerald-400 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Aprovados
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={`px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors ${
              statusFilter === "pending"
                ? "bg-amber-500/15 text-amber-400 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Pendentes
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("cancelled")}
            className={`px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors ${
              statusFilter === "cancelled"
                ? "bg-zinc-500/20 text-zinc-300 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Cancelados
          </button>
        </div>
      </div>

      {/* =========================================================================
          DESKTOP TABLE VIEW
         ========================================================================= */}
      <div className="hidden md:block bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--seller-border,rgba(255,255,255,0.06))] text-zinc-400 text-xs font-medium bg-white/[0.01]">
                <th className="py-3 pl-5">Código</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Pagamento</th>
                <th className="py-3 px-4">Entrega</th>
                <th className="py-3 text-right pr-5">Ações</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-[var(--seller-border,rgba(255,255,255,0.04))]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-[10px] bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-500">
                        <ShoppingCart className="w-5 h-5" />
                      </div>
                      <p className="text-zinc-300 font-medium text-xs">
                        Nenhum pedido encontrado para esta busca.
                      </p>
                      <Link
                        href="/seller/store"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                      >
                        <span>Ver link do bot</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const access = order.accesses?.[0];
                  const totalFormatted = Number(order.total || 0).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  });

                  return (
                    <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Código do pedido */}
                      <td className="py-3.5 pl-5">
                        <span className="text-zinc-300 font-mono text-[11px] bg-white/[0.03] px-2 py-0.5 rounded border border-white/[0.06]">
                          #{order.id.slice(0, 8)}
                        </span>
                      </td>

                      {/* Cliente */}
                      <td className="py-3.5 px-4">
                        {order.customer ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 font-bold text-[10px] shrink-0 overflow-hidden">
                              {order.customer.photoUrl ? (
                                <img
                                  src={order.customer.photoUrl}
                                  alt=""
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                (order.customer.firstName?.[0] || "U").toUpperCase()
                              )}
                            </div>
                            <span className="text-zinc-200 font-medium truncate max-w-[150px]">
                              {order.customer.firstName} {order.customer.lastName || ""}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-500">Cliente anônimo</span>
                        )}
                      </td>

                      {/* Data */}
                      <td className="py-3.5 px-4">
                        <time
                          dateTime={order.createdAt}
                          className="text-zinc-400 font-sans tabular-nums text-xs"
                        >
                          {formatBusinessDateTime(order.createdAt)}
                        </time>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4">
                        <span className="text-emerald-400 font-sans font-semibold text-xs tabular-nums">
                          {totalFormatted}
                        </span>
                      </td>

                      {/* Status Pagamento */}
                      <td className="py-3.5 px-4">
                        {order.status === "paid" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Check className="w-3 h-3" /> Aprovado
                          </span>
                        ) : order.status === "pending" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3 h-3" /> Pendente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                            <XCircle className="w-3 h-3" /> Cancelado
                          </span>
                        )}
                      </td>

                      {/* Status Entrega */}
                      <td className="py-3.5 px-4">
                        {!access ? (
                          <span className="text-zinc-500 text-xs">—</span>
                        ) : access.deliveryStatus === "DELIVERED" || access.status === "ACTIVE" ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Entregue
                            </span>
                            {access.telegramChatId && (
                              <span className="text-[10px] text-zinc-500 font-mono">
                                Chat: {access.telegramChatId}
                              </span>
                            )}
                          </div>
                        ) : access.deliveryStatus === "PENDING" ||
                          (typeof access.deliveryStatus === "string" && access.deliveryStatus.startsWith("PROCESSING")) ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Processando
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1 items-start">
                            <span className="inline-flex items-center gap-1 text-red-400 text-xs font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              Falhou
                            </span>
                            {access.deliveryError && (
                              <span
                                className="text-[10px] text-red-400/80 max-w-[140px] truncate"
                                title={access.deliveryError}
                              >
                                {access.deliveryError}
                              </span>
                            )}
                            <RetryDeliveryButton accessId={access.id} />
                          </div>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 text-right pr-5">
                        <span className="text-[11px] text-zinc-500 font-sans tabular-nums">
                          {access?.product?.title ? access.product.title.slice(0, 16) : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          MOBILE CARDS VIEW (md:hidden - Cada linha vira um cartão empilhado)
         ========================================================================= */}
      <div className="block md:hidden space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-6 text-center space-y-3">
            <div className="w-10 h-10 rounded-[8px] bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto text-zinc-500">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <p className="text-zinc-300 font-medium text-xs">
              Nenhum pedido encontrado para esta busca.
            </p>
            <Link
              href="/seller/store"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
            >
              <span>Ver link do bot</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const access = order.accesses?.[0];
            const totalFormatted = Number(order.total || 0).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            });

            return (
              <div
                key={order.id}
                className="bg-[var(--seller-surface-raised,#181A20)] border border-[var(--seller-border,rgba(255,255,255,0.06))] rounded-[12px] p-4 space-y-3"
              >
                {/* Linha superior: Código + Pílula de status */}
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.04] pb-2.5">
                  <span className="text-zinc-300 font-mono text-[11px] bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
                    #{order.id.slice(0, 8)}
                  </span>

                  {order.status === "paid" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Check className="w-3 h-3" /> Aprovado
                    </span>
                  ) : order.status === "pending" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Clock className="w-3 h-3" /> Pendente
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                      <XCircle className="w-3 h-3" /> Cancelado
                    </span>
                  )}
                </div>

                {/* Detalhes do pedido */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-xs">Cliente</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 font-bold text-[9px] overflow-hidden shrink-0">
                        {order.customer?.photoUrl ? (
                          <img
                            src={order.customer.photoUrl}
                            alt=""
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          (order.customer?.firstName?.[0] || "U").toUpperCase()
                        )}
                      </div>
                      <span className="text-zinc-200 font-medium truncate max-w-[140px]">
                        {order.customer
                          ? `${order.customer.firstName} ${order.customer.lastName || ""}`.trim()
                          : "Cliente anônimo"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-xs">Data</span>
                    <time dateTime={order.createdAt} className="text-zinc-300 font-sans tabular-nums text-xs">
                      {formatBusinessDateTime(order.createdAt)}
                    </time>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-xs">Total</span>
                    <span className="text-emerald-400 font-sans font-bold text-xs tabular-nums">
                      {totalFormatted}
                    </span>
                  </div>

                  {access?.product?.title && (
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 text-xs">Produto</span>
                      <span className="text-zinc-300 text-xs truncate max-w-[150px]">
                        {access.product.title}
                      </span>
                    </div>
                  )}

                  {access && (
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                      <span className="text-zinc-400 text-xs">Entrega</span>
                      {access.deliveryStatus === "DELIVERED" || access.status === "ACTIVE" ? (
                        <span className="text-emerald-400 font-medium text-xs flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Entregue
                        </span>
                      ) : access.deliveryStatus === "PENDING" ||
                        (typeof access.deliveryStatus === "string" && access.deliveryStatus.startsWith("PROCESSING")) ? (
                        <span className="text-amber-400 font-medium text-xs flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Processando
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-red-400 font-medium text-xs flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            Falhou
                          </span>
                          <RetryDeliveryButton accessId={access.id} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

