"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Download, Folder, FolderPlus, Link2, Loader2, Network, Pencil, Plus, Trash2, Upload, Zap } from "lucide-react";
import SellerPageHeader from "@/components/layout/SellerPageHeader";
import type { FlowSummary, StoreBot } from "@/lib/flows/flow-service";
import {
  createFolderAction,
  deleteFlowAction,
  duplicateFlowAction,
  exportFlowAction,
  importFlowAction,
  moveFlowAction,
  setFlowBotsAction,
} from "./actions";
import { BTN_GHOST, BTN_PRI, BTN_SEC, Callout, INPUT, Modal, useToast } from "./_components/flow-ui";
import Toaster from "./_components/Toaster";

type TypeFilter = "all" | "linked" | "basic" | "advanced";
type ModalState =
  | { kind: "link"; flow: FlowSummary }
  | { kind: "move"; flow: FlowSummary }
  | { kind: "delete"; flow: FlowSummary }
  | { kind: "folder" }
  | null;

/** Superfície com relevo: luz fina no topo, sombra em camadas embaixo. */
const SURFACE =
  "relative rounded-[16px] border border-white/[0.07] bg-[linear-gradient(180deg,#191a1f_0%,#121317_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_1px_2px_rgba(0,0,0,0.45),0_14px_30px_-16px_rgba(0,0,0,0.9)]";

