"use client";

import { useState, useTransition } from "react";
import AdminPageHeader from "../../AdminPageHeader";
import {
  REDEMPTION_STATUSES,
  REDEMPTION_STATUS_LABEL,
  brl,
  getPlaque,
  type RedemptionStatus,
} from "@/lib/rewards/plaques";
import { updatePlaqueRedemption } from "./actions";

export type AdminRedemption = {
  id: string;
  storeName: string;
  plaqueValue: number;
  fullName: string;
  phone: string;
  address: string;
  notes: string | null;
  revenueAtRequest: number;
  status: RedemptionStatus;
  trackingCode: string | null;
  createdAt: string;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function AdminPremiacoesClient({ items, tableReady }: { items: AdminRedemption[]; tableReady: boolean }) {
  const [filter, setFilter] = useState<"OPEN" | "ALL">("OPEN");
  const shown = filter === "ALL" ? items : items.filter((i) => i.status !== "DELIVERED" && i.status !== "CANCELED");
  const openCount = items.filter((i) => i.status !== "DELIVERED" && i.status !== "CANCELED").length;

  return (
    <div className="space-y-6 pb-12 text-zinc-100 w-full">
      <AdminPageHeader
        title="Premiações"
        badge={
          <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
            {openCount} em aberto
          </span>
        }
        subtitle="Pedidos de resgate das placas físicas de faturamento. Atualize o status e o rastreio; o vendedor acompanha pela página de Premiações."
      />

      {!tableReady && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          A tabela de resgates ainda não existe. Rode a migração <code>drizzle/0027_plaque_redemptions.sql</code> no Neon.
        </p>
      )}

      <div className="inline-flex rounded-lg border border-white/[0.08] bg-[#0F1014] p-0.5 text-xs">
        {([["OPEN", "Em aberto"], ["ALL", "Todos"]] as const).map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-md ${filter === v ? "bg-[#3b82f6] text-white" : "text-zinc-400 hover:text-white"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] bg-[#0F1014] px-4 py-10 text-center text-sm text-zinc-500">
          Nenhum pedido {filter === "OPEN" ? "em aberto" : "ainda"}.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((item) => (
            <RedemptionRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function RedemptionRow({ item }: { item: AdminRedemption }) {
  const plaque = getPlaque(item.plaqueValue);
  const [status, setStatus] = useState<RedemptionStatus>(item.status);
  const [tracking, setTracking] = useState(item.trackingCode ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = status !== item.status || tracking !== (item.trackingCode ?? "");

  const save = () =>
    start(async () => {
      const res = await updatePlaqueRedemption(item.id, status, tracking);
      setMsg(res.ok ? "Salvo." : res.error);
    });

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0F1014] p-4 grid gap-4 lg:grid-cols-[1fr_auto] items-start">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-full border"
            style={plaque ? { color: plaque.theme.light, borderColor: `rgba(${plaque.theme.rgb},0.4)`, background: `rgba(${plaque.theme.rgb},0.1)` } : undefined}
          >
            Placa {plaque?.short ?? item.plaqueValue} · {plaque?.level}
          </span>
          <span className="text-sm font-semibold text-white">{item.storeName}</span>
          <span className="text-xs text-zinc-500">{fmtDate(item.createdAt)}</span>
        </div>
        <p className="text-sm text-zinc-200">
          {item.fullName} · <span className="tabular-nums">{item.phone}</span>
        </p>
        <p className="text-xs text-zinc-400 break-words">{item.address}</p>
        {item.notes && <p className="text-xs text-zinc-500">Obs.: {item.notes}</p>}
        <p className="text-[11px] text-zinc-600">Faturamento no pedido: {brl(item.revenueAtRequest)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as RedemptionStatus)}
          aria-label="Status do pedido"
          className="h-9 rounded-lg bg-[#15171D] border border-white/[0.08] px-2 text-xs text-white"
        >
          {REDEMPTION_STATUSES.map((s) => (
            <option key={s} value={s}>{REDEMPTION_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <input
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="Código de rastreio"
          aria-label="Código de rastreio"
          className="h-9 w-44 rounded-lg bg-[#15171D] border border-white/[0.08] px-2.5 text-xs text-white placeholder:text-zinc-600"
        />
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className="h-9 px-3 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-40 text-xs font-semibold text-white"
        >
          {pending ? "Salvando..." : "Salvar"}
        </button>
        {msg && <span className="text-[11px] text-zinc-400 w-full lg:text-right">{msg}</span>}
      </div>
    </div>
  );
}
