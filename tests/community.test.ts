import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { openDatabase, now, id } from "../lib/db.ts";
import { Service, AppError } from "../lib/service.ts";
import { Governance } from "../lib/governance.ts";
import { Exchange } from "../lib/exchange.ts";
import { Social } from "../lib/social.ts";
import { numericFlatMapping } from "../lib/community-db.ts";
process.env.MDP_LOCAL_VAULT_KEY ||= randomBytes(32).toString("hex");
const setup = () => {
  const db = openDatabase(":memory:"),
    s = new Service(db),
    g = new Governance(s),
    e = new Exchange(s);
  const u = (uid: string) => s.one("SELECT * FROM users WHERE id=?", uid)!;
  return { db, s, g, e, u };
};
const denied = (fn: () => unknown, status?: number) =>
  assert.throws(
    fn,
    (e: unknown) => e instanceof AppError && (!status || e.status === status),
  );
const listing = (pid = "p1", audience = "project") => ({
  key: id(),
  projectId: pid,
  title: "A useful chair",
  description: "A synthetic item in good condition",
  category: "Furniture",
  condition: "Good",
  type: "sale",
  price: 10000,
  audience,
  status: "active",
  photos: [],
  exchangePreference: "",
});
function publish(
  g: Governance,
  u: Record<string, any>,
  pid = "p1",
  m = "2026-10",
) {
  const p = g.billing(u, pid, { action: "draft", month: m });
  g.billing(u, pid, { action: "review", periodId: p.id });
  g.billing(u, pid, { action: "publish", periodId: p.id });
  return p;
}
const bill = (patch = {}) => ({
  category: "Electricity",
  description: "Synthetic common meter",
  period: "2026-10",
  vendor: "Demo utility",
  billNumber: id(),
  billDate: "2026-10-01",
  dueDate: "2026-10-15",
  amount: 10000,
  ...patch,
});
test("numeric migration preserves relationships and rejects project collisions atomically", () => {
  const { db, s } = setup();
  assert.equal(s.one("SELECT label FROM flats WHERE id='f1'")!.label, "101");
  assert.equal(
    s.one("SELECT flat_id FROM memberships WHERE user_id='resident'")!.flat_id,
    "f1",
  );
  s.run("INSERT INTO flats VALUES('collision','p1','B-101')");
  assert.throws(() => numericFlatMapping(db), /requires correction/);
  assert.equal(
    s.one("SELECT label FROM flats WHERE id='collision'")!.label,
    "B-101",
  );
  db.close();
});
test("committee scope and platform appointment authority never grant project finance or personal finance access", () => {
  const { db, g, u, s } = setup();
  denied(() => g.workspace(u("neighbor"), "p2"), 403);
  denied(() => g.configure(u("neighbor"), "p2", {}), 403);
  denied(() => g.workspace(u("platform"), "p1"), 403);
  assert.ok(
    g
      .appointmentOptions(u("platform"))
      .residents.some((r) => r.id === "owner" && r.project_id === "p1"),
  );
  denied(() => g.accounts(u("platform"), "p1", "2026-10"), 403);
  denied(
    () => g.billing(u("resident"), "p2", { action: "draft", month: "2026-10" }),
    403,
  );
  assert.equal(s.bootstrap(u("neighbor")).expenses.length, 0);
  db.close();
});
test("invitation requires authorized admin, acceptance, distinct people, and revocation/expiry take effect immediately", () => {
  const { db, g, u, s } = setup();
  denied(
    () =>
      g.appointments(u("resident"), {
        action: "invite",
        projectId: "p1",
        userId: "resident",
        position: "president",
        starts: "2026-01-01",
        ends: "2028-01-01",
      }),
    403,
  );
  const a = g.appointments(u("platform"), {
    action: "invite",
    projectId: "p1",
    userId: "resident",
    position: "president",
    starts: "2026-01-01",
    ends: "2028-01-01",
  }) as any;
  denied(() => g.appointments(u("platform"), { action: "activate", id: a.id }));
  denied(
    () => g.appointments(u("neighbor"), { action: "accept", id: a.id }),
    403,
  );
  g.appointments(u("resident"), { action: "accept", id: a.id });
  denied(
    () => g.appointments(u("platform"), { action: "activate", id: a.id }),
    409,
  );
  g.appointments(u("platform"), { action: "revoke", id: "demo-vp" });
  denied(() => g.committee(u("resident"), "p1"), 403);
  s.run(
    "UPDATE committee_appointments SET ends='2025-01-01' WHERE id='demo-president'",
  );
  denied(() => g.committee(u("neighbor"), "p1"), 403);
  g.appointments(u('platform'),{action:'activate',id:a.id});
  assert.equal(g.committee(u('resident'),'p1')!.position,'president');
  assert.equal(u('resident').role,'resident');
  denied(()=>g.committee(u('resident'),'p2'),403);
  db.close();
});
test("draft review publish is idempotent; ongoing projects do not auto-bill; published payer survives move out", () => {
  const { db, g, u, s } = setup();
  const p = publish(g, u("neighbor"));
  const again = g.billing(u("neighbor"), "p1", {
    action: "draft",
    month: "2026-10",
  });
  assert.equal(again.id, p.id);
  assert.equal(s.one("SELECT count(*) n FROM flat_invoices")!.n, 2);
  const i = s.one("SELECT * FROM flat_invoices WHERE flat_id='f1'")!;
  s.run("UPDATE memberships SET move_out=? WHERE user_id='resident'", now());
  s.run("UPDATE flat_liability SET payer_id='neighbor' WHERE flat_id='f1'");
  assert.equal(g.invoice("p1", i.id).payer_id, "resident");
  denied(
    () =>
      g.submitPayment(u("neighbor"), "p1", {
        invoiceId: i.id,
        amount: 1,
        key: id(),
        reference: "x",
      }),
    403,
  );
  assert.equal(g.settings("p14").enabled, 0);
  db.close();
});
test("payment screenshot is pending; retries, partial collection, advances and credits count cash once", () => {
  const { db, g, u, s } = setup();
  publish(g, u("neighbor"));
  const i = s.one("SELECT * FROM flat_invoices WHERE flat_id='f1'")!;
  const b = {
    invoiceId: i.id,
    amount: 100000,
    key: id(),
    reference: "DEMO-ONE",
  };
  const p = g.submitPayment(u("resident"), "p1", b);
  assert.equal(p.status, "submitted");
  assert.equal(g.accounts(u("neighbor"), "p1", "2026-10").receipts, 0);
  assert.equal(g.submitPayment(u("resident"), "p1", b).id, p.id);
  denied(() => g.submitPayment(u("resident"), "p1", { ...b, amount: 2 }), 409);
  denied(
    () =>
      g.verifyPayment(u("resident"), "p1", {
        id: p.id,
        confirmed: true,
        date: "2026-10-10",
      }),
    403,
  );
  g.verifyPayment(u("neighbor"), "p1", {
    id: p.id,
    confirmed: true,
    date: "2026-10-10",
  });
  g.verifyPayment(u("neighbor"), "p1", {
    id: p.id,
    confirmed: true,
    date: "2026-10-10",
  });
  assert.equal(
    g.invoiceBalance(g.invoice("p1", i.id)).status,
    "partially paid",
  );
  const p2 = g.submitPayment(u("resident"), "p1", {
    ...b,
    key: id(),
    reference: "DEMO-TWO",
    amount: 200000,
  });
  g.verifyPayment(u("neighbor"), "p1", {
    id: p2.id,
    confirmed: true,
    date: "2026-10-11",
  });
  assert.equal(g.credit("p1", "resident"), 50000);
  const next = publish(g, u("neighbor"), "p1", "2026-11");
  const j = s.one(
    "SELECT * FROM flat_invoices WHERE period_id=? AND flat_id='f1'",
    next.id,
  )!;
  g.applyCredit(u("neighbor"), "p1", { invoiceId: j.id, amount: 50000 });
  assert.equal(g.credit("p1", "resident"), 0);
  assert.equal(g.invoiceBalance(g.invoice("p1", j.id)).balance, 200000);
  assert.equal(g.accounts(u("neighbor"), "p1", "2026-10").receipts, 300000);
  db.close();
});
test("opening cash, opening dues, accrued expense and actual payment remain distinct; closed corrections retain original", () => {
  const { db, g, u, s } = setup();
  s.run(
    "UPDATE project_settings SET opening_cash=100000,opening_reserve=200000 WHERE project_id='p1'",
  );
  s.run("UPDATE flat_liability SET opening_due=20000 WHERE flat_id='f1'");
  const p = publish(g, u("neighbor"));
  const e = g.expense(u("resident"), "p1", bill());
  denied(() =>
    g.billing(u("neighbor"), "p1", {
      periodId: p.id,
      action: "close",
      reconciled: true,
    }),
  );
  g.approveExpense(u("neighbor"), "p1", { id: e.id });
  let a = g.accounts(u("neighbor"), "p1", "2026-10");
  assert.equal(a.expenses, 10000);
  assert.equal(a.payments, 0);
  assert.equal(a.closing, 100000);
  assert.equal(a.reserve, 200000);
  assert.equal(a.receivables, 520000);
  assert.equal(a.billed, 500000);
  assert.equal(a.openingDues, 20000);
  const pay = {
    id: e.id,
    amount: 5000,
    date: "2026-10-12",
    method: "UPI",
    reference: "DEMO",
    key: id(),
  };
  g.payExpense(u("neighbor"), "p1", pay);
  g.payExpense(u("neighbor"), "p1", pay);
  a = g.accounts(u("neighbor"), "p1", "2026-10");
  assert.equal(a.expenses, 10000);
  assert.equal(a.payments, 5000);
  assert.equal(a.closing, 95000);
  assert.equal(a.payables, 5000);
  g.billing(u("neighbor"), "p1", {
    periodId: p.id,
    action: "close",
    reconciled: true,
  });
  const inv = s.one("SELECT * FROM flat_invoices WHERE flat_id='f1'")!;
  denied(() =>
    g.adjustment(u("neighbor"), "p1", {
      invoiceId: inv.id,
      amount: -1000,
      reason: "Correction",
      effectiveMonth: "2026-10",
    }),
  );
  g.adjustment(u("neighbor"), "p1", {
    invoiceId: inv.id,
    amount: -1000,
    reason: "Correction",
    effectiveMonth: "2026-11",
  });
  assert.equal(g.accounts(u("neighbor"), "p1", "2026-10").receivables, 520000);
  assert.equal(g.invoice("p1", inv.id).amount, 270000);
  assert.equal(s.one("SELECT count(*) n FROM invoice_adjustments")!.n, 1);
  db.close();
});
test("attachments, questions and resident transparency are scoped and proofs stay private", () => {
  const { db, g, u } = setup();
  publish(g, u("neighbor"));
  const a = g.upload(u("resident"), "p1", {
    name: "proof.pdf",
    mime: "application/pdf",
    data: Buffer.from("%PDF-1.4\nSynthetic").toString("base64"),
  });
  denied(() => g.attachment(u("outsider"), "p1", a.id), 403);
  denied(() => g.upload(u("outsider"), "p1", {}), 403);
  denied(() => g.ownAttachment(u("resident"), "p2", a.id), 403);
  const q = g.ask(u("resident"), "p1", {
    category: "Billing",
    subject: "Private question",
    body: "Please check",
    attachmentId: a.id,
  });
  denied(() => g.question(u("outsider"), "p1", q.id), 403);
  g.reply(u("neighbor"), "p1", {
    id: q.id,
    body: "We will review",
    status: "resolved",
  });
  denied(() =>
    g.operation(u("neighbor"), "p1", {
      kind: "faq",
      title: "FAQ",
      payload: { questionId: q.id, redacted: true },
    }),
  );
  assert.equal(g.workspace(u("outsider"), "p2").submissions.length, 0);
  db.close();
});
test("expense approvals require independent review and completed MDP service bills link only once", () => {
  const { db, s, g, u } = setup();
  const e = g.expense(u("resident"), "p1", bill());
  denied(() => g.approveExpense(u("resident"), "p1", { id: e.id }), 403);
  denied(() => g.approveExpense(u("outsider"), "p1", { id: e.id }), 403);
  s.run(
    "INSERT INTO service_requests VALUES('completed-demo','resident','f1','plumbing','Common repair','2026-10-20','normal','completed',NULL,?,?)",
    now(),
    now(),
  );
  const linked = g.expense(
    u("resident"),
    "p1",
    bill({ serviceRequestId: "completed-demo", reviewedService: true }),
  );
  assert.ok(linked.id);
  denied(
    () =>
      g.expense(
        u("resident"),
        "p1",
        bill({ serviceRequestId: "completed-demo", reviewedService: true }),
      ),
    409,
  );
  db.close();
});
test("marketplace audience, conversations, profile locks and stock are independent", () => {
  const { db, s, e, u } = setup();
  const before = s.one("SELECT sum(stock) n FROM products")!.n,
    bikes = s.one("SELECT count(*) n FROM orders")!.n;
  const l = e.saveListing(u("neighbor"), listing());
  denied(() => e.listing(u("outsider"), l.id), 404);
  const network = e.saveListing(u("neighbor"), listing("p1", "network"));
  assert.ok(e.listing(u("outsider"), network.id));
  const c = e.action(u("resident"), l.id, { action: "enquire" })!;
  e.message(u("resident"), c.id, { key: id(), body: "Is it available?" });
  denied(() => e.messages(u("outsider"), c.id), 404);
  assert.equal(e.messages(u("neighbor"), c.id).length, 1);
  const profile = new Social(s).profile(u("resident"), "neighbor");
  assert.equal(profile.canSeeDetails, false);
  assert.equal(profile.contact, "");
  assert.equal("label" in e.safe(l).seller, false);
  assert.equal(s.one("SELECT sum(stock) n FROM products")!.n, before);
  assert.equal(s.one("SELECT count(*) n FROM orders")!.n, bikes);
  assert.ok(e.browse(u("resident")).listings.length);
  db.close();
});
test("blocked and expired residents cannot bypass marketplace access and messages deduplicate", () => {
  const { db, s, e, u } = setup();
  const l = e.saveListing(u("neighbor"), listing()),
    c = e.action(u("resident"), l.id, { action: "enquire" })!;
  const m = { key: id(), body: "Hello" };
  e.message(u("resident"), c.id, m);
  e.message(u("resident"), c.id, m);
  assert.equal(e.messages(u("neighbor"), c.id).length, 1);
  new Social(s).block(u("resident"), "neighbor");
  denied(() => e.listing(u("resident"), l.id), 404);
  denied(() => e.messages(u("neighbor"), c.id));
  s.run("DELETE FROM blocks");
  s.run("UPDATE memberships SET move_out=? WHERE user_id='resident'", now());
  denied(() => e.listing(u("resident"), l.id), 403);
  denied(() => e.messages(u("neighbor"), c.id), 403);
  db.close();
});
test("regular resident sees only their ledger and published redacted bills, never neighbour proofs or raw payee data", () => {
  const { db, s, g, u } = setup();
  s.run(
    "INSERT INTO users VALUES('third','Synthetic third resident','resident','p1',0)",
  );
  s.run(
    "INSERT INTO memberships VALUES('third-membership','third','f2','family','approved','2020-01-01',NULL)",
  );
  publish(g, u("neighbor"));
  const a = g.upload(u("resident"), "p1", {
    name: "bank-proof.pdf",
    mime: "application/pdf",
    data: Buffer.from("%PDF-1.4 secret-proof").toString("base64"),
  });
  const red = g.upload(u("resident"), "p1", {
    name: "redacted.pdf",
    mime: "application/pdf",
    data: Buffer.from("%PDF-1.4 resident-safe").toString("base64"),
    redacted: true,
  });
  const b = g.expense(
    u("resident"),
    "p1",
    bill({ attachmentId: a.id, redactedAttachmentId: red.id }),
  );
  g.approveExpense(u("neighbor"), "p1", { id: b.id });
  const w = g.workspace(u("third"), "p1");
  assert.equal(w.committeeMode, false);
  assert.equal(w.invoices.length, 0);
  assert.equal(w.submissions.length, 0);
  assert.equal("vendor" in w.bills[0], false);
  assert.equal("attachment_id" in w.bills[0], false);
  denied(() => g.attachment(u("third"), "p1", a.id), 403);
  assert.ok(g.attachment(u("third"), "p1", red.id).data.length);
  g.appointments(u("platform"), { action: "revoke", id: "demo-vp" });
  denied(() => g.attachment(u("resident"), "p1", a.id), 403);
  assert.ok(g.attachment(u("resident"), "p1", red.id).data.length);
  assert.ok(g.attachment(u("neighbor"), "p1", a.id).data.length);
  denied(() => g.configure(u("third"), "p1", {}), 403);
  db.close();
});
test("approved vendor credit corrects current accrual without rewriting a closed month or overpaying original", () => {
  const { db, g, u } = setup();
  const p = publish(g, u("neighbor"));
  const b = g.expense(u("resident"), "p1", bill({ amount: 10000 }));
  g.approveExpense(u("neighbor"), "p1", { id: b.id });
  g.billing(u("neighbor"), "p1", {
    action: "close",
    periodId: p.id,
    reconciled: true,
  });
  const credit = g.expense(
    u("resident"),
    "p1",
    bill({
      period: "2026-11",
      amount: -2000,
      correctionOf: b.id,
      reason: "Vendor credit for overcharge",
    }),
  );
  g.approveExpense(u("neighbor"), "p1", { id: credit.id });
  assert.equal(g.accounts(u("neighbor"), "p1", "2026-10").expenses, 10000);
  assert.equal(g.accounts(u("neighbor"), "p1", "2026-11").expenses, -2000);
  denied(() =>
    g.payExpense(u("neighbor"), "p1", {
      id: b.id,
      amount: 9000,
      date: "2026-11-02",
      method: "Bank",
      reference: "demo",
      key: id(),
    }),
  );
  g.payExpense(u("neighbor"), "p1", {
    id: b.id,
    amount: 8000,
    date: "2026-11-02",
    method: "Bank",
    reference: "demo",
    key: id(),
  });
  assert.equal(g.accounts(u("neighbor"), "p1", "2026-11").payables, 0);
  db.close();
});
test("one reference cannot create duplicate receipts under a different retry key, and annual summaries keep project scope", () => {
  const { db, g, u, s } = setup();
  publish(g, u("neighbor"));
  const i = s.one("SELECT id FROM flat_invoices WHERE flat_id='f1'")!;
  g.submitPayment(u("resident"), "p1", {
    invoiceId: i.id,
    amount: 100,
    key: id(),
    reference: "same-bank-reference",
  });
  denied(
    () =>
      g.submitPayment(u("resident"), "p1", {
        invoiceId: i.id,
        amount: 100,
        key: id(),
        reference: "same-bank-reference",
      }),
    409,
  );
  assert.equal(g.annual(u("resident"), "p1", "2026").months.length, 1);
  denied(() => g.annual(u("resident"), "p2", "2026"), 403);
  db.close();
});
test("listing payload retries cannot create a different item, image validation fails closed and pages are bounded", () => {
  const { db, e, u } = setup();
  const b = listing();
  const first = e.saveListing(u("resident"), b);
  assert.equal(e.saveListing(u("resident"), b).id, first.id);
  e.s.run(
    "UPDATE exchange_listings SET expires='2000-01-01' WHERE id=?",
    first.id,
  );
  assert.equal(e.safe(e.listing(u("resident"), first.id)).status, "expired");
  denied(() => e.action(u("neighbor"), first.id, { action: "enquire" }));
  const renewed = e.saveListing(u("resident"), b, first.id);
  assert.ok(renewed.expires > now());

  denied(
    () => e.saveListing(u("resident"), { ...b, title: "Another item" }),
    409,
  );
  denied(() =>
    e.saveListing(u("resident"), {
      ...listing(),
      photos: ["data:image/svg+xml;base64,PHN2Zz4="],
    }),
  );
  for (let n = 0; n < 22; n++) e.saveListing(u("resident"), listing());
  const page = e.browse(u("resident"));
  assert.equal(page.listings.length, 20);
  assert.equal(page.nextOffset, 20);
  assert.ok(e.browse(u("resident"), { offset: 20 }).listings.length > 0);
  db.close();
});
test("other receipts and same-project reserve transfers keep funds distinct, conserve cash, and deduplicate retries", () => {
  const { db, s, g, u } = setup();
  s.run("UPDATE project_settings SET opening_cash=10000 WHERE project_id='p1'");
  publish(g, u("neighbor"));
  g.cashRecord(u("neighbor"), "p1", {
    key: id(),
    action: "other_receipt",
    fund: "general",
    amount: 2000,
    date: "2026-10-10",
    reason: "Synthetic bank interest receipt",
    reference: "DEMO-INTEREST",
    confirmed: true,
  });
  const transfer = {
    key: id(),
    action: "reserve_transfer",
    fund: "reserve",
    amount: 3000,
    date: "2026-10-11",
    reason: "Synthetic reserve allocation",
    reference: "DEMO-TRANSFER",
    confirmed: true,
  };
  g.cashRecord(u("neighbor"), "p1", transfer);
  g.cashRecord(u("neighbor"), "p1", transfer);
  const a = g.accounts(u("neighbor"), "p1", "2026-10");
  assert.equal(a.receipts, 2000);
  assert.equal(a.payments, 0);
  assert.equal(a.reserveTransfer, -3000);
  assert.equal(a.closing, 9000);
  assert.equal(a.reserve, 3000);
  assert.equal(a.closing + a.reserve, 12000);
  denied(() => g.cashRecord(u("neighbor"), "p2", transfer), 403);
  denied(() =>
    g.cashRecord(u("neighbor"), "p1", {
      ...transfer,
      key: id(),
      amount: 100000,
    }),
  );
  db.close();
});
test("verified owner can select multiple owned projects without inheriting tenant invoices or personal records", () => {
  const { db, g, u } = setup();
  const projects = new Set(g.memberships("owner").map((m) => m.project_id));
  assert.ok(projects.has("p1"));
  assert.ok(projects.has("p14"));
  publish(g, u("neighbor"));
  const w = g.workspace(u("owner"), "p1");
  assert.equal(w.committeeMode, false);
  assert.equal(w.invoices.length, 0);
  assert.equal(w.submissions.length, 0);
  assert.equal(g.settings("p14").enabled, 0);
  denied(
    () => g.billing(u("owner"), "p1", { action: "draft", month: "2026-11" }),
    403,
  );
  db.close();
});
