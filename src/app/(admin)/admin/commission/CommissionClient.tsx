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
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  CommissionSettingsResponse, 
  CommissionAuditLogItem 
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
    initialCommission ? (initialCommission.feeCents / 100).toFixed(2).replace('.', ',') : ""
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
      setFeeReaisInput((json.data.commission.feeCents / 100).toFixed(2).replace('.', ','));
      setReason("");
      setSuccessMessage("Comissão atualizada com sucesso! O novo valor será aplicado às próximas vendas.");
    } catch (err: any) {
      setErrorMessage(err.message || "Erro de conexão ao salvar comissão.");
    } finally {
      setLoading(false);
    }
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
    <div className="space-y-8 max-w-6xl pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Comissão da Plataforma</h1>
              <p className="text-sm text-zinc-400">
                Configure a taxa fixa retida por venda no split Pix da Pushin Pay.
              </p>
            </div>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4" />
          Split Ativo & Seguro
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Valor Vigente */}
        <div className="bg-[#121217] border border-white/5 rounded-2xl p-5 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-white">
            <Coins className="w-20 h-20" />
          </div>
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Comissão Atual / Venda</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-white">
              {commission ? commission.formattedFee : "Indisponível"}
            </span>
            {commission && (
              <span className="text-xs text-zinc-400 font-mono">({commission.feeCents} centavos)</span>
            )}
          </div>
          <p className="mt-2 text-xs text-zinc-400 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Retido via split automático no Pix
          </p>
        </div>

        {/* Card 2: Última Atualização */}
        <div className="bg-[#121217] border border-white/5 rounded-2xl p-5 relative overflow-hidden shadow-lg">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Última Alteração</span>
          <div className="mt-2 flex items-center gap-2 text-zinc-200">
            <Clock className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-semibold">
              {commission ? formatDate(commission.updatedAt) : "—"}
            </span>
          </div>
          <div className="mt-2 text-xs text-zinc-400 flex items-center gap-1.5 truncate">
            <User className="w-3.5 h-3.5 text-zinc-400" />
            <span>Por: <strong className="text-zinc-300 font-medium">{commission?.updatedByName || "—"}</strong></span>
          </div>
        </div>

        {/* Card 3: Regra de Aplicação */}
        <div className="bg-[#121217] border border-white/5 rounded-2xl p-5 relative overflow-hidden shadow-lg">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Regra de Negócio</span>
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
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Form Section */}
      <div className="bg-[#121217] border border-white/5 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-2">Atualizar Valor da Comissão</h2>
        <p className="text-xs text-zinc-400 mb-6">
          Ao salvar, a nova comissão entrará em vigor imediatamente para todas as <strong>novas cobranças Pix</strong> geradas pelos lojistas. Pedidos já criados preservarão o valor da comissão registrado no momento da compra.
        </p>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Valor da Comissão por Venda (R$)
              </label>
              <div className="relative rounded-xl border border-white/10 bg-[#0C0C0E] focus-within:border-rose-500 transition-colors">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">
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
              <p className="mt-1.5 text-[11px] text-zinc-400">
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
                className="w-full rounded-xl border border-white/10 bg-[#0C0C0E] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 transition-colors placeholder:text-zinc-600"
                disabled={loading}
              />
              <p className="mt-1.5 text-[11px] text-zinc-400">
                Ficará registrado no log de auditoria com seu nome e data.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl h-10 px-6 shadow-lg shadow-rose-600/20 inline-flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {loading ? "Salvando..." : "Salvar Alteração"}
            </Button>
          </div>
        </form>
      </div>

      {/* Audit History Section */}
      <div className="bg-[#121217] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2.5 border-b border-white/5 pb-4">
          <History className="w-5 h-5 text-rose-400" />
          <h2 className="text-lg font-bold text-white">Histórico de Auditoria</h2>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-zinc-500 py-6 text-center">Nenhuma alteração registrada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0C0C0E] text-zinc-400 font-semibold border-b border-white/5">
                <tr>
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Responsável</th>
                  <th className="py-3 px-4">Transição de Valor</th>
                  <th className="py-3 px-4">Motivo / Justificativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-mono text-zinc-300">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white">{item.changedByName || "Administrador"}</div>
                      {item.changedByEmail && (
                        <div className="text-[11px] text-zinc-400">{item.changedByEmail}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-2 font-mono font-bold">
                        <span className="text-zinc-400">R$ {item.previousFeeReais.toFixed(2).replace('.', ',')}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-rose-400" />
                        <span className="text-emerald-400">R$ {item.newFeeReais.toFixed(2).replace('.', ',')}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300">
                      {item.reason || <span className="text-zinc-600 italic">Sem observação</span>}
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
