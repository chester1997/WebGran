"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, LifeBuoy, LogOut, Mail, MessageSquare, Package, Phone, PlayCircle, Receipt, Send, UserRound } from "lucide-react";
import { logoutAction } from "../actions";
import { brl, BTN_GHOST, CARD } from "../_components/ui";
import { Avatar, ProfilePane } from "./ProfilePane";

interface Owned {
  accessId: string;
  productId: string;
  title: string;
  coverUrl: string | null;
  deliveryType: string;
  link: string | null;
  status: string;
  expiresAt: string | null;
}
interface Order {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  items: string[];
}
interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: string;
  sellerReply: string | null;
  createdAt: string;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const ORDER_STATUS: Record<string, [string, string]> = {
  paid: ["Pago", "text-[#9cc2ff] bg-[#3b82f6]/12"],
  pending: ["Aguardando PIX", "text-amber-300 bg-amber-500/10"],
  cancelled: ["Cancelado", "text-zinc-400 bg-white/[0.05]"],
  expired: ["Expirado", "text-zinc-400 bg-white/[0.05]"],
};
const TICKET_STATUS: Record<string, [string, string]> = {
  open: ["Aguardando a loja", "text-amber-300 bg-amber-500/10"],
  answered: ["Respondido", "text-[#9cc2ff] bg-[#3b82f6]/12"],
  closed: ["Encerrado", "text-zinc-400 bg-white/[0.05]"],
};

