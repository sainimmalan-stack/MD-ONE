import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { openDatabase, id } from "../lib/db.ts";
import { Service, AppError } from "../lib/service.ts";
import { Homes } from "../lib/homes.ts";
process.env.MDP_LOCAL_VAULT_KEY ||= randomBytes(32).toString("hex");
const setup = () => {
  const db = openDatabase(":memory:"),
    s = new Service(db),
    h = new Homes(s);
  return {
    db,
    s,
    h,
    u: (id: string) => s.one("SELECT * FROM users WHERE id=?", id)!,
  };
};
const body = () => ({
  key: id(),
  flatId: "f2",
  purpose: "rent",
  title: "A bright two-bedroom home",
  description: "Owner-listed home. Contact by mutual consent.",
  bhk: 2,
  area: 1200,
  floor: 2,
  furnishing: "Semi-furnished",
  parking: 1,
  available: "2026-11-01",
  price: 2500000,
  deposit: 5000000,
  photos: [],
});
const denied = (f: () => unknown) =>
  assert.throws(f, (e: unknown) => e instanceof AppError);
test("only verified owners list their own flat and retries bind to payload", () => {
  const { db, h, s, u } = setup();
  denied(() => h.create(u("resident"), body()));
  denied(() => h.create(u("neighbor"), { ...body(), flatId: "f1" }));
  const b = body(),
    a = h.create(u("neighbor"), b);
  assert.deepEqual(h.create(u("neighbor"), b), a);
  denied(() => h.create(u("neighbor"), { ...b, price: 200 }));
  assert.equal(s.all("SELECT * FROM home_listings").length, 1);
  db.close();
});
test("home discovery omits flat identifiers, phone numbers and personal profile fields", () => {
  const { db, h, u } = setup();
  const a = h.create(u("neighbor"), body());
  const l = h.browse(u("resident")).listings[0];
  assert.equal(l.id, a.id);
  for (const key of ["flat_id", "flatId", "label", "contact", "occupation"])
    assert.equal(key in l, false);
  assert.equal(h.browse(u("resident")).ownedFlats.length, 0);
  assert.equal(h.options(u("neighbor"))[0].label, "102");
  denied(() => h.browse(u("pending")));
  db.close();
});
test("interest, acceptance and separate consent gate each side’s contact", () => {
  const { db, h, u } = setup(),
    a = h.create(u("neighbor"), body());
  h.action(u("neighbor"), a.id, {
    action: "contact",
    contact: "9876543210",
    consent: true,
  });
  assert.equal(h.detail(u("resident"), a.id).contact, null);
  h.action(u("resident"), a.id, { action: "interest" });
  denied(() =>
    h.action(u("resident"), a.id, {
      action: "contact",
      contact: "9876543211",
      consent: true,
    }),
  );
  const q = h.detail(u("neighbor"), a.id).interests[0];
  denied(() =>
    h.action(u("outsider"), a.id, { action: "accept", requestId: q.id }),
  );
  h.action(u("neighbor"), a.id, { action: "accept", requestId: q.id });
  assert.equal(h.detail(u("resident"), a.id).contact, "9876543210");
  assert.equal(h.detail(u("outsider"), a.id).contact, null);
  denied(() =>
    h.action(u("resident"), a.id, { action: "contact", contact: "9876543211" }),
  );
  h.action(u("resident"), a.id, {
    action: "contact",
    contact: "9876543211",
    consent: true,
  });
  assert.equal(
    h.detail(u("neighbor"), a.id).interests[0].contact,
    "9876543211",
  );
  h.action(u("resident"), a.id, { action: "withdraw" });
  assert.equal(h.detail(u("resident"), a.id).contact, null);
  assert.equal(h.detail(u("neighbor"), a.id).interests[0].contact, null);
  db.close();
});
test("blocks, revoked ownership and expired memberships revoke discovery and contact", () => {
  const { db, h, s, u } = setup(),
    a = h.create(u("neighbor"), body());
  s.run("INSERT INTO blocks VALUES('resident','neighbor',datetime('now'))");
  assert.equal(h.browse(u("resident")).listings.length, 0);
  denied(() => h.detail(u("resident"), a.id));
  s.run("DELETE FROM blocks");
  s.run("UPDATE memberships SET status='moved_out' WHERE user_id='resident'");
  denied(() => h.detail(u("resident"), a.id));
  s.run("DELETE FROM ownership WHERE user_id='neighbor'");
  assert.equal(h.browse(u("outsider")).listings.length, 0);
  denied(() => h.detail(u("neighbor"), a.id));
  db.close();
});
test("expiry, renewal and final rented/sold statuses close contact access", () => {
  const { db, h, s, u } = setup(),
    a = h.create(u("neighbor"), body());
  s.run("UPDATE home_listings SET expires='2020-01-01' WHERE id=?", a.id);
  assert.equal(h.browse(u("resident")).listings.length, 0);
  denied(() => h.action(u("resident"), a.id, { action: "interest" }));
  h.action(u("neighbor"), a.id, { action: "renew" });
  assert.equal(h.browse(u("resident")).listings.length, 1);
  denied(() =>
    h.action(u("neighbor"), a.id, { action: "status", status: "sold" }),
  );
  h.action(u("neighbor"), a.id, { action: "status", status: "rented" });
  assert.equal(h.browse(u("resident")).listings.length, 0);
  denied(() => h.action(u("resident"), a.id, { action: "interest" }));
  db.close();
});

