"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2, Save } from "lucide-react";
import { BTN_PRI, INPUT, useToast } from "../fluxos/_components/flow-ui";
import { saveVipPlansAction } from "./actions";
import type { VipPlanView } from "@/lib/webstore/vip";

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

  const save = () =>
    start(async () => {
      const r = await saveVipPlansAction(rows.map((x) => ({ duration: x.duration, enabled: x.enabled, price: num(x.price) })));
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
            Quem assina vê <b className="text-zinc-300">todos os títulos da Loja Web</b> enquanto o plano estiver ativo. Ligue os planos que quiser vender e defina o preço. Quando vence, os títulos
            voltam a ficar bloqueados (o que o cliente comprou avulso continua dele).
          </p>
        </div>
        <button type="button" onClick={save} disabled={pending} className={BTN_PRI}>
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar planos
        </button>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {rows.map((r, k) => (
          <div key={r.duration} className={`rounded-[11px] border p-3.5 transition-colors ${r.enabled ? "border-[#3b82f6]/50 bg-[#3b82f6]/[0.06]" : "border-white/[0.07] bg-black/20"}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="mr-auto min-w-0">
                <p className="text-[13.5px] font-semibold">{r.label}</p>
                <p className="text-[11.5px] text-zinc-500">Libera tudo por {r.period}</p>
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
    </section>
  );
}
