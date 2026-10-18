import { Service, fail, text } from "./service.ts";
import { id, now, type Row } from "./db.ts";
import catalog from "./project-catalog.json" with { type: "json" };
const optText = (v: unknown, max: number) =>
  typeof v === "string" && v.length <= max
    ? v.trim()
    : fail("Text is too long.");
function image(v: unknown) {
  if (!v) return "";
  if (
    typeof v !== "string" ||
    v.length > 550000 ||
    !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(v)
  )
    fail("Use a JPEG or PNG smaller than 400 KB.");
  const buf = Buffer.from(v.split(",")[1], "base64");
  if (
    buf.length > 400000 ||
    !(
      buf.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
      buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
  )
    fail("Invalid image.");
  return v;
}
export class Social {
  constructor(public s: Service) {}
  ensure(u: Row) {
    return this.s.resident(u);
  }
  p(uid: string) {
    return (
      this.s.one("SELECT * FROM social_profiles WHERE user_id=?", uid) || {
        user_id: uid,
        bio: "",
        occupation: "",
        contact: "",
        contact_visibility: "friends",
        avatar: "",
        locked: 1,
        discoverable: 0,
        network_visible: 0,
      }
    );
  }
  blocked(a: string, b: string) {
    return !!this.s.one(
      "SELECT * FROM blocks WHERE (user_id=? AND target_id=?) OR (user_id=? AND target_id=?)",
      a,
      b,
      b,
      a,
    );
  }
  relationship(a: string, b: string) {
    if (a === b) return "self";
    if (this.blocked(a, b)) return "blocked";
    const q = this.s.one(
      "SELECT * FROM friendships WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)",
      a,
      b,
      b,
      a,
    );
    return q?.status === "accepted"
      ? "friends"
      : q?.status === "pending"
        ? q.sender_id === a
          ? "outgoing"
          : "incoming"
        : "none";
  }
  active(uid: string) {
    return this.s.one(
      "SELECT m.*,f.project_id,f.label,p.name project FROM memberships m JOIN flats f ON f.id=m.flat_id JOIN projects p ON p.id=f.project_id JOIN users u ON u.id=m.user_id WHERE m.user_id=? AND u.deleted=0 AND m.status='approved' AND m.move_in<=? AND (m.move_out IS NULL OR m.move_out>?)",
      uid,
      now(),
      now(),
    );
  }
  discover(viewer: Row, uid: string) {
    const m = this.ensure(viewer),
      p = this.p(uid),
      target = this.active(uid);
    if (!target || this.blocked(viewer.id, uid)) return false;
    return (
      viewer.id === uid ||
      this.relationship(viewer.id, uid) === "friends" ||
      (p.discoverable === 1 &&
        (m.project_id === target.project_id || p.network_visible === 1))
    );
  }
  profile(viewer: Row, uid: string): Row {
    this.ensure(viewer);
    if (!this.discover(viewer, uid))
      fail("This profile is private or unavailable.", 404);
    const p = this.p(uid),
      m = this.active(uid)!,
      u =
        this.s.one("SELECT id,name FROM users WHERE id=? AND deleted=0", uid) ||
        fail("Profile unavailable.", 404),
      relationship = this.relationship(viewer.id, uid),
      full = !p.locked || ["friends", "self"].includes(relationship);
    const contact =
      full &&
      (relationship === "self" ||
        p.contact_visibility === "community" ||
        (p.contact_visibility === "friends" && relationship === "friends"))
        ? p.contact
        : "";
    return {
      ...u,
      project: m.project,
      projectId: m.project_id,
      flat: m.label,
      kind: m.kind,
      locked: !!p.locked,
      relationship,
      avatar: full ? p.avatar : "",
      occupation: full ? p.occupation : "",
      bio: full ? p.bio : "",
      contact,
      contactVisibility:
        relationship === "self" ? p.contact_visibility : undefined,
      discoverable: relationship === "self" ? !!p.discoverable : undefined,
      networkVisible: relationship === "self" ? !!p.network_visible : undefined,
      canSeeDetails: full,
      friendCount: full
        ? this.s.one(
            "SELECT count(*) n FROM friendships WHERE (sender_id=? OR recipient_id=?) AND status='accepted'",
            uid,
            uid,
          )!.n
        : undefined,
    };
  }
  directory(viewer: Row, projectId?: string): Row[] {
    this.ensure(viewer);
    const rows = this.s.all(
      "SELECT u.id FROM users u JOIN social_profiles sp ON sp.user_id=u.id WHERE u.role='resident' AND u.deleted=0 AND sp.discoverable=1",
    );
    return rows
      .filter((r) => this.discover(viewer, r.id))
      .map((r) => this.profile(viewer, r.id))
      .filter((p) => !projectId || p.projectId === projectId);
  }
  projects(viewer: Row) {
    this.ensure(viewer);
    return catalog.map((p) => ({
      ...p,
      visibleMembers: this.directory(viewer, p.id).length,
      registeredFlats: this.s.one(
        "SELECT count(*) n FROM flats WHERE project_id=?",
        p.id,
      )!.n,
    }));
  }
  project(viewer: Row, pid: string) {
    this.ensure(viewer);
    const p =
      catalog.find((p) => p.id === pid) || fail("Project unavailable.", 404);
    const residents = this.directory(viewer, pid);
    const same = this.s.membership(viewer).project_id === pid;
    const flats = this.s
      .all("SELECT id,label FROM flats WHERE project_id=? ORDER BY label", pid)
      .map((f) => ({
        ...f,
        simulation: true,
        residents: residents.filter((r) => r.flat === f.label),
      }))
      .filter((f) => same || f.residents.length);
    return { ...p, flats, residents, numberingVerified: false };
  }
  updateProfile(viewer: Row, b: Row) {
    this.ensure(viewer);
    const contact = optText(b.contact, 100);
    if (contact && !/^[+\d\s().@a-zA-Z_\-]+$/.test(contact))
      fail("Enter a valid contact detail.");
    if (!["private", "friends", "community"].includes(b.contactVisibility))
      fail("Choose a contact visibility.");
    const avatar = image(b.avatar);
    this.s.run(
      "INSERT INTO social_profiles VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET bio=excluded.bio,occupation=excluded.occupation,contact=excluded.contact,contact_visibility=excluded.contact_visibility,avatar=excluded.avatar,locked=excluded.locked,discoverable=excluded.discoverable,network_visible=excluded.network_visible,updated=excluded.updated",
      viewer.id,
      optText(b.bio, 300),
      optText(b.occupation, 80),
      contact,
      b.contactVisibility,
      avatar,
      b.locked ? 1 : 0,
      b.discoverable ? 1 : 0,
      b.networkVisible ? 1 : 0,
      now(),
    );
    this.s.audit(viewer, "profile.updated", viewer.id);
    return this.profile(viewer, viewer.id);
  }
  connections(viewer: Row) {
    this.ensure(viewer);
    return this.s
      .all(
        "SELECT * FROM friendships WHERE (sender_id=? OR recipient_id=?) AND status IN ('pending','accepted') ORDER BY updated DESC",
        viewer.id,
        viewer.id,
      )
      .filter(
        (q) =>
          !this.blocked(
            viewer.id,
            q.sender_id === viewer.id ? q.recipient_id : q.sender_id,
          ),
      )
      .map((q) => {
        const other = q.sender_id === viewer.id ? q.recipient_id : q.sender_id;
        return {
          ...q,
          other: this.discover(viewer, other)
            ? this.profile(viewer, other)
            : {
                id: other,
                name: "Private resident",
                locked: true,
                relationship:
                  q.status === "accepted"
                    ? "friends"
                    : q.sender_id === viewer.id
                      ? "outgoing"
                      : "incoming",
              },
        };
      });
  }
  friend(viewer: Row, uid: string, action: string) {
    this.ensure(viewer);
    if (uid === viewer.id) fail("This is your own profile.");
    if (this.blocked(viewer.id, uid))
      fail("This connection is unavailable.", 403);
    return this.s.tx(() => {
      const q = this.s.one(
        "SELECT * FROM friendships WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)",
        viewer.id,
        uid,
        uid,
        viewer.id,
      );
      if (action === "request") {
        if (!this.discover(viewer, uid))
          fail("This profile is unavailable.", 404);
        if (q && ["pending", "accepted"].includes(q.status))
          fail("You already have a connection or request.", 409);
        if (q)
          this.s.run(
            "UPDATE friendships SET sender_id=?,recipient_id=?,status='pending',updated=? WHERE id=?",
            viewer.id,
            uid,
            now(),
            q.id,
          );
        else
          this.s.run(
            "INSERT INTO friendships VALUES(?,?,?,?,?,?)",
            id(),
            viewer.id,
            uid,
            "pending",
            now(),
            now(),
          );
      } else if (action === "accept" || action === "decline") {
        if (!q || q.recipient_id !== viewer.id || q.status !== "pending")
          fail("This is not your incoming request.", 403);
        if (!this.active(uid))
          fail("The sender no longer has active residence.", 403);
        this.s.run(
          "UPDATE friendships SET status=?,updated=? WHERE id=?",
          action === "accept" ? "accepted" : "declined",
          now(),
          q.id,
        );
      } else if (action === "remove" || action === "cancel") {
        if (!q || (action === "cancel" && q.sender_id !== viewer.id))
          fail("Request unavailable.", 404);
        this.s.run(
          "UPDATE friendships SET status='cancelled',updated=? WHERE id=?",
          now(),
          q.id,
        );
      } else fail("Unsupported connection action.");
      this.s.audit(viewer, `connection.${action}`, uid);
      return { ok: true };
    });
  }
  block(viewer: Row, uid: string) {
    this.ensure(viewer);
    if (uid === viewer.id) fail("You cannot block yourself.");
    this.s.tx(() => {
      this.s.run(
        "INSERT OR IGNORE INTO blocks VALUES(?,?,?)",
        viewer.id,
        uid,
        now(),
      );
      this.s.run(
        "UPDATE friendships SET status='cancelled',updated=? WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)",
        now(),
        viewer.id,
        uid,
        uid,
        viewer.id,
      );
    });
    return { ok: true };
  }
  visiblePost(viewer: Row, p: Row) {
    if (p.user_id === viewer.id) return true;
    if (p.status !== "published" || this.blocked(viewer.id, p.user_id))
      return false;
    const author = this.active(p.user_id);
    const viewerM = this.ensure(viewer);
    if (!author) {
      return (
        this.s.one("SELECT role FROM users WHERE id=?", p.user_id)?.role ===
          "association" && p.project_id === viewerM.project_id
      );
    }
    const profile = this.p(p.user_id),
      friends = this.relationship(viewer.id, p.user_id) === "friends";
    if (profile.locked && !friends) return false;
    if (p.visibility === "friends") return friends;
    if (p.visibility === "network") return !!profile.network_visible;
    return p.project_id === viewerM.project_id;
  }
  feed(viewer: Row, uid?: string): Row[] {
    this.ensure(viewer);
    return this.s
      .all(
        "SELECT p.*,u.name FROM posts p JOIN users u ON u.id=p.user_id WHERE p.status='published' AND u.deleted=0 ORDER BY p.created DESC LIMIT 200",
      )
      .filter((p) => (!uid || p.user_id === uid) && this.visiblePost(viewer, p))
      .map((p) => ({
        ...p,
        avatar: this.p(p.user_id).avatar,
        occupation: this.p(p.user_id).occupation,
        project: this.s.one(
          "SELECT name FROM projects WHERE id=?",
          p.project_id,
        )?.name,
        liked: !!this.s.one(
          "SELECT * FROM post_likes WHERE post_id=? AND user_id=?",
          p.id,
          viewer.id,
        ),
        likes: this.s.one(
          "SELECT count(*) n FROM post_likes WHERE post_id=?",
          p.id,
        )!.n,
        comments: this.s
          .all(
            "SELECT c.id,c.body,c.created,u.id user_id,u.name FROM post_comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.created",
            p.id,
          )
          .filter((c) => !this.blocked(viewer.id, c.user_id)),
      }));
  }
  createPost(viewer: Row, b: Row) {
    const m = this.ensure(viewer),
      visibility = text(b.visibility);
    if (!["project", "network", "friends"].includes(visibility))
      fail("Choose a post audience.");
    if (visibility === "network" && !this.p(viewer.id).network_visible)
      fail(
        "Enable wider MDP profile visibility before sharing to the network.",
      );
    const pid = id();
    this.s.run(
      "INSERT INTO posts(id,user_id,project_id,body,created,status,visibility,image,post_kind) VALUES(?,?,?,?,?,?,?,?,?)",
      pid,
      viewer.id,
      m.project_id,
      text(b.body, 1500),
      now(),
      "published",
      visibility,
      image(b.image),
      "update",
    );
    return { id: pid };
  }
  postAction(viewer: Row, pid: string, b: Row) {
    this.ensure(viewer);
    const p =
      this.s.one("SELECT * FROM posts WHERE id=?", pid) ||
      fail("Post unavailable.", 404);
    if (!this.visiblePost(viewer, p)) fail("Post unavailable.", 404);
    if (b.action === "like") {
      this.s.tx(() => {
        const liked = this.s.one(
          "SELECT * FROM post_likes WHERE post_id=? AND user_id=?",
          pid,
          viewer.id,
        );
        if (liked)
          this.s.run(
            "DELETE FROM post_likes WHERE post_id=? AND user_id=?",
            pid,
            viewer.id,
          );
        else this.s.run("INSERT INTO post_likes VALUES(?,?)", pid, viewer.id);
      });
    } else if (b.action === "comment")
      this.s.run(
        "INSERT INTO post_comments VALUES(?,?,?,?,?)",
        id(),
        pid,
        viewer.id,
        text(b.body, 500),
        now(),
      );
    else if (b.action === "delete") {
      if (p.user_id !== viewer.id)
        fail("Only your own post can be deleted.", 403);
      this.s.run("UPDATE posts SET status='hidden' WHERE id=?", pid);
    } else fail("Unsupported post action.");
    return { ok: true };
  }
  report(viewer: Row, b: Row) {
    this.ensure(viewer);
    const kind = text(b.kind),
      target = text(b.targetId);
    if (kind === "profile") this.profile(viewer, target);
    else if (kind === "post") {
      if (!this.feed(viewer).some((p) => p.id === target))
        fail("Post unavailable.", 404);
    } else fail("Unsupported report type.");
    this.s.run(
      "INSERT INTO social_reports VALUES(?,?,?,?,?,?,?)",
      id(),
      viewer.id,
      kind,
      target,
      text(b.reason, 500),
      "open",
      now(),
    );
    return { ok: true };
  }
  moderation(u: Row): Row[] {
    this.s.role(u, ["association", "platform"]);
    return this.s
      .all("SELECT * FROM social_reports ORDER BY created DESC")
      .map((r) => {
        const author =
          r.target_kind === "post"
            ? this.s.one("SELECT user_id FROM posts WHERE id=?", r.target_id)
                ?.user_id
            : r.target_id;
        return {
          ...r,
          author,
          projectId: author ? this.active(author)?.project_id : null,
        };
      })
      .filter((r) => u.role === "platform" || r.projectId === u.project_id);
  }
  moderate(u: Row, b: Row) {
    const r =
      this.moderation(u).find((r) => r.id === b.reportId) ||
      fail("Report unavailable.", 404);
    if (r.status !== "open") fail("Report already resolved.", 409);
    this.s.tx(() => {
      if (b.action === "hide" && r.target_kind === "post")
        this.s.run("UPDATE posts SET status='hidden' WHERE id=?", r.target_id);
      else if (b.action === "restrict" && r.target_kind === "profile")
        this.s.run(
          "UPDATE social_profiles SET discoverable=0,network_visible=0,locked=1 WHERE user_id=?",
          r.target_id,
        );
      else if (b.action !== "dismiss") fail("Unsupported moderation action.");
      this.s.run(
        "UPDATE social_reports SET status='resolved' WHERE id=?",
        r.id,
      );
      this.s.audit(u, "social.moderated", r.target_id);
    });
    return { ok: true };
  }
  bootstrap(viewer: Row) {
    this.ensure(viewer);
    return {
      profile: this.profile(viewer, viewer.id),
      projects: this.projects(viewer),
      people: this.directory(viewer),
      connections: this.connections(viewer),
      feed: this.feed(viewer),
      services: this.s.all("SELECT * FROM service_catalog"),
      requests: this.serviceRequests(viewer),
    };
  }
  serviceRequests(u: Row): Row[] {
    this.s.role(u, ["resident", "services", "platform", "technician"]);
    const where =
      u.role === "resident"
        ? "r.user_id=?"
        : u.role === "technician"
          ? "t.user_id=?"
          : "1=1";
    return this.s
      .all(
        `SELECT r.*,c.name category,f.label,p.name project,t.name technician FROM service_requests r JOIN service_catalog c ON c.id=r.category_id JOIN flats f ON f.id=r.flat_id JOIN projects p ON p.id=f.project_id LEFT JOIN technicians t ON t.id=r.technician_id WHERE ${where} ORDER BY r.created DESC`,
        ...(["resident", "technician"].includes(u.role) ? [u.id] : []),
      )
      .map((r) => ({
        ...r,
        history: this.s.all(
          "SELECT status,note,created FROM service_history WHERE request_id=? ORDER BY created",
          r.id,
        ),
      }));
  }
  requestService(u: Row, b: Row) {
    this.s.role(u, ["resident"]);
    const m = this.s.membership(u, text(b.flatId));
    if (!this.s.one("SELECT id FROM service_catalog WHERE id=?", b.categoryId))
      fail("Choose a service.");
    const preferred = optText(b.preferred, 100);
    const rid = id();
    this.s.tx(() => {
      this.s.run(
        "INSERT INTO service_requests VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        rid,
        u.id,
        m.flat_id,
        b.categoryId,
        text(b.description, 1500),
        preferred,
        b.urgency === "priority" ? "priority" : "routine",
        "requested",
        null,
        now(),
        now(),
      );
      this.s.run(
        "INSERT INTO service_history VALUES(?,?,?,?,?,?)",
        id(),
        rid,
        u.id,
        "requested",
        "Request received by the demo MDP service desk.",
        now(),
      );
    });
    return { id: rid };
  }
  serviceOps(u: Row) {
    this.s.role(u, ["services", "platform", "technician"]);
    return {
      requests: this.serviceRequests(u),
      technicians:
        u.role === "technician"
          ? this.s.all("SELECT * FROM technicians WHERE user_id=?", u.id)
          : this.s.all(
              "SELECT t.*,c.name category FROM technicians t JOIN service_catalog c ON c.id=t.trade",
            ),
    };
  }
  serviceAction(u: Row, rid: string, b: Row) {
    return this.s.tx(() => {
      const r =
        this.s.one("SELECT * FROM service_requests WHERE id=?", rid) ||
        fail("Request unavailable.", 404);
      const next = text(b.status);
      if (next === "cancelled") {
        if (r.user_id !== u.id && !["services", "platform"].includes(u.role))
          fail("You cannot cancel this request.", 403);
        if (!["requested", "assigned"].includes(r.status))
          fail("Work has already started.", 409);
      } else if (next === "assigned") {
        this.s.role(u, ["services", "platform"]);
        if (r.status !== "requested")
          fail("Request is already assigned or closed.", 409);
        const t =
          this.s.one(
            "SELECT * FROM technicians WHERE id=? AND trade=? AND status='available'",
            b.technicianId,
            r.category_id,
          ) || fail("Choose an available specialist for this trade.");
        if (
          this.s.one(
            "SELECT id FROM service_requests WHERE technician_id=? AND status IN ('assigned','en_route','in_progress')",
            t.id,
          )
        )
          fail("This specialist already has an active job.", 409);
        this.s.run(
          "UPDATE service_requests SET technician_id=? WHERE id=?",
          t.id,
          rid,
        );
      } else {
        this.s.role(u, ["technician"]);
        const t = this.s.one("SELECT * FROM technicians WHERE user_id=?", u.id);
        if (t?.id !== r.technician_id)
          fail("This job is not assigned to you.", 403);
        const steps: Row = {
          assigned: "en_route",
          en_route: "in_progress",
          in_progress: "completed",
        };
        if (steps[r.status] !== next) fail("Invalid service transition.", 409);
      }
      this.s.run(
        "UPDATE service_requests SET status=?,updated=? WHERE id=?",
        next,
        now(),
        rid,
      );
      this.s.run(
        "INSERT INTO service_history VALUES(?,?,?,?,?,?)",
        id(),
        rid,
        u.id,
        next,
        optText(b.note || "", 500),
        now(),
      );
      this.s.audit(u, `service.${next}`, rid);
      return { ok: true };
    });
  }
}
