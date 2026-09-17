"use client";

import { createContext, useContext, useEffect, useState } from "react";
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

    const initTelegram = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wa = (window as any).Telegram?.WebApp;

      if (wa) {
        wa.ready();
        setWebApp(wa);

        // Apply Theme Params directly to document root
        if (wa.themeParams) {
          const root = document.documentElement;
          root.style.setProperty('--tg-theme-bg-color', wa.themeParams.bg_color);
          root.style.setProperty('--tg-theme-text-color', wa.themeParams.text_color);
          root.style.setProperty('--tg-theme-hint-color', wa.themeParams.hint_color);
          root.style.setProperty('--tg-theme-link-color', wa.themeParams.link_color);
          root.style.setProperty('--tg-theme-button-color', wa.themeParams.button_color);
          root.style.setProperty('--tg-theme-button-text-color', wa.themeParams.button_text_color);
        }

        // Immediately expose user from initDataUnsafe (always available inside Telegram)
        if (wa.initDataUnsafe?.user) {
          setUser(wa.initDataUnsafe.user);
        }

        // Validate initData with server (upsert customer, get session token)
        try {
          const initData = wa.initData || "";
          const res = await fetch("/api/telegram/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData, storeSlug })
          });
          const data = await res.json();
          if (data.success) {
            // Server response user overrides (has more complete data)
            setUser(data.user);
            setReady(true);
          } else {
            // Still allow viewing store even if auth fails in Telegram context
            setReady(true);
          }
        } catch (_err: unknown) {
          setReady(true); // Allow viewing store even on auth failure
        }
      } else {
        // Browser preview (outside Telegram)
        try {
          const res = await fetch("/api/telegram/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData: "", storeSlug })
          });
          const data = await res.json();
          if (data.success) {
            setUser(data.user);
          }
        } catch (e) {
          // ignore in preview
        }
        setReady(true); // Always let browser preview through
      }
    };

    // Give the script a small delay to attach to window
    const timeout = setTimeout(initTelegram, 100);
    return () => clearTimeout(timeout);
  }, [storeSlug]);

  return (
    <TelegramContext.Provider value={{ webApp, user, ready, error }}>
      <Script 
        src="https://telegram.org/js/telegram-web-app.js" 
        strategy="beforeInteractive" 
      />
      {/* If error, show a blocking overlay */}
      {error && (
        <div className="fixed inset-0 bg-red-50 text-red-600 flex items-center justify-center p-4 z-50">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">Acesso Negado</h2>
            <p>{error}</p>
          </div>
        </div>
      )}
      
      {/* Wait until ready unless we have an error blocking it anyway */}
      {(!ready && !error) ? (
        <div className="fixed inset-0 flex items-center justify-center bg-[var(--tg-theme-bg-color,#fff)] text-[var(--tg-theme-text-color,#000)] z-40">
          Carregando...
        </div>
      ) : (
        <CartProvider storeSlug={storeSlug}>
          {children}
        </CartProvider>
      )}
    </TelegramContext.Provider>
  );
}
