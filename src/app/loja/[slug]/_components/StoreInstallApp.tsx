"use client";

import { useEffect, useState } from "react";
import { Download, PlusSquare, Share, X } from "lucide-react";
import { Portal } from "@/app/(seller)/seller/loja-web/LojaModal";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const WEEK = 7 * 24 * 60 * 60 * 1000;

function dismissedRecently(key: string) {
  try {
    const at = Number(localStorage.getItem(key) || 0);
    return at > 0 && Date.now() - at < WEEK;
  } catch {
    return false;
  }
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** iPhone/iPad fora de app (Instagram, Facebook...), onde o "Adicionar à Tela de Início" existe. */
function isIosBrowser() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios && !/FBAN|FBAV|Instagram|Line\/|TikTok/i.test(ua);
}

/**
 * App da loja: registra o service worker com escopo só desta loja e oferece a instalação.
 * Android/computador: botão "Instalar" (prompt nativo). iPhone: passo a passo do Compartilhar.
 */
export function StoreInstallApp({ slug, name }: { slug: string; name: string }) {
  const base = `/loja/${slug}`;
  const dismissKey = `wg_store_app_dismissed:${slug}`;
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${base}/sw.js`, { scope: base }).catch((err) => console.warn("[Loja PWA] Service worker não registrado:", err));
    }
    if (isStandalone()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      if (!dismissedRecently(dismissKey)) setMode("android");
    };
    const onInstalled = () => {
      setMode(null);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const t = isIosBrowser() && !dismissedRecently(dismissKey) ? window.setTimeout(() => setMode("ios"), 2500) : undefined;
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (t) window.clearTimeout(t);
    };
  }, [base, dismissKey]);

  const dismiss = () => {
    setMode(null);
    setSteps(false);
    try {
      localStorage.setItem(dismissKey, String(Date.now()));
    } catch {}
  };

  const install = async () => {
    if (mode === "ios") return setSteps(true);
    if (!prompt) return;
    await prompt.prompt().catch(() => {});
    const r = await prompt.userChoice.catch(() => null);
    setPrompt(null);
    if (r?.outcome === "accepted") setMode(null);
  };

  if (!mode) return null;

  return (
    <>
      <div
        role="dialog"
        aria-label={`Instalar o app ${name}`}
        className="fixed z-[45] left-3 right-3 bottom-[calc(72px+env(safe-area-inset-bottom))] lg:left-auto lg:right-6 lg:bottom-6 lg:w-[360px] rounded-[14px] border border-white/[0.09] bg-[#111216]/95 backdrop-blur-xl shadow-[0_18px_40px_-12px_rgba(0,0,0,0.9)] p-3 flex items-center gap-3 animate-[wg-pop_.35s_ease-out]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${base}/app-icon/192`} alt="" width={44} height={44} className="w-11 h-11 rounded-[11px] shrink-0 bg-[#07080a]" />
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold text-white truncate">{name}</p>
          <p className="text-[12px] text-zinc-400 leading-snug">Instale o app e abra seus vídeos direto da tela inicial.</p>
        </div>
        <button
          type="button"
          onClick={install}
          className="shrink-0 h-9 px-3.5 rounded-[9px] bg-[#3b82f6] hover:bg-[#2f74ea] text-white text-[12.5px] font-semibold flex items-center gap-1.5"
        >
          <Download className="w-4 h-4" /> Instalar
        </button>
        <button type="button" onClick={dismiss} aria-label="Agora não" className="shrink-0 -mr-1 w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-200">
          <X className="w-4 h-4" />
        </button>
      </div>

      {steps && (
        <Portal>
          <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setSteps(false)}>
            <div
              role="dialog"
              aria-label="Como instalar no iPhone"
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-[400px] rounded-t-[18px] sm:rounded-[16px] border border-white/[0.08] bg-[#0f1014] p-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
            >
              <div className="flex items-center gap-3 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${base}/app-icon/192`} alt="" width={48} height={48} className="w-12 h-12 rounded-[12px] bg-[#07080a]" />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-white truncate">Instalar {name}</p>
                  <p className="text-[12.5px] text-zinc-500">Leva 10 segundos, no Safari</p>
                </div>
              </div>
              <ol className="space-y-2.5">
                {[
                  { icon: Share, t: <>Toque em <b className="text-white">Compartilhar</b> na barra do Safari</> },
                  { icon: PlusSquare, t: <>Escolha <b className="text-white">Adicionar à Tela de Início</b></> },
                  { icon: Download, t: <>Toque em <b className="text-white">Adicionar</b>. O app aparece com a logo da loja</> },
                ].map((s, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-[11px] bg-white/[0.035] border border-white/[0.05] px-3 py-2.5 text-[13.5px] text-zinc-300">
                    <span className="w-7 h-7 rounded-full bg-[#3b82f6]/15 text-[#7fb0ff] text-[12px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="flex-1">{s.t}</span>
                    <s.icon className="w-[18px] h-[18px] text-[#3b82f6] shrink-0" />
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={dismiss} className="flex-1 h-11 rounded-[10px] border border-white/[0.1] text-[13.5px] font-medium text-zinc-300">
                  Não mostrar de novo
                </button>
                <button type="button" onClick={() => setSteps(false)} className="flex-1 h-11 rounded-[10px] bg-[#3b82f6] text-[13.5px] font-semibold text-white">
                  Entendi
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
