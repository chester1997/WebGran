"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, ShoppingCart } from "lucide-react";
import SellerPageHeader from "@/components/layout/SellerPageHeader";
import { formatBusinessDateTime } from "@/lib/analytics/timezone-utils";
import { RetryDeliveryButton } from "./RetryDeliveryButton";
import { buildOrdersCSV, type SerializedOrder } from "./OrdersClient";
import {
  Avatar,
  EmptyState,
  LoadMore,
  PaymentPill,
  Pill,
  SearchField,
  Segmented,
  StatStrip,
  V2_CARD,
  brl,
} from "../_v2/list-ui";

type Filter = "all" | "paid" | "pending" | "cancelled";
type Access = SerializedOrder["accesses"][number];

const PAGE = 30;

export type DeliveryState = "none" | "delivered" | "processing" | "failed";

/** Mesmas regras da versão clássica para o estado da entrega. */
export function getDeliveryState(access?: Access | null): DeliveryState {
  if (!access) return "none";
  if (access.deliveryStatus === "DELIVERED" || access.status === "ACTIVE") return "delivered";
  if (
    access.deliveryStatus === "PENDING" ||
    (typeof access.deliveryStatus === "string" && access.deliveryStatus.startsWith("PROCESSING"))
  ) {
    return "processing";
  }
  return "failed";
}

function matchesFilter(status: string, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "cancelled") return status === "cancelled" || status === "failed";
  return status === filter;
}

function customerName(o: SerializedOrder) {
  if (!o.customer) return "Cliente anônimo";
  return `${o.customer.firstName || ""} ${o.customer.lastName || ""}`.trim() || "Cliente";
}

