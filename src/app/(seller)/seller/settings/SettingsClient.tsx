"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Unlink, 
  ExternalLink, 
  Sliders, 
  User, 
  Sparkles, 
  Trash2,
  Wallet,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConnectionInfo {
  id: string;
  status: string;
  providerEmail: string | null;
  providerUserId: string | null;
  updatedAt: string | null;
}

interface Props {
  storeName: string;
  ownerEmail: string;
  connection: ConnectionInfo | null;
}

export default function SettingsClient({ storeName, ownerEmail, connection }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"recebimento" | "geral" | "plano" | "avancado">("recebimento");
  const [loadingDisconnect, setLoadingDisconnect] = useState(false);

  const isConnected = connection?.status === "active";

  const handleConnect = () => {
    window.location.href = "/api/payments/mercadopago/connect";
  };

  const handleDisconnect = async () => {
    if (!confirm("Deseja realmente desconectar sua conta do Mercado Pago? Suas vendas no Telegram serão pausadas até que reconecte.")) {
      return;
    }

    setLoadingDisconnect(true);
    try {
      const res = await fetch("/api/payments/mercadopago/disconnect", { method: "POST" });
      if (res.ok) {
        router.refresh();
      } else {
        alert("Falha ao desconectar conta.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro de conexão ao tentar desconectar.");
    } finally {
      setLoadingDisconnect(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <Sliders className="w-7 h-7 text-blue-500" />
          Configurações
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Gerencie as preferências da sua conta, formas de recebimento e integrações.
        </p>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-white/10 gap-2 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab("recebimento")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "recebimento"
              ? "border-blue-500 text-blue-400 bg-blue-500/5 rounded-t-xl"
              : "border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.02]"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Recebimento
        </button>

        <button
          onClick={() => setActiveTab("geral")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "geral"
              ? "border-blue-500 text-blue-400 bg-blue-500/5 rounded-t-xl"
              : "border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.02]"
          }`}
        >
          <User className="w-4 h-4" />
          Geral
        </button>

        <button
          onClick={() => setActiveTab("plano")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "plano"
              ? "border-blue-500 text-blue-400 bg-blue-500/5 rounded-t-xl"
              : "border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.02]"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Plano & Assinatura
        </button>

        <button
          onClick={() => setActiveTab("avancado")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "avancado"
              ? "border-blue-500 text-blue-400 bg-blue-500/5 rounded-t-xl"
              : "border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.02]"
          }`}
        >
          <Trash2 className="w-4 h-4" />
          Avançado
        </button>
      </div>

      {/* Tab Content: Recebimento */}
      {activeTab === "recebimento" && (
        <div className="space-y-6">
          <div className="bg-[#0F0F12] border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-white">Integração Mercado Pago</h3>
                  {isConnected ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" /> Pendente
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400">
                  Conecte sua conta do Mercado Pago para receber pelas vendas realizadas no Telegram Mini App.
                </p>
              </div>

              <Link
                href="/seller/recebimentos"
                className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors shrink-0"
              >
                <Wallet className="w-4 h-4" />
                Painel Financeiro & Transações
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Connection Status Box */}
            <div className="bg-[#14141A] border border-white/5 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status da Conta</span>
                  {isConnected ? (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Conectado com sucesso
                      </p>
                      {connection?.providerEmail && (
                        <p className="text-xs text-zinc-400">
                          E-mail Mercado Pago: <strong className="text-white">{connection.providerEmail}</strong>
                        </p>
                      )}
                      {connection?.providerUserId && (
                        <p className="text-xs text-zinc-500 font-mono">
                          ID de Usuário: {connection.providerUserId}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400">
                      Nenhuma conta do Mercado Pago está vinculada a esta loja no momento.
                    </p>
                  )}
                </div>

                <div>
                  {isConnected ? (
                    <Button
                      onClick={handleDisconnect}
                      disabled={loadingDisconnect}
                      variant="outline"
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 rounded-xl text-xs h-9 px-4 font-semibold transition-all"
                    >
                      <Unlink className="w-3.5 h-3.5 mr-2" />
                      {loadingDisconnect ? "Desconectando..." : "Desconectar"}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleConnect}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs h-10 px-5 shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Conectar Mercado Pago
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Split & Platform Fee Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-[#14141A] border border-white/5 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Split Automático</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Os valores recebidos dos clientes são automaticamente divididos entre a taxa da plataforma WebGran e o valor líquido repassado diretamente para a sua conta do Mercado Pago.
                </p>
              </div>

              <div className="bg-[#14141A] border border-white/5 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Métodos de Pagamento</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Seus clientes poderão pagar por PIX e Cartão de Crédito diretamente no Mini App do Telegram com aprovação imediata.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Geral */}
      {activeTab === "geral" && (
        <div className="bg-[#0F0F12] border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
          <h3 className="text-lg font-bold text-white">Informações da Loja</h3>
          <div className="space-y-3 text-sm text-zinc-300">
            <div>
              <label className="text-xs text-zinc-400">Nome da Loja</label>
              <p className="font-semibold text-white mt-1">{storeName}</p>
            </div>
            <div>
              <label className="text-xs text-zinc-400">E-mail do Proprietário</label>
              <p className="font-semibold text-white mt-1">{ownerEmail}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Plano */}
      {activeTab === "plano" && (
        <div className="bg-[#0F0F12] border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
          <h3 className="text-lg font-bold text-white">Plano e Assinatura</h3>
          <div className="space-y-3">
            <p className="text-xs text-zinc-400">Plano Atual</p>
            <p className="text-xl font-bold text-white">Gratuito (MVP)</p>
            <Button variant="outline" disabled className="bg-white/5 border-white/10 text-zinc-400 rounded-xl text-xs">
              Fazer Upgrade (Em breve)
            </Button>
          </div>
        </div>
      )}

      {/* Tab Content: Avançado */}
      {activeTab === "avancado" && (
        <div className="bg-[#0F0F12] border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
          <h3 className="text-lg font-bold text-red-400">Zona de Perigo</h3>
          <p className="text-xs text-zinc-400">Ações destrutivas relativas à sua loja.</p>
          <Button variant="destructive" disabled className="rounded-xl text-xs">
            Excluir Loja
          </Button>
        </div>
      )}
    </div>
  );
}
