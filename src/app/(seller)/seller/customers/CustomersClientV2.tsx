"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Send, Users, X } from "lucide-react";
import SellerPageHeader from "@/components/layout/SellerPageHeader";
import { BUSINESS_TIMEZONE } from "@/lib/analytics/timezone-utils";
import { Avatar, EmptyState, LoadMore, SearchField, Segmented, StatStrip, V2_CARD } from "../_v2/list-ui";

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

type Filter = "all" | "username" | "nousername";
const PAGE = 40;

export function customerDisplayName(c: Pick<CustomerItem, "firstName" | "lastName">) {
  return `${c.firstName || ""} ${c.lastName || ""}`.trim() || "Usuário do Telegram";
}

/** "pt-br" → "PT-BR"; vazio → "PT-BR" (mesmo padrão da versão clássica). */
export function languageLabel(code: string | null) {
  return (code || "pt-br").toUpperCase();
}

const fmtDate = (iso: string, month: "short" | "long" = "short") =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month, year: "numeric", timeZone: BUSINESS_TIMEZONE });

export default function CustomersClientV2({ customers, stats }: { customers: CustomerItem[]; stats: Stats }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<CustomerItem | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return customers.filter((c) => {
      if (filter === "username" && !c.username) return false;
      if (filter === "nousername" && c.username) return false;
      if (!q) return true;
      return (
        customerDisplayName(c).toLowerCase().includes(q) ||
        (c.username || "").toLowerCase().includes(q) ||
        (c.telegramUserId || "").toLowerCase().includes(q)
      );
    });
  }, [customers, query, filter]);

  const visible = filtered.slice(0, limit);
  const usernamePct = stats.total > 0 ? Math.round((stats.withUsername / stats.total) * 100) : 0;

  const changeFilter = (f: Filter) => {
    setFilter(f);
    setLimit(PAGE);
  };

  return (
    <div className="space-y-5 w-full max-w-full pb-10">
      <SellerPageHeader
        title="Clientes"
        badge={
          <span className="px-2 py-0.5 rounded-full text-xs font-medium tabular-nums bg-[#3984FF]/10 text-[#60a5fa] border border-[#3984FF]/25">
            {stats.total} {stats.total === 1 ? "cliente" : "clientes"}
          </span>
        }
        subtitle="Quem já abriu o seu Mini App no Telegram."
      />

      <StatStrip
        items={[
          { label: "Total de clientes", value: stats.total, hint: "Cadastrados no Mini App" },
          { label: "Novos este mês", value: stats.newThisMonth, hint: "Desde o dia 1º", tone: "green" },
          {
            label: "Com @username",
            value: stats.withUsername,
            hint: `${usernamePct}% da base · dá para chamar no Telegram`,
            tone: "blue",
            onClick: () => changeFilter("username"),
            active: filter === "username",
          },
        ]}
      />

      <div className={`${V2_CARD} overflow-hidden`}>
        <div className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.07]">
          <SearchField id="customers_search_v2" value={query} onChange={(v) => { setQuery(v); setLimit(PAGE); }} placeholder="Buscar por nome, @username ou ID" />
          <Segmented<Filter>
            value={filter}
            onChange={changeFilter}
            options={[
              { value: "all", label: "Todos", count: stats.total },
              { value: "username", label: "Com @", count: stats.withUsername },
              { value: "nousername", label: "Sem @", count: stats.total - stats.withUsername },
            ]}
          />
        </div>

        <div className="hidden lg:grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,0.6fr)_minmax(0,1fr)_88px] gap-4 px-5 py-2.5 text-[12px] font-medium text-zinc-500 border-b border-white/[0.07] bg-white/[0.01]">
          <span>Cliente</span>
          <span>Telegram</span>
          <span>ID do Telegram</span>
          <span>Idioma</span>
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
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c)}
                    className="group w-full text-left px-4 sm:px-5 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Desktop */}
                    <div className="hidden lg:grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,0.6fr)_minmax(0,1fr)_88px] gap-4 items-center">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar src={c.photoUrl} name={name} />
                        <p className="text-[13.5px] font-semibold text-white truncate">{name}</p>
                      </div>
                      <span className="min-w-0 truncate text-[13px]">
                        {c.username ? <span className="text-[#60a5fa] font-medium">@{c.username}</span> : <span className="text-zinc-600">Sem @username</span>}
                      </span>
                      <span className="text-[12.5px] font-mono text-zinc-400 truncate">{c.telegramUserId}</span>
                      <span className="text-[11.5px] font-medium text-zinc-400">{languageLabel(c.languageCode)}</span>
                      <span className="text-[12.5px] text-zinc-500 tabular-nums">{fmtDate(c.createdAt)}</span>
                      <span className="justify-self-end text-[12.5px] font-semibold text-zinc-400 group-hover:text-white">Detalhes</span>
                    </div>

                    {/* Mobile */}
                    <div className="lg:hidden flex items-center gap-3">
                      <Avatar src={c.photoUrl} name={name} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-semibold text-white truncate">{name}</p>
                        <p className="text-[12.5px] truncate">
                          {c.username ? <span className="text-[#60a5fa]">@{c.username}</span> : <span className="text-zinc-600">Sem @username</span>}
                        </p>
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

      {selected && <CustomerSheet customer={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CustomerSheet({ customer, onClose }: { customer: CustomerItem; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const name = customerDisplayName(customer);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copyId = () => {
    navigator.clipboard?.writeText(customer.telegramUserId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes de ${name}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-[#141519] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150"
      >
        <div className="relative flex flex-col items-center text-center px-6 pt-7 pb-5 border-b border-white/[0.07]">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06]"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="rounded-full p-[3px] bg-gradient-to-br from-[#3984FF] via-[#1d4ed8] to-[#0b1220]">
            <div className="rounded-full bg-[#0d0e12]">
              <Avatar src={customer.photoUrl} name={name} size={76} />
            </div>
          </div>
          <p className="mt-3 text-[17px] font-semibold text-white">{name}</p>
          <p className="text-[13px] text-zinc-500">{customer.username ? `@${customer.username}` : "Sem @username público"}</p>
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
          <div className="py-3.5">
            <p className="text-[12.5px] text-zinc-500">Idioma do Telegram</p>
            <p className="text-[14px] font-semibold text-white">{languageLabel(customer.languageCode)}</p>
          </div>
          <div className="py-3.5">
            <p className="text-[12.5px] text-zinc-500">Cliente desde</p>
            <p className="text-[14px] font-semibold text-white">{fmtDate(customer.createdAt, "long")}</p>
          </div>
        </div>

        <div className="px-6 pt-2 pb-6 flex items-center gap-2">
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
            <p className="flex-1 text-[12.5px] text-zinc-500">Sem @username, não dá para abrir a conversa direto.</p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-white/10 text-[13px] font-medium text-zinc-300 hover:bg-white/[0.05]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
