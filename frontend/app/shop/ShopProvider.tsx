"use client";

import { ProductType } from "../types/ProductType";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  addToCartApi,
  modifyCartApi,
  removeCartItemApi,
  getCartFromApi,
} from "../api";

type CartItem = ProductType & { cartQuantity: number };

type Session = {
  sessionId: string;
  name: string;
  phone: string;
  location: string;
} | null;

type ShopContextType = {
  cartItems: CartItem[];
  session: Session;
  addToCart: (product: ProductType) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
};

const ShopContext = createContext<ShopContextType | null>(null);

const CART_STORAGE_KEY = "shop-cart-items";
const SESSION_STORAGE_KEY = "hazel-session";

/** Read session from sessionStorage (cleared on tab/refresh). */
function readSession(): Session {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [session, setSession] = useState<Session>(null);

  // ── Hydrate cart and session from sessionStorage on mount ──
  useEffect(() => {
    const storedCart = sessionStorage.getItem(CART_STORAGE_KEY);
    if (storedCart) {
      try {
        const parsed = JSON.parse(storedCart) as CartItem[];
        setCartItems(Array.isArray(parsed) ? parsed : []);
      } catch {
        setCartItems([]);
      }
    }
    setSession(readSession());
  }, []);

  // ── Persist cart to sessionStorage whenever it changes ──
  useEffect(() => {
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  // ── Poll the Python cart service every 4 seconds to sync agent-added items ──
  useEffect(() => {
    if (!session?.sessionId) return;

    const sync = async () => {
      // Prefer the agent's Dialogflow CX session ID once df-response-received
      // fires and writes it to sessionStorage. Fall back to the form UUID.
      const sid =
        sessionStorage.getItem("agent-session-id") || session?.sessionId;
      if (!sid) return;

      try {
        const res = await getCartFromApi(sid);
        if (!res.success) return;

        // Merge agent-side cart items into React state.
        // The Python service is the source of truth for items the agent added.
        setCartItems((prev) => {
          const merged = [...prev];
          for (const apiItem of res.cart.items) {
            const existing = merged.find((i) => i.id === apiItem.productId);
            if (existing) {
              if (existing.cartQuantity !== apiItem.quantity) {
                existing.cartQuantity = apiItem.quantity;
              }
            } else {
              merged.push({
                id: apiItem.productId,
                name: apiItem.productName,
                unitCost: String(apiItem.unitCost),
                cartQuantity: apiItem.quantity,
                description: "",
                category: "",
                imageUrl: "",
                quantity: 9999,
                totalCost: String(apiItem.lineTotalKes),
              } as unknown as CartItem);
            }
          }
          return merged;
        });
      } catch (error) {
        // Silently ignore network errors during polling
      }
    };

    sync(); // Immediate first fetch
    const interval = setInterval(sync, 4000);
    return () => clearInterval(interval);
  }, [session?.sessionId]);

  // ── Cart mutation helpers ──

  const addToCart = useCallback(
    (product: ProductType) => {
      setCartItems((prev) => {
        const existing = prev.find((item) => item.id === product.id);
        const newQuantity = existing
          ? Math.min(existing.cartQuantity + 1, product.quantity)
          : 1;

        // Fire-and-forget to Python cart service
        if (session?.sessionId) {
          addToCartApi({
            sessionId: session.sessionId,
            productId: product.id,
            productName: product.name,
            unitCost: Number(product.unitCost),
            quantity: newQuantity,
          }).catch(() => {}); // Don't block UI on network error
        }

        if (existing) {
          return prev.map((item) =>
            item.id === product.id
              ? { ...item, cartQuantity: newQuantity }
              : item
          );
        }
        return [...prev, { ...product, cartQuantity: 1 }];
      });
    },
    [session]
  );

  const removeFromCart = useCallback(
    (productId: string) => {
      if (session?.sessionId) {
        removeCartItemApi(session.sessionId, productId).catch(() => {});
      }
      setCartItems((prev) => prev.filter((item) => item.id !== productId));
    },
    [session]
  );

  const updateCartQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (session?.sessionId) {
        if (quantity <= 0) {
          removeCartItemApi(session.sessionId, productId).catch(() => {});
        } else {
          modifyCartApi({
            sessionId: session.sessionId,
            productId,
            quantity,
          }).catch(() => {});
        }
      }

      setCartItems((prev) =>
        prev
          .map((item) => {
            if (item.id !== productId) return item;
            return {
              ...item,
              cartQuantity: Math.max(1, Math.min(quantity, item.quantity)),
            };
          })
          .filter((item) => item.cartQuantity > 0)
      );
    },
    [session]
  );

  const clearCart = useCallback(() => {
    setCartItems([]);
    sessionStorage.removeItem(CART_STORAGE_KEY);
  }, []);

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.cartQuantity, 0),
    [cartItems]
  );

  const cartTotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + Number(item.unitCost || 0) * item.cartQuantity,
        0
      ),
    [cartItems]
  );

  const value: ShopContextType = {
    cartItems,
    session,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    cartCount,
    cartTotal,
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error("useShop must be used within ShopProvider");
  }
  return context;
}
