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

interface SyncPayConnectionInfo {
  id: string | null;
  status: string;
  updatedAt: string | null;
}

interface Props {
  connection: ConnectionInfo | null;
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

export default function RecebimentosClient({ connection, syncPayConnection }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Modals state
  const [disconnectModalGateway, setDisconnectModalGateway] = useState<'mercado_pago' | 'syncpay' | null>(null);
  const [manageModalGateway, setManageModalGateway] = useState<'mercado_pago' | 'syncpay' | null>(null);
  const [isSyncPayConnectOpen, setIsSyncPayConnectOpen] = useState(false);

  // Connection & Action States
  const [loadingDisconnect, setLoadingDisconnect] = useState(false);
  const [loadingConnectMp, setLoadingConnectMp] = useState(false);
  const [syncPayLoading, setSyncPayLoading] = useState(false);
  const [testingGateway, setTestingGateway] = useState<'mercado_pago' | 'syncpay' | null>(null);

  // SyncPay Inputs
  const [syncPayClientId, setSyncPayClientId] = useState('');
  const [syncPayClientSecret, setSyncPayClientSecret] = useState('');

  const [feedbackMsg, setFeedbackMsg] = useState<{ provider: 'mercado_pago' | 'syncpay'; type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const isMpActive = connection?.status === 'active';
  const isSyncPayActive = syncPayConnection?.status === 'active';

  const successParam = searchParams.get('success');
  const errorParam = searchParams.get('error');

  const handleConnectMp = async () => {
    setLoadingConnectMp(true);
    try {
      const redirectUri = `${window.location.origin}/api/payments/mercadopago/callback`;
      const res = await fetch('/api/payments/mercadopago/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectUri }),
      });

      if (!res.ok) {
        let errorMsg = 'Não foi possível iniciar a conexão com o Mercado Pago.';
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errorMsg = errData.error;
          }
        } catch {
          // Response was not JSON
        }
        throw new Error(errorMsg);
      }

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error('Não foi possível iniciar a conexão com o Mercado Pago.');
      }

      if (!data || !data.success || !data.url) {
        throw new Error(data?.error || 'Falha ao iniciar conexão com Mercado Pago.');
      }