export function OrdersClientV2({ initialOrders = [] }: { initialOrders: SerializedOrder[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE);

  const summary = useMemo(() => {
    let paid = 0;
    let paidTotal = 0;
    let pending = 0;
    let cancelled = 0;
    let failedDeliveries = 0;
    for (const o of initialOrders) {
      if (o.status === "paid") {
        paid++;
        paidTotal += Number(o.total || 0);
      } else if (o.status === "pending") pending++;
      else if (o.status === "cancelled" || o.status === "failed") cancelled++;
      if (getDeliveryState(o.accesses?.[0]) === "failed") failedDeliveries++;
    }
    return { paid, paidTotal, pending, cancelled, failedDeliveries };
  }, [initialOrders]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return initialOrders.filter((o) => {
      if (!matchesFilter(o.status, filter)) return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        customerName(o).toLowerCase().includes(q) ||
        o.accesses?.some((a) => a.product?.title?.toLowerCase().includes(q))
      );
    });
  }, [initialOrders, query, filter]);

  const visible = filtered.slice(0, limit);

  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    const blob = new Blob([buildOrdersCSV(filtered)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `pedidos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const changeFilter = (f: Filter) => {
    setFilter(f);
    setLimit(PAGE);
  };

  return (
    <div className="space-y-5 w-full max-w-full pb-10">
      <SellerPageHeader
        portalId="seller-page-header-portal"
        title="Pedidos"
        badge={
          <span className="px-2 py-0.5 rounded-full text-xs font-medium tabular-nums bg-[#3984FF]/10 text-[#60a5fa] border border-[#3984FF]/25">
            {initialOrders.length} {initialOrders.length === 1 ? "pedido" : "pedidos"}
          </span>
        }
        subtitle="Vendas e pagamentos dos seus bots em tempo real."
        actions={
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed border border-white/[0.08] text-xs font-medium text-zinc-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            Exportar CSV
          </button>
        }
      />

      <StatStrip
        items={[
          { label: "Aprovados", value: summary.paid, hint: brl(summary.paidTotal), tone: "green", onClick: () => changeFilter("paid"), active: filter === "paid" },
          { label: "Pendentes", value: summary.pending, hint: "Aguardando o Pix", tone: "amber", onClick: () => changeFilter("pending"), active: filter === "pending" },
          { label: "Cancelados", value: summary.cancelled, hint: "Expirados ou recusados", onClick: () => changeFilter("cancelled"), active: filter === "cancelled" },
          {
            label: "Entregas com falha",
            value: summary.failedDeliveries,
            hint: summary.failedDeliveries > 0 ? "Reenvie pela lista" : "Tudo entregue",
            tone: summary.failedDeliveries > 0 ? "red" : "default",
          },
        ]}
      />

      <div className={`${V2_CARD} overflow-hidden`}>
        <div className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.07]">
          <SearchField id="orders_search_v2" value={query} onChange={(v) => { setQuery(v); setLimit(PAGE); }} placeholder="Buscar por código, cliente ou produto" />
          <Segmented<Filter>
            value={filter}
            onChange={changeFilter}
            options={[
              { value: "all", label: "Todos", count: initialOrders.length },
              { value: "paid", label: "Aprovados", count: summary.paid },
              { value: "pending", label: "Pendentes", count: summary.pending },
              { value: "cancelled", label: "Cancelados", count: summary.cancelled },
            ]}
          />
        </div>

        {/* Cabeçalho das colunas (desktop) */}
        <div className="hidden lg:grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)] gap-4 px-5 py-2.5 text-[12px] font-medium text-zinc-500 border-b border-white/[0.07] bg-white/[0.01]">
          <span>Cliente e produto</span>
          <span>Pedido</span>
          <span className="text-right">Valor</span>
          <span>Pagamento</span>
          <span>Entrega</span>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart className="w-5 h-5" />}
            title="Nenhum pedido encontrado"
            description={query || filter !== "all" ? "Tente outra busca ou outro filtro." : "Quando alguém comprar pelo seu bot, o pedido aparece aqui."}
            action={
              <Link href="/seller/store" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#60a5fa] hover:text-[#93c5fd]">
                Ver link do bot <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {visible.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </ul>
        )}

        <LoadMore shown={visible.length} total={filtered.length} onMore={() => setLimit((l) => l + PAGE)} />
      </div>
    </div>
  );
}

function OrderRow({ order }: { order: SerializedOrder }) {
  const access = order.accesses?.[0];
  const name = customerName(order);
  const product = access?.product?.title;
  const productLine = product || (order.status === "pending" ? "Aguardando pagamento" : "—");
  const delivery = getDeliveryState(access);
  const date = formatBusinessDateTime(order.createdAt);

  return (
    <li className="px-4 sm:px-5 py-3.5 hover:bg-white/[0.015] transition-colors">
      {/* Desktop */}
      <div className="hidden lg:grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)] gap-4 items-center">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar src={order.customer?.photoUrl} name={name} />
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-white truncate">{name}</p>
            <p className="text-[12.5px] text-zinc-500 truncate" title={product || undefined}>
              {productLine}
            </p>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[12.5px] font-mono text-zinc-300">#{order.id.slice(0, 8)}</p>
          <time dateTime={order.createdAt} className="text-[12.5px] text-zinc-500 tabular-nums">
            {date}
          </time>
        </div>
        <p className="text-right text-[14px] font-semibold text-white tabular-nums">{brl(Number(order.total || 0))}</p>
        <div>
          <PaymentPill status={order.status} />
        </div>
        <DeliveryCell access={access} state={delivery} />
      </div>

      {/* Mobile / tablet */}
      <div className="lg:hidden space-y-2.5">
        <div className="flex items-start gap-3">
          <Avatar src={order.customer?.photoUrl} name={name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13.5px] font-semibold text-white truncate">{name}</p>
              <p className="text-[14px] font-semibold text-white tabular-nums shrink-0">{brl(Number(order.total || 0))}</p>
            </div>
            <p className="text-[12.5px] text-zinc-500 truncate">{productLine}</p>
            <p className="text-[12px] text-zinc-600 tabular-nums">
              #{order.id.slice(0, 8)} · {date}
            </p>
          </div>
        </div>
        <div className="flex items-start justify-between gap-2 pl-[48px]">
          <PaymentPill status={order.status} />
          <DeliveryCell access={access} state={delivery} compact />
        </div>
      </div>
    </li>
  );
}

function DeliveryCell({ access, state, compact }: { access?: Access; state: DeliveryState; compact?: boolean }) {
  if (state === "none") return <span className="text-[12.5px] text-zinc-600">—</span>;
  if (state === "delivered") {
    return (
      <div className="min-w-0">
        <Pill tone="blue">Entregue</Pill>
        {!compact && access?.telegramChatId && (
          <p className="mt-1 text-[11px] text-zinc-600 font-mono truncate" title={access.telegramChatId}>
            Chat {access.telegramChatId}
          </p>
        )}
      </div>
    );
  }
  if (state === "processing") return <Pill tone="amber">Processando</Pill>;
  return (
    <div className={`min-w-0 flex ${compact ? "flex-wrap items-center justify-end gap-2" : "flex-col items-start gap-1"}`}>
      <Pill tone="red">Falhou</Pill>
      {!compact && access?.deliveryError && (
        <p className="text-[11px] text-red-400/80 max-w-full truncate" title={access.deliveryError}>
          {access.deliveryError}
        </p>
      )}
      {access && <RetryDeliveryButton accessId={access.id} />}
    </div>
  );
}
