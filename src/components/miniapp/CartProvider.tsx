"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";

export interface CartItem {
  id: string; // Product or Combo UUID
  slug: string;
  title: string;
  price: number;
  quantity: number;
  coverUrl: string | null;
  storeId: string; // Used to validate mixing stores
  isCombo?: boolean;
  comboId?: string | null;
}

export interface AppliedTierSummary {
  tierId?: string;
  minQuantity: number;
  priceCents: number;
  count: number;
  totalCoveredUnits?: number;
  totalPriceCents?: number;
  // Optional aliases for view compatibility
  tierPriceCents?: number;
  appliedCount?: number;
  totalUnitsInTier?: number;
  totalCostCents?: number;
}

export interface NextTierProgress {
  targetQuantity: number;
  unitsRemaining: number;
  targetTierPriceCents: number;
  projectedAdditionalSavingsCents?: number;
  // Optional aliases for view compatibility
  nextTier?: {
    tierId?: string;
    minQuantity: number;
    tierPriceCents: number;
  };
  currentUnits?: number;
  targetUnits?: number;
  unitsNeeded?: number;
  potentialSavingsCents?: number;
  potentialTotalCents?: number;
}

export interface CartPromotionProgress {
  id: string;
  title: string;
  slug: string;
  savings: number;
  savingsPercentage: number;
  appliedTiers: AppliedTierSummary[];
  nextTierProgress: NextTierProgress | null;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  progressiveDiscount: number;
  progressivePromotion: CartPromotionProgress | null;
  total: number;
  itemCount: number;
  isSyncing: boolean;
  isAuthenticated: boolean | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

function getTelegramInitData(): string {
  if (typeof window === "undefined") return "";
  try {
    // 1. Native Telegram.WebApp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wa = (window as any).Telegram?.WebApp;
    if (wa?.initData && wa.initData.trim() !== "") {
      return wa.initData;
    }

    // 2. Hash & Search params (tgWebAppData / initData)
    const sources = [window.location.hash || "", window.location.search || ""];
    for (const src of sources) {
      if (!src) continue;
      const clean = src.startsWith("#") || src.startsWith("?") ? src.slice(1) : src;
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

      if (clean.includes("hash=") && (clean.includes("user=") || clean.includes("query_id="))) {
        return clean.replace(/&tgWebApp[A-Za-z0-9]+=[^&]*/g, "");
      }
    }

    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get("tgWebAppData") || searchParams.get("initData") || "";
  } catch {
    return "";
  }
}

function getAuthHeaders(storeSlug?: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const initData = getTelegramInitData();
  if (initData) {
    headers["x-telegram-init-data"] = initData;
  }
  if (storeSlug) {
    headers["x-store-slug"] = storeSlug;
  }
  return headers;
}

interface ServerCartItem {
  id: string;
  cartId?: string;
  productId?: string | null;
  comboId?: string | null;
  isCombo?: boolean;
  quantity: number;
  productTitle?: string;
  title?: string;
  productSlug?: string;
  slug?: string;
  coverUrl: string | null;
  price: number;
  storeId: string;
}

function mapServerItemToCartItem(serverItem: ServerCartItem): CartItem {
  const isCombo = Boolean(serverItem.isCombo || serverItem.comboId);
  const effectiveId = serverItem.comboId || serverItem.productId || serverItem.id;
  return {
    id: effectiveId,
    slug: serverItem.slug || serverItem.productSlug || "",
    title: serverItem.title || serverItem.productTitle || (isCombo ? "Combo" : "Produto"),
    price: Number.isFinite(serverItem.price) ? Math.max(0, serverItem.price) : 0,
    quantity: Number.isFinite(serverItem.quantity) && serverItem.quantity > 0 ? Math.floor(serverItem.quantity) : 1,
    coverUrl: serverItem.coverUrl || null,
    storeId: serverItem.storeId,
    isCombo,
    comboId: isCombo ? effectiveId : null,
  };
}

export function CartProvider({
  children,
  storeSlug,
}: {
  children: React.ReactNode;
  storeSlug: string;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [progressiveDiscount, setProgressiveDiscount] = useState<number>(0);
  const [progressivePromotion, setProgressivePromotion] = useState<CartPromotionProgress | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const storageKey = `webgran_cart_${storeSlug}`;
  const mutationSeqRef = useRef<number>(0);
  const hasSyncedInitialRef = useRef<boolean>(false);
  const itemsRef = useRef<CartItem[]>(items);
  itemsRef.current = items;

  const persistToLocalStorage = useCallback(
    (newItems: CartItem[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newItems));
      } catch (e) {
        console.error("[CART] Failed to write localStorage cache:", e);
      }
    },
    [storageKey]
  );