      window.location.href = data.url;
    } catch (err: any) {
      setFeedbackMsg({ provider: 'mercado_pago', type: 'error', text: err.message });
      setLoadingConnectMp(false);
    }
  };

  const handleDisconnectMp = async () => {
    setLoadingDisconnect(true);
    try {
      const res = await fetch('/api/payments/mercadopago/disconnect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao desconectar.');
      setFeedbackMsg({ provider: 'mercado_pago', type: 'info', text: 'Conexão Mercado Pago desativada com sucesso.' });
      setDisconnectModalGateway(null);
      router.refresh();
    } catch (err: any) {
      setFeedbackMsg({ provider: 'mercado_pago', type: 'error', text: err.message });
    } finally {
      setLoadingDisconnect(false);
    }
  };

  const handleConnectSyncPay = async () => {
    if (!syncPayClientId.trim() || !syncPayClientSecret.trim()) {
      setFeedbackMsg({ provider: 'syncpay', type: 'error', text: 'Preencha o Client ID e o Client Secret da SyncPay.' });
      return;
    }

    setSyncPayLoading(true);
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
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao conectar SyncPay.');
      }

      setFeedbackMsg({
        provider: 'syncpay',
        type: 'success',
        text: 'SyncPay conectado e ativado com sucesso!',
      });
      setIsSyncPayConnectOpen(false);
      setSyncPayClientId('');
      setSyncPayClientSecret('');
      router.refresh();
    } catch (err: any) {
      setFeedbackMsg({ provider: 'syncpay', type: 'error', text: err.message });
    } finally {
      setSyncPayLoading(false);
    }
  };

  const handleDisconnectSyncPay = async () => {
    setLoadingDisconnect(true);
    try {
      const res = await fetch('/api/seller/payments/syncpay', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao desativar SyncPay.');
      setFeedbackMsg({ provider: 'syncpay', type: 'info', text: 'Integração SyncPay desativada para a loja.' });
      setDisconnectModalGateway(null);
      router.refresh();
    } catch (err: any) {
      setFeedbackMsg({ provider: 'syncpay', type: 'error', text: err.message });
    } finally {
      setLoadingDisconnect(false);
    }
  };

  const handleTestConnection = async (provider: 'mercado_pago' | 'syncpay') => {
    setTestingGateway(provider);
    try {
      if (provider === 'mercado_pago') {
        const res = await fetch('/api/admin/payments/mercadopago/status');
        const data = await res.json();
        if (!res.ok || !data.isConnected) throw new Error(data.error || 'Conexão Mercado Pago inativa.');
        setFeedbackMsg({ provider: 'mercado_pago', type: 'success', text: 'Conexão com Mercado Pago validada com sucesso!' });
      } else if (provider === 'syncpay') {
        const res = await fetch('/api/seller/payments/syncpay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'test' }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Falha na validação com a SyncPay.');
        setFeedbackMsg({ provider: 'syncpay', type: 'success', text: `SyncPay: ${data.message || 'Conexão funcionando perfeitamente!'}` });
      }
    } catch (err: any) {
      setFeedbackMsg({ provider, type: 'error', text: err.message });
    } finally {
      setTestingGateway(null);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '—';
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 animate-in fade-in duration-300">
      
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0F0F12] border border-white/5 p-6 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner">
              <CreditCard className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">Gateways de Recebimento</h1>
              <p className="text-xs text-zinc-400">Gerencie as credenciais e métodos de pagamento ativados na sua loja</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 z-10 self-start md:self-auto">
          <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300 font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Criptografia de Credenciais
          </span>
        </div>
      </div>

      {/* PARAM FEEDBACK TOASTS */}
      {successParam && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>Sua conta de gateway foi vinculada e ativada com sucesso!</span>
        </div>
      )}

      {errorParam && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{errorParam}</span>
        </div>
      )}

      {/* GATEWAYS CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
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
                      PIX
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/5 text-zinc-300 border border-white/10">
                      Cartão
                    </span>
                  </div>
                </div>
              </div>

              {isMpActive ? (
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Conectado
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700/60 text-zinc-400 text-xs font-bold flex items-center gap-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-zinc-500" />
                  Desconectado
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {isMpActive 
                ? "Conexão oficial OAuth autorizada. As cobranças da sua loja são processadas diretamente na sua conta Mercado Pago."
                : "Conecte sua conta Mercado Pago via OAuth oficial sem precisar expor senhas ou tokens manualmente."
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

            {isMpActive && (
              <div className="bg-[#18181C]/90 p-3.5 rounded-xl border border-white/5 space-y-2 text-xs">
                {connection?.providerEmail && (
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Conta vinculada:</span>
                    <strong className="text-white font-medium">{connection.providerEmail}</strong>
                  </div>
                )}
                <div className="flex items-center justify-between text-zinc-400">
                  <span>ID do Usuário MP:</span>
                  <span className="font-mono text-zinc-300">{connection?.providerUserId || '—'}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400 border-t border-white/5 pt-2">
                  <span>Última sincronização:</span>
                  <span className="text-zinc-300 font-medium">{formatDate(connection?.updatedAt || null)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/5">
            {isMpActive ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => handleTestConnection('mercado_pago')}
                  disabled={testingGateway === 'mercado_pago'}
                  variant="outline"
                  className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-200 border-white/10 rounded-xl text-xs h-10 font-semibold cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${testingGateway === 'mercado_pago' ? 'animate-spin' : ''}`} />
                  {testingGateway === 'mercado_pago' ? 'Testando...' : 'Testar Conexão'}
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
                disabled={loadingConnectMp}
                className="w-full bg-[#009EE3] hover:bg-[#008BBF] text-white font-bold rounded-xl text-xs h-11 px-6 shadow-lg shadow-[#009EE3]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {loadingConnectMp ? 'Conectando...' : 'Conectar Mercado Pago'}
              </Button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. SYNCPAY CARD */}
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
                      Partner API
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/5 text-zinc-300 border border-white/10">
                      PIX Cash-In
                    </span>
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
                ? "Integração SyncPay ativa para sua loja com autenticação Partner e Webhooks dedicados."
                : "Conecte sua conta SyncPay informando suas credenciais de parceiro (Client ID e Client Secret)."
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
                  <span>Status da Integração:</span>
                  <strong className="text-emerald-400 font-medium">Ativo & Autenticado</strong>
                </div>
                <div className="flex items-center justify-between text-zinc-400 border-t border-white/5 pt-2">
                  <span>Última atualização:</span>
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
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${testingGateway === 'syncpay' ? 'animate-spin' : ''}`} />
                  {testingGateway === 'syncpay' ? 'Testando...' : 'Testar Conexão'}
                </Button>

                <Button
                  onClick={() => setIsSyncPayConnectOpen(true)}
                  variant="outline"
                  className="bg-white/5 hover:bg-white/10 text-zinc-200 border-white/10 rounded-xl text-xs h-10 px-3 font-semibold cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-zinc-300" />
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
                type="button"
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

      {/* SYNCPAY CREDENTIALS MODAL */}
      {isSyncPayConnectOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <SyncPayLogo className="w-8 h-8" />
                <div>
                  <h3 className="text-base font-bold text-white">Configurar SyncPay</h3>
                  <p className="text-xs text-zinc-400">Insira suas credenciais da API Partner da SyncPay</p>
                </div>
              </div>
              <button onClick={() => setIsSyncPayConnectOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-300">
                  Client ID (Partner)
                </label>
                <input
                  type="text"
                  value={syncPayClientId}
                  onChange={(e) => setSyncPayClientId(e.target.value)}
                  placeholder="Cole seu Client ID da SyncPay..."
                  className="w-full bg-[#181820] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-all font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-300">
                  Client Secret (Partner)
                </label>
                <input
                  type="password"
                  value={syncPayClientSecret}
                  onChange={(e) => setSyncPayClientSecret(e.target.value)}
                  placeholder="Cole seu Client Secret da SyncPay..."
                  className="w-full bg-[#181820] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-all font-mono"
                />
              </div>

              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs leading-relaxed flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  As credenciais são validadas imediatamente nos servidores da SyncPay e armazenadas no banco de dados com criptografia AES-256.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
              <Button
                variant="outline"
                onClick={() => setIsSyncPayConnectOpen(false)}
                className="bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10 rounded-xl text-xs h-10 px-4 font-semibold cursor-pointer"
              >
                Cancelar
              </Button>

              <Button
                onClick={handleConnectSyncPay}
                disabled={syncPayLoading || !syncPayClientId.trim() || !syncPayClientSecret.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs h-10 px-5 shadow-lg shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
              >
                {syncPayLoading ? 'Validando...' : 'Salvar e Ativar SyncPay'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DISCONNECT MODAL */}
      {disconnectModalGateway && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-red-500/20 rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                  <Unlink className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Desconectar {disconnectModalGateway === 'mercado_pago' ? 'Mercado Pago' : 'SyncPay'}?
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
