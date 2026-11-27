"use client";

import React, { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCircle2, Clock, Coins, Info, MessageCircle, Moon, Send, Users } from "lucide-react";
import { StatCard, Card, Button, Switch, Toast } from "@/components/seller-v2";
import SellerPageHeader from "@/components/layout/SellerPageHeader";
import { saveRecoveryAction } from "./actions";

interface Step {
  on: boolean;
  delayMinutes: number;
  text: string;
  button: string;
}

interface Props {
  initial: { enabled: boolean; quietHours: boolean; steps: Step[]; ready: boolean };
  stats: {
    contacted: number;
    messages: number;
    recovered: number;
    revenue: number;
    recent: { orderId: string; name: string; product: string; steps: number; sentAt: string; recovered: boolean }[];
  };
  storeName: string;
}

type Unit = "min" | "h" | "d";
const UNIT_MIN: Record<Unit, number> = { min: 1, h: 60, d: 1440 };

function splitDelay(m: number): { value: number; unit: Unit } {
  if (m % 1440 === 0) return { value: m / 1440, unit: "d" };
  if (m % 60 === 0) return { value: m / 60, unit: "h" };
  return { value: m, unit: "min" };
}

function delayLabel(m: number) {
  const { value, unit } = splitDelay(m);
  if (unit === "d") return `${value} ${value === 1 ? "dia" : "dias"}`;
  if (unit === "h") return `${value} ${value === 1 ? "hora" : "horas"}`;
  return `${value} min`;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Prévia do texto como chega no Telegram (com dados de exemplo). */
function PreviewText({ text }: { text: string }) {
  const sample = { nome: "Ana", produto: "Série Exemplo", valor: "R$ 19,90" };
  const parts = text.split(/(\{nome\}|\{produto\}|\{valor\})/g);
  return (
    <p className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.45] text-white">
      {parts.map((p, i) =>
        p === "{nome}" ? (
          <span key={i}>{sample.nome}</span>
        ) : p === "{produto}" ? (
          <b key={i}>{sample.produto}</b>
        ) : p === "{valor}" ? (
          <b key={i}>{sample.valor}</b>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </p>
  );
}

const ORDINAL = ["1ª mensagem", "2ª mensagem", "3ª mensagem"];

export default function RecoveryClient({ initial, stats, storeName }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [quietHours, setQuietHours] = useState(initial.quietHours);
  const [steps, setSteps] = useState<Step[]>(initial.steps);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const textRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  const dirty = useMemo(
    () => JSON.stringify({ enabled, quietHours, steps }) !== JSON.stringify({ enabled: initial.enabled, quietHours: initial.quietHours, steps: initial.steps }),
    [enabled, quietHours, steps, initial]
  );

  const update = (i: number, patch: Partial<Step>) => setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const insertVar = (i: number, v: string) => {
    const el = textRefs.current[i];
    const cur = steps[i].text;
    if (!el) return update(i, { text: `${cur}${v}` });
    const start = el.selectionStart ?? cur.length;
    const end = el.selectionEnd ?? cur.length;
    update(i, { text: cur.slice(0, start) + v + cur.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + v.length, start + v.length);
    });
  };

  const save = async () => {
    for (const [i, s] of steps.entries()) {
      if (s.on && !s.text.trim()) return setToast({ type: "error", message: `Escreva o texto da ${ORDINAL[i].toLowerCase()}.` });
    }
    setSaving(true);
    const res = await saveRecoveryAction({ enabled, quietHours, steps });
    setSaving(false);
    if (!res.ok) return setToast({ type: "error", message: res.error || "Não foi possível salvar." });
    setToast({ type: "success", message: enabled ? "Recuperação de vendas ligada e salva." : "Configuração salva." });
    router.refresh();
  };

  const activeSteps = steps.filter((s) => s.on).length;
  const preview = steps[previewIdx];

  return (
    <div className="w-full space-y-6 pb-28">
      <SellerPageHeader
        title="Recuperação de vendas"
        subtitle="Quem gerou uma compra e não pagou recebe mensagens automáticas no bot, falando do produto, com um botão para concluir."
        badge={
          <span className="inline-flex items-center rounded-full border border-[#3b82f6]/30 bg-[#3b82f6]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#60a5fa]">
            Marketing · em teste
          </span>
        }
        actions={
          <Button onClick={save} isLoading={saving} disabled={!dirty || saving} leftIcon={<CheckCircle2 className="w-4 h-4" />}>
            Salvar
          </Button>
        }
      />

      {!initial.ready && (
        <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-[13px] text-amber-200">
          <Info className="w-5 h-5 shrink-0" />
          Falta rodar a migração <b className="mx-1">0035_sales_recovery.sql</b> no banco para salvar e começar a enviar.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Clientes contatados" value={stats.contacted} subtext="últimos 30 dias" icon={<Users className="w-5 h-5" />} accent="blue" />
        <StatCard label="Mensagens enviadas" value={stats.messages} subtext="últimos 30 dias" icon={<Send className="w-5 h-5" />} accent="blue" />
        <StatCard label="Vendas recuperadas" value={stats.recovered} subtext="pagou até 3 dias depois" icon={<CheckCircle2 className="w-5 h-5" />} accent="blue" />
        <StatCard label="Valor recuperado" value={brl(stats.revenue)} subtext="últimos 30 dias" icon={<Coins className="w-5 h-5" />} accent="blue" />
      </div>

      <Card padding="lg" className="space-y-4">
        <Switch
          checked={enabled}
          onChange={setEnabled}
          label="Recuperação de vendas ligada"
          description={
            enabled
              ? `${activeSteps} ${activeSteps === 1 ? "mensagem ativa" : "mensagens ativas"}. Quem pagar, comprar outra coisa ou já tiver o produto não recebe nada.`
              : "Desligada: nenhuma mensagem é enviada. As que estavam na fila são canceladas ao salvar."
          }
        />
        <div className="h-px bg-white/[0.06]" />
        <Switch
          checked={quietHours}
          onChange={setQuietHours}
          label={
            <span className="inline-flex items-center gap-2">
              <Moon className="w-4 h-4 text-[#60a5fa]" /> Não enviar de madrugada
            </span>
          }
          description="Entre 23h e 8h (horário de Brasília) a mensagem espera e sai às 8h."
        />
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {steps.map((s, i) => {
            const d = splitDelay(s.delayMinutes);
            return (
              <Card
                key={i}
                padding="lg"
                onClick={() => setPreviewIdx(i)}
                className={`space-y-4 transition-colors ${previewIdx === i ? "ring-1 ring-[#3b82f6]/50" : ""} ${s.on ? "" : "opacity-70"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#3b82f6]/25 bg-[#3b82f6]/10 text-[13px] font-bold text-[#60a5fa]">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[14px] font-semibold text-white">{ORDINAL[i]}</p>
                      <p className="text-[12px] text-zinc-400">{s.on ? `Sai ${delayLabel(s.delayMinutes)} depois da compra gerada` : "Desligada"}</p>
                    </div>
                  </div>
                  <Switch checked={s.on} onChange={(v) => update(i, { on: v })} />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[13px] text-zinc-300">
                  <Clock className="w-4 h-4 text-[#60a5fa]" />
                  Enviar
                  <input
                    type="number"
                    min={1}
                    value={d.value}
                    onChange={(e) => {
                      const v = Math.max(1, Math.round(Number(e.target.value) || 1));
                      update(i, { delayMinutes: Math.max(5, v * UNIT_MIN[d.unit]) });
                    }}
                    className="h-9 w-20 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-white outline-none focus:border-[#3b82f6]/60"
                  />
                  <select
                    value={d.unit}
                    onChange={(e) => update(i, { delayMinutes: Math.max(5, d.value * UNIT_MIN[e.target.value as Unit]) })}
                    className="h-9 rounded-lg border border-white/10 bg-[#111] px-2.5 text-white outline-none focus:border-[#3b82f6]/60"
                  >
                    <option value="min">minutos</option>
                    <option value="h">horas</option>
                    <option value="d">dias</option>
                  </select>
                  depois que o cliente gerou a compra
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-[12px] font-medium text-zinc-400">Texto da mensagem</label>
                    <div className="flex flex-wrap gap-1.5">
                      {["{nome}", "{produto}", "{valor}"].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            insertVar(i, v);
                          }}
                          className="rounded-md border border-[#3b82f6]/25 bg-[#3b82f6]/10 px-2 py-0.5 text-[11.5px] font-medium text-[#60a5fa] hover:bg-[#3b82f6]/20"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    ref={(el) => {
                      textRefs.current[i] = el;
                    }}
                    value={s.text}
                    onChange={(e) => update(i, { text: e.target.value.slice(0, 900) })}
                    onFocus={() => setPreviewIdx(i)}
                    rows={4}
                    className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[13.5px] leading-relaxed text-white outline-none focus:border-[#3b82f6]/60"
                  />
                  <p className="text-[11.5px] text-zinc-500">
                    Evite falar de Pix ou pagamento pendente: fale do produto. O produto aparece em negrito e a capa vai junto como foto.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-zinc-400">Texto do botão</label>
                  <input
                    value={s.button}
                    maxLength={40}
                    onChange={(e) => update(i, { button: e.target.value })}
                    onFocus={() => setPreviewIdx(i)}
                    className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[13.5px] text-white outline-none focus:border-[#3b82f6]/60"
                  />
                </div>
              </Card>
            );
          })}
        </div>

        {/* Prévia no Telegram */}
        <div className="xl:sticky xl:top-6 h-fit space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium uppercase tracking-wide text-zinc-400">Prévia no Telegram</p>
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPreviewIdx(i)}
                  className={`h-7 w-7 rounded-md text-[12px] font-semibold ${previewIdx === i ? "bg-[#3b82f6] text-white" : "bg-white/[0.05] text-zinc-400 hover:text-white"}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-[#0e1621] p-4">
            <div className="max-w-[290px] overflow-hidden rounded-2xl rounded-bl-md bg-[#182533]">
              <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-[#1e3a5f] to-[#0f172a] text-[12px] text-[#93c5fd]">
                capa do produto
              </div>
              <div className="px-3 py-2.5">
                <PreviewText text={preview.text} />
                <p className="mt-1 text-right text-[10.5px] text-[#6d8aa6]">{storeName ? "bot da loja" : ""} · agora</p>
              </div>
            </div>
            <div className="mt-1.5 max-w-[290px] rounded-xl bg-[#2b5278]/70 py-2 text-center text-[13px] font-medium text-white">
              {preview.button || "▶️ Concluir minha compra"}
            </div>
          </div>
          <div className="flex gap-2.5 rounded-xl border border-[#3b82f6]/20 bg-[#3b82f6]/[0.06] p-3.5 text-[12.5px] leading-relaxed text-zinc-300">
            <BellRing className="w-4 h-4 shrink-0 text-[#60a5fa] mt-0.5" />
            O botão abre o mini app no carrinho com os itens de volta. O cliente só finaliza, como numa compra normal.
          </div>
        </div>
      </div>

      <Card padding="lg" className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[#60a5fa]" />
          <p className="text-[14px] font-semibold text-white">Últimos clientes contatados</p>
        </div>
        {stats.recent.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-zinc-500">Nenhuma mensagem enviada ainda.</p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {stats.recent.map((r) => (
              <div key={r.orderId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{r.name}</p>
                  <p className="truncate text-[12px] text-zinc-400">
                    {r.product} · {r.steps} {r.steps === 1 ? "mensagem" : "mensagens"} · {new Date(r.sentAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </div>
                {r.recovered ? (
                  <span className="rounded-full border border-[#3b82f6]/30 bg-[#3b82f6]/10 px-2.5 py-0.5 text-[11.5px] font-semibold text-[#60a5fa]">Recuperada</span>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11.5px] text-zinc-400">Aguardando</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} className="fixed bottom-6 right-6 z-50" />}
    </div>
  );
}
