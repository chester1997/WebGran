"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Copy, Check, RefreshCw, Wallet } from "lucide-react";
import SellerPageHeader from "@/components/layout/SellerPageHeader";
import { formatBusinessDateTime } from "@/lib/analytics/timezone-utils";
import {
  EmptyState,
  LoadMore,
  PaymentPill,
  SearchField,
  Segmented,
  StatStrip,
  V2_CARD,
  brl,
} from "../_v2/list-ui";

interface Metrics {
  totalBruto: number;
  totalTaxa: number;
  totalLiquido: number;
  paidCount: number;
  pendingCount: number;
}

interface Transaction {
  id: string;
  paymentId: string | null;
  paymentMethod: string;
  customerName: string;
  total: number;
  platformFee: number;
  netAmount: number;
  isNetConfirmed?: boolean;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

type Filter = "all" | "paid" | "pending" | "cancelled";
const PAGE = 30;

export function gatewayLabel(method: string) {
  return method === "syncpay" ? "SyncPay" : "Mercado Pago";
}

function matchesFilter(status: string, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "cancelled") return status === "cancelled" || status === "failed";
  return status === filter;
}

export default function FinanceiroClientV2({ metrics, transactions }: { metrics: Metrics; transactions: Transaction[] }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const cancelledCount = useMemo(
    () => transactions.filter((t) => t.status === "cancelled" || t.status === "failed").length,
    [transactions]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return transactions.filter((t) => {
      if (!matchesFilter(t.status, filter)) return false;
      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        t.customerName.toLowerCase().includes(q) ||
        (t.paymentId || "").toLowerCase().includes(q)
      );
    });
  }, [transactions, query, filter]);

  const visible = filtered.slice(0, limit);
  const feePct = metrics.totalBruto > 0 ? (metrics.totalTaxa / metrics.totalBruto) * 100 : 0;

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const changeFilter = (f: Filter) => {
    setFilter(f);
    setLimit(PAGE);
  };

  return (
    <div className="space-y-5 w-full max-w-full pb-10">
      <SellerPageHeader
        portalId="seller-page-header-portal"
        title="Financeiro"
        badge={
          <span className="px-2 py-0.5 rounded-full text-xs font-medium tabular-nums bg-[#3984FF]/10 text-[#60a5fa] border border-[#3984FF]/25">
            {transactions.length} {transactions.length === 1 ? "registro" : "registros"}
          </span>
        }
        subtitle="Quanto você vendeu, quanto ficou com você e o que ainda está pendente."
        actions={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-50 border border-white/[0.08] text-xs font-medium text-zinc-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        }
      />

      <StatStrip
        items={[
          { label: "Líquido para você", value: brl(metrics.totalLiquido), hint: "Já descontada a taxa", tone: "green" },
          { label: "Vendas brutas", value: brl(metrics.totalBruto), hint: `${metrics.paidCount} ${metrics.paidCount === 1 ? "venda paga" : "vendas pagas"}` },
          {
            label: "Taxas da plataforma",
            value: brl(metrics.totalTaxa),
            hint: metrics.totalBruto > 0 ? `${feePct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do bruto` : "Nenhuma taxa ainda",
          },
          {
            label: "Pendentes",
            value: metrics.pendingCount,
            hint: "Pix ainda não pago",
            tone: "amber",
            onClick: () => changeFilter("pending"),
            active: filter === "pending",
          },
        ]}
      />

      <div className={`${V2_CARD} overflow-hidden`}>
        <div className="px-4 sm:px-5 pt-4 pb-3.5 flex flex-col gap-3 border-b border-white/[0.07]">
          <div>
            <h2 className="text-[15px] font-semibold text-white">Transações</h2>
            <p className="text-[12.5px] text-zinc-500">Cada venda com o valor bruto e o que ficou para você.</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <SearchField id="financeiro_search_v2" value={query} onChange={(v) => { setQuery(v); setLimit(PAGE); }} placeholder="Buscar por pedido, cliente ou TX" />
            <Segmented<Filter>
              value={filter}
              onChange={changeFilter}
              options={[
                { value: "all", label: "Todas", count: transactions.length },
                { value: "paid", label: "Pagas", count: metrics.paidCount },
                { value: "pending", label: "Pendentes", count: metrics.pendingCount },
                { value: "cancelled", label: "Canceladas", count: cancelledCount },
              ]}
            />
          </div>
        </div>

        <div className="hidden lg:grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] gap-4 px-5 py-2.5 text-[12px] font-medium text-zinc-500 border-b border-white/[0.07] bg-white/[0.01]">
          <span>Pedido</span>
          <span>Cliente</span>
          <span>Data</span>
          <span className="text-right">Bruto</span>
          <span className="text-right">Líquido</span>
          <span className="text-right">Status</span>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={<Wallet className="w-5 h-5" />}
            title="Nenhuma transação encontrada"
            description={query || filter !== "all" ? "Tente outra busca ou outro filtro." : "Suas vendas aparecem aqui assim que alguém pagar."}
            action={
              <Link href="/seller/store" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#60a5fa] hover:text-[#93c5fd]">
                Ver link do bot <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {visible.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </ul>
        )}

        <LoadMore shown={visible.length} total={filtered.length} onMore={() => setLimit((l) => l + PAGE)} />
      </div>
    </div>
  );
}

