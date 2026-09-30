"use client";

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  ShieldCheck, 
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

interface PushinPayConnectionInfo {
  id: string | null;
  status: string;
  isGlobalEnvActive?: boolean;
  updatedAt: string | null;
}

interface Props {
  connection: ConnectionInfo | null;
  pushinPayConnection?: PushinPayConnectionInfo | null;
}

export default function RecebimentosClient({ connection, pushinPayConnection }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingDisconnect, setLoadingDisconnect] = useState(false);

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

  return (
    <div className="space-y-8 w-full fade-in">
      {/* Header Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-red-500" />
            Gateways de Pagamento
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Centralize aqui todas as formas de receber pagamentos da sua loja.
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
    </div>
  );
}
