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
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8 w-full fade-in">
      {/* Header Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <DollarSign className="w-7 h-7 text-emerald-400" />
            Financeiro
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Veja suas vendas, valores recebidos e histórico financeiro da sua loja.
          </p>
        </div>

        <Button 
          variant="outline" 
          onClick={() => router.refresh()} 
          className="bg-[#121216] border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white self-start sm:self-auto rounded-xl gap-2 text-xs h-10 px-4 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Atualizar Dados
        </Button>
      </div>

      {/* Metrics Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Metric 1: Total Liquido */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Saldo Líquido</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <DollarSign className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(metrics.totalLiquido)}
          </div>
          <p className="text-[11px] text-zinc-500 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            Valor total repassado de vendas pagas
          </p>
        </div>

        {/* Metric 2: Total Bruto */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Vendas Processadas</span>
            <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center">
              <ArrowUpRight className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(metrics.totalBruto)}
          </div>
          <p className="text-[11px] text-zinc-500">
            Total bruto acumulado das vendas pagas
          </p>
        </div>

        {/* Metric 3: Pedidos Concluidos */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Status de Pedidos</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Clock className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-white">{metrics.paidCount}</span>
            <span className="text-xs text-emerald-400 font-semibold">pagos</span>
            <span className="text-zinc-600">/</span>
            <span className="text-xl font-semibold text-zinc-400">{metrics.pendingCount}</span>
            <span className="text-xs text-amber-400 font-semibold">pendentes</span>
          </div>
          <p className="text-[11px] text-zinc-500">
            Volume total de transações
          </p>
        </div>
      </div>

      {/* Transactions Table Section */}
      <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Histórico de Transações</h3>
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
                className="bg-[#18181C] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 w-full transition-all [&::-webkit-search-cancel-button]:hidden"
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

            <div className="flex bg-[#18181C] p-1 rounded-xl border border-white/10 text-xs">
              <button 
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  statusFilter === 'all' ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-600/20' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button 
                onClick={() => setStatusFilter('paid')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  statusFilter === 'paid' ? 'bg-emerald-600 text-white font-semibold shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Pagos
              </button>
              <button 
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  statusFilter === 'pending' ? 'bg-amber-600 text-white font-semibold shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Pendentes
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto custom-scrollbar border border-white/5 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 bg-[#18181C]">
                <th className="py-3.5 px-4">PEDIDO / TRANSAÇÃO</th>
                <th className="py-3.5 px-4">GATEWAY</th>
                <th className="py-3.5 px-4">Cliente</th>
                <th className="py-3.5 px-4">Data</th>
                <th className="py-3.5 px-4 text-right">Valor Bruto</th>
                <th className="py-3.5 px-4 text-right">Valor Líquido</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
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
                      <div className="font-semibold text-white">{tx.id.slice(0, 8)}...</div>
                      {tx.paymentId && (
                        <div className="text-[10px] text-zinc-500">TX: {tx.paymentId}</div>
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

                    <td className="py-3.5 px-4 text-white font-semibold">
                      {tx.customerName}
                    </td>

                    <td className="py-3.5 px-4 text-zinc-400">
                      {formatDate(tx.createdAt)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-medium text-white">
                      {formatCurrency(tx.total)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
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
      </div>
    </div>
  );
}
