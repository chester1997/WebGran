"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Check,
  Copy,
  Globe,
  LifeBuoy,
  Loader2,
  Mail,
  MessageCircle,
  Search,
  Send,
  ShoppingBag,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import SellerPageHeader from "@/components/layout/SellerPageHeader";
import { HeaderMeta } from "@/components/layout/HeaderMeta";
import { BTN_PRI, BTN_SEC, Callout, INPUT, useToast } from "../fluxos/_components/flow-ui";
import Toaster from "../fluxos/_components/Toaster";
import { customerDetailAction, replyTicketAction, setCustomerStatusAction } from "./actions";

interface Customer {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  telegram: string | null;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  paidOrders: number;
  pendingOrders: number;
  totalSpent: number;
  lastPurchaseAt: string | null;
  openTickets: number;
}
interface Ticket {
  id: string;
  webCustomerId: string;
  subject: string;
  message: string;
  contactVia: string;
  status: string;
  sellerReply: string | null;
  orderId: string | null;
  createdAt: string;
  customer: { name: string; email: string; whatsapp: string | null; telegram: string | null };
}
type Detail = Extract<Awaited<ReturnType<typeof customerDetailAction>>, { ok: true }>["detail"];

const SURFACE =
  "relative rounded-[16px] border border-white/[0.07] bg-[linear-gradient(180deg,#191a1f_0%,#121317_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_1px_2px_rgba(0,0,0,0.45),0_14px_30px_-16px_rgba(0,0,0,0.9)]";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Recife" }) : "—");
const fmtTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Recife" });
const digits = (s: string) => s.replace(/\D/g, "");
const waLink = (w: string) => `https://wa.me/${digits(w).length <= 11 ? `55${digits(w)}` : digits(w)}`;

const ORDER_STATUS: Record<string, [string, string]> = {
  paid: ["Pago", "text-[#9cc2ff] bg-[#3b82f6]/12"],
  pending: ["Aguardando PIX", "text-amber-300 bg-amber-500/10"],
  cancelled: ["Cancelado", "text-zinc-400 bg-white/[0.05]"],
};
const TICKET_STATUS: Record<string, [string, string]> = {
  open: ["Aberto", "text-amber-300 bg-amber-500/10"],
  answered: ["Respondido", "text-[#9cc2ff] bg-[#3b82f6]/12"],
  closed: ["Encerrado", "text-zinc-400 bg-white/[0.05]"],
};

function Pill({ map, k }: { map: Record<string, [string, string]>; k: string }) {
  const [l, c] = map[k] || [k, "text-zinc-400 bg-white/[0.05]"];
  return <span className={`inline-flex items-center h-[22px] px-2 rounded-[6px] text-[11px] font-semibold whitespace-nowrap ${c}`}>{l}</span>;
}

function ContactButtons({ c, compact = false }: { c: { email: string; whatsapp: string | null; telegram: string | null }; compact?: boolean }) {
  const cls = compact
    ? "w-8 h-8 rounded-[8px] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
    : "inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-white/[0.04] border border-white/[0.08] text-[12.5px] font-medium text-zinc-200 hover:border-[#3b82f6]/50";
  return (
    <span className="flex items-center gap-1.5">
      {c.whatsapp && (
        <a href={waLink(c.whatsapp)} target="_blank" rel="noopener noreferrer" className={cls} aria-label="Abrir WhatsApp" title="WhatsApp">
          <MessageCircle className="w-4 h-4" />
          {!compact && "WhatsApp"}
        </a>
      )}
      {c.telegram && (
        <a href={`https://t.me/${c.telegram}`} target="_blank" rel="noopener noreferrer" className={cls} aria-label="Abrir Telegram" title="Telegram">
          <Send className="w-4 h-4" />
          {!compact && "Telegram"}
        </a>
      )}
      <a href={`mailto:${c.email}`} className={cls} aria-label="Enviar e-mail" title="E-mail">
        <Mail className="w-4 h-4" />
        {!compact && "E-mail"}
      </a>
    </span>
  );
}