function NetValue({ tx }: { tx: Transaction }) {
  const counts = tx.status === "paid";
  return (
    <div className="text-right">
      <p className={`text-[14px] font-semibold tabular-nums ${counts ? "text-emerald-400" : "text-zinc-500"}`}>{brl(tx.netAmount)}</p>
      {counts && (
        <p className={`text-[11.5px] ${tx.isNetConfirmed ? "text-zinc-500" : "text-amber-400/90"}`}>
          {tx.isNetConfirmed ? "Confirmado" : "Estimado"}
        </p>
      )}
    </div>
  );
}

function TxId({ tx }: { tx: Transaction }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!tx.paymentId) return;
    navigator.clipboard?.writeText(tx.paymentId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-mono text-zinc-200">#{tx.id.slice(0, 8)}</p>
      <p className="text-[12px] text-zinc-500 flex items-center gap-1.5 min-w-0">
        <span className="shrink-0">{gatewayLabel(tx.paymentMethod)}</span>
        {tx.paymentId && (
          <button
            type="button"
            onClick={copy}
            title={`Copiar TX ${tx.paymentId}`}
            className="inline-flex items-center gap-1 text-zinc-600 hover:text-zinc-300 transition-colors min-w-0"
          >
            <span className="font-mono truncate">· {tx.paymentId.slice(0, 8)}…</span>
            {copied ? <Check className="w-3 h-3 text-emerald-400 shrink-0" /> : <Copy className="w-3 h-3 shrink-0" />}
          </button>
        )}
      </p>
    </div>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const date = formatBusinessDateTime(tx.createdAt);
  return (
    <li className="px-4 sm:px-5 py-3.5 hover:bg-white/[0.015] transition-colors">
      <div className="hidden lg:grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] gap-4 items-center">
        <TxId tx={tx} />
        <p className="text-[13.5px] font-medium text-zinc-100 truncate">{tx.customerName}</p>
        <time dateTime={tx.createdAt} className="text-[12.5px] text-zinc-500 tabular-nums">
          {date}
        </time>
        <p className="text-right text-[13.5px] text-zinc-300 tabular-nums">{brl(tx.total)}</p>
        <NetValue tx={tx} />
        <div className="text-right">
          <PaymentPill status={tx.status} paidLabel="Pago" />
        </div>
      </div>

      <div className="lg:hidden space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-white truncate">{tx.customerName}</p>
            <TxId tx={tx} />
          </div>
          <NetValue tx={tx} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-zinc-500 tabular-nums">
            {date} · bruto {brl(tx.total)}
          </span>
          <PaymentPill status={tx.status} paidLabel="Pago" />
        </div>
      </div>
    </li>
  );
}
