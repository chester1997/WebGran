"use client";

import { useState } from "react";
import { ShoppingCart, DollarSign, CheckCircle2, Clock, AlertCircle, XCircle, Search, Store, User } from "lucide-react";

interface OrderItem {
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

  const filteredOrders = initialOrders.filter((o) => {
    const matchesSearch =
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.customerUsername && o.customerUsername.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === "all" || o.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const totalOrders = initialOrders.length;
  const paidOrders = initialOrders.filter((o) => o.status === "paid").length;
  const pendingOrders = initialOrders.filter((o) => o.status === "pending").length;
  const totalRevenue = initialOrders
    .filter((o) => o.status === "paid")
    .reduce((acc, curr) => acc + curr.total, 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Pedidos Globais</h1>
            <span className="px-2.5 py-1 text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full">
              Vendas da Plataforma
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Histórico completo de pedidos realizados em todas as lojas
          </p>
        </div>

        {/* SEARCH INPUT */}
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por ID, cliente ou loja..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#18181B] border border-[#27272A] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Total de Pedidos</span>
            <span className="text-3xl font-black text-white mt-1 block">{totalOrders}</span>
          </div>
          <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-400">
            <ShoppingCart className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Pedidos Pagos</span>
            <span className="text-3xl font-black text-emerald-400 mt-1 block">{paidOrders}</span>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Faturamento Acumulado</span>
            <span className="text-3xl font-black text-emerald-400 mt-1 block">{formatCurrency(totalRevenue)}</span>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Pendentes</span>
            <span className="text-3xl font-black text-amber-400 mt-1 block">{pendingOrders}</span>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ORDERS TABLE CONTAINER */}
      <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-base font-bold text-white">Lista de Pedidos</h2>

          {/* STATUS FILTER PILLS */}
          <div className="flex items-center gap-1.5 bg-[#18181B] p-1 rounded-xl border border-[#27272A] overflow-x-auto">
            {[
              { id: "all", label: "Todos" },
              { id: "paid", label: "Pagos" },
              { id: "pending", label: "Pendentes" },
              { id: "cancelled", label: "Cancelados" }
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  statusFilter === st.id
                    ? "bg-orange-600 text-white shadow-md shadow-orange-900/30"
                    : "text-gray-400 hover:text-white hover:bg-[#27272A]/50"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#27272A] text-gray-400 text-xs font-semibold">
                <th className="pb-3 px-3">ID Pedido</th>
                <th className="pb-3 px-3">Cliente</th>
                <th className="pb-3 px-3">Loja</th>
                <th className="pb-3 px-3 text-right">Valor</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3 text-right">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272A]/50 text-xs">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-[#18181B]/60 transition-colors">
                  <td className="py-3.5 px-3">
                    <span className="font-mono text-[11px] text-gray-300 bg-[#18181B] px-2 py-1 rounded border border-[#27272A]">
                      #{order.id.slice(0, 8)}
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <div>
                        <span className="font-bold text-white block">{order.customerName}</span>
                        {order.customerUsername && (
                          <span className="text-[10px] text-sky-400 block">@{order.customerUsername}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-1.5 text-gray-300 font-semibold">
                      <Store className="w-3.5 h-3.5 text-purple-400" />
                      <span>{order.storeName}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-right font-black text-emerald-400 text-sm">
                    {formatCurrency(order.total)}
                  </td>
                  <td className="py-3.5 px-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="py-3.5 px-3 text-right text-gray-400 font-medium">
                    {order.createdAt}
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 text-xs">
                    Nenhum pedido encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
        <AlertCircle className="w-2.5 h-2.5" />
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
