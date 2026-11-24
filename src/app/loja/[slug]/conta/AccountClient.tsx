"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, LifeBuoy, LogOut, MessageSquare, Package, PlayCircle, Receipt, UserRound } from "lucide-react";
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
    { k: "produtos" as const, l: "Meus produtos", n: owned.length, icon: Package },
    { k: "pedidos" as const, l: "Pedidos", n: orders.length, icon: Receipt },
    { k: "suporte" as const, l: "Suporte", n: tickets.length, icon: MessageSquare },
    { k: "perfil" as const, l: "Perfil e senha", n: null, icon: UserRound },
  ];

  return (
    <div className="w-full px-4 sm:px-8 lg:px-10 pt-8 sm:pt-12 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-7">
        <button type="button" onClick={() => setTab("perfil")} className="shrink-0 self-start sm:self-auto rounded-full" aria-label="Editar perfil">
          <Avatar url={customer.avatarUrl} name={customer.name} size={64} />
        </button>
        <div className="mr-auto min-w-0">
          <p className="text-[13px] text-zinc-500">Minha conta</p>
          <h1 className="text-[26px] font-semibold tracking-tight truncate">Olá, {customer.name.split(" ")[0]}</h1>
          <p className="text-[13px] text-zinc-500 truncate">
            {customer.email}
            {customer.whatsapp ? ` · WhatsApp ${customer.whatsapp}` : ""}
            {customer.telegram ? ` · @${customer.telegram}` : ""}
          </p>
        </div>
        <button
          type="button"
          className={BTN_GHOST}
          disabled={pending}
          onClick={() =>
            start(async () => {
              await logoutAction(slug);
              router.push(`/loja/${slug}`);
              router.refresh();
            })
          }
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>

      <div role="tablist" className="flex gap-1 border-b border-white/[0.07] mb-6 overflow-x-auto [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.k}
            role="tab"
            aria-selected={tab === t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={`shrink-0 inline-flex items-center gap-2 h-11 px-3.5 -mb-px border-b-2 text-[13.5px] font-medium transition-colors ${
              tab === t.k ? "border-[#3b82f6] text-white" : "border-transparent text-zinc-500 hover:text-zinc-200"
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.l}
            {t.n !== null && <span className="text-[11.5px] text-zinc-500 tabular-nums">{t.n}</span>}
          </button>
        ))}
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
