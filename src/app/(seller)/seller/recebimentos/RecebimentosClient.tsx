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
  RefreshCw,
  X
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

interface PushinPayConnectionInfo {
  id: string | null;
  status: string;
  isGlobalEnvActive?: boolean;
  updatedAt: string | null;
}

interface Props {
  connection: ConnectionInfo | null;
  pushinPayConnection?: PushinPayConnectionInfo | null;
  metrics: Metrics;
  transactions: Transaction[];
}

export default function RecebimentosClient({ connection, pushinPayConnection, metrics, transactions }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingDisconnect, setLoadingDisconnect] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // PushinPay State
  const [pushinPayToken, setPushinPayToken] = useState('');
  const [pushinPayLoading, setPushinPayLoading] = useState(false);
  const [pushinPayTesting, setPushinPayTesting] = useState(false);
  const [pushinPayMsg, setPushinPayMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isConnected = connection?.status === 'active';
  const isPushinPayActive = pushinPayConnection?.status === 'active' || Boolean(pushinPayConnection?.isGlobalEnvActive);
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

  const handleSavePushinPay = async () => {
    if (!pushinPayToken.trim()) {
      setPushinPayMsg({ type: 'error', text: 'Informe um Token PushinPay válido.' });
      return;
    }
    setPushinPayLoading(true);
    setPushinPayMsg(null);
    try {
      const res = await fetch('/api/seller/payments/pushinpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: pushinPayToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao salvar Token PushinPay.');
      }
      setPushinPayMsg({ type: 'success', text: 'Token PushinPay salvo e ativado com sucesso!' });
      setPushinPayToken('');
      router.refresh();
    } catch (err: any) {
      setPushinPayMsg({ type: 'error', text: err.message });
    } finally {
      setPushinPayLoading(false);
    }
  };

  const handleTestPushinPay = async () => {
    setPushinPayTesting(true);
    setPushinPayMsg(null);
    try {
      const res = await fetch('/api/seller/payments/pushinpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', token: pushinPayToken.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Falha ao testar conexão.');
      }
      setPushinPayMsg({ type: 'success', text: data.message || 'Conexão PushinPay testada e autenticada com sucesso!' });
    } catch (err: any) {
      setPushinPayMsg({ type: 'error', text: err.message });
    } finally {
      setPushinPayTesting(false);
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
    <div className="space-y-8 w-full fade-in">
      {/* Header Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-red-500" />
            Recebimento
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Gerencie suas conexões de pagamento, acompanhe repasses e visualize seu histórico financeiro.
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

      {/* GATEWAYS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mercado Pago Integration Connection Card */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 relative overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 shadow-inner">
                  <CreditCard className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Mercado Pago Split</h3>
                  <p className="text-xs text-zinc-400">PIX & Cartão com Split Automático</p>
                </div>
              </div>

              {isConnected ? (
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold flex items-center gap-1.5 shrink-0">
                  <AlertCircle className="w-3.5 h-3.5" /> Desconectado
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {isConnected ? (
                <>Sua conta está ativa e pronta para receber pagamentos diretos via PIX e Cartão de Crédito com repasse direto para sua conta Mercado Pago.</>
              ) : (
                <>Conecte sua conta do Mercado Pago OAuth para automatizar o recebimento de vendas da sua loja WebGran com split automático.</>
              )}
            </p>

            {isConnected && (connection?.providerEmail || connection?.providerUserId) && (
              <div className="text-xs text-zinc-400 pt-1 flex items-center gap-4 flex-wrap bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                {connection.providerEmail && (
                  <span>Conta: <strong className="text-white">{connection.providerEmail}</strong></span>
                )}
                {connection.providerUserId && (
                  <span>ID Conta: <strong className="text-zinc-300 font-mono">{connection.providerUserId}</strong></span>
                )}
              </div>
            )}
          </div>

          <div className="pt-5 border-t border-white/5 mt-4">
            {isConnected ? (
              <Button 
                onClick={handleDisconnect} 
                disabled={loadingDisconnect}
                variant="outline" 
                className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 rounded-xl text-xs h-10 px-5 font-semibold transition-all cursor-pointer"
              >
                <Unlink className="w-4 h-4 mr-2" />
                {loadingDisconnect ? 'Desconectando...' : 'Desconectar Mercado Pago'}
              </Button>
            ) : (
              <Button 
                onClick={handleConnect}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs h-11 px-6 shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                Conectar Mercado Pago
              </Button>
            )}
          </div>
        </div>

        {/* PushinPay Gateway Connection Card */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 relative overflow-hidden shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-inner">
                  <DollarSign className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">PushinPay PIX</h3>
                  <p className="text-xs text-zinc-400">Gateway PIX de Alta Eficiência</p>
                </div>
              </div>

              {isPushinPayActive ? (
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {pushinPayConnection?.isGlobalEnvActive ? 'Ativo (Global)' : 'Conectado'}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold flex items-center gap-1.5 shrink-0">
                  <AlertCircle className="w-3.5 h-3.5" /> Não Configurado
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Receba pagamentos instantâneos via PIX com QR Code dinâmico e reconciliação automática via Webhook em tempo real.
            </p>

            {pushinPayMsg && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                pushinPayMsg.type === 'success' 
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' 
                  : 'bg-red-500/10 border border-red-500/20 text-red-300'
              }`}>
                {pushinPayMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{pushinPayMsg.text}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-300">
                Token PushinPay (Bearer Token Server-Side)
              </label>
              <input
                type="password"
                value={pushinPayToken}
                onChange={(e) => setPushinPayToken(e.target.value)}
                placeholder={isPushinPayActive ? "•••••••••••••••••••••••• (Token Ativo)" : "Cole seu token PushinPay aqui..."}
                className="w-full bg-[#181820] border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 transition-all font-mono"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex items-center gap-3">
            <Button
              type="button"
              onClick={handleSavePushinPay}
              disabled={pushinPayLoading || !pushinPayToken.trim()}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs h-10 px-4 transition-all cursor-pointer disabled:opacity-50"
            >
              {pushinPayLoading ? 'Salvando...' : 'Salvar Token'}
            </Button>

            <Button
              type="button"
              onClick={handleTestPushinPay}
              disabled={pushinPayTesting}
              variant="outline"
              className="bg-[#181820] border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white rounded-xl text-xs h-10 px-4 font-semibold transition-all cursor-pointer"
            >
              {pushinPayTesting ? 'Testando...' : 'Testar Conexão'}
            </Button>
          </div>
        </div>
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
            Valor repassado direto no Mercado Pago
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
                type="text" 
                placeholder="Buscar por ID ou cliente..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#18181C] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 w-full transition-all"
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
                  statusFilter === 'all' ? 'bg-red-600 text-white font-semibold shadow-md shadow-red-600/20' : 'text-zinc-400 hover:text-white'
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
                <th className="py-3.5 px-4">ID Pedido / MP</th>
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
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    Nenhuma transação encontrada para os filtros selecionados.
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
