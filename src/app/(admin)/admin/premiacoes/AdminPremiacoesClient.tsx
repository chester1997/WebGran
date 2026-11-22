"use client";

import { useRef, useState, useTransition } from "react";
import { ImageUp, RotateCcw } from "lucide-react";
import { PlaqueArt } from "@/components/rewards/PlaqueArt";
import AdminPageHeader from "../../AdminPageHeader";
import {
  REDEMPTION_STATUSES,
  REDEMPTION_STATUS_LABEL,
  brl,
  PLAQUES,
  getPlaque,
  type Plaque,
  type PlaqueArtMap,
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

export default function AdminPremiacoesClient({
  items,
  tableReady,
  arts,
  customArts,
}: {
  items: AdminRedemption[];
  tableReady: boolean;
  arts: PlaqueArtMap;
  customArts: Record<number, boolean>;
}) {
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
        subtitle="Troque as artes das placas e acompanhe os pedidos de resgate das placas físicas. O vendedor vê tudo pela página de Premiações."
      />

      {!tableReady && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          A tabela de resgates ainda não existe. Rode a migração <code>drizzle/0027_plaque_redemptions.sql</code> no Neon.
        </p>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Artes das placas</h2>
          <p className="text-xs text-zinc-500">
            A imagem aparece na página de Premiações dos vendedores e no botão Baixar arte. PNG, JPG ou WEBP de até 4 MB, de preferência em retrato 3:4 (ex.: 1488×2000).
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {PLAQUES.map((p) => (
            <ArtSlot key={p.value} plaque={p} initialUrl={arts[p.value] ?? null} initialCustom={!!customArts[p.value]} />
          ))}
        </div>
      </section>

      <h2 className="text-sm font-semibold text-white pt-2">Pedidos de resgate</h2>
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

function ArtSlot({ plaque, initialUrl, initialCustom }: { plaque: Plaque; initialUrl: string | null; initialCustom: boolean }) {
  const [url, setUrl] = useState(initialUrl);
  const [custom, setCustom] = useState(initialCustom);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("plaqueValue", String(plaque.value));
      fd.set("file", file);
      const res = await fetch("/api/admin/premiacoes/art", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Não foi possível enviar.");
      setUrl(data.url);
      setCustom(true);
      setMsg({ ok: true, text: "Arte trocada." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erro inesperado." });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const restore = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/premiacoes/art?plaque=${plaque.value}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Não foi possível restaurar.");
      setUrl(data.url ?? plaque.art);
      setCustom(false);
      setMsg({ ok: true, text: "Arte padrão restaurada." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erro inesperado." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0F1014] p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold" style={{ color: plaque.theme.light }}>
          Placa {plaque.short}
        </span>
        <span className="text-[10px] text-zinc-500">{custom ? "Personalizada" : "Padrão"}</span>
      </div>
      <div className={busy ? "opacity-50" : ""}>
        <PlaqueArt plaque={plaque} src={url} />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-label={`Nova arte da Placa ${plaque.short}`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="h-8 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5"
      >
        <ImageUp className="w-3.5 h-3.5" /> {busy ? "Enviando..." : "Trocar imagem"}
      </button>
      {custom && (
        <button
          type="button"
          disabled={busy}
          onClick={restore}
          className="h-8 rounded-lg border border-white/10 hover:bg-white/[0.05] disabled:opacity-50 text-xs text-zinc-300 inline-flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Restaurar padrão
        </button>
      )}
      {msg && <p className={`text-[11px] ${msg.ok ? "text-[#60a5fa]" : "text-red-400"}`}>{msg.text}</p>}
    </div>
  );
}
