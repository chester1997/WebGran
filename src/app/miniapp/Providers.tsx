"use client";

import { createContext, useContext, useEffect, useState, useMemo } from "react";
import Script from "next/script";
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

export function MiniAppProviders({ children, storeSlug }: { children: React.ReactNode, storeSlug: string }) {
  const [webApp, setWebApp] = useState<unknown>(null);
  const [user, setUser] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeUser(clientUser: any, backendUser: any) {
  if (!clientUser && !backendUser) return null;

  const rawId = 
    backendUser?.telegramUserId || 
    backendUser?.telegramId || 
    backendUser?.id || 
    clientUser?.id || 
    clientUser?.telegramId;
    
  const id = rawId ? rawId : null;

  const firstName = 
    backendUser?.firstName || 
    backendUser?.first_name || 
    clientUser?.first_name || 
    clientUser?.firstName || 
    "";

  const lastName = 
    backendUser?.lastName || 
    backendUser?.last_name || 
    clientUser?.last_name || 
    clientUser?.lastName || 
    null;

  const username = 
    backendUser?.username || 
    clientUser?.username || 
    null;

  const photoUrl = 
    backendUser?.photoUrl || 
    backendUser?.photo_url || 
    clientUser?.photo_url || 
    clientUser?.photoUrl || 
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
  };
}

    let checkCount = 0;
    const maxChecks = 25; // Try for 2.5s (25 * 100ms)

    const checkTelegram = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wa = (window as any).Telegram?.WebApp;

      if (wa) {
        setWebApp(wa);
        try {
          wa.ready();
          if (typeof wa.expand === 'function') wa.expand();
        } catch (_e) {}

        applyTheme(wa);
        if (typeof wa.onEvent === 'function') {
          wa.onEvent('themeChanged', () => applyTheme(wa));
        }

        const tgClientUser = wa.initDataUnsafe?.user || null;
        if (tgClientUser) {
          const initialUser = normalizeUser(tgClientUser, null);
          if (initialUser) setUser(initialUser);
        }
        setReady(true);

        const initData = wa.initData || "";
        if (initData) {
          fetch("/api/telegram/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData, storeSlug })
          })
            .then((res) => res.json())
            .then((data) => {
              if (data?.success && data?.user) {
                const mergedUser = normalizeUser(tgClientUser, data.user);
                if (mergedUser) setUser(mergedUser);
              }
            })
            .catch(() => {});
        }
        return true;
      }
      return false;
    };

    if (!checkTelegram()) {
      const interval = setInterval(() => {
        checkCount++;
        if (checkTelegram() || checkCount >= maxChecks) {
          clearInterval(interval);
          if (checkCount >= maxChecks) {
            setReady(true);
            fetch("/api/telegram/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ initData: "", storeSlug })
            })
              .then((res) => res.json())
              .then((data) => {
                if (data?.success && data?.user) {
                  const previewUser = normalizeUser(null, data.user);
                  if (previewUser) setUser(previewUser);
                }
              })
              .catch(() => {});
          }
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [storeSlug]);

  const telegramContextValue = useMemo(() => ({
    webApp,
    user,
    ready,
    error
  }), [webApp, user, ready, error]);

  return (
    <TelegramContext.Provider value={telegramContextValue}>
      <Script 
        src="https://telegram.org/js/telegram-web-app.js" 
        strategy="beforeInteractive" 
      />
      {/* If error, show a blocking overlay */}
      {error ? (
        <div className="fixed inset-0 bg-red-50 text-red-600 flex items-center justify-center p-4 z-50">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">Acesso Negado</h2>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <CartProvider storeSlug={storeSlug}>
          {children}
        </CartProvider>
      )}
    </TelegramContext.Provider>
  );
}
