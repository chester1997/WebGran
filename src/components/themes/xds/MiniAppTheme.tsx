"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Tema do Mini App escolhido para o bot (Bot → Temas). A tela inicial marca o tema no <html>
 * (data-wg-theme) e guarda na sessão; o menu de baixo, que fica no layout, lê daí.
 */
const key = (slug: string) => `wg_theme_${slug}`;

function apply(theme: string | null) {
  const root = document.documentElement;
  if (theme) root.setAttribute("data-wg-theme", theme);
  else root.removeAttribute("data-wg-theme");
}

/** Na Home: aplica o tema do bot (null = Padrão) */
export function MiniAppThemeMarker({ storeSlug, theme }: { storeSlug: string; theme: string | null }) {
  useEffect(() => {
    apply(theme);
    try {
      if (theme) sessionStorage.setItem(key(storeSlug), theme);
      else sessionStorage.removeItem(key(storeSlug));
    } catch {}
  }, [storeSlug, theme]);
  return null;
}

/** No layout: ao abrir direto outra tela, reaplica o tema que a Home definiu nesta sessão */
export function MiniAppThemeRestore({ storeSlug }: { storeSlug: string }) {
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(key(storeSlug));
      if (saved) apply(saved);
    } catch {}
  }, [storeSlug]);
  return null;
}

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-wg-theme"] });
  return () => obs.disconnect();
}

/** Tema atual (no servidor e antes de montar: null = Padrão) */
export function useMiniAppTheme(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.getAttribute("data-wg-theme"),
    () => null
  );
}
