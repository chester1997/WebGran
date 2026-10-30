"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatBusinessDateTime } from '@/lib/analytics/timezone-utils';

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
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTransactions = transactions.filter(t => {
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesSearch = searchQuery === '' ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.paymentId && t.paymentId.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateStr: string) => {
    return formatBusinessDateTime(dateStr);
  };

  return (
    <div className="space-y-8 w-full fade-in pb-12">
      {/* Header Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Financeiro
                </h1>
                <Badge variant="outline" className="text-zinc-400 border-white/10 font-mono text-[11px] tabular-nums">
                  {transactions.length} {transactions.length === 1 ? 'registro' : 'registros'}
                </Badge>
              </div>
              <p className="text-zinc-400 text-xs sm:text-sm mt-0.5">
                Acompanhe o faturamento líquido, vendas processadas e repasses da sua loja.
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => router.refresh()}
          className="bg-[#0F1014] border-white/10 hover:bg-white/[0.04] text-zinc-300 hover:text-white self-start sm:self-auto rounded-xl gap-2 text-xs h-10 px-4 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Atualizar Dados
        </Button>
      </div>

      {/* Metrics Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* Metric 1: Total Liquido */}
        <div className="bg-[#0F1014] border border-white/[0.08] hover:border-white/20 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-xl transition-all">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Saldo Líquido</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <DollarSign className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums tracking-tight">
            {formatCurrency(metrics.totalLiquido)}
          </div>
          <p className="text-[11px] text-zinc-500 flex items-center gap-1.5 font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            Valor líquido repassado de vendas pagas
          </p>
        </div>

        {/* Metric 2: Total Bruto */}
        <div className="bg-[#0F1014] border border-white/[0.08] hover:border-white/20 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-xl transition-all">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Vendas Processadas</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <ArrowUpRight className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums tracking-tight">
            {formatCurrency(metrics.totalBruto)}
          </div>
          <p className="text-[11px] text-zinc-500 font-medium">
            Total bruto acumulado das vendas pagas
          </p>
        </div>

        {/* Metric 3: Pedidos Concluidos */}
        <div className="bg-[#0F1014] border border-white/[0.08] hover:border-white/20 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-xl transition-all">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Status de Pedidos</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Clock className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums">{metrics.paidCount}</span>
            <span className="text-xs text-emerald-400 font-semibold">pagos</span>
            <span className="text-zinc-600">/</span>
            <span className="text-xl sm:text-2xl font-bold text-zinc-400 font-mono tabular-nums">{metrics.pendingCount}</span>
            <span className="text-xs text-amber-400 font-semibold">pendentes</span>
          </div>
          <p className="text-[11px] text-zinc-500 font-medium">
            Volume total de transações registradas
          </p>
        </div>
      </div>

      {/* Transactions Section */}
      <div className="bg-[#0F1014] border border-white/[0.08] rounded-2xl p-4 sm:p-6 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Histórico de Transações</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Registro completo de todas as vendas e repasses realizados na sua loja.
            </p>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                name="search"
                id="financeiro_search_input"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                placeholder="Buscar por ID ou cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#15171D] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 w-full transition-all [&::-webkit-search-cancel-button]:hidden"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex bg-[#15171D] p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter('paid')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  statusFilter === 'paid'
                    ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-600/20'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Pagos
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  statusFilter === 'pending'
                    ? 'bg-amber-600 text-white font-semibold shadow-md shadow-amber-600/20'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Pendentes
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto custom-scrollbar border border-white/[0.08] rounded-xl bg-[#090A0D]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] text-[11px] font-semibold uppercase tracking-wider text-zinc-400 bg-[#15171D]">
                <th className="py-3.5 px-4">Pedido / Transação</th>
                <th className="py-3.5 px-4">Gateway</th>
                <th className="py-3.5 px-4">Cliente</th>
                <th className="py-3.5 px-4">Data</th>
                <th className="py-3.5 px-4 text-right">Valor Bruto</th>
                <th className="py-3.5 px-4 text-right">Valor Líquido</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] text-xs">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    Nenhuma transação encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-mono text-zinc-300">
                      <div className="font-semibold text-white tabular-nums">{tx.id.slice(0, 8)}...</div>
                      {tx.paymentId && (
                        <div className="text-[10px] text-zinc-500 tabular-nums">TX: {tx.paymentId}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {tx.paymentMethod === 'syncpay' ? (
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-semibold inline-flex items-center gap-1.5">
                          <Zap className="w-3 h-3 text-indigo-400" />
                          SyncPay
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-semibold inline-flex items-center gap-1.5">
                          <CreditCard className="w-3 h-3 text-blue-400" />
                          Mercado Pago
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-white font-medium">
                      {tx.customerName}
                    </td>

                    <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px] tabular-nums">
                      {formatDate(tx.createdAt)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-medium text-white tabular-nums">
                      {formatCurrency(tx.total)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400 tabular-nums">
                      {formatCurrency(tx.netAmount)}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {tx.status === 'paid' && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold inline-block">
                          Pago
                        </span>
                      )}
                      {tx.status === 'pending' && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-semibold inline-block">
                          Pendente
                        </span>
                      )}
                      {tx.status === 'cancelled' && (
                        <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-semibold inline-block">
                          Cancelado
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="block md:hidden space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="py-10 text-center text-zinc-500 text-xs bg-[#090A0D] rounded-xl border border-white/[0.06] p-6">
              Nenhuma transação encontrada para os filtros selecionados.
            </div>
          ) : (
            filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-[#090A0D] border border-white/[0.08] rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-white tabular-nums">
                    #{tx.id.slice(0, 8)}
                  </span>
                  <div>
                    {tx.status === 'paid' && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                        Pago
                      </span>
                    )}
                    {tx.status === 'pending' && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold">
                        Pendente
                      </span>
                    )}
                    {tx.status === 'cancelled' && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-semibold">
                        Cancelado
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-sm font-medium text-white truncate">
                  {tx.customerName}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/[0.06]">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-zinc-500 block">Gateway</span>
                    <span className="text-zinc-300 font-medium">
                      {tx.paymentMethod === 'syncpay' ? 'SyncPay' : 'Mercado Pago'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-zinc-500 block">Data</span>
                    <span className="text-zinc-400 font-mono text-[11px] tabular-nums">
                      {formatDate(tx.createdAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-zinc-500 block">Valor Bruto</span>
                    <span className="text-white font-mono font-medium tabular-nums">
                      {formatCurrency(tx.total)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-zinc-500 block">Valor Líquido</span>
                    <span className="text-emerald-400 font-mono font-bold tabular-nums">
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
