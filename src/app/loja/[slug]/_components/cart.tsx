"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface LocalLine {
  id: string;
  isCombo: boolean;
  quantity: number;
}

interface CartCtx {
  lines: LocalLine[];
  count: number;
  ready: boolean;
  add: (id: string, isCombo?: boolean) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  toast: string | null;
  notify: (msg: string) => void;
}

const Ctx = createContext<CartCtx | null>(null);

/** Cliente com VIP ativo: tudo liberado, então a loja esconde preço, carrinho e ofertas. */
const VipCtx = createContext(false);
export const useIsVip = () => useContext(VipCtx);
export function VipProvider({ vip, children }: { vip: boolean; children: ReactNode }) {
  return <VipCtx.Provider value={vip}>{children}</VipCtx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart fora do CartProvider");
  return c;
}

export function CartProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const key = `wg_loja_cart_${slug}`;
  const [lines, setLines] = useState<LocalLine[]>([]);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do armazenamento local
      if (Array.isArray(parsed)) setLines(parsed.filter((l) => l && typeof l.id === "string"));
    } catch {
      // armazenamento indisponível
    }
    setReady(true);
  }, [key]);

  const save = useCallback(
    (next: LocalLine[]) => {
      setLines(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // ignora
      }
    },
    [key]
  );

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  }, []);

  const value = useMemo<CartCtx>(
    () => ({
      lines,
      ready,
      count: lines.reduce((a, l) => a + l.quantity, 0),
      add: (id, isCombo = false) => {
        const found = lines.find((l) => l.id === id);
        save(found ? lines.map((l) => (l.id === id ? { ...l, quantity: Math.min(99, l.quantity + 1) } : l)) : [...lines, { id, isCombo, quantity: 1 }]);
        notify("Adicionado ao carrinho");
      },
      setQty: (id, qty) => save(lines.map((l) => (l.id === id ? { ...l, quantity: Math.min(99, Math.max(1, qty)) } : l))),
      remove: (id) => save(lines.filter((l) => l.id !== id)),
      clear: () => save([]),
      toast,
      notify,
    }),
    [lines, ready, save, toast, notify]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