test("sale, strict input validation and verified non-resident owner lifecycle", () => {
  const { db, h, s, u } = setup();
  const b = {
    ...body(),
    flatId: "f4",
    purpose: "sale",
    price: 600000000,
    deposit: 999,
  };
  s.run("UPDATE memberships SET status='moved_out' WHERE user_id='owner'");
  const a = h.create(u("owner"), b);
  const l = h.detail(u("resident"), a.id);
  assert.equal(l.deposit, 0);
  assert.equal(l.purpose, "sale");
  assert.equal(l.price, 600000000);
  denied(() =>
    h.create(u("neighbor"), {
      ...body(),
      photos: ["data:image/svg+xml;base64,AAAA"],
    }),
  );
  denied(() => h.create(u("neighbor"), { ...body(), available: "2026-02-31" }));
  denied(() => h.create(u("neighbor"), { ...body(), price: -100 }));
  h.action(u("owner"), a.id, { action: "status", status: "sold" });
  assert.equal(h.detail(u("resident"), a.id).status, "sold");
  db.close();
});

test("an expired interest can be withdrawn before renewal without reviving contact access", () => {
  const { db, h, s, u } = setup(),
    a = h.create(u("neighbor"), body());
  h.action(u("resident"), a.id, { action: "interest" });
  const q = h.detail(u("neighbor"), a.id).interests[0];
  h.action(u("neighbor"), a.id, { action: "accept", requestId: q.id });
  h.action(u("neighbor"), a.id, {
    action: "contact",
    contact: "9876543210",
    consent: true,
  });
  s.run("UPDATE home_listings SET expires='2020-01-01' WHERE id=?", a.id);
  h.action(u("resident"), a.id, { action: "withdraw" });
  h.action(u("neighbor"), a.id, { action: "renew" });
  assert.equal(h.detail(u("resident"), a.id).contact, null);
  db.close();
});

test("a transferred flat can be listed by its new verified owner without reviving the old offer", () => {
  const { db, h, s, u } = setup();
  const old = h.create(u("neighbor"), body());
  s.run("DELETE FROM ownership WHERE flat_id='f2'");
  s.run("INSERT INTO ownership VALUES('resident','f2')");
  const current = h.create(u("resident"), {
    ...body(),
    title: "New verified owner listing",
  });
  assert.notEqual(current.id, old.id);
  denied(() => h.detail(u("outsider"), old.id));
  assert.equal(h.browse(u("outsider")).listings.length, 1);
  assert.equal(h.browse(u("outsider")).listings[0].id, current.id);
  db.close();
});
