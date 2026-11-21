"use client";

import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Unlink,
  X,
} from "lucide-react";
import { ConfirmDialog, PageHeader } from "@/components/seller-v2";

type GatewayId = "pushinpay" | "syncpay" | "mercado_pago" | "misticpay";
type Method = "pix" | "card" | "boleto";
type Feedback = { provider: GatewayId; type: "success" | "error" | "info"; text: string };

interface ConnectionInfo {
  id: string;
  status: string;
  providerEmail: string | null;
  providerUserId: string | null;
  updatedAt: string | null;
}

interface SimpleConnection {
  id: string | null;
  status: string;
  updatedAt: string | null;
}

interface PushinPayData {
  id: string | null;
  status: string;
  tokenMasked?: string | null;
  hasCredentials?: boolean;
  webhookUrl?: string | null;
  updatedAt: string | null;
}

type Control = { allowNewConnections: boolean; allowNewPayments: boolean };

interface Props {
  connection: ConnectionInfo | null;
  syncPayConnection?: SimpleConnection | null;
  pushinPayConnection?: SimpleConnection | null;
  adminControls?: { pushinpay?: Control; mercadopago?: Control; syncpay?: Control };
}

/* ---------------- Marcas ---------------- */

/** Logos oficiais (public/gateways). A MisticPay ainda não tem logo e usa a marca desenhada. */
const LOGOS: Partial<Record<GatewayId, { src: string; pad: boolean }>> = {
  pushinpay: { src: "/gateways/pushinpay.png", pad: false },
  syncpay: { src: "/gateways/syncpay.png", pad: true },
  mercado_pago: { src: "/gateways/mercadopago.png", pad: true },
};

function BrandMark({ id }: { id: GatewayId }) {
  const base = "w-12 h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden";
  const logo = LOGOS[id];
  if (logo)
    return (
      <div className={`${base} bg-white`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo.src} alt="" className={logo.pad ? "w-[78%] h-[78%] object-contain" : "w-full h-full object-cover"} />
      </div>
    );
  return (
    <div className={`${base} bg-[#2a2a2e]`}>
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#a1a1aa" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 18L10 6l2 6" />
        <path d="M12 12l2-6 5 12" />
      </svg>
    </div>
  );
}

function MethodIcon({ m }: { m: Method }) {
  if (m === "pix")
    return (
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="#32bcad">
        <rect x="5.6" y="0.6" width="4.8" height="4.8" rx="1.2" transform="rotate(45 8 3)" />
        <rect x="5.6" y="10.6" width="4.8" height="4.8" rx="1.2" transform="rotate(45 8 13)" />
        <rect x="0.6" y="5.6" width="4.8" height="4.8" rx="1.2" transform="rotate(45 3 8)" />
        <rect x="10.6" y="5.6" width="4.8" height="4.8" rx="1.2" transform="rotate(45 13 8)" />
      </svg>
    );
  if (m === "card")
    return <span className="w-5 h-3.5 rounded-[3px] bg-gradient-to-br from-[#f4d27a] to-[#c99a3b] inline-block" />;
  return (
    <svg viewBox="0 0 20 14" className="w-5 h-3.5" fill="#e4e4e7">
      {[0, 2, 3.5, 6, 7.5, 9, 11.5, 13, 15.5, 17, 18.5].map((x, i) => (
        <rect key={i} x={x} y="0" width={i % 3 === 0 ? 1.4 : 0.8} height="14" />
      ))}
    </svg>
  );
}

const METHOD_LABEL: Record<Method, string> = { pix: "Pix", card: "Cartão de crédito", boleto: "Boleto" };

const GATEWAYS: { id: GatewayId; name: string; domain: string; site: string; methods: Method[] }[] = [
  { id: "pushinpay", name: "Pushin Pay", domain: "pushinpay.com.br", site: "https://pushinpay.com.br", methods: ["pix", "boleto"] },
  { id: "syncpay", name: "SyncPay", domain: "syncpayments.com.br", site: "https://syncpayments.com.br", methods: ["pix", "card"] },
  { id: "mercado_pago", name: "Mercado Pago", domain: "mercadopago.com.br", site: "https://www.mercadopago.com.br", methods: ["pix", "card", "boleto"] },
  { id: "misticpay", name: "MisticPay", domain: "misticpay.com", site: "https://misticpay.com", methods: ["pix", "card", "boleto"] },
];

/** Gateways que ainda não estão liberados para os lojistas. */
const COMING_SOON = new Set<GatewayId>(["syncpay", "misticpay"]);

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

