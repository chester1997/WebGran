"use client";

import { useState, useEffect } from "react";
import { Volume2, X, ShoppingBag } from "lucide-react";
import { playCommissionChime, unlockAudioSystem } from "@/lib/sound/notification-sound";

export function SaleNotificationSoundHandler() {
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [saleToast, setSaleToast] = useState<{ title: string; body?: string } | null>(null);

  useEffect(() => {
    const handleAutoplayBlocked = () => {
      setAutoplayBlocked(true);
    };

    const handleSaleReceived = (e: any) => {
      const payload = e?.detail;
      if (payload) {
        setSaleToast({
          title: payload.title || "🛒 Nova venda no WebGran",
          body: payload.body || "Venda confirmada!",
        });
        setTimeout(() => {
          setSaleToast(null);
        }, 5000);
      }
    };

    window.addEventListener("webgran-audio-autoplay-blocked", handleAutoplayBlocked);
    window.addEventListener("webgran-sale-received", handleSaleReceived);

    return () => {
      window.removeEventListener("webgran-audio-autoplay-blocked", handleAutoplayBlocked);
      window.removeEventListener("webgran-sale-received", handleSaleReceived);
    };
  }, []);

  const handleUnlockAndPlay = async () => {
    setAutoplayBlocked(false);
    await unlockAudioSystem();
    await playCommissionChime({ force: true, eventId: `manual-unlock-${Date.now()}` }).catch(() => {});
  };

  return (
    <>
      {/* Toast de Autoplay Bloqueado: Permite à vendedora liberar o áudio com um toque simples */}
      {autoplayBlocked && (
        <div 
          role="alert"
          aria-live="assertive"
          className="fixed bottom-5 right-5 z-[9999] max-w-sm w-full p-4 rounded-2xl bg-[#0F1014] border border-[#3984FF]/40 shadow-2xl text-white flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300"
        >
          <button
            type="button"
            onClick={handleUnlockAndPlay}
            className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#3984FF]/15 border border-[#3984FF]/30 flex items-center justify-center text-[#3984FF] shrink-0 group-hover:scale-105 transition-transform">
              <Volume2 className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white group-hover:text-[#60A5FA] transition-colors">
                Toque para ativar o som de vendas
              </p>
              <p className="text-[11px] text-zinc-400 leading-tight mt-0.5">
                O navegador precisa de um toque para liberar a reprodução sonora.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setAutoplayBlocked(false)}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Toast Visual Discreto de Venda Aprovada na Tela */}
      {saleToast && !autoplayBlocked && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-[9999] max-w-sm w-full p-4 rounded-2xl bg-[#101218] border border-emerald-500/30 shadow-2xl text-white flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{saleToast.title}</p>
              {saleToast.body && (
                <p className="text-[11px] text-zinc-300 truncate mt-0.5">{saleToast.body}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSaleToast(null)}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}

