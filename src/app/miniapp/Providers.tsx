"use client";

import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { CartProvider } from "@/components/miniapp/CartProvider";

interface TelegramContextType {
  webApp: unknown;
  user: unknown;
  ready: boolean;
  error: string | null;
}

const TelegramContext = createContext<TelegramContextType>({
  webApp: null,
  user: null,
  ready: false,
  error: null,
});

export const useTelegram = () => useContext(TelegramContext);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeUser(clientUser: any, backendUser: any) {
  if (!clientUser && !backendUser) return null;

  const rawId = 
    clientUser?.id || 
    clientUser?.telegramId || 
    backendUser?.telegramUserId || 
    backendUser?.telegramId || 
    backendUser?.id;
    
  const id = rawId ? String(rawId) : null;

  const firstName = 
    clientUser?.first_name || 
    clientUser?.firstName || 
    backendUser?.firstName || 
    backendUser?.first_name || 
    "";

  const lastName = 
    clientUser?.last_name || 
    clientUser?.lastName || 
    backendUser?.lastName || 
    backendUser?.last_name || 
    null;

  const username = 
    clientUser?.username || 
    backendUser?.username || 
    null;

  const photoUrl = 
    clientUser?.photo_url || 
    clientUser?.photoUrl || 
    backendUser?.photoUrl || 
    backendUser?.photo_url || 
    null;

  if (!id && !firstName) return null;

  return {
    id,
    firstName,
    lastName,
    username,
    photoUrl,
    // Legacy aliases for backward compatibility
    first_name: firstName,
    last_name: lastName || undefined,
    photo_url: photoUrl || undefined,
    telegramId: id,
    telegramUserId: id,
  };
}

function getFallbackInitData(): string {
  if (typeof window === "undefined") return "";
  try {
    const rawHash = window.location.hash || "";
    const rawSearch = window.location.search || "";
    const sources = [rawHash, rawSearch];

    for (const src of sources) {
      if (!src) continue;
      const clean = src.startsWith("#") || src.startsWith("?") ? src.slice(1) : src;
      if (!clean) continue;

      // 1. Look for tgWebAppData= in hash/search
      const tgIndex = clean.indexOf("tgWebAppData=");
      if (tgIndex !== -1) {
        let rawVal = clean.slice(tgIndex + "tgWebAppData=".length);
        const nextTgParam = rawVal.search(/&tgWebApp[A-Z]/i);
        if (nextTgParam !== -1) {
          rawVal = rawVal.slice(0, nextTgParam);
        }

        if (rawVal.includes("%3D") || rawVal.includes("%26") || rawVal.includes("%7B")) {
          try {
            rawVal = decodeURIComponent(rawVal);
          } catch (_e) {}
        }

        if (rawVal.includes("hash=") || rawVal.includes("user=") || rawVal.includes("query_id=")) {
          return rawVal;
        }
      }

      // 2. Direct initData string in hash/search
      if (clean.includes("hash=") && (clean.includes("user=") || clean.includes("query_id="))) {
        const cleanInitData = clean.replace(/&tgWebApp[A-Za-z0-9]+=[^&]*/g, "");
        return cleanInitData;
      }
    }
  } catch (_e) {}
  return "";
}

