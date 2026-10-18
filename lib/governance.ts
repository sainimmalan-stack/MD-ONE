import { Service, fail, text, integer } from "./service.ts";
import { id, now, encrypt, decrypt, type Row } from "./db.ts";
export const expenseCategories = [
  "Security",
  "Electricity",
  "Water",
  "Lift AMC",
  "Generator diesel",
  "Generator service",
  "Plumbing",
  "Electrical",
  "Tiles",
  "Cleaning",
  "Pumps",
  "Gardening",
  "Pest control",
  "Insurance",
  "Repairs",
  "Miscellaneous",
];
const month = (v: unknown) =>
  typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
    ? v
    : fail("Use YYYY-MM.");
const localDay = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const date = (v: unknown) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !isNaN(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v
    ? v
    : fail("Use a valid date.");
export class Governance {
  constructor(public s: Service) {}
  memberships(uid: string, pid?: string): Row[] {
    const active = this.s.all(
      `SELECT m.*,f.project_id,f.label,p.name project FROM memberships m JOIN flats f ON f.id=m.flat_id JOIN projects p ON p.id=f.project_id JOIN users u ON u.id=m.user_id WHERE m.user_id=? AND u.deleted=0 AND m.status='approved' AND m.move_in<=? AND (m.move_out IS NULL OR m.move_out>?) ${pid ? "AND f.project_id=?" : ""}`,
      uid,
      now(),
      now(),
      ...(pid ? [pid] : []),
    );
    const owners = this.s.all(
      `SELECT 'ownership:'||f.id id,o.user_id,o.flat_id,'owner' kind,'approved' status,NULL move_in,NULL move_out,f.project_id,f.label,p.name project FROM ownership o JOIN flats f ON f.id=o.flat_id JOIN projects p ON p.id=f.project_id JOIN users u ON u.id=o.user_id WHERE o.user_id=? AND u.deleted=0 ${pid ? "AND f.project_id=?" : ""}`,
      uid,
      ...(pid ? [pid] : []),
    );
    return [
      ...active,
      ...owners.filter((o) => !active.some((m) => m.flat_id === o.flat_id)),
    ];
  }
  member(u: Row, pid: string) {
    if (!this.memberships(u.id, pid).length)
      fail("An active membership in this project is required.", 403);
  }
  committee(u: Row, pid: string, required = true): Row | undefined {
    const active =
      this.memberships(u.id, pid).length &&
      this.s.one(
        "SELECT * FROM committee_appointments WHERE project_id=? AND user_id=? AND status='active' AND starts<=? AND ends>?",
        pid,
        u.id,
        localDay(),
        localDay(),
      );
    if (!active && required)
      fail("An active committee appointment in this project is required.", 403);
    return active || undefined;
  }
  history(u: Row, pid: string, kind: string, target: string, details: string) {
    this.s.run(
      "INSERT INTO project_history VALUES(?,?,?,?,?,?,?)",
      id(),
      pid,
      u.id,
      kind,
      target,
      details,
      now(),
    );
    this.s.audit(u, kind, target);
  }
  settings(pid: string): Row {
    const r = this.s.one(
      "SELECT * FROM project_settings WHERE project_id=?",
      pid,
    );
    if (!r) fail("Project not found.", 404);
    return { ...r, policy: JSON.parse(r.policy) };
  }
  appointmentOptions(u: Row) {
    this.s.role(u, ["platform"]);
    return {
      projects: this.s.all("SELECT id,name,status FROM projects ORDER BY name"),
      residents: this.s.all(
        "SELECT DISTINCT u.id,u.name,f.project_id,p.name project,f.label FROM users u JOIN memberships m ON m.user_id=u.id JOIN flats f ON f.id=m.flat_id JOIN projects p ON p.id=f.project_id WHERE u.deleted=0 AND m.status='approved' AND m.move_in<=? AND (m.move_out IS NULL OR m.move_out>?) UNION SELECT u.id,u.name,f.project_id,p.name project,f.label FROM ownership o JOIN users u ON u.id=o.user_id JOIN flats f ON f.id=o.flat_id JOIN projects p ON p.id=f.project_id WHERE u.deleted=0 ORDER BY 4,2",
        now(),
        now(),
      ),
    };
  }
  appointments(u: Row, b?: Row) {
    if (!b) {
      if (u.role === "platform")
        return this.s.all(
          "SELECT a.*,u.name,p.name project FROM committee_appointments a JOIN users u ON u.id=a.user_id JOIN projects p ON p.id=a.project_id ORDER BY appointed_at DESC",
        );
      return this.s.all(
        "SELECT * FROM committee_appointments WHERE user_id=?",
        u.id,
      );
    }
    if (b.action === "accept" || b.action === "resign") {
      const a = this.s.one(
        "SELECT * FROM committee_appointments WHERE id=?",
        text(b.id),
      );
      if (!a || a.user_id !== u.id) fail("Invitation unavailable.", 403);
      this.member(u, a.project_id);
      if (b.action === "accept" && a.status === "invited")
        this.s.run(
          "UPDATE committee_appointments SET status='accepted',accepted_at=? WHERE id=?",
          now(),
          a.id,
        );
      else if (b.action === "resign" && a.status === "active")
        this.s.run(
          "UPDATE committee_appointments SET status='resigned' WHERE id=?",
          a.id,
        );
      else fail("Invalid appointment transition.");
      this.history(
        u,
        a.project_id,
        `committee.${b.action}`,
        a.id,
        "Resident action",
      );
      return { ok: true };
    }
    this.s.role(u, ["platform"]);
    return this.s.tx(() => {
      if (b.action === "invite") {
        const pid = text(b.projectId),
          uid = text(b.userId);
        if (uid === u.id)
          fail("An appointment administrator cannot appoint themselves.", 403);
        this.member({ id: uid }, pid);
        if (!["president", "vice_president"].includes(b.position))
          fail("Choose a committee position.");
        const starts = date(b.starts),
          ends = date(b.ends);
        if (ends <= starts) fail("Term end must follow start.");
        const aid = id();
        this.s.run(
          "INSERT INTO committee_appointments VALUES(?,?,?,?,?,?,?,?,?,?)",
          aid,
          pid,
          uid,
          b.position,
          "invited",
          u.id,
          now(),
          null,
          starts,
          ends,
        );
        this.history(
          u,
          pid,
          "committee.invited",
          aid,
          "Synthetic demo invitation; acceptance and activation required",
        );
        return { id: aid };
      }
      const a = this.s.one(
        "SELECT * FROM committee_appointments WHERE id=?",
        text(b.id),
      );
      if (!a) fail("Appointment not found.", 404);
      if (b.action === "activate") {
        if (a.user_id === u.id)
          fail("You cannot approve your own elevation.", 403);
        if (a.status !== "accepted" || !a.accepted_at)
          fail("Resident acceptance is required.");
        this.member({ id: a.user_id }, a.project_id);
        if (a.ends <= localDay()) fail("Term has expired.");
        // Remove expired occupiers, preserving their records. Never silently replace a live position.
        this.s.run(
          "UPDATE committee_appointments SET status='revoked' WHERE project_id=? AND status='active' AND ends<=?",
          a.project_id,
          localDay(),
        );
        if (
          this.s.one(
            "SELECT 1 FROM committee_appointments WHERE project_id=? AND status='active' AND (position=? OR user_id=?)",
            a.project_id,
            a.position,
            a.user_id,
          )
        )
          fail(
            "Revoke the current position first; President and VP must be different people.",
            409,
          );
        this.s.run(
          "UPDATE committee_appointments SET status='active' WHERE id=?",
          a.id,
        );
      } else if (b.action === "revoke")
        this.s.run(
          "UPDATE committee_appointments SET status='revoked' WHERE id=?",
          a.id,
        );
      else fail("Unknown appointment action.");
      this.history(
        u,
        a.project_id,
        `committee.${b.action}`,
        a.id,
        String(b.reason || "Appointment administrator action").slice(0, 500),
      );
      return { ok: true };
    });
  }
  configure(u: Row, pid: string, b: Row) {
    this.committee(u, pid);
    const old = this.settings(pid);
    if (b.action === "liability") {
      const f = this.s.one(
        "SELECT * FROM flats WHERE id=? AND project_id=?",
        text(b.flatId),
        pid,
      );
      if (!f) fail("Flat outside this project.", 403);
      if (
        !this.memberships(text(b.payerId), pid).some(
          (m) => m.flat_id === f.id,
        ) &&
        !this.s.one(
          "SELECT 1 FROM ownership WHERE flat_id=? AND user_id=?",
          f.id,
          b.payerId,
        )
      )
        fail("Payer must be a verified owner or current resident.");
      const area = b.area ? integer(b.area, 1, 100000) : null;
      if (area && b.areaVerified !== true)
        fail("Area must come from a verified register.");
      this.s.run(
        "INSERT INTO flat_liability VALUES(?,?,?,?,?,?,?) ON CONFLICT(flat_id) DO UPDATE SET payer_id=excluded.payer_id,area=excluded.area,area_verified=excluded.area_verified,opening_due=excluded.opening_due,exemption=excluded.exemption",
        f.id,
        pid,
        b.payerId,
        area,
        area ? 1 : 0,
        integer(b.openingDue || 0, 0),
        integer(b.exemption || 0, 0),
      );
      this.history(
        u,
        pid,
        "liability.configured",
        f.id,
        "Future invoices only; existing payer remains immutable",
      );
      return { ok: true };
    }
    if (
      !["fixed", "area"].includes(b.mode) ||
      !Array.isArray(b.categories) ||
      b.categories.some((c: string) => !expenseCategories.includes(c))
    )
      fail("Choose valid billing and facility categories.");
    const policy = {
      mode: b.mode,
      amount: integer(b.amount, 0, 10000000),
      dueDay: integer(b.dueDay, 1, 28),
      categories: b.categories,
      independentReview: b.independentReview === true,
      approvalThreshold: integer(b.approvalThreshold || 0, 0),
      special: integer(b.special || 0, 0),
      paymentInstructions: String(b.paymentInstructions || "").slice(0, 1500),
      specialLabel: String(b.specialLabel || "Special assessment").slice(
        0,
        100,
      ),
      penaltyEnabled: b.penaltyEnabled === true,
      penalty: integer(b.penalty || 0, 0),
    };
    const start = date(b.startDate);
    if (!b.approved) fail("Explicit policy approval is required.");
    if (
      this.s.one("SELECT 1 FROM billing_periods WHERE project_id=?", pid) &&
      (old.opening_cash !== Number(b.openingCash || 0) ||
        old.opening_reserve !== Number(b.openingReserve || 0))
    )
      fail(
        "Opening cash cannot change after billing begins; record a reasoned cash adjustment.",
      );
    this.s.run(
      "UPDATE project_settings SET enabled=?,start_date=?,policy=?,opening_cash=?,opening_reserve=? WHERE project_id=?",
      b.enabled ? 1 : 0,
      start,
      JSON.stringify(policy),
      integer(b.openingCash || 0, 0),
      integer(b.openingReserve || 0, 0),
      pid,
    );
    this.history(
      u,
      pid,
      "policy.approved",
      pid,
      "Prospective project policy; no existing bills changed",
    );
    return { ok: true };
  }
  period(pid: string, periodId: string): Row {
    const p = this.s.one(
      "SELECT * FROM billing_periods WHERE id=? AND project_id=?",
      periodId,
      pid,
    );
    if (!p) fail("Period unavailable.", 404);
    return p;
  }
  invoice(pid: string, iid: string): Row {
    const i = this.s.one(
      "SELECT i.*,p.state,p.month FROM flat_invoices i JOIN billing_periods p ON p.id=i.period_id WHERE i.id=? AND i.project_id=?",
      iid,
      pid,
    );
    if (!i) fail("Invoice unavailable.", 404);
    return i;
  }
  invoiceBalance(i: Row, cutoff?: string): Row {
    const adjustment = Number(
      this.s.one(
        "SELECT coalesce(sum(amount),0) n FROM invoice_adjustments WHERE invoice_id=? AND (? IS NULL OR effective_month<=?)",
        i.id,
        cutoff || null,
        cutoff || null,
      )!.n,
    );
    const paid =
      Number(
        this.s.one(
          "SELECT coalesce(sum(r.allocated),0) n FROM project_receipts r JOIN payment_submissions s ON s.id=r.submission_id WHERE s.invoice_id=? AND (? IS NULL OR substr(r.date,1,7)<=?)",
          i.id,
          cutoff || null,
          cutoff || null,
        )!.n,
      ) +
      Number(
        this.s.one(
          "SELECT coalesce(sum(amount),0) n FROM credit_allocations WHERE invoice_id=? AND (? IS NULL OR substr(created,1,7)<=?)",
          i.id,
          cutoff || null,
          cutoff || null,
        )!.n,
      );
    return {
      ...i,
      lines: JSON.parse(i.lines),
      adjustments: this.s.all(
        "SELECT amount,reason,effective_month,created FROM invoice_adjustments WHERE invoice_id=? ORDER BY created",
        i.id,
      ),
      adjustment,
      paid,
      balance: i.amount + adjustment - paid,
      status:
        paid >= i.amount + adjustment
          ? "paid"
          : paid > 0
            ? "partially paid"
            : i.due_date < localDay()
              ? "overdue"
              : "due",
    };
  }
  credit(pid: string, uid: string) {
    return (
      Number(
        this.s.one(
          "SELECT coalesce(sum(amount-allocated),0) n FROM project_receipts WHERE project_id=? AND user_id=?",
          pid,
          uid,
        )!.n,
      ) -
      Number(
        this.s.one(
          "SELECT coalesce(sum(amount),0) n FROM credit_allocations WHERE project_id=? AND user_id=?",
          pid,
          uid,
        )!.n,
      )
    );
  }
  billing(u: Row, pid: string, b: Row) {
    this.committee(u, pid);
    return this.s.tx(() => {
      if (b.action === "draft") {
        const m = month(b.month),
          settings = this.settings(pid),
          policy = settings.policy;
        if (
          !settings.enabled ||
          !settings.start_date ||
          m < settings.start_date.slice(0, 7)
        )
          fail("Approve and activate this project’s maintenance policy first.");
        const prior = this.s.one(
          "SELECT * FROM billing_periods WHERE project_id=? AND month=?",
          pid,
          m,
        );
        if (prior) return prior;
        const flats = this.s.all(
          "SELECT f.*,l.payer_id,l.area,l.area_verified,l.opening_due,l.exemption FROM flats f LEFT JOIN flat_liability l ON l.flat_id=f.id WHERE f.project_id=?",
          pid,
        );
        if (
          !flats.length ||
          flats.some(
            (f) =>
              !f.payer_id ||
              (policy.mode === "area" && (!f.area_verified || !f.area)),
          )
        )
          fail(
            "Every registered flat needs an explicit payer and verified area for area billing.",
          );
        const periodId = id();
        this.s.run(
          "INSERT INTO billing_periods VALUES(?,?,?,?,?)",
          periodId,
          pid,
          m,
          "draft",
          null,
        );
        const first = !this.s.one(
          "SELECT 1 FROM billing_periods WHERE project_id=? AND id!=?",
          pid,
          periodId,
        );
        for (const f of flats) {
          const base =
            policy.mode === "area" ? policy.amount * f.area : policy.amount;
          const lines = [{ label: "Maintenance", amount: base }];
          if (policy.special)
            lines.push({ label: policy.specialLabel, amount: policy.special });
          if (first && f.opening_due)
            lines.push({
              label: "Verified opening dues",
              amount: f.opening_due,
            });
          if (f.exemption)
            lines.push({
              label: "Approved exemption",
              amount: -Math.min(f.exemption, base),
            });
          this.s.run(
            "INSERT INTO flat_invoices VALUES(?,?,?,?,?,?,?,?)",
            id(),
            pid,
            periodId,
            f.id,
            f.payer_id,
            `${m}-${String(policy.dueDay).padStart(2, "0")}`,
            JSON.stringify(lines),
            lines.reduce((a, l) => a + l.amount, 0),
          );
        }
        this.history(u, pid, "billing.drafted", periodId, m);
        return this.period(pid, periodId);
      }
      const p = this.period(pid, text(b.periodId));
      if (b.action === "review" && p.state === "draft")
        this.s.run(
          "UPDATE billing_periods SET state='review' WHERE id=?",
          p.id,
        );
      else if (b.action === "publish" && p.state === "review") {
        this.s.run(
          "UPDATE billing_periods SET state='published' WHERE id=?",
          p.id,
        );
        this.s.run(
          "INSERT INTO project_operations VALUES(?,?,?,?,?,?,?)",
          id(),
          pid,
          "notice",
          `${p.month} maintenance bills published`,
          JSON.stringify({
            body: "Your itemized bill is ready in My Project → My dues. Pay directly to your project’s authorized account.",
          }),
          u.id,
          now(),
        );
      } else if (b.action === "close" && p.state === "published") {
        if (!b.reconciled) fail("Confirm reconciliation before closing.");
        if (
          this.s.one(
            "SELECT 1 FROM project_expense_bills WHERE project_id=? AND period=? AND status='pending'",
            pid,
            p.month,
          )
        )
          fail("Review pending vendor bills before closing this month.");
        const snapshot = JSON.stringify(this.accounts(u, pid, p.month));
        this.s.run(
          "UPDATE billing_periods SET state='closed',snapshot=? WHERE id=?",
          snapshot,
          p.id,
        );
      } else fail("Invalid billing transition.");
      this.history(u, pid, `billing.${b.action}`, p.id, p.month);
      return this.period(pid, p.id);
    });
  }
  adjustment(u: Row, pid: string, b: Row) {
    this.committee(u, pid);
    const i = this.invoice(pid, text(b.invoiceId));
    if (!["published", "closed"].includes(i.state))
      fail("Only published invoices can receive versioned adjustments.");
    const effective = month(b.effectiveMonth);
    if (
      effective < i.month ||
      this.s.one(
        "SELECT 1 FROM billing_periods WHERE project_id=? AND month=? AND state='closed'",
        pid,
        effective,
      )
    )
      fail(
        "Use a current open correction period; closed history is immutable.",
      );
    const amount = integer(b.amount, -100000000, 100000000),
      balance = this.invoiceBalance(i).balance;
    if (balance + amount < 0)
      fail("Credit note exceeds unpaid balance. Record refunds separately.");
    const reason = text(b.reason, 1000);
    this.s.run(
      "INSERT INTO invoice_adjustments VALUES(?,?,?,?,?,?,?,?)",
      id(),
      pid,
      i.id,
      amount,
      reason,
      now(),
      effective,
      u.id,
    );
    this.history(u, pid, "invoice.adjusted", i.id, reason);
    return { ok: true };
  }
  submitPayment(u: Row, pid: string, b: Row): Row {
    this.member(u, pid);
    const i = this.invoice(pid, text(b.invoiceId));
    if (i.payer_id !== u.id || !["published", "closed"].includes(i.state))
      fail("Only the billed payer can submit this payment.", 403);
    const key = text(b.key, 100),
      amount = integer(b.amount, 1),
      reference = text(b.reference, 200);
    if (b.attachmentId) this.ownAttachment(u, pid, b.attachmentId);
    const old = this.s.one(
      "SELECT * FROM payment_submissions WHERE user_id=? AND request_key=?",
      u.id,
      key,
    );
    if (old) {
      if (
        old.invoice_id !== i.id ||
        old.amount !== amount ||
        old.reference !== reference
      )
        fail("Payment retry differs from original.", 409);
      return old;
    }
    if (
      this.s.one(
        "SELECT 1 FROM payment_submissions WHERE project_id=? AND reference=?",
        pid,
        reference,
      )
    )
      fail("This project payment reference has already been submitted.", 409);
    const sid = id();
    this.s.run(
      "INSERT INTO payment_submissions VALUES(?,?,?,?,?,?,?,?,?,?)",
      sid,
      pid,
      u.id,
      i.id,
      amount,
      reference,
      b.attachmentId || null,
      "submitted",
      now(),
      key,
    );
    return this.s.one("SELECT * FROM payment_submissions WHERE id=?", sid)!;
  }
  verifyPayment(u: Row, pid: string, b: Row) {
    this.committee(u, pid);
    return this.s.tx(() => {
      const p = this.s.one(
        "SELECT * FROM payment_submissions WHERE id=? AND project_id=?",
        text(b.id),
        pid,
      );
      if (!p) fail("Submission unavailable.", 404);
      if (p.status === "verified")
        return this.s.one(
          "SELECT * FROM project_receipts WHERE submission_id=?",
          p.id,
        )!;
      if (p.user_id === u.id)
        fail("Another committee member must verify your own payment.", 403);
      if (!b.confirmed)
        fail(
          "Confirm the project’s bank or cash record, not just the screenshot.",
        );
      const d = date(b.date);
      this.openDate(pid, d);
      const i = this.invoiceBalance(this.invoice(pid, p.invoice_id)),
        allocated = Math.min(p.amount, Math.max(i.balance, 0)),
        rid = id();
      this.s.run(
        "INSERT INTO project_receipts VALUES(?,?,?,?,?,?,?,?)",
        rid,
        pid,
        p.user_id,
        p.id,
        p.amount,
        allocated,
        d,
        u.id,
      );
      this.s.run(
        "INSERT INTO project_cash VALUES(?,?,?,?,?,?,?)",
        id(),
        pid,
        "general",
        p.amount,
        d,
        `receipt:${rid}`,
        "Committee-verified resident receipt",
      );
      this.s.run(
        "UPDATE payment_submissions SET status='verified' WHERE id=?",
        p.id,
      );
      this.history(
        u,
        pid,
        "payment.verified",
        rid,
        "Verified against project records",
      );
      return { id: rid, amount: p.amount, allocated };
    });
  }
  applyCredit(u: Row, pid: string, b: Row) {
    this.committee(u, pid);
    return this.s.tx(() => {
      const i = this.invoiceBalance(this.invoice(pid, text(b.invoiceId)));
      if (!["published", "closed"].includes(i.state))
        fail("Publish the invoice first.");
      const amount = integer(b.amount, 1);
      if (amount > this.credit(pid, i.payer_id) || amount > i.balance)
        fail("Insufficient advance or invoice balance.");
      this.s.run(
        "INSERT INTO credit_allocations VALUES(?,?,?,?,?,?)",
        id(),
        pid,
        i.payer_id,
        i.id,
        amount,
        now(),
      );
      this.history(
        u,
        pid,
        "credit.applied",
        i.id,
        "Existing advance applied; no new cash",
      );
      return { ok: true };
    });
  }
  openDate(pid: string, d: string) {
    if (
      this.s.one(
        "SELECT 1 FROM billing_periods WHERE project_id=? AND month=? AND state='closed'",
        pid,
        d.slice(0, 7),
      )
    )
      fail("This month is closed. Post a correction in an open month.");
  }
  ownAttachment(u: Row, pid: string, aid: string) {
    const a = this.s.one(
      "SELECT * FROM project_attachments WHERE id=? AND project_id=? AND owner_id=?",
      aid,
      pid,
      u.id,
    );
    if (!a) fail("Attachment outside your project or ownership.", 403);
    return a;
  }
  upload(u: Row, pid: string, b: Row) {
    this.member(u, pid);
    const data = text(b.data, 2800000),
      mime = text(b.mime, 50),
      name = text(b.name, 120),
      redacted = b.redacted === true;
    if (redacted) this.committee(u, pid);
    if (
      !["application/pdf", "image/png", "image/jpeg"].includes(mime) ||
      !/^[A-Za-z0-9+/=]+$/.test(data)
    )
      fail("Use a PDF, PNG or JPEG under 2 MB.");
    const buf = Buffer.from(data, "base64");
    const valid =
      mime === "application/pdf"
        ? buf.subarray(0, 5).toString() === "%PDF-"
        : mime === "image/png"
          ? buf
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : buf.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
    if (!valid || buf.length > 2000000) fail("Invalid attachment.");
    const aid = id();
    this.s.run(
      "INSERT INTO project_attachments VALUES(?,?,?,?,?,?,?,?)",
      aid,
      pid,
      u.id,
      name,
      mime,
      encrypt(buf),
      redacted ? "redacted" : "private",
      now(),
    );
    return { id: aid, name, mime };
  }
  attachment(u: Row, pid: string, aid: string) {
    this.member(u, pid);
    const a = this.s.one(
      "SELECT * FROM project_attachments WHERE id=? AND project_id=?",
      aid,
      pid,
    );
    if (!a) fail("Attachment unavailable.", 404);
    const published = this.s.one(
      "SELECT 1 FROM project_expense_bills b JOIN billing_periods p ON p.project_id=b.project_id AND p.month=b.period WHERE b.redacted_attachment_id=? AND b.project_id=? AND b.status='approved' AND p.state IN ('published','closed')",
      aid,
      pid,
    );
    const projectBill = this.s.one(
      "SELECT 1 FROM project_expense_bills WHERE project_id=? AND (attachment_id=? OR redacted_attachment_id=?)",
      pid,
      aid,
      aid,
    );
    if (
      !(a.owner_id === u.id && !projectBill) &&
      !this.committee(u, pid, false) &&
      !(a.visibility === "redacted" && published)
    )
      fail("Private attachment.", 403);
    return { name: a.name, mime: a.mime, data: decrypt(a.encrypted) };
  }
  expense(u: Row, pid: string, b: Row) {
    this.committee(u, pid);
    const settings = this.settings(pid);
    if (!settings.policy.categories?.includes(b.category))
      fail("Enable this category only if it applies to your building.");
    const m = month(b.period);
    this.openDate(pid, `${m}-01`);
    const amount = integer(b.amount, b.correctionOf ? -100000000 : 1);
    if (amount === 0) fail("A correction must change the amount.");
    const vendor = text(b.vendor, 200),
      number = text(b.billNumber, 100);
    if (b.attachmentId) this.ownAttachment(u, pid, b.attachmentId);
    if (b.redactedAttachmentId) {
      const a = this.ownAttachment(u, pid, b.redactedAttachmentId);
      if (a.visibility !== "redacted")
        fail("Upload a separately redacted resident copy.");
    }
    if (
      this.s.one(
        "SELECT 1 FROM project_expense_bills WHERE project_id=? AND vendor=? AND bill_number=?",
        pid,
        vendor,
        number,
      )
    )
      fail("Duplicate vendor bill. Review the existing record.", 409);
    if (b.serviceRequestId) {
      if (!b.reviewedService)
        fail("Explicit review of the MDP service bill is required.");
      const r = this.s.one(
        "SELECT r.* FROM service_requests r JOIN flats f ON f.id=r.flat_id WHERE r.id=? AND f.project_id=? AND r.user_id=? AND r.status='completed'",
        b.serviceRequestId,
        pid,
        u.id,
      );
      if (!r)
        fail("Only your completed project service request can be linked.");
      if (
        this.s.one(
          "SELECT 1 FROM project_expense_bills WHERE service_request_id=?",
          r.id,
        )
      )
        fail("This service bill is already linked.", 409);
    }
    const details: Row = {
      correctionOf: b.correctionOf || null,
      reason: b.reason || null,
    };
    if (b.correctionOf) {
      const original = this.s.one(
        "SELECT id FROM project_expense_bills WHERE id=? AND project_id=?",
        b.correctionOf,
        pid,
      );
      if (!original) fail("Correction target is outside this project.");
      text(b.reason, 1000);
      const originalBill = this.s.one(
        "SELECT * FROM project_expense_bills WHERE id=?",
        b.correctionOf,
      )!;
      if (JSON.parse(originalBill.details).correctionOf)
        fail("Reference the original bill for corrections.");
      if (m < originalBill.period)
        fail("Correction cannot precede the original bill.");
    }
    if (b.category === "Generator diesel") {
      details.litres = integer(b.litres, 1, 100000);
      details.rate = integer(b.rate, 1, 100000);
      details.meter = String(b.meter || "").slice(0, 300);
      if (details.litres * details.rate !== amount)
        fail("Diesel litres × rate must equal the bill amount.");
    }
    const eid = id();
    this.s.run(
      "INSERT INTO project_expense_bills VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      eid,
      pid,
      b.category,
      text(b.description, 1000),
      m,
      vendor,
      date(b.billDate),
      number,
      amount,
      date(b.dueDate),
      "pending",
      u.id,
      null,
      b.attachmentId || null,
      b.redactedAttachmentId || null,
      JSON.stringify(details),
      b.serviceRequestId || null,
      now(),
    );
    this.history(
      u,
      pid,
      "expense.submitted",
      eid,
      "Accrued vendor bill; no cash movement",
    );
    return { id: eid };
  }
  approveExpense(u: Row, pid: string, b: Row) {
    this.committee(u, pid);
    const e = this.s.one(
      "SELECT * FROM project_expense_bills WHERE id=? AND project_id=?",
      text(b.id),
      pid,
    );
    if (!e) fail("Bill unavailable.", 404);
    this.openDate(pid, `${e.period}-01`);
    const policy = this.settings(pid).policy;
    if (
      e.created_by === u.id &&
      (policy.independentReview || e.amount >= policy.approvalThreshold)
    )
      fail("Independent committee review is required.", 403);
    if (JSON.parse(e.details).correctionOf) {
      const original = JSON.parse(e.details).correctionOf;
      const b = this.s.one(
        "SELECT * FROM project_expense_bills WHERE id=? AND project_id=?",
        original,
        pid,
      )!;
      const delta = Number(
          this.s.one(
            "SELECT coalesce(sum(amount),0) n FROM project_expense_bills WHERE project_id=? AND status='approved' AND id!=? AND json_extract(details,'$.correctionOf')=?",
            pid,
            e.id,
            original,
          )!.n,
        ),
        paid = Number(
          this.s.one(
            "SELECT coalesce(sum(amount),0) n FROM project_expense_payments WHERE bill_id=?",
            original,
          )!.n,
        );
      if (b.amount + delta + e.amount < paid)
        fail(
          "Correction would reduce the vendor balance below payments already recorded; resolve the vendor refund first.",
        );
    }
    this.s.run(
      "UPDATE project_expense_bills SET status='approved',reviewed_by=? WHERE id=?",
      u.id,
      e.id,
    );
    this.history(
      u,
      pid,
      "expense.approved",
      e.id,
      "Approved without recording a payment",
    );
    return { ok: true };
  }
  payExpense(u: Row, pid: string, b: Row) {
    this.committee(u, pid);
    return this.s.tx(() => {
      const key = text(b.key, 100),
        prior = this.s.one(
          "SELECT * FROM project_expense_payments WHERE project_id=? AND request_key=?",
          pid,
          key,
        );
      if (prior) {
        if (prior.bill_id !== b.id || prior.amount !== b.amount)
          fail("Retry differs from original payment.", 409);
        return prior;
      }
      const e = this.s.one(
        "SELECT * FROM project_expense_bills WHERE id=? AND project_id=? AND status='approved'",
        text(b.id),
        pid,
      );
      if (!e) fail("An approved bill in this project is required.", 403);
      if (JSON.parse(e.details).correctionOf)
        fail("Record settlement against the original vendor bill.");
      const adjustments = Number(
        this.s.one(
          "SELECT coalesce(sum(amount),0) n FROM project_expense_bills WHERE project_id=? AND status='approved' AND json_extract(details,'$.correctionOf')=?",
          pid,
          e.id,
        )!.n,
      );
      const paid = Number(
          this.s.one(
            "SELECT coalesce(sum(amount),0) n FROM project_expense_payments WHERE bill_id=?",
            e.id,
          )!.n,
        ),
        amount = integer(b.amount, 1);
      if (amount > e.amount + adjustments - paid)
        fail("Payment exceeds vendor balance.");
      const d = date(b.date);
      this.openDate(pid, d);
      const eid = id();
      this.s.run(
        "INSERT INTO project_expense_payments VALUES(?,?,?,?,?,?,?,?,?)",
        eid,
        pid,
        e.id,
        amount,
        d,
        text(b.method, 50),
        text(b.reference, 200),
        u.id,
        key,
      );
      this.s.run(
        "INSERT INTO project_cash VALUES(?,?,?,?,?,?,?)",
        id(),
        pid,
        "general",
        -amount,
        d,
        `expense-payment:${eid}`,
        "Vendor payment",
      );
      this.history(u, pid, "expense.paid", eid, "Project payment recorded");
      return { id: eid };
    });
  }
  accounts(u: Row, pid: string, m: string, ignoreSnapshot = false): Row {
    this.member(u, pid);
    m = month(m);
    const c = this.committee(u, pid, false),
      period = this.s.one(
        "SELECT * FROM billing_periods WHERE project_id=? AND month=?",
        pid,
        m,
      );
    if (!c && !["published", "closed"].includes(period?.state))
      fail("Accounts have not been published.", 403);
    if (period?.state === "closed" && period.snapshot && !ignoreSnapshot)
      return JSON.parse(period.snapshot);
    const settings = this.settings(pid),
      cash = this.s.all("SELECT * FROM project_cash WHERE project_id=?", pid),
      before = cash.filter((x) => x.date.slice(0, 7) < m),
      within = cash.filter((x) => x.date.slice(0, 7) === m),
      sum = (r: Row[]) => r.reduce((a, x) => a + x.amount, 0);
    const isTransfer = (r: Row) =>
      String(r.source).startsWith("manual:") &&
      JSON.parse(r.description).action === "reserve_transfer";
    const reserveTransfer = sum(
      within.filter((x) => x.fund === "general" && isTransfer(x)),
    );
    const advances =
      Number(
        this.s.one(
          "SELECT coalesce(sum(amount-allocated),0) n FROM project_receipts WHERE project_id=? AND substr(date,1,7)<=?",
          pid,
          m,
        )!.n,
      ) -
      Number(
        this.s.one(
          "SELECT coalesce(sum(amount),0) n FROM credit_allocations WHERE project_id=? AND substr(created,1,7)<=?",
          pid,
          m,
        )!.n,
      );
    const opening =
        settings.opening_cash + sum(before.filter((x) => x.fund === "general")),
      receipts = sum(
        within.filter(
          (x) => x.fund === "general" && x.amount > 0 && !isTransfer(x),
        ),
      ),
      payments = Math.abs(
        sum(
          within.filter(
            (x) => x.fund === "general" && x.amount < 0 && !isTransfer(x),
          ),
        ),
      ),
      reserve =
        settings.opening_reserve +
        sum(
          cash.filter((x) => x.fund === "reserve" && x.date.slice(0, 7) <= m),
        );
    const bills = this.s.all(
        "SELECT category,amount FROM project_expense_bills WHERE project_id=? AND period=? AND status='approved'",
        pid,
        m,
      ),
      expenses = bills.reduce((a, x) => a + x.amount, 0),
      invoiceTotal =
        Number(
          this.s.one(
            "SELECT coalesce(sum(i.amount),0) n FROM flat_invoices i JOIN billing_periods p ON p.id=i.period_id WHERE i.project_id=? AND p.month=? AND p.state IN ('published','closed')",
            pid,
            m,
          )!.n,
        ) +
        Number(
          this.s.one(
            "SELECT coalesce(sum(a.amount),0) n FROM invoice_adjustments a JOIN flat_invoices i ON i.id=a.invoice_id JOIN billing_periods p ON p.id=i.period_id WHERE a.project_id=? AND a.effective_month=? AND p.state IN ('published','closed')",
            pid,
            m,
          )!.n,
        );
    const invoices = this.s.all(
      "SELECT i.*,p.month,p.state FROM flat_invoices i JOIN billing_periods p ON p.id=i.period_id WHERE i.project_id=? AND p.month<=? AND p.state IN ('published','closed')",
      pid,
      m,
    );
    const openingDues = invoices
      .filter((i) => i.month === m)
      .reduce(
        (a, i) =>
          a +
          JSON.parse(i.lines)
            .filter((l: Row) => l.label === "Verified opening dues")
            .reduce((n: number, l: Row) => n + l.amount, 0),
        0,
      );
    const billed = invoiceTotal - openingDues;
    const receivables = invoices.reduce(
        (a, i) => a + this.invoiceBalance(i, m).balance,
        0,
      ),
      payables =
        Number(
          this.s.one(
            "SELECT coalesce(sum(b.amount),0) n FROM project_expense_bills b WHERE b.project_id=? AND b.period<=? AND b.status='approved'",
            pid,
            m,
          )!.n,
        ) -
        Number(
          this.s.one(
            "SELECT coalesce(sum(amount),0) n FROM project_expense_payments WHERE project_id=? AND substr(date,1,7)<=?",
            pid,
            m,
          )!.n,
        );
    const budgets = this.s
      .all(
        "SELECT payload FROM project_operations WHERE project_id=? AND kind='budget'",
        pid,
      )
      .map((x) => {
        const b = JSON.parse(x.payload);
        return { month: b.month, category: b.category, amount: b.amount };
      });
    return {
      projectId: pid,
      month: m,
      state: period?.state || "unbilled",
      opening,
      receipts,
      payments,
      closing: opening + receipts - payments + reserveTransfer,
      reserveTransfer,
      advances,
      reserve,
      receivables,
      payables,
      billed,
      openingDues,
      expenses,
      accrualSurplus: billed - expenses,
      categories: bills.reduce((a: Row, x) => {
        a[x.category] = (a[x.category] || 0) + x.amount;
        return a;
      }, {}),
      budgets,
    };
  }
  cashRecord(u: Row, pid: string, b: Row): Row {
    this.committee(u, pid);
    return this.s.tx(() => {
      const amount = integer(b.amount, 1),
        d = date(b.date),
        reason = text(b.reason, 500),
        reference = text(b.reference, 200),
        k = text(b.key, 100);
      this.openDate(pid, d);
      if (!b.confirmed) fail("Confirm the actual project cash or bank entry.");
      if (
        !["other_receipt", "reserve_transfer"].includes(b.action) ||
        !["general", "reserve"].includes(b.fund)
      )
        fail("Choose a receipt or a same-project reserve transfer.");
      const source = `manual:${pid}:${k}`,
        description = JSON.stringify({
          action: b.action,
          fund: b.fund,
          amount,
          date: d,
          reason,
          reference,
        });
      const prior = this.s.one(
        "SELECT * FROM project_cash WHERE source=?",
        source,
      );
      if (prior) {
        if (prior.description !== description)
          fail("Retry differs from the recorded entry.", 409);
        return { id: prior.id };
      }
      const cid = id();
      if (b.action === "reserve_transfer") {
        const from = b.fund === "reserve" ? "general" : "reserve",
          settings = this.settings(pid),
          balance =
            (from === "general"
              ? settings.opening_cash
              : settings.opening_reserve) +
            Number(
              this.s.one(
                "SELECT coalesce(sum(amount),0) n FROM project_cash WHERE project_id=? AND fund=? AND date<=?",
                pid,
                from,
                d,
              )!.n,
            );
        if (amount > balance)
          fail(
            "Transfer exceeds this project fund’s recorded available balance.",
          );
        this.s.run(
          "INSERT INTO project_cash VALUES(?,?,?,?,?,?,?)",
          id(),
          pid,
          from,
          -amount,
          d,
          source + ":from",
          description,
        );
      }
      this.s.run(
        "INSERT INTO project_cash VALUES(?,?,?,?,?,?,?)",
        cid,
        pid,
        b.fund,
        amount,
        d,
        source,
        description,
      );
      this.history(u, pid, `cash.${b.action}`, cid, reason);
      return { id: cid };
    });
  }
  annual(u: Row, pid: string, year: string): Row {
    this.member(u, pid);
    if (!/^\d{4}$/.test(year)) fail("Use a four-digit year.");
    const months = this.s
      .all(
        "SELECT month FROM billing_periods WHERE project_id=? AND substr(month,1,4)=? AND state IN ('published','closed') ORDER BY month",
        pid,
        year,
      )
      .map((p) => this.accounts(u, pid, p.month));
    const total = (field: string) =>
      months.reduce((a, m) => a + Number(m[field] || 0), 0);
    return {
      projectId: pid,
      year,
      months,
      receipts: total("receipts"),
      payments: total("payments"),
      billed: total("billed"),
      expenses: total("expenses"),
      opening: months[0]?.opening || 0,
      closing: months.at(-1)?.closing || 0,
      reserve: months.at(-1)?.reserve || 0,
      receivables: months.at(-1)?.receivables || 0,
      payables: months.at(-1)?.payables || 0,
    };
  }
  question(u: Row, pid: string, qid: string): Row {
    this.member(u, pid);
    const q = this.s.one(
      "SELECT * FROM project_questions WHERE id=? AND project_id=?",
      qid,
      pid,
    );
    if (
      !q ||
      !(
        q.user_id === u.id ||
        q.visibility === "project" ||
        this.committee(u, pid, false)
      )
    )
      fail("Question unavailable.", 404);
    return q;
  }
  ask(u: Row, pid: string, b: Row) {
    this.member(u, pid);
    if (b.attachmentId) this.ownAttachment(u, pid, b.attachmentId);
    const qid = id();
    if (
      ![
        "Billing",
        "Maintenance",
        "Repairs",
        "Water",
        "Power",
        "Lift",
        "Suggestion",
        "General",
      ].includes(b.category)
    )
      fail("Choose a question category.");
    this.s.run(
      "INSERT INTO project_questions VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      qid,
      pid,
      u.id,
      b.category,
      text(b.subject, 150),
      text(b.body, 3000),
      b.visibility === "project" ? "project" : "private",
      "open",
      null,
      b.attachmentId || null,
      b.faqConsent ? 1 : 0,
      now(),
    );
    this.history(u, pid, "question.created", qid, "Private by default");
    return { id: qid };
  }
  reply(u: Row, pid: string, b: Row) {
    const q = this.question(u, pid, text(b.id)),
      committee = this.committee(u, pid, false);
    if (q.user_id !== u.id && !committee && q.visibility !== "project")
      fail("Only the author and committee can reply.", 403);
    return this.s.tx(() => {
      if (b.body)
        this.s.run(
          "INSERT INTO project_replies VALUES(?,?,?,?,?,?)",
          id(),
          pid,
          q.id,
          u.id,
          text(b.body, 3000),
          now(),
        );
      if (b.status) {
        if (
          ![
            "open",
            "in_progress",
            "awaiting_resident",
            "resolved",
            "escalated",
          ].includes(b.status)
        )
          fail("Invalid question status.");
        if (
          !committee &&
          (q.user_id !== u.id || !["open", "escalated"].includes(b.status))
        )
          fail("Committee status update required.", 403);
        this.s.run(
          "UPDATE project_questions SET status=? WHERE id=?",
          b.status,
          q.id,
        );
      }
      if (b.assignedTo) {
        if (!committee) fail("Committee assignment required.", 403);
        this.committee({ id: b.assignedTo }, pid);
        this.s.run(
          "UPDATE project_questions SET assigned_to=? WHERE id=?",
          b.assignedTo,
          q.id,
        );
      }
      this.history(
        u,
        pid,
        "question.updated",
        q.id,
        String(b.status || "reply"),
      );
      return { ok: true };
    });
  }
  operation(u: Row, pid: string, b: Row) {
    this.committee(u, pid);
    if (
      ![
        "notice",
        "meeting",
        "asset",
        "template",
        "budget",
        "faq",
        "poll",
        "handover",
      ].includes(b.kind)
    )
      fail("Invalid community operation.");
    const payload = b.payload;
    if (
      !payload ||
      Array.isArray(payload) ||
      JSON.stringify(payload).length > 6000
    )
      fail("Provide a short operation record.");
    if (
      b.kind === "poll" &&
      (!Array.isArray(payload.options) ||
        payload.options.length < 2 ||
        payload.options.length > 8 ||
        new Set(payload.options).size !== payload.options.length ||
        payload.options.some(
          (x: unknown) => typeof x !== "string" || !x.trim() || x.length > 100,
        ) ||
        !payload.ends ||
        isNaN(Date.parse(payload.ends)) ||
        payload.ends <= now())
    )
      fail("A poll needs 2–8 distinct options and a future closing date.");
    if (b.kind === "faq") {
      const q = this.question(u, pid, text(payload.questionId));
      if (
        q.status !== "resolved" ||
        q.visibility !== "project" ||
        !q.faq_consent ||
        !payload.redacted
      )
        fail(
          "FAQ needs resolved public question, consent and explicit redaction.",
        );
    }
    if (
      b.kind === "asset" &&
      !this.settings(pid).policy.categories?.includes(payload.category)
    )
      fail("Only configured building equipment can be registered.");
    if (b.kind === "budget") {
      month(payload.month);
      integer(payload.amount, 0);
      if (!expenseCategories.includes(payload.category))
        fail("Invalid budget category.");
    }
    const oid = id();
    this.s.run(
      "INSERT INTO project_operations VALUES(?,?,?,?,?,?,?)",
      oid,
      pid,
      b.kind,
      text(b.title, 200),
      JSON.stringify(payload),
      u.id,
      now(),
    );
    this.history(u, pid, `operation.${b.kind}`, oid, "Project-scoped record");
    return { id: oid };
  }
  vote(u: Row, pid: string, b: Row) {
    this.member(u, pid);
    const p = this.s.one(
      "SELECT * FROM project_operations WHERE id=? AND project_id=? AND kind='poll'",
      text(b.id),
      pid,
    );
    if (!p) fail("Poll unavailable.", 404);
    const payload = JSON.parse(p.payload);
    if (
      !Array.isArray(payload.options) ||
      !payload.options.includes(b.choice) ||
      payload.ends < now()
    )
      fail("Poll closed or invalid option.");
    this.s.run(
      "INSERT INTO project_votes VALUES(?,?,?,?) ON CONFLICT(operation_id,user_id) DO UPDATE SET choice=excluded.choice",
      pid,
      p.id,
      u.id,
      b.choice,
    );
    return { ok: true };
  }
  workspace(u: Row, pid: string): Row {
    this.member(u, pid);
    const c = this.committee(u, pid, false),
      settings = this.settings(pid);
    const invoices = this.s
      .all(
        `SELECT i.*,p.month,p.state,f.label FROM flat_invoices i JOIN billing_periods p ON p.id=i.period_id JOIN flats f ON f.id=i.flat_id WHERE i.project_id=? ${c ? "" : "AND i.payer_id=? AND p.state IN ('published','closed')"} ORDER BY p.month DESC,f.label`,
        pid,
        ...(c ? [] : [u.id]),
      )
      .map((i) => this.invoiceBalance(i));
    const questions = this.s
      .all(
        `SELECT * FROM project_questions WHERE project_id=? ${c ? "" : "AND (user_id=? OR visibility='project')"} ORDER BY created DESC`,
        pid,
        ...(c ? [] : [u.id]),
      )
      .map((q) => ({
        ...q,
        attachment_id: c || q.user_id === u.id ? q.attachment_id : null,
        replies: this.s.all(
          "SELECT r.*,u.name FROM project_replies r JOIN users u ON u.id=r.user_id WHERE r.question_id=? ORDER BY r.created",
          q.id,
        ),
        history: this.s.all(
          "SELECT kind,details,created FROM project_history WHERE project_id=? AND target=? ORDER BY created",
          pid,
          q.id,
        ),
      }));
    const bills = this.s
      .all(
        `SELECT b.*,b.amount original_amount,b.amount+coalesce((SELECT sum(c.amount) FROM project_expense_bills c WHERE c.project_id=b.project_id AND c.status='approved' AND json_extract(c.details,'$.correctionOf')=b.id),0) adjusted_amount,coalesce((SELECT sum(amount) FROM project_expense_payments p WHERE p.bill_id=b.id),0) paid FROM project_expense_bills b WHERE b.project_id=? ${c ? "" : "AND b.status='approved' AND EXISTS(SELECT 1 FROM billing_periods p WHERE p.project_id=b.project_id AND p.month=b.period AND p.state IN ('published','closed'))"} ORDER BY b.created DESC`,
        pid,
      )
      .map((b) =>
        c
          ? { ...b, amount: b.adjusted_amount }
          : {
              id: b.id,
              project_id: pid,
              category: b.category,
              description: b.description,
              period: b.period,
              amount: b.amount,
              paid: b.paid,
              redacted_attachment_id: b.redacted_attachment_id,
              status: b.status,
            },
      );
    const periods = this.s.all(
      `SELECT id,month,state FROM billing_periods WHERE project_id=? ${c ? "" : "AND state IN ('published','closed')"} ORDER BY month DESC`,
      pid,
    );
    return {
      project: this.s.one("SELECT * FROM projects WHERE id=?", pid),
      membership: this.memberships(u.id, pid),
      committeeMode: !!c,
      appointment: c,
      renewals: this.s.all(
        "SELECT id,title,json_extract(payload,'$.renewal') renewal FROM project_operations WHERE project_id=? AND kind='asset' AND json_extract(payload,'$.renewal')<=? ORDER BY renewal",
        pid,
        new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-CA", {
          timeZone: "Asia/Kolkata",
        }),
      ),
      linkableServices: c
        ? this.s.all(
            "SELECT r.id,r.category_id,r.description,f.label FROM service_requests r JOIN flats f ON f.id=r.flat_id WHERE f.project_id=? AND r.user_id=? AND r.status='completed' AND NOT EXISTS(SELECT 1 FROM project_expense_bills b WHERE b.service_request_id=r.id)",
            pid,
            u.id,
          )
        : [],
      eligiblePayers: c
        ? this.s.all(
            "SELECT DISTINCT u.id,u.name,f.label FROM users u JOIN memberships m ON m.user_id=u.id JOIN flats f ON f.id=m.flat_id WHERE f.project_id=? AND u.deleted=0 AND m.status='approved' AND m.move_in<=? AND (m.move_out IS NULL OR m.move_out>?) UNION SELECT u.id,u.name,f.label FROM ownership o JOIN flats f ON f.id=o.flat_id JOIN users u ON u.id=o.user_id WHERE f.project_id=? AND u.deleted=0",
            pid,
            now(),
            now(),
            pid,
          )
        : [],
      settings: c
        ? settings
        : {
            enabled: settings.enabled,
            start_date: settings.start_date,
            policy: settings.policy,
          },
      committee: this.s.all(
        "SELECT a.id,a.user_id,a.position,a.starts,a.ends,u.name FROM committee_appointments a JOIN users u ON u.id=a.user_id WHERE a.project_id=? AND a.status='active' AND a.starts<=? AND a.ends>?",
        pid,
        localDay(),
        localDay(),
      ),
      periods,
      invoices,
      credit: this.credit(pid, u.id),
      bills,
      questions,
      submissions: this.s.all(
        `SELECT * FROM payment_submissions WHERE project_id=? ${c ? "" : "AND user_id=?"} ORDER BY created DESC`,
        pid,
        ...(c ? [] : [u.id]),
      ),
      receipts: this.s.all(
        `SELECT * FROM project_receipts WHERE project_id=? ${c ? "" : "AND user_id=?"} ORDER BY date DESC`,
        pid,
        ...(c ? [] : [u.id]),
      ),
      operations: this.s
        .all(
          `SELECT * FROM project_operations WHERE project_id=? ${c ? "" : "AND kind IN ('notice','meeting','asset','faq','poll')"} ORDER BY created DESC`,
          pid,
        )
        .map((o) => ({
          ...o,
          payload: JSON.parse(o.payload),
          votes:
            o.kind === "poll"
              ? this.s.all(
                  "SELECT choice,count(*) count FROM project_votes WHERE operation_id=? GROUP BY choice",
                  o.id,
                )
              : undefined,
        })),
      flats: c
        ? this.s.all(
            "SELECT f.*,l.payer_id,l.area,l.area_verified,l.opening_due,l.exemption FROM flats f LEFT JOIN flat_liability l ON l.flat_id=f.id WHERE f.project_id=?",
            pid,
          )
        : [],
      history: c
        ? this.s.all(
            "SELECT * FROM project_history WHERE project_id=? ORDER BY created DESC LIMIT 100",
            pid,
          )
        : [],
    };
  }
}
