"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTelegram } from "@/app/miniapp/Providers";

export function StartAppResolver({ storeSlug }: { storeSlug: string }) {
  const router = useRouter();
  const { ready, user } = useTelegram();
  const hasProcessed = useRef(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || hasProcessed.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wa = (window as any).Telegram?.WebApp;
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(
      window.location.hash.startsWith("#") ? window.location.hash.slice(1) : ""
    );

    const rawStartParam =
      wa?.initDataUnsafe?.start_param ||
      searchParams.get("tgWebAppStartParam") ||
      searchParams.get("start_param") ||
      hashParams.get("tgWebAppStartParam") ||
      hashParams.get("start_param");

    let accessId = "";

    if (rawStartParam && (rawStartParam.startsWith("access_") || rawStartParam.startsWith("access="))) {
      accessId = rawStartParam.replace(/^access[=_]/, "");
    } else if (searchParams.get("access")) {
      accessId = searchParams.get("access") || "";
    } else if (hashParams.get("access")) {
      accessId = hashParams.get("access") || "";
    }

    if (!accessId) {
      return;
    }

    hasProcessed.current = true;

    const resolveAccess = async () => {
      try {
        const initData = wa?.initData || searchParams.get("tgWebAppData") || "";
        const res = await fetch("/api/telegram/access/open", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-telegram-init-data": initData,
            "x-store-slug": storeSlug,
          },
          body: JSON.stringify({ accessId, storeSlug }),
        });

        const data = await res.json();

        if (res.status === 403 || (data && !data.success && data.error?.includes("não autorizado"))) {
          setAccessError("🔒 ACESSO RESTRITO — Este link pertence a outro usuário.");
          return;
        }

        if (data.success && data.destinationUrl) {
          try {
            const urlObj = new URL(data.destinationUrl, window.location.origin);
            const targetPath = urlObj.pathname + urlObj.search;
            router.replace(targetPath);
          } catch (_e) {
            router.replace(data.destinationUrl);
          }
        } else if (data.canRepurchase && data.productSlug) {
          router.replace(`/miniapp/${storeSlug}/product/${data.productSlug}`);
        } else {
          router.replace(`/miniapp/${storeSlug}/accesses`);
        }
      } catch (err) {
        console.error("[StartAppResolver] Erro ao resolver startapp:", err);
      }
    };

    resolveAccess();
  }, [storeSlug, router, ready, user]);

  if (accessError) {
    return (
      <div className="fixed inset-0 bg-zinc-950/95 text-white flex flex-col items-center justify-center p-6 z-50 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shadow-lg shadow-red-500/20">
          <span className="text-3xl">🔒</span>
        </div>
        <h2 className="text-xl font-bold text-red-400">Acesso Restrito</h2>
        <p className="text-sm text-zinc-400 max-w-xs">{accessError}</p>
        <button
          onClick={() => setAccessError(null)}
          className="mt-4 px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          Voltar para a Loja
        </button>
      </div>
    );
  }

  return null;
}
