"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Loader2, Pencil, Rocket, Save, Send } from "lucide-react";
import { flowTestLinkAction, publishFlowAction, renameFlowAction, unpublishFlowAction } from "../actions";
import { BTN_GHOST, BTN_PRI, BTN_SEC, Callout, INPUT, Modal, useToast } from "./flow-ui";

export type SaveState = "saved" | "saving" | "dirty" | "error";
export interface ChecklistItem {
  label: string;
  ok: boolean;
  required: boolean;
  onFix?: () => void;
}

export default function EditorTopBar({
  flowId,
  name,
  type,
  status,
  bots,
  saveState,
  checklist,
  extra,
  onSaveNow,
}: {
  flowId: string;
  name: string;
  type: "basic" | "advanced";
  status: "draft" | "published";
  bots: { id: string; username: string }[];
  saveState: SaveState;
  checklist: ChecklistItem[];
  extra?: ReactNode;
  /** Salva na hora (botão "Salvar"). Retorna se deu certo. */
  onSaveNow?: () => Promise<boolean>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [publishOpen, setPublishOpen] = useState(false);
  const [pending, start] = useTransition();
  const [pubPending, startPub] = useTransition();
  const [testPending, startTest] = useTransition();
  const [savePending, startSave] = useTransition();

  const rename = () =>
    start(async () => {
      if (!draft.trim() || draft.trim() === name) {
        setEditing(false);
        setDraft(name);
        return;
      }
      const res = await renameFlowAction(flowId, draft);
      if (!res.success) {
        toast(res.error, "err");
        return;
      }
      setEditing(false);
      router.refresh();
    });

  const saveText =
    saveState === "saving" ? "Salvando…" : saveState === "dirty" ? "Alterações não salvas" : saveState === "error" ? "Erro ao salvar" : status === "published" ? "Salvo · já vale no bot" : "Rascunho salvo";
  const requiredOk = checklist.filter((c) => c.required).every((c) => c.ok) && bots.length > 0;

  return (
    <>
      <div className="flex items-center justify-between gap-x-4 gap-y-3 flex-wrap pb-4 border-b border-white/[0.07]">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/seller/fluxos"
            aria-label="Voltar para Meus Fluxos"
            className="inline-flex items-center gap-1 h-9 pl-1.5 pr-2.5 -ml-1.5 rounded-[9px] text-[13px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />Meus Fluxos
          </Link>
          <span className="w-px h-6 bg-white/[0.1] shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            {editing ? (
              <span className="flex items-center gap-1.5">
                <input
                  autoFocus
                  aria-label="Nome do fluxo"
                  maxLength={40}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") rename();
                    if (e.key === "Escape") { setEditing(false); setDraft(name); }
                  }}
                  className={`${INPUT} !py-1 !text-[15px] !w-[240px]`}
                />
                <button type="button" onClick={rename} disabled={pending} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/[0.06]" aria-label="Salvar nome">
                  {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setEditing(true)} className="group inline-flex items-center gap-1.5 text-[16px] font-semibold tracking-tight text-white max-w-full" title="Renomear">
                <span className="truncate">{name}</span><Pencil className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300 shrink-0" />
              </button>
            )}
            <p className="text-[12.5px] text-[#8b8b94] truncate">
              {type === "advanced" ? "Fluxo avançado" : "Fluxo básico"}
              {" · "}
              {bots.length ? (
                bots.map((b) => "@" + b.username).join(", ")
              ) : (
                <Link href="/seller/fluxos" className="text-[#60a5fa] hover:text-[#93c5fd]">Ligar a um bot</Link>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-2 text-[12.5px] mr-1.5 ${saveState === "error" ? "text-red-400" : saveState === "dirty" ? "text-amber-400" : "text-[#8b8b94]"}`} aria-live="polite">
            <span className={`w-1.5 h-1.5 rounded-full ${saveState === "error" ? "bg-red-400" : saveState === "dirty" || saveState === "saving" ? "bg-amber-400" : status === "published" ? "bg-emerald-400" : "bg-zinc-500"}`} />
            {status === "published" ? "Publicado" : "Rascunho"} · {saveState === "saved" ? (status === "published" ? "salvo, já vale no bot" : "salvo") : saveText.toLowerCase()}
          </span>
          {extra}
          {onSaveNow && (
            <button
              type="button"
              className={BTN_GHOST}
              disabled={savePending || saveState === "saving"}
              title={status === "published" ? "Salva agora. Como o fluxo está publicado, o bot já usa as mudanças." : "Salva o rascunho agora."}
              onClick={() =>
                startSave(async () => {
                  const ok = await onSaveNow();
                  if (!ok) return;
                  toast(
                    status === "published"
                      ? `Salvo! ${bots.map((b) => "@" + b.username).join(", ") || "O bot"} já está usando as mudanças. Mande /start de novo para ver.`
                      : "Rascunho salvo. Publique para o bot começar a usar."
                  );
                })
              }
            >
              {savePending || saveState === "saving" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Salvar
            </button>
          )}
          <button
            type="button"
            className={BTN_SEC}
            disabled={!bots.length || testPending}
            title={!bots.length ? "Ligue o fluxo a um bot para testar" : "Abre o bot no Telegram rodando este rascunho, só para você"}
            onClick={() => {
              // Abre a aba já no clique (evita bloqueio de pop-up) e preenche o link depois.
              const w = window.open("about:blank", "_blank");
              startTest(async () => {
                const res = await flowTestLinkAction(flowId);
                if (!res.success || !res.data) {
                  w?.close();
                  toast(res.success ? "Não foi possível gerar o link." : res.error, "err");
                  return;
                }
                if (w) w.location.href = res.data;
                else window.location.href = res.data;
              });
            }}
          >
            {testPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Testar no Telegram
          </button>
          <button type="button" className={BTN_PRI} onClick={() => setPublishOpen(true)}>
            {status === "published" ? <Check className="w-4 h-4" /> : <Rocket className="w-4 h-4" />}{status === "published" ? "Publicado" : "Publicar"}
          </button>
        </div>
      </div>

      {publishOpen && (
        <Modal
          title={`Publicar “${name}”`}
          subtitle={
            status === "published"
              ? `${bots.map((b) => "@" + b.username).join(", ") || "O bot"} já está usando este fluxo. As mudanças salvas valem na hora.`
              : bots.length
                ? `${bots.map((b) => "@" + b.username).join(", ")} passa a usar este fluxo na hora.`
                : "Ligue um bot antes de publicar."
          }
          onClose={() => setPublishOpen(false)}
          footer={
            <>
              <button type="button" className={BTN_GHOST} onClick={() => setPublishOpen(false)}>Voltar</button>
              {status === "published" ? (
                <button
                  type="button"
                  className={BTN_SEC}
                  disabled={pubPending}
                  onClick={() =>
                    startPub(async () => {
                      const res = await unpublishFlowAction(flowId);
                      if (!res.success) return toast(res.error, "err");
                      setPublishOpen(false);
                      toast("Fluxo despublicado. O bot voltou para a conversa padrão.");
                      router.refresh();
                    })
                  }
                >
                  {pubPending && <Loader2 className="w-4 h-4 animate-spin" />}Despublicar
                </button>
              ) : (
                <button
                  type="button"
                  className={BTN_PRI}
                  disabled={type !== "basic" || !requiredOk || pubPending}
                  title={type !== "basic" ? "O fluxo avançado começa a rodar numa próxima etapa" : undefined}
                  onClick={() =>
                    startPub(async () => {
                      const res = await publishFlowAction(flowId);
                      if (!res.success) return toast(res.error, "err");
                      setPublishOpen(false);
                      toast(`Publicado! ${bots.map((b) => "@" + b.username).join(", ")} já está usando “${name}”.`);
                      router.refresh();
                    })
                  }
                >
                  {pubPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}Publicar agora
                </button>
              )}
            </>
          }
        >
          <div className="flex flex-col gap-2">
            {!bots.length && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] bg-[#0d0e12] border border-white/[0.08] text-[13.5px]">
                <span className="w-[22px] h-[22px] rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-[12px] font-bold">!</span>
                Nenhum bot ligado
                <Link href="/seller/fluxos" className="ml-auto text-[12.5px] font-semibold text-[#60a5fa]">Ligar bot</Link>
              </div>
            )}
            {checklist.map((c) => (
              <div key={c.label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] bg-[#0d0e12] border border-white/[0.08] text-[13.5px]">
                <span className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[12px] font-bold ${c.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>{c.ok ? "✓" : "!"}</span>
                <span>{c.label}{!c.required && <span className="text-zinc-500"> (opcional)</span>}</span>
                {!c.ok && c.onFix && (
                  <button type="button" className="ml-auto text-[12.5px] font-semibold text-[#60a5fa]" onClick={() => { setPublishOpen(false); c.onFix?.(); }}>Configurar</button>
                )}
              </div>
            ))}
            <div className="mt-2">
              <Callout tone={type !== "basic" || !requiredOk ? "warn" : "info"}>
                {type !== "basic"
                  ? "O fluxo avançado fica salvo como rascunho. Ele começa a rodar no bot numa próxima etapa."
                  : requiredOk
                    ? "Antes de publicar, use “Testar no Telegram”: o rascunho roda só para você, com Order Bump, Upsell, Downsell, Mimos e Expiração."
                    : "Falta algo obrigatório acima."}
              </Callout>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