export default function WebStoreClient({ ready, storeSlug, customers, tickets }: { ready: boolean; storeSlug: string; customers: Customer[]; tickets: Ticket[] }) {
  const [tab, setTab] = useState<"clientes" | "suporte">("clientes");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Customer | null>(null);
  const toast = useToast();
  const storeUrl = typeof window !== "undefined" ? `${window.location.origin}/loja/${storeSlug}` : `/loja/${storeSlug}`;

  const stats = useMemo(
    () => ({
      customers: customers.length,
      buyers: customers.filter((c) => c.paidOrders > 0).length,
      revenue: customers.reduce((a, c) => a + c.totalSpent, 0),
      openTickets: tickets.filter((t) => t.status === "open").length,
    }),
    [customers, tickets]
  );

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return customers;
    return customers.filter((c) => [c.name, c.email, c.whatsapp || "", c.telegram || ""].some((v) => v.toLowerCase().includes(t)));
  }, [customers, q]);

  return (
    <div className="w-full max-w-full pb-10 space-y-5">
      <Toaster />
      <SellerPageHeader
        title="Loja Web"
        badge={<HeaderMeta value={stats.customers} label={stats.customers === 1 ? "cliente" : "clientes"} icon={<Users />} />}
        subtitle="Sua loja aberta no navegador, sem precisar do Telegram. Em teste: só você vê esta aba."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={BTN_SEC}
              onClick={() => {
                navigator.clipboard?.writeText(storeUrl).then(() => toast("Link da loja copiado."), () => {});
              }}
            >
              <Copy className="w-4 h-4" /> Copiar link
            </button>
            <a href={`/loja/${storeSlug}`} target="_blank" rel="noopener noreferrer" className={BTN_PRI}>
              <Globe className="w-4 h-4" /> Abrir loja
            </a>
          </div>
        }
      />

      {!ready && (
        <Callout tone="warn">
          As tabelas da Loja Web ainda não existem no banco. Rode a migration <b>0028_web_store.sql</b> no Neon e atualize a página. Nada muda nos bots nem no Mini App enquanto isso.
        </Callout>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[
          { l: "Clientes cadastrados", v: String(stats.customers), icon: Users },
          { l: "Já compraram", v: String(stats.buyers), icon: ShoppingBag },
          { l: "Faturado na Loja Web", v: brl(stats.revenue), icon: Wallet },
          { l: "Suporte em aberto", v: String(stats.openTickets), icon: LifeBuoy },
        ].map((s) => (
          <div key={s.l} className={`${SURFACE} px-4 py-4 flex items-center gap-3.5`}>
            <span className="w-10 h-10 rounded-[10px] flex items-center justify-center text-[#7fb0ff] bg-[linear-gradient(180deg,#2a2c33_0%,#16171c_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.11),0_0_0_1px_rgba(255,255,255,0.045)] shrink-0">
              <s.icon className="w-[18px] h-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] text-zinc-400 truncate">{s.l}</span>
              <span className="block text-[20px] font-semibold tabular-nums tracking-tight truncate">{s.v}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-1 mr-auto">
          {(
            [
              ["clientes", "Clientes", customers.length],
              ["suporte", "Suporte", stats.openTickets],
            ] as const
          ).map(([k, l, n]) => (
            <button
              key={k}
              type="button"
              aria-pressed={tab === k}
              onClick={() => setTab(k)}
              className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[9px] text-[12.5px] font-medium transition-all ${
                tab === k ? "bg-[linear-gradient(180deg,#24262d_0%,#1a1b20_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.09)]" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
              }`}
            >
              {l} <span className="text-[11px] text-zinc-500 tabular-nums">{n}</span>
            </button>
          ))}
        </div>
        {tab === "clientes" && (
          <label className="relative sm:w-[300px]">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail ou contato" className={`${INPUT} !pl-9`} />
          </label>
        )}
      </div>

      {tab === "clientes" ? (
        shown.length === 0 ? (
          <div className={`${SURFACE} px-6 py-14 text-center`}>
            <UserRound className="w-9 h-9 text-zinc-600 mx-auto mb-3" />
            <p className="text-[14px] text-zinc-400">{customers.length ? "Nenhum cliente encontrado." : "Ainda não há clientes cadastrados na Loja Web."}</p>
            {!customers.length && <p className="text-[12.5px] text-zinc-500 mt-1">Compartilhe o link da loja. Quem se cadastrar aparece aqui.</p>}
          </div>
        ) : (
          <div className={`${SURFACE} overflow-hidden`}>
            <div className="hidden lg:grid grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_110px_120px_120px_100px] gap-4 px-5 h-11 items-center text-[11.5px] font-medium text-zinc-500 border-b border-white/[0.06]">
              <span>Cliente</span>
              <span>Contato</span>
              <span className="text-right">Pedidos pagos</span>
              <span className="text-right">Total gasto</span>
              <span>Última compra</span>
              <span />
            </div>
            <ul className="divide-y divide-white/[0.05]">
              {shown.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(c)}
                    className="w-full text-left grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_110px_120px_120px_100px] gap-x-4 gap-y-1 px-5 py-3.5 items-center hover:bg-white/[0.025] transition-colors"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-full bg-[#3b82f6]/15 text-[#9cc2ff] text-[13px] font-semibold flex items-center justify-center shrink-0">
                        {c.name.trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-[13.5px] font-medium text-white truncate">
                          {c.name}
                          {c.status !== "active" && <span className="text-[10.5px] font-semibold text-red-300 bg-red-500/10 px-1.5 rounded">Bloqueado</span>}
                          {c.openTickets > 0 && <span className="text-[10.5px] font-semibold text-amber-300 bg-amber-500/10 px-1.5 rounded">Suporte</span>}
                        </span>
                        <span className="block text-[12px] text-zinc-500 truncate">{c.email}</span>
                      </span>
                    </span>
                    <span className="hidden lg:block text-[12.5px] text-zinc-400 truncate">
                      {[c.whatsapp && `WhatsApp ${c.whatsapp}`, c.telegram && `@${c.telegram}`].filter(Boolean).join(" · ") || "—"}
                    </span>
                    <span className="text-right text-[13px] tabular-nums text-zinc-200 lg:block">
                      <span className="lg:hidden text-zinc-500 text-[11.5px]">{c.paidOrders} pedidos · </span>
                      <span className="hidden lg:inline">{c.paidOrders}</span>
                      <span className="lg:hidden font-semibold">{brl(c.totalSpent)}</span>
                    </span>
                    <span className="hidden lg:block text-right text-[13px] font-semibold tabular-nums">{brl(c.totalSpent)}</span>
                    <span className="hidden lg:block text-[12.5px] text-zinc-400">{fmt(c.lastPurchaseAt)}</span>
                    <span className="hidden lg:block text-right text-[12.5px] text-[#7fb0ff]">Ver detalhes</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : (
        <TicketsList tickets={tickets} onOpenCustomer={(id) => setOpen(customers.find((c) => c.id === id) || null)} />
      )}

      {open && <CustomerDrawer key={open.id} c={open} tickets={tickets.filter((t) => t.webCustomerId === open.id)} onClose={() => setOpen(null)} />}
    </div>
  );
}

function TicketsList({ tickets, onOpenCustomer }: { tickets: Ticket[]; onOpenCustomer: (id: string) => void }) {
  const [filter, setFilter] = useState<"open" | "all">("open");
  const list = filter === "open" ? tickets.filter((t) => t.status === "open") : tickets;
  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-[12.5px]">
        {(
          [
            ["open", "Em aberto"],
            ["all", "Todos"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className={`h-8 px-3 rounded-full border ${filter === k ? "border-[#3b82f6] text-white bg-[#3b82f6]/10" : "border-white/[0.08] text-zinc-400"}`}>
            {l}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className={`${SURFACE} px-6 py-14 text-center text-[14px] text-zinc-400`}>{filter === "open" ? "Nenhum pedido de suporte em aberto." : "Nenhum pedido de suporte ainda."}</div>
      ) : (
        list.map((t) => <TicketCard key={t.id} t={t} onOpenCustomer={onOpenCustomer} />)
      )}
    </div>
  );
}

function TicketCard({ t, onOpenCustomer }: { t: Ticket; onOpenCustomer: (id: string) => void }) {
  const [reply, setReply] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const send = (close: boolean) =>
    start(async () => {
      const r = await replyTicketAction(t.id, reply, close);
      if (!r.ok) {
        toast(r.error, "err");
        return;
      }
      setReply("");
      toast(close ? "Pedido de suporte encerrado." : "Resposta salva. O cliente vê na conta dele.");
      router.refresh();
    });
  const via = t.contactVia === "whatsapp" ? "WhatsApp" : t.contactVia === "telegram" ? "Telegram" : "E-mail";
  return (
    <article className={`${SURFACE} p-4 sm:p-5 space-y-3`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <LifeBuoy className="w-4 h-4 text-[#7fb0ff]" />
        <h3 className="text-[14px] font-semibold text-white">{t.subject}</h3>
        <Pill map={TICKET_STATUS} k={t.status} />
        <span className="ml-auto text-[12px] text-zinc-500">{fmtTime(t.createdAt)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <button type="button" onClick={() => onOpenCustomer(t.webCustomerId)} className="font-medium text-zinc-200 hover:text-[#9cc2ff]">
          {t.customer.name}
        </button>
        <span className="text-zinc-500">· prefere {via}</span>
        <span className="ml-auto">
          <ContactButtons c={t.customer} compact />
        </span>
      </div>
      <p className="text-[13.5px] text-zinc-300 whitespace-pre-line rounded-[11px] bg-black/20 border border-white/[0.05] p-3">{t.message}</p>
      {t.sellerReply && (
        <div className="rounded-[11px] border border-[#3b82f6]/25 bg-[#3b82f6]/[0.06] p-3">
          <p className="text-[11.5px] font-semibold text-[#9cc2ff] mb-1">Sua resposta</p>
          <p className="text-[13.5px] text-zinc-200 whitespace-pre-line">{t.sellerReply}</p>
        </div>
      )}
      {t.status !== "closed" && (
        <div className="space-y-2">
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} maxLength={2000} placeholder="Escreva a resposta (o cliente vê em Minha conta → Suporte)" className={`${INPUT} !h-auto py-2.5 resize-none`} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={BTN_SEC} disabled={pending} onClick={() => send(true)}>
              <Check className="w-4 h-4" /> Encerrar
            </button>
            <button type="button" className={BTN_PRI} disabled={pending || !reply.trim()} onClick={() => send(false)}>
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Responder
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function CustomerDrawer({ c, tickets, onClose }: { c: Customer; tickets: Ticket[]; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    customerDetailAction(c.id).then((r) => {
      if (!alive) return;
      if (r.ok) setDetail(r.detail);
      else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [c.id]);

  const toggleBlock = () =>
    start(async () => {
      const r = await setCustomerStatusAction(c.id, c.status === "active");
      if (!r.ok) toast(r.error, "err");
      else {
        toast(c.status === "active" ? "Cliente bloqueado na Loja Web." : "Cliente liberado.");
        router.refresh();
        onClose();
      }
    });

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Cliente ${c.name}`}>
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative w-full max-w-[520px] h-full overflow-y-auto bg-[#111215] border-l border-white/[0.08] shadow-2xl">
        <div className="sticky top-0 z-10 bg-[#111215]/95 backdrop-blur px-5 py-4 border-b border-white/[0.07] flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-[#3b82f6]/15 text-[#9cc2ff] font-semibold flex items-center justify-center">{c.name.trim().charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15.5px] font-semibold text-white truncate">{c.name}</h2>
            <p className="text-[12px] text-zinc-500 truncate">{c.email}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="w-9 h-9 rounded-[9px] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06]">
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <section className="space-y-3">
            <ContactButtons c={c} />
            <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
              {[
                ["WhatsApp", c.whatsapp || "—"],
                ["Telegram", c.telegram ? `@${c.telegram}` : "—"],
                ["Cadastro", fmt(c.createdAt)],
                ["Último acesso", fmt(c.lastLoginAt)],
                ["Pedidos pagos", String(c.paidOrders)],
                ["Total gasto", brl(c.totalSpent)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-[10px] bg-white/[0.03] border border-white/[0.05] px-3 py-2.5">
                  <dt className="text-zinc-500">{k}</dt>
                  <dd className="text-zinc-100 font-medium truncate">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {error && <p className="text-[13px] text-red-300">{error}</p>}
          {!detail && !error && (
            <p className="flex items-center gap-2 text-[13px] text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando compras...
            </p>
          )}

          {detail && (
            <>
              <section>
                <h3 className="text-[13px] font-semibold text-zinc-300 mb-2.5">Produtos liberados ({detail.owned.length})</h3>
                {detail.owned.length === 0 ? (
                  <p className="text-[12.5px] text-zinc-500">Nenhum ainda.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.owned.map((o, i) => (
                      <li key={i} className="flex items-center gap-2 text-[13px] rounded-[10px] bg-white/[0.03] px-3 py-2">
                        <span className="flex-1 min-w-0 truncate text-zinc-200">{o.title}</span>
                        <span className={`text-[11.5px] ${o.status === "ACTIVE" ? "text-[#9cc2ff]" : "text-zinc-500"}`}>
                          {o.status === "ACTIVE" ? (o.expiresAt ? `até ${fmt(o.expiresAt)}` : "vitalício") : o.status === "EXPIRED" ? "expirado" : o.status === "FAILED" ? "falhou" : "liberando"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="text-[13px] font-semibold text-zinc-300 mb-2.5">Pedidos ({detail.orders.length})</h3>
                {detail.orders.length === 0 ? (
                  <p className="text-[12.5px] text-zinc-500">Nenhum pedido ainda.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.orders.map((o) => (
                      <li key={o.id} className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] text-zinc-500 font-mono">#{o.id.slice(0, 8).toUpperCase()}</span>
                          <Pill map={ORDER_STATUS} k={o.status} />
                          <span className="ml-auto text-[13.5px] font-semibold tabular-nums">{brl(o.total)}</span>
                        </div>
                        <ul className="text-[12.5px] text-zinc-300 space-y-0.5">
                          {o.items.map((it, i) => (
                            <li key={i} className="flex justify-between gap-2">
                              <span className="truncate">
                                {it.quantity}× {it.title}
                                {it.isCombo ? " (combo)" : ""}
                              </span>
                              <span className="tabular-nums text-zinc-500">{brl(it.total)}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-[11.5px] text-zinc-500">
                          Criado {fmtTime(o.createdAt)}
                          {o.paidAt ? ` · pago ${fmtTime(o.paidAt)}` : ""}
                          {o.discount > 0 ? ` · desconto ${brl(o.discount)}` : ""}
                          {o.couponCode ? ` · cupom ${o.couponCode}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          <section>
            <h3 className="text-[13px] font-semibold text-zinc-300 mb-2.5">Suporte ({tickets.length})</h3>
            {tickets.length === 0 ? (
              <p className="text-[12.5px] text-zinc-500">Nenhum pedido de suporte.</p>
            ) : (
              <ul className="space-y-1.5">
                {tickets.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-[13px] rounded-[10px] bg-white/[0.03] px-3 py-2">
                    <span className="flex-1 min-w-0 truncate text-zinc-200">{t.subject}</span>
                    <Pill map={TICKET_STATUS} k={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="pt-4 border-t border-white/[0.06] flex flex-wrap gap-2">
            <button type="button" onClick={toggleBlock} disabled={pending} className={`${BTN_SEC} ${c.status === "active" ? "hover:!text-red-300" : ""}`}>
              {c.status === "active" ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              {c.status === "active" ? "Bloquear acesso à loja" : "Liberar acesso"}
            </button>
            {c.pendingOrders > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-amber-300">
                <Loader2 className="w-3.5 h-3.5" /> {c.pendingOrders} PIX aguardando pagamento
              </span>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
