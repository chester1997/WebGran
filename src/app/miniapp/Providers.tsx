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

    const initTelegram = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wa = (window as any).Telegram?.WebApp;

      if (wa) {
        wa.ready();
        if (typeof wa.expand === 'function') {
          wa.expand();
        }
        setWebApp(wa);

        applyTheme(wa);

        if (typeof wa.onEvent === 'function') {
          wa.onEvent('themeChanged', () => applyTheme(wa));
        }

        // Immediately expose user from initDataUnsafe (always available inside Telegram)
        if (wa.initDataUnsafe?.user) {
          setUser(wa.initDataUnsafe.user);
        }
        setReady(true);

        // Validate initData with server in background (upsert customer, get session token)
        try {
          const initData = wa.initData || "";
          const res = await fetch("/api/telegram/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData, storeSlug })
          });
          const data = await res.json();
          if (data.success && data.user) {
            setUser(data.user);
          }
        } catch (_err: unknown) {
          // background sync error fallback
        }
      } else {
        // Browser preview (outside Telegram)
        setReady(true);
        try {
          const res = await fetch("/api/telegram/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData: "", storeSlug })
          });
          const data = await res.json();
          if (data.success && data.user) {
            setUser(data.user);
          }
        } catch (_e) {
          // ignore in preview
        }
      }
    };

    initTelegram();
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
