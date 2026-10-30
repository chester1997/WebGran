"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Download, X, Share } from "lucide-react";
import { setupForegroundNotificationSoundListener } from "@/lib/sound/notification-sound";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PwaRegisterAndInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  useEffect(() => {
    // 0. Ativar listener de som em primeiro plano para notificações push
    setupForegroundNotificationSoundListener();

    // 1. Safe Service Worker registration (com verificação imediata de readyState)
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const registerServiceWorker = () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            // Force immediate check for SW update (bypasses 24h stale window)
            reg.update().catch(() => {});

            // Check for updates periodically
            reg.addEventListener("updatefound", () => {
              const installingWorker = reg.installing;
              if (installingWorker) {
                installingWorker.addEventListener("statechange", () => {
                  if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                    console.log("[PWA] Nova versão disponível. O service worker foi atualizado.");
                  }
                });
              }
            });

            // Sincroniza silenciosamente a assinatura push com o usuário atual se a permissão já foi concedida
            if ("Notification" in window && Notification.permission === "granted" && "pushManager" in reg) {
              reg.pushManager.getSubscription().then((sub) => {
                if (sub) {
                  try {
                    const subJson = sub.toJSON();
                    const rawKey = sub.getKey ? sub.getKey("p256dh") : null;
                    const rawAuth = sub.getKey ? sub.getKey("auth") : null;
                    const p256dh = subJson.keys?.p256dh || (rawKey ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawKey)))) : "");
                    const auth = subJson.keys?.auth || (rawAuth ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth)))) : "");
                    if (p256dh && auth) {
                      fetch("/api/seller/push/subscribe", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          endpoint: sub.endpoint,
                          keys: { p256dh, auth },
                          userAgent: window.navigator.userAgent,
                        }),
                      }).catch(() => {});
                    }
                  } catch {
                    // Ignora falhas de auto-sincronização
                  }
                }
              }).catch(() => {});
            }
          })
          .catch((err) => {
            console.warn("[PWA] Falha ao registrar Service Worker:", err);
          });
      };

      if (document.readyState === "complete" || document.readyState === "interactive") {
        registerServiceWorker();
      } else {
        window.addEventListener("load", registerServiceWorker, { once: true });
      }
    }

    // 2. Detect iOS / iPadOS Safari (standalone mode check)
    if (typeof window !== "undefined") {
      const ua = window.navigator.userAgent;
      const isAppleMobile = /iPhone|iPad|iPod/.test(ua);
      const isStandalone = (window.navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
      
      if (isAppleMobile && !isStandalone) {
        setIsIos(true);
      }
    }

    // 3. Listen for Chromium/Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const installEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(installEvent);

      // Check if user dismissed recently (within 7 days)
      const dismissedAt = localStorage.getItem("webgran_pwa_dismissed_at");
      if (dismissedAt) {
        const diffMs = Date.now() - parseInt(dismissedAt, 10);
        if (diffMs < 7 * 24 * 60 * 60 * 1000) {
          return;
        }
      }

      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      localStorage.removeItem("webgran_pwa_dismissed_at");
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.warn("[PWA] Erro ao disparar instalação:", err);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("webgran_pwa_dismissed_at", Date.now().toString());
  };

  // Only render if there is an active deferred prompt to install
  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div 
      role="dialog" 
      aria-label="Instalar aplicativo WebGran"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 max-w-sm w-full bg-[#16161a]/95 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl text-white animate-in slide-in-from-bottom duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#121214] border border-white/10 shrink-0 shadow-md">
          <Image
            src="/icons/icon-192x192.png"
            unoptimized
            alt="WebGran Logo"
            width={48}
            height={48}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-white tracking-tight">Instalar WebGran</h4>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dispensar aviso de instalação"
              className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-zinc-300 mt-1 leading-snug">
            Adicione o WebGran à sua tela inicial para acesso rápido e melhor performance.
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex-1 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-semibold text-xs py-2 px-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar app</span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs text-zinc-400 hover:text-white py-2 px-3 rounded-xl transition-colors cursor-pointer"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
