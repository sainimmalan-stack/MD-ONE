import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  DurableShowcaseSessions,
  PreviewExpired,
  previewTokenHash,
  type ShowcaseSnapshotStore,
} from "../lib/durable-showcase.ts";
import {
  MemoryShowcaseStore,
  SupabaseShowcaseStore,
} from "../lib/showcase-store.ts";
import { Service } from "../lib/service.ts";
import { withSyntheticVault, encrypt, decrypt } from "../lib/db.ts";
const secret = () => randomBytes(32).toString("hex");

test("a different worker restores residents, changes, actor sessions and the same vault key", async () => {
  const store = new MemoryShowcaseStore(),
    key = secret();
  const a = new DurableShowcaseSessions(store, key);
  const first = await a.run(undefined, true, async (s) => {
    const actor = new Service(s.db).login("resident");
    s.db
      .prepare("INSERT INTO expenses VALUES(?,?,?,?,?,?,?)")
      .run(
        "durable-test",
        "resident",
        "Synthetic durable expense",
        "Other",
        4200,
        "expense",
        "2026-10-19",
      );
    return {
      actor: actor.token,
      vault: withSyntheticVault(s.vaultKey, () =>
        encrypt(Buffer.from("SYNTHETIC SECRET")),
      ),
      run: s.runId,
    };
  });
  const b = new DurableShowcaseSessions(store, key);
  const second = await b.run(first.token, false, async (s) => {
    assert.equal(new Service(s.db).auth(first.result.actor).id, "resident");
    assert.equal(
      s.db.prepare("SELECT amount FROM expenses WHERE id=?").get("durable-test")
        ?.amount,
      4200,
    );
    assert.equal(
      withSyntheticVault(s.vaultKey, () =>
        decrypt(first.result.vault).toString(),
      ),
      "SYNTHETIC SECRET",
    );
    assert.equal(s.runId, first.result.run);
    return s.requests;
  });
  assert.equal(second.created, false);
  assert.equal(second.token, first.token);
  assert.equal(second.result, 2);
});
test("two reviewers remain isolated across workers and reset cannot recreate old data", async () => {
  const store = new MemoryShowcaseStore(),
    key = secret(),
    a = new DurableShowcaseSessions(store, key),
    b = new DurableShowcaseSessions(store, key);
  const first = await a.run(undefined, true, async (s) => {
    s.db.prepare("UPDATE expenses SET amount=42").run();
    return s.runId;
  });
  const other = await b.run(undefined, true, async (s) => {
    assert.notEqual(s.runId, first.result);
    assert.equal(
      s.db.prepare("SELECT count(*) n FROM expenses WHERE amount=42").get()?.n,
      0,
    );
    return true;
  });
  await b.reset(first.token);
  await assert.rejects(
    a.run(first.token, false, async () => true),
    PreviewExpired,
  );
  assert.equal(
    (await a.run(other.token, false, async () => true)).result,
    true,
  );
});
test("snapshot authentication rejects tampering and key changes before SQLite restore", async () => {
  const memory = new MemoryShowcaseStore(),
    key = secret();
  let sealed = "";
  const store: ShowcaseSnapshotStore = {
    acquire: (h, c) => memory.acquire(h, c),
    commit: async (h, l, p) => {
      sealed = p;
      await memory.commit(h, l, p);
    },
    release: (h, l) => memory.release(h, l),
    reset: (h) => memory.reset(h),
  };
  const a = new DurableShowcaseSessions(store, key),
    first = await a.run(undefined, true, async () => true);
  assert.ok(sealed.length > 100);
  assert.ok(!Buffer.from(sealed, "base64").includes(Buffer.from("Ananya")));
  await assert.rejects(
    new DurableShowcaseSessions(store, secret()).run(
      first.token,
      false,
      async () => true,
    ),
  );
  assert.equal(
    (await a.run(first.token, false, async () => true)).result,
    true,
  );
  const corrupt: ShowcaseSnapshotStore = {
    ...store,
    acquire: async (h, c) => {
      const l = await store.acquire(h, c);
      if (l?.payload) {
        const raw = Buffer.from(l.payload, "base64");
        raw[20] ^= 1;
        l.payload = raw.toString("base64");
      }
      return l;
    },
  };
  await assert.rejects(
    new DurableShowcaseSessions(corrupt, key).run(
      first.token,
      false,
      async () => {
        throw Error("must not execute");
      },
    ),
    /authenticate|authenticat/i,
  );
});
test("lease expiry, reset and stale revisions fence off old workers", async () => {
  let time = 0;
  const store = new MemoryShowcaseStore(() => time, 100),
    hash = previewTokenHash(secret());
  const a = (await store.acquire(hash, true))!;
  await assert.rejects(store.acquire(hash, false), /busy/);
  time = 101;
  const b = (await store.acquire(hash, false))!;
  await assert.rejects(store.commit(hash, a, "old"), /Stale/);
  await store.commit(hash, b, "new");
  const c = (await store.acquire(hash, false))!;
  assert.equal(c.payload, "new");
  await store.reset(hash);
  await assert.rejects(store.commit(hash, c, "resurrection"), /Stale/);
  assert.equal(await store.acquire(hash, false), null);
});
test("failed work releases the lease and never overwrites the confirmed snapshot", async () => {
  const store = new MemoryShowcaseStore(),
    a = new DurableShowcaseSessions(store, secret());
  const first = await a.run(undefined, true, async () => true);
  await assert.rejects(
    a.run(first.token, false, async (s) => {
      s.db.prepare("UPDATE expenses SET amount=42").run();
      throw new Error("simulated failure");
    }),
    /simulated failure/,
  );
  await a.run(first.token, false, async (s) =>
    assert.equal(
      s.db.prepare("SELECT count(*) n FROM expenses WHERE amount=42").get()?.n,
      0,
    ),
  );
  await assert.rejects(
    a.run("forged", false, async () => true),
    PreviewExpired,
  );
});
test("RPC adapter waits for the distributed lease and refuses an unconfirmed commit", async () => {
  const original = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init!.body as string);
    assert.equal(body.p_key, "server-only-fixture");
    if (body.p_action === "acquire") {
      attempts++;
      return Response.json(
        attempts === 1
          ? { status: "busy" }
          : { status: "ok", lease: "lease-2", revision: 2, payload: "sealed" },
      );
    }
    return Response.json({ status: "stale" });
  };
  try {
    const store = new SupabaseShowcaseStore(
      "https://example.invalid",
      "public-key",
      "server-only-fixture",
    );
    const lease = (await store.acquire("a".repeat(64), false))!;
    assert.equal(attempts, 2);
    assert.equal(lease.revision, 2);
    await assert.rejects(
      store.commit("a".repeat(64), lease, "payload"),
      /not confirmed/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("the renamed built-in MD One sample is downloadable; arbitrary text stays quarantined", async () => {
  const sessions = new DurableShowcaseSessions(
    new MemoryShowcaseStore(),
    secret(),
  );
  await sessions.run(undefined, true, async (state) =>
    withSyntheticVault(state.vaultKey, () => {
      const service = new Service(state.db),
        login = service.login("resident");
      state.db
        .prepare("UPDATE sessions SET stepup_until=?")
        .run(new Date(Date.now() + 300000).toISOString());
      const user = service.auth(login.token);
      const sample = service.upload(user, {
        name: "Sample property record.txt",
        folder: "Property",
        mime: "text/plain",
        data: Buffer.from(
          "MD One synthetic sample document. No personal information.",
        ).toString("base64"),
      });
      assert.equal(sample.status, "clean");
      assert.equal(
        service.document(user, sample.id).data.toString(),
        "MD One synthetic sample document. No personal information.",
      );
      const other = service.upload(user, {
        name: "not-sample.txt",
        folder: "Property",
        mime: "text/plain",
        data: Buffer.from("unverified content").toString("base64"),
      });
      assert.equal(other.status, "quarantined");
      assert.throws(() => service.document(user, other.id), /quarantined/);
    }),
  );
});

test("new workers carry grocery checkout through delivery and a service request through technician completion", async () => {
  const { Social } = await import("../lib/social.ts");
  const store = new MemoryShowcaseStore(),
    key = secret();
  let token: string | undefined;
  const run = async (
    actor: string,
    work: (s: Service, u: Record<string, any>) => any,
  ) => {
    const worker = new DurableShowcaseSessions(store, key);
    const outcome = await worker.run(token, !token, async (session) =>
      withSyntheticVault(session.vaultKey, () => {
        const service = new Service(session.db),
          signed = service.login(actor);
        return work(service, service.auth(signed.token));
      }),
    );
    token = outcome.token;
    return outcome.result;
  };
  const order = await run("resident", (s, u) =>
    s.checkout(u, {
      flatId: "f1",
      key: "durable-checkout",
      items: [{ id: "milk", qty: 1 }],
      payment: "cod",
      substitution: "none",
      slot: s.slots()[0].id,
    }),
  );
  for (const status of ["picking", "packed"])
    await run("warehouse", (s, u) => s.updateOrder(u, order.id, { status }));
  await run("warehouse", (s, u) =>
    s.updateOrder(u, order.id, { status: "out_for_delivery", riderId: "r1" }),
  );
  await run("rider1", (s, u) =>
    s.updateOrder(u, order.id, { status: "delivered", otp: "123456" }),
  );
  await run("resident", (s, u) =>
    assert.equal(
      s.orders(u).find((o) => o.id === order.id)?.status,
      "delivered",
    ),
  );
  const request = await run("resident", (s, u) =>
    new Social(s).requestService(u, {
      flatId: "f1",
      categoryId: "plumbing",
      description: "Synthetic durable tap repair",
      preferred: "Tomorrow",
    }),
  );
  await run("service", (s, u) =>
    new Social(s).serviceAction(u, request.id, {
      status: "assigned",
      technicianId: "t1",
    }),
  );
  for (const status of ["en_route", "in_progress", "completed"])
    await run("tech1", (s, u) =>
      new Social(s).serviceAction(u, request.id, { status }),
    );
  await run("resident", (s, u) =>
    assert.equal(
      new Social(s).serviceRequests(u).find((r) => r.id === request.id)?.status,
      "completed",
    ),
  );
});
