"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, ImagePlus, LayoutGrid, Loader2, Save, Send, Trash2 } from "lucide-react";
import { BTN_PRI, INPUT, useToast } from "../fluxos/_components/flow-ui";
import { saveVipPlansAction } from "./actions";
import type { VipMode, VipPlanView } from "@/lib/webstore/vip";

import { thumb } from "@/lib/webstore/img";
const SURFACE =
  "relative rounded-[14px] border border-white/[0.07] bg-[linear-gradient(180deg,#191a1f_0%,#121317_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_1px_2px_rgba(0,0,0,0.45),0_14px_30px_-16px_rgba(0,0,0,0.9)]";
const num = (s: string) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;
const money = (n: number) => (n ? n.toFixed(2).replace(".", ",") : "");

/** Planos VIP da Loja Web: cada plano ligado libera todos os títulos da loja pelo período. */
export default function VipPlansPane({ plans }: { plans: VipPlanView[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState(() => plans.map((p) => ({ duration: p.duration, label: p.label, period: p.period, enabled: p.enabled, price: money(p.price) })));
  const on = rows.filter((r) => r.enabled).length;
  const [image, setImage] = useState(plans.find((p) => p.image)?.image || "");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<VipMode>(plans[0]?.mode || "all");
  const [link, setLink] = useState(plans[0]?.link || "");
  const perLabel = mode === "link" ? "Dá acesso ao link por" : "Libera tudo por";

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const { uploadOptimizedImage } = await import("@/lib/image-optimizer");
      const res = await uploadOptimizedImage(file, "banners", { maxWidth: 2400, maxHeight: 800, quality: 0.86 });
      setImage(res.url);
      toast("Imagem enviada. Clique em Salvar planos para aplicar na loja.");
    } catch (e) {
      toast((e as Error).message || "Não foi possível enviar a imagem.", "err");
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    start(async () => {
      const r = await saveVipPlansAction(
        rows.map((x) => ({ duration: x.duration, enabled: x.enabled, price: num(x.price) })),
        image || null,
        mode === "link" ? { mode, link } : { mode: "all" }
      );
      if (!r.ok) return toast(r.error, "err");
      toast(on ? `Planos VIP salvos: ${on} ${on === 1 ? "plano ativo" : "planos ativos"} na loja.` : "Planos VIP desligados. O card sai da loja.");
      router.refresh();
    });

  return (
    <section className={`${SURFACE} p-5`}>
      <div className="flex flex-wrap items-start gap-3 mb-5">
        <div className="mr-auto max-w-[640px]">
          <h3 className="text-[15px] font-semibold flex items-center gap-2">
            <Crown className="w-4 h-4 text-[#3b82f6]" /> Planos VIP
          </h3>
          <p className="text-[12.5px] text-zinc-500 mt-0.5">
            {mode === "link" ? (
              <>
                Quem assina recebe o <b className="text-zinc-300">link do seu VIP</b> (grupo, canal ou bot do Telegram) na conta dele enquanto o plano estiver ativo. Os títulos da loja continuam à
                venda normalmente.
              </>
            ) : (
              <>
                Quem assina vê <b className="text-zinc-300">todos os títulos da Loja Web</b> enquanto o plano estiver ativo. Ligue os planos que quiser vender e defina o preço. Quando vence, os títulos
                voltam a ficar bloqueados (o que o cliente comprou avulso continua dele).
              </>
            )}
          </p>
        </div>
        <button type="button" onClick={save} disabled={pending} className={BTN_PRI}>
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar planos
        </button>
      </div>

      <div className="mb-5">
        <p className="text-[13.5px] font-semibold mb-2">O que o VIP entrega</p>
        <div role="radiogroup" aria-label="O que o VIP entrega" className="grid sm:grid-cols-2 gap-2.5">
          {[
            { k: "all" as const, icon: LayoutGrid, t: "Liberar todos os títulos da loja", d: "O cliente assiste tudo da Loja Web enquanto o plano estiver ativo." },
            { k: "link" as const, icon: Send, t: "Enviar para um link", d: "Grupo ou canal do Telegram, um bot, ou qualquer outro link seu." },
          ].map((o) => {
            const on = mode === o.k;
            return (
              <button
                key={o.k}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMode(o.k)}
                className={`text-left flex items-start gap-3 rounded-[11px] border p-3.5 transition-colors ${on ? "border-[#3b82f6]/60 bg-[#3b82f6]/[0.08]" : "border-white/[0.07] bg-black/20 hover:border-white/[0.14]"}`}
              >
                <span className={`mt-0.5 w-[18px] h-[18px] rounded-full border-2 shrink-0 flex items-center justify-center ${on ? "border-[#3b82f6]" : "border-zinc-600"}`}>
                  {on && <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                    <o.icon className={`w-4 h-4 ${on ? "text-[#3b82f6]" : "text-zinc-500"}`} /> {o.t}
                  </span>
                  <span className="block text-[12px] text-zinc-500 mt-0.5">{o.d}</span>
                </span>
              </button>
            );
          })}
        </div>
        {mode === "link" && (
          <label className="block mt-3 max-w-[560px]">
            <span className="block text-[11.5px] font-medium text-zinc-500 mb-1">Link do VIP</span>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://t.me/+seugrupo ou @seubot" className={`${INPUT} w-full`} />
            <span className="block text-[11.5px] text-zinc-500 mt-1">
              Aparece só para quem tem o VIP ativo, no botão <b className="text-zinc-300">Entrar no VIP</b> da conta do cliente. Prefira um link de convite que você possa trocar se vazar.
            </span>
          </label>
        )}
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {rows.map((r, k) => (
          <div key={r.duration} className={`rounded-[11px] border p-3.5 transition-colors ${r.enabled ? "border-[#3b82f6]/50 bg-[#3b82f6]/[0.06]" : "border-white/[0.07] bg-black/20"}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="mr-auto min-w-0">
                <p className="text-[13.5px] font-semibold">{r.label}</p>
                <p className="text-[11.5px] text-zinc-500">
                  {perLabel} {r.period}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={r.enabled}
                aria-label={`Vender o plano ${r.label}`}
                onClick={() => setRows((s) => s.map((x, i) => (i === k ? { ...x, enabled: !x.enabled } : x)))}
                className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${r.enabled ? "bg-[#3b82f6]" : "bg-white/[0.12]"}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-[left] ${r.enabled ? "left-5" : "left-1"}`} />
              </button>
            </div>
            <label className="block">
              <span className="block text-[11.5px] font-medium text-zinc-500 mb-1">Preço (R$)</span>
              <input
                inputMode="decimal"
                value={r.price}
                placeholder="0,00"
                disabled={!r.enabled}
                onChange={(e) => setRows((s) => s.map((x, i) => (i === k ? { ...x, price: e.target.value.replace(/[^\d,.]/g, "") } : x)))}
                className={`${INPUT} w-full tabular-nums disabled:opacity-50`}
              />
            </label>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-5 border-t border-white/[0.06]">
        <div className="flex flex-wrap items-start gap-3 mb-3">
          <div className="mr-auto">
            <p className="text-[13.5px] font-semibold">Imagem de fundo do card VIP</p>
            <p className="text-[12.5px] text-zinc-500 mt-0.5">
              Tamanho ideal: <b className="text-zinc-300">2400 × 480 px</b> (formato 5:1). Coloque o que importa na <b className="text-zinc-300">metade direita</b>: a esquerda fica escura por trás do texto. Sem imagem, o card usa as capas dos títulos.
            </p>
          </div>
          {image && (
            <button type="button" onClick={() => setImage("")} className="inline-flex items-center gap-1.5 text-[12.5px] text-zinc-400 hover:text-red-300">
              <Trash2 className="w-4 h-4" /> Remover imagem
            </button>
          )}
        </div>
        <label className="relative block aspect-[5/1] min-h-[96px] rounded-[8px] border border-dashed border-white/[0.14] bg-[#0b0d12] hover:border-[#3b82f6]/60 cursor-pointer overflow-hidden">
          {image ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img decoding="async" src={thumb(image, 1280)} alt="" className="absolute inset-0 w-full h-full object-cover object-right" />
              <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,#0b0d12_0%,rgba(11,13,18,0.95)_40%,rgba(11,13,18,0.6)_68%,rgba(11,13,18,0.2)_100%)]" />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[12px] text-zinc-400">Prévia: assim fica atrás do texto</span>
            </>
          ) : (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-[12px] text-zinc-500">
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
              Enviar imagem
            </span>
          )}
          {busy && image && (
            <span className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
            </span>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        <p className="mt-2 text-[12px] text-zinc-500">A posição do card na página você escolhe em <b className="text-zinc-300">Vitrine</b> (seção “Planos VIP”).</p>
      </div>
    </section>
  );
}
