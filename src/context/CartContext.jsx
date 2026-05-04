/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "kblb:cart:v1";

const CartContext = createContext(null);

function loadStoredCart() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item) =>
        item &&
        typeof item.lookupKey === "string" &&
        typeof item.priceId === "string" &&
        typeof item.quantity === "number" &&
        item.quantity > 0,
    );
  } catch {
    return [];
  }
}

function CartProvider({ children }) {
  const [items, setItems] = useState(() =>
    typeof window === "undefined" ? [] : loadStoredCart(),
  );
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const clearCart = useCallback(() => setItems([]), []);

  const addItem = useCallback((incomingItem) => {
    const incomingQuantity = Math.max(
      1,
      Math.min(99, Math.floor(Number(incomingItem.quantity) || 1)),
    );

    setItems((previous) => {
      const index = previous.findIndex(
        (item) => item.lookupKey === incomingItem.lookupKey,
      );

      if (index === -1) {
        return [...previous, { ...incomingItem, quantity: incomingQuantity }];
      }

      return previous.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, quantity: Math.min(99, item.quantity + incomingQuantity) }
          : item,
      );
    });
  }, []);

  const updateQuantity = useCallback((lookupKey, quantity) => {
    const normalized = Math.max(0, Math.min(99, Math.floor(quantity)));

    setItems((previous) => {
      if (normalized === 0) {
        return previous.filter((item) => item.lookupKey !== lookupKey);
      }

      return previous.map((item) =>
        item.lookupKey === lookupKey ? { ...item, quantity: normalized } : item,
      );
    });
  }, []);

  const removeItem = useCallback((lookupKey) => {
    setItems((previous) =>
      previous.filter((item) => item.lookupKey !== lookupKey),
    );
  }, []);

  const api = useMemo(() => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce(
      (sum, item) => sum + item.unitAmount * item.quantity,
      0,
    );

    return {
      items,
      count,
      subtotal,
      isOpen,
      openCart,
      closeCart,
      clearCart,
      addItem,
      updateQuantity,
      removeItem,
    };
  }, [addItem, clearCart, closeCart, isOpen, items, openCart, removeItem, updateQuantity]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider.");
  }

  return context;
}

export { CartProvider, useCart };