/* ---------------- Página ---------------- */

export default function RecebimentosClientV2({ connection, pushinPayConnection, adminControls }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const successParam = searchParams.get("success");
  const errorParam = searchParams.get("error");

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<"mercado_pago" | "pushinpay" | null>(null);

  // PushinPay
  const [ppOpen, setPpOpen] = useState(false);
  const [ppToken, setPpToken] = useState("");
  const [ppData, setPpData] = useState<PushinPayData | null>(pushinPayConnection || null);
  const [copied, setCopied] = useState(false);

  const isMpActive = connection?.status === "active";
  const isPpActive = ppData?.status === "active" || pushinPayConnection?.status === "active";

  const say = (provider: GatewayId, type: Feedback["type"], text: string) => setFeedback({ provider, type, text });

  const connectMp = async () => {
    setBusy("mp-connect");
    setFeedback(null);
    try {
      const res = await fetch("/api/payments/mercadopago/connect", { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Erro ao iniciar conexão com Mercado Pago.");
      window.location.href = data.url;
    } catch (err) {
      say("mercado_pago", "error", err instanceof Error ? err.message : "Erro inesperado.");
      setBusy(null);
    }
  };

  const openPushinPay = async () => {
    setPpToken("");
    setPpOpen(true);
    try {
      const res = await fetch("/api/seller/payments/pushinpay");
      if (res.ok) {
        const d = await res.json();
        setPpData({ id: d.connectionId, status: d.status, tokenMasked: d.tokenMasked, hasCredentials: d.hasCredentials, webhookUrl: d.webhookUrl, updatedAt: d.updatedAt });
      }
    } catch {
      // segue com o que já temos
    }
  };

  const savePushinPay = async () => {
    if (!ppToken.trim() && !ppData?.hasCredentials) return;
    setBusy("pp-save");
    try {
      const res = await fetch("/api/seller/payments/pushinpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: ppToken.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao conectar PushinPay.");
      say("pushinpay", "success", "Pushin Pay conectada e ativada.");
      setPpOpen(false);
      setPpToken("");
      router.refresh();
    } catch (err) {
      say("pushinpay", "error", err instanceof Error ? err.message : "Erro inesperado.");
      setPpOpen(false);
    } finally {
      setBusy(null);
    }
  };

  const testConnection = async (provider: "mercado_pago" | "pushinpay") => {
    setBusy(`test-${provider}`);
    try {
      const res =
        provider === "mercado_pago"
          ? await fetch("/api/seller/payments/mercadopago/test", { method: "POST" })
          : await fetch("/api/seller/payments/pushinpay", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "test" }),
            });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Falha na validação.");
      say(provider, "success", data.message || "Conexão ativa e funcionando.");
    } catch (err) {
      say(provider, "error", err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (!disconnecting) return;
    const provider = disconnecting;
    setBusy("disconnect");
    try {
      const res = await fetch(provider === "mercado_pago" ? "/api/payments/mercadopago/disconnect" : "/api/seller/payments/pushinpay", {
        method: provider === "mercado_pago" ? "POST" : "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao desconectar.");
      say(provider, "info", "Gateway desconectado.");
      setDisconnecting(null);
      router.refresh();
    } catch (err) {
      say(provider, "error", err instanceof Error ? err.message : "Erro inesperado.");
      setDisconnecting(null);
    } finally {
      setBusy(null);
    }
  };

  const copyWebhook = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderCard = (g: (typeof GATEWAYS)[number]) => {
    const soon = COMING_SOON.has(g.id);
    const active = g.id === "mercado_pago" ? isMpActive : g.id === "pushinpay" ? isPpActive : false;
    const ctl = g.id === "mercado_pago" ? adminControls?.mercadopago : g.id === "pushinpay" ? adminControls?.pushinpay : undefined;
    const blockedNew = ctl?.allowNewConnections === false && !active;
    const fb = feedback?.provider === g.id ? feedback : null;

    let notice: ReactNode = null;
    if (!soon && ctl?.allowNewPayments === false)
      notice = <Notice tone="warn" icon={<Lock className="w-3.5 h-3.5" />}>Novos pagamentos por aqui estão pausados pela plataforma.</Notice>;
    else if (blockedNew)
      notice = <Notice tone="muted" icon={<Lock className="w-3.5 h-3.5" />}>Novas conexões estão suspensas no momento.</Notice>;

    return (
      <div
        key={g.id}
        className={`rounded-[18px] border bg-[#141416] flex flex-col transition-colors ${
          soon ? "border-white/[0.08] opacity-60" : active ? "border-[#a6e22e]/35" : "border-white/[0.09] hover:border-white/[0.16]"
        }`}
      >
        <div className="p-5 flex flex-col gap-4 flex-1">
          <div className="flex items-start gap-3.5">
            <div className={soon ? "grayscale" : ""}>
              <BrandMark id={g.id} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[17px] font-bold text-white tracking-tight">{g.name}</h2>
                {soon && <span className="px-2 py-0.5 rounded-full border border-white/20 text-[11px] font-semibold text-zinc-300">Em breve</span>}
                {active && (
                  <span className="px-2 py-0.5 rounded-full bg-[#a6e22e]/10 border border-[#a6e22e]/30 text-[11px] font-semibold text-[#b8f04a] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#b8f04a]" />
                    Conectado
                  </span>
                )}
              </div>
              <p className="text-[13.5px] text-zinc-400 mt-0.5">{g.domain}</p>
            </div>
            <a
              href={g.site}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir site da ${g.name}`}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <Globe className="w-5 h-5" />
            </a>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11.5px] font-semibold tracking-wider text-zinc-400 mr-1">ACEITA</span>
            {g.methods.map((m) => (
              <span key={m} className="h-8 px-3 rounded-full border border-white/[0.1] bg-white/[0.02] flex items-center gap-2 text-[13px] font-medium text-zinc-100">
                <MethodIcon m={m} />
                {METHOD_LABEL[m]}
              </span>
            ))}
          </div>

          {active && g.id === "mercado_pago" && connection?.providerEmail && (
            <p className="text-[12.5px] text-zinc-400">
              Conta: <span className="text-zinc-200">{connection.providerEmail}</span>
            </p>
          )}
          {active && (
            <p className="text-[12px] text-zinc-500">
              Atualizado em {formatDate(g.id === "mercado_pago" ? connection?.updatedAt ?? null : ppData?.updatedAt || pushinPayConnection?.updatedAt || null)}
            </p>
          )}

          {notice}
          {fb && (
            <Notice
              tone={fb.type === "success" ? "ok" : fb.type === "error" ? "err" : "info"}
              icon={fb.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : fb.type === "error" ? <AlertCircle className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
            >
              {fb.text}
            </Notice>
          )}
        </div>

        <div className="border-t border-white/[0.08] px-5 py-3.5 flex items-center gap-2 min-h-[64px]">
          {soon ? (
            <span className="text-[13.5px] text-zinc-400">Integração em construção.</span>
          ) : active ? (
            <>
              <button
                type="button"
                onClick={() => testConnection(g.id as "mercado_pago" | "pushinpay")}
                disabled={busy === `test-${g.id}`}
                className="h-9 px-3.5 rounded-xl border border-white/[0.1] text-[13px] font-semibold text-zinc-200 hover:bg-white/[0.05] flex items-center gap-1.5 disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${busy === `test-${g.id}` ? "animate-spin" : ""}`} />
                {busy === `test-${g.id}` ? "Testando…" : "Testar conexão"}
              </button>
              <div className="ml-auto flex items-center gap-1.5">
                {g.id === "pushinpay" && (
                  <button type="button" onClick={openPushinPay} aria-label="Configurar Pushin Pay" className="h-9 w-9 rounded-xl border border-white/[0.1] text-zinc-300 hover:bg-white/[0.05] flex items-center justify-center">
                    <Settings className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDisconnecting(g.id as "mercado_pago" | "pushinpay")}
                  aria-label={`Desconectar ${g.name}`}
                  className="h-9 w-9 rounded-xl border border-red-500/25 bg-red-500/[0.06] text-red-400 hover:bg-red-500/15 flex items-center justify-center"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              <a href={g.site} target="_blank" rel="noopener noreferrer" className="text-[14px] font-semibold text-zinc-100 hover:text-white flex items-center gap-1.5">
                Criar conta
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
              </a>
              <button
                type="button"
                onClick={g.id === "mercado_pago" ? connectMp : openPushinPay}
                disabled={blockedNew || busy === "mp-connect"}
                className="ml-auto h-10 px-4 rounded-xl bg-[#a6e22e] hover:bg-[#b8f04a] text-[#0b0b0c] text-[14px] font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy === "mp-connect" && g.id === "mercado_pago" ? <Loader2 className="w-4 h-4 animate-spin" /> : blockedNew ? <Lock className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                Conectar
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto pb-16 flex flex-col gap-6">
      <PageHeader
        title="Gateways de recebimento"
        badge={
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[11px] font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            Criptografado
          </span>
        }
        subtitle="Conecte o gateway que vai receber os pagamentos da sua loja."
      />

      {successParam && <Notice tone="ok" icon={<CheckCircle2 className="w-4 h-4" />}>Sua conta foi conectada e ativada.</Notice>}
      {errorParam && <Notice tone="err" icon={<AlertCircle className="w-4 h-4" />}>{errorParam}</Notice>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{GATEWAYS.map(renderCard)}</div>

      {/* Configurar Pushin Pay */}
      {ppOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="fixed inset-0 -z-10" onClick={() => busy !== "pp-save" && setPpOpen(false)} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              savePushinPay();
            }}
            autoComplete="off"
            className="relative w-full max-w-md bg-[#0e0e10] border border-[#26262a] rounded-2xl p-6 flex flex-col gap-4 shadow-2xl"
          >
            <button type="button" onClick={() => setPpOpen(false)} aria-label="Fechar" className="absolute right-4 top-4 p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06]">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <BrandMark id="pushinpay" />
              <div>
                <h3 className="text-[16px] font-bold text-white">Conectar Pushin Pay</h3>
                <p className="text-[12.5px] text-zinc-400">Cole o token de API da sua conta.</p>
              </div>
            </div>

            {ppData?.tokenMasked && (
              <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[12.5px] flex items-center justify-between">
                <span className="text-zinc-400">Token salvo</span>
                <span className="font-mono text-[#b8f04a]">{ppData.tokenMasked}</span>
              </div>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-zinc-300">Token de API</span>
              <input
                type="password"
                name="pushinpay_api_token"
                autoComplete="new-password"
                value={ppToken}
                onChange={(e) => setPpToken(e.target.value)}
                placeholder={ppData?.hasCredentials ? "Deixe em branco para manter o atual" : "Cole aqui o token da Pushin Pay"}
                className="h-11 rounded-xl bg-[#141416] border border-white/[0.1] px-3.5 text-[13px] text-white font-mono placeholder:text-zinc-500 placeholder:font-sans focus:outline-none focus:border-[#a6e22e]/60"
              />
            </label>

            {ppData?.webhookUrl && (
              <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="font-semibold text-zinc-300">URL do webhook</span>
                  <button type="button" onClick={() => copyWebhook(ppData.webhookUrl!)} className="text-[#b8f04a] flex items-center gap-1">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </div>
                <p className="font-mono text-[11px] text-zinc-400 break-all">{ppData.webhookUrl}</p>
              </div>
            )}

            <p className="text-[12px] text-zinc-500 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              O token é validado na Pushin Pay e guardado criptografado.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e1e22]">
              <button type="button" onClick={() => setPpOpen(false)} className="h-10 px-4 rounded-xl text-[13.5px] font-semibold text-zinc-300 hover:bg-white/[0.05]">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy === "pp-save" || (!ppData?.hasCredentials && !ppToken.trim())}
                className="h-10 px-4 rounded-xl bg-[#a6e22e] hover:bg-[#b8f04a] text-[#0b0b0c] text-[13.5px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                {busy === "pp-save" && <Loader2 className="w-4 h-4 animate-spin" />}
                {busy === "pp-save" ? "Validando…" : "Salvar e ativar"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!disconnecting}
        onClose={() => setDisconnecting(null)}
        onConfirm={disconnect}
        isLoading={busy === "disconnect"}
        title={`Desconectar ${disconnecting === "mercado_pago" ? "Mercado Pago" : "Pushin Pay"}?`}
        description="As próximas vendas não vão usar mais este gateway até você conectar de novo. Seus pedidos e o histórico continuam salvos."
        confirmLabel="Desconectar"
      />
    </div>
  );
}

function Notice({ tone, icon, children }: { tone: "ok" | "err" | "info" | "warn" | "muted"; icon: ReactNode; children: ReactNode }) {
  const cls = {
    ok: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
    err: "bg-red-500/10 border-red-500/20 text-red-300",
    info: "bg-blue-500/10 border-blue-500/20 text-blue-300",
    warn: "bg-amber-500/10 border-amber-500/20 text-amber-300",
    muted: "bg-white/[0.04] border-white/[0.08] text-zinc-300",
  }[tone];
  return (
    <div className={`px-3 py-2.5 rounded-xl border text-[12.5px] font-medium flex items-center gap-2 ${cls}`}>
      <span className="shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
