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
import { BTN_GHOST, BTN_PRI, BTN_SEC, CARD, Callout, FlowTypeIcon, INPUT, Modal, StatusPill, TypePill, useToast } from "./_components/flow-ui";
import Toaster from "./_components/Toaster";

type TypeFilter = "all" | "linked" | "basic" | "advanced";
type ModalState =
  | { kind: "link"; flow: FlowSummary }
  | { kind: "move"; flow: FlowSummary }
  | { kind: "delete"; flow: FlowSummary }
  | { kind: "folder" }
  | null;

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

  const SumCard = ({ k, icon, label, n }: { k: TypeFilter; icon: React.ReactNode; label: string; n: number }) => (
    <button
      type="button"
      onClick={() => setTypeFilter(typeFilter === k ? "all" : k)}
      className={`${CARD} text-left px-5 py-4 flex flex-col gap-2.5 transition-colors ${typeFilter === k ? "!border-[#3984FF]/50 bg-[#3984FF]/[0.04]" : "hover:!border-white/[0.14]"}`}
    >
      <span className="flex items-center gap-2.5 text-[12.5px] text-zinc-400 font-medium">{icon}{label}</span>
      <span className="text-[26px] font-semibold tracking-tight tabular-nums text-white">
        {n}<span className="text-[14px] text-zinc-500 font-medium ml-1.5">{n === 1 ? "fluxo" : "fluxos"}</span>
      </span>
    </button>
  );

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[9px] border text-[12.5px] font-medium transition-colors ${active ? "border-[#3984FF]/50 bg-[#3984FF]/[0.12] text-white" : "border-white/[0.08] text-zinc-400 hover:text-zinc-200"}`;

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
        <SumCard k="linked" label="Ligados a um bot" n={counts.linked} icon={<span className="w-8 h-8 rounded-[9px] bg-emerald-500/[0.12] text-emerald-400 flex items-center justify-center"><Link2 className="w-4 h-4" /></span>} />
        <SumCard k="basic" label="Fluxos básicos" n={counts.basic} icon={<span className="w-8 h-8 rounded-[9px] bg-[#3984FF]/[0.12] text-[#60a5fa] flex items-center justify-center"><Zap className="w-4 h-4" /></span>} />
        <SumCard k="advanced" label="Fluxos avançados" n={counts.advanced} icon={<span className="w-8 h-8 rounded-[9px] bg-violet-400/[0.12] text-violet-300 flex items-center justify-center"><Network className="w-4 h-4" /></span>} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={chip(folder === "__all")} onClick={() => setFolder("__all")}>Todos <span className="text-[11px] text-zinc-500 tabular-nums">{flows.length}</span></button>
        <button type="button" className={chip(folder === "__none")} onClick={() => setFolder("__none")}>Sem pasta <span className="text-[11px] text-zinc-500 tabular-nums">{flows.filter((f) => !f.folder).length}</span></button>
        {folders.map((p) => (
          <button key={p} type="button" className={chip(folder === p)} onClick={() => setFolder(p)}>
            <Folder className="w-3.5 h-3.5" />{p} <span className="text-[11px] text-zinc-500 tabular-nums">{flows.filter((f) => f.folder === p).length}</span>
          </button>
        ))}
        <button type="button" className={`${chip(false)} border-dashed`} onClick={() => setModal({ kind: "folder" })} disabled={!available}>
          <FolderPlus className="w-3.5 h-3.5" />Nova pasta
        </button>
        {typeFilter !== "all" && (
          <button type="button" className={`${chip(false)} ml-auto`} onClick={() => setTypeFilter("all")}>Limpar filtro ✕</button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className={`${CARD} px-6 py-14 flex flex-col items-center text-center`}>
          <span className="w-12 h-12 rounded-[12px] border border-white/[0.08] bg-white/[0.02] flex items-center justify-center text-zinc-500"><Network className="w-5 h-5" /></span>
          <p className="mt-3 text-[14px] font-semibold text-zinc-200">{flows.length ? "Nenhum fluxo neste filtro" : "Você ainda não tem fluxos"}</p>
          <p className="mt-1 text-[13px] text-zinc-500 max-w-sm">{flows.length ? "Escolha outra pasta ou limpe o filtro." : "Crie o primeiro e ligue a um bot de “Venda na conversa”."}</p>
          {!flows.length && available && <Link href="/seller/fluxos/novo" className={`${BTN_PRI} mt-4`}><Plus className="w-4 h-4" />Criar fluxo</Link>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3.5">
          {shown.map((f) => (
            <article key={f.id} className={`${CARD} p-4 flex flex-col gap-3.5 hover:!border-white/[0.14] transition-colors`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FlowTypeIcon type={f.type} size={42} />
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-white truncate">{f.name}</h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <TypePill type={f.type} />
                      <StatusPill status={f.status} />
                      {f.folder && <span className="inline-flex items-center gap-1 text-[11.5px] text-zinc-500"><Folder className="w-3 h-3" />{f.folder}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {[
                    { icon: Folder, label: "Mover para pasta", on: () => setModal({ kind: "move", flow: f }) },
                    { icon: Copy, label: "Duplicar", on: () => act(() => duplicateFlowAction(f.id), "Fluxo duplicado como rascunho.") },
                    { icon: Download, label: "Exportar", on: () => exportFlow(f) },
                  ].map(({ icon: I, label, on }) => (
                    <button key={label} type="button" title={label} aria-label={label} onClick={on} disabled={pending} className="w-[30px] h-[30px] rounded-lg border border-white/[0.08] text-zinc-500 hover:text-white hover:bg-white/[0.05] flex items-center justify-center">
                      <I className="w-[15px] h-[15px]" />
                    </button>
                  ))}
                  <button type="button" title="Excluir" aria-label="Excluir" onClick={() => setModal({ kind: "delete", flow: f })} className="w-[30px] h-[30px] rounded-lg border border-white/[0.08] text-zinc-500 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 flex items-center justify-center">
                    <Trash2 className="w-[15px] h-[15px]" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 min-h-[24px]">
                {f.bots.length ? (
                  f.bots.map((b) => (
                    <span key={b.id} className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-0.5 rounded-full bg-white/[0.05] text-zinc-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />@{b.username}
                    </span>
                  ))
                ) : (
                  <span className="text-[12.5px] text-zinc-600">Nenhum bot ligado ainda</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link href={`/seller/fluxos/${f.id}`} className={`${BTN_PRI} !h-[34px] !text-[12.5px]`}><Pencil className="w-3.5 h-3.5" />Editar fluxo</Link>
                <button type="button" onClick={() => setModal({ kind: "link", flow: f })} className={`${BTN_SEC} !h-[34px] !text-[12.5px]`}><Link2 className="w-3.5 h-3.5" />Ligar bots</button>
              </div>
              <p className="text-[12px] text-zinc-600">Editado em {fmtDate(f.updatedAt)}</p>
            </article>
          ))}
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
