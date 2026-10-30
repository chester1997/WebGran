"use client";

import { useState, useMemo } from "react";
import {
  ShoppingCart,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Search,
  Store,
  User,
  Copy,
  Check,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Receipt
} from "lucide-react";

export interface OrderItem {
  id: string;
  total: number;
  status: string;
  paymentMethod: string | null;
  createdAt: string;
  storeName: string;
  customerName: string;
  customerUsername: string | null;
}

export default function OrdersClient({ initialOrders }: { initialOrders: OrderItem[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const filteredOrders = useMemo(() => {
    return initialOrders.filter((o) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        o.id.toLowerCase().includes(term) ||
        o.storeName.toLowerCase().includes(term) ||
        o.customerName.toLowerCase().includes(term) ||
        (o.customerUsername && o.customerUsername.toLowerCase().includes(term));

      const matchesStatus = statusFilter === "all" || o.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [initialOrders, searchTerm, statusFilter]);

  // Reset pagination when search or status changes
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage]);

  const totalOrders = initialOrders.length;
  const paidOrders = initialOrders.filter((o) => o.status === "paid").length;
  const pendingOrders = initialOrders.filter((o) => o.status === "pending").length;
  const totalRevenue = initialOrders
    .filter((o) => o.status === "paid")
    .reduce((acc, curr) => acc + curr.total, 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  const handleCopyId = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 pb-12 text-zinc-100 fade-in">
      {/* ==================================================== */}
      {/* 1. HEADER (Integrado ao fundo, sem caixa card) */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              Pedidos Globais
            </h1>
            <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Vendas da Plataforma
            </span>
          </div>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">
            Histórico completo e consolidado de pedidos em todas as lojas ativas
          </p>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 2. SUMMARY KPI CARDS */}
      {/* ==================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Pedidos */}
        <div className="p-4 rounded-2xl bg-[#0F1014] border border-white/[0.08] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
              Total Pedidos
            </span>
            <div className="p-2 rounded-xl border bg-white/5 border-white/[0.08] text-zinc-300 shrink-0">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-white tracking-tight block">
            {totalOrders.toLocaleString("pt-BR")}
          </span>
          <span className="text-[10px] text-zinc-500 block truncate pt-0.5">
            Todas as transações registradas
          </span>
        </div>

        {/* Pedidos Pagos */}
        <div className="p-4 rounded-2xl bg-[#0F1014] border border-white/[0.08] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
              Pedidos Pagos
            </span>
            <div className="p-2 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight block">
            {paidOrders.toLocaleString("pt-BR")}
          </span>
          <span className="text-[10px] text-zinc-500 block truncate pt-0.5">
            Pagamentos confirmados via Pix
          </span>
        </div>

        {/* Faturamento Confirmado */}
        <div className="p-4 rounded-2xl bg-[#0F1014] border border-blue-500/30 shadow-lg shadow-blue-500/5 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
              Faturamento Confirmado
            </span>
            <div className="p-2 rounded-xl border bg-blue-500/10 border-blue-500/20 text-blue-400 shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-white tracking-tight block">
            {formatCurrency(totalRevenue)}
          </span>
          <span className="text-[10px] text-zinc-500 block truncate pt-0.5">
            Volume bruto de pedidos aprovados
          </span>
        </div>

        {/* Pendentes */}
        <div className="p-4 rounded-2xl bg-[#0F1014] border border-white/[0.08] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
              Pendentes
            </span>
            <div className="p-2 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-400 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight block">
            {pendingOrders.toLocaleString("pt-BR")}
          </span>
          <span className="text-[10px] text-zinc-500 block truncate pt-0.5">
            Aguardando pagamento no gateway
          </span>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 3. TOOLBAR: SEARCH & STATUS FILTER */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#0F1014] rounded-2xl border border-white/[0.08]">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por ID do pedido, cliente ou loja..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-8 py-2 bg-[#15171D] border border-white/[0.08] focus:border-blue-500 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm("");
                setCurrentPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
          {[
            { id: "all", label: "Todos" },
            { id: "paid", label: "Pagos" },
            { id: "pending", label: "Pendentes" },
            { id: "cancelled", label: "Cancelados" }
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => {
                setStatusFilter(st.id);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                statusFilter === st.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white bg-[#15171D] hover:bg-white/[0.04] border border-white/[0.06]"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* ==================================================== */}
      {/* 4. ORDERS TABLE */}
      {/* ==================================================== */}
      <div className="bg-[#0F1014] rounded-2xl border border-white/[0.08] overflow-hidden shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Lista de Pedidos ({filteredOrders.length})
          </h2>
          <span className="text-[11px] text-zinc-500 font-mono">
            Página {currentPage} de {totalPages}
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] text-zinc-400 text-[11px] font-semibold uppercase tracking-wider bg-white/[0.02]">
                <th className="py-3 px-4">ID Pedido</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Loja</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Data</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-xs">
              {paginatedOrders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                >
                  {/* ID */}
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={(e) => handleCopyId(order.id, e)}
                      title="Clique para copiar ID completo"
                      className="inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-300 bg-[#15171D] hover:bg-white/10 px-2 py-1 rounded-lg border border-white/[0.08] transition-colors"
                    >
                      <span>#{order.id.slice(0, 8)}</span>
                      {copiedId === order.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300" />
                      )}
                    </button>
                  </td>

                  {/* Cliente */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
                        {(order.customerName?.[0] || "C").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-white block truncate max-w-[140px] sm:max-w-[180px]">
                          {order.customerName}
                        </span>
                        {order.customerUsername && (
                          <span className="text-[10px] text-blue-400 block truncate">
                            @{order.customerUsername}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Loja */}
                  <td className="py-3 px-4">
                    <div className="inline-flex items-center gap-1.5 text-zinc-300 font-medium">
                      <Store className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate max-w-[140px]">{order.storeName}</span>
                    </div>
                  </td>

                  {/* Valor */}
                  <td className="py-3 px-4 text-right font-black text-emerald-400 text-sm">
                    {formatCurrency(order.total)}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    <OrderStatusBadge status={order.status} />
                  </td>

                  {/* Data */}
                  <td className="py-3 px-4 text-right text-zinc-400 font-mono text-[11px]">
                    {order.createdAt}
                  </td>

                  {/* Ações */}
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(order);
                      }}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-blue-600/20 text-zinc-400 hover:text-blue-300 transition-colors cursor-pointer"
                      title="Ver Detalhes do Pedido"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Receipt className="w-8 h-8 text-zinc-600" />
                      <p className="text-xs text-zinc-400 font-medium">
                        Nenhum pedido encontrado com os filtros selecionados.
                      </p>
                      {(searchTerm || statusFilter !== "all") && (
                        <button
                          onClick={() => {
                            setSearchTerm("");
                            setStatusFilter("all");
                            setCurrentPage(1);
                          }}
                          className="text-xs font-semibold text-blue-400 hover:text-blue-300 underline cursor-pointer"
                        >
                          Limpar busca e filtros
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3.5 border-t border-white/[0.06] text-xs">
            <span className="text-zinc-500 text-[11px]">
              Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
              {Math.min(currentPage * itemsPerPage, filteredOrders.length)} de {filteredOrders.length} pedidos
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-[#15171D] border border-white/[0.08] text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                aria-label="Página anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="px-2.5 py-1 rounded-lg bg-white/5 text-[11px] font-mono text-zinc-300">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-[#15171D] border border-white/[0.08] text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                aria-label="Próxima página"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 5. ORDER DETAILS MODAL */}
      {/* ==================================================== */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedOrder(null)}
          />

          <div className="relative w-full max-w-lg bg-[#0F1014] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in-0 zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-[#0F1014]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Detalhes do Pedido</h3>
                  <p className="text-[11px] text-zinc-400 font-mono">#{selectedOrder.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Order Amount & Status Banner */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#15171D] border border-white/[0.06]">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Valor do Pedido</span>
                  <span className="text-2xl font-black text-emerald-400">
                    {formatCurrency(selectedOrder.total)}
                  </span>
                </div>
                <OrderStatusBadge status={selectedOrder.status} />
              </div>

              {/* Information Grid */}
              <div className="space-y-2.5">
                {/* ID Completo */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-zinc-400">ID Completo:</span>
                  <div className="flex items-center gap-1.5 font-mono text-zinc-200">
                    <span className="truncate max-w-[200px]">{selectedOrder.id}</span>
                    <button
                      onClick={() => handleCopyId(selectedOrder.id)}
                      className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
                      title="Copiar ID"
                    >
                      {copiedId === selectedOrder.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Cliente */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-zinc-400">Cliente:</span>
                  <div className="text-right">
                    <span className="font-bold text-white block">{selectedOrder.customerName}</span>
                    {selectedOrder.customerUsername && (
                      <span className="text-[10px] text-blue-400 block">@{selectedOrder.customerUsername}</span>
                    )}
                  </div>
                </div>

                {/* Loja */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-zinc-400">Loja de Origem:</span>
                  <span className="font-semibold text-white">{selectedOrder.storeName}</span>
                </div>

                {/* Método de Pagamento */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-zinc-400">Forma de Pagamento:</span>
                  <span className="font-mono text-zinc-200 uppercase">
                    {selectedOrder.paymentMethod || "PIX"}
                  </span>
                </div>

                {/* Data e Hora */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-zinc-400">Data e Hora:</span>
                  <span className="font-mono text-zinc-200">{selectedOrder.createdAt}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end px-5 py-3 border-t border-white/[0.08] bg-[#0F1014]">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "paid") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="w-2.5 h-2.5" />
        Pago
      </span>
    );
  }
  if (s === "pending") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <Clock className="w-2.5 h-2.5" />
        Pendente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
      <XCircle className="w-2.5 h-2.5" />
      {s === "cancelled" ? "Cancelado" : status}
    </span>
  );
}
