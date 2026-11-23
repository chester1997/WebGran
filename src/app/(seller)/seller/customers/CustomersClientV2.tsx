"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Ban, Check, Copy, ExternalLink, Loader2, Send, ShieldCheck, Users, X } from "lucide-react";
import SellerPageHeader from "@/components/layout/SellerPageHeader";
import { HeaderMeta } from "@/components/layout/HeaderMeta";
import { BUSINESS_TIMEZONE } from "@/lib/analytics/timezone-utils";
import { Avatar, EmptyState, LoadMore, Pill, SearchField, Segmented, StatStrip, V2_CARD, brl } from "../_v2/list-ui";
import { blockCustomerAction, unblockCustomerAction } from "./actions";

interface CustomerItem {
  id: string;
  telegramUserId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  languageCode: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  newThisMonth: number;
  withUsername: number;
}

export type PurchaseInfo = { paidCount: number; paidTotal: number; lastPaidAt: string | null };
export type BlockInfo = { reason: string | null; blockedAt: string };

type Filter = "all" | "buyers" | "username" | "blocked";
type Sort = "recent" | "spent";
const PAGE = 40;
const NO_PURCHASE: PurchaseInfo = { paidCount: 0, paidTotal: 0, lastPaidAt: null };
const NO_PURCHASES: Record<string, PurchaseInfo> = {};
const NO_BLOCKS: Record<string, BlockInfo> = {};

export function customerDisplayName(c: Pick<CustomerItem, "firstName" | "lastName">) {
  return `${c.firstName || ""} ${c.lastName || ""}`.trim() || "Usuário do Telegram";
}

/** "pt-br" → "PT-BR"; vazio → "PT-BR" (mesmo padrão da versão clássica). */
export function languageLabel(code: string | null) {
  return (code || "pt-br").toUpperCase();
}

/** "1 compra · R$ 5,00", "3 compras · R$ 45,00" ou "Ainda não comprou". */
export function purchaseSummary(p: PurchaseInfo) {
  if (!p.paidCount) return "Ainda não comprou";
  return `${p.paidCount} ${p.paidCount === 1 ? "compra" : "compras"} · ${brl(p.paidTotal)}`;
}

const fmtDate = (iso: string, month: "short" | "long" = "short") =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month, year: "numeric", timeZone: BUSINESS_TIMEZONE });

