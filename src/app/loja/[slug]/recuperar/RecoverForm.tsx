"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { forgotPasswordAction } from "../actions";
import { BTN_PRIMARY, CARD, ErrorBox, INPUT, Label } from "../_components/ui";

const VIAS = [
  ["whatsapp", "WhatsApp"],
  ["telegram", "Telegram"],
  ["email", "E-mail"],
] as const;

export function RecoverForm({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [via, setVia] = useState<string>("whatsapp");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      const r = await forgotPasswordAction(slug, email, via);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSent(true);
    });
  };

  return (
    <div className="mx-auto max-w-[440px] px-4 py-10 sm:py-16">
      <div className={`${CARD} p-6 sm:p-7`}>
        {sent ? (
          <div className="text-center py-2">
            <MailCheck className="w-10 h-10 text-[#3b82f6] mx-auto mb-3" />
            <h1 className="text-[20px] font-semibold tracking-tight">Pedido enviado</h1>
            <p className="mt-2 text-[14px] text-zinc-400 leading-relaxed">
              Se esse e-mail tiver conta aqui, a loja vai te mandar um link para criar uma nova senha pelo {VIAS.find((v) => v[0] === via)?.[1]} que você cadastrou. O link vale por 24 horas.
            </p>
            <Link href={`/loja/${slug}/entrar`} className={`${BTN_PRIMARY} mt-6`}>
              Voltar para entrar
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-[22px] font-semibold tracking-tight">Esqueci minha senha</h1>
            <p className="mt-1 text-[13.5px] text-zinc-500">Informe o e-mail da sua conta. A loja te manda um link para criar uma nova senha.</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block">
                <Label>E-mail</Label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} autoComplete="email" required maxLength={120} placeholder="voce@email.com" />
              </label>
              <div>
                <Label>Receber o link por</Label>
                <div className="grid grid-cols-3 p-1 rounded-[8px] bg-black/30 border border-white/[0.08]">
                  {VIAS.map(([k, l]) => (
                    <button key={k} type="button" aria-pressed={via === k} onClick={() => setVia(k)} className={`h-9 rounded-[6px] text-[13px] font-medium transition-colors ${via === k ? "bg-[#26282f] text-white" : "text-zinc-400 hover:text-zinc-200"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {error && <ErrorBox>{error}</ErrorBox>}
              <button type="submit" className={`${BTN_PRIMARY} w-full h-12 text-[15px]`} disabled={pending}>
                {pending ? "Enviando..." : "Pedir link de nova senha"}
              </button>
            </form>
            <Link href={`/loja/${slug}/entrar`} className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] text-zinc-400 hover:text-white">
              <ArrowLeft className="w-4 h-4" /> Voltar para entrar
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
