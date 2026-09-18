"use client";

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight, 
  Clock, 
  ShieldCheck, 
  Search, 
  Unlink, 
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConnectionInfo {
  id: string;
  status: string;
  providerEmail: string | null;
  providerUserId: string | null;
  updatedAt: string | null;
}

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
  customerName: string;
  total: number;
  platformFee: number;
  netAmount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

interface Props {
  connection: ConnectionInfo | null;
  metrics: Metrics;
  transactions: Transaction[];
}

export default function RecebimentosClient({ connection, metrics, transactions }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingDisconnect, setLoadingDisconnect] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const isConnected = connection?.status === 'active';
  const successParam = searchParams.get('success');
  const errorParam = searchParams.get('error');

  const handleConnect = () => {
    window.location.href = '/api/payments/mercadopago/connect';
  };

  const handleDisconnect = async () => {
    if (!confirm('Deseja realmente desconectar sua conta do Mercado Pago? Suas vendas no Telegram serão pausadas até que reconecte.')) {
      return;
    }

    setLoadingDisconnect(true);
    try {
      const res = await fetch('/api/payments/mercadopago/disconnect', { method: 'POST' });
      if (res.ok) {
        router.refresh();
      } else {
        alert('Falha ao desconectar conta.');
      }
    } catch (e) {
      console.error(e);
      alert('Erro de conexão ao tentar desconectar.');
    } finally {
      setLoadingDisconnect(false);
    }
  };

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
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-blue-500" />
            Recebimento
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Gerencie suas conexões de pagamento, acompanhe repasses e visualize seu histórico financeiro.
          </p>
        </div>

        <Button 
          variant="outline" 
          onClick={() => router.refresh()} 
          className="bg-[#121216] border-white/10 hover:bg-white/5 text-zinc-300 self-start md:self-auto rounded-xl gap-2 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Atualizar Dados
        </Button>
      </div>

      {/* URL Notifications */}
      {successParam === 'connected' && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>Sua conta do Mercado Pago foi conectada com sucesso! Agora você já pode receber vendas.</span>
        </div>
      )}

      {errorParam && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
          <span>Erro na integração: {decodeURIComponent(errorParam)}</span>
        </div>
      )}

      {/* Mercado Pago Integration Connection Card */}
      <div className="bg-gradient-to-r from-[#0F1117] via-[#121622] to-[#0F1117] border border-blue-500/20 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 blur-[90px] rounded-full pointer-events-none"></div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <CreditCard className="w-7 h-7 text-blue-400" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-white">Mercado Pago Split</h3>
                {isConnected ? (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> Desconectado
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
                {isConnected ? (
                  <>Sua conta está ativa e pronta para receber pagamentos diretos via PIX e Cartão de Crédito. O valor líquido é depositado diretamente na sua conta do Mercado Pago.</>
                ) : (
                  <>Conecte sua conta do Mercado Pago OAuth para automatizar o recebimento de vendas da sua loja WebGran via Telegram com split automático.</>
                )}
              </p>

              {isConnected && (connection.providerEmail || connection.providerUserId) && (
                <div className="text-xs text-zinc-400 pt-2 flex items-center gap-4">
                  {connection.providerEmail && (
                    <span>Conta: <strong className="text-white">{connection.providerEmail}</strong></span>
                  )}
                  {connection.providerUserId && (
                    <span>ID Conta: <strong className="text-zinc-300 font-mono">{connection.providerUserId}</strong></span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="w-full md:w-auto shrink-0 flex items-center gap-3">
            {isConnected ? (
              <Button 
                onClick={handleDisconnect} 
                disabled={loadingDisconnect}
                variant="outline" 
                className="w-full md:w-auto bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 rounded-xl text-xs h-10 px-5 font-semibold transition-all"
              >
                <Unlink className="w-4 h-4 mr-2" />
                {loadingDisconnect ? 'Desconectando...' : 'Desconectar Conta'}
              </Button>
            ) : (
              <Button 
                onClick={handleConnect}
                className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs h-11 px-6 shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                Conectar Mercado Pago
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Total Liquido */}
        <div className="bg-[#0F0F12] border border-white/5 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Saldo Líquido</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(metrics.totalLiquido)}
          </div>
          <p className="text-[11px] text-zinc-500 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            Valor repassado direto no Mercado Pago
          </p>
        </div>

        {/* Metric 2: Total Bruto */}
        <div className="bg-[#0F0F12] border border-white/5 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Vendas Processadas</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
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
        <div className="bg-[#0F0F12] border border-white/5 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Status de Pedidos</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
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
      <div className="bg-[#0F0F12] border border-white/5 rounded-2xl p-6 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Histórico de Transações</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Registro completo de todas as vendas e repasses realizados na sua loja.
            </p>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Buscar por ID ou cliente..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#16161C] border border-white/10 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50 w-full sm:w-60"
              />
            </div>

            <div className="flex bg-[#16161C] p-1 rounded-xl border border-white/10 text-xs">
              <button 
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${statusFilter === 'all' ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => setStatusFilter('paid')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${statusFilter === 'paid' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
              >
                Pagos
              </button>
              <button 
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${statusFilter === 'pending' ? 'bg-amber-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
              >
                Pendentes
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="py-3 px-4">ID Pedido / MP</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4 text-right">Valor Bruto</th>
                <th className="py-3 px-4 text-right">Valor Líquido</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">
                    Nenhuma transação encontrada.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-mono text-zinc-300">
                      <div className="font-semibold text-white">{tx.id.slice(0, 8)}...</div>
                      {tx.paymentId && (
                        <div className="text-[10px] text-zinc-500">MP: {tx.paymentId}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-white font-medium">
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
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
                          Pago
                        </span>
                      )}
                      {tx.status === 'pending' && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-semibold">
                          Pendente
                        </span>
                      )}
                      {tx.status === 'cancelled' && (
                        <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-semibold">
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