export default function CustomersClientV2({
  customers,
  stats,
  purchases = NO_PURCHASES,
  blocked: initialBlocked = NO_BLOCKS,
  blockingAvailable = true,
}: {
  customers: CustomerItem[];
  stats: Stats;
  purchases?: Record<string, PurchaseInfo>;
  blocked?: Record<string, BlockInfo>;
  blockingAvailable?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [limit, setLimit] = useState(PAGE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<Record<string, BlockInfo>>(initialBlocked);

  useEffect(() => setBlocked(initialBlocked), [initialBlocked]);

  const purchaseOf = (c: CustomerItem) => purchases[c.id] || NO_PURCHASE;

  const summary = useMemo(() => {
    let buyers = 0;
    let revenue = 0;
    for (const c of customers) {
      const p = purchases[c.id];
      if (p?.paidCount) {
        buyers++;
        revenue += p.paidTotal;
      }
    }
    const blockedCount = customers.filter((c) => blocked[c.telegramUserId]).length;
    return { buyers, revenue, blockedCount };
  }, [customers, purchases, blocked]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = customers.filter((c) => {
      if (filter === "buyers" && !(purchases[c.id]?.paidCount > 0)) return false;
      if (filter === "username" && !c.username) return false;
      if (filter === "blocked" && !blocked[c.telegramUserId]) return false;
      if (!q) return true;
      return (
        customerDisplayName(c).toLowerCase().includes(q) ||
        (c.username || "").toLowerCase().includes(q) ||
        (c.telegramUserId || "").toLowerCase().includes(q)
      );
    });
    if (sort === "spent") {
      list.sort((a, b) => (purchases[b.id]?.paidTotal || 0) - (purchases[a.id]?.paidTotal || 0));
    }
    return list;
  }, [customers, purchases, blocked, query, filter, sort]);

  const visible = filtered.slice(0, limit);
  const selected = selectedId ? customers.find((c) => c.id === selectedId) || null : null;

  const changeFilter = (f: Filter) => {
    setFilter(f);
    setLimit(PAGE);
  };

  return (
    <div className="space-y-5 w-full max-w-full pb-10">
      <SellerPageHeader
        title="Clientes"
        badge={
          <HeaderMeta value={stats.total} label={stats.total === 1 ? "cliente" : "clientes"} />
        }
        subtitle="Quem abriu o seu Mini App, quem comprou e quem está bloqueado."
      />

      <StatStrip
        items={[
          { label: "Total de clientes", value: stats.total, hint: `${stats.newThisMonth} novos este mês` },
          {
            label: "Compradores",
            value: summary.buyers,
            hint: `${brl(summary.revenue)} em compras`,
            tone: "green",
            onClick: () => changeFilter("buyers"),
            active: filter === "buyers",
          },
          {
            label: "Com @username",
            value: stats.withUsername,
            hint: "Dá para chamar no Telegram",
            tone: "blue",
            onClick: () => changeFilter("username"),
            active: filter === "username",
          },
          {
            label: "Bloqueados",
            value: summary.blockedCount,
            hint: summary.blockedCount ? "Sem acesso ao bot" : "Nenhum bloqueio",
            tone: summary.blockedCount ? "red" : "default",
            onClick: () => changeFilter("blocked"),
            active: filter === "blocked",
          },
        ]}
      />

      <div className={`${V2_CARD} overflow-hidden`}>
        <div className="px-4 sm:px-5 py-3.5 flex flex-col gap-3 border-b border-white/[0.07]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <SearchField id="customers_search_v2" value={query} onChange={(v) => { setQuery(v); setLimit(PAGE); }} placeholder="Buscar por nome, @username ou ID" />
            <Segmented<Sort>
              value={sort}
              onChange={setSort}
              options={[
                { value: "recent", label: "Mais recentes" },
                { value: "spent", label: "Quem mais comprou" },
              ]}
            />
          </div>
          <Segmented<Filter>
            value={filter}
            onChange={changeFilter}
            options={[
              { value: "all", label: "Todos", count: stats.total },
              { value: "buyers", label: "Compradores", count: summary.buyers },
              { value: "username", label: "Com @", count: stats.withUsername },
              { value: "blocked", label: "Bloqueados", count: summary.blockedCount },
            ]}
          />
        </div>

        <div className="hidden lg:grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.5fr)_minmax(0,1fr)_88px] gap-4 px-5 py-2.5 text-[12px] font-medium text-zinc-500 border-b border-white/[0.07] bg-white/[0.01]">
          <span>Cliente</span>
          <span>Telegram</span>
          <span>Compras</span>
          <span>Cadastro</span>
          <span />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={<Users className="w-5 h-5" />}
            title="Nenhum cliente encontrado"
            description={query || filter !== "all" ? "Tente outra busca ou outro filtro." : "Quando alguém abrir seu Mini App no Telegram, aparece aqui."}
          />
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {visible.map((c) => {
              const name = customerDisplayName(c);
              const p = purchaseOf(c);
              const isBlocked = Boolean(blocked[c.telegramUserId]);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`group w-full text-left px-4 sm:px-5 py-3 hover:bg-white/[0.02] transition-colors ${isBlocked ? "bg-red-500/[0.03]" : ""}`}
                  >
                    {/* Desktop */}
                    <div className="hidden lg:grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.5fr)_minmax(0,1fr)_88px] gap-4 items-center">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={isBlocked ? "opacity-50 grayscale" : ""}>
                          <Avatar src={c.photoUrl} name={name} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-semibold text-white truncate">{name}</p>
                          {isBlocked && <Pill tone="red">Bloqueado</Pill>}
                        </div>
                      </div>
                      <span className="min-w-0 truncate text-[13px]">
                        {c.username ? <span className="text-[#60a5fa] font-medium">@{c.username}</span> : <span className="text-zinc-600 font-mono text-[12px]">ID {c.telegramUserId}</span>}
                      </span>
                      <span className={`text-[13px] tabular-nums truncate ${p.paidCount ? "text-zinc-200 font-medium" : "text-zinc-600"}`}>
                        {purchaseSummary(p)}
                      </span>
                      <span className="text-[12.5px] text-zinc-500 tabular-nums">{fmtDate(c.createdAt)}</span>
                      <span className="justify-self-end text-[12.5px] font-semibold text-zinc-400 group-hover:text-white">Gerenciar</span>
                    </div>

                    {/* Mobile */}
                    <div className="lg:hidden flex items-center gap-3">
                      <span className={isBlocked ? "opacity-50 grayscale" : ""}>
                        <Avatar src={c.photoUrl} name={name} size={40} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-[13.5px] font-semibold text-white truncate">{name}</p>
                          {isBlocked && <Pill tone="red">Bloqueado</Pill>}
                        </div>
                        <p className={`text-[12.5px] truncate tabular-nums ${p.paidCount ? "text-zinc-300" : "text-zinc-600"}`}>{purchaseSummary(p)}</p>
                      </div>
                      <span className="text-[12px] text-zinc-500 tabular-nums shrink-0">{fmtDate(c.createdAt)}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <LoadMore shown={visible.length} total={filtered.length} onMore={() => setLimit((l) => l + PAGE)} />
      </div>

      {selected && (
        <CustomerSheet
          customer={selected}
          purchase={purchaseOf(selected)}
          block={blocked[selected.telegramUserId] || null}
          blockingAvailable={blockingAvailable}
          onBlocked={(info) => setBlocked((prev) => ({ ...prev, [selected.telegramUserId]: info }))}
          onUnblocked={() =>
            setBlocked((prev) => {
              const next = { ...prev };
              delete next[selected.telegramUserId];
              return next;
            })
          }
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function CustomerSheet({
  customer,
  purchase,
  block,
  blockingAvailable,
  onBlocked,
  onUnblocked,
  onClose,
}: {
  customer: CustomerItem;
  purchase: PurchaseInfo;
  block: BlockInfo | null;
  blockingAvailable: boolean;
  onBlocked: (info: BlockInfo) => void;
  onUnblocked: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const name = customerDisplayName(customer);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  const copyId = () => {
    navigator.clipboard?.writeText(customer.telegramUserId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const doBlock = () => {
    setError(null);
    startTransition(async () => {
      const res = await blockCustomerAction(customer.telegramUserId, reason);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onBlocked({ reason: reason.trim() || null, blockedAt: new Date().toISOString() });
      setConfirming(false);
      setReason("");
      router.refresh();
    });
  };

  const doUnblock = () => {
    setError(null);
    startTransition(async () => {
      const res = await unblockCustomerAction(customer.telegramUserId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onUnblocked();
      router.refresh();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => !pending && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Gerenciar ${name}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-[#141519] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150"
      >
        <div className="relative flex flex-col items-center text-center px-6 pt-7 pb-5 border-b border-white/[0.07]">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06]"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
          <div className={`rounded-full p-[3px] ${block ? "bg-red-500/60" : "bg-gradient-to-br from-[#3984FF] via-[#1d4ed8] to-[#0b1220]"}`}>
            <div className={`rounded-full bg-[#0d0e12] ${block ? "grayscale opacity-70" : ""}`}>
              <Avatar src={customer.photoUrl} name={name} size={76} />
            </div>
          </div>
          <p className="mt-3 text-[17px] font-semibold text-white">{name}</p>
          <p className="text-[13px] text-zinc-500">{customer.username ? `@${customer.username}` : "Sem @username público"}</p>
          {block && (
            <div className="mt-2">
              <Pill tone="red">Bloqueado</Pill>
            </div>
          )}
        </div>

        {/* Compras */}
        <div className="grid grid-cols-3 border-b border-white/[0.07]">
          <div className="px-4 py-3.5 text-center">
            <p className="text-[12px] text-zinc-500">Compras</p>
            <p className="text-[17px] font-semibold text-white tabular-nums">{purchase.paidCount}</p>
          </div>
          <div className="px-4 py-3.5 text-center border-x border-white/[0.07]">
            <p className="text-[12px] text-zinc-500">Total gasto</p>
            <p className={`text-[17px] font-semibold tabular-nums ${purchase.paidTotal ? "text-emerald-400" : "text-white"}`}>{brl(purchase.paidTotal)}</p>
          </div>
          <div className="px-4 py-3.5 text-center">
            <p className="text-[12px] text-zinc-500">Última compra</p>
            <p className="text-[13.5px] font-semibold text-white mt-0.5">{purchase.lastPaidAt ? fmtDate(purchase.lastPaidAt) : "—"}</p>
          </div>
        </div>

        <div className="px-6 divide-y divide-white/[0.07]">
          <div className="py-3.5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[12.5px] text-zinc-500">ID do Telegram</p>
              <p className="text-[14px] font-mono text-white">{customer.telegramUserId}</p>
            </div>
            <button type="button" onClick={copyId} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-zinc-300 hover:text-white">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-500" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="py-3.5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[12.5px] text-zinc-500">Cliente desde</p>
              <p className="text-[14px] font-semibold text-white">{fmtDate(customer.createdAt, "long")}</p>
            </div>
            <div className="text-right">
              <p className="text-[12.5px] text-zinc-500">Idioma</p>
              <p className="text-[14px] font-semibold text-white">{languageLabel(customer.languageCode)}</p>
            </div>
          </div>
        </div>

        {/* Bloqueio */}
        <div className="px-6 py-4 border-t border-white/[0.07] space-y-3">
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 text-red-300 px-3 py-2.5 rounded-lg text-[12.5px] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}

          {block ? (
            <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] p-3.5 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <Ban className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-white">Bloqueado desde {fmtDate(block.blockedAt)}</p>
                  <p className="text-[12.5px] text-zinc-400">
                    {block.reason ? `Motivo: ${block.reason}` : "Não usa o bot, não abre o Mini App e não consegue comprar."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={doUnblock}
                disabled={pending}
                className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Desbloquear cliente
              </button>
            </div>
          ) : confirming ? (
            <div className="rounded-xl border border-red-500/25 bg-red-500/[0.05] p-3.5 space-y-3">
              <div>
                <p className="text-[13.5px] font-semibold text-white">Bloquear {name}?</p>
                <ul className="mt-1.5 text-[12.5px] text-zinc-400 space-y-0.5 list-disc pl-4">
                  <li>Não consegue usar o bot (o /start avisa que foi bloqueado).</li>
                  <li>Não abre o Mini App e não consegue gerar Pix.</li>
                  <li>O que já foi entregue continua com ele.</li>
                </ul>
              </div>
              <label className="block">
                <span className="text-[12px] text-zinc-500">Motivo (opcional, só você vê)</span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={300}
                  placeholder="Ex.: chargeback, golpe, divulgou o conteúdo"
                  className="mt-1 w-full bg-[#0d0e12] border border-white/10 focus:border-red-400/60 rounded-lg px-3 py-2 text-[13px] text-white outline-none placeholder:text-zinc-600"
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={doBlock}
                  disabled={pending}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[13px] font-semibold disabled:opacity-60"
                >
                  {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                  Bloquear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    setError(null);
                  }}
                  disabled={pending}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-zinc-300 hover:bg-white/[0.05]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {customer.username ? (
                <a
                  href={`https://t.me/${customer.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#3984FF] hover:bg-[#2f74e6] text-white text-[13px] font-semibold transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Abrir no Telegram
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              ) : (
                <span className="flex-1 text-[12px] text-zinc-500">Sem @username: não dá para abrir a conversa direto.</span>
              )}
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={!blockingAvailable}
                title={blockingAvailable ? undefined : "Rode a migration 0023_customer_blocks.sql no Neon para ativar"}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Ban className="w-4 h-4" />
                Bloquear
              </button>
            </div>
          )}

          {!blockingAvailable && !block && (
            <p className="text-[11.5px] text-amber-400/90">O bloqueio fica disponível assim que a tabela de bloqueios for criada no banco.</p>
          )}
        </div>
      </div>
    </div>
  );
}
