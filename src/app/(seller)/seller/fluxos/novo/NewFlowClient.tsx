"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Loader2, Plus } from "lucide-react";
import SellerPageHeader from "@/components/layout/SellerPageHeader";
import { createFlowAction } from "../actions";
import { BTN_GHOST, BTN_PRI, CARD, Callout, FlowTypeIcon, INPUT, useToast } from "../_components/flow-ui";
import Toaster from "../_components/Toaster";

type Mode = "basic" | "advanced";

export default function NewFlowClient({ available, used, limit }: { available: boolean; used: number; limit: number }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("basic");
  const [template, setTemplate] = useState(true);
  const [pending, start] = useTransition();
  const full = used >= limit;

  const create = () =>
    start(async () => {
      const res = await createFlowAction({ name, type: mode, template });
      if (!res.success || !res.data) {
        toast(res.success ? "Não foi possível criar." : res.error, "err");
        return;
      }
      router.push(`/seller/fluxos/${res.data}`);
    });

  const ModeCard = ({ m, title, text, items, art }: { m: Mode; title: string; text: string; items: string[]; art: React.ReactNode }) => {
    const on = mode === m;
    const accent = m === "advanced" ? "violet" : "blue";
    return (
      <button
        type="button"
        onClick={() => setMode(m)}
        aria-pressed={on}
        className={`relative text-left rounded-2xl border p-5 flex flex-col gap-3.5 transition-colors bg-[#0d0e12] ${
          on ? (accent === "violet" ? "border-violet-400 bg-gradient-to-b from-violet-400/[0.08] to-transparent" : "border-[#3984FF] bg-gradient-to-b from-[#3984FF]/[0.08] to-transparent") : "border-white/[0.13] hover:border-white/25"
        }`}
      >
        <span className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 ${on ? (accent === "violet" ? "border-[6px] border-violet-400" : "border-[6px] border-[#3984FF]") : "border-white/20"}`} />
        <FlowTypeIcon type={m} />
        <div>
          <p className="text-[16px] font-semibold text-white">{title}</p>
          <p className="text-[13px] text-zinc-400 leading-relaxed mt-1">{text}</p>
        </div>
        <div className="h-[84px] rounded-[10px] border border-white/[0.08] bg-[#0b0c10] p-2.5 overflow-hidden">{art}</div>
        <ul className="flex flex-col gap-1.5 text-[12.5px] text-zinc-300">
          {items.map((i) => (
            <li key={i} className="flex gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />{i}</li>
          ))}
        </ul>
      </button>
    );
  };

  return (
    <div className="w-full max-w-[1200px] pb-10 space-y-5">
      <Toaster />
      <SellerPageHeader title="Criar fluxo" subtitle="Dê um nome e escolha como você quer montar a conversa." />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/seller/fluxos" className="inline-flex items-center gap-1 text-[13px] text-zinc-400 hover:text-white"><ChevronLeft className="w-4 h-4" />Meus Fluxos</Link>
        <span className="px-2.5 py-0.5 rounded-full border border-white/[0.13] text-[11.5px] font-semibold text-zinc-400 tabular-nums">{used} de {limit} fluxos usados</span>
      </div>

      {!available && <Callout tone="warn">Rode a migration <b>0024_sales_flows.sql</b> no Neon antes de criar fluxos.</Callout>}
      {full && <Callout tone="warn">Você chegou ao limite de {limit} fluxos. Exclua um para criar outro.</Callout>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        <div className="flex flex-col gap-4">
          <section className={`${CARD} p-5`}>
            <label className="flex flex-col gap-1.5">
              <span className="flex justify-between text-[12.5px] font-semibold text-zinc-300">Nome do fluxo <span className="font-normal text-zinc-600 tabular-nums">{name.length}/40</span></span>
              <input id="new-flow-name" autoFocus maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Venda VIP mensal" className={`${INPUT} !text-[16px] !py-3`} onKeyDown={(e) => { if (e.key === "Enter" && name.trim() && !full && available) create(); }} />
              <span className="text-[12px] text-zinc-500">Só você vê esse nome. Use algo que diga o objetivo do fluxo.</span>
            </label>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ModeCard
              m="basic"
              title="Básico"
              text="Etapas prontas na ordem da venda. Você só preenche os textos, planos e ofertas."
              items={["Boas-vindas, planos, Pix e entrega", "Order Bump, Upsell e Recuperação", "Prévia do Telegram ao vivo"]}
              art={<div className="flex gap-1.5 h-full"><div className="w-1/3 flex flex-col gap-1.5">{[0, 1, 2, 3].map((i) => <i key={i} className={`h-2 rounded ${i ? "bg-white/[0.08]" : "bg-[#3984FF]/60"}`} />)}</div><div className="flex-1 rounded-md bg-white/[0.04]" /></div>}
            />
            <ModeCard
              m="advanced"
              title="Avançado"
              text="Monte a conversa ligando blocos, com caminhos diferentes para cada resposta."
              items={["Tudo do Básico, em blocos", "Condições, esperas e teste A/B", "Caminhos “pagou / não pagou”"]}
              art={
                <svg viewBox="0 0 200 64" className="w-full h-full" aria-hidden="true">
                  <g fill="none" stroke="#a78bfa" strokeOpacity=".6" strokeWidth="1.5"><path d="M44 18C70 18 70 32 92 32" /><path d="M44 46C70 46 70 32 92 32" /><path d="M140 32C156 32 156 16 166 16" /><path d="M140 32C156 32 156 48 166 48" /></g>
                  <g fill="#1b1c21" stroke="rgba(255,255,255,.2)"><rect x="4" y="9" width="40" height="18" rx="5" /><rect x="4" y="37" width="40" height="18" rx="5" /><rect x="92" y="23" width="48" height="18" rx="5" stroke="#a78bfa" /><rect x="166" y="7" width="30" height="18" rx="5" /><rect x="166" y="39" width="30" height="18" rx="5" /></g>
                </svg>
              }
            />
          </div>

          {mode === "basic" ? (
            <section className={`${CARD} p-5 flex items-center justify-between gap-4`}>
              <div>
                <p className="text-[13.5px] font-semibold text-white">Começar com textos prontos</p>
                <p className="text-[12.5px] text-zinc-500 mt-0.5">Já vem com boas-vindas, Pix, entrega, recuperação e renovação para você ajustar.</p>
              </div>
              <button type="button" role="switch" aria-checked={template} aria-label="Começar com textos prontos" onClick={() => setTemplate(!template)} className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${template ? "bg-[#3984FF]" : "bg-zinc-700"}`}>
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${template ? "translate-x-5" : ""}`} />
              </button>
            </section>
          ) : (
            <Callout>O fluxo começa com o bloco <b>Início</b> (quando o cliente manda /start). Clique nos blocos da esquerda para adicionar e ligue um no outro.</Callout>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap border-t border-white/[0.08] pt-4">
            <span className="text-[12.5px] text-zinc-500">Depois de criar, ligue o fluxo a um bot em <b className="text-zinc-300">Ligar bots</b>. Nada muda no bot até você publicar.</span>
            <div className="flex gap-2">
              <Link href="/seller/fluxos" className={BTN_GHOST}>Cancelar</Link>
              <button type="button" className={BTN_PRI} disabled={!name.trim() || pending || full || !available} onClick={create}>
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Criar fluxo
              </button>
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-3.5">
          <div className={`${CARD} p-5 space-y-2`}>
            <h3 className="text-[14.5px] font-semibold text-white">O que é um fluxo?</h3>
            <p className="text-[13px] text-zinc-400 leading-relaxed">É o roteiro que o bot segue quando alguém manda /start: as mensagens, os planos, o Pix, a entrega e o que acontece se a pessoa não pagar.</p>
          </div>
          <div className={`${CARD} p-5 space-y-2.5`}>
            <h3 className="text-[14.5px] font-semibold text-white">Qual escolher?</h3>
            <p className="text-[13px] text-zinc-400 leading-relaxed"><b className="text-[#60a5fa]">Básico</b> é o caminho mais rápido para vender: tudo em etapas, sem desenhar nada.</p>
            <p className="text-[13px] text-zinc-400 leading-relaxed"><b className="text-violet-300">Avançado</b> é para caminhos diferentes, como uma mensagem se o cliente responder e outra se ele ficar 1 hora sem responder.</p>
            <p className="text-[12.5px] text-zinc-500">Dá para ter os dois tipos ao mesmo tempo, cada um ligado a bots diferentes.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
