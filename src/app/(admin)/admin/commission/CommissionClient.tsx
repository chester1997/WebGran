"use client";

import { useState, useTransition } from "react";
import {
  Coins,
  Clock,
  User,
  Save,
  History,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  Info,
  Volume2,
  DollarSign,
  Filter,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CreditCard,
  Building2,
  Calendar,
  Layers,
  ShoppingBag,
  X,
  Loader2,
  Receipt,
  ArrowUpRight,
} from "lucide-react";
import { playCommissionChime, unlockAudioContext } from "@/lib/sound/notification-sound";
import {
  CommissionSettingsResponse,
  CommissionAuditLogItem,
} from "@/lib/commission/platform-commission-service";
import {
  CommissionSellerBreakdownItem,
  CommissionSplitOrderDetail,
} from "@/lib/commission/platform-commission-metrics";

interface CommissionClientProps {
  user: any;
  initialCommission: CommissionSettingsResponse | null;
  initialHistory: CommissionAuditLogItem[];
  initialMetrics: any | null;
  availableSellers: any[];
  initialError?: string | null;
}

export default function CommissionClient({
  user,
  initialCommission,
  initialHistory,
  initialMetrics,
  availableSellers,
  initialError,
}: CommissionClientProps) {
  // Commission settings state
  const [commission, setCommission] = useState<CommissionSettingsResponse | null>(initialCommission);
  const [history, setHistory] = useState<CommissionAuditLogItem[]>(initialHistory);

  // Active view tab
  const [activeTab, setActiveTab] = useState<"analytics" | "settings">("analytics");

  // Form state
  const [feeReaisInput, setFeeReaisInput] = useState<string>(
    initialCommission ? (initialCommission.feeCents / 100).toFixed(2).replace(".", ",") : ""
  );
  const [reason, setReason] = useState<string>("");
  const [loadingSave, setLoadingSave] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError || null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPlayingSound, setIsPlayingSound] = useState(false);

  // Analytics & Drilldown state
  const [metrics, setMetrics] = useState<any | null>(initialMetrics);
  const [selectedSeller, setSelectedSeller] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("30d");
  const [sellerPage, setSellerPage] = useState<number>(initialMetrics?.sellers?.page || 1);
  const [isPendingMetrics, startTransition] = useTransition();

  // Drilldown modal state
  const [drillModalOpen, setDrillModalOpen] = useState(false);
  const [drillSeller, setDrillSeller] = useState<CommissionSellerBreakdownItem | null>(null);
  const [drillOrders, setDrillOrders] = useState<CommissionSplitOrderDetail[]>([]);
  const [drillTotalOrders, setDrillTotalOrders] = useState(0);
  const [drillPage, setDrillPage] = useState(1);
  const [drillTotalPages, setDrillTotalPages] = useState(1);
  const [drillLoading, setDrillLoading] = useState(false);

  // Search filter for sellers list
  const [sellerSearch, setSellerSearch] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

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

    setLoadingSave(true);

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
      setLoadingSave(false);
    }
  };

  const handleTestSound = async () => {
    setIsPlayingSound(true);
    await unlockAudioContext();
    await playCommissionChime({ force: true });
    setTimeout(() => setIsPlayingSound(false), 1200);
  };

  const fetchMetrics = (page = 1, period = selectedPeriod, seller = selectedSeller) => {
    startTransition(async () => {
      try {
        const query = new URLSearchParams({
          period,
          sellerId: seller,
          page: String(page),
        });

        const res = await fetch(`/api/admin/commission/metrics?${query.toString()}`);
        const json = await res.json();

        if (res.ok && json.success) {
          setMetrics(json.data);
          setSellerPage(page);
        }
      } catch (err) {
        console.warn("Falha ao atualizar métricas de comissão:", err);
      }
    });
  };

  const handlePeriodChange = (p: string) => {
    setSelectedPeriod(p);
    fetchMetrics(1, p, selectedSeller);
  };

  const handleSellerFilterChange = (s: string) => {
    setSelectedSeller(s);
    fetchMetrics(1, selectedPeriod, s);
  };

  const openDrillDown = async (seller: CommissionSellerBreakdownItem, page = 1) => {
    setDrillSeller(seller);
    setDrillModalOpen(true);
    setDrillLoading(true);
    setDrillPage(page);

    try {
      const res = await fetch(`/api/admin/commission/metrics?drillSellerId=${seller.sellerId}&drillPage=${page}`);
      const json = await res.json();
      if (res.ok && json.success && json.drillData) {
        setDrillOrders(json.drillData.items);
        setDrillTotalOrders(json.drillData.total);
        setDrillTotalPages(json.drillData.totalPages);
      }
    } catch (err) {
      console.warn("Erro ao carregar drill-down de ordens:", err);
    } finally {
      setDrillLoading(false);
    }
  };

  const formatDate = (d: string | Date) => {
    try {
      return new Date(d).toLocaleString("pt-BR", {
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

  const kpis = metrics?.kpis;
  const timeSeries = metrics?.timeSeries || [];
  const sellersList = (metrics?.sellers?.items || []) as CommissionSellerBreakdownItem[];
  const maxFeeTime = Math.max(...timeSeries.map((t: any) => t.fees), 1);

  const filteredSellers = sellersList.filter((s) => {
    if (!sellerSearch.trim()) return true;
    const term = sellerSearch.toLowerCase();
    return (
      s.sellerName.toLowerCase().includes(term) ||
      (s.sellerEmail && s.sellerEmail.toLowerCase().includes(term)) ||
      s.storeName.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 pb-12 text-zinc-100 max-w-7xl">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              Comissão da Plataforma
            </h1>
            <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Gestão Financeira & Split
            </span>
          </div>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">
            Acompanhe o volume retido via split automático, analise por vendedor e configure a taxa global da WebGran.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleTestSound}
            disabled={isPlayingSound}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#16161D] border border-white/[0.08] hover:border-white/20 text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
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

      {/* 2. NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("analytics")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "analytics"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Retenções & Detalhamento por Vendedor</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "settings"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Configuração Global da Taxa</span>
        </button>
      </div>

      {/* ERROR / SUCCESS ALERTS */}
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

      {/* ========================================================= */}
      {/* TAB 1: ANALYTICS & DRILL-DOWN */}
      {/* ========================================================= */}
      {activeTab === "analytics" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Filters Bar */}
          <div className="p-4 rounded-2xl bg-[#14141B] border border-white/[0.08] shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-[260px]">
              <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
              <select
                value={selectedSeller}
                onChange={(e) => handleSellerFilterChange(e.target.value)}
                className="w-full text-xs font-semibold bg-[#0F0F14] border border-white/[0.08] rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-blue-500/50 cursor-pointer"
              >
                <option value="all">Todos os Vendedores</option>
                {availableSellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.storeName ? `(${s.storeName})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-[#0F0F14] p-1 rounded-xl border border-white/[0.06] overflow-x-auto self-start md:self-auto">
              {[
                { id: "7d", label: "7 Dias" },
                { id: "30d", label: "30 Dias" },
                { id: "month", label: "Este Mês" },
                { id: "year", label: "Este Ano" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePeriodChange(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    selectedPeriod === p.id
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Arrecadado */}
            <div className="p-5 rounded-2xl bg-[#14141B] border border-blue-500/30 shadow-lg shadow-blue-500/5 relative overflow-hidden">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                Comissão Retida no Período
              </span>
              <div className="mt-2 text-2xl sm:text-3xl font-black text-white tracking-tight">
                {kpis ? kpis.formattedTotalRetainedFees : "R$ 0,00"}
              </div>
              <p className="mt-2 text-xs text-blue-400 flex items-center gap-1.5 font-medium">
                <Receipt className="w-3.5 h-3.5" />
                <span>Receita líquida da plataforma</span>
              </p>
            </div>

            {/* Card 2: Pedidos com Split */}
            <div className="p-5 rounded-2xl bg-[#14141B] border border-white/[0.08]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                Vendas com Retenção
              </span>
              <div className="mt-2 text-2xl sm:text-3xl font-black text-white tracking-tight">
                {kpis ? kpis.totalSettledOrders.toLocaleString("pt-BR") : "0"}
              </div>
              <p className="mt-2 text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Pedidos aprovados com split</span>
              </p>
            </div>

            {/* Card 3: GMV Transacionado */}
            <div className="p-5 rounded-2xl bg-[#14141B] border border-white/[0.08]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                Volume Transacionado (GMV)
              </span>
              <div className="mt-2 text-2xl sm:text-3xl font-black text-white tracking-tight">
                {kpis ? kpis.formattedTotalGmv : "R$ 0,00"}
              </div>
              <p className="mt-2 text-xs text-zinc-400 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-zinc-500" />
                <span>Total de vendas dos lojistas</span>
              </p>
            </div>

            {/* Card 4: Taxa Global Vigente */}
            <div className="p-5 rounded-2xl bg-[#14141B] border border-white/[0.08]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                Taxa Global Vigente / Venda
              </span>
              <div className="mt-2 text-2xl sm:text-3xl font-black text-white tracking-tight">
                {commission ? commission.formattedFee : "R$ 0,50"}
              </div>
              <p className="mt-2 text-xs text-zinc-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>{commission?.feeCents || 50} centavos por venda</span>
              </p>
            </div>
          </div>

          {/* EVOLUTION CHART */}
          <div className="p-5 rounded-2xl bg-[#14141B] border border-white/[0.08] shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Evolução Diária da Comissão Arrecadada
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Receita diária gerada via retenções nos checkouts
                </p>
              </div>
            </div>

            {timeSeries.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-zinc-500 text-xs">
                <span>Nenhuma retenção de comissão registrada no período.</span>
              </div>
            ) : (
              <div className="h-48 pt-6 flex items-end gap-2 overflow-x-auto pb-2">
                {timeSeries.map((pt: any, idx: number) => {
                  const h = Math.max(10, Math.round((pt.fees / maxFeeTime) * 100));
                  return (
                    <div
                      key={idx}
                      className="flex-1 min-w-[32px] max-w-[48px] flex flex-col items-center gap-1.5 group relative cursor-pointer"
                    >
                      <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                        <div className="bg-zinc-950 border border-white/20 text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap">
                          <div className="font-semibold text-zinc-300">{pt.label}</div>
                          <div className="text-blue-400 font-bold">
                            Taxa: {pt.fees.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </div>
                          <div className="text-zinc-400">Vendas: {pt.ordersCount}</div>
                        </div>
                        <div className="w-2 h-2 bg-zinc-950 border-r border-b border-white/20 transform rotate-45 -mt-1" />
                      </div>

                      <div className="w-full h-36 flex items-end justify-center">
                        <div
                          style={{ height: `${h}%` }}
                          className="w-full rounded-t-md bg-blue-500 hover:bg-blue-400 transition-all duration-300"
                        />
                      </div>

                      <span className="text-[10px] text-zinc-500 font-mono text-center">
                        {pt.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SELLERS BREAKDOWN & DRILL-DOWN TABLE */}
          <div className="p-5 rounded-2xl bg-[#14141B] border border-white/[0.08] shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Detalhamento de Comissão por Vendedor
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Clique em &quot;Ver Ordens&quot; para fazer o drill-down e auditar as cobranças individuais
                </p>
              </div>

              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar vendedor ou loja..."
                  value={sellerSearch}
                  onChange={(e) => setSellerSearch(e.target.value)}
                  className="w-full text-xs bg-[#0F0F14] border border-white/[0.08] rounded-xl pl-8 pr-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    <th className="py-3 px-3">Vendedor</th>
                    <th className="py-3 px-3">Loja</th>
                    <th className="py-3 px-3">Vendas Pagas</th>
                    <th className="py-3 px-3">Volume GMV</th>
                    <th className="py-3 px-3">Comissão WebGran</th>
                    <th className="py-3 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredSellers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500">
                        Nenhum vendedor encontrado com movimentação no período selecionado.
                      </td>
                    </tr>
                  ) : (
                    filteredSellers.map((item) => (
                      <tr key={item.sellerId} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-3 space-y-0.5">
                          <span className="font-semibold text-white block">{item.sellerName}</span>
                          {item.sellerEmail && (
                            <span className="text-[10px] text-zinc-400 block">{item.sellerEmail}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-medium text-zinc-300">
                          {item.storeName}
                        </td>
                        <td className="py-3 px-3 font-semibold text-sky-400">
                          {item.salesCount}
                        </td>
                        <td className="py-3 px-3 font-mono text-zinc-200">
                          {item.formattedTotalGmv}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-blue-400">
                          {item.formattedTotalFees}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => openDrillDown(item, 1)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer"
                          >
                            <span>Ver Ordens</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {metrics?.sellers?.totalPages > 1 && (
              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
                <span>
                  Mostrando {sellersList.length} de {metrics.sellers.total} vendedor(es)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fetchMetrics(sellerPage - 1)}
                    disabled={sellerPage <= 1 || isPendingMetrics}
                    className="p-1.5 rounded-lg bg-[#0F0F14] border border-white/[0.08] hover:border-white/20 text-zinc-300 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-white px-2">
                    {sellerPage} / {metrics.sellers.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => fetchMetrics(sellerPage + 1)}
                    disabled={sellerPage >= metrics.sellers.totalPages || isPendingMetrics}
                    className="p-1.5 rounded-lg bg-[#0F0F14] border border-white/[0.08] hover:border-white/20 text-zinc-300 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: GLOBAL COMMISSION SETTINGS */}
      {/* ========================================================= */}
      {activeTab === "settings" && (
        <div className="space-y-6 animate-in fade-in max-w-4xl">
          {/* Card Resumo da Regra */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-[#14141B] border border-blue-500/30">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                Comissão Atual / Venda
              </span>
              <div className="mt-2 text-3xl font-black text-white">
                {commission ? commission.formattedFee : "Indisponível"}
              </div>
              <p className="mt-1 text-xs text-blue-400 font-mono">
                ({commission?.feeCents || 0} centavos)
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#14141B] border border-white/[0.08]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                Última Alteração
              </span>
              <div className="mt-2 text-sm font-bold text-zinc-200">
                {commission ? formatDate(commission.updatedAt) : "—"}
              </div>
              <p className="mt-1 text-xs text-zinc-400 truncate">
                Por: {commission?.updatedByName || "Administrador"}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#14141B] border border-white/[0.08]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                Regra de Isenção Automática
              </span>
              <div className="mt-2 text-xs text-zinc-300 leading-relaxed">
                Vendas com valor igual ou inferior a R$ 0,50 têm o split dispensado automaticamente sem causar falhas no checkout.
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-[#14141B] border border-white/[0.08] rounded-2xl p-6 shadow-xl space-y-5">
            <div>
              <h2 className="text-base font-bold text-white">Atualizar Valor da Comissão Global</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Ao salvar, a nova comissão entrará em vigor imediatamente para todas as <strong>novas cobranças Pix</strong>.
                Pedidos já criados preservam o valor registrado no momento da compra.
              </p>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Valor da Comissão por Venda (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">
                      R$
                    </span>
                    <input
                      type="text"
                      value={feeReaisInput}
                      onChange={(e) => setFeeReaisInput(e.target.value)}
                      placeholder="0,50"
                      className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-[#0F0F14] border border-white/[0.08] rounded-xl text-white focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Motivo da Alteração (opcional)
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ex: Ajuste de alíquota da plataforma"
                    className="w-full px-3 py-2 text-xs bg-[#0F0F14] border border-white/[0.08] rounded-xl text-white focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loadingSave}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                {loadingSave ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar Nova Comissão</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Audit History */}
          <div className="bg-[#14141B] border border-white/[0.08] rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" />
              <span>Histórico de Alterações Administrativas</span>
            </h3>

            <div className="divide-y divide-white/[0.04] text-xs">
              {history.length === 0 ? (
                <div className="py-4 text-center text-zinc-500">
                  Nenhuma alteração registrada até o momento.
                </div>
              ) : (
                history.map((h) => (
                  <div key={h.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-200">
                          R$ {h.previousFeeReais.toFixed(2).replace(".", ",")} → R$ {h.newFeeReais.toFixed(2).replace(".", ",")}
                        </span>
                        {h.reason && (
                          <span className="text-[11px] text-zinc-400 italic">
                            ({h.reason})
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500 block">
                        Por: {h.changedByName || h.changedByEmail || "Admin"} • {formatDate(h.createdAt)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. DRILL-DOWN MODAL */}
      {/* ========================================================= */}
      {drillModalOpen && drillSeller && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14141B] border border-white/10 rounded-2xl w-full max-w-3xl p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    <span>Ordens com Retenção: {drillSeller.sellerName}</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Loja: {drillSeller.storeName} • Total de Vendas: {drillSeller.salesCount} ({drillSeller.formattedTotalFees} em taxas)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDrillModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {drillLoading ? (
                <div className="py-16 flex flex-col items-center justify-center text-zinc-400 text-xs space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  <span>Carregando ordens vinculadas...</span>
                </div>
              ) : drillOrders.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  Nenhuma ordem paga encontrada para este vendedor no período.
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[50vh]">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Pedido</th>
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Valor Bruto</th>
                        <th className="py-2.5 px-3">Taxa WebGran</th>
                        <th className="py-2.5 px-3">Split Status</th>
                        <th className="py-2.5 px-3">Gateway</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {drillOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-mono font-semibold text-white">
                            #{ord.id.slice(0, 8)}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-400">{ord.formattedDate}</td>
                          <td className="py-2.5 px-3 font-mono text-zinc-200">{ord.formattedTotal}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-400">
                            {ord.formattedPlatformFee}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {ord.splitStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 capitalize text-zinc-400">{ord.paymentMethod}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Drill Pagination */}
            {drillTotalPages > 1 && (
              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs text-zinc-400">
                <span>Total: {drillTotalOrders} pedido(s)</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openDrillDown(drillSeller, drillPage - 1)}
                    disabled={drillPage <= 1 || drillLoading}
                    className="p-1 rounded bg-[#0F0F14] border border-white/10 text-zinc-300 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-white">
                    {drillPage} / {drillTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => openDrillDown(drillSeller, drillPage + 1)}
                    disabled={drillPage >= drillTotalPages || drillLoading}
                    className="p-1 rounded bg-[#0F0F14] border border-white/10 text-zinc-300 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