export function MiniAppProviders({ children, storeSlug }: { children: React.ReactNode, storeSlug: string }) {
  const [webApp, setWebApp] = useState<unknown>(null);
  const [user, setUser] = useState<unknown>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem(`webgran_tg_user_${storeSlug}`) || localStorage.getItem(`webgran_tg_user_${storeSlug}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && (parsed.id || parsed.firstName || parsed.first_name)) {
            return parsed;
          }
        }
      } catch (_e) {}
    }
    return null;
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveUser = (userObj: any) => {
    if (!userObj) return;
    setUser(userObj);
    if (typeof window !== "undefined") {
      try {
        const json = JSON.stringify(userObj);
        sessionStorage.setItem(`webgran_tg_user_${storeSlug}`, json);
        localStorage.setItem(`webgran_tg_user_${storeSlug}`, json);
      } catch (_e) {}
    }
  };

  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined") return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyTheme = (waInstance?: any) => {
      const root = document.documentElement;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wa = waInstance || (window as any).Telegram?.WebApp;
      const savedTheme = localStorage.getItem("miniapp-theme");

      let isLight = false;
      if (savedTheme) {
        isLight = savedTheme === "light";
      } else if (wa?.colorScheme) {
        isLight = wa.colorScheme === "light";
      } else if (wa?.themeParams?.bg_color) {
        const hex = wa.themeParams.bg_color.replace("#", "");
        if (hex.length === 6) {
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          isLight = (r * 299 + g * 587 + b * 114) / 1000 >= 128;
        }
      } else if (typeof window !== "undefined" && window.matchMedia) {
        isLight = window.matchMedia("(prefers-color-scheme: light)").matches;
      }

      if (isLight) {
        root.classList.add("light");
        root.classList.remove("dark");
      } else {
        root.classList.add("dark");
        root.classList.remove("light");
      }

      if (wa?.themeParams) {
        if (wa.themeParams.bg_color) root.style.setProperty("--tg-theme-bg-color", wa.themeParams.bg_color);
        if (wa.themeParams.text_color) root.style.setProperty("--tg-theme-text-color", wa.themeParams.text_color);
        if (wa.themeParams.hint_color) root.style.setProperty("--tg-theme-hint-color", wa.themeParams.hint_color);
        if (wa.themeParams.link_color) root.style.setProperty("--tg-theme-link-color", wa.themeParams.link_color);
        if (wa.themeParams.button_color) root.style.setProperty("--tg-theme-button-color", wa.themeParams.button_color);
        if (wa.themeParams.button_text_color) root.style.setProperty("--tg-theme-button-text-color", wa.themeParams.button_text_color);
      }
    };

    applyTheme();

    let checkCount = 0;
    const maxChecks = 30; // Try for 3s (30 * 100ms)
    let authSent = false;

    const checkTelegram = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wa = (window as any).Telegram?.WebApp;
      const fallbackInitData = getFallbackInitData();
      const resolvedInitData = (wa?.initData && wa.initData.trim() !== "") ? wa.initData : fallbackInitData;
      const resolvedSource = wa?.initData ? "native" : (fallbackInitData ? "hash/search" : "none");

      if (typeof window !== "undefined") {
        console.log("[Telegram WebApp] disponível:", Boolean(wa));
        console.log("[Telegram WebApp] initData disponível:", Boolean(resolvedInitData));
        console.log("[Telegram WebApp] initDataUnsafe.user disponível:", Boolean(wa?.initDataUnsafe?.user));
      }

      if (wa || resolvedInitData) {
        if (wa) {
          setWebApp(wa);
          try {
            wa.ready();
            if (typeof wa.expand === "function") wa.expand();
          } catch (_e) {}

          applyTheme(wa);
          if (typeof wa.onEvent === "function") {
            wa.onEvent("themeChanged", () => applyTheme(wa));
          }
        }

        // 1. Try native WebApp initDataUnsafe.user
        let tgClientUser = wa?.initDataUnsafe?.user || null;

        // 2. Fallback: Parse user JSON parameter from resolved initData string
        if (!tgClientUser && resolvedInitData) {
          try {
            const params = new URLSearchParams(resolvedInitData);
            const uStr = params.get("user");
            if (uStr) {
              const decoded = uStr.startsWith("%") ? decodeURIComponent(uStr) : uStr;
              tgClientUser = JSON.parse(decoded);
            }
          } catch (_e) {}
        }

        let foundUser = false;

        if (tgClientUser) {
          const initialUser = normalizeUser(tgClientUser, null);
          if (initialUser) {
            saveUser(initialUser);
            foundUser = true;
          }
        }

        setReady(true);

        // 3. Server-side auth request with HMAC verification
        if (resolvedInitData && (!authSent || (wa?.initData && resolvedInitData === wa.initData))) {
          if (resolvedInitData.includes("hash=") || resolvedInitData.includes("user=")) {
            authSent = true;
            fetch("/api/telegram/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ initData: resolvedInitData, storeSlug }),
            })
              .then((res) => {
                console.log("[Telegram WebApp] auth API status:", res.status);
                if (!res.ok) {
                  authSent = false;
                }
                return res.json();
              })
              .then((data) => {
                if (data?.success && data?.user) {
                  authSent = true;
                  const mergedUser = normalizeUser(tgClientUser, data.user);
                  if (mergedUser) saveUser(mergedUser);
                } else {
                  authSent = false;
                }
              })
              .catch(() => {
                authSent = false;
              });
          }
        }

        return foundUser;
      }
      return false;
    };

    if (!checkTelegram()) {
      const interval = setInterval(() => {
        checkCount++;
        const found = checkTelegram();
        if (found || checkCount >= maxChecks) {
          clearInterval(interval);
          if (checkCount >= maxChecks) {
            setReady(true);
            const fallbackInitData = getFallbackInitData();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const wa = (window as any).Telegram?.WebApp;
            const finalInitData = (wa?.initData && wa.initData.trim() !== "") ? wa.initData : fallbackInitData;

            if (finalInitData && !authSent) {
              authSent = true;
              fetch("/api/telegram/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ initData: finalInitData, storeSlug }),
              })
                .then((res) => res.json())
                .then((data) => {
                  if (data?.success && data?.user) {
                    const previewUser = normalizeUser(wa?.initDataUnsafe?.user, data.user);
                    if (previewUser) saveUser(previewUser);
                  }
                })
                .catch(() => {});
            }
          }
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [storeSlug]);

  const telegramContextValue = useMemo(
    () => ({
      webApp,
      user,
      ready,
      error,
    }),
    [webApp, user, ready, error]
  );

  return (
    <TelegramContext.Provider value={telegramContextValue}>
      {/* If error, show a blocking overlay */}
      {error ? (
        <div className="fixed inset-0 bg-red-50 text-red-600 flex items-center justify-center p-4 z-50">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">Acesso Negado</h2>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <CartProvider storeSlug={storeSlug}>{children}</CartProvider>
      )}
    </TelegramContext.Provider>
  );
}
