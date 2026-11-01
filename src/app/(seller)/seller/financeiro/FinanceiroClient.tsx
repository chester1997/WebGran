"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  Clock,
  Search,
  RefreshCw,
  X,
  CreditCard,
  Zap,
  ArrowRight,
  Check,
  XCircle,
} from "lucide-react";
import SellerPageHeader from "@/components/layout/SellerPageHeader";
import { formatBusinessDateTime } from "@/lib/analytics/timezone-utils";

interface Metrics {
  totalBruto: number;
  totalTaxa: number;
  totalLiquido: number;
  paidCount: number;
  pendingCount: number;
}

interface Transaction {
  id: string;
  paymentId: string | null;
  paymentMethod: string;
  customerName: string;
  total: number;
  platformFee: number;
  netAmount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

interface Props {
  metrics: Metrics;
  transactions: Transaction[];
}

export default function FinanceiroClient({ metrics, transactions }: Props) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending" | "cancelled">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleRefresh = async () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const filteredTransactions = transactions.filter((t) => {
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesSearch =
      searchQuery === "" ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.paymentId && t.paymentId.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  return (
    <div className="space-y-6 w-full max-w-full pb-10">
      {/* =========================================================================
          PORTAL HEADER (Injetado acima do painel)
         ========================================================================= */}
      <SellerPageHeader
        portalId="seller-page-header-portal"
        title="Financeiro"
        badge={
          <span className="px-2 py-0.5 rounded-full text-xs font-sans font-medium tabular-nums bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {filteredTransactions.length} {filteredTransactions.length === 1 ? "registro" : "registros"}
          </span>
        }
        subtitle="Acompanhe o faturamento líquido, vendas processadas e repasses da sua loja."
        actions={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-50 border border-white/[0.08] text-xs font-medium text-zinc-200 transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-400"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Atualizar dados</span>
          </button>
        }
      />

      {/* =========================================================================
          CARDS DE MÉTRICAS (Tokens do vendedor)
         ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Saldo Líquido */}
        <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 space-y-2.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium text-zinc-400">Saldo líquido repassado</span>
            <div className="w-7 h-7 rounded-[6px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-sans tabular-nums tracking-tight">
            {formatCurrency(metrics.totalLiquido)}
          </div>
          <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Valor líquido repassado de vendas pagas</span>
          </p>
        </div>

        {/* Card 2: Vendas Processadas */}
        <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 space-y-2.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium text-zinc-400">Vendas brutas processadas</span>
            <div className="w-7 h-7 rounded-[6px] bg-white/[0.04] text-zinc-300 border border-white/[0.08] flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-sans tabular-nums tracking-tight">
            {formatCurrency(metrics.totalBruto)}
          </div>
          <p className="text-[11px] text-zinc-400">
            Total bruto acumulado das vendas pagas
          </p>
        </div>

        {/* Card 3: Status dos Pedidos */}
        <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 space-y-2.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium text-zinc-400">Status dos pedidos</span>
            <div className="w-7 h-7 rounded-[6px] bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-white font-sans tabular-nums">{metrics.paidCount}</span>
            <span className="text-xs text-emerald-400 font-medium">pagos</span>
            <span className="text-zinc-600">/</span>
            <span className="text-xl sm:text-2xl font-semibold text-zinc-400 font-sans tabular-nums">{metrics.pendingCount}</span>
            <span className="text-xs text-amber-400 font-medium">pendentes</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Volume total de transações registradas
          </p>
        </div>
      </div>

      {/* =========================================================================
          HISTÓRICO DE TRANSAÇÕES
         ========================================================================= */}
      <div className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-4 sm:p-5 space-y-4">
        {/* Controles: Busca e Filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">Histórico de transações</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Registro completo de vendas e repasses da sua loja
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Input de Busca */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                name="search"
                id="financeiro_search_input"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="Buscar por ID ou cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[var(--seller-surface-raised,#181A20)] border border-[var(--seller-border,rgba(255,255,255,0.08))] hover:border-white/20 rounded-[8px] pl-8 pr-7 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 w-full transition-all [&::-webkit-search-cancel-button]:hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Pílulas de Filtro de Status */}
            <div className="flex bg-[var(--seller-surface-raised,#181A20)] p-1 rounded-[8px] border border-[var(--seller-border,rgba(255,255,255,0.06))] text-xs self-start sm:self-auto overflow-x-auto no-scrollbar max-w-full">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 rounded-[6px] font-medium transition-colors ${
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
                className={`px-2.5 py-1 rounded-[6px] font-medium transition-colors ${
                  statusFilter === "paid"
                    ? "bg-emerald-500/15 text-emerald-400 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Pagos
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("pending")}
                className={`px-2.5 py-1 rounded-[6px] font-medium transition-colors ${
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
                className={`px-2.5 py-1 rounded-[6px] font-medium transition-colors ${
                  statusFilter === "cancelled"
                    ? "bg-zinc-500/20 text-zinc-300 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Cancelados
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            DESKTOP TABLE VIEW
           ========================================================================= */}
        <div className="hidden md:block overflow-x-auto custom-scrollbar border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[8px] bg-[var(--seller-surface-raised,#181A20)]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--seller-border,rgba(255,255,255,0.06))] text-xs font-medium text-zinc-400 bg-white/[0.01]">
                <th className="py-3 px-4">Pedido / Transação</th>
                <th className="py-3 px-4">Gateway</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4 text-right">Valor Bruto</th>
                <th className="py-3 px-4 text-right">Valor Líquido</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--seller-border,rgba(255,255,255,0.04))] text-xs">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-2">
                      <p className="text-xs text-zinc-400">
                        Nenhuma transação encontrada para os filtros selecionados.
                      </p>
                      <Link
                        href="/seller/store"
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
                      >
                        <span>Ver link do bot</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Pedido / TX */}
                    <td className="py-3.5 px-4 font-mono text-zinc-300">
                      <div className="font-medium text-white tabular-nums">#{tx.id.slice(0, 8)}</div>
                      {tx.paymentId && (
                        <div className="text-[10px] text-zinc-500 tabular-nums">TX: {tx.paymentId}</div>
                      )}
                    </td>

                    {/* Gateway */}
                    <td className="py-3.5 px-4">
                      {tx.paymentMethod === "syncpay" ? (
                        <span className="px-2 py-0.5 rounded-[6px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-medium inline-flex items-center gap-1">
                          <Zap className="w-3 h-3 text-indigo-400" />
                          SyncPay
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-[6px] bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-medium inline-flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-blue-400" />
                          Mercado Pago
                        </span>
                      )}
                    </td>

                    {/* Cliente */}
                    <td className="py-3.5 px-4 text-zinc-200 font-medium">
                      {tx.customerName}
                    </td>

                    {/* Data */}
                    <td className="py-3.5 px-4 text-zinc-400 font-sans text-xs tabular-nums">
                      <time dateTime={tx.createdAt}>{formatBusinessDateTime(tx.createdAt)}</time>
                    </td>

                    {/* Valor Bruto */}
                    <td className="py-3.5 px-4 text-right font-sans font-medium text-zinc-300 tabular-nums">
                      {formatCurrency(tx.total)}
                    </td>

                    {/* Valor Líquido */}
                    <td className="py-3.5 px-4 text-right font-sans font-semibold text-emerald-400 tabular-nums">
                      {formatCurrency(tx.netAmount)}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      {tx.status === "paid" && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium inline-flex items-center gap-1">
                          <Check className="w-3 h-3" /> Pago
                        </span>
                      )}
                      {tx.status === "pending" && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-medium inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Pendente
                        </span>
                      )}
                      {tx.status === "cancelled" && (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-500/10 border border-zinc-500/20 text-zinc-400 text-[10px] font-medium inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Cancelado
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* =========================================================================
            MOBILE CARDS VIEW (md:hidden - Linhas empilhadas em cartões)
           ========================================================================= */}
        <div className="block md:hidden space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="py-8 text-center text-zinc-400 text-xs bg-[var(--seller-surface-raised,#181A20)] rounded-[8px] border border-[var(--seller-border,rgba(255,255,255,0.06))] p-5 space-y-2">
              <p>Nenhuma transação encontrada para os filtros selecionados.</p>
              <Link
                href="/seller/store"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400"
              >
                <span>Ver link do bot</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ) : (
            filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-[var(--seller-surface-raised,#181A20)] border border-[var(--seller-border,rgba(255,255,255,0.06))] rounded-[12px] p-4 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-2.5">
                  <span className="font-mono text-xs font-medium text-white tabular-nums">
                    #{tx.id.slice(0, 8)}
                  </span>
                  <div>
                    {tx.status === "paid" && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium inline-flex items-center gap-1">
                        <Check className="w-3 h-3" /> Pago
                      </span>
                    )}
                    {tx.status === "pending" && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-medium inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pendente
                      </span>
                    )}
                    {tx.status === "cancelled" && (
                      <span className="px-2 py-0.5 rounded-full bg-zinc-500/10 border border-zinc-500/20 text-zinc-400 text-[10px] font-medium inline-flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Cancelado
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-xs font-medium text-white truncate">
                  {tx.customerName}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/[0.04]">
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Gateway</span>
                    <span className="text-zinc-300 font-medium text-xs">
                      {tx.paymentMethod === "syncpay" ? "SyncPay" : "Mercado Pago"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Data</span>
                    <time dateTime={tx.createdAt} className="text-zinc-400 font-sans text-xs tabular-nums">
                      {formatBusinessDateTime(tx.createdAt)}
                    </time>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Valor Bruto</span>
                    <span className="text-zinc-200 font-sans font-medium tabular-nums text-xs">
                      {formatCurrency(tx.total)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Valor Líquido</span>
                    <span className="text-emerald-400 font-sans font-bold tabular-nums text-xs">
                      {formatCurrency(tx.netAmount)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
