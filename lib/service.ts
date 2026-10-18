import type { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { id, now, hash, encrypt, decrypt, type Row } from "./db.ts";
import { amortize } from "./finance.ts";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function fail(message: string, status = 400): never {
  throw new AppError(status, message);
}
const text = (v: unknown, max = 200) =>
  typeof v === "string" && v.trim().length > 0 && v.trim().length <= max
    ? v.trim()
    : fail("A required text field is missing or too long.");
const integer = (v: unknown, min = 0, max = 1e9) =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max
    ? v
    : fail("Invalid numeric value.");
const future = (v: unknown) => {
  const s = text(v, 40),
    d = new Date(s);
  if (!Number.isFinite(d.getTime()) || d.getTime() <= Date.now())
    fail("Choose a future date and time.");
  return d.toISOString();
};
export class Service {
  constructor(public db: DatabaseSync) {}
  one(sql: string, ...args: any[]): Row | undefined {
    return this.db.prepare(sql).get(...args) as Row | undefined;
  }
  all(sql: string, ...args: any[]): Row[] {
    return this.db.prepare(sql).all(...args) as Row[];
  }
  run(sql: string, ...args: any[]) {
    return this.db.prepare(sql).run(...args);
  }
  tx<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const r = fn();
      this.db.exec("COMMIT");
      return r;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  audit(u: Row, action: string, target: string) {
    this.run(
      "INSERT INTO audit VALUES(?,?,?,?,?)",
      id(),
      u.id,
      action,
      target,
      now(),
    );
  }
  login(actor: string) {
    const u =
      this.one(
        "SELECT id,name,role,project_id FROM users WHERE id=? AND deleted=0",
        actor,
      ) || fail("Demo persona unavailable.", 404);
    const token = randomBytes(32).toString("hex");
    this.run(
      "INSERT INTO sessions VALUES(?,?,?,NULL)",
      hash(token),
      u.id,
      new Date(Date.now() + 12 * 3600000).toISOString(),
    );
    return { token, user: u };
  }
  auth(token: string) {
    return (
      this.one(
        "SELECT u.*,s.stepup_until FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND u.deleted=0",
        hash(token),
        now(),
      ) || fail("Sign in to a demo persona first.", 401)
    );
  }
  role(u: Row, roles: string[]) {
    if (!roles.includes(u.role))
      fail("This role cannot perform that action.", 403);
  }
  membership(u: Row, flat?: string) {
    return (
      this.one(
        `SELECT m.*,f.project_id,f.label FROM memberships m JOIN flats f ON f.id=m.flat_id WHERE m.user_id=? AND m.status='approved' AND (m.move_out IS NULL OR m.move_out>?) ${flat ? "AND f.id=?" : ""}`,
        u.id,
        now(),
        ...(flat ? [flat] : []),
      ) || fail("An approved, active residence is required.", 403)
    );
  }
  resident(u: Row) {
    this.role(u, ["resident"]);
    return this.membership(u);
  }
  eligible(
    u: Row,
    kind: "groceries" | "carpool" | "maintenance",
    flat?: string,
  ) {
    const m = this.membership(u, flat);
    if (
      !this.one(
        `SELECT * FROM services WHERE project_id=? AND ${kind}=1`,
        m.project_id,
      )
    )
      fail("This service is not enabled for your project.", 403);
    return m;
  }
  prefs(u: Row) {
    return (
      this.one("SELECT * FROM preferences WHERE user_id=?", u.id) || {
        language: "en",
        notifications: 1,
        network: 0,
      }
    );
  }
  slots() {
    const slots = [];
    let t = Math.ceil((Date.now() + 3600000) / 3600000) * 3600000;
    while (slots.length < 3) {
      const hour = new Date(t + 19800000).getUTCHours();
      if (hour >= 8 && hour < 21) {
        const s = new Date(t).toISOString(),
          used = this.one(
            "SELECT count(*) n FROM orders WHERE slot=? AND status NOT IN ('cancelled','delivered','returned')",
            s,
          )!.n;
        const capacity =
          this.one(
            "SELECT count(*) n FROM riders WHERE charging=0 AND status!='off_shift' AND range_km>=5",
          )!.n * 3;
        slots.push({ id: s, remaining: Math.max(0, capacity - used) });
      }
      t += 3600000;
    }
    return slots;
  }
  bootstrap(u: Row) {
    const memberships = this.all(
      "SELECT m.*,f.project_id,f.label,p.name project FROM memberships m JOIN flats f ON f.id=m.flat_id JOIN projects p ON p.id=f.project_id WHERE m.user_id=?",
      u.id,
    );
    const active = memberships.find(
      (m) => m.status === "approved" && (!m.move_out || m.move_out > now()),
    );
    const services = active
      ? this.one("SELECT * FROM services WHERE project_id=?", active.project_id)
      : null;
    return {
      mode: "demo",
      user: { id: u.id, name: u.name, role: u.role },
      memberships,
      active,
      services,
      preferences: this.prefs(u),
      projects: this.all("SELECT * FROM projects"),
      products: this.all(
        "SELECT p.id,p.name,coalesce(a.store_group,p.category) category,p.unit,p.price,min(p.stock,coalesce((SELECT sum(b.quantity) FROM batches b WHERE b.product_id=p.id AND b.expiry>?),0)) stock,p.emoji,p.featured,a.launch_state FROM products p LEFT JOIN grocery_assortment a ON a.product_id=p.id",
        now(),
      ),
      slots: this.slots(),
      orders: this.orders(u),
      rides:
        u.role === "resident" && active && services?.carpool
          ? this.rides(u)
          : [],
      events: u.role === "resident" && active ? this.events(u) : [],
      posts: active
        ? this.all(
            "SELECT p.id,p.body,p.created,u.name FROM posts p JOIN users u ON u.id=p.user_id WHERE p.project_id=? AND p.status='published' AND u.role='association' ORDER BY p.created DESC",
            active.project_id,
          )
        : [],
      expenses: this.all(
        "SELECT * FROM expenses WHERE user_id=? ORDER BY date DESC",
        u.id,
      ),
      loans: this.all("SELECT * FROM loans WHERE user_id=?", u.id),
      loanPayments: this.all(
        "SELECT * FROM loan_payments WHERE user_id=?",
        u.id,
      ),
      dues: this.all("SELECT * FROM dues WHERE user_id=?", u.id),
      tickets: this.all(
        "SELECT * FROM tickets WHERE user_id=? ORDER BY created DESC",
        u.id,
      ),
      documents: this.all(
        "SELECT id,name,folder,mime,status,expires,created FROM documents WHERE user_id=?",
        u.id,
      ),
      shares: this.all(
        "SELECT id,document_id,recipient_id,expires,revoked FROM shares WHERE owner_id=?",
        u.id,
      ),
    };
  }
  orders(u: Row) {
    let where = "o.user_id=?",
      args: any[] = [u.id];
    if (["warehouse", "platform"].includes(u.role)) {
      where = "1=1";
      args = [];
    }
    if (u.role === "delivery") {
      where = "o.rider_id IN (SELECT id FROM riders WHERE user_id=?)";
    }
    return this.all(
      `SELECT o.id,o.user_id,o.status,o.payment,o.total,o.subtotal,o.fee,o.slot,o.rider_id,o.created,o.substitution,f.label,f.project_id,p.name project FROM orders o JOIN flats f ON f.id=o.flat_id JOIN projects p ON p.id=f.project_id WHERE ${where} ORDER BY o.created DESC`,
      ...args,
    ).map((o) => ({
      ...o,
      items: this.all(
        "SELECT name,quantity,price FROM order_items WHERE order_id=?",
        o.id,
      ),
    }));
  }
  checkout(u: Row, b: Row) {
    this.role(u, ["resident"]);
    const m = this.eligible(u, "groceries", text(b.flatId));
    const k = text(b.key, 100);
    if (!Array.isArray(b.items) || !b.items.length || b.items.length > 50)
      fail("Add at least one item.");
    const items = b.items
      .map((i: Row) => ({ id: text(i.id), qty: integer(i.qty, 1, 20) }))
      .sort((a: Row, b: Row) => a.id.localeCompare(b.id));
    if (new Set(items.map((i: Row) => i.id)).size !== items.length)
      fail("Duplicate cart items.");
    if (b.payment !== "cod")
      fail("Online payments are not configured. Use demo cash on delivery.");
    if (!["none", "ask"].includes(b.substitution))
      fail("Select your substitution preference.");
    const fingerprint = hash(
      JSON.stringify({
        items,
        slot: b.slot,
        flat: b.flatId,
        payment: b.payment,
        substitution: b.substitution,
      }),
    );
    return this.tx(() => {
      const prev = this.one(
        "SELECT * FROM idempotency WHERE user_id=? AND key=?",
        u.id,
        k,
      );
      if (prev) {
        if (prev.request_hash !== fingerprint)
          fail(
            "This checkout key was already used with a different cart.",
            409,
          );
        return JSON.parse(prev.result);
      }
      const slot = this.slots().find((s) => s.id === b.slot);
      if (!slot || slot.remaining < 1)
        fail("Delivery slot is full or no longer available.", 409);
      let subtotal = 0,
        cost = 0;
      const lines: Row[] = items.map((i: Row): Row => {
        const p =
          this.one("SELECT * FROM products WHERE id=?", i.id) ||
          fail("Product no longer available.", 404);
        const stock = this.one(
          "SELECT coalesce(sum(quantity),0) n FROM batches WHERE product_id=? AND expiry>?",
          p.id,
          now(),
        )!.n;
        if (p.stock < i.qty || stock < i.qty)
          fail(`${p.name} has insufficient fresh stock.`, 409);
        subtotal += p.price * i.qty;
        cost += p.cost * i.qty;
        return { ...p, qty: i.qty };
      });
      const oid = id(),
        fee = subtotal >= 29900 ? 0 : 2000;
      this.run(
        "INSERT INTO orders VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        oid,
        u.id,
        m.flat_id,
        "placed",
        "cod_due",
        subtotal + fee,
        subtotal,
        fee,
        cost,
        b.slot,
        null,
        null,
        now(),
        b.substitution,
      );
      for (const p of lines) {
        this.run("UPDATE products SET stock=stock-? WHERE id=?", p.qty, p.id);
        let left = p.qty;
        for (const batch of this.all(
          "SELECT * FROM batches WHERE product_id=? AND expiry>? AND quantity>0 ORDER BY expiry",
          p.id,
          now(),
        )) {
          const take = Math.min(left, batch.quantity);
          this.run(
            "UPDATE batches SET quantity=quantity-? WHERE id=?",
            take,
            batch.id,
          );
          this.run(
            "INSERT INTO order_batches VALUES(?,?,?)",
            oid,
            batch.id,
            take,
          );
          left -= take;
          if (!left) break;
        }
        this.run(
          "INSERT INTO order_items VALUES(?,?,?,?,?,?)",
          oid,
          p.id,
          p.name,
          p.qty,
          p.price,
          p.cost,
        );
        this.run(
          "INSERT INTO stock_movements VALUES(?,?,?,?,?)",
          id(),
          p.id,
          -p.qty,
          "order_reservation",
          now(),
        );
      }
      const result = { id: oid, total: subtotal + fee };
      this.run(
        "INSERT INTO idempotency VALUES(?,?,?,?)",
        u.id,
        k,
        fingerprint,
        JSON.stringify(result),
      );
      this.audit(u, "order.created", oid);
      return result;
    });
  }
  updateOrder(u: Row, oid: string, b: Row) {
    return this.tx(() => {
      const o =
        this.one("SELECT * FROM orders WHERE id=?", oid) ||
        fail("Order not found.", 404);
      const next = text(b.status);
      if (next === "cancelled") {
        if (o.user_id !== u.id && !["warehouse", "platform"].includes(u.role))
          fail("Order unavailable.", 403);
        if (!["placed", "picking"].includes(o.status))
          fail("This order can no longer be cancelled.", 409);
        for (const line of this.all(
          "SELECT * FROM order_items WHERE order_id=?",
          oid,
        )) {
          this.run(
            "UPDATE products SET stock=stock+? WHERE id=?",
            line.quantity,
            line.product_id,
          );
          for (const batch of this.all(
            "SELECT ob.* FROM order_batches ob JOIN batches b ON b.id=ob.batch_id WHERE ob.order_id=? AND b.product_id=?",
            oid,
            line.product_id,
          ))
            this.run(
              "UPDATE batches SET quantity=quantity+? WHERE id=?",
              batch.quantity,
              batch.batch_id,
            );
          this.run(
            "INSERT INTO stock_movements VALUES(?,?,?,?,?)",
            id(),
            line.product_id,
            line.quantity,
            "cancelled_reservation",
            now(),
          );
        }
      } else if (["picking", "packed", "out_for_delivery"].includes(next)) {
        this.role(u, ["warehouse", "platform"]);
        const transitions: Row = {
          placed: "picking",
          picking: "packed",
          packed: "out_for_delivery",
        };
        if (transitions[o.status] !== next)
          fail("Invalid fulfillment transition.", 409);
        if (next === "out_for_delivery") {
          const r =
            this.one(
              "SELECT * FROM riders WHERE id=? AND status!='off_shift' AND charging=0 AND range_km>=5",
              b.riderId,
            ) || fail("Choose an available rider with sufficient range.");
          const n = this.one(
            "SELECT count(*) n FROM orders WHERE rider_id=? AND status='out_for_delivery'",
            r.id,
          )!.n;
          if (n >= 3)
            fail("This rider already has three active deliveries.", 409);
          this.run(
            "UPDATE orders SET rider_id=?,otp_hash=? WHERE id=?",
            r.id,
            hash("123456"),
            oid,
          );
        }
      } else if (next === "delivered" || next === "returned") {
        this.role(u, ["delivery"]);
        const rider = this.one("SELECT id FROM riders WHERE user_id=?", u.id);
        if (o.rider_id !== rider?.id || o.status !== "out_for_delivery")
          fail("This is not your active delivery.", 403);
        if (next === "delivered" && hash(String(b.otp)) !== o.otp_hash)
          fail("Incorrect confirmation code. Demo code is 123456.");
        if (next === "delivered")
          this.run("UPDATE orders SET payment='cod_collected' WHERE id=?", oid);
        this.run(
          "UPDATE riders SET range_km=max(0,range_km-5) WHERE id=?",
          rider!.id,
        );
      } else fail("Unsupported order action.");
      this.run("UPDATE orders SET status=? WHERE id=?", next, oid);
      this.audit(u, `order.${next}`, oid);
      return { ok: true };
    });
  }
  ridePairAllowed(a: string, b: string) {
    return !this.one(
      "SELECT 1 FROM blocks WHERE (user_id=? AND target_id=?) OR (user_id=? AND target_id=?)",
      a,
      b,
      b,
      a,
    );
  }
  rideContact(rid: string, uid: string) {
    return (
      this.one(
        "SELECT contact FROM ride_contacts WHERE ride_id=? AND user_id=?",
        rid,
        uid,
      )?.contact || null
    );
  }
  setRideContact(rid: string, uid: string, value: unknown) {
    if (value === "") {
      this.run(
        "DELETE FROM ride_contacts WHERE ride_id=? AND user_id=?",
        rid,
        uid,
      );
      return;
    }
    const contact = text(value, 20);
    if (!/^\+?[0-9]{10,15}$/.test(contact))
      fail(
        "Enter a phone number with 10–15 digits, optionally starting with +.",
      );
    this.run(
      "INSERT INTO ride_contacts VALUES(?,?,?) ON CONFLICT(ride_id,user_id) DO UPDATE SET contact=excluded.contact",
      rid,
      uid,
      contact,
    );
  }
  rides(u: Row): Row[] {
    this.resident(u);
    this.eligible(u, "carpool");
    return this.all(
      "SELECT r.id,r.user_id,r.project_id,r.destination,r.pickup,r.departure,r.seats,r.recurrence,r.status,u.name driver,p.name project FROM rides r JOIN users u ON u.id=r.user_id JOIN projects p ON p.id=r.project_id WHERE u.deleted=0 AND r.status='open' AND r.departure>? AND EXISTS(SELECT 1 FROM memberships m JOIN flats f ON f.id=m.flat_id JOIN services s ON s.project_id=f.project_id WHERE m.user_id=r.user_id AND m.status='approved' AND (m.move_out IS NULL OR m.move_out>?) AND s.carpool=1) ORDER BY r.departure",
      now(),
      now(),
    )
      .filter((r) => this.ridePairAllowed(u.id, r.user_id))
      .map((r) => {
        const own = r.user_id === u.id;
        const requests = this.all(
          "SELECT q.id,q.user_id,q.status,u.name FROM ride_requests q JOIN users u ON u.id=q.user_id WHERE q.ride_id=? AND u.deleted=0",
          r.id,
        )
          .filter(
            (q) =>
              (own || q.user_id === u.id) &&
              this.ridePairAllowed(q.user_id, r.user_id),
          )
          .filter((q) => {
            try {
              this.eligible(
                this.one("SELECT * FROM users WHERE id=?", q.user_id)!,
                "carpool",
              );
              return true;
            } catch {
              return false;
            }
          })
          .map((q) => ({
            ...q,
            contact:
              own && q.status === "accepted"
                ? this.rideContact(r.id, q.user_id)
                : null,
          }));
        return {
          ...r,
          ownContact: this.rideContact(r.id, u.id),
          contact:
            !own && requests.some((q: Row) => q.status === "accepted")
              ? this.rideContact(r.id, r.user_id)
              : null,
          requests,
        };
      });
  }
  createRide(u: Row, b: Row) {
    this.resident(u);
    const m = this.eligible(u, "carpool");
    const rid = id();
    return this.tx(() => {
      this.run(
        "INSERT INTO rides VALUES(?,?,?,?,?,?,?,?,?,?)",
        rid,
        u.id,
        m.project_id,
        text(b.destination, 100),
        text(b.pickup, 100),
        future(b.departure),
        integer(b.seats, 1, 6),
        0,
        b.recurrence === "weekdays"
          ? "Weekdays (individual instance)"
          : "One-time",
        "open",
      );
      if (b.contact) this.setRideContact(rid, u.id, b.contact);
      this.audit(u, "ride.created", rid);
      return { id: rid };
    });
  }
  rideAction(u: Row, rid: string, b: Row) {
    this.resident(u);
    this.eligible(u, "carpool");
    return this.tx(() => {
      const r =
        this.one("SELECT * FROM rides WHERE id=?", rid) ||
        fail("Ride unavailable.", 404);
      if (r.status !== "open" || r.departure <= now())
        fail("Ride no longer open.", 409);
      const driver = this.one(
        "SELECT * FROM users WHERE id=? AND deleted=0",
        r.user_id,
      );
      if (!driver) fail("Ride unavailable.", 404);
      this.eligible(driver, "carpool");
      if (!this.ridePairAllowed(u.id, r.user_id))
        fail("Connection unavailable.", 403);
      if (b.action === "block") {
        const target = text(b.targetId, 100);
        if (
          target === u.id ||
          !(
            target === r.user_id ||
            (r.user_id === u.id &&
              this.one(
                "SELECT 1 FROM ride_requests WHERE ride_id=? AND user_id=?",
                rid,
                target,
              ))
          )
        )
          fail("Choose a participant on this journey.", 403);
        this.run(
          "INSERT OR IGNORE INTO blocks VALUES(?,?,?)",
          u.id,
          target,
          now(),
        );
        for (const q of this.all(
          "SELECT q.id,q.ride_id,q.status FROM ride_requests q JOIN rides r ON r.id=q.ride_id WHERE ((r.user_id=? AND q.user_id=?) OR (r.user_id=? AND q.user_id=?)) AND q.status IN ('pending','accepted')",
          u.id,
          target,
          target,
          u.id,
        )) {
          if (q.status === "accepted")
            this.run("UPDATE rides SET seats=seats+1 WHERE id=?", q.ride_id);
          this.run(
            "UPDATE ride_requests SET status='cancelled' WHERE id=?",
            q.id,
          );
        }
        this.audit(u, "ride.resident_blocked", rid);
        return { ok: true };
      }
      if (b.action === "report") {
        this.run(
          "INSERT INTO reports(id,user_id,kind,target_id,reason) VALUES(?,?,?,?,?)",
          id(),
          u.id,
          "ride",
          rid,
          text(b.reason, 500),
        );
        this.audit(u, "ride.reported", rid);
        return { ok: true };
      }
      if (b.action === "share_contact") {
        if (
          r.user_id !== u.id &&
          !this.one(
            "SELECT 1 FROM ride_requests WHERE ride_id=? AND user_id=? AND status='accepted'",
            rid,
            u.id,
          )
        )
          fail("Accept a connection before sharing contact details.", 403);
        this.setRideContact(rid, u.id, b.contact);
        this.audit(u, "ride.contact_consent_changed", rid);
        return { ok: true };
      }
      if (b.action === "withdraw") {
        const q =
          this.one(
            "SELECT * FROM ride_requests WHERE ride_id=? AND user_id=? AND status IN ('pending','accepted')",
            rid,
            u.id,
          ) || fail("No active connection.", 409);
        if (q.status === "accepted")
          this.run("UPDATE rides SET seats=seats+1 WHERE id=?", rid);
        this.run(
          "UPDATE ride_requests SET status='cancelled' WHERE id=?",
          q.id,
        );
        this.run(
          "DELETE FROM ride_contacts WHERE ride_id=? AND user_id=?",
          rid,
          u.id,
        );
        this.audit(u, "ride.withdrawn", rid);
        return { ok: true };
      }
      if (b.action === "cancel") {
        if (r.user_id !== u.id) fail("Only the driver can cancel.", 403);
        this.run("UPDATE rides SET status='cancelled' WHERE id=?", rid);
        this.run(
          "UPDATE ride_requests SET status='cancelled' WHERE ride_id=?",
          rid,
        );
        this.audit(u, "ride.cancelled", rid);
        return { ok: true };
      }
      if (b.action === "request") {
        if (r.user_id === u.id) fail("You cannot request your own ride.");
        this.eligible(
          this.one("SELECT * FROM users WHERE id=?", r.user_id)!,
          "carpool",
        );
        if (r.seats < 1) fail("No seats available.", 409);
        if (
          this.one(
            "SELECT id FROM ride_requests WHERE ride_id=? AND user_id=?",
            rid,
            u.id,
          )
        )
          fail("You already requested this ride.", 409);
        this.run(
          "INSERT INTO ride_requests VALUES(?,?,?,?)",
          id(),
          rid,
          u.id,
          "pending",
        );
        return { ok: true };
      }
      if (r.user_id !== u.id) fail("Only the driver can decide requests.", 403);
      const q =
        this.one(
          "SELECT * FROM ride_requests WHERE id=? AND ride_id=? AND status='pending'",
          b.requestId,
          rid,
        ) || fail("Request no longer pending.", 409);
      if (!this.ridePairAllowed(u.id, q.user_id))
        fail("Connection unavailable.", 403);
      this.eligible(
        this.one("SELECT * FROM users WHERE id=? AND deleted=0", q.user_id) ||
          fail("Resident unavailable.", 404),
        "carpool",
      );
      if (b.action === "accept") {
        if (r.seats < 1) fail("No seats available.", 409);
        this.run("UPDATE rides SET seats=seats-1 WHERE id=?", rid);
        this.run("UPDATE ride_requests SET status='accepted' WHERE id=?", q.id);
      } else if (b.action === "reject")
        this.run("UPDATE ride_requests SET status='rejected' WHERE id=?", q.id);
      else fail("Unsupported ride action.");
      this.audit(u, `ride.${b.action}`, rid);
      return { ok: true };
    });
  }
  events(u: Row) {
    const m = this.membership(u);
    return this.all(
      `SELECT e.*,(SELECT count(*) FROM rsvps WHERE event_id=e.id) attending, EXISTS(SELECT 1 FROM rsvps WHERE event_id=e.id AND user_id=?) joined FROM events e WHERE (e.project_id=? OR (e.project_id IS NULL AND ?=1)) AND e.starts>? ORDER BY e.starts`,
      u.id,
      m.project_id,
      this.prefs(u).network,
      now(),
    );
  }
  rsvp(u: Row, eid: string, b: Row) {
    return this.tx(() => {
      const e =
        this.events(u).find((e) => e.id === eid) ||
        fail("Event unavailable in your community.", 403);
      if (b.cancel)
        this.run("DELETE FROM rsvps WHERE event_id=? AND user_id=?", eid, u.id);
      else {
        if (e.joined) return { ok: true };
        if (e.attending >= e.capacity) fail("Event is full.", 409);
        this.run(
          "INSERT INTO rsvps VALUES(?,?,?)",
          eid,
          u.id,
          b.volunteer ? 1 : 0,
        );
      }
      return { ok: true };
    });
  }
  operations(u: Row) {
    this.role(u, ["warehouse", "platform", "association", "delivery"]);
    if (u.role === "delivery")
      return {
        orders: this.orders(u),
        riders: this.all("SELECT * FROM riders WHERE user_id=?", u.id),
      };
    if (u.role === "association")
      return {
        memberships: this.all(
          "SELECT m.*,u.name,f.label,p.name project FROM memberships m JOIN users u ON u.id=m.user_id JOIN flats f ON f.id=m.flat_id JOIN projects p ON p.id=f.project_id WHERE f.project_id=?",
          u.project_id,
        ),
        tickets: this.all(
          "SELECT * FROM tickets WHERE project_id=?",
          u.project_id,
        ),
        reports: this.all(
          "SELECT r.* FROM reports r JOIN posts p ON p.id=r.target_id WHERE p.project_id=?",
          u.project_id,
        ),
      };
    const sums = this.one(
      "SELECT coalesce(sum(CASE WHEN status='delivered' THEN subtotal ELSE 0 END),0) sales,coalesce(sum(CASE WHEN status='delivered' THEN fee ELSE 0 END),0) delivery_fees,coalesce(sum(CASE WHEN status='delivered' THEN cost ELSE 0 END),0) cogs,sum(CASE WHEN status='delivered' THEN 1 ELSE 0 END) delivered FROM orders",
    )!;
    return {
      orders: this.orders(u),
      riders: this.all("SELECT * FROM riders"),
      products: this.all("SELECT * FROM products"),
      batches: this.all(
        "SELECT b.*,p.name FROM batches b JOIN products p ON p.id=b.product_id ORDER BY b.expiry",
      ),
      movements: this.all(
        "SELECT * FROM stock_movements ORDER BY at DESC LIMIT 30",
      ),
      metrics: {
        ...sums,
        pickingCost: (sums.delivered || 0) * 1000,
        deliveryCost: (sums.delivered || 0) * 2500,
        paymentFees: 0,
        contribution:
          sums.sales +
          sums.delivery_fees -
          sums.cogs -
          (sums.delivered || 0) * 3500,
        assumption:
          "Demo estimate: ₹10 picking + ₹25 delivery per delivered order; COD fees ₹0. Excludes salaries, rent, taxes, and unrecorded wastage.",
      },
      audit: this.all(
        "SELECT action,target,at FROM audit ORDER BY at DESC LIMIT 20",
      ),
    };
  }
  membershipAction(u: Row, mid: string, b: Row) {
    const m =
      this.one(
        "SELECT m.*,f.project_id FROM memberships m JOIN flats f ON f.id=m.flat_id WHERE m.id=?",
        mid,
      ) || fail("Membership not found.", 404);
    const can =
      (u.role === "association" && u.project_id === m.project_id) ||
      (m.kind !== "owner" &&
        !!this.one(
          "SELECT * FROM ownership WHERE user_id=? AND flat_id=?",
          u.id,
          m.flat_id,
        ));
    if (!can) fail("You cannot manage this flat.", 403);
    if (!["approved", "rejected", "expired"].includes(b.status))
      fail("Invalid membership state.");
    return this.tx(() => {
      this.run(
        "UPDATE memberships SET status=?,move_out=? WHERE id=?",
        b.status,
        b.status === "expired" ? now() : null,
        mid,
      );
      if (b.status === "expired") {
        this.run(
          "UPDATE rides SET status='cancelled' WHERE user_id=? AND status='open'",
          m.user_id,
        );
        for (const q of this.all(
          "SELECT * FROM ride_requests WHERE user_id=? AND status='accepted'",
          m.user_id,
        ))
          this.run("UPDATE rides SET seats=seats+1 WHERE id=?", q.ride_id);
        this.run(
          "UPDATE ride_requests SET status='cancelled' WHERE user_id=? AND status IN ('pending','accepted')",
          m.user_id,
        );
      }
      this.audit(u, `membership.${b.status}`, mid);
      return { ok: true };
    });
  }
  personal(u: Row, kind: string, b: Row) {
    this.role(u, ["resident"]);
    if (kind === "expenses") {
      const eid = id();
      this.run(
        "INSERT INTO expenses VALUES(?,?,?,?,?,?,?)",
        eid,
        u.id,
        text(b.description, 120),
        text(b.category, 40),
        integer(b.amount, 1, 1e9),
        b.kind === "income" ? "income" : "expense",
        /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : fail("Invalid date."),
      );
      return { id: eid };
    }
    if (kind === "loans") {
      amortize(b.principal / 100, b.rate, b.months);
      const lid = id();
      this.run(
        "INSERT INTO loans VALUES(?,?,?,?,?,?,?)",
        lid,
        u.id,
        text(b.title, 80),
        integer(b.principal, 1, 1e12),
        b.rate,
        b.months,
        integer(b.dueDay, 1, 28),
      );
      return { id: lid };
    }
    if (kind === "loan-payment") {
      const l =
        this.one(
          "SELECT * FROM loans WHERE id=? AND user_id=?",
          b.loanId,
          u.id,
        ) || fail("Loan unavailable.", 404);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month)) fail("Invalid month.");
      this.run(
        "INSERT INTO loan_payments VALUES(?,?,?,?,?,?) ON CONFLICT(loan_id,month) DO UPDATE SET amount=excluded.amount,status=excluded.status",
        id(),
        l.id,
        u.id,
        b.month,
        integer(b.amount, 1, 1e9),
        "user_marked_paid",
      );
      return { ok: true };
    }
    if (kind === "tickets") {
      const m = this.resident(u);
      const tid = id();
      this.run(
        "INSERT INTO tickets VALUES(?,?,?,?,?,?,?)",
        tid,
        u.id,
        m.project_id,
        text(b.category, 40),
        text(b.description, 1000),
        "open",
        now(),
      );
      return { id: tid };
    }
    fail("Unsupported personal action.", 404);
  }
  upload(u: Row, b: Row) {
    this.role(u, ["resident"]);
    if (!u.stepup_until || u.stepup_until < now())
      fail("Confirm demo vault access first.", 403);
    const name = text(b.name, 120),
      folder = text(b.folder, 50),
      mime = text(b.mime, 100);
    if (
      !["application/pdf", "image/jpeg", "image/png", "text/plain"].includes(
        mime,
      )
    )
      fail("Use PDF, JPG, or PNG. Sample text is available only in demo.");
    const data = Buffer.from(text(b.data, 7_000_000), "base64");
    if (data.length > 5 * 1024 * 1024 || data.length === 0)
      fail("File size must be between 1 byte and 5 MB.");
    const sample =
      mime === "text/plain" &&
      data.toString() ===
        "MDP Living synthetic sample document. No personal information.";
    const did = id();
    this.run(
      "INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?)",
      did,
      u.id,
      name,
      folder,
      mime,
      encrypt(data),
      sample ? "clean" : "quarantined",
      null,
      now(),
    );
    if (!sample)
      this.run(
        "INSERT INTO jobs VALUES(?,?,?,?,?)",
        id(),
        "malware_scan",
        JSON.stringify({ documentId: did }),
        now(),
        "blocked_provider",
      );
    this.audit(u, "vault.upload", did);
    return { id: did, status: sample ? "clean" : "quarantined" };
  }
  document(u: Row, did: string, shareId?: string) {
    if (!u.stepup_until || u.stepup_until < now())
      fail("Confirm demo vault access first.", 403);
    let d = this.one(
      "SELECT * FROM documents WHERE id=? AND user_id=?",
      did,
      u.id,
    );
    if (!d && shareId) {
      const s = this.one(
        "SELECT * FROM shares WHERE id=? AND document_id=? AND recipient_id=? AND revoked=0 AND expires>?",
        shareId,
        did,
        u.id,
        now(),
      );
      if (s) d = this.one("SELECT * FROM documents WHERE id=?", did);
    }
    if (!d) fail("Document unavailable.", 404);
    if (d.status !== "clean")
      fail(
        "This document is quarantined. A malware scanner must clear it before access.",
        423,
      );
    this.audit(u, "vault.download", did);
    return { name: d.name, mime: d.mime, data: decrypt(d.encrypted) };
  }
  share(u: Row, did: string, b: Row) {
    if (!u.stepup_until || u.stepup_until < now())
      fail("Confirm demo vault access first.", 403);
    if (
      !this.one(
        "SELECT id FROM documents WHERE id=? AND user_id=? AND status='clean'",
        did,
        u.id,
      )
    )
      fail("Only your clean documents can be shared.", 403);
    const recipient = text(b.recipientId);
    if (
      !this.one(
        "SELECT id FROM users WHERE id=? AND role='resident' AND deleted=0",
        recipient,
      )
    )
      fail("Unknown demo recipient.");
    const expires = future(b.expires);
    if (new Date(expires).getTime() > Date.now() + 7 * 86400000)
      fail("Share expiry cannot exceed seven days.");
    const sid = id();
    this.run(
      "INSERT INTO shares VALUES(?,?,?,?,?,0)",
      sid,
      did,
      u.id,
      recipient,
      expires,
    );
    this.audit(u, "vault.share", did);
    return { id: sid };
  }
  preferences(u: Row, b: Row) {
    this.run(
      "INSERT INTO preferences VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET language=excluded.language,notifications=excluded.notifications,network=excluded.network",
      u.id,
      b.language === "te" ? "te" : "en",
      b.notifications ? 1 : 0,
      b.network ? 1 : 0,
    );
    return { ok: true };
  }
}
export { text, integer, fail };
