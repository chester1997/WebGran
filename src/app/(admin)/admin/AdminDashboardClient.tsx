"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Building2, 
  Users, 
  Bot, 
  Package, 
  ShoppingCart, 
  DollarSign, 
  UserCheck, 
  CreditCard,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Store,
  ArrowUpRight,
  Sparkles
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

type PeriodType = "today" | "7d" | "30d" | "12m";

interface MetricItem {
  total: number;
  current: number;
  changePercent: number | null;
}

interface DashboardData {
  period: string;
  updatedAt: string;
  metrics: {
    activeStores: MetricItem;
    sellers: MetricItem;
    connectedBots: MetricItem;
    products: MetricItem;
    paidOrders: MetricItem;
    revenue: MetricItem;
    telegramCustomers: MetricItem;
    activeSubscriptions: MetricItem;
  };
  revenueTimeSeries: Array<{ date: string; revenue: number }>;
  ordersTimeSeries: Array<{ date: string; count: number }>;
  growthTimeSeries: Array<{ date: string; sellers: number; stores: number }>;
  orderStatusDistribution: Array<{ status: string; name: string; count: number; percentage: number; color: string }>;
  topProducts: Array<{ id: string; name: string; quantity: number; revenue: number }>;
  recentSales: Array<{ id: string; customer: string; product: string; seller: string; store: string; amount: number; status: string; date: string }>;
  recentStores: Array<{ id: string; name: string; owner: string; logoUrl: string | null; botName: string | null; productCount: number; status: string; createdAt: string }>;
  recentActivity: Array<{ id: string; title: string; description: string; type: string; timestamp: string; timeAgo: string }>;
}

