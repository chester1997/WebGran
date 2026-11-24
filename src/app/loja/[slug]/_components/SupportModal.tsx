"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, LifeBuoy, X } from "lucide-react";
import { parseSupportConfig } from "@/lib/support/support-helper";
import { openTicketAction } from "../actions";
import { BTN_GHOST, BTN_PRIMARY, ErrorBox, INPUT, Label } from "./ui";
import type { ShellCustomer, ShellStore } from "./StoreShell";

const SUBJECTS = ["Não recebi meu acesso", "Problema no pagamento", "O vídeo não carrega", "Dúvida sobre um produto", "Outro assunto"];

export function SupportModal({
  store,
  customer,
  onClose,
  orderId,
}: {
  store: ShellStore;
  customer: ShellCustomer | null;
  onClose: () => void;
  orderId?: string | null;
}) {
  const direct = parseSupportConfig(store.supportType, store.supportValue);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState("");
  const [via, setVia] = useState(customer?.whatsapp ? "whatsapp" : customer?.telegram ? "telegram" : "email");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await openTicketAction(store.slug, { subject, message, contactVia: via, orderId: orderId || null });
      if (!res.ok) setError(res.error);
      else {
        setSent(true);
        router.refresh();
      }
    });

  const viaOptions = [
    customer?.whatsapp ? { k: "whatsapp", l: "WhatsApp" } : null,
    customer?.telegram ? { k: "telegram", l: "Telegram" } : null,
    { k: "email", l: "E-mail" },
  ].filter(Boolean) as { k: string; l: string }[];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Suporte">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-[460px] max-h-[92dvh] overflow-y-auto rounded-t-[20px] sm:rounded-[20px] border border-white/[0.08] bg-[#111113] shadow-2xl">
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <span className="w-10 h-10 rounded-[11px] bg-[#3b82f6]/15 text-[#7fb0ff] flex items-center justify-center">
            <LifeBuoy className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold">Suporte da loja</h2>
            <p className="text-[12.5px] text-zinc-500">A loja responde pelo contato que você escolher.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="w-9 h-9 rounded-[10px] flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06]">
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {sent ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-[#3b82f6] mx-auto" />
              <p className="text-[16px] font-semibold">Pedido de suporte enviado</p>
              <p className="text-[13.5px] text-zinc-400">A loja já recebeu sua mensagem. Você pode acompanhar em Minha conta → Suporte.</p>
              <button type="button" className={`${BTN_PRIMARY} w-full mt-2`} onClick={onClose}>
                Fechar
              </button>
            </div>
          ) : customer ? (
            <>
              <label className="block">
                <Label>Assunto</Label>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className={INPUT}>
                  {SUBJECTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <Label hint={`${message.length}/2000`}>Mensagem</Label>
                <textarea
                  value={message}
                  maxLength={2000}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Conte o que aconteceu. Se for sobre um pedido, diga qual produto."
                  className={`${INPUT} h-auto py-3 resize-none`}
                />
              </label>
              <div>
                <Label>Responder por</Label>
                <div className="flex gap-2">
                  {viaOptions.map((o) => (
                    <button
                      key={o.k}
                      type="button"
                      onClick={() => setVia(o.k)}
                      aria-pressed={via === o.k}
                      className={`flex-1 h-10 rounded-[10px] text-[13px] font-medium border transition-colors ${
                        via === o.k ? "border-[#3b82f6] bg-[#3b82f6]/12 text-white" : "border-white/[0.08] text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
              {error && <ErrorBox>{error}</ErrorBox>}
              <button type="button" className={`${BTN_PRIMARY} w-full`} disabled={pending} onClick={submit}>
                {pending ? "Enviando..." : "Enviar para a loja"}
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-[13.5px] text-zinc-400">Entre na sua conta para abrir um pedido de suporte e acompanhar a resposta.</p>
              <Link href={`/loja/${store.slug}/entrar`} className={`${BTN_PRIMARY} w-full`} onClick={onClose}>
                Entrar na minha conta
              </Link>
            </div>
          )}

          {!sent && direct.isValid && direct.url && (
            <a href={direct.url} target="_blank" rel="noopener noreferrer" className={`${BTN_GHOST} w-full`}>
              Falar direto no {direct.type === "whatsapp" ? "WhatsApp" : direct.type === "telegram" ? "Telegram" : "canal da loja"}
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
