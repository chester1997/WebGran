"use client";

import { useState } from "react";
import {
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Save,
  Loader2,
  Lock,
  Unlock,
  Radio,
  Zap,
  HelpCircle,
} from "lucide-react";
import { SellerGatewayControlRecord } from "@/lib/payments/seller-gateway-control-service";

interface SellerGatewaysClientProps {
  initialControls: SellerGatewayControlRecord[];
  adminUser: any;
}

export default function SellerGatewaysClient({ initialControls }: SellerGatewaysClientProps) {
  const [controls, setControls] = useState<SellerGatewayControlRecord[]>(initialControls);
  const [savingGateway, setSavingGateway] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<{ [key: string]: string }>({});
  const [errorMsg, setErrorMsg] = useState<{ [key: string]: string }>({});
  const [editedNotes, setEditedNotes] = useState<{ [key: string]: string }>(() => {
    const map: { [key: string]: string } = {};
    for (const c of initialControls) {
      map[c.gateway] = c.notes || "";
    }
    return map;
  });

  const handleToggle = (gateway: string, field: "allowNewConnections" | "allowNewPayments") => {
    setControls((prev) =>
      prev.map((c) => {
        if (c.gateway === gateway) {
          return { ...c, [field]: !c[field] };
        }
        return c;
      })
    );
  };

  const handleSave = async (gateway: string) => {
    const ctrl = controls.find((c) => c.gateway === gateway);
    if (!ctrl) return;

    setSavingGateway(gateway);
    setSuccessMsg((prev) => ({ ...prev, [gateway]: "" }));
    setErrorMsg((prev) => ({ ...prev, [gateway]: "" }));

    try {
      const res = await fetch("/api/admin/seller-gateways", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateway,
          allowNewConnections: ctrl.allowNewConnections,
          allowNewPayments: ctrl.allowNewPayments,
          notes: editedNotes[gateway] || "",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao salvar alterações do gateway.");
      }

      setControls((prev) =>
        prev.map((c) => (c.gateway === gateway ? data.control : c))
      );
      setSuccessMsg((prev) => ({
        ...prev,
        [gateway]: "Configurações salvas com sucesso!",
      }));

      setTimeout(() => {
        setSuccessMsg((prev) => ({ ...prev, [gateway]: "" }));
      }, 4000);
    } catch (err: any) {
      setErrorMsg((prev) => ({
        ...prev,
        [gateway]: err.message || "Erro de conexão ao salvar.",
      }));
    } finally {
      setSavingGateway(null);
    }
  };

  const getGatewayBadge = (gateway: string) => {
    if (gateway === "pushinpay") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Pix Direto / Split
        </span>
      );
    }
    if (gateway === "mercadopago") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
          OAuth 2.0 / Pix
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        Parceiro Restrito
      </span>
    );
  };

  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  return (
    <div className="space-y-6 pb-12 text-zinc-100 max-w-6xl">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              Gateways dos Vendedores
            </h1>
            <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Controle da Plataforma
            </span>
          </div>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">
            Defina de forma independente a permissão de novas conexões e o processamento de vendas de cada gateway disponível para lojistas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14141B] border border-white/[0.08] text-zinc-300 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Validação Ativa em Backend</span>
          </div>
        </div>
      </div>

      {/* INFORMATIVE CARD */}
      <div className="p-4 rounded-2xl bg-[#111116] border border-white/[0.08] text-xs text-zinc-300 flex items-start gap-3 shadow-md">
        <HelpCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-white">Como funciona o controle de gateways:</p>
          <p className="text-zinc-400 leading-relaxed">
            • <strong>Permitir Novas Conexões:</strong> se desativado, lojistas não poderão conectar novas contas ou alterar credenciais deste gateway. Contas já conectadas permanecem salvas.<br />
            • <strong>Permitir Novos Pagamentos:</strong> se desativado, o checkout não gerará novas cobranças por este gateway, exibindo uma mensagem transparente ao cliente.<br />
            • Nenhuma conta conectada é desvinculada e nenhum pedido existente é cancelado ao alterar essas opções.
          </p>
        </div>
      </div>

      {/* GATEWAY CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {controls.map((ctrl) => {
          const isSaving = savingGateway === ctrl.gateway;
          const succ = successMsg[ctrl.gateway];
          const err = errorMsg[ctrl.gateway];

          return (
            <div
              key={ctrl.gateway}
              className="rounded-2xl bg-[#14141B] border border-white/[0.08] shadow-xl p-5 flex flex-col justify-between space-y-5 relative overflow-hidden"
            >
              {/* Top Accent Indicator */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 ${
                  ctrl.allowNewPayments && ctrl.allowNewConnections
                    ? "bg-emerald-500"
                    : ctrl.allowNewPayments || ctrl.allowNewConnections
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
              />

              <div className="space-y-4">
                {/* Header Card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-400" />
                      {ctrl.name}
                    </h2>
                    <p className="text-[11px] text-zinc-400 font-mono uppercase">
                      ID: {ctrl.gateway}
                    </p>
                  </div>
                  {getGatewayBadge(ctrl.gateway)}
                </div>

                {/* CONTROLS */}
                <div className="p-3.5 rounded-xl bg-[#0F0F14] border border-white/[0.06] space-y-3.5">
                  {/* Control 1: New Connections */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-zinc-200 block">
                        Novas Conexões
                      </span>
                      <span className="text-[10px] text-zinc-400 block">
                        Permitir que lojistas vinculem contas
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggle(ctrl.gateway, "allowNewConnections")}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        ctrl.allowNewConnections ? "bg-emerald-600" : "bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          ctrl.allowNewConnections ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {ctrl.allowNewConnections ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        <Unlock className="w-3 h-3" /> Vendedores podem conectar
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1 font-medium">
                        <Lock className="w-3 h-3" /> Conexões bloqueadas pelo admin
                      </span>
                    )}
                  </div>

                  <div className="border-t border-white/[0.06]" />

                  {/* Control 2: New Payments */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-zinc-200 block">
                        Novos Pagamentos
                      </span>
                      <span className="text-[10px] text-zinc-400 block">
                        Processar vendas e checkouts
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggle(ctrl.gateway, "allowNewPayments")}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        ctrl.allowNewPayments ? "bg-emerald-600" : "bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          ctrl.allowNewPayments ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {ctrl.allowNewPayments ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        <Zap className="w-3 h-3" /> Checkout ativo para vendas
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1 font-medium">
                        <Lock className="w-3 h-3" /> Vendas bloqueadas no checkout
                      </span>
                    )}
                  </div>
                </div>

                {/* Notes Input */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-400">
                    Notas / Motivo da Regra (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={editedNotes[ctrl.gateway] || ""}
                    onChange={(e) =>
                      setEditedNotes((prev) => ({
                        ...prev,
                        [ctrl.gateway]: e.target.value,
                      }))
                    }
                    placeholder="Instruções internas para a equipe de suporte..."
                    className="w-full text-xs bg-[#0F0F14] border border-white/[0.08] rounded-xl px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 resize-none"
                  />
                </div>

                {/* Audit Information */}
                <div className="text-[10px] text-zinc-500 space-y-1 pt-1 border-t border-white/[0.04]">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-zinc-600" />
                    <span>Última alteração: {formatDate(ctrl.updatedAt)}</span>
                  </div>
                  {ctrl.updatedByName && (
                    <div className="flex items-center gap-1.5 truncate">
                      <User className="w-3 h-3 text-zinc-600 shrink-0" />
                      <span className="truncate">Por: {ctrl.updatedByName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Feedback Messages */}
              {succ && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{succ}</span>
                </div>
              )}
              {err && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{err}</span>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={() => handleSave(ctrl.gateway)}
                disabled={isSaving}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar Configuração</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

