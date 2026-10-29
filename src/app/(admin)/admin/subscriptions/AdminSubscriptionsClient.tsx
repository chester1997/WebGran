"use client";

import { useState, useMemo } from "react";
import {
  DollarSign,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  CreditCard,
  Calendar,
  Copy,
  Check,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Receipt
} from "lucide-react";

export interface InvoiceItem {
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
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        inv.sellerName.toLowerCase().includes(term) ||
        inv.sellerEmail.toLowerCase().includes(term) ||
        inv.externalId.toLowerCase().includes(term) ||
        inv.id.toLowerCase().includes(term);

      const matchesStatus = statusFilter === "ALL" || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage) || 1;
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(start, start + itemsPerPage);
  }, [filteredInvoices, currentPage]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  };

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
              Assinaturas WebGran SaaS
            </h1>
            <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Plataforma WebGran
            </span>
          </div>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">
            Acompanhamento em tempo real das mensalidades e cobranças de assinatura recebidas pela plataforma
          </p>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 2. SUMMARY KPI CARDS */}
      {/* ==================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Faturamento Este Mês */}
        <div className="p-4 rounded-2xl bg-[#14141B] border border-blue-500/30 shadow-lg shadow-blue-500/5 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
              Faturamento no Mês
            </span>
            <div className="p-2 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight block">
            {formatCurrency(metrics.monthlyRevenue)}
          </span>
          <span className="text-[10px] text-zinc-500 block truncate pt-0.5">
            Mensalidades confirmadas no mês
          </span>
        </div>

        {/* Assinaturas Ativas */}
        <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
              Assinaturas Ativas
            </span>
            <div className="p-2 rounded-xl border bg-blue-500/10 border-blue-500/20 text-blue-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-white tracking-tight block">
            {metrics.activeSubscriptionsCount}
          </span>
          <span className="text-[10px] text-zinc-500 block truncate pt-0.5">
            Vendedores com plano vigente
          </span>
        </div>

        {/* Pagamentos Pendentes */}
        <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
              Pendentes
            </span>
            <div className="p-2 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-400 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight block">
            {metrics.pendingCount}
          </span>
          <span className="text-[10px] text-zinc-500 block truncate pt-0.5">
            Aguardando pagamento Pix
          </span>
        </div>

        {/* Pagamentos Expirados */}
        <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
              Expirados
            </span>
            <div className="p-2 rounded-xl border bg-white/5 border-white/[0.08] text-zinc-400 shrink-0">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-zinc-300 tracking-tight block">
            {metrics.expiredCount}
          </span>
          <span className="text-[10px] text-zinc-500 block truncate pt-0.5">
            Cobranças com prazo encerrado
          </span>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 3. TOOLBAR: SEARCH & STATUS FILTER */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#111116] rounded-2xl border border-white/[0.08]">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por vendedor, e-mail ou ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-8 py-2 bg-[#16161D] border border-white/[0.08] focus:border-blue-500 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
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
            { id: "ALL", label: "Todas" },
            { id: "PAID", label: "Pagas" },
            { id: "PENDING", label: "Pendentes" },
            { id: "EXPIRED", label: "Expiradas" },
            { id: "CANCELLED", label: "Canceladas" }
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
                  : "text-zinc-400 hover:text-white bg-[#16161D] hover:bg-white/[0.04] border border-white/[0.06]"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* ==================================================== */}
      {/* 4. INVOICES TABLE */}
      {/* ==================================================== */}
      <div className="bg-[#111116] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Histórico de Cobranças ({filteredInvoices.length})
          </h2>
          <span className="text-[11px] text-zinc-500 font-mono">
            Página {currentPage} de {totalPages}
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] text-[11px] font-semibold uppercase tracking-wider text-zinc-400 bg-white/[0.02]">
                <th className="py-3 px-4">Vendedor</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">ID da Cobrança</th>
                <th className="py-3 px-4">Criado em</th>
                <th className="py-3 px-4">Pago em</th>
                <th className="py-3 px-4">Expiração</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-xs">
              {paginatedInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => setSelectedInvoice(inv)}
                  className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                >
                  {/* Vendedor */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
                        {(inv.sellerName?.[0] || "V").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white block truncate max-w-[140px] sm:max-w-[180px]">
                          {inv.sellerName}
                        </p>
                        <p className="text-[10px] text-zinc-400 font-mono truncate max-w-[140px] sm:max-w-[180px]">
                          {inv.sellerEmail}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Valor */}
                  <td className="py-3 px-4 text-right font-black text-emerald-400 font-mono text-sm">
                    {formatCurrency(inv.amount)}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>

                  {/* ID Cobrança */}
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={(e) => handleCopyId(inv.externalId || inv.id, e)}
                      title="Clique para copiar ID"
                      className="inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-300 bg-[#16161D] hover:bg-white/10 px-2 py-1 rounded-lg border border-white/[0.08] transition-colors"
                    >
                      <span className="truncate max-w-[120px]">{inv.externalId || inv.id.slice(0, 10)}</span>
                      {copiedId === (inv.externalId || inv.id) ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300" />
                      )}
                    </button>
                  </td>

                  {/* Criado em */}
                  <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">
                    {formatDate(inv.createdAt)}
                  </td>

                  {/* Pago em */}
                  <td className="py-3 px-4 text-emerald-400 font-mono text-[11px] font-medium">
                    {formatDate(inv.paidAt)}
                  </td>

                  {/* Expiração */}
                  <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                    {formatDate(inv.expiresAt)}
                  </td>

                  {/* Ações */}
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedInvoice(inv);
                      }}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-blue-600/20 text-zinc-400 hover:text-blue-300 transition-colors cursor-pointer"
                      title="Ver Detalhes da Cobrança"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Receipt className="w-8 h-8 text-zinc-600" />
                      <p className="text-xs text-zinc-400 font-medium">
                        Nenhuma cobrança de assinatura encontrada.
                      </p>
                      {(searchTerm || statusFilter !== "ALL") && (
                        <button
                          onClick={() => {
                            setSearchTerm("");
                            setStatusFilter("ALL");
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
              {Math.min(currentPage * itemsPerPage, filteredInvoices.length)} de {filteredInvoices.length} cobranças
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-[#16161D] border border-white/[0.08] text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
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
                className="p-1.5 rounded-lg bg-[#16161D] border border-white/[0.08] text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                aria-label="Próxima página"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 5. INVOICE DETAILS MODAL */}
      {/* ==================================================== */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedInvoice(null)}
          />

          <div className="relative w-full max-w-md bg-[#111116] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in-0 zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-[#14141B]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Detalhes da Cobrança</h3>
                  <p className="text-[11px] text-zinc-400 font-mono">#{selectedInvoice.id.slice(0, 12)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Amount & Status Banner */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#141418] border border-white/[0.06]">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Valor da Mensalidade</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    {formatCurrency(selectedInvoice.amount)}
                  </span>
                </div>
                <InvoiceStatusBadge status={selectedInvoice.status} />
              </div>

              {/* Information Grid */}
              <div className="space-y-2.5">
                {/* Vendedor */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-zinc-400">Vendedor:</span>
                  <div className="text-right">
                    <span className="font-bold text-white block">{selectedInvoice.sellerName}</span>
                    <span className="text-[10px] text-zinc-400 font-mono block">{selectedInvoice.sellerEmail}</span>
                  </div>
                </div>

                {/* ID Externo / Gateway */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-zinc-400">ID da Transação:</span>
                  <div className="flex items-center gap-1.5 font-mono text-zinc-200">
                    <span className="truncate max-w-[180px]">{selectedInvoice.externalId || selectedInvoice.id}</span>
                    <button
                      onClick={() => handleCopyId(selectedInvoice.externalId || selectedInvoice.id)}
                      className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
                      title="Copiar ID"
                    >
                      {copiedId === (selectedInvoice.externalId || selectedInvoice.id) ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Criado em */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-zinc-400">Criado em:</span>
                  <span className="font-mono text-zinc-200">{formatDate(selectedInvoice.createdAt)}</span>
                </div>

                {/* Pago em */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-zinc-400">Pago em:</span>
                  <span className="font-mono text-emerald-400 font-medium">
                    {formatDate(selectedInvoice.paidAt)}
                  </span>
                </div>

                {/* Expiração */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-zinc-400">Data de Expiração:</span>
                  <span className="font-mono text-zinc-400">{formatDate(selectedInvoice.expiresAt)}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end px-5 py-3 border-t border-white/[0.08] bg-[#14141B]">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
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

function InvoiceStatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s === "PAID") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="w-2.5 h-2.5" />
        Pago
      </span>
    );
  }
  if (s === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <Clock className="w-2.5 h-2.5" />
        Pendente
      </span>
    );
  }
  if (s === "EXPIRED") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-zinc-400 border border-white/[0.08]">
        <XCircle className="w-2.5 h-2.5" />
        Expirado
      </span>
    );
  }
  if (s === "CANCELLED") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
        <XCircle className="w-2.5 h-2.5" />
        Cancelado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
      <XCircle className="w-2.5 h-2.5" />
      {s === "FAILED" ? "Falha" : status}
    </span>
  );
}
