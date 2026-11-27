"use client";

import { useEffect } from "react";

const key = (slug: string) => `wg_accent_${slug}`;

function apply(color: string | null) {
  const root = document.documentElement;
  if (color && /^#[0-9a-f]{6}$/i.test(color)) {
    root.style.setProperty("--wg-accent", color);
    root.setAttribute("data-wg-accent", "");
  } else {
    root.style.removeProperty("--wg-accent");
    root.removeAttribute("data-wg-accent");
  }
}

/**
 * Aplica a cor principal escolhida na Personalização do bot (troca o vermelho dos elementos .wg-accent).
 * color = null volta ao vermelho de sempre. Guarda na sessão para as outras telas do Mini App.
 */
export function MiniAppAccent({ storeSlug, color }: { storeSlug: string; color: string | null }) {
  useEffect(() => {
    apply(color);
    try {
      if (color) sessionStorage.setItem(key(storeSlug), color);
      else sessionStorage.removeItem(key(storeSlug));
    } catch {}
  }, [storeSlug, color]);
  return null;
}

/** No layout: se a Home já definiu uma cor nesta sessão, reaplica ao abrir direto outra tela. */
export function MiniAppAccentRestore({ storeSlug }: { storeSlug: string }) {
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(key(storeSlug));
      if (saved) apply(saved);
    } catch {}
  }, [storeSlug]);
  return null;
}