  // 1. Initial Load: Read localStorage first for instant display, then sync with server
  useEffect(() => {
    let localItems: CartItem[] = [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          localItems = parsed.map((item: any) => ({
            id: String(item.id || item.productId || ""),
            slug: String(item.slug || item.productSlug || ""),
            title: String(item.title || item.productTitle || "Produto"),
            price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
            quantity:
              Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0
                ? Math.floor(Number(item.quantity))
                : 1,
            coverUrl: item.coverUrl || null,
            storeId: String(item.storeId || ""),
            isCombo: Boolean(item.isCombo || item.comboId),
            comboId: item.comboId || null,
          })).filter((item) => Boolean(item.id));
          setItems(localItems);
        }
      }
    } catch (e) {
      console.error("[CART] Failed to read localStorage:", e);
    }
    setIsLoaded(true);

    // Initial server fetch / merge
    const syncWithServer = async (isRetry = false) => {
      if (hasSyncedInitialRef.current && !isRetry) return;
      setIsSyncing(true);

      try {
        const res = await fetch(`/api/miniapp/cart?storeSlug=${encodeURIComponent(storeSlug)}`, {
          method: "GET",
          headers: getAuthHeaders(storeSlug),
        });

        if (res.status === 401) {
          // Unauthenticated visitor ou autenticação ainda em processamento:
          // NÃO marcar hasSyncedInitialRef = true para permitir sincronizar assim que a auth completar.
          setIsAuthenticated(false);
          return;
        }

        if (!res.ok) {
          console.warn("[CART] Server cart check returned status:", res.status);
          return;
        }

        const data = await res.json();
        if (data.success && data.cart) {
          setIsAuthenticated(true);
          hasSyncedInitialRef.current = true;

          const serverItems: ServerCartItem[] = data.cart.items || [];
          const migrationKey = `webgran_cart_migrated_${storeSlug}`;
          const alreadyMigrated = typeof window !== "undefined" && localStorage.getItem(migrationKey) === "true";

          // If there are local items present that have NEVER been migrated yet, sync them once
          if (localItems.length > 0 && !alreadyMigrated) {
            try {
              const syncRes = await fetch(`/api/miniapp/cart?storeSlug=${encodeURIComponent(storeSlug)}`, {
                method: "POST",
                headers: getAuthHeaders(storeSlug),
                body: JSON.stringify({
                  action: "sync",
                  items: localItems.map((item) => ({
                    productId: item.isCombo ? undefined : item.id,
                    comboId: item.isCombo ? item.id : undefined,
                    isCombo: item.isCombo,
                    quantity: item.quantity,
                  })),
                }),
              });

              if (syncRes.ok) {
                const syncData = await syncRes.json();
                if (syncData.success && syncData.cart) {
                  localStorage.setItem(migrationKey, "true");
                  const merged = (syncData.cart.items || []).map(mapServerItemToCartItem);
                  setItems(merged);
                  setProgressiveDiscount(syncData.cart.progressiveDiscount || 0);
                  setProgressivePromotion(syncData.cart.progressivePromotion || null);
                  persistToLocalStorage(merged);
                  return;
                }
              }
            } catch (syncErr) {
              console.error("[CART] Error performing initial sync migration:", syncErr);
            }
          }

          // Adopt the authoritative server cart
          localStorage.setItem(migrationKey, "true");
          const canonical = serverItems.map(mapServerItemToCartItem);
          setItems(canonical);
          setProgressiveDiscount(data.cart.progressiveDiscount || 0);
          setProgressivePromotion(data.cart.progressivePromotion || null);
          persistToLocalStorage(canonical);
        }
      } catch (err) {
        console.error("[CART] Error syncing with server cart:", err);
      } finally {
        setIsSyncing(false);
      }
    };

    syncWithServer();

    // Ouvinte para re-sincronizar imediatamente na primeira abertura quando o Telegram autenticar
    const handleAuthSuccess = () => {
      syncWithServer(true);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("webgran_tg_auth_success", handleAuthSuccess);
    }

    // Retentativas rápidas caso o script do Telegram WebApp demore milissegundos para injetar initData
    const timer1 = setTimeout(() => {
      if (!hasSyncedInitialRef.current) syncWithServer(true);
    }, 400);

