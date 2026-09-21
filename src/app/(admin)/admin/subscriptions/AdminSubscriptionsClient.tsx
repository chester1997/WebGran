"use client";

import { useState } from "react";
import { 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Search, 
  CreditCard,
  Calendar,
  ExternalLink,
  ShieldAlert
} from "lucide-react";

interface InvoiceItem {
  id: string;
  sellerName: string;
  sellerEmail: string;
  amount: number;
  status: string;
  externalId: string;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string | null;
}

interface AdminSubscriptionsClientProps {
  metrics: {
    monthlyRevenue: number;
    activeSubscriptionsCount: number;
    pendingCount: number;
    expiredCount: number;
  };
  invoices: InvoiceItem[];
}

export default function AdminSubscriptionsClient({
  metrics,
  invoices
}: AdminSubscriptionsClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch = 
      inv.sellerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.sellerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.externalId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-8 fade-in">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272A] pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-emerald-500" />
            Assinaturas WebGran SaaS (Mercado Pago)
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Acompanhamento em tempo real das mensalidades de R$ 89,90 recebidas no Mercado Pago.
          </p>
        </div>
      </div>

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Faturamento este Mês */}
        <div className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] shadow-xl flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Faturamento Este Mês</p>
            <p className="text-xl font-black text-emerald-400 mt-0.5">
              R$ {metrics.monthlyRevenue.toFixed(2).replace(".", ",")}
            </p>
          </div>
        </div>

        {/* Card 2: Assinaturas Ativas */}
        <div className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] shadow-xl flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Assinaturas Ativas</p>
            <p className="text-xl font-black text-white mt-0.5">
              {metrics.activeSubscriptionsCount}
            </p>
          </div>
        </div>

        {/* Card 3: Pagamentos Pendentes */}
        <div className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] shadow-xl flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Pagamentos Pendentes</p>
            <p className="text-xl font-black text-amber-400 mt-0.5">
              {metrics.pendingCount}
            </p>
          </div>
        </div>

        {/* Card 4: Pagamentos Expirados */}
        <div className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] shadow-xl flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-zinc-800 border border-white/10 text-zinc-400">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Pagamentos Expirados</p>
            <p className="text-xl font-black text-gray-300 mt-0.5">
              {metrics.expiredCount}
            </p>
          </div>
        </div>
      </div>

      {/* INVOICES TABLE SECTION */}
      <div className="bg-[#141416] border border-[#27272A] rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">Histórico de Cobranças de Assinatura</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Todas as transações PIX geradas para a mensalidade WebGran.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar vendedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#18181B] border border-[#27272A] rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">Todos os Status</option>
              <option value="PAID">Pagos</option>
              <option value="PENDING">Pendentes</option>
              <option value="EXPIRED">Expirados</option>
              <option value="CANCELLED">Cancelados</option>
              <option value="FAILED">Falhos</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-[#27272A] rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#27272A] text-[11px] font-semibold uppercase tracking-wider text-gray-400 bg-[#18181B]">
                <th className="py-3.5 px-4">Vendedor</th>
                <th className="py-3.5 px-4">Valor</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4">ID Mercado Pago</th>
                <th className="py-3.5 px-4">Criado em</th>
                <th className="py-3.5 px-4">Pago em</th>
                <th className="py-3.5 px-4">Expiração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272A] text-xs">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-500">
                    Nenhuma cobrança encontrada.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-white">{inv.sellerName}</p>
                      <p className="text-[11px] text-gray-400">{inv.sellerEmail}</p>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-emerald-400">
                      R$ {inv.amount.toFixed(2).replace(".", ",")}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {inv.status === "PAID" && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold">
                          PAID
                        </span>
                      )}
                      {inv.status === "PENDING" && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold">
                          PENDING
                        </span>
                      )}
                      {inv.status === "EXPIRED" && (
                        <span className="px-2.5 py-1 rounded-full bg-zinc-800 border border-white/10 text-gray-400 text-[11px] font-bold">
                          EXPIRED
                        </span>
                      )}
                      {inv.status === "CANCELLED" && (
                        <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-bold">
                          CANCELLED
                        </span>
                      )}
                      {inv.status === "FAILED" && (
                        <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-bold">
                          FAILED
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-gray-300 text-[11px]">
                      {inv.externalId}
                    </td>

                    <td className="py-3.5 px-4 text-gray-300 text-[11px]">
                      {formatDate(inv.createdAt)}
                    </td>

                    <td className="py-3.5 px-4 text-emerald-400 text-[11px] font-medium">
                      {formatDate(inv.paidAt)}
                    </td>

                    <td className="py-3.5 px-4 text-gray-400 text-[11px]">
                      {formatDate(inv.expiresAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
