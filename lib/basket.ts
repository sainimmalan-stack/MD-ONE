/** Durable, per-resident/per-flat checkout journal. Never store prices or credentials. */
export type Cart = Record<string, number>;
export type CheckoutRequest = {
  items: { id: string; qty: number }[];
  flatId: string;
  slot: string;
  substitution: string;
  payment: "cod";
  key: string;
};
export type Basket = { cart: Cart; pending?: CheckoutRequest };
export type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
export type Lock = <T>(name: string, work: () => Promise<T>) => Promise<T>;
export const basketKey = (user: string, flat: string) =>
  `mdp:basket:v1:${encodeURIComponent(user)}:${encodeURIComponent(flat)}`;
export function readBasket(storage: Storage, scope: string): Basket {
  const raw = storage.getItem(scope);
  if (!raw) return { cart: {} };
  // Fail closed on corruption: silently discarding a pending request could duplicate it.
  const b = JSON.parse(raw);
  if (
    !b ||
    !b.cart ||
    typeof b.cart !== "object" ||
    Array.isArray(b.cart) ||
    Object.entries(b.cart).some(
      ([id, n]) =>
        !id || !Number.isInteger(n) || Number(n) < 1 || Number(n) > 20,
    )
  )
    throw new Error(
      "Saved basket could not be read. Check your orders before resetting browser storage.",
    );
  if (
    b.pending &&
    (!b.pending.key ||
      !b.pending.flatId ||
      !b.pending.slot ||
      !Array.isArray(b.pending.items) ||
      !b.pending.items.length ||
      b.pending.payment !== "cod" ||
      !["none", "ask"].includes(b.pending.substitution) ||
      b.pending.items.some(
        (i: { id: string; qty: number }) =>
          !i.id || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 20,
      ))
  )
    throw new Error(
      "Saved checkout could not be read. Check your orders before resetting browser storage.",
    );
  return b;
}
export function writeBasket(storage: Storage, scope: string, b: Basket) {
  storage.setItem(scope, JSON.stringify(b));
}
export class CheckoutRejected extends Error {}
export async function updateCart(
  storage: Storage,
  scope: string,
  lock: Lock,
  update: (cart: Cart) => Cart,
) {
  return lock(scope, async () => {
    const b = readBasket(storage, scope);
    if (b.pending)
      throw new Error(
        "Check the pending order in your basket before changing items.",
      );
    const next = { cart: update(b.cart) };
    writeBasket(storage, scope, next);
    return next;
  });
}
export async function submitBasket(
  storage: Storage,
  scope: string,
  lock: Lock,
  details: { flatId: string; slot: string; substitution: string },
  send: (body: CheckoutRequest) => Promise<{ id: string; total: number }>,
  makeKey: () => string,
) {
  return lock(scope, async () => {
    const b = readBasket(storage, scope);
    if (!b.pending) {
      const items = Object.entries(b.cart)
        .map(([id, qty]) => ({ id, qty }))
        .sort((a, b) => a.id.localeCompare(b.id));
      if (!items.length)
        throw new Error(
          "Your basket is empty. Check My orders for your last checkout.",
        );
      b.pending = { ...details, items, payment: "cod", key: makeKey() };
      // Persist BEFORE sending. Storage failure must never create an untracked order.
      writeBasket(storage, scope, b);
    }
    let result;
    try {
      result = await send(b.pending);
      if (
        !result ||
        typeof result.id !== "string" ||
        !result.id ||
        !Number.isFinite(result.total)
      )
        throw new Error(
          "Order confirmation was incomplete. Retry to check the same order.",
        );
    } catch (e) {
      // Only explicit transactional rejection permits editing/new checkout. Network/5xx
      // errors keep the original payload and key, including across tabs and reloads.
      if (e instanceof CheckoutRejected)
        writeBasket(storage, scope, { cart: b.cart });
      throw e;
    }
    writeBasket(storage, scope, { cart: {} });
    return result;
  });
}
