"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface CartItem {
  id: string;
  slug: string;
  title: string;
  price: number;
  quantity: number;
  coverUrl: string | null;
  storeId: string; // Used to validate mixing stores
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

export function CartProvider({ children, storeSlug }: { children: React.ReactNode; storeSlug: string }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const storageKey = `webgran_cart_${storeSlug}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const sanitized = parsed.map((item: any) => ({
            ...item,
            price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
            quantity: Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0 ? Number(item.quantity) : 1
          }));
          setItems(sanitized);
        }
      }
    } catch (e) {
      console.error("[CART DEBUG] Failed to load cart from localStorage", e);
    }
    setIsLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(items));
        console.log("[CART DEBUG] Persisted cart to localStorage key", storageKey, items);
      } catch (e) {
        console.error("[CART DEBUG] Failed to persist cart", e);
      }
    }
  }, [items, isLoaded, storageKey]);

  const addToCart = (newItem: CartItem) => {
    console.log("[CART DEBUG] addToCart invoked with newItem:", newItem);
    setItems((prev) => {
      console.log("[CART DEBUG] prev cart state before add:", prev);

      // Prevent mixing items from different stores ONLY if both IDs exist and differ
      if (
        prev.length > 0 &&
        prev[0].storeId &&
        newItem.storeId &&
        prev[0].storeId !== newItem.storeId
      ) {
        console.log("[CART DEBUG] Store mismatch detected between", prev[0].storeId, "and", newItem.storeId, "- Replacing cart.");
        return [newItem]; 
      }

      const existingIndex = prev.findIndex((i) => i.id === newItem.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += newItem.quantity;
        console.log("[CART DEBUG] Incremented quantity for item:", updated[existingIndex]);
        return updated;
      }

      const updated = [...prev, newItem];
      console.log("[CART DEBUG] Appended new item to cart array. New cart items:", updated);
      return updated;
    });
  };

  const removeFromCart = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return;
    setItems((prev) =>
      prev.map((i) => (i.id === productId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => setItems([]);

  const subtotal = items.reduce((acc, item) => {
    const priceVal = Number.isFinite(item.price) ? item.price : 0;
    const qtyVal = Number.isFinite(item.quantity) ? item.quantity : 1;
    return acc + priceVal * qtyVal;
  }, 0);

  const total = subtotal;
  const itemCount = items.reduce((acc, item) => acc + (Number.isFinite(item.quantity) ? item.quantity : 1), 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        subtotal,
        total,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