export function AccountClient({
  slug,
  customer,
  owned,
  orders,
  tickets,
}: {
  slug: string;
  customer: { name: string; email: string; whatsapp: string | null; telegram: string | null; createdAt: string; avatarUrl: string | null };
  owned: Owned[];
  orders: Order[];
  tickets: Ticket[];
}) {
  const [tab, setTab] = useState<"produtos" | "pedidos" | "suporte" | "perfil">("produtos");
  const router = useRouter();
  const [pending, start] = useTransition();

  const tabs = [
    { k: "produtos" as const, l: "Meus produtos", s: "Produtos", n: owned.length, icon: Package },
    { k: "pedidos" as const, l: "Pedidos", s: "Pedidos", n: orders.length, icon: Receipt },
    { k: "suporte" as const, l: "Suporte", s: "Suporte", n: tickets.length, icon: MessageSquare },
    { k: "perfil" as const, l: "Perfil e senha", s: "Perfil", n: null, icon: UserRound },
  ];

  return (
    <div className="w-full min-w-0 px-4 sm:px-8 lg:px-10 pt-5 sm:pt-12 pb-6">
      {/* Cabeçalho do perfil: no celular, um cartão compacto; contatos quebram linha em vez de vazar */}
      <div className="mb-6 sm:mb-7 rounded-[12px] sm:rounded-none border sm:border-0 border-white/[0.07] bg-[#0f1014] sm:bg-transparent p-4 sm:p-0">
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          <button type="button" onClick={() => setTab("perfil")} className="shrink-0 rounded-full" aria-label="Editar perfil">
            <Avatar url={customer.avatarUrl} name={customer.name} size={64} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] sm:text-[13px] text-zinc-500">Minha conta</p>
            <h1 className="text-[21px] sm:text-[26px] font-semibold tracking-tight leading-tight truncate">Olá, {customer.name.split(" ")[0]}</h1>
            <p className="hidden sm:block text-[13px] text-zinc-500 truncate">
              {customer.email}
              {customer.whatsapp ? ` · WhatsApp ${customer.whatsapp}` : ""}
              {customer.telegram ? ` · @${customer.telegram}` : ""}
            </p>
          </div>
          <button
            type="button"
            aria-label="Sair da conta"
            className={`${BTN_GHOST} shrink-0 !h-10 !px-3 sm:!px-4`}
            disabled={pending}
            onClick={() =>
              start(async () => {
                await logoutAction(slug);
                router.push(`/loja/${slug}`);
                router.refresh();
              })
            }
          >
            <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
        <ul className="sm:hidden mt-3.5 pt-3.5 border-t border-white/[0.06] space-y-2 text-[13px] min-w-0">
          <li className="flex items-center gap-2.5 min-w-0 text-zinc-300">
            <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
            <span className="truncate">{customer.email}</span>
          </li>
          {customer.whatsapp && (
            <li className="flex items-center gap-2.5 min-w-0 text-zinc-300">
              <Phone className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="truncate tabular-nums">{customer.whatsapp}</span>
            </li>
          )}
          {customer.telegram && (
            <li className="flex items-center gap-2.5 min-w-0 text-zinc-300">
              <Send className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="truncate">@{customer.telegram}</span>
            </li>
          )}
        </ul>
      </div>

      {/* Abas: no celular, 4 botões iguais lado a lado (sem rolar); no computador, a linha com sublinhado */}
      <div role="tablist" className="grid grid-cols-4 gap-1 p-1 mb-5 rounded-[10px] bg-white/[0.04] border border-white/[0.06] sm:flex sm:gap-1 sm:p-0 sm:mb-6 sm:rounded-none sm:bg-transparent sm:border-0 sm:border-b sm:border-white/[0.07]">
        {tabs.map((t) => {
          const on = tab === t.k;
          return (
            <button
              key={t.k}
              role="tab"
              aria-selected={on}
              type="button"
              onClick={() => setTab(t.k)}
              className={`relative min-w-0 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 h-[58px] sm:h-11 px-1 sm:px-3.5 rounded-[8px] sm:rounded-none sm:-mb-px sm:border-b-2 text-[11.5px] sm:text-[13.5px] font-medium transition-colors ${
                on ? "bg-[#3b82f6]/[0.14] text-white sm:bg-transparent sm:border-[#3b82f6]" : "text-zinc-500 hover:text-zinc-200 sm:border-transparent"
              }`}
            >
              <t.icon className={`w-[18px] h-[18px] sm:w-4 sm:h-4 ${on ? "text-[#3b82f6] sm:text-current" : ""}`} />
              <span className="truncate max-w-full sm:hidden">{t.s}</span>
              <span className="hidden sm:inline">{t.l}</span>
              {t.n !== null && t.n > 0 && (
                <span className="absolute top-1.5 right-1.5 sm:static min-w-[16px] h-4 px-1 rounded-full sm:rounded-none sm:min-w-0 sm:h-auto sm:px-0 bg-[#3b82f6] sm:bg-transparent text-white sm:text-zinc-500 text-[10px] sm:text-[11.5px] font-bold sm:font-normal flex items-center justify-center tabular-nums">
                  {t.n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "produtos" &&
        (owned.length === 0 ? (
          <Empty text="Você ainda não tem produtos. Depois do PIX confirmado eles aparecem aqui." cta={{ href: `/loja/${slug}`, label: "Ver produtos" }} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {owned.map((o) => {
              const active = o.status === "ACTIVE";
              return (
                <article key={o.accessId} className={`${CARD} overflow-hidden flex`}>
                  <span className="w-[96px] shrink-0 bg-[#1a1a1d]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {o.coverUrl && <img src={o.coverUrl} alt="" className="w-full h-full object-cover" />}
                  </span>
                  <div className="p-4 min-w-0 flex-1 flex flex-col gap-2">
                    <p className="text-[14px] font-semibold leading-snug line-clamp-2">{o.title}</p>
                    <p className="text-[12px] text-zinc-500">
                      {active ? (o.expiresAt ? `Acesso até ${fmt(o.expiresAt)}` : "Acesso vitalício") : o.status === "EXPIRED" ? "Acesso expirado" : o.status === "FAILED" ? "Falha na liberação: fale com o suporte" : "Liberando acesso..."}
                    </p>
                    {active && (
                      <div className="mt-auto">
                        {o.deliveryType === "product_video" ? (
                          <Link href={`/loja/${slug}/conta/produto/${o.productId}`} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[9px] bg-[#3b82f6] hover:bg-[#2f74ea] text-[13px] font-semibold">
                            <PlayCircle className="w-4 h-4" /> Assistir
                          </Link>
                        ) : o.link ? (
                          <a href={o.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[9px] bg-[#3b82f6] hover:bg-[#2f74ea] text-[13px] font-semibold">
                            {o.deliveryType === "external" ? "Abrir link" : "Entrar no grupo"} <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : null}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ))}

      {tab === "perfil" && <ProfilePane slug={slug} customer={customer} />}

      {tab === "pedidos" &&
        (orders.length === 0 ? (
          <Empty text="Nenhum pedido ainda." cta={{ href: `/loja/${slug}`, label: "Ver produtos" }} />
        ) : (
          <div className={`${CARD} divide-y divide-white/[0.06]`}>
            {orders.map((o) => {
              const [label, cls] = ORDER_STATUS[o.status] || [o.status, "text-zinc-400 bg-white/[0.05]"];
              return (
                <div key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium truncate">{o.items.join(", ")}</p>
                    <p className="text-[12px] text-zinc-500">
                      #{o.id.slice(0, 8).toUpperCase()} · {fmt(o.createdAt)}
                    </p>
                  </div>
                  <span className={`h-6 px-2 rounded-[7px] text-[11.5px] font-semibold flex items-center ${cls}`}>{label}</span>
                  <span className="w-[96px] text-right text-[14px] font-semibold tabular-nums">{brl(o.total)}</span>
                  {o.status === "pending" && (
                    <Link href={`/loja/${slug}/pedido/${o.id}`} className="text-[12.5px] text-[#7fb0ff] hover:underline">
                      Ver PIX
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ))}

      {tab === "suporte" &&
        (tickets.length === 0 ? (
          <Empty text="Nenhum pedido de suporte. Use o botão Suporte no canto da tela quando precisar." />
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => {
              const [label, cls] = TICKET_STATUS[t.status] || [t.status, ""];
              return (
                <article key={t.id} className={`${CARD} p-4 space-y-2.5`}>
                  <div className="flex items-center gap-2">
                    <LifeBuoy className="w-4 h-4 text-[#7fb0ff]" />
                    <p className="text-[14px] font-semibold mr-auto">{t.subject}</p>
                    <span className={`h-6 px-2 rounded-[7px] text-[11.5px] font-semibold flex items-center ${cls}`}>{label}</span>
                  </div>
                  <p className="text-[13.5px] text-zinc-400 whitespace-pre-line">{t.message}</p>
                  <p className="text-[11.5px] text-zinc-600">{fmt(t.createdAt)}</p>
                  {t.sellerReply && (
                    <div className="rounded-[11px] border border-[#3b82f6]/25 bg-[#3b82f6]/[0.06] p-3">
                      <p className="text-[11.5px] font-semibold text-[#9cc2ff] mb-1">Resposta da loja</p>
                      <p className="text-[13.5px] text-zinc-200 whitespace-pre-line">{t.sellerReply}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ))}
    </div>
  );
}

function Empty({ text, cta }: { text: string; cta?: { href: string; label: string } }) {
  return (
    <div className={`${CARD} py-14 px-6 text-center`}>
      <p className="text-[14px] text-zinc-500">{text}</p>
      {cta && (
        <Link href={cta.href} className="inline-flex mt-4 text-[13.5px] font-semibold text-[#7fb0ff] hover:underline">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
