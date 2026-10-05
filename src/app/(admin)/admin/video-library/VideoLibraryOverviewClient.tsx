"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Film,
  HardDrive,
  Users,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  PieChart,
  ShieldCheck,
  AlertCircle,
  XCircle,
} from "lucide-react";

export default function VideoLibraryOverviewClient({ user }: { user: any }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters for Seller Table
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [usageFilter, setUsageFilter] = useState("ALL");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/video-library/stats");
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || "Erro ao carregar estatísticas.");
      }
    } catch (err: any) {
      setError(err.message || "Falha na conexão.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const kpis = data?.kpis || {
    totalUsedGb: 0,
    contractedQuotaGb: 0,
    subscribersCount: 0,
    mrrTotal: 0,
    totalVideos: 0,
    readyVideos: 0,
    processingVideos: 0,
    failedVideos: 0,
  };

  const revenue = data?.revenue || {
    mrrTotal: 0,
    subscribersCount: 0,
    averageTicket: 0,
    planDistribution: [],
  };

  const storageReport = data?.storageReport || {
    totalUsedGb: 0,
    contractedQuotaGb: 0,
    availableGb: 0,
    percentUsed: 0,
  };

  const sellers = data?.sellers || [];
  const alerts = data?.alerts || [];

  // Filter sellers
  const filteredSellers = sellers.filter((s: any) => {
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const nameMatch = s.sellerName?.toLowerCase().includes(q);
      const emailMatch = s.sellerEmail?.toLowerCase().includes(q);
      if (!nameMatch && !emailMatch) return false;
    }
    if (planFilter !== "ALL" && s.planName !== planFilter) return false;
    if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
    if (usageFilter === "HIGH" && s.percent < 80) return false;
    if (usageFilter === "CRITICAL" && s.percent < 90) return false;
    if (usageFilter === "EXCEEDED" && s.percent < 100) return false;
    return true;
  });

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);
  };

  return (
    <div className="w-full p-4 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-violet-950/60 via-zinc-900 to-zinc-950 p-6 rounded-2xl border border-violet-500/20 shadow-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-violet-600/20 rounded-xl border border-violet-500/30 text-violet-400">
              <Film className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Biblioteca de Vídeos — Dashboard Operacional
              </h1>
              <p className="text-sm text-zinc-400">
                Métricas em tempo real de armazenamento, vendas, assinaturas e uso por vendedor.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl border border-zinc-700 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Atualizar</span>
          </button>

          <Link
            href="/admin/video-library/plans"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl shadow-lg shadow-violet-600/30 transition-all cursor-pointer"
          >
            <HardDrive className="w-4 h-4" />
            <span>Planos de Armazenamento</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* 8 KPIs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* 1. Armazenamento Utilizado */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl space-y-1">
          <div className="text-zinc-400 text-[11px] font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Utilizado</span>
            <HardDrive className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div className="text-xl font-extrabold text-white">{kpis.totalUsedGb} GB</div>
          <p className="text-[10px] text-zinc-500">Mídia total consumida</p>
        </div>

        {/* 2. Quota Contratada */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl space-y-1">
          <div className="text-zinc-400 text-[11px] font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Quota Total</span>
            <PieChart className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-extrabold text-white">{kpis.contractedQuotaGb} GB</div>
          <p className="text-[10px] text-zinc-500">Soma dos planos ativos</p>
        </div>

        {/* 3. Vendedores Assinantes */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl space-y-1">
          <div className="text-zinc-400 text-[11px] font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Assinantes</span>
            <Users className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-extrabold text-white">{kpis.subscribersCount}</div>
          <p className="text-[10px] text-zinc-500">Vendedores com plano ativo</p>
        </div>

        {/* 4. Receita Mensal */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl space-y-1">
          <div className="text-zinc-400 text-[11px] font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>MRR Vídeos</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-extrabold text-emerald-400">{formatMoney(kpis.mrrTotal)}</div>
          <p className="text-[10px] text-zinc-500">Receita recorrente mensal</p>
        </div>

        {/* 5. Total de Vídeos */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl space-y-1">
          <div className="text-zinc-400 text-[11px] font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Total Vídeos</span>
            <Film className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-extrabold text-white">{kpis.totalVideos}</div>
          <p className="text-[10px] text-zinc-500">Cadastrados no sistema</p>
        </div>

        {/* 6. Vídeos Prontos */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl space-y-1">
          <div className="text-zinc-400 text-[11px] font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Prontos</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-extrabold text-emerald-400">{kpis.readyVideos}</div>
          <p className="text-[10px] text-zinc-500">Prontos para exibição</p>
        </div>

        {/* 7. Processando */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl space-y-1">
          <div className="text-zinc-400 text-[11px] font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Processando</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-extrabold text-amber-400">{kpis.processingVideos}</div>
          <p className="text-[10px] text-zinc-500">Encoding / TUS Upload</p>
        </div>

        {/* 8. Vídeos Falhos */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl space-y-1">
          <div className="text-zinc-400 text-[11px] font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Falhas</span>
            <XCircle className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div className="text-xl font-extrabold text-red-400">{kpis.failedVideos}</div>
          <p className="text-[10px] text-zinc-500">Erros de upload/Bunny</p>
        </div>
      </div>

      {/* Alerts Section (if any) */}
      {alerts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Alertas de Armazenamento e Assinaturas ({alerts.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {alerts.map((al: any, idx: number) => (
              <div
                key={idx}
                className="bg-zinc-950/80 border border-amber-500/20 rounded-xl p-3 text-xs text-zinc-300 flex items-center justify-between gap-2"
              >
                <span>{al.message}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 flex-shrink-0">
                  {al.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Storage & Revenue Charts / Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Storage Summary */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-violet-400" />
              Relatório de Armazenamento
            </h2>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
              {storageReport.percentUsed}% Utilizado
            </span>
          </div>

          <div className="space-y-3">
            <div className="w-full h-4 bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-700">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  storageReport.percentUsed >= 90
                    ? "bg-red-500"
                    : storageReport.percentUsed >= 75
                    ? "bg-amber-500"
                    : "bg-gradient-to-r from-violet-500 to-emerald-500"
                }`}
                style={{ width: `${Math.min(100, storageReport.percentUsed)}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2 text-center">
              <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800">
                <span className="text-zinc-500 text-[11px] block uppercase">Utilizado</span>
                <span className="text-base font-bold text-white">{storageReport.totalUsedGb} GB</span>
              </div>
              <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800">
                <span className="text-zinc-500 text-[11px] block uppercase">Quota Contratada</span>
                <span className="text-base font-bold text-white">{storageReport.contractedQuotaGb} GB</span>
              </div>
              <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800">
                <span className="text-zinc-500 text-[11px] block uppercase">Disponível</span>
                <span className="text-base font-bold text-emerald-400">{storageReport.availableGb} GB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue & Subscription Breakdown */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Assinaturas & Receita por Plano
            </h2>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Ticket Médio: {formatMoney(revenue.averageTicket)}
            </span>
          </div>

          <div className="space-y-3">
            {revenue.planDistribution && revenue.planDistribution.length > 0 ? (
              revenue.planDistribution.map((item: any) => (
                <div
                  key={item.planId}
                  className="flex items-center justify-between p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-white block text-sm">{item.planName}</span>
                    <span className="text-zinc-400 text-[11px]">
                      Quota: {item.storageQuotaGb === -1 ? "Ilimitado" : `${item.storageQuotaGb} GB`}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-emerald-400 block text-sm">
                      {formatMoney(item.revenue)}
                    </span>
                    <span className="text-zinc-400 text-[11px]">{item.subscribersCount} assinante(s)</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-500 text-center py-4">Nenhum plano cadastrado.</p>
            )}
          </div>
        </div>
      </div>

      {/* Usage by Seller Table */}
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-400" />
              Uso de Armazenamento por Vendedor
            </h2>
            <p className="text-xs text-zinc-400">Ordenado por maior percentual de utilização primeiro.</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar vendedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 w-48"
              />
            </div>

            <select
              value={usageFilter}
              onChange={(e) => setUsageFilter(e.target.value)}
              className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-violet-500"
            >
              <option value="ALL">Todas as faixas</option>
              <option value="HIGH font-bold">≥ 80% utilização</option>
              <option value="CRITICAL font-bold">≥ 90% utilização</option>
              <option value="EXCEEDED">≥ 100% (Excedido)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-violet-500"
            >
              <option value="ALL">Todos os status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING">PENDING</option>
              <option value="PAST_DUE">PAST_DUE</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider text-[10px] font-semibold border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Vendedor</th>
                <th className="py-3 px-4">Plano Biblioteca</th>
                <th className="py-3 px-4">Vídeos</th>
                <th className="py-3 px-4">Uso GB</th>
                <th className="py-3 px-4">Quota GB</th>
                <th className="py-3 px-4">Percentual</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredSellers.length > 0 ? (
                filteredSellers.map((s: any) => (
                  <tr key={s.sellerId} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-white">
                      <div>{s.sellerName}</div>
                      <div className="text-[11px] text-zinc-500">{s.sellerEmail}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20 font-medium">
                        {s.planName}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-zinc-200">{s.videoCount} vídeos</td>
                    <td className="py-3.5 px-4 text-white font-bold">{s.usedGb} GB</td>
                    <td className="py-3.5 px-4 text-zinc-400">
                      {s.quotaGb === -1 ? "Ilimitado" : `${s.quotaGb} GB`}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              s.percent >= 100
                                ? "bg-red-500"
                                : s.percent >= 80
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(100, s.percent)}%` }}
                          />
                        </div>
                        <span
                          className={`font-bold ${
                            s.percent >= 90 ? "text-red-400" : s.percent >= 80 ? "text-amber-400" : "text-zinc-300"
                          }`}
                        >
                          {s.percent}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`px-2.5 py-1 rounded-full font-semibold text-[10px] ${
                          s.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : s.status === "PENDING"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    Nenhum vendedor encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
