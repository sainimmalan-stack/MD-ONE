import { Service, fail, text, integer } from "./service.ts";
import { Social } from "./social.ts";
import { id, now, type Row } from "./db.ts";
export const exchangeCategories = [
  "Furniture",
  "Appliances",
  "Electronics",
  "Books",
  "Children’s items",
  "Cycles",
  "Fitness",
  "Home and garden",
  "Other",
];
export function validatedImage(v: unknown) {
  const value = text(v, 550000);
  if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value))
    fail("Choose a PNG or JPEG.");
  const b = Buffer.from(value.split(",")[1], "base64");
  if (
    b.length > 400000 ||
    !(
      b.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
      b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
  )
    fail("Invalid image or larger than 400 KB.");
  return value;
}
export class Exchange {
  social: Social;
  constructor(public s: Service) {
    this.social = new Social(s);
  }
  active(uid: string): Row[] {
    return this.s.all(
      "SELECT m.*,f.project_id FROM memberships m JOIN flats f ON f.id=m.flat_id JOIN users u ON u.id=m.user_id WHERE m.user_id=? AND u.deleted=0 AND m.status='approved' AND m.move_in<=? AND (m.move_out IS NULL OR m.move_out>?)",
      uid,
      now(),
      now(),
    );
  }
  member(u: Row, pid?: string) {
    const memberships = this.active(u.id);
    if (
      !memberships.length ||
      (pid && !memberships.some((r) => r.project_id === pid))
    )
      fail("An active project membership is required.", 403);
    return memberships;
  }
  listing(u: Row, lid: string): Row {
    this.member(u);
    const l = this.s.one("SELECT * FROM exchange_listings WHERE id=?", lid);
    if (
      !l ||
      !this.active(l.user_id).some((r) => r.project_id === l.project_id) ||
      this.social.blocked(u.id, l.user_id) ||
      (l.user_id !== u.id &&
        (["draft", "withdrawn"].includes(l.status) ||
          (l.audience === "project" &&
            !this.active(u.id).some((r) => r.project_id === l.project_id))))
    )
      fail("Listing unavailable.", 404);
    return l;
  }
  safe(l: Row): Row {
    return {
      ...l,
      photos: Array.isArray(l.photos) ? l.photos : JSON.parse(l.photos),
      status:
        l.expires < now() && ["active", "reserved"].includes(l.status)
          ? "expired"
          : l.status,
      seller: this.s.one("SELECT id,name FROM users WHERE id=?", l.user_id),
    };
  }
  browse(u: Row, q: Row = {}) {
    this.member(u);
    const offset = integer(Number(q.offset || 0), 0, 100000),
      limit = 20;
    // Scope before pagination; private drafts do not consume another person's page.
    const pids = this.active(u.id).map((r) => r.project_id);
    const params: any[] = [u.id, ...pids, u.id];
    let sql = `SELECT l.* FROM exchange_listings l WHERE (l.user_id=? OR (l.status NOT IN ('draft','withdrawn') AND (l.audience='network' OR l.project_id IN (${pids.map(() => "?").join(",")})))) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=l.user_id) OR (b.target_id=? AND b.user_id=l.user_id)) AND EXISTS(SELECT 1 FROM memberships m JOIN flats f ON f.id=m.flat_id JOIN users u ON u.id=m.user_id WHERE m.user_id=l.user_id AND f.project_id=l.project_id AND m.status='approved' AND m.move_in<=? AND (m.move_out IS NULL OR m.move_out>?) AND u.deleted=0)`;
    params.push(u.id, now(), now());
    for (const [key, col] of [
      ["project", "project_id"],
      ["category", "category"],
      ["type", "type"],
      ["condition", "condition"],
    ] as const)
      if (q[key]) {
        sql += ` AND l.${col}=?`;
        params.push(String(q[key]));
      }
    if (q.search) {
      sql += " AND (l.title LIKE ? OR l.description LIKE ?)";
      params.push(
        `%${String(q.search).slice(0, 100)}%`,
        `%${String(q.search).slice(0, 100)}%`,
      );
    }
    if (q.maxPrice) {
      sql += " AND l.price<=?";
      params.push(integer(Number(q.maxPrice), 0, 100000000));
    }
    if (q.saved === "1") {
      sql +=
        " AND EXISTS(SELECT 1 FROM exchange_saves s WHERE s.listing_id=l.id AND s.user_id=?)";
      params.push(u.id);
    }
    sql += " ORDER BY l.created DESC,l.id LIMIT ? OFFSET ?";
    params.push(limit + 1, offset);
    const rows = this.s.all(sql, ...params);
    return {
      listings: rows.slice(0, limit).map((l) => ({
        ...this.safe(l),
        saved: !!this.s.one(
          "SELECT 1 FROM exchange_saves WHERE user_id=? AND listing_id=?",
          u.id,
          l.id,
        ),
      })),
      nextOffset: rows.length > limit ? offset + limit : null,
      categories: exchangeCategories,
      projects: this.active(u.id),
    };
  }
  saveListing(u: Row, b: Row, lid?: string): Row {
    this.member(u, text(b.projectId));
    const old = lid ? this.listing(u, lid) : null;
    if (old && old.user_id !== u.id) fail("Only the seller can edit.", 403);
    const key = text(b.key, 100);
    const prior = this.s.one(
      "SELECT * FROM exchange_listings WHERE user_id=? AND request_key=?",
      u.id,
      key,
    );
    if (!lid && prior) {
      if (
        prior.title !== b.title?.trim() ||
        prior.description !== b.description?.trim() ||
        prior.project_id !== b.projectId ||
        prior.type !== b.type ||
        prior.audience !== b.audience ||
        prior.price !== (b.type === "free" ? 0 : b.price) ||
        prior.category !== b.category ||
        prior.condition !== b.condition ||
        prior.photos !== JSON.stringify(b.photos) ||
        prior.status !== b.status
      )
        fail("Listing retry differs from the original.", 409);
      return this.safe(prior);
    }
    if (
      !exchangeCategories.includes(b.category) ||
      !["sale", "free", "wanted", "exchange"].includes(b.type) ||
      !["New", "Like new", "Good", "Fair"].includes(b.condition) ||
      !["project", "network"].includes(b.audience) ||
      !["draft", "active", "reserved", "sold", "withdrawn", "expired"].includes(
        b.status,
      )
    )
      fail("Choose valid listing options.");
    if (!Array.isArray(b.photos) || b.photos.length > 5)
      fail("Choose up to five photos.");
    const photos = b.photos.map(validatedImage),
      price = b.type === "free" ? 0 : integer(b.price, 0, 100000000);
    const lid2 = old?.id || id();
    if (old && old.project_id !== b.projectId)
      fail("A listing cannot change projects.");
    const vals = [
      text(b.title, 100),
      text(b.description, 2500),
      b.category,
      b.condition,
      b.type,
      price,
      b.audience,
      b.status,
      JSON.stringify(photos),
      String(b.exchangePreference || "").slice(0, 300),
    ];
    if (old)
      this.s.run(
        "UPDATE exchange_listings SET title=?,description=?,category=?,condition=?,type=?,price=?,audience=?,status=?,photos=?,exchange_preference=?,expires=? WHERE id=?",
        ...vals,
        old.expires < now() && b.status === "active"
          ? new Date(Date.now() + 30 * 86400000).toISOString()
          : old.expires,
        lid2,
      );
    else
      this.s.run(
        "INSERT INTO exchange_listings VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        lid2,
        b.projectId,
        u.id,
        ...vals,
        now(),
        new Date(Date.now() + 30 * 86400000).toISOString(),
        key,
      );
    this.s.audit(u, "exchange.listing", lid2);
    return this.safe(this.listing(u, lid2));
  }
  action(u: Row, lid: string, b: Row) {
    const l = this.listing(u, lid);
    if (b.action === "save") {
      this.s.run("INSERT OR IGNORE INTO exchange_saves VALUES(?,?)", u.id, lid);
      return { ok: true };
    }
    if (b.action === "unsave") {
      this.s.run(
        "DELETE FROM exchange_saves WHERE user_id=? AND listing_id=?",
        u.id,
        lid,
      );
      return { ok: true };
    }
    if (b.action === "enquire") {
      if (l.user_id === u.id || this.safe(l).status !== "active")
        fail("This item is not open for enquiries.");
      this.s.run(
        "INSERT OR IGNORE INTO exchange_conversations VALUES(?,?,?,?)",
        id(),
        lid,
        u.id,
        now(),
      );
      return this.s.one(
        "SELECT * FROM exchange_conversations WHERE listing_id=? AND buyer_id=?",
        lid,
        u.id,
      );
    }
    fail("Unknown listing action.");
  }
  conversation(u: Row, cid: string): Row {
    const c = this.s.one(
      "SELECT c.*,l.user_id seller_id FROM exchange_conversations c JOIN exchange_listings l ON l.id=c.listing_id WHERE c.id=?",
      cid,
    );
    if (!c || ![c.buyer_id, c.seller_id].includes(u.id))
      fail("Conversation unavailable.", 404);
    this.listing(u, c.listing_id);
    this.member({ id: c.buyer_id });
    this.member({ id: c.seller_id });
    if (this.social.blocked(c.buyer_id, c.seller_id))
      fail("Conversation unavailable.", 403);
    return c;
  }
  inbox(u: Row) {
    this.member(u);
    return this.s
      .all(
        "SELECT c.*,l.title,l.user_id seller_id FROM exchange_conversations c JOIN exchange_listings l ON l.id=c.listing_id WHERE c.buyer_id=? OR l.user_id=? ORDER BY c.created DESC",
        u.id,
        u.id,
      )
      .filter((c) => {
        try {
          this.conversation(u, c.id);
          return true;
        } catch {
          return false;
        }
      });
  }
  messages(u: Row, cid: string) {
    this.conversation(u, cid);
    return this.s.all(
      "SELECT id,user_id,body,created FROM exchange_messages WHERE conversation_id=? ORDER BY created,id LIMIT 200",
      cid,
    );
  }
  message(u: Row, cid: string, b: Row) {
    this.conversation(u, cid);
    const key = text(b.key, 100);
    const old = this.s.one(
      "SELECT * FROM exchange_messages WHERE user_id=? AND request_key=?",
      u.id,
      key,
    );
    if (old) {
      if (old.conversation_id !== cid || old.body !== b.body)
        fail("Retry key was used for another message.", 409);
      return { ok: true };
    }
    this.s.run(
      "INSERT INTO exchange_messages VALUES(?,?,?,?,?,?)",
      id(),
      cid,
      u.id,
      text(b.body, 2000),
      now(),
      key,
    );
    return { ok: true };
  }
  report(u: Row, b: Row) {
    if (b.kind === "conversation") this.conversation(u, text(b.targetId));
    else if (b.kind === "listing") this.listing(u, text(b.targetId));
    else fail("Invalid report.");
    this.s.run(
      "INSERT INTO exchange_reports VALUES(?,?,?,?,?,?,?)",
      id(),
      u.id,
      b.kind,
      b.targetId,
      text(b.reason, 1000),
      "open",
      now(),
    );
    return { ok: true };
  }
  moderate(u: Row, b?: Row) {
    this.s.role(u, ["platform"]);
    if (b) {
      const r = this.s.one(
        "SELECT * FROM exchange_reports WHERE id=?",
        text(b.id),
      );
      if (!r) fail("Report not found.", 404);
      if (b.action === "withdraw" && r.kind === "listing")
        this.s.run(
          "UPDATE exchange_listings SET status='withdrawn' WHERE id=?",
          r.target_id,
        );
      else if (b.action !== "dismiss") fail("Invalid action.");
      this.s.run(
        "UPDATE exchange_reports SET status='resolved' WHERE id=?",
        r.id,
      );
      this.s.audit(u, "exchange.moderated", r.target_id);
    }
    return this.s.all(
      "SELECT * FROM exchange_reports WHERE status='open' ORDER BY created",
    );
  }
}
