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
assert.deepEqual((await a("/api/demo/demo-access")).data,{staffAllowed:false});
for(const actor of ["admin","warehouse","rider1","rider2","service","tech1","tech2","tech3","platform"]){
 const denied=await a("/api/demo/demo-login","POST",{actor,staffAllowed:true,owner:true});
 assert.equal(denied.status,403,actor+" must require the real founder session");
 assert.equal((await a("/api/demo/bootstrap")).data.user.id,"resident");
}
assert.equal((await a("/api/demo/orders/"+order.data.id,"PATCH",{status:"picking"})).status,403);
for(const actor of ["neighbor","owner","pending","sky-resident","sky-neighbor","sky-family"])
 assert.equal((await b("/api/demo/demo-login","POST",{actor})).status,200);
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
  "PASS: isolated reviewers, resident persona switching, idempotent checkout, all nine staff personas denied without founder authentication, reset, safe sample and production-auth boundary.",
);
