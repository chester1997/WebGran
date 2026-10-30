"use client";

import { useState } from "react";
import {
  Coins,
  Clock,
  User,
  Save,
  History,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Info,
  Volume2,
} from "lucide-react";
import { playCommissionChime, unlockAudioContext } from "@/lib/sound/notification-sound";
import {
  CommissionSettingsResponse,
  CommissionAuditLogItem,
} from "@/lib/commission/platform-commission-service";

interface CommissionClientProps {
  user: any;
  initialCommission: CommissionSettingsResponse | null;
  initialHistory: CommissionAuditLogItem[];
  initialError?: string | null;
}

export default function CommissionClient({
  user,
  initialCommission,
  initialHistory,
  initialError,
}: CommissionClientProps) {
  const [commission, setCommission] = useState<CommissionSettingsResponse | null>(initialCommission);
  const [history, setHistory] = useState<CommissionAuditLogItem[]>(initialHistory);

  // Form state
  const [feeReaisInput, setFeeReaisInput] = useState<string>(
    initialCommission ? (initialCommission.feeCents / 100).toFixed(2).replace(".", ",") : ""
  );
  const [reason, setReason] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError || null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Parse Brazilian currency format (e.g. "0,50" -> 50 cents, "1,00" -> 100 cents)
    const normalized = feeReaisInput.trim().replace(/\./g, "").replace(",", ".");
    const numericReais = parseFloat(normalized);

    if (isNaN(numericReais) || numericReais < 0) {
      setErrorMessage("Informe um valor monetário válido em reais (ex: 0,50 ou 1,00).");
      return;
    }

    const calculatedCents = Math.round(numericReais * 100);
    if (!Number.isInteger(calculatedCents)) {
      setErrorMessage("O valor da comissão deve ser expresso em centavos inteiros.");
      return;
    }

    if (calculatedCents > 100000) {
      setErrorMessage("O valor máximo permitido é R$ 1.000,00 por venda.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeCents: calculatedCents,
          reason: reason.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Falha ao atualizar comissão.");
      }

      setCommission(json.data.commission);
      setHistory(json.data.history);
      setFeeReaisInput((json.data.commission.feeCents / 100).toFixed(2).replace(".", ","));
      setReason("");
      setSuccessMessage("Comissão atualizada com sucesso! O novo valor será aplicado às próximas vendas.");
    } catch (err: any) {
      setErrorMessage(err.message || "Erro de conexão ao salvar comissão.");
    } finally {
      setLoading(false);
    }
  };

  const [isPlayingSound, setIsPlayingSound] = useState(false);

  const handleTestSound = async () => {
    setIsPlayingSound(true);
    await unlockAudioContext();
    await playCommissionChime({ force: true });
    setTimeout(() => setIsPlayingSound(false), 1200);
  };

  const formatDate = (d: string | Date) => {
    try {
      const date = new Date(d);
      return date.toLocaleString("pt-BR", {
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
    <div className="space-y-6 pb-12 text-zinc-100 fade-in w-full">
      {/* ==================================================== */}
      {/* 1. HEADER (Integrado ao fundo, sem caixa card) */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              Comissão da Plataforma
            </h1>
            <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Configuração Global
            </span>
          </div>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">
            Configure a taxa fixa retida por venda no split Pix automático da PushinPay
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleTestSound}
            disabled={isPlayingSound}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#15171D] border border-white/[0.08] hover:border-white/20 text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
            title="Ouvir som de notificação de comissão"
          >
            <Volume2 className={`w-3.5 h-3.5 ${isPlayingSound ? "animate-bounce text-emerald-400" : "text-amber-400"}`} />
            <span>{isPlayingSound ? "Tocando..." : "Testar Som"}</span>
          </button>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Split Ativo & Seguro</span>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 2. OVERVIEW CARDS */}
      {/* ==================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 w-full">
        {/* Card 1: Valor Vigente */}
        <div className="p-5 rounded-2xl bg-[#0F1014] border border-blue-500/30 shadow-lg shadow-blue-500/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 text-white pointer-events-none">
            <Coins className="w-24 h-24" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
            Comissão Atual / Venda
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight font-mono tabular-nums">
              {commission ? commission.formattedFee : "Indisponível"}
            </span>
            {commission && (
              <span className="text-xs text-blue-400 font-mono">({commission.feeCents} centavos)</span>
            )}
          </div>
          <p className="mt-2 text-xs text-zinc-400 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Retido via split automático no Pix</span>
          </p>
        </div>

        {/* Card 2: Última Atualização */}
        <div className="p-5 rounded-2xl bg-[#0F1014] border border-white/[0.08] relative overflow-hidden">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
            Última Alteração
          </span>
          <div className="mt-2 flex items-center gap-2 text-zinc-200">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold font-mono">
              {commission ? formatDate(commission.updatedAt) : "—"}
            </span>
          </div>
          <div className="mt-2 text-xs text-zinc-400 flex items-center gap-1.5 truncate">
            <User className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span>Por: <strong className="text-zinc-300 font-medium">{commission?.updatedByName || "—"}</strong></span>
          </div>
        </div>

        {/* Card 3: Regra de Aplicação */}
        <div className="p-5 rounded-2xl bg-[#0F1014] border border-white/[0.08] relative overflow-hidden">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
            Regra de Negócio
          </span>
          <div className="mt-2 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-300 leading-relaxed">
              Vendas com valor igual ou inferior a R$ 0,50 têm o split dispensado automaticamente, sem gerar erro no checkout do lojista.
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-3 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. FORM SECTION */}
      {/* ==================================================== */}
      <div className="bg-[#0F1014] border border-white/[0.08] rounded-2xl p-6 shadow-xl space-y-5 w-full">
        <div>
          <h2 className="text-base font-bold text-white">Atualizar Valor da Comissão</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Ao salvar, a nova comissão entrará em vigor imediatamente para todas as <strong>novas cobranças Pix</strong> geradas pelos lojistas. Pedidos já criados preservarão o valor da comissão registrado no momento da compra.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Novo Valor por Venda (R$)
              </label>
              <div className="relative rounded-xl border border-white/[0.08] bg-[#15171D] focus-within:border-blue-500 transition-colors">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">
                  R$
                </span>
                <input
                  type="text"
                  value={feeReaisInput}
                  onChange={(e) => setFeeReaisInput(e.target.value)}
                  placeholder="0,50"
                  className="w-full bg-transparent pl-11 pr-4 py-2.5 text-sm font-semibold text-white focus:outline-none"
                  disabled={loading}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-500">
                Exemplo: 0,50 para R$ 0,50 (50 centavos) ou 1,00 para R$ 1,00 (100 centavos).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Motivo / Justificativa (Auditoria)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Ajuste da taxa operacional da plataforma"
                className="w-full rounded-xl border border-white/[0.08] bg-[#15171D] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-zinc-600"
                disabled={loading}
              />
              <p className="mt-1.5 text-[11px] text-zinc-500">
                Ficará registrado no log de auditoria com seu nome e data.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl h-10 px-6 shadow-md transition-all inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 text-xs"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? "Salvando..." : "Salvar Alteração"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* ==================================================== */}
      {/* 4. AUDIT HISTORY SECTION */}
      {/* ==================================================== */}
      <div className="bg-[#0F1014] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl w-full">
        <div className="flex items-center gap-2.5 p-5 border-b border-white/[0.06]">
          <History className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Histórico de Auditoria ({history.length})
          </h2>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-zinc-500 py-10 text-center">Nenhuma alteração registrada ainda.</p>
        ) : (
          <div className="overflow-x-auto custom-admin-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#15171D] text-zinc-400 text-[11px] font-semibold uppercase tracking-wider border-b border-white/[0.06]">
                <tr>
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Responsável</th>
                  <th className="py-3 px-4">Transição de Valor</th>
                  <th className="py-3 px-4">Motivo / Justificativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-mono text-zinc-300 text-[11px]">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{item.changedByName || "Administrador"}</div>
                      {item.changedByEmail && (
                        <div className="text-[10px] text-zinc-400 font-mono">{item.changedByEmail}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-2 font-mono font-bold text-xs">
                        <span className="text-zinc-400">R$ {item.previousFeeReais.toFixed(2).replace('.', ',')}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-emerald-400">R$ {item.newFeeReais.toFixed(2).replace('.', ',')}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300">
                      {item.reason ? (
                        <span>{item.reason}</span>
                      ) : (
                        <span className="text-zinc-600 italic">Sem observação</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
