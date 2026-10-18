import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.SHOWCASE_TEST_URL || "http://127.0.0.1:3001";
if (
  !["127.0.0.1", "localhost"].includes(new URL(base).hostname) &&
  !(
    base === "https://emd1.vercel.app" &&
    process.env.MD_ONE_VERIFY_HOSTED_DEMO === "1"
  )
)
  throw new Error(
    "Use localhost, or explicitly opt into the MD One synthetic demo only.",
  );
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
    return {
      status: r.status,
      data: r.headers.get("content-type")?.includes("application/json")
        ? await r.json()
        : await r.text(),
      headers: r.headers,
    };
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
assert.deepEqual((await a("/api/demo/demo-access")).data, {
  staffAllowed: false,
});
for (const actor of [
  "admin",
  "warehouse",
  "rider1",
  "rider2",
  "service",
  "tech1",
  "tech2",
  "tech3",
  "platform",
]) {
  const denied = await a("/api/demo/demo-login", "POST", {
    actor,
    staffAllowed: true,
    owner: true,
  });
  assert.equal(
    denied.status,
    403,
    actor + " must require the real founder session",
  );
  assert.equal((await a("/api/demo/bootstrap")).data.user.id, "resident");
}
assert.equal(
  (await a("/api/demo/orders/" + order.data.id, "PATCH", { status: "picking" }))
    .status,
  403,
);
for (const actor of [
  "neighbor",
  "owner",
  "pending",
  "sky-resident",
  "sky-neighbor",
  "sky-family",
])
  assert.equal(
    (await b("/api/demo/demo-login", "POST", { actor })).status,
    200,
  );
