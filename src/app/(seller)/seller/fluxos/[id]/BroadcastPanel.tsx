"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { broadcastCountAction, cancelBroadcastAction, createBroadcastAction, listBroadcastsAction } from "../actions";
import { BTN_GHOST, BTN_PRI, CARD, Callout, useToast } from "../_components/flow-ui";
import { AreaField, Card, MediaField, Seg, TextField } from "./flow-fields";

type Audience = "all" | "nobuy" | "buyers";
type ButtonType = "none" | "plans" | "link";
type Row = { id: string; audience: string; message: string; status: string; total: number; sent: number; failed: number; createdAt: string };

const AUDIENCE_LABEL: Record<string, string> = { all: "Todos", nobuy: "Não compradores", buyers: "Compradores" };

/** Central de disparo: mensagem em massa para os leads do bot ligado ao fluxo. */
export default function BroadcastPanel({ flowId, published }: { flowId: string; published: boolean }) {
  const toast = useToast();
  const [audience, setAudience] = useState<Audience>("all");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [btnType, setBtnType] = useState<ButtonType>("plans");
  const [btnText, setBtnText] = useState("");
  const [btnUrl, setBtnUrl] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [sending, startSend] = useTransition();

  const [tick, setTick] = useState(0);
  const refresh = () => setTick((x) => x + 1);

  useEffect(() => {
    let alive = true;
    broadcastCountAction(flowId, audience).then((r) => { if (alive) setCount(r.success ? r.data ?? 0 : 0); });
    return () => { alive = false; };
  }, [flowId, audience]);

  useEffect(() => {
    let alive = true;
    listBroadcastsAction(flowId).then((r) => { if (alive && r.success) setRows(r.data || []); });
    return () => { alive = false; };
  }, [flowId, tick]);

  // Atualiza o progresso enquanto houver disparo em andamento.
  const running = rows.some((r) => r.status === "running");
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((x) => x + 1), 4000);
    return () => clearInterval(t);
  }, [running]);

  const send = () =>
    startSend(async () => {
      const res = await createBroadcastAction(flowId, {
        audience,
        message,
        mediaUrl,
        button: btnType === "link" ? { type: "link", text: btnText, url: btnUrl } : { type: btnType },
      });
      setConfirm(false);
      if (!res.success) return toast(res.error, "err");
      toast(`Disparo iniciado para ${res.data?.total ?? 0} pessoa(s).`);
      setMessage("");
      setMediaUrl("");
      refresh();
    });

  return (
    <>
      <Card title="📢 Central de disparo" sub="Mensagem em massa para quem já deu /start no bot. Clientes bloqueados nunca recebem. O envio é feito aos poucos para respeitar o limite do Telegram.">
        {!published && <Callout tone="warn">O fluxo está em rascunho: os botões do disparo vão abrir a versão de teste. Publique antes de disparar para os clientes.</Callout>}
        <Seg label="Para quem" value={audience} onChange={(v) => { setCount(null); setAudience(v as Audience); }} options={[["all", "👥 Todos"], ["nobuy", "🛒 Não compradores"], ["buyers", "⭐ Compradores"]]} />
        <p className="text-[12.5px] text-zinc-400 -mt-1">{count === null ? "Contando…" : `${count} pessoa(s) vão receber.`}</p>
        <AreaField id="f-bc-msg" label="Mensagem" value={message} onChange={setMessage} vars={["{nome}", "{saudacao}"]} />
        <MediaField label="Mídia (opcional)" accept="visual" value={mediaUrl} onChange={setMediaUrl} />
        <Seg label="Botão" value={btnType} onChange={(v) => setBtnType(v as ButtonType)} options={[["plans", "💳 Planos"], ["link", "🔗 Link"], ["none", "Sem botão"]]} />
        {btnType === "link" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <TextField id="f-bc-btn-text" label="Texto do botão" max={64} placeholder="Ex.: 📸 Ver prévia" value={btnText} onChange={setBtnText} />
            <TextField id="f-bc-btn-url" label="Link" max={1000} placeholder="https://" value={btnUrl} onChange={setBtnUrl} />
          </div>
        )}
        {btnType === "plans" && <p className="text-[12px] text-zinc-500 -mt-1">Os botões dos planos levam direto para o Pix.</p>}
        <div className="flex items-center gap-2 justify-end">
          {confirm ? (
            <>
              <span className="text-[12.5px] text-amber-400 mr-auto">Enviar para {count ?? 0} pessoa(s)? Não dá para desfazer as mensagens já enviadas.</span>
              <button type="button" className={BTN_GHOST} onClick={() => setConfirm(false)}>Voltar</button>
              <button type="button" className={BTN_PRI} disabled={sending} onClick={send}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Confirmar envio
              </button>
            </>
          ) : (
            <button type="button" className={BTN_PRI} disabled={!count || (!message.trim() && !mediaUrl)} onClick={() => setConfirm(true)}>
              <Send className="w-4 h-4" />Disparar
            </button>
          )}
        </div>
      </Card>

      <div className={`${CARD} p-4 flex flex-col gap-2.5`}>
        <p className="text-[14px] font-semibold text-white">Últimos disparos</p>
        {rows.length === 0 && <p className="text-[12.5px] text-zinc-500">Nenhum disparo ainda.</p>}
        {rows.map((r) => {
          const pct = r.total ? Math.round(((r.sent + r.failed) / r.total) * 100) : 0;
          return (
            <div key={r.id} className="rounded-[12px] border border-white/[0.08] bg-[#0d0e12] px-3.5 py-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-zinc-400">{new Date(r.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {AUDIENCE_LABEL[r.audience] || r.audience}</span>
                <span className={`ml-auto text-[11.5px] font-semibold ${r.status === "running" ? "text-[#60a5fa]" : r.status === "canceled" ? "text-zinc-500" : "text-emerald-400"}`}>
                  {r.status === "running" ? `Enviando ${pct}%` : r.status === "canceled" ? "Cancelado" : "Concluído"}
                </span>
                {r.status === "running" && (
                  <button type="button" className="text-[12px] text-red-400 hover:text-red-300" onClick={async () => { const x = await cancelBroadcastAction(flowId, r.id); if (!x.success) toast(x.error, "err"); refresh(); }}>Cancelar</button>
                )}
              </div>
              <p className="text-[13px] text-zinc-300 truncate">{r.message || "(só mídia)"}</p>
              <p className="text-[12px] text-zinc-500 tabular-nums">✓ {r.sent} enviados · ✗ {r.failed} não entregues · {r.total} no total</p>
            </div>
          );
        })}
      </div>
    </>
  );
}
