"use client";
import {appFetch, appApiUrl} from "@/lib/app-fetch";
import { useEffect, useState } from "react";
import {
  readBasket,
  updateCart,
  submitBasket,
  CheckoutRejected,
  type Basket,
  type Cart,
  type Lock,
} from "@/lib/basket";
const lock: Lock = async (name, work) => {
  if (!navigator.locks)
    return Promise.reject(
      new Error(
        "Safe checkout requires browser lock support. Please use a current browser.",
      ),
    );
  return await navigator.locks.request(name, work);
};
export function useBasket(scope: string | null) {
  const [saved, setSaved] = useState<{ scope: string; value: Basket } | null>(
    null,
  );
  const [error, setError] = useState("");
  const refresh = () => {
    if (!scope) return;
    try {
      setSaved({ scope, value: readBasket(localStorage, scope) });
      setError("");
    } catch {
      setSaved(null);
      setError(
        "Your basket cannot be safely saved or restored. Check browser storage and your orders before trying again.",
      );
    }
  };
  useEffect(() => {
    refresh();
    const changed = (e: StorageEvent) => {
      if (e.key === scope || e.key === null) refresh();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [scope]);
  const value = saved?.scope === scope ? saved.value : { cart: {} };
  const edit = async (update: (cart: Cart) => Cart) => {
    if (!scope || saved?.scope !== scope) return;
    try {
      await updateCart(localStorage, scope, lock, update);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const checkout = async (details: {
    flatId: string;
    slot: string;
    substitution: string;
  }) => {
    if (!scope || saved?.scope !== scope)
      throw new Error("Wait for your saved basket to load.");
    try {
      return await submitBasket(
        localStorage,
        scope,
        lock,
        details,
        async (body) => {
          const response = await appFetch("/api/orders", {
            method: "POST",
            signal: AbortSignal.timeout(15000),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const result = await response.json();
          if (!response.ok) {
            const message =
              result.error ||
              "Order could not be confirmed. Retry to check the same order.";
            if (
              [400, 404, 409, 422].includes(response.status) &&
              !message.includes("checkout key")
            )
              throw new CheckoutRejected(message);
            throw new Error(message);
          }
          return result;
        },
        () => crypto.randomUUID(),
      );
    } finally {
      refresh();
    }
  };
  return {
    cart: value.cart,
    pending: value.pending,
    error,
    ready: !!scope && saved?.scope === scope,
    edit,
    checkout,
  };
}