assert.equal((await a("/api/personal")).status, 401);
assert.equal(
  (
    await a("/api/demo/demo-login", "POST", {
      actor: "actual-user@example.invalid",
    })
  ).status,
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
// All mutations below target the reviewer's isolated synthetic session only.
const ok = async (path, method = "GET", body) => {
  const r = await a("/api/demo/" + path, method, body);
  assert.ok(r.status >= 200 && r.status < 300, path + ": " + JSON.stringify(r));
  return r.data;
};
const persona = (actor) => ok("demo-login", "POST", { actor });
const expense = await ok("expenses", "POST", {
  description: "Synthetic QA groceries",
  category: "Groceries",
  amount: 12500,
  kind: "expense",
  date: new Date().toISOString().slice(0, 10),
});
const loan = await ok("loans", "POST", {
  title: "Synthetic QA loan",
  principal: 350000000,
  rate: 8.5,
  months: 240,
  dueDay: 5,
});
await ok("loan-payment", "POST", {
  loanId: loan.id,
  month: new Date().toISOString().slice(0, 7),
  amount: 3037381,
});
let persisted = await ok("bootstrap");
assert.ok(persisted.expenses.some((e) => e.id === expense.id));
assert.ok(persisted.loanPayments.some((e) => e.loan_id === loan.id));
const emi = await ok("emi", "POST", {
  principal: 3500000,
  rate: 8.5,
  months: 240,
});
assert.equal(Math.round(emi.emi * 100) / 100, 30373.81);
assert.equal(
  (await ok("documents/" + sample.data.id)).includes("MD One synthetic sample"),
  true,
);
const post = await ok("social-posts", "POST", {
  body: "Synthetic QA community post",
  visibility: "project",
});
await ok("friends/neighbor", "POST", { action: "request" });
await persona("neighbor");
await ok("friends/resident", "POST", { action: "accept" });
await ok("social-posts/" + post.id, "POST", { action: "like" });
await ok("social-posts/" + post.id, "POST", {
  action: "comment",
  body: "Synthetic QA reply",
});
const ride = await ok("rides", "POST", {
  pickup: "TEST Nest entrance",
  destination: "TEST office",
  departure: new Date(Date.now() + 86400000).toISOString(),
  seats: 2,
  recurrence: "once",
});
const item = await ok("exchange", "POST", {
  key: randomUUID(),
  projectId: "p1",
  title: "Synthetic QA chair",
  description: "Synthetic item for QA",
  category: "Furniture",
  condition: "Good",
  type: "sale",
  price: 10000,
  audience: "project",
  status: "active",
  photos: [],
  exchangePreference: "",
});
const home = await ok("homes", "POST", {
  key: randomUUID(),
  flatId: "f2",
  purpose: "rent",
  title: "Synthetic QA home",
  description: "Synthetic property for QA",
  bhk: 2,
  area: 1200,
  floor: 2,
  furnishing: "Semi-furnished",
  parking: 1,
  available: new Date().toISOString().slice(0, 10),
  price: 2500000,
  deposit: 5000000,
  photos: [],
});
await persona("resident");
await ok("rides/" + ride.id, "PATCH", { action: "request" });
const enquiry = await ok("exchange/" + item.id + "/action", "POST", {
  action: "enquire",
});
await ok("exchange/conversations/" + enquiry.id, "POST", {
  key: randomUUID(),
  body: "Synthetic QA enquiry",
});
await ok("homes/" + home.id + "/action", "POST", { action: "interest" });
persisted = await ok("bootstrap");
const event = persisted.events.find(
  (e) => !e.joined && e.attending < e.capacity,
);
assert.ok(event);
await ok("events/" + event.id, "POST", { volunteer: true });
assert.ok((await ok("bootstrap")).events.find((e) => e.id === event.id).joined);
await ok("events/" + event.id, "POST", { cancel: true });
const service = await ok("insta-services", "POST", {
  flatId: "f1",
  categoryId: persisted.social.services[0].id,
  description: "Synthetic QA tap repair",
  urgency: "routine",
  preferred: "Demo only",
});
assert.ok(
  (await ok("bootstrap")).social.requests.some((r) => r.id === service.id),
);
await persona("neighbor");
const ownRide = (await ok("bootstrap")).rides.find((r) => r.id === ride.id);
const riderRequest = ownRide.requests.find((r) => r.user_id === "resident");
assert.ok(riderRequest);
await ok("rides/" + ride.id, "PATCH", {
  action: "accept",
  requestId: riderRequest.id,
});
assert.ok(
  (await ok("exchange/conversations/" + enquiry.id)).some(
    (m) => m.body === "Synthetic QA enquiry",
  ),
);
const homeDetail = await ok("homes/" + home.id);
const interest = homeDetail.interests.find((i) => i.user_id === "resident");
assert.ok(interest);
await ok("homes/" + home.id + "/action", "POST", {
  action: "accept",
  requestId: interest.id,
});
const month = new Date().toISOString().slice(0, 7);
const period = await ok("my-project/p1/billing", "POST", {
  action: "draft",
  month,
});
await ok("my-project/p1/billing", "POST", {
  action: "review",
  periodId: period.id,
});
await ok("my-project/p1/billing", "POST", {
  action: "publish",
  periodId: period.id,
});
await persona("resident");
const workspace = await ok("my-project/p1");
assert.ok(workspace.invoices.length > 0);
await persona("pending");
assert.equal(
  (
    await a("/api/demo/social-posts", "POST", {
      body: "denied",
      visibility: "project",
    })
  ).status,
  403,
);
await persona("resident");
assert.ok((await ok("bootstrap")).expenses.some((e) => e.id === expense.id));
console.log(
  "PASS: snapshot persistence, private expenses/loan payments/EMI/documents, community post/friends/replies, carpool request/accept, marketplace enquiry, home rental interest/accept, event RSVP/cancel, service request and committee billing.",
);
await a("/api/demo/demo-reset", "POST", {});
assert.equal((await a("/api/demo/bootstrap")).status, 401);
await a("/api/demo/demo-login", "POST", { actor: "resident" });
assert.ok(
  !(await a("/api/demo/orders")).data.some((o) => o.id === order.data.id),
);
console.log(
  "PASS: isolated reviewers, resident persona switching, idempotent checkout, all nine staff personas denied without founder authentication, reset, safe sample and production-auth boundary.",
);