export default function AdminDashboardClient() {
  const [period, setPeriod] = useState<PeriodType>("30d");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchDashboardStats = useCallback(async (selectedPeriod: PeriodType, isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch(`/api/admin/dashboard-stats?period=${selectedPeriod}`);
      if (!res.ok) throw new Error("Falha ao carregar dados do dashboard");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Dashboard Stats Fetch Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats(period);
  }, [period, fetchDashboardStats]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Dashboard Administrativo</h1>
            <span className="px-2.5 py-1 text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              SaaS Live
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Visão geral em tempo real da plataforma WebGran
          </p>
        </div>

        {/* PERIOD SELECTOR & REFRESH */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-[#18181B] p-1 rounded-xl border border-[#27272A]">
            {(
              [
                { id: "today", label: "Hoje" },
                { id: "7d", label: "7 dias" },
                { id: "30d", label: "30 dias" },
                { id: "12m", label: "12 meses" }
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setPeriod(item.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  period === item.id
                    ? "bg-red-600 text-white shadow-md shadow-red-900/30"
                    : "text-gray-400 hover:text-white hover:bg-[#27272A]/50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchDashboardStats(period, true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-gray-300 hover:text-white rounded-xl text-xs font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-red-500" : ""}`} />
            <span>Atualizar</span>
          </button>
          
          {data?.updatedAt && (
            <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1.5 ml-1">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              Atualizado às {data.updatedAt}
            </span>
          )}
        </div>
      </div>

      {/* KPI CARDS SECTION */}
      {loading && !data ? (
        <KPISkeletonGrid />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Lojas Ativas"
            value={data?.metrics.activeStores.total.toString() || "0"}
            changePercent={data?.metrics.activeStores.changePercent}
            icon={Building2}
            accentColor="purple"
            description="Lojas ativas na plataforma"
          />
          <KPICard
            title="Vendedores"
            value={data?.metrics.sellers.total.toString() || "0"}
            changePercent={data?.metrics.sellers.changePercent}
            icon={Users}
            accentColor="blue"
            description="Lojistas cadastrados"
          />
          <KPICard
            title="Bots Conectados"
            value={data?.metrics.connectedBots.total.toString() || "0"}
            changePercent={data?.metrics.connectedBots.changePercent}
            icon={Bot}
            accentColor="teal"
            description="Bots do Telegram ativos"
          />
          <KPICard
            title="Produtos Cadastrados"
            value={data?.metrics.products.total.toString() || "0"}
            changePercent={data?.metrics.products.changePercent}
            icon={Package}
            accentColor="indigo"
            description="Catálogo geral de produtos"
          />
          <KPICard
            title="Pedidos Pagos"
            value={data?.metrics.paidOrders.total.toString() || "0"}
            changePercent={data?.metrics.paidOrders.changePercent}
            icon={ShoppingCart}
            accentColor="orange"
            description="Vendas concluídas com sucesso"
          />
          <KPICard
            title="Faturamento Total"
            value={formatCurrency(data?.metrics.revenue.total || 0)}
            changePercent={data?.metrics.revenue.changePercent}
            icon={DollarSign}
            accentColor="green"
            description="Volume total processado"
          />
          <KPICard
            title="Clientes Telegram"
            value={data?.metrics.telegramCustomers.total.toString() || "0"}
            changePercent={data?.metrics.telegramCustomers.changePercent}
            icon={UserCheck}
            accentColor="sky"
            description="Consumidores ativos nos bots"
          />
          <KPICard
            title="Assinaturas Ativas"
            value={data?.metrics.activeSubscriptions.total.toString() || "0"}
            changePercent={data?.metrics.activeSubscriptions.changePercent}
            icon={CreditCard}
            accentColor="emerald"
            description="Vendedores no plano SaaS"
          />
        </div>
      )}

      {/* CHARTS SECTION 1: FATURAMENTO & PEDIDOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Faturamento (2/3 width) */}
        <div className="lg:col-span-2 bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Faturamento
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Evolução do faturamento no período selecionado
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#18181B] border border-[#27272A] text-emerald-400">
              R$ {formatCurrency(data?.metrics.revenue.current || 0)} no período
            </span>
          </div>

          <div className="h-72 w-full">
            {loading ? (
              <ChartSkeleton />
            ) : data?.revenueTimeSeries && data.revenueTimeSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.revenueTimeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                  <XAxis dataKey="date" stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#18181B", borderColor: "#27272A", borderRadius: "12px", color: "#FFF" }}
                    formatter={(val: any) => [formatCurrency(Number(val || 0)), "Faturamento"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#revenueGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState message="Sem dados de faturamento para o período" />
            )}
          </div>
        </div>

        {/* Gráfico de Pedidos (1/3 width) */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                Pedidos
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Quantidade de pedidos por dia
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#18181B] border border-[#27272A] text-orange-400">
              {data?.metrics.paidOrders.current || 0} pedidos
            </span>
          </div>

          <div className="h-72 w-full">
            {loading ? (
              <ChartSkeleton />
            ) : data?.ordersTimeSeries && data.ordersTimeSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.ordersTimeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                  <XAxis dataKey="date" stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#18181B", borderColor: "#27272A", borderRadius: "12px", color: "#FFF" }}
                    formatter={(val: any) => [`${val || 0} pedidos`, "Quantidade"]}
                  />
                  <Bar dataKey="count" fill="#F97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState message="Sem pedidos no período" />
            )}
          </div>
        </div>
      </div>

      {/* CHARTS SECTION 2: CRESCIMENTO DA PLATAFORMA & STATUS DOS PEDIDOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Crescimento da Plataforma (2/3 width) */}
        <div className="lg:col-span-2 bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                Crescimento da Plataforma
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Evolução temporal de novos vendedores e novas lojas
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            {loading ? (
              <ChartSkeleton />
            ) : data?.growthTimeSeries && data.growthTimeSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.growthTimeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                  <XAxis dataKey="date" stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#18181B", borderColor: "#27272A", borderRadius: "12px", color: "#FFF" }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
                  <Line type="monotone" dataKey="sellers" name="Novos Vendedores" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="stores" name="Novas Lojas" stroke="#A855F7" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState message="Sem novos cadastros no período" />
            )}
          </div>
        </div>

        {/* Status dos Pedidos (Donut Chart 1/3 width) */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              Status dos Pedidos
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Distribuição total de vendas por status
            </p>
          </div>

          <div className="h-56 w-full my-4 flex items-center justify-center">
            {loading ? (
              <ChartSkeleton />
            ) : data?.orderStatusDistribution && data.orderStatusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.orderStatusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="count"
                  >
                    {data.orderStatusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#141416" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#18181B", borderColor: "#27272A", borderRadius: "12px", color: "#FFF" }}
                    formatter={(val: any, name: any) => [`${val || 0} pedidos`, String(name || "Status")]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState message="Nenhum pedido registrado" />
            )}
          </div>

          {/* Legenda de Status */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#27272A]">
            {data?.orderStatusDistribution.map((st) => (
              <div key={st.status} className="flex items-center justify-between p-2 rounded-lg bg-[#18181B] border border-[#27272A]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: st.color }} />
                  <span className="text-xs text-gray-300 font-medium">{st.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-white block">{st.count}</span>
                  <span className="text-[10px] text-gray-400">{st.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 3: PRODUTOS MAIS VENDIDOS */}
      <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-400" />
              Produtos Mais Vendidos
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Top produtos com base em vendas acumuladas
            </p>
          </div>
        </div>

        {loading ? (
          <ListSkeleton />
        ) : data?.topProducts && data.topProducts.length > 0 ? (
          <div className="space-y-4">
            {data.topProducts.map((prod, idx) => (
              <div key={prod.id || idx} className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-purple-500/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm">
                    #{idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{prod.name}</p>
                    <p className="text-xs text-gray-400">{prod.quantity} unidades vendidas</p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 border-[#27272A] pt-2 sm:pt-0">
                  <div className="text-right">
                    <span className="text-xs text-gray-400 block">Faturamento</span>
                    <span className="text-sm font-black text-emerald-400">{formatCurrency(prod.revenue)}</span>
                  </div>
                  <div className="w-24 bg-[#27272A] h-2 rounded-full overflow-hidden hidden md:block">
                    <div
                      className="bg-purple-500 h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (prod.quantity / (data.topProducts[0]?.quantity || 1)) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyChartState message="Nenhum produto vendido no período" />
        )}
      </div>

      {/* SECTION 4: FEEDS DE DADOS (ÚLTIMAS VENDAS, LOJAS RECENTES, ATIVIDADE) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ÚLTIMAS VENDAS (Tabela 2/3 width) */}
        <div className="lg:col-span-2 bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-orange-400" />
                  Últimas Vendas
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Registros mais recentes de pedidos na plataforma
                </p>
              </div>
            </div>

            {loading ? (
              <ListSkeleton />
            ) : data?.recentSales && data.recentSales.length > 0 ? (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#27272A] text-gray-400 text-xs font-semibold">
                      <th className="pb-3 px-2">Cliente</th>
                      <th className="pb-3 px-2">Loja / Vendedor</th>
                      <th className="pb-3 px-2 text-right">Valor</th>
                      <th className="pb-3 px-2">Status</th>
                      <th className="pb-3 px-2 text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272A]/50 text-xs">
                    {data.recentSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-[#18181B]/60 transition-colors">
                        <td className="py-3 px-2 font-medium text-white max-w-[140px] truncate">
                          {sale.customer}
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-gray-200 font-semibold block">{sale.store}</span>
                          <span className="text-[10px] text-gray-400 block">{sale.seller}</span>
                        </td>
                        <td className="py-3 px-2 text-right font-black text-emerald-400">
                          {formatCurrency(sale.amount)}
                        </td>
                        <td className="py-3 px-2">
                          <StatusBadge status={sale.status} />
                        </td>
                        <td className="py-3 px-2 text-right text-gray-400 font-medium">
                          {sale.date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyChartState message="Nenhuma venda recente para exibir" />
            )}
          </div>
        </div>

        {/* ATIVIDADE RECENTE (Timeline 1/3 width) */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-blue-400" />
              Atividade Recente
            </h2>

            {loading ? (
              <ListSkeleton />
            ) : data?.recentActivity && data.recentActivity.length > 0 ? (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#27272A]">
                {data.recentActivity.map((act) => (
                  <div key={act.id} className="relative flex flex-col gap-1">
                    <span className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-[#18181B] border border-[#27272A] flex items-center justify-center text-xs">
                      {act.type === "seller" ? (
                        <Users className="w-3 h-3 text-blue-400" />
                      ) : act.type === "store" ? (
                        <Store className="w-3 h-3 text-purple-400" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      )}
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{act.title}</span>
                      <span className="text-[10px] text-gray-400">{act.timeAgo}</span>
                    </div>
                    <p className="text-xs text-gray-400">{act.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyChartState message="Nenhuma atividade registrada" />
            )}
          </div>
        </div>
      </div>

      {/* SECTION 5: LOJAS RECENTES */}
      <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-400" />
              Lojas Recentes
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Lojas criadas na plataforma e seus respectivos bots
            </p>
          </div>
          <a
            href="/admin/stores"
            className="text-xs font-semibold text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
          >
            Ver todas
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {loading ? (
          <KPISkeletonGrid />
        ) : data?.recentStores && data.recentStores.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.recentStores.map((st) => (
              <a
                key={st.id}
                href={`/admin/stores`}
                className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-red-500/30 transition-all flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 font-bold text-sm flex-shrink-0">
                    {st.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={st.logoUrl} alt={st.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      st.name[0]?.toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate group-hover:text-red-400 transition-colors">{st.name}</p>
                    <p className="text-xs text-gray-400 truncate">Vendedor: {st.owner}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-teal-400 font-medium">{st.botName || "Sem Bot"}</span>
                      <span className="text-[10px] text-gray-400">• {st.productCount} produtos</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <StatusBadge status={st.status} />
                  <span className="text-[10px] text-gray-400 block mt-1">{st.createdAt}</span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <EmptyChartState message="Nenhuma loja cadastrada recentemente" />
        )}
      </div>
    </div>
  );
}

/* HELPER COMPONENTS & SKELETONS */

function KPICard({
  title,
  value,
  changePercent,
  icon: Icon,
  accentColor,
  description
}: {
  title: string;
  value: string;
  changePercent?: number | null;
  icon: any;
  accentColor: "purple" | "blue" | "teal" | "indigo" | "orange" | "green" | "sky" | "emerald";
  description: string;
}) {
  const colorStyles = {
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    teal: "text-teal-400 bg-teal-500/10 border-teal-500/20",
    indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    orange: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    green: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    sky: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
  };

  const isPositive = changePercent !== null && changePercent !== undefined && changePercent >= 0;

  return (
    <div className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] shadow-lg hover:border-[#3F3F46] transition-all flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-xl border ${colorStyles[accentColor]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="my-3">
        <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{value}</h3>
      </div>

      <div className="flex items-center justify-between text-xs pt-2 border-t border-[#27272A]">
        {changePercent !== null && changePercent !== undefined ? (
          <div className={`flex items-center gap-1 font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
            {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            <span>{isPositive ? `+${changePercent}%` : `${changePercent}%`}</span>
          </div>
        ) : (
          <span className="text-gray-400 font-medium">Dados do período</span>
        )}
        <span className="text-gray-400 text-[10px] truncate max-w-[130px]">{description}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  if (lower === "paid" || lower === "active") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="w-2.5 h-2.5" />
        {lower === "paid" ? "Pago" : "Ativa"}
      </span>
    );
  }
  if (lower === "pending") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <AlertCircle className="w-2.5 h-2.5" />
        Pendente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
      <XCircle className="w-2.5 h-2.5" />
      {lower === "cancelled" ? "Cancelado" : status}
    </span>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 bg-[#18181B]/40 rounded-xl border border-dashed border-[#27272A]">
      <Calendar className="w-8 h-8 text-gray-400 mb-2" />
      <p className="text-xs font-semibold text-gray-400">{message}</p>
    </div>
  );
}

function KPISkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] h-32 flex flex-col justify-between">
          <div className="h-4 bg-[#27272A] rounded w-1/2" />
          <div className="h-8 bg-[#27272A] rounded w-3/4 my-2" />
          <div className="h-3 bg-[#27272A] rounded w-full" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-full w-full bg-[#18181B]/40 rounded-xl animate-pulse flex items-center justify-center border border-[#27272A]">
      <span className="text-xs text-gray-400">Carregando gráfico...</span>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-12 bg-[#18181B] rounded-xl border border-[#27272A]" />
      ))}
    </div>
  );
}
