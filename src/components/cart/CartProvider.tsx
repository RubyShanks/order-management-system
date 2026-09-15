'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from 'react';

export interface CartItem {
  product_id: string;
  name: string;
  price_amount: number;
  quantity: number;
  image_path: string | null;
  available: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (
    product: {
      product_id: string;
      name: string;
      price_amount: number;
      image_path?: string | null;
      available: number;
    },
    quantity?: number
  ) => void;
  removeItem: (product_id: string) => void;
  updateQuantity: (product_id: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'order_mgmt_cart';

let listeners: Array<() => void> = [];

function emitCartChange() {
  for (const listener of listeners) {
    listener();
  }
}

const cartStorageStore = {
  getSnapshot(): string {
    if (typeof window === 'undefined') return '[]';
    try {
      return localStorage.getItem(CART_STORAGE_KEY) || '[]';
    } catch {
      return '[]';
    }
  },
  getServerSnapshot(): string {
    return '[]';
  },
  subscribe(listener: () => void): () => void {
    listeners.push(listener);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) {
        listener();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
      window.removeEventListener('storage', handleStorage);
    };
  },
  set(items: CartItem[]) {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore localStorage errors (e.g. privacy mode, quota)
    }
    emitCartChange();
  },
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // Synchronize cart state with localStorage safely without cascading renders
  const rawItems = useSyncExternalStore(
    cartStorageStore.subscribe,
    cartStorageStore.getSnapshot,
    cartStorageStore.getServerSnapshot
  );

  const items = useMemo<CartItem[]>(() => {
    try {
      const parsed = JSON.parse(rawItems);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [rawItems]);

  const addItem = useCallback(
    (
      product: {
        product_id: string;
        name: string;
        price_amount: number;
        image_path?: string | null;
        available: number;
      },
      quantity: number = 1
    ) => {
      if (product.available <= 0 || quantity <= 0) return;

      const currentItems = items;
      const existingIndex = currentItems.findIndex(
        (item) => item.product_id === product.product_id
      );

      let nextItems: CartItem[];
      if (existingIndex > -1) {
        const currentItem = currentItems[existingIndex];
        const maxAllowed = Math.min(product.available, 99);
        const newQty = Math.min(currentItem.quantity + quantity, maxAllowed);

        nextItems = [...currentItems];
        nextItems[existingIndex] = {
          ...currentItem,
          available: product.available,
          price_amount: product.price_amount,
          name: product.name,
          image_path: product.image_path ?? currentItem.image_path,
          quantity: newQty,
        };
      } else {
        const validQty = Math.min(quantity, Math.min(product.available, 99));
        nextItems = [
          ...currentItems,
          {
            product_id: product.product_id,
            name: product.name,
            price_amount: product.price_amount,
            image_path: product.image_path ?? null,
            available: product.available,
            quantity: validQty,
          },
        ];
      }

      cartStorageStore.set(nextItems);
    },
    [items]
  );

  const removeItem = useCallback(
    (product_id: string) => {
      const nextItems = items.filter((item) => item.product_id !== product_id);
      cartStorageStore.set(nextItems);
    },
    [items]
  );

  const updateQuantity = useCallback(
    (product_id: string, quantity: number) => {
      if (quantity <= 0) {
        const nextItems = items.filter((item) => item.product_id !== product_id);
        cartStorageStore.set(nextItems);
        return;
      }

      const nextItems = items.map((item) => {
        if (item.product_id !== product_id) return item;
        const maxAllowed = Math.min(item.available, 99);
        const newQty = Math.max(1, Math.min(quantity, maxAllowed));
        return { ...item, quantity: newQty };
      });

      cartStorageStore.set(nextItems);
    },
    [items]
  );

  const clearCart = useCallback(() => {
    cartStorageStore.set([]);
  }, []);

  const getTotal = useCallback(() => {
    return items.reduce((sum, item) => sum + item.price_amount * item.quantity, 0);
  }, [items]);

  const getItemCount = useCallback(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getTotal,
      getItemCount,
      isOpen,
      setIsOpen,
      openCart,
      closeCart,
    }),
    [
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getTotal,
      getItemCount,
      isOpen,
      openCart,
      closeCart,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
