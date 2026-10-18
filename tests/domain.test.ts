import test from "node:test";
import { randomBytes } from "node:crypto";
process.env.MDP_LOCAL_VAULT_KEY ||= randomBytes(32).toString("hex");
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { openDatabase, now, id, hash } from "../lib/db.ts";
import { Service, AppError } from "../lib/service.ts";
import { amortize } from "../lib/finance.ts";
function setup() {
  const db = openDatabase(":memory:"),
    s = new Service(db);
  const user = (uid: string) => s.one("SELECT * FROM users WHERE id=?", uid)!;
  return { db, s, user };
}
function body(s: Service, key: string = id(), qty = 1) {
  return {
    flatId: "f1",
    key,
    items: [{ id: "milk", qty }],
    payment: "cod",
    substitution: "none",
    slot: s.slots()[0].id,
  };
}
const denied = (fn: () => unknown, status = 403) =>
  assert.throws(
    fn,
    (e: unknown) => e instanceof AppError && e.status === status,
  );
test("seed is complete and projects do not infer delivery eligibility", () => {
  const { s, db } = setup();
  assert.equal(s.all("SELECT * FROM projects").length, 19);
  assert.equal(
    s.all("SELECT * FROM projects WHERE status='completed'").length,
    13,
  );
  assert.equal(s.all("SELECT * FROM riders").length, 2);
  assert.equal(s.all("SELECT * FROM services WHERE groceries=1").length, 1);
  db.close();
});
test("opaque sessions expire; deleted actors cannot authenticate", () => {
  const { s, db } = setup();
  const a = s.login("resident");
  assert.equal(s.auth(a.token).id, "resident");
  denied(() => s.auth("resident"), 401);
  s.run("UPDATE sessions SET expires=?", new Date(0).toISOString());
  denied(() => s.auth(a.token), 401);
  db.close();
});
test("cross-user finance, orders and private documents stay isolated", () => {
  const { s, user, db } = setup();
  const a = s.bootstrap(user("resident")),
    b = s.bootstrap(user("neighbor")),
    admin = s.bootstrap(user("platform"));
  assert.equal(a.expenses.length, 2);
  assert.equal(b.expenses.length, 0);
  assert.equal(admin.expenses.length, 0);
  denied(() => s.operations(user("resident")));
  denied(() => s.document(user("platform"), "missing"), 403);
  db.close();
});
test("stock reservation and idempotency bind a checkout to its payload", () => {
  const { s, user, db } = setup();
  const b = body(s, "checkout-1", 2),
    u = user("resident"),
    o = s.checkout(u, b);
  assert.equal(
    s.one("SELECT stock FROM products WHERE id=?", "milk")!.stock,
    33,
  );
  assert.equal(s.checkout(u, b).id, o.id);
  assert.equal(
    s.one("SELECT stock FROM products WHERE id=?", "milk")!.stock,
    33,
  );
  denied(() => s.checkout(u, { ...b, items: [{ id: "milk", qty: 3 }] }), 409);
  assert.equal(s.orders(user("neighbor")).length, 0);
  db.close();
});
test("insufficient inventory rolls back the entire order", () => {
  const { s, user, db } = setup();
  const b = {
    ...body(s),
    items: [
      { id: "milk", qty: 1 },
      { id: "rice", qty: 20 },
    ],
  };
  denied(() => s.checkout(user("resident"), b), 409);
  assert.equal(
    s.one("SELECT stock FROM products WHERE id=?", "milk")!.stock,
    35,
  );
  assert.equal(s.all("SELECT * FROM orders").length, 0);
  db.close();
});
test("expired batches are never sold and cancellation preserves original expiries", () => {
  const { s, user, db } = setup();
  const before = s.one("SELECT * FROM batches WHERE product_id=?", "milk")!;
  const o = s.checkout(user("resident"), body(s));
  s.updateOrder(user("resident"), o.id, { status: "cancelled" });
  assert.equal(
    s.one("SELECT expiry FROM batches WHERE id=?", before.id)!.expiry,
    before.expiry,
  );
  assert.equal(
    s.one("SELECT stock FROM products WHERE id=?", "milk")!.stock,
    35,
  );
  denied(
    () => s.updateOrder(user("resident"), o.id, { status: "cancelled" }),
    409,
  );
  s.run(
    "UPDATE batches SET expiry=? WHERE product_id=?",
    new Date(0).toISOString(),
    "milk",
  );
  denied(() => s.checkout(user("resident"), body(s)), 409);
  db.close();
});
test("capacity is bounded by exactly two riders; charging removes capacity", () => {
  const { s, user, db } = setup();
  const slot = s.slots()[0].id;
  for (let i = 0; i < 6; i++)
    s.checkout(user("resident"), { ...body(s), slot });
  denied(() => s.checkout(user("resident"), { ...body(s), slot }), 409);
  s.run("UPDATE riders SET charging=1");
  assert.equal(s.slots()[0].remaining, 0);
  db.close();
});
test("fulfillment enforces states, assignment and delivery confirmation", () => {
  const { s, user, db } = setup();
  const o = s.checkout(user("resident"), body(s));
  denied(() => s.updateOrder(user("resident"), o.id, { status: "packed" }));
  denied(
    () => s.updateOrder(user("warehouse"), o.id, { status: "packed" }),
    409,
  );
  s.updateOrder(user("warehouse"), o.id, { status: "picking" });
  s.updateOrder(user("warehouse"), o.id, { status: "packed" });
  s.updateOrder(user("warehouse"), o.id, {
    status: "out_for_delivery",
    riderId: "r1",
  });
  denied(() =>
    s.updateOrder(user("rider2"), o.id, { status: "delivered", otp: "123456" }),
  );
  denied(
    () =>
      s.updateOrder(user("rider1"), o.id, {
        status: "delivered",
        otp: "000000",
      }),
    400,
  );
  s.updateOrder(user("rider1"), o.id, { status: "delivered", otp: "123456" });
  assert.equal(
    s.one("SELECT payment FROM orders WHERE id=?", o.id)!.payment,
    "cod_collected",
  );
  denied(() =>
    s.updateOrder(user("rider1"), o.id, { status: "delivered", otp: "123456" }),
  );
  db.close();
});
test("move-out revokes community and commerce without erasing personal finance", () => {
  const { s, user, db } = setup();
  const mid = s.one(
    "SELECT id FROM memberships WHERE user_id=?",
    "resident",
  )!.id;
  s.membershipAction(user("admin"), mid, { status: "expired" });
  denied(() => s.checkout(user("resident"), body(s)));
  denied(() => s.rides(user("resident")));
  denied(() => s.events(user("resident")));
  assert.equal(s.bootstrap(user("resident")).expenses.length, 2);
  db.close();
});
test("association approval is project scoped; future projects have no delivery by default", () => {
  const { s, user, db } = setup();
  const mid = s.one(
    "SELECT id FROM memberships WHERE user_id=?",
    "outsider",
  )!.id;
  denied(() => s.membershipAction(user("admin"), mid, { status: "expired" }));
  denied(() => s.checkout(user("owner"), { ...body(s), flatId: "f4" }));
  db.close();
});
test("events are scoped and network participation is opt-in", () => {
  const { s, user, db } = setup();
  const u = user("resident");
  assert.deepEqual(
    s.events(u).map((e) => e.id),
    ["event1"],
  );
  denied(() => s.rsvp(u, "event3", {}));
  denied(() => s.rsvp(u, "event2", {}));
  s.preferences(u, { language: "en", network: true, notifications: false });
  assert.equal(s.events(u).length, 2);
  s.rsvp(u, "event2", {});
  s.rsvp(u, "event2", {});
  assert.equal(
    s.one("SELECT count(*) n FROM rsvps WHERE event_id=?", "event2")!.n,
    1,
  );
  db.close();
});
test("carpool requests require driver approval and cannot overbook", () => {
  const { s, user, db } = setup();
  s.run("UPDATE rides SET seats=1 WHERE id=?", "ride1");
  s.rideAction(user("resident"), "ride1", { action: "request" });
  s.rideAction(user("outsider"), "ride1", { action: "request" });
  const qs = s.all("SELECT * FROM ride_requests WHERE ride_id=?", "ride1");
  s.rideAction(user("neighbor"), "ride1", {
    action: "accept",
    requestId: qs[0].id,
  });
  denied(
    () =>
      s.rideAction(user("neighbor"), "ride1", {
        action: "accept",
        requestId: qs[1].id,
      }),
    409,
  );
  assert.equal(s.one("SELECT seats FROM rides WHERE id=?", "ride1")!.seats, 0);
  db.close();
});
test("vault enforces step-up, encryption, quarantine, recipient, expiry and revocation", () => {
  const { s, user, db } = setup();
  const owner = {
      ...user("resident"),
      stepup_until: new Date(Date.now() + 300000).toISOString(),
    },
    neighbor = { ...user("neighbor"), stepup_until: owner.stepup_until };
  const sample = Buffer.from(
    "MDP Living synthetic sample document. No personal information.",
  ).toString("base64");
  const d = s.upload(owner, {
    name: "sample.txt",
    folder: "Property",
    mime: "text/plain",
    data: sample,
  });
  assert.notEqual(
    s.one("SELECT encrypted FROM documents WHERE id=?", d.id)!.encrypted,
    sample,
  );
  denied(() => s.document(user("resident"), d.id));
  denied(() => s.document(neighbor, d.id), 404);
  const sh = s.share(owner, d.id, {
    recipientId: "neighbor",
    expires: new Date(Date.now() + 100000).toISOString(),
  });
  assert.match(s.document(neighbor, d.id, sh.id).data.toString(), /synthetic/);
  s.run("UPDATE shares SET revoked=1 WHERE id=?", sh.id);
  denied(() => s.document(neighbor, d.id, sh.id), 404);
  s.run(
    "UPDATE shares SET revoked=0,expires=? WHERE id=?",
    new Date(0).toISOString(),
    sh.id,
  );
  denied(() => s.document(neighbor, d.id, sh.id), 404);
  const q = s.upload(owner, {
    name: "test.pdf",
    folder: "Property",
    mime: "application/pdf",
    data: Buffer.from("%PDF-1.4 sample").toString("base64"),
  });
  denied(() => s.document(owner, q.id), 423);
  db.close();
});
test("EMI handles known repayment, zero interest, prepayment and invalid inputs", () => {
  const a = amortize(100000, 12, 12);
  assert.equal(a.emi, 8884.88);
  assert.equal(a.schedule.at(-1)?.balance, 0);
  assert.equal(amortize(120000, 0, 12).emi, 10000);
  assert.equal(amortize(120000, 0, 12).totalInterest, 0);
  assert.ok(amortize(3500000, 8.5, 240, 10000).months < 240);
  assert.throws(() => amortize(1000, 8, 0));
  assert.throws(() => amortize(NaN, 8, 12));
  assert.throws(() => amortize(1000, 8, 12, -1));
});
test("production mode fails closed instead of using demo credentials", () => {
  const prev = process.env.MDP_MODE;
  process.env.MDP_MODE = "production";
  assert.throws(() => openDatabase(":memory:"), /Production adapter/);
  if (prev === undefined) delete process.env.MDP_MODE;
  else process.env.MDP_MODE = prev;
});
function worker(
  file: string,
  action: string,
  extra: Record<string, unknown> = {},
) {
  return new Promise<Record<string, any>>((resolve, reject) => {
    const w = new Worker(new URL("./race-worker.ts", import.meta.url), {
      workerData: { file, action, ...extra },
    });
    w.on("message", resolve);
    w.on("error", reject);
    w.on("exit", (code) => {
      if (code) reject(new Error(`worker exit ${code}`));
    });
  });
}
test("parallel database connections cannot oversell stock", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mdp-stock-")),
    file = join(dir, "race.sqlite");
  const db = openDatabase(file),
    s = new Service(db),
    slot = s.slots()[0].id;
  db.close();
  try {
    const results = await Promise.all([
      worker(file, "checkout", { slot }),
      worker(file, "checkout", { slot }),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    const d = openDatabase(file);
    assert.equal(
      (d.prepare("SELECT stock FROM products WHERE id='milk'").get() as any)
        .stock,
      15,
    );
    d.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("parallel seat approvals across connections cannot overbook", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mdp-seat-")),
    file = join(dir, "race.sqlite");
  const db = openDatabase(file),
    s = new Service(db);
  s.run("UPDATE rides SET seats=1 WHERE id='ride1'");
  for (const uid of ["resident", "outsider"])
    s.rideAction(s.one("SELECT * FROM users WHERE id=?", uid)!, "ride1", {
      action: "request",
    });
  const qs = s.all("SELECT * FROM ride_requests");
  db.close();
  try {
    const results = await Promise.all(
      qs.map((q) => worker(file, "accept", { requestId: q.id })),
    );
    assert.equal(results.filter((r) => r.ok).length, 1);
    const d = openDatabase(file);
    assert.equal(
      (d.prepare("SELECT seats FROM rides WHERE id='ride1'").get() as any)
        .seats,
      0,
    );
    d.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Social expansion: every privacy boundary is checked on the server, not in CSS.

test("carpool phone consent is journey-specific and revealed only after acceptance", () => {
  const { s, user, db } = setup();
  s.rideAction(user("neighbor"), "ride1", {
    action: "share_contact",
    contact: "+919876543210",
  });
  assert.equal(
    s.rides(user("resident")).find((r) => r.id === "ride1")!.contact,
    null,
  );
  denied(() =>
    s.rideAction(user("resident"), "ride1", {
      action: "share_contact",
      contact: "9876543210",
    }),
  );
  s.rideAction(user("resident"), "ride1", { action: "request" });
  const q = s.one(
    "SELECT * FROM ride_requests WHERE ride_id='ride1' AND user_id='resident'",
  )!;
  assert.equal(
    s.rides(user("resident")).find((r) => r.id === "ride1")!.contact,
    null,
  );
  s.rideAction(user("neighbor"), "ride1", {
    action: "accept",
    requestId: q.id,
  });
  assert.equal(
    s.rides(user("resident")).find((r) => r.id === "ride1")!.contact,
    "+919876543210",
  );
  assert.equal(
    s.rides(user("outsider")).find((r) => r.id === "ride1")!.contact,
    null,
  );
  s.rideAction(user("resident"), "ride1", {
    action: "share_contact",
    contact: "9876543210",
  });
  assert.equal(
    s.rides(user("neighbor")).find((r) => r.id === "ride1")!.requests[0]
      .contact,
    "9876543210",
  );
  s.rideAction(user("neighbor"), "ride1", {
    action: "share_contact",
    contact: "",
  });
  assert.equal(
    s.rides(user("resident")).find((r) => r.id === "ride1")!.contact,
    null,
  );
  s.rideAction(user("resident"), "ride1", { action: "withdraw" });
  assert.equal(
    s.rides(user("neighbor")).find((r) => r.id === "ride1")!.requests[0]
      .contact,
    null,
  );
  assert.equal(s.rideContact("ride1", "resident"), null);
  denied(
    () => s.rideAction(user("resident"), "ride1", { action: "withdraw" }),
    409,
  );
  db.close();
});

test("blocking cancels connections, releases seats and removes both-side discovery", () => {
  const { s, user, db } = setup();
  const before = s.one("SELECT seats FROM rides WHERE id='ride1'")!.seats;
  s.rideAction(user("resident"), "ride1", { action: "request" });
  const q = s.one(
    "SELECT * FROM ride_requests WHERE ride_id='ride1' AND user_id='resident'",
  )!;
  s.rideAction(user("neighbor"), "ride1", {
    action: "accept",
    requestId: q.id,
  });
  s.rideAction(user("resident"), "ride1", {
    action: "block",
    targetId: "neighbor",
  });
  assert.equal(
    s.one("SELECT seats FROM rides WHERE id='ride1'")!.seats,
    before,
  );
  assert.equal(
    s.rides(user("resident")).some((r) => r.id === "ride1"),
    false,
  );
  assert.equal(
    s.rides(user("neighbor")).find((r) => r.id === "ride1")!.requests.length,
    0,
  );
  denied(() => s.rideAction(user("resident"), "ride1", { action: "request" }));
  db.close();
});

test("carpool has no fare API, validates contact and denies moved-out residents", () => {
  const { s, user, db } = setup();
  const r = s.createRide(user("resident"), {
    pickup: "Main gate",
    destination: "Office",
    departure: new Date(Date.now() + 86400000).toISOString(),
    seats: 2,
    contribution: 25000,
  });
  assert.equal(
    s.one("SELECT contribution FROM rides WHERE id=?", r.id)!.contribution,
    0,
  );
  assert.equal(
    "contribution" in s.rides(user("resident")).find((x) => x.id === r.id)!,
    false,
  );
  denied(
    () =>
      s.rideAction(user("resident"), r.id, {
        action: "share_contact",
        contact: "javascript:alert(1)",
      }),
    400,
  );
  s.rideAction(user("outsider"), r.id, {
    action: "report",
    reason: "Misleading pickup details",
  });
  assert.equal(s.one("SELECT count(*) n FROM reports WHERE kind='ride'")!.n, 1);
  s.run("UPDATE memberships SET status='moved_out' WHERE user_id='resident'");
  assert.equal(
    s.rides(user("outsider")).some((x) => x.id === r.id),
    false,
  );
  denied(() =>
    s.rideAction(user("resident"), r.id, {
      action: "share_contact",
      contact: "9876543210",
    }),
  );
  db.close();
});
