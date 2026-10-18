import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.SHOWCASE_TEST_URL || "http://127.0.0.1:3001";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw new Error("Run this synthetic smoke test against localhost only.");
function client() {
  const cookies = new Map();
  return async (path, method = "GET", body) => {
    const r = await fetch(base + path, {
      method,
      headers: {
        Origin: base,
        Cookie: [...cookies].map(([k, v]) => k + "=" + v).join("; "),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const cookie of r.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const at = pair.indexOf("=");
      cookies.set(pair.slice(0, at), pair.slice(at + 1));
      assert.ok(!/^md_one_(access|refresh)=/.test(pair));
    }
    return { status: r.status, data: await r.json(), headers: r.headers };
  };
}
const a = client(),
  b = client();
assert.equal((await a("/api/demo/bootstrap")).status, 401);
for (const c of [a, b])
  assert.equal(
    (await c("/api/demo/demo-login", "POST", { actor: "resident" })).status,
    200,
  );
const boot = (await a("/api/demo/bootstrap")).data;
const p = boot.products.find((p) => p.stock > 0);
assert.equal(boot.user.id, "resident");
assert.equal(boot.mode, "showcase");
const payload = {
  key: randomUUID(),
  flatId: boot.active.flat_id,
  slot: boot.slots.find((s) => s.remaining > 0).id,
  items: [{ id: p.id, qty: 1 }],
  payment: "cod",
  substitution: "none",
};
const order = await a("/api/demo/orders", "POST", payload);
assert.equal(order.status, 201, JSON.stringify(order.data));
const replay = await a("/api/demo/orders", "POST", payload);
assert.equal(replay.data.id, order.data.id);
assert.ok(
  !(await b("/api/demo/orders")).data.some((o) => o.id === order.data.id),
);
assert.equal(
  (
    await b("/api/demo/orders/" + order.data.id, "PATCH", {
      status: "cancelled",
    })
  ).status,
  404,
);
await a("/api/demo/demo-login", "POST", { actor: "warehouse" });
for (const status of ["picking", "packed", "out_for_delivery"])
  assert.equal(
    (
      await a("/api/demo/orders/" + order.data.id, "PATCH", {
        status,
        riderId: "r1",
      })
    ).status,
    200,
  );
await a("/api/demo/demo-login", "POST", { actor: "rider1" });
assert.equal(
  (
    await a("/api/demo/orders/" + order.data.id, "PATCH", {
      status: "delivered",
      otp: "123456",
    })
  ).status,
  200,
);
await a("/api/demo/demo-login", "POST", { actor: "resident" });
const complete = (await a("/api/demo/orders")).data.find(
  (o) => o.id === order.data.id,
);
assert.equal(complete.status, "delivered");
assert.equal(complete.payment, "cod_collected");
assert.equal((await a("/api/personal")).status, 401);
assert.equal(
  (await a("/api/demo/demo-login", "POST", { actor: "actual-user@example.invalid" }))
    .status,
  400,
);
assert.equal(
  (
    await a("/api/demo/my-profile", "POST", {
      photo: "data:image/png;base64,aGVsbG8=",
    })
  ).status,
  400,
);
await a("/api/demo/vault-unlock", "POST", {});
const sample = await a("/api/demo/documents", "POST", {
  name: "Sample property record.txt",
  folder: "Property",
  mime: "text/plain",
  data: Buffer.from(
    "MD One synthetic sample document. No personal information.",
  ).toString("base64"),
});
assert.equal(sample.status, 201, JSON.stringify(sample.data));
await a("/api/demo/demo-reset", "POST", {});
assert.equal((await a("/api/demo/bootstrap")).status, 401);
await a("/api/demo/demo-login", "POST", { actor: "resident" });
assert.ok(
  !(await a("/api/demo/orders")).data.some((o) => o.id === order.data.id),
);
console.log(
  "PASS: isolated reviewers, persona switching, idempotent demo checkout → delivery, reset, safe sample, media rejection and production-auth boundary.",
);
