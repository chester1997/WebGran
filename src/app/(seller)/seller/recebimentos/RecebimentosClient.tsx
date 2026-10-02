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
  Plus,
  KeyRound,
  Info,
  QrCode
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

interface SyncPayConnectionInfo {
  id: string | null;
  status: string;
  updatedAt: string | null;
}

interface Props {
  connection: ConnectionInfo | null;
  pushinPayConnection?: PushinPayConnectionInfo | null;
  syncPayConnection?: SyncPayConnectionInfo | null;
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

function SyncPayLogo({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <div className={`rounded-xl bg-gradient-to-br from-[#6366F1] to-[#4F46E5] flex items-center justify-center p-1.5 shadow-md shadow-indigo-500/20 ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
      </svg>
    </div>
  );
}

export default function RecebimentosClient({ connection, pushinPayConnection, syncPayConnection }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Modals state
  const [disconnectModalGateway, setDisconnectModalGateway] = useState<'mercado_pago' | 'pushinpay' | 'syncpay' | null>(null);
  const [manageModalGateway, setManageModalGateway] = useState<'mercado_pago' | 'pushinpay' | 'syncpay' | null>(null);
  const [isSyncPayConnectOpen, setIsSyncPayConnectOpen] = useState(false);
  const [isChangeTokenOpen, setIsChangeTokenOpen] = useState(false);

  // Connection & Action States
  const [loadingDisconnect, setLoadingDisconnect] = useState(false);
  const [pushinPayLoading, setPushinPayLoading] = useState(false);
  const [syncPayLoading, setSyncPayLoading] = useState(false);
  const [testingGateway, setTestingGateway] = useState<'mercado_pago' | 'pushinpay' | 'syncpay' | null>(null);

  // SyncPay Inputs
  const [syncPayClientId, setSyncPayClientId] = useState('');
  const [syncPayClientSecret, setSyncPayClientSecret] = useState('');

  // PushinPay Inputs
  const [initialPushinPayToken, setInitialPushinPayToken] = useState('');
  const [changePushinPayToken, setChangePushinPayToken] = useState('');

  // Messages
  const [feedbackMsg, setFeedbackMsg] = useState<{ provider: 'mercado_pago' | 'pushinpay' | 'syncpay'; type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const isMpConnected = connection?.status === 'active';
  const isPushinPayActive = pushinPayConnection?.status === 'active' || Boolean(pushinPayConnection?.isGlobalEnvActive);
  const isSyncPayActive = syncPayConnection?.status === 'active';

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

  const handleSaveSyncPay = async () => {
    if (!syncPayClientId.trim() || !syncPayClientSecret.trim()) {
      setFeedbackMsg({ provider: 'syncpay', type: 'error', text: 'Preencha o Client ID e Client Secret da SyncPay.' });
      return;
    }

    setSyncPayLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/seller/payments/syncpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: syncPayClientId.trim(),
          clientSecret: syncPayClientSecret.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao conectar SyncPay.');
      }

      setFeedbackMsg({
        provider: 'syncpay',
        type: 'success',
        text: 'SyncPay conectado e ativado com sucesso para a sua loja!',
      });
      setSyncPayClientId('');
      setSyncPayClientSecret('');
      setIsSyncPayConnectOpen(false);
      setManageModalGateway(null);
      router.refresh();
    } catch (err: any) {
      setFeedbackMsg({ provider: 'syncpay', type: 'error', text: err.message });
    } finally {
      setSyncPayLoading(false);
    }
  };

  const handleDisconnectSyncPay = async () => {
    setLoadingDisconnect(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/seller/payments/syncpay', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao desativar SyncPay.');
      }
      setFeedbackMsg({ provider: 'syncpay', type: 'info', text: 'Integração SyncPay desativada com sucesso.' });
      setDisconnectModalGateway(null);
      setManageModalGateway(null);
      router.refresh();
    } catch (err: any) {
      setFeedbackMsg({ provider: 'syncpay', type: 'error', text: err.message });
    } finally {
      setLoadingDisconnect(false);
    }
  };

  const handleTestConnection = async (provider: 'mercado_pago' | 'pushinpay' | 'syncpay') => {
    setTestingGateway(provider);
    setFeedbackMsg(null);
    try {
      if (provider === 'syncpay') {
        const res = await fetch('/api/seller/payments/syncpay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'test' }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || data.error || 'Falha ao testar conexão SyncPay.');
        }
        setFeedbackMsg({ provider: 'syncpay', type: 'success', text: `✓ ${data.message || 'Conexão SyncPay validada!'}` });
      } else if (provider === 'pushinpay') {
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
        if (isMpConnected) {
          setFeedbackMsg({ provider: 'mercado_pago', type: 'success', text: '✓ Conexão OAuth com Mercado Pago ativa e operando!' });
        } else {
          setFeedbackMsg({ provider: 'mercado_pago', type: 'error', text: '✕ Mercado Pago desconectado.' });
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
                Centralize e gerencie todas as opções de recebimento da sua loja.
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

      {/* GATEWAYS GRID (3 COLUMNS ON DESKTOP) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ========================================================= */}
        {/* 1. MERCADO PAGO CARD */}
        {/* ========================================================= */}
        <div className="bg-[#141416]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-2xl flex flex-col justify-between space-y-6 transition-all hover:border-white/20">
          
          <div className="space-y-5">
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
                  </div>
                </div>
              </div>

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

            <p className="text-xs text-zinc-400 leading-relaxed">
              {isMpConnected
                ? "Gateway configurado e pronto para receber pagamentos via PIX e Cartão com repasse automático."
                : "Conecte sua conta do Mercado Pago para aceitar pagamentos com split automático direto para a sua conta."
              }
            </p>

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

            {isMpConnected && (
              <div className="bg-[#18181C]/90 p-3.5 rounded-xl border border-white/5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Conta vinculada:</span>
                  <strong className="text-white font-medium truncate max-w-[180px]">{connection?.providerEmail || 'Conta Autorizada'}</strong>
                </div>
                <div className="flex items-center justify-between text-zinc-400 border-t border-white/5 pt-2">
                  <span>Última verificação:</span>
                  <span className="text-zinc-300 font-medium">{formatDate(connection?.updatedAt || null)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/5">
            {isMpConnected ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => handleTestConnection('mercado_pago')}
                  disabled={testingGateway === 'mercado_pago'}
                  variant="outline"
                  className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-200 border-white/10 rounded-xl text-xs h-10 font-semibold cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                  {testingGateway === 'mercado_pago' ? 'Verificando...' : 'Testar'}
                </Button>

                <Button
                  onClick={() => setDisconnectModalGateway('mercado_pago')}
                  variant="outline"
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 rounded-xl text-xs h-10 px-3 font-semibold cursor-pointer"
                >
                  <Unlink className="w-3.5 h-3.5 text-red-400" />
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
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <PushinPayLogo className="w-11 h-11" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white tracking-tight">PushinPay</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      High-Speed
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/5 text-zinc-300 border border-white/10">
                      PIX
                    </span>
                  </div>
                </div>
              </div>

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

            <p className="text-xs text-zinc-400 leading-relaxed">
              {isPushinPayActive
                ? "Gateway configurado e pronto para receber pagamentos via PIX com QR Code dinâmico."
                : "Receba pagamentos instantâneos via PIX com QR Code dinâmico e reconciliação automática via Webhook."
              }
            </p>

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

            {isPushinPayActive ? (
              <div className="bg-[#18181C]/90 p-3.5 rounded-xl border border-white/5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Modo de Conexão:</span>
                  <strong className="text-white font-medium">
                    {pushinPayConnection?.isGlobalEnvActive ? 'Variável Global' : 'Credencial Lojista'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-400 border-t border-white/5 pt-2">
                  <span>Última verificação:</span>
                  <span className="text-zinc-300 font-medium">{formatDate(pushinPayConnection?.updatedAt || null)}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-zinc-300">
                  Token PushinPay (Bearer Token)
                </label>
                <input
                  type="password"
                  value={initialPushinPayToken}
                  onChange={(e) => setInitialPushinPayToken(e.target.value)}
                  placeholder="Cole seu token PushinPay..."
                  className="w-full bg-[#181820] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                />
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/5">
            {isPushinPayActive ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => handleTestConnection('pushinpay')}
                  disabled={testingGateway === 'pushinpay'}
                  variant="outline"
                  className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-200 border-white/10 rounded-xl text-xs h-10 font-semibold cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                  {testingGateway === 'pushinpay' ? 'Verificando...' : 'Testar'}
                </Button>

                <Button
                  onClick={() => setDisconnectModalGateway('pushinpay')}
                  variant="outline"
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 rounded-xl text-xs h-10 px-3 font-semibold cursor-pointer"
                >
                  <Unlink className="w-3.5 h-3.5 text-red-400" />
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

        {/* ========================================================= */}
        {/* 3. SYNCPAY CARD */}
        {/* ========================================================= */}
        <div className="bg-[#141416]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-2xl flex flex-col justify-between space-y-6 transition-all hover:border-white/20">
          
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <SyncPayLogo className="w-11 h-11" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white tracking-tight">SyncPay</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                      API Partner
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/5 text-zinc-300 border border-white/10">
                      PIX
                    </span>
                    <span className="text-[11px] text-zinc-500 font-medium">HMAC-SHA256</span>
                  </div>
                </div>
              </div>

              {isSyncPayActive ? (
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Conectado
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700/60 text-zinc-400 text-xs font-bold flex items-center gap-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-zinc-500" />
                  Não configurado
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {isSyncPayActive
                ? "Gateway SyncPay ativado para pagamentos instantâneos via PIX com reconciliação automatizada."
                : "Receba cobranças Pix diretamente na sua conta SyncPay com confirmação e entrega em tempo real."
              }
            </p>

            {feedbackMsg?.provider === 'syncpay' && (
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

            {isSyncPayActive && (
              <div className="bg-[#18181C]/90 p-3.5 rounded-xl border border-white/5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Status da Credencial:</span>
                  <strong className="text-emerald-400 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Autenticada
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-400 border-t border-white/5 pt-2">
                  <span>Última verificação:</span>
                  <span className="text-zinc-300 font-medium">{formatDate(syncPayConnection?.updatedAt || null)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/5">
            {isSyncPayActive ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => handleTestConnection('syncpay')}
                  disabled={testingGateway === 'syncpay'}
                  variant="outline"
                  className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-200 border-white/10 rounded-xl text-xs h-10 font-semibold cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                  {testingGateway === 'syncpay' ? 'Verificando...' : 'Testar'}
                </Button>

                <Button
                  onClick={() => setDisconnectModalGateway('syncpay')}
                  variant="outline"
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 rounded-xl text-xs h-10 px-3 font-semibold cursor-pointer"
                >
                  <Unlink className="w-3.5 h-3.5 text-red-400" />
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setIsSyncPayConnectOpen(true)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs h-11 px-6 shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Conectar SyncPay
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
          <strong>Segurança WebGran:</strong> Suas credenciais são armazenadas com criptografia server-side de alta segurança (AES-256) e nunca são expostas ao navegador.
        </span>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: CONECTAR SYNCPAY */}
      {/* ========================================================= */}
      {isSyncPayConnectOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <SyncPayLogo className="w-8 h-8" />
                <div>
                  <h3 className="text-base font-bold text-white">Conectar SyncPay</h3>
                  <p className="text-[11px] text-zinc-400">Credenciais da API Partner SyncPay</p>
                </div>
              </div>
              <button onClick={() => setIsSyncPayConnectOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-zinc-400 leading-relaxed">
                Insira seu <strong>Client ID</strong> e <strong>Client Secret</strong> obtidos no painel da SyncPay para ativar o recebimento de PIX.
              </p>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Client ID SyncPay
                  </label>
                  <input
                    type="text"
                    value={syncPayClientId}
                    onChange={(e) => setSyncPayClientId(e.target.value)}
                    placeholder="Cole seu Client ID..."
                    className="w-full bg-[#181820] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Client Secret SyncPay
                  </label>
                  <input
                    type="password"
                    value={syncPayClientSecret}
                    onChange={(e) => setSyncPayClientSecret(e.target.value)}
                    placeholder="Cole seu Client Secret..."
                    className="w-full bg-[#181820] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-all font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
              <Button
                variant="outline"
                onClick={() => setIsSyncPayConnectOpen(false)}
                className="bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10 rounded-xl text-xs h-10 px-4 font-semibold cursor-pointer"
              >
                Cancelar
              </Button>

              <Button
                onClick={handleSaveSyncPay}
                disabled={syncPayLoading || !syncPayClientId.trim() || !syncPayClientSecret.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs h-10 px-5 shadow-lg shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
              >
                {syncPayLoading ? 'Conectando...' : 'Conectar SyncPay'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: CONFIRMAÇÃO DE DESCONEXÃO */}
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
                  Desconectar {disconnectModalGateway === 'mercado_pago' ? 'Mercado Pago' : disconnectModalGateway === 'pushinpay' ? 'PushinPay' : 'SyncPay'}?
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
                  Os pagamentos futuros não utilizarão mais este gateway até que uma nova conexão seja ativada. Seu histórico de pedidos e faturamento continuará seguro.
                </span>
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
                  } else if (disconnectModalGateway === 'pushinpay') {
                    handleDisconnectPushinPay();
                  } else {
                    handleDisconnectSyncPay();
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
