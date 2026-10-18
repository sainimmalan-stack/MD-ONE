import test from "node:test";
import assert from "node:assert/strict";
import {
  basketKey,
  readBasket,
  writeBasket,
  updateCart,
  submitBasket,
  CheckoutRejected,
  type Lock,
  type Storage,
} from "../lib/basket.ts";
import { openDatabase } from "../lib/db.ts";
import { Service } from "../lib/service.ts";
function setup() {
  const values = new Map<string, string>();
  const storage: Storage = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => {
      values.set(k, v);
    },
  };
  let tail = Promise.resolve<unknown>(undefined);
  const lock: Lock = (_name, work) => {
    const next = tail.then(work);
    tail = next.catch(() => undefined);
    return next;
  };
  const scope = basketKey("resident", "f1");
  const db = openDatabase(":memory:");
  const service = new Service(db);
  const user = service.one("SELECT * FROM users WHERE id='resident'")!;
  const details = {
    flatId: "f1",
    slot: service.slots()[0].id,
    substitution: "none",
  };
  const send = async (body: any) => service.checkout(user, body);
  writeBasket(storage, scope, { cart: { milk: 1 } });
  let keys = 0;
  const submit = (sender = send, d = details) =>
    submitBasket(storage, scope, lock, d, sender, () => `key-${++keys}`);
  return {
    storage,
    scope,
    db,
    service,
    details,
    send,
    submit,
    lock,
    keys: () => keys,
  };
}
test("cart survives restoration and is isolated by resident and flat", async () => {
  const c = setup();
  try {
    await updateCart(c.storage, c.scope, c.lock, (cart) => ({
      ...cart,
      milk: 2,
    }));
    assert.deepEqual(readBasket(c.storage, c.scope), { cart: { milk: 2 } });
    assert.deepEqual(readBasket(c.storage, basketKey("neighbor", "f1")), {
      cart: {},
    });
    assert.deepEqual(readBasket(c.storage, basketKey("resident", "f2")), {
      cart: {},
    });
  } finally {
    c.db.close();
  }
});
test("lost response retries exact request after reload/remount, despite changed form choices", async () => {
  const c = setup();
  try {
    let committed: any;
    await assert.rejects(
      c.submit(async (b) => {
        committed = await c.send(b);
        throw new Error("Connection lost after commit");
      }),
    );
    const pending = readBasket(c.storage, c.scope).pending!;
    await assert.rejects(
      updateCart(c.storage, c.scope, c.lock, () => ({ milk: 2 })),
      /pending order/,
    );
    const recovered = await submitBasket(
      c.storage,
      c.scope,
      c.lock,
      { ...c.details, slot: "different", substitution: "ask" },
      c.send,
      () => "must-not-use",
    );
    assert.equal(recovered.id, committed.id);
    assert.equal(pending.key, "key-1");
    assert.equal(c.service.one("SELECT count(*) n FROM orders")!.n, 1);
    assert.equal(
      c.service.one("SELECT stock FROM products WHERE id='milk'")!.stock,
      34,
    );
    assert.deepEqual(readBasket(c.storage, c.scope), { cart: {} });
  } finally {
    c.db.close();
  }
});
test("double clicks / two coordinated tabs create only one order", async () => {
  const c = setup();
  try {
    const results = await Promise.allSettled([c.submit(), c.submit()]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(c.service.one("SELECT count(*) n FROM orders")!.n, 1);
    assert.equal(c.keys(), 1);
  } finally {
    c.db.close();
  }
});
test("unknown failure before commit retains key for retry", async () => {
  const c = setup();
  try {
    await assert.rejects(
      c.submit(async () => {
        throw new Error("offline");
      }),
    );
    assert.ok(readBasket(c.storage, c.scope).pending);
    await c.submit();
    assert.equal(c.keys(), 1);
  } finally {
    c.db.close();
  }
});
test("explicit transactional rejection unlocks cart for correction", async () => {
  const c = setup();
  try {
    await assert.rejects(
      c.submit(async () => {
        throw new CheckoutRejected("Slot full");
      }),
    );
    assert.equal(readBasket(c.storage, c.scope).pending, undefined);
    await updateCart(c.storage, c.scope, c.lock, () => ({ milk: 2 }));
    await c.submit();
    assert.equal(c.keys(), 2);
  } finally {
    c.db.close();
  }
});
test("unavailable storage prevents sending any order", async () => {
  const c = setup();
  try {
    c.storage.setItem = () => {
      throw new Error("quota");
    };
    await assert.rejects(c.submit(), /quota/);
    assert.equal(c.service.one("SELECT count(*) n FROM orders")!.n, 0);
  } finally {
    c.db.close();
  }
});
test("failed cleanup after success retains replayable request", async () => {
  const c = setup();
  try {
    const write = c.storage.setItem;
    c.storage.setItem = (k, v) => {
      if (!JSON.parse(v).pending) throw new Error("quota");
      write(k, v);
    };
    await assert.rejects(c.submit(), /quota/);
    c.storage.setItem = write;
    await c.submit();
    assert.equal(c.service.one("SELECT count(*) n FROM orders")!.n, 1);
  } finally {
    c.db.close();
  }
});
test("malformed confirmation and corrupt saved state fail closed", async () => {
  const c = setup();
  try {
    await assert.rejects(
      c.submit(async () => ({}) as any),
      /incomplete/,
    );
    assert.ok(readBasket(c.storage, c.scope).pending);
    c.storage.setItem(c.scope, "broken");
    await assert.rejects(c.submit());
    assert.equal(c.service.one("SELECT count(*) n FROM orders")!.n, 0);
  } finally {
    c.db.close();
  }
});
test("confirmed order stays cleared if later bootstrap refresh fails", async () => {
  const c = setup();
  try {
    await c.submit();
    await assert.rejects(Promise.reject(new Error("bootstrap unavailable")));
    await assert.rejects(c.submit(), /empty/);
    assert.equal(c.service.one("SELECT count(*) n FROM orders")!.n, 1);
  } finally {
    c.db.close();
  }
});