/** Ícone em “tecla” 3D. `accent` acende em azul (filtro ativo). */
function Tile({ children, size = 36, accent = false }: { children: React.ReactNode; size?: number; accent?: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-[10px] flex items-center justify-center transition-all duration-300 ${accent ? "text-white" : "text-[#7fb0ff]"}`}
      style={{
        width: size,
        height: size,
        background: accent ? "linear-gradient(180deg,#4b8ff8 0%,#1d4ed8 100%)" : "linear-gradient(180deg,#2a2c33 0%,#16171c 100%)",
        boxShadow: accent
          ? "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.35), 0 8px 18px -8px rgba(59,130,246,0.75)"
          : "inset 0 1px 0 rgba(255,255,255,0.11), inset 0 -1px 0 rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.045), 0 8px 16px -8px rgba(0,0,0,0.9)",
      }}
    >
      {children}
    </span>
  );
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Recife" });

export default function FlowsListClient({
  available,
  flows,
  folders,
  bots,
  limit,
}: {
  available: boolean;
  flows: FlowSummary[];
  folders: string[];
  bots: StoreBot[];
  limit: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [folder, setFolder] = useState<string>("__all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [modal, setModal] = useState<ModalState>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(
    () => ({
      linked: flows.filter((f) => f.bots.length).length,
      basic: flows.filter((f) => f.type === "basic").length,
      advanced: flows.filter((f) => f.type === "advanced").length,
    }),
    [flows]
  );

  const shown = flows.filter((f) => {
    if (folder === "__none" && f.folder) return false;
    if (folder !== "__all" && folder !== "__none" && f.folder !== folder) return false;
    if (typeFilter === "linked") return f.bots.length > 0;
    if (typeFilter === "basic" || typeFilter === "advanced") return f.type === typeFilter;
    return true;
  });

  const act = (fn: () => Promise<{ success: boolean; error?: string }>, okMsg: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.success) {
        toast(res.error || "Não foi possível concluir.", "err");
        return;
      }
      after?.();
      setModal(null);
      toast(okMsg);
      router.refresh();
    });

  const exportFlow = (f: FlowSummary) =>
    start(async () => {
      const res = await exportFlowAction(f.id);
      if (!res.success || !res.data) {
        toast(res.success ? "Não foi possível exportar." : res.error, "err");
        return;
      }
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${f.name.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "fluxo"}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

  const importFile = (file: File) => {
    if (file.size > 300_000) {
      toast("Arquivo grande demais.", "err");
      return;
    }
    file
      .text()
      .then((txt) => {
        const parsed = JSON.parse(txt);
        if (!parsed || parsed.webgranFlow !== 1) throw new Error("bad");
        act(() => importFlowAction(parsed), `“${parsed.name || "Fluxo"}” importado como rascunho.`);
      })
      .catch(() => toast("Esse arquivo não é um fluxo exportado da WebGran.", "err"));
  };

  const sumCard = (k: TypeFilter, label: string, n: number, icon: React.ReactNode) => {
    const on = typeFilter === k;
    return (
      <button
        key={k}
        type="button"
        aria-pressed={on}
        onClick={() => setTypeFilter(on ? "all" : k)}
        className={`${SURFACE} group overflow-hidden text-left px-5 py-[18px] flex items-center gap-4 transition-all duration-300 hover:-translate-y-[2px] ${
          on ? "!border-[#3b82f6]/45 !shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(59,130,246,0.18),0_16px_34px_-16px_rgba(59,130,246,0.45)]" : "hover:!border-white/[0.12]"
        }`}
      >
        {/* luz azul suave quando o filtro está ativo */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${on ? "opacity-100" : "opacity-0"}`}
          style={{ background: "radial-gradient(80% 120% at 0% 0%, rgba(59,130,246,0.14) 0%, rgba(59,130,246,0) 60%)" }}
        />
        <Tile size={42} accent={on}>{icon}</Tile>
        <span className="relative min-w-0 flex-1">
          <span className="block text-[12.5px] font-medium text-zinc-400 truncate">{label}</span>
          <span className="mt-1 flex items-baseline gap-1.5">
            <span className="text-[26px] leading-none font-semibold tracking-tight tabular-nums text-white">{n}</span>
            <span className="text-[13px] text-zinc-500 font-medium">{n === 1 ? "fluxo" : "fluxos"}</span>
          </span>
        </span>
        {/* participação no total: barra fina e discreta */}
        <span className="relative hidden sm:flex flex-col items-end gap-1.5 shrink-0 w-[84px]">
          <span className="text-[11.5px] font-medium tabular-nums text-zinc-500">
            {flows.length ? Math.round((n / flows.length) * 100) : 0}% do total
          </span>
          <span className="block w-full h-[4px] rounded-full bg-white/[0.06] overflow-hidden">
            <span
              className={`block h-full rounded-full transition-all duration-500 ${on ? "bg-[#3b82f6]" : "bg-[#3b82f6]/60 group-hover:bg-[#3b82f6]/80"}`}
              style={{ width: `${flows.length ? Math.max(4, (n / flows.length) * 100) : 0}%` }}
            />
          </span>
          <span className={`text-[11px] transition-colors ${on ? "text-[#7fb0ff]" : "text-zinc-600 group-hover:text-zinc-400"}`}>
            {on ? "Filtrando" : "Clique p/ filtrar"}
          </span>
        </span>
      </button>
    );
  };

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[9px] text-[12.5px] font-medium transition-all ${
      active
        ? "bg-[linear-gradient(180deg,#24262d_0%,#1a1b20_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.09),0_4px_10px_-4px_rgba(0,0,0,0.8)]"
        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
    }`;

  return (
    <div className="w-full max-w-full pb-10 space-y-5">
      <Toaster />
      <SellerPageHeader
        title="Meus Fluxos"
        subtitle="Como os seus bots conversam e vendem, do /start até a renovação."
        actions={
          <div className="flex items-center gap-2">
            <button type="button" className={BTN_SEC} onClick={() => fileRef.current?.click()} disabled={!available || pending}>
              <Upload className="w-4 h-4" />
              Importar
            </button>
            <Link href="/seller/fluxos/novo" className={`${BTN_PRI} ${!available || flows.length >= limit ? "pointer-events-none opacity-45" : ""}`}>
              <Plus className="w-4 h-4" />
              Criar fluxo <span className="font-medium opacity-75">({flows.length}/{limit})</span>
            </Link>
          </div>
        }
      />
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ""; }} />

      {!available && (
        <Callout tone="warn">
          As tabelas de fluxos ainda não foram criadas no banco. Rode a migration <b>0024_sales_flows.sql</b> no Neon e atualize esta página. Nada muda nos bots enquanto isso.
        </Callout>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {sumCard("linked", "Ligados a um bot", counts.linked, <Link2 className="w-[18px] h-[18px]" />)}
        {sumCard("basic", "Fluxos básicos", counts.basic, <Zap className="w-[18px] h-[18px]" />)}
        {sumCard("advanced", "Fluxos avançados", counts.advanced, <Network className="w-[18px] h-[18px]" />)}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <button type="button" className={chip(folder === "__all")} onClick={() => setFolder("__all")}>Todos <span className="text-[11px] text-zinc-500 tabular-nums">{flows.length}</span></button>
        <button type="button" className={chip(folder === "__none")} onClick={() => setFolder("__none")}>Sem pasta <span className="text-[11px] text-zinc-500 tabular-nums">{flows.filter((f) => !f.folder).length}</span></button>
        {folders.map((p) => (
          <button key={p} type="button" className={chip(folder === p)} onClick={() => setFolder(p)}>
            <Folder className="w-3.5 h-3.5" />{p} <span className="text-[11px] text-zinc-500 tabular-nums">{flows.filter((f) => f.folder === p).length}</span>
          </button>
        ))}
        <button type="button" className={`${chip(false)} border border-dashed border-white/[0.1] ml-1`} onClick={() => setModal({ kind: "folder" })} disabled={!available}>
          <FolderPlus className="w-3.5 h-3.5" />Nova pasta
        </button>
        {typeFilter !== "all" && (
          <button type="button" className={`${chip(false)} ml-auto`} onClick={() => setTypeFilter("all")}>Limpar filtro ✕</button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className={`${SURFACE} px-6 py-14 flex flex-col items-center text-center`}>
          <Tile size={48}><Network className="w-5 h-5" /></Tile>
          <p className="mt-3 text-[14px] font-semibold text-zinc-200">{flows.length ? "Nenhum fluxo neste filtro" : "Você ainda não tem fluxos"}</p>
          <p className="mt-1 text-[13px] text-zinc-500 max-w-sm">{flows.length ? "Escolha outra pasta ou limpe o filtro." : "Crie o primeiro e ligue a um bot de “Venda na conversa”."}</p>
          {!flows.length && available && <Link href="/seller/fluxos/novo" className={`${BTN_PRI} mt-4`}><Plus className="w-4 h-4" />Criar fluxo</Link>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3.5">
          {shown.map((f) => {
            const adv = f.type === "advanced";
            const published = f.status === "published";
            return (
              <article key={f.id} className={`${SURFACE} group overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-[2px] hover:border-white/[0.12]`}>
                {/* grade pontilhada do editor, sumindo para a esquerda */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-0 top-0 h-28 w-1/2 opacity-60 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)",
                    backgroundSize: "12px 12px",
                    WebkitMaskImage: "linear-gradient(225deg, #000 0%, transparent 70%)",
                    maskImage: "linear-gradient(225deg, #000 0%, transparent 70%)",
                  }}
                />

                <div className="relative p-4 pb-3.5 flex flex-col gap-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Tile size={42}>{adv ? <Network className="w-[18px] h-[18px]" /> : <Zap className="w-[18px] h-[18px]" />}</Tile>
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-semibold text-white tracking-tight truncate">{f.name}</h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[12px] text-zinc-500">
                          <span>{adv ? "Avançado" : "Básico"}</span>
                          <span className="w-[3px] h-[3px] rounded-full bg-zinc-700" />
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${published ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" : "bg-amber-400/80"}`} />
                            {published ? "Publicado" : "Rascunho"}
                          </span>
                          {f.folder && (
                            <>
                              <span className="w-[3px] h-[3px] rounded-full bg-zinc-700" />
                              <span className="inline-flex items-center gap-1"><Folder className="w-3 h-3" />{f.folder}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                      {[
                        { icon: Folder, label: "Mover para pasta", on: () => setModal({ kind: "move", flow: f }) },
                        { icon: Copy, label: "Duplicar", on: () => act(() => duplicateFlowAction(f.id), "Fluxo duplicado como rascunho.") },
                        { icon: Download, label: "Exportar", on: () => exportFlow(f) },
                      ].map(({ icon: I, label, on }) => (
                        <button key={label} type="button" title={label} aria-label={label} onClick={on} disabled={pending} className="w-8 h-8 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors">
                          <I className="w-[15px] h-[15px]" />
                        </button>
                      ))}
                      <button type="button" title="Excluir" aria-label="Excluir" onClick={() => setModal({ kind: "delete", flow: f })} className="w-8 h-8 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors">
                        <Trash2 className="w-[15px] h-[15px]" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 min-h-[26px]">
                    {f.bots.length ? (
                      f.bots.map((b) => (
                        <span key={b.id} className="inline-flex items-center gap-1.5 h-[26px] text-[12px] px-2.5 rounded-[8px] bg-white/[0.035] ring-1 ring-inset ring-white/[0.06] text-zinc-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa]" />@{b.username}
                        </span>
                      ))
                    ) : (
                      <span className="text-[12.5px] text-zinc-600">Nenhum bot ligado ainda</span>
                    )}
                  </div>
                </div>

                <div className="relative mt-auto border-t border-white/[0.05] bg-black/[0.18] px-4 py-3 flex items-center gap-2">
                  <p className="text-[11.5px] text-zinc-600 mr-auto truncate">Editado em {fmtDate(f.updatedAt)}</p>
                  <button
                    type="button"
                    onClick={() => setModal({ kind: "link", flow: f })}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[9px] text-[12.5px] font-semibold text-zinc-200 bg-[linear-gradient(180deg,#26282f_0%,#1b1c21_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.07),0_4px_10px_-4px_rgba(0,0,0,0.8)] hover:text-white transition-colors whitespace-nowrap"
                  >
                    <Link2 className="w-3.5 h-3.5" />Ligar bots
                  </button>
                  <Link
                    href={`/seller/fluxos/${f.id}`}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[9px] text-[12.5px] font-semibold text-white bg-[linear-gradient(180deg,#4b8ff8_0%,#2563eb_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_0_0_1px_rgba(37,99,235,0.6),0_6px_14px_-6px_rgba(59,130,246,0.7)] hover:brightness-110 transition-[filter] whitespace-nowrap"
                  >
                    <Pencil className="w-3.5 h-3.5" />Editar fluxo
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modal?.kind === "link" && (
        <LinkBotsModal
          flow={modal.flow}
          flows={flows}
          bots={bots}
          busy={pending}
          onClose={() => setModal(null)}
          onSave={(ids) => act(() => setFlowBotsAction(modal.flow.id, ids), ids.length ? "Bots ligados ao fluxo." : "Nenhum bot ligado.")}
        />
      )}
      {modal?.kind === "move" && (
        <Modal title={`Mover “${modal.flow.name}”`} subtitle="Pastas ajudam a separar fluxos por campanha ou bot." onClose={() => setModal(null)} busy={pending}>
          <div className="flex flex-col gap-2">
            {[null, ...folders].map((p) => (
              <button
                key={p ?? "__none"}
                type="button"
                disabled={pending}
                onClick={() => act(() => moveFlowAction(modal.flow.id, p), p ? `Movido para “${p}”.` : "Removido da pasta.")}
                className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-left text-[13.5px] ${modal.flow.folder === p ? "border-[#3984FF]/50 bg-[#3984FF]/[0.08]" : "border-white/[0.08] bg-[#0d0e12] hover:border-white/[0.16]"}`}
              >
                <Folder className="w-4 h-4 text-[#60a5fa]" />
                {p ?? "Sem pasta"}
              </button>
            ))}
            {!folders.length && <p className="text-[12.5px] text-zinc-500">Você ainda não criou pastas. Use “Nova pasta” na lista.</p>}
          </div>
        </Modal>
      )}
      {modal?.kind === "delete" && (
        <Modal
          title={`Excluir “${modal.flow.name}”?`}
          subtitle={`${modal.flow.bots.length ? `${modal.flow.bots.map((b) => "@" + b.username).join(", ")} deixa de usar este fluxo.` : "Nenhum bot usa este fluxo."} Não dá para desfazer.`}
          onClose={() => setModal(null)}
          busy={pending}
          footer={
            <>
              <button type="button" className={BTN_GHOST} onClick={() => setModal(null)} disabled={pending}>Cancelar</button>
              <button type="button" className={`${BTN_PRI} !bg-red-600 hover:!bg-red-500`} disabled={pending} onClick={() => act(() => deleteFlowAction(modal.flow.id), `“${modal.flow.name}” excluído.`)}>
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Excluir
              </button>
            </>
          }
        />
      )}
      {modal?.kind === "folder" && <FolderModal busy={pending} onClose={() => setModal(null)} onSave={(name) => act(() => createFolderAction(name), `Pasta “${name}” criada.`)} />}
    </div>
  );
}

function FolderModal({ busy, onClose, onSave }: { busy: boolean; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <Modal
      title="Nova pasta"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className={BTN_GHOST} onClick={onClose}>Cancelar</button>
          <button type="button" className={BTN_PRI} disabled={busy || !name.trim()} onClick={() => onSave(name.trim())}>Criar pasta</button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-semibold text-zinc-300">Nome da pasta</span>
        <input autoFocus id="flow-folder-name" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Black Friday" className={INPUT} onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSave(name.trim()); }} />
      </label>
    </Modal>
  );
}

function LinkBotsModal({
  flow,
  flows,
  bots,
  busy,
  onClose,
  onSave,
}: {
  flow: FlowSummary;
  flows: FlowSummary[];
  bots: StoreBot[];
  busy: boolean;
  onClose: () => void;
  onSave: (ids: string[]) => void;
}) {
  const [sel, setSel] = useState<string[]>(flow.bots.map((b) => b.id));
  return (
    <Modal
      title={`Ligar bots a “${flow.name}”`}
      subtitle="Cada bot usa um fluxo por vez. Ligar não muda nada no bot até você publicar o fluxo."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className={BTN_GHOST} onClick={onClose}>Cancelar</button>
          <button type="button" className={BTN_PRI} disabled={busy} onClick={() => onSave(sel)}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Salvar</button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {bots.length === 0 && <p className="text-[13px] text-zinc-500">Você ainda não tem bots. Crie um em Bots.</p>}
        {bots.map((b) => {
          const conversa = b.salesMode === "PADRAO";
          const other = flows.find((x) => x.id !== flow.id && x.bots.some((y) => y.id === b.id));
          const checked = sel.includes(b.id);
          return (
            <label key={b.id} className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border border-white/[0.08] bg-[#0d0e12] ${conversa ? "cursor-pointer hover:border-white/[0.16]" : "opacity-50"}`}>
              <input
                type="checkbox"
                className="w-[18px] h-[18px] accent-[#3984FF]"
                disabled={!conversa}
                checked={checked}
                onChange={(e) => setSel((s) => (e.target.checked ? [...s, b.id] : s.filter((x) => x !== b.id)))}
              />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-white truncate">@{b.username}</span>
                <span className="block text-[12px] text-zinc-500">
                  {!conversa ? "Mini App · não usa fluxo" : other ? `Hoje usa “${other.name}”. Vai trocar para este.` : "Venda na conversa · livre"}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </Modal>
  );
}