    const timer2 = setTimeout(() => {
      if (!hasSyncedInitialRef.current) syncWithServer(true);
    }, 1200);

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("webgran_tg_auth_success", handleAuthSuccess);
      }
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [storeSlug, storageKey, persistToLocalStorage]);

  // Execute server mutation with optimistic UI update and automatic rollback on failure
  const performMutation = useCallback(
    async (
      optimisticItems: CartItem[],
      apiPayload: Record<string, any>
    ) => {
      const prevItems = itemsRef.current;
      const currentSeq = ++mutationSeqRef.current;

      // Optimistic UI update
      setItems(optimisticItems);
      persistToLocalStorage(optimisticItems);

      if (optimisticItems.length === 0) {
        setProgressiveDiscount(0);
        setProgressivePromotion(null);
      }

      // If user is definitely not authenticated, keep local only
      if (isAuthenticated === false) {
        return;
      }

      setIsSyncing(true);
      try {
        const res = await fetch(`/api/miniapp/cart?storeSlug=${encodeURIComponent(storeSlug)}`, {
          method: "POST",
          headers: getAuthHeaders(storeSlug),
          body: JSON.stringify(apiPayload),
        });

        if (res.status === 401) {
          // User is not authenticated; keep local state
          setIsAuthenticated(false);
          return;
        }

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Falha ao sincronizar operação no servidor.");
        }

        // Only update with server response if no newer mutation happened
        if (currentSeq === mutationSeqRef.current && data.cart) {
          setIsAuthenticated(true);
          const serverCanonical = (data.cart.items || []).map(mapServerItemToCartItem);
          setItems(serverCanonical);
          setProgressiveDiscount(data.cart.progressiveDiscount || 0);
          setProgressivePromotion(data.cart.progressivePromotion || null);
          persistToLocalStorage(serverCanonical);
        }
      } catch (error) {
        console.error("[CART] Mutation failed, rolling back:", error);
        // Rollback state and cache on network or validation error
        if (currentSeq === mutationSeqRef.current) {
          setItems(prevItems);
          persistToLocalStorage(prevItems);
        }
      } finally {
        if (currentSeq === mutationSeqRef.current) {
          setIsSyncing(false);
        }
      }
    },
    [isAuthenticated, storeSlug, persistToLocalStorage]
  );

  const addToCart = useCallback(
    (newItem: CartItem) => {
      const current = itemsRef.current;

      // Prevent mixing items from different stores ONLY if both IDs exist and differ
      let baseItems = current;
      if (
        current.length > 0 &&
        current[0].storeId &&
        newItem.storeId &&
        current[0].storeId !== newItem.storeId
      ) {
        baseItems = [];
      }

      const existingIndex = baseItems.findIndex((i) => i.id === newItem.id);
      let updated: CartItem[];
      if (existingIndex >= 0) {
        updated = [...baseItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + newItem.quantity,
        };
      } else {
        updated = [...baseItems, newItem];
      }

      performMutation(updated, {
        action: "add",
        productId: newItem.isCombo ? undefined : newItem.id,
        comboId: newItem.isCombo ? newItem.id : undefined,
        isCombo: newItem.isCombo,
        quantity: newItem.quantity,
      });
    },
    [performMutation]
  );

  const removeFromCart = useCallback(
    (productId: string) => {
      const current = itemsRef.current;
      const targetItem = current.find((i) => i.id === productId);
      const isCombo = targetItem?.isCombo;
      const updated = current.filter((i) => i.id !== productId);

      performMutation(updated, {
        action: "remove",
        productId: isCombo ? undefined : productId,
        comboId: isCombo ? productId : undefined,
      });
    },
    [performMutation]
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity < 1) return;
      const current = itemsRef.current;
      const targetItem = current.find((i) => i.id === productId);
      const isCombo = targetItem?.isCombo;
      const updated = current.map((i) =>
        i.id === productId ? { ...i, quantity: Math.floor(quantity) } : i
      );

      performMutation(updated, {
        action: "update",
        productId: isCombo ? undefined : productId,
        comboId: isCombo ? productId : undefined,
        quantity: Math.floor(quantity),
      });
    },
    [performMutation]
  );

  const clearCart = useCallback(() => {
    performMutation([], {
      action: "clear",
    });
  }, [performMutation]);

  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => {
      const priceVal = Number.isFinite(item.price) ? item.price : 0;
      const qtyVal = Number.isFinite(item.quantity) ? item.quantity : 1;
      return acc + priceVal * qtyVal;
    }, 0);
  }, [items]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - progressiveDiscount);
  }, [subtotal, progressiveDiscount]);

  const itemCount = useMemo(() => {
    return items.reduce(
      (acc, item) => acc + (Number.isFinite(item.quantity) ? item.quantity : 1),
      0
    );
  }, [items]);

  const contextValue = useMemo(
    () => ({
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      subtotal,
      progressiveDiscount,
      progressivePromotion,
      total,
      itemCount,
      isSyncing,
      isAuthenticated,
    }),
    [
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      subtotal,
      progressiveDiscount,
      progressivePromotion,
      total,
      itemCount,
      isSyncing,
      isAuthenticated,
    ]
  );

  return <CartContext.Provider value={contextValue}>{children}</CartContext.Provider>;
}
