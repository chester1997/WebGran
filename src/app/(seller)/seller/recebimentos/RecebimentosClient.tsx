"use client";

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Unlink, 
  RefreshCw,
  Lock,
  Settings,
  X,
  Zap,
  ArrowRight,
  Plus,
  KeyRound,
  ExternalLink,
  Info
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

/* =========================================================
   OFFICIAL LOGO ASSETS (BRAND IDENTITIES)
========================================================= */

function MercadoPagoLogo({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <div className={`rounded-xl bg-[#009EE3] flex items-center justify-center p-1.5 shadow-md shadow-[#009EE3]/20 ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 9V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
        <rect x="9" y="9" width="12" height="10" rx="2" fill="#009EE3" stroke="currentColor" />
        <circle cx="15" cy="14" r="1.5" fill="white" />
      </svg>
    </div>
  );
}

function PushinPayLogo({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <div className={`rounded-xl bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center p-1.5 shadow-md shadow-emerald-500/20 ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-white" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor" className="text-emerald-300 opacity-30" />
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    </div>
  );
}

export default function RecebimentosClient({ connection, pushinPayConnection }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Modals state
  const [disconnectModalGateway, setDisconnectModalGateway] = useState<'mercado_pago' | 'pushinpay' | null>(null);
  const [manageModalGateway, setManageModalGateway] = useState<'mercado_pago' | 'pushinpay' | null>(null);
  const [isChangeTokenOpen, setIsChangeTokenOpen] = useState(false);

  // Connection & Action States
  const [loadingDisconnect, setLoadingDisconnect] = useState(false);
  const [pushinPayLoading, setPushinPayLoading] = useState(false);
  const [testingGateway, setTestingGateway] = useState<'mercado_pago' | 'pushinpay' | null>(null);

  // Form Inputs & Messages
  const [initialPushinPayToken, setInitialPushinPayToken] = useState('');
  const [changePushinPayToken, setChangePushinPayToken] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ provider: 'mercado_pago' | 'pushinpay'; type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const isMpConnected = connection?.status === 'active';
  const isPushinPayActive = pushinPayConnection?.status === 'active' || Boolean(pushinPayConnection?.isGlobalEnvActive);

  const successParam = searchParams.get('success');
  const errorParam = searchParams.get('error');

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Agora';
    try {
      return new Date(dateStr).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Agora';
    }
  };

  // Handlers
  const handleConnectMp = () => {
    window.location.href = '/api/payments/mercadopago/connect';
  };

  const handleDisconnectMp = async () => {
    setLoadingDisconnect(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/payments/mercadopago/disconnect', { method: 'POST' });
      if (res.ok) {
        setFeedbackMsg({ provider: 'mercado_pago', type: 'info', text: 'Mercado Pago desconectado com sucesso.' });
        setDisconnectModalGateway(null);
        setManageModalGateway(null);
        router.refresh();
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao desconectar conta do Mercado Pago.');
      }
    } catch (e: any) {
      setFeedbackMsg({ provider: 'mercado_pago', type: 'error', text: e.message || 'Erro ao tentar desconectar.' });
    } finally {
      setLoadingDisconnect(false);
    }
  };

  const handleSavePushinPayToken = async (tokenToSave: string, isUpdate = false) => {
    if (!tokenToSave.trim()) {
      setFeedbackMsg({ provider: 'pushinpay', type: 'error', text: 'Informe um Token PushinPay válido.' });
      return;
    }

    setPushinPayLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/seller/payments/pushinpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenToSave.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao salvar Token PushinPay.');
      }
      setFeedbackMsg({ 
        provider: 'pushinpay', 
        type: 'success', 
        text: isUpdate ? 'Nova credencial PushinPay configurada e ativada!' : 'Token PushinPay configurado e ativado com sucesso!' 
      });
      setInitialPushinPayToken('');
      setChangePushinPayToken('');
      setIsChangeTokenOpen(false);
      setManageModalGateway(null);
      router.refresh();
    } catch (err: any) {
      setFeedbackMsg({ provider: 'pushinpay', type: 'error', text: err.message });
    } finally {
      setPushinPayLoading(false);
    }
  };

  const handleDisconnectPushinPay = async () => {
    setLoadingDisconnect(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/seller/payments/pushinpay', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao desativar PushinPay.');
      }
      setFeedbackMsg({ provider: 'pushinpay', type: 'info', text: 'Integração PushinPay desativada para a loja.' });
      setDisconnectModalGateway(null);
      setManageModalGateway(null);
      router.refresh();
    } catch (err: any) {
      setFeedbackMsg({ provider: 'pushinpay', type: 'error', text: err.message });
    } finally {
      setLoadingDisconnect(false);
    }
  };

  const handleTestConnection = async (provider: 'mercado_pago' | 'pushinpay') => {
    setTestingGateway(provider);
    setFeedbackMsg(null);
    try {
      if (provider === 'pushinpay') {
        const res = await fetch('/api/seller/payments/pushinpay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'test' }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || data.error || 'Falha ao testar conexão.');
        }
        setFeedbackMsg({ provider: 'pushinpay', type: 'success', text: `✓ ${data.message || 'Conexão funcionando perfeitamente!'}` });
      } else {
        // Mercado Pago check
        if (isMpConnected) {
          setFeedbackMsg({ provider: 'mercado_pago', type: 'success', text: '✓ Conexão OAuth com Mercado Pago ativa e operando!' });
        } else {
          setFeedbackMsg({ provider: 'mercado_pago', type: 'error', text: '✕ Não foi possível validar a conexão. Mercado Pago desconectado.' });
        }
      }
    } catch (err: any) {
      setFeedbackMsg({ provider, type: 'error', text: `✕ Não foi possível validar a conexão: ${err.message}` });
    } finally {
      setTestingGateway(null);
    }
  };

  return (
    <div className="space-y-8 w-full fade-in pb-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141416]/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 shadow-inner">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Gateways de Pagamento</h1>
              <p className="text-zinc-400 text-xs sm:text-sm">
                Centralize aqui todas as formas de receber os pagamentos da sua loja.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10 self-start md:self-auto">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Multi-Tenant Isolado</span>
          </div>

          <Button 
            variant="outline" 
            onClick={() => router.refresh()} 
            className="bg-[#18181C] border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white rounded-xl text-xs h-10 px-4 flex items-center gap-2 cursor-pointer transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar Dados
          </Button>
        </div>
      </div>

      {/* URL ALERTS & NOTIFICATIONS */}
      {successParam === 'connected' && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-between text-xs sm:text-sm font-semibold shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>Sua conta do Mercado Pago foi conectada com sucesso! Sua loja já está pronta para aceitar pagamentos.</span>
          </div>
          <button onClick={() => router.replace('/seller/recebimentos')} className="text-zinc-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorParam && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-between text-xs sm:text-sm font-semibold shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <span>Erro na integração: {decodeURIComponent(errorParam)}</span>
          </div>
          <button onClick={() => router.replace('/seller/recebimentos')} className="text-zinc-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* GATEWAYS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ========================================================= */}
        {/* 1. MERCADO PAGO CARD */}
        {/* ========================================================= */}
        <div className="bg-[#141416]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-2xl flex flex-col justify-between space-y-6 transition-all hover:border-white/20">
          
          <div className="space-y-5">
            {/* Card Header: Logo, Title, Badges */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <MercadoPagoLogo className="w-11 h-11" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white tracking-tight">Mercado Pago</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#009EE3]/15 text-[#009EE3] border border-[#009EE3]/30">
                      OAuth 2.0
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/5 text-zinc-300 border border-white/10">
                      PIX + Cartão
                    </span>
                    <span className="text-[11px] text-zinc-500 font-medium">Split Automático</span>
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              {isMpConnected ? (
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Conectado
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700/60 text-zinc-400 text-xs font-bold flex items-center gap-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-zinc-500" />
                  Não conectado
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isMpConnected
                ? "Gateway configurado e pronto para receber pagamentos via PIX e Cartão com repasse automático."
                : "Conecte sua conta do Mercado Pago para aceitar pagamentos com split automático direto para a sua conta."
              }
            </p>

            {/* Dynamic Feedback Message */}
            {feedbackMsg?.provider === 'mercado_pago' && (
              <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                  : feedbackMsg.type === 'error'
                  ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                  : 'bg-blue-500/10 border border-blue-500/20 text-blue-300'
              }`}>
                {feedbackMsg.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
                {feedbackMsg.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />}
                {feedbackMsg.type === 'info' && <Info className="w-4 h-4 shrink-0 text-blue-400" />}
                <span>{feedbackMsg.text}</span>
              </div>
            )}

            {/* Safe Connection Details (NO TOKENS) */}
            {isMpConnected && (
              <div className="bg-[#18181C]/90 p-3.5 rounded-xl border border-white/5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Conta vinculada:</span>
                  <strong className="text-white font-medium truncate max-w-[200px]">{connection?.providerEmail || 'Conta Autorizada'}</strong>
                </div>
                {connection?.providerUserId && (
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>ID da Conta:</span>
                    <strong className="text-zinc-300 font-mono">{connection.providerUserId}</strong>
                  </div>
                )}
                <div className="flex items-center justify-between text-zinc-400 border-t border-white/5 pt-2">
                  <span>Última verificação:</span>
                  <span className="text-zinc-300 font-medium">{formatDate(connection?.updatedAt || null)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-white/5">
            {isMpConnected ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => handleTestConnection('mercado_pago')}
                  disabled={testingGateway === 'mercado_pago'}
                  variant="outline"
                  className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-200 border-white/10 rounded-xl text-xs h-10 font-semibold cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                  {testingGateway === 'mercado_pago' ? 'Verificando...' : 'Testar conexão'}
                </Button>

                <Button
                  onClick={() => setManageModalGateway('mercado_pago')}
                  variant="outline"
                  className="bg-white/5 hover:bg-white/10 text-zinc-200 border-white/10 rounded-xl text-xs h-10 px-4 font-semibold cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                  Gerenciar
                </Button>

                <Button
                  onClick={() => setDisconnectModalGateway('mercado_pago')}
                  variant="outline"
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 rounded-xl text-xs h-10 px-4 font-semibold cursor-pointer"
                >
                  <Unlink className="w-3.5 h-3.5 mr-1.5 text-red-400" />
                  Desconectar
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleConnectMp}
                className="w-full bg-[#009EE3] hover:bg-[#0089C7] text-white font-bold rounded-xl text-xs h-11 px-6 shadow-lg shadow-[#009EE3]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                Conectar Mercado Pago
              </Button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. PUSHINPAY CARD */}
        {/* ========================================================= */}
        <div className="bg-[#141416]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-2xl flex flex-col justify-between space-y-6 transition-all hover:border-white/20">
          
          <div className="space-y-5">
            {/* Card Header: Logo, Title, Badges */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <PushinPayLogo className="w-11 h-11" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white tracking-tight">PushinPay</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      API High-Speed
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/5 text-zinc-300 border border-white/10">
                      PIX Instantâneo
                    </span>
                    <span className="text-[11px] text-zinc-500 font-medium">Reconciliação Real-Time</span>
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              {isPushinPayActive ? (
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {pushinPayConnection?.isGlobalEnvActive ? 'Ativo (Global)' : 'Conectado'}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700/60 text-zinc-400 text-xs font-bold flex items-center gap-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-zinc-500" />
                  Não configurado
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isPushinPayActive
                ? "Gateway configurado e pronto para receber pagamentos via PIX com QR Code dinâmico."
                : "Receba pagamentos instantâneos via PIX com QR Code dinâmico e reconciliação automática via Webhook."
              }
            </p>

            {/* Dynamic Feedback Message */}
            {feedbackMsg?.provider === 'pushinpay' && (
              <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                  : feedbackMsg.type === 'error'
                  ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                  : 'bg-blue-500/10 border border-blue-500/20 text-blue-300'
              }`}>
                {feedbackMsg.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
                {feedbackMsg.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />}
                {feedbackMsg.type === 'info' && <Info className="w-4 h-4 shrink-0 text-blue-400" />}
                <span>{feedbackMsg.text}</span>
              </div>
            )}

            {/* CONNECTED STATE: Safe Details (NO TOKEN INPUT / NO MASKED CREDENTIALS ON CARD) */}
            {isPushinPayActive ? (
              <div className="bg-[#18181C]/90 p-3.5 rounded-xl border border-white/5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Modo de Conexão:</span>
                  <strong className="text-white font-medium">
                    {pushinPayConnection?.isGlobalEnvActive ? 'Variável Global Servidor' : 'Credencial do Lojista'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-400 border-t border-white/5 pt-2">
                  <span>Última verificação:</span>
                  <span className="text-zinc-300 font-medium">{formatDate(pushinPayConnection?.updatedAt || null)}</span>
                </div>
              </div>
            ) : (
              /* UNCONNECTED STATE: Show Token Input Field ONLY when not connected */
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-zinc-300">
                  Token PushinPay (Bearer Token Server-Side)
                </label>
                <input
                  type="password"
                  value={initialPushinPayToken}
                  onChange={(e) => setInitialPushinPayToken(e.target.value)}
                  placeholder="Cole seu token PushinPay aqui..."
                  className="w-full bg-[#181820] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 transition-all font-mono shadow-inner"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-white/5">
            {isPushinPayActive ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => handleTestConnection('pushinpay')}
                  disabled={testingGateway === 'pushinpay'}
                  variant="outline"
                  className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-200 border-white/10 rounded-xl text-xs h-10 font-semibold cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                  {testingGateway === 'pushinpay' ? 'Verificando...' : 'Testar conexão'}
                </Button>

                <Button
                  onClick={() => setManageModalGateway('pushinpay')}
                  variant="outline"
                  className="bg-white/5 hover:bg-white/10 text-zinc-200 border-white/10 rounded-xl text-xs h-10 px-4 font-semibold cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                  Gerenciar
                </Button>

                <Button
                  onClick={() => setDisconnectModalGateway('pushinpay')}
                  variant="outline"
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 rounded-xl text-xs h-10 px-4 font-semibold cursor-pointer"
                >
                  <Unlink className="w-3.5 h-3.5 mr-1.5 text-red-400" />
                  Desconectar
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                onClick={() => handleSavePushinPayToken(initialPushinPayToken)}
                disabled={pushinPayLoading || !initialPushinPayToken.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs h-11 px-6 shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {pushinPayLoading ? 'Conectando...' : 'Conectar PushinPay'}
              </Button>
            )}
          </div>
        </div>

      </div>

      {/* FOOTER SECURITY INFORMATIONAL BANNER */}
      <div className="p-4 rounded-2xl bg-[#141416]/60 backdrop-blur-md border border-white/5 flex items-center gap-3 text-xs text-zinc-400">
        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
          <Lock className="w-4 h-4" />
        </div>
        <span>
          <strong>Segurança WebGran:</strong> Suas credenciais são armazenadas com criptografia server-side de alta segurança e nunca são exibidas ou expostas no navegador após a conexão.
        </span>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: GERENCIAR GATEWAY */}
      {/* ========================================================= */}
      {manageModalGateway && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                {manageModalGateway === 'mercado_pago' ? (
                  <MercadoPagoLogo className="w-8 h-8" />
                ) : (
                  <PushinPayLogo className="w-8 h-8" />
                )}
                <div>
                  <h3 className="text-base font-bold text-white">
                    Gerenciar {manageModalGateway === 'mercado_pago' ? 'Mercado Pago' : 'PushinPay'}
                  </h3>
                  <p className="text-[11px] text-zinc-400">Status e gerenciamento da integração</p>
                </div>
              </div>
              <button onClick={() => setManageModalGateway(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-[#18181C] p-4 rounded-xl border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-medium">Status da Conexão:</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Conectado
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-2.5">
                  <span className="text-zinc-400 font-medium">Credencial no Servidor:</span>
                  <span className="text-zinc-200 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Configurada
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-2.5">
                  <span className="text-zinc-400 font-medium">Última verificação:</span>
                  <span className="text-zinc-300 font-mono">
                    {formatDate(manageModalGateway === 'mercado_pago' ? connection?.updatedAt || null : pushinPayConnection?.updatedAt || null)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-white/5">
              <Button
                onClick={() => handleTestConnection(manageModalGateway)}
                disabled={testingGateway === manageModalGateway}
                variant="outline"
                className="w-full bg-white/5 hover:bg-white/10 text-zinc-200 border-white/10 rounded-xl text-xs h-10 font-semibold cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {testingGateway === manageModalGateway ? 'Verificando...' : 'Testar conexão'}
              </Button>

              {manageModalGateway === 'pushinpay' && (
                <Button
                  onClick={() => setIsChangeTokenOpen(true)}
                  variant="outline"
                  className="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border-blue-500/20 rounded-xl text-xs h-10 font-semibold cursor-pointer flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4 text-blue-400" />
                  Alterar credencial
                </Button>
              )}

              <Button
                onClick={() => {
                  const gw = manageModalGateway;
                  setManageModalGateway(null);
                  setDisconnectModalGateway(gw);
                }}
                variant="outline"
                className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 rounded-xl text-xs h-10 font-semibold cursor-pointer flex items-center justify-center gap-2"
              >
                <Unlink className="w-4 h-4 text-red-400" />
                Desconectar gateway
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ALTERAR CREDENCIAL PUSHINPAY */}
      {/* ========================================================= */}
      {isChangeTokenOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <PushinPayLogo className="w-8 h-8" />
                <h3 className="text-base font-bold text-white">Alterar Credencial PushinPay</h3>
              </div>
              <button onClick={() => setIsChangeTokenOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-zinc-400 leading-relaxed">
                Digite a nova credencial para substituir a atual. Por motivos de segurança, a credencial antiga não é exibida.
              </p>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-300">
                  Nova Credencial PushinPay
                </label>
                {/* ALWAYS EMPTY INPUT FIELD */}
                <input
                  type="password"
                  value={changePushinPayToken}
                  onChange={(e) => setChangePushinPayToken(e.target.value)}
                  placeholder="Digite uma nova credencial..."
                  className="w-full bg-[#181820] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
              <Button
                variant="outline"
                onClick={() => {
                  setChangePushinPayToken('');
                  setIsChangeTokenOpen(false);
                }}
                className="bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10 rounded-xl text-xs h-10 px-4 font-semibold cursor-pointer"
              >
                Cancelar
              </Button>

              <Button
                onClick={() => handleSavePushinPayToken(changePushinPayToken, true)}
                disabled={pushinPayLoading || !changePushinPayToken.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs h-10 px-5 shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
              >
                {pushinPayLoading ? 'Salvando...' : 'Salvar Nova Credencial'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: CONFIRMAÇÃO DE DESCONEXÃO (PROVIDER-SPECIFIC) */}
      {/* ========================================================= */}
      {disconnectModalGateway && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-red-500/20 rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                  <Unlink className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Desconectar {disconnectModalGateway === 'mercado_pago' ? 'Mercado Pago' : 'PushinPay'}?
                </h3>
              </div>
              <button onClick={() => setDisconnectModalGateway(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 leading-relaxed flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Os pagamentos futuros não utilizarão mais esta conta até que outro gateway seja configurado.
                </span>
              </div>

              {/* PROVIDER-SPECIFIC INSTRUCTIONS */}
              <div className="bg-[#18181C] p-4 rounded-xl border border-white/5 space-y-2 text-zinc-300 leading-relaxed">
                <span className="font-bold text-white block">Instruções de Desconexão:</span>
                {disconnectModalGateway === 'pushinpay' ? (
                  <p className="text-zinc-400">
                    Desconectar este gateway removerá a credencial armazenada no WebGran. Para revogar totalmente o acesso no ambiente da PushinPay, acesse o painel da PushinPay em Configurações &gt; API e revogue o token gerado.
                  </p>
                ) : (
                  <p className="text-zinc-400">
                    A desconexão no WebGran removerá o vínculo OAuth armazenado da sua loja. Conforme as diretrizes do Mercado Pago, a revogação da autorização invalida os tokens associados à sua aplicação. Para revogar a permissão diretamente no Mercado Pago, acesse Suas Aplicações nas configurações da sua conta Mercado Pago.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
              <Button
                variant="outline"
                onClick={() => setDisconnectModalGateway(null)}
                className="bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10 rounded-xl text-xs h-10 px-4 font-semibold cursor-pointer"
              >
                Cancelar
              </Button>

              <Button
                onClick={() => {
                  if (disconnectModalGateway === 'mercado_pago') {
                    handleDisconnectMp();
                  } else {
                    handleDisconnectPushinPay();
                  }
                }}
                disabled={loadingDisconnect}
                className="bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs h-10 px-5 shadow-lg shadow-red-600/20 cursor-pointer disabled:opacity-50"
              >
                {loadingDisconnect ? 'Desconectando...' : 'Desconectar gateway'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
