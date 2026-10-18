import { Service, fail, text, integer } from "./service.ts";
import { Social } from "./social.ts";
import { validatedImage } from "./exchange.ts";
import { id, now, hash, type Row } from "./db.ts";
export class Homes {
  constructor(public s: Service) {}
  eligible(uid: string) {
    if (
      !this.s.one(
        "SELECT id FROM users WHERE id=? AND deleted=0 AND role='resident'",
        uid,
      )
    )
      return false;
    return (
      !!this.s.one("SELECT 1 FROM ownership WHERE user_id=?", uid) ||
      !!this.s.one(
        "SELECT 1 FROM memberships WHERE user_id=? AND status='approved' AND move_in<=? AND (move_out IS NULL OR move_out>?)",
        uid,
        now(),
        now(),
      )
    );
  }
  member(u: Row) {
    if (!this.eligible(u.id))
      fail(
        "An active MDP residence or verified flat ownership is required.",
        403,
      );
  }
  owns(uid: string, flat: string) {
    return !!this.s.one(
      "SELECT 1 FROM ownership WHERE user_id=? AND flat_id=?",
      uid,
      flat,
    );
  }
  options(u: Row) {
    this.member(u);
    return this.s.all(
      "SELECT f.id,f.label,p.id project_id,p.name project,p.status project_status FROM ownership o JOIN flats f ON f.id=o.flat_id JOIN projects p ON p.id=f.project_id WHERE o.user_id=? ORDER BY p.name,f.label",
      u.id,
    );
  }
  raw(u: Row, lid: string) {
    this.member(u);
    const l = this.s.one(
      "SELECT l.*,p.name project,p.id project_id,p.status project_status,u.name owner FROM home_listings l JOIN flats f ON f.id=l.flat_id JOIN projects p ON p.id=f.project_id JOIN users u ON u.id=l.owner_id WHERE l.id=?",
      lid,
    );
    if (
      !l ||
      !this.eligible(l.owner_id) ||
      !this.owns(l.owner_id, l.flat_id) ||
      new Social(this.s).blocked(u.id, l.owner_id) ||
      (l.status === "withdrawn" && l.owner_id !== u.id)
    )
      fail("Home listing unavailable.", 404);
    return l;
  }
  open(l: Row) {
    return l.status === "available" && l.expires > now();
  }
  public(l: Row, u: Row): Row {
    return {
      id: l.id,
      project_id: l.project_id,
      project: l.project,
      project_status: l.project_status,
      owner_id: l.owner_id,
      owner: l.owner,
      purpose: l.purpose,
      title: l.title,
      description: l.description,
      bhk: l.bhk,
      area: l.area,
      floor: l.floor,
      furnishing: l.furnishing,
      parking: l.parking,
      available: l.available,
      price: l.price,
      deposit: l.deposit,
      photos: JSON.parse(l.photos),
      status:
        l.status === "available" && l.expires <= now() ? "expired" : l.status,
      expires: l.expires,
      own: l.owner_id === u.id,
    };
  }
  browse(u: Row, q: Row = {}) {
    this.member(u);
    const offset = integer(Number(q.offset || 0), 0, 100000),
      params: any[] = [now()];
    let sql =
      "SELECT l.*,p.name project,p.id project_id,p.status project_status,u.name owner FROM home_listings l JOIN flats f ON f.id=l.flat_id JOIN projects p ON p.id=f.project_id JOIN users u ON u.id=l.owner_id WHERE l.status='available' AND l.expires>? AND u.deleted=0 AND EXISTS(SELECT 1 FROM ownership o WHERE o.user_id=l.owner_id AND o.flat_id=l.flat_id) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=l.owner_id) OR (b.target_id=? AND b.user_id=l.owner_id))";
    params.push(u.id, u.id);
    if (q.purpose) {
      if (!["rent", "sale"].includes(q.purpose)) fail("Choose rent or sale.");
      sql += " AND l.purpose=?";
      params.push(q.purpose);
    }
    if (q.project) {
      sql += " AND p.id=?";
      params.push(text(q.project, 100));
    }
    if (q.search) {
      sql += " AND (l.title LIKE ? OR p.name LIKE ?)";
      params.push(
        "%" + text(q.search, 100) + "%",
        "%" + text(q.search, 100) + "%",
      );
    }
    if (q.bhk) {
      sql += " AND l.bhk=?";
      params.push(integer(Number(q.bhk), 1, 6));
    }
    const listings = this.s.all(
      sql + " ORDER BY l.created DESC,l.id LIMIT 25 OFFSET ?",
      ...params,
      offset,
    );
    const mine = this.s
      .all(
        "SELECT id FROM home_listings WHERE owner_id=? ORDER BY created DESC LIMIT 100",
        u.id,
      )
      .flatMap((row) => {
        try {
          return [this.public(this.raw(u, row.id), u)];
        } catch {
          return [];
        }
      });
    return {
      listings: listings.slice(0, 24).map((l) => this.public(l, u)),
      next: listings.length > 24 ? offset + 24 : null,
      mine,
      ownedFlats: this.options(u),
    };
  }
  create(u: Row, b: Row) {
    this.member(u);
    const flat = text(b.flatId, 100);
    if (!this.owns(u.id, flat))
      fail("Only the verified owner can list this flat.", 403);
    if (!["rent", "sale"].includes(b.purpose)) fail("Choose rent or sale.");
    if (!["Unfurnished", "Semi-furnished", "Furnished"].includes(b.furnishing))
      fail("Choose furnishing.");
    const available = text(b.available, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(available) ||
      !Number.isFinite(new Date(available + "T00:00:00Z").getTime()) ||
      new Date(available + "T00:00:00Z").toISOString().slice(0, 10) !==
        available
    )
      fail("Choose a valid availability date.");
    if (!Array.isArray(b.photos) || b.photos.length > 8)
      fail("Use up to eight photos.");
    const key = hash(text(b.key, 100)),
      payload = {
        flat,
        purpose: b.purpose,
        title: text(b.title, 100),
        description: text(b.description, 1500),
        bhk: integer(b.bhk, 1, 6),
        area: integer(b.area, 100, 20000),
        floor: integer(b.floor, 0, 100),
        furnishing: b.furnishing,
        parking: integer(b.parking, 0, 5),
        available,
        price: integer(b.price, 100, 100000000000),
        deposit: b.purpose === "rent" ? integer(b.deposit, 0, 100000000) : 0,
        photos: b.photos.map(validatedImage),
      };
    const digest = hash(JSON.stringify(payload));
    return this.s.tx(() => {
      if (!this.owns(u.id, flat))
        fail("Ownership is no longer available.", 403);
      const previous = this.s.one(
        "SELECT id,request_key FROM home_listings WHERE owner_id=? AND request_key LIKE ?",
        u.id,
        key + ":%",
      );
      if (previous) {
        if (previous.request_key !== key + ":" + digest)
          fail("This request key was already used for different details.", 409);
        return { id: previous.id };
      }
      // A transferred flat must not remain locked by its previous owner's offer.
      for (const old of this.s.all(
        "SELECT id,owner_id FROM home_listings WHERE flat_id=? AND purpose=? AND status='available'",
        flat,
        b.purpose,
      )) {
        if (!this.eligible(old.owner_id) || !this.owns(old.owner_id, flat)) {
          this.s.run(
            "UPDATE home_listings SET status='withdrawn' WHERE id=?",
            old.id,
          );
          this.s.run("DELETE FROM home_contacts WHERE listing_id=?", old.id);
          this.s.audit(u, "home.stale_ownership_offer_withdrawn", old.id);
        }
      }
      if (
        this.s.one(
          "SELECT 1 FROM home_listings WHERE flat_id=? AND purpose=? AND status='available'",
          flat,
          b.purpose,
        )
      )
        fail(
          "Update or withdraw the existing listing for this flat first.",
          409,
        );
      const lid = id();
      this.s.run(
        "INSERT INTO home_listings VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        lid,
        u.id,
        flat,
        b.purpose,
        payload.title,
        payload.description,
        payload.bhk,
        payload.area,
        payload.floor,
        payload.furnishing,
        payload.parking,
        available,
        payload.price,
        payload.deposit,
        JSON.stringify(payload.photos),
        "available",
        now(),
        new Date(Date.now() + 30 * 86400000).toISOString(),
        key + ":" + digest,
      );
      this.s.audit(u, "home.created", lid);
      return { id: lid };
    });
  }
  detail(u: Row, lid: string): Row {
    const l = this.raw(u, lid),
      own = l.owner_id === u.id;
    const requests = this.s
      .all(
        "SELECT i.id,i.user_id,i.status,u.name FROM home_interests i JOIN users u ON u.id=i.user_id WHERE i.listing_id=?",
        lid,
      )
      .filter(
        (q) =>
          (own || q.user_id === u.id) &&
          this.eligible(q.user_id) &&
          !new Social(this.s).blocked(q.user_id, l.owner_id),
      );
    const contact = (uid: string) =>
      this.s.one(
        "SELECT contact FROM home_contacts WHERE listing_id=? AND user_id=?",
        lid,
        uid,
      )?.contact || null;
    return {
      ...this.public(l, u),
      ownContact: contact(u.id),
      contact:
        !own && this.open(l) && requests.some((q) => q.status === "accepted")
          ? contact(l.owner_id)
          : null,
      interests: requests.map((q) => ({
        ...q,
        contact:
          own && this.open(l) && q.status === "accepted"
            ? contact(q.user_id)
            : null,
      })),
    };
  }
  action(u: Row, lid: string, b: Row) {
    return this.s.tx(() => {
      const l = this.raw(u, lid),
        own = l.owner_id === u.id;
      if (b.action === "status" || b.action === "renew") {
        if (!own) fail("Only the owner can update this home.", 403);
        if (b.action === "renew") {
          if (l.status !== "available")
            fail("Only an available listing can be renewed.", 409);
          this.s.run(
            "UPDATE home_listings SET expires=? WHERE id=?",
            new Date(Date.now() + 30 * 86400000).toISOString(),
            lid,
          );
        } else {
          if (
            !["withdrawn", l.purpose === "rent" ? "rented" : "sold"].includes(
              b.status,
            )
          )
            fail("Choose a valid listing status.");
          this.s.run(
            "UPDATE home_listings SET status=? WHERE id=?",
            b.status,
            lid,
          );
          this.s.run("DELETE FROM home_contacts WHERE listing_id=?", lid);
        }
        this.s.audit(u, "home." + b.action, lid);
        return { ok: true };
      }
      if (b.action === "withdraw") {
        const q =
          this.s.one(
            "SELECT id FROM home_interests WHERE listing_id=? AND user_id=? AND status IN ('pending','accepted')",
            lid,
            u.id,
          ) || fail("No active interest request.", 409);
        this.s.run(
          "UPDATE home_interests SET status='withdrawn' WHERE id=?",
          q.id,
        );
        this.s.run(
          "DELETE FROM home_contacts WHERE listing_id=? AND user_id=?",
          lid,
          u.id,
        );
        return { ok: true };
      }
      if (b.action === "contact" && b.contact === "") {
        this.s.run(
          "DELETE FROM home_contacts WHERE listing_id=? AND user_id=?",
          lid,
          u.id,
        );
        this.s.audit(u, "home.contact_consent_changed", lid);
        return { ok: true };
      }
      if (!this.open(l)) fail("This home is no longer available.", 409);
      if (b.action === "interest") {
        if (own) fail("You cannot enquire on your own home.");
        if (
          this.s.one(
            "SELECT 1 FROM home_interests WHERE listing_id=? AND user_id=?",
            lid,
            u.id,
          )
        )
          fail("You already sent interest for this home.", 409);
        this.s.run(
          "INSERT INTO home_interests VALUES(?,?,?,?,?)",
          id(),
          lid,
          u.id,
          "pending",
          now(),
        );
        return { ok: true };
      }
      if (b.action === "contact") {
        if (
          !own &&
          !this.s.one(
            "SELECT 1 FROM home_interests WHERE listing_id=? AND user_id=? AND status='accepted'",
            lid,
            u.id,
          )
        )
          fail("Wait for owner acceptance before sharing.", 403);
        if (b.contact === "")
          this.s.run(
            "DELETE FROM home_contacts WHERE listing_id=? AND user_id=?",
            lid,
            u.id,
          );
        else {
          if (b.consent !== true)
            fail("Explicit contact-sharing consent is required.");
          const phone = text(b.contact, 16);
          if (!/^\+?[0-9]{10,15}$/.test(phone))
            fail("Use a phone number with 10–15 digits.");
          this.s.run(
            "INSERT INTO home_contacts VALUES(?,?,?) ON CONFLICT(listing_id,user_id) DO UPDATE SET contact=excluded.contact",
            lid,
            u.id,
            phone,
          );
        }
        this.s.audit(u, "home.contact_consent_changed", lid);
        return { ok: true };
      }
      if (!own) fail("Only the owner can decide requests.", 403);
      const q =
        this.s.one(
          "SELECT * FROM home_interests WHERE id=? AND listing_id=? AND status='pending'",
          text(b.requestId, 100),
          lid,
        ) || fail("Interest request unavailable.", 409);
      if (
        !this.eligible(q.user_id) ||
        new Social(this.s).blocked(u.id, q.user_id)
      )
        fail("Resident unavailable.", 403);
      if (!["accept", "decline"].includes(b.action))
        fail("Unsupported action.");
      this.s.run(
        "UPDATE home_interests SET status=? WHERE id=?",
        b.action === "accept" ? "accepted" : "declined",
        q.id,
      );
      return { ok: true };
    });
  }
}
