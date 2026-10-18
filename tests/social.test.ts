import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase, now } from "../lib/db.ts";
import { Service, AppError } from "../lib/service.ts";
import { Social } from "../lib/social.ts";
function setup() {
  const db = openDatabase(":memory:"),
    s = new Service(db),
    social = new Social(s);
  const u = (uid: string) => s.one("SELECT * FROM users WHERE id=?", uid)!;
  return { db, s, social, u };
}
const denied = (fn: () => unknown, status = 403) =>
  assert.throws(
    fn,
    (e: unknown) => e instanceof AppError && e.status === status,
  );
function edit(
  social: Social,
  u: Record<string, any>,
  patch: Record<string, any> = {},
) {
  const p = social.profile(u, u.id);
  return social.updateProfile(u, {
    bio: p.bio,
    occupation: p.occupation,
    contact: p.contact,
    contactVisibility: p.contactVisibility,
    locked: p.locked,
    discoverable: p.discoverable,
    networkVisible: p.networkVisible,
    avatar: p.avatar,
    ...patch,
  });
}
test("official project metadata is distinct from a synthetic flat register", () => {
  const { db, social, u } = setup();
  const p = social.project(u("resident"), "p4");
  assert.equal(p.totalFlats, 15);
  assert.equal(p.year, "2023");
  assert.equal(p.status, "completed");
  assert.equal(p.flats.length, 3);
  assert.equal(p.numberingVerified, false);
  assert.ok(p.flats.every((f) => f.simulation));
  const ongoing = social.project(u("resident"), "p19");
  assert.equal(ongoing.totalFlats, 4);
  assert.equal(ongoing.flats.length, 0);
  assert.equal(ongoing.status, "ongoing");
  db.close();
});
test("locked profile hides photo, contact, occupation and posts from strangers", () => {
  const { db, s, social, u } = setup();
  s.run(
    "UPDATE social_profiles SET contact='demo@example.invalid',contact_visibility='community' WHERE user_id='neighbor'",
  );
  const p = social.profile(u("resident"), "neighbor");
  assert.equal(p.locked, true);
  assert.equal(p.occupation, "");
  assert.equal(p.bio, "");
  assert.equal(p.avatar, "");
  assert.equal(p.contact, "");
  assert.equal(p.canSeeDetails, false);
  assert.equal(social.feed(u("resident"), "neighbor").length, 0);
  assert.equal(
    s.bootstrap(u("resident")).posts.some((p) => p.name === "Kiran Dev"),
    false,
  );
  db.close();
});
test("friend request approval must come from the recipient and unlocks permitted details", () => {
  const { db, s, social, u } = setup();
  s.run(
    "UPDATE social_profiles SET contact='hello@example.invalid' WHERE user_id='neighbor'",
  );
  social.friend(u("resident"), "neighbor", "request");
  assert.equal(
    social.profile(u("resident"), "neighbor").relationship,
    "outgoing",
  );
  denied(() => social.friend(u("resident"), "neighbor", "accept"));
  denied(() => social.friend(u("outsider"), "neighbor", "accept"));
  social.friend(u("neighbor"), "resident", "accept");
  const p = social.profile(u("resident"), "neighbor");
  assert.equal(p.relationship, "friends");
  assert.equal(p.occupation, "Software engineer");
  assert.equal(p.contact, "hello@example.invalid");
  assert.equal(social.feed(u("resident"), "neighbor").length, 1);
  db.close();
});
test("unfriending immediately revokes locked profile and friends-only posts", () => {
  const { db, social, u } = setup();
  social.friend(u("resident"), "neighbor", "request");
  social.friend(u("neighbor"), "resident", "accept");
  social.friend(u("resident"), "neighbor", "remove");
  assert.equal(social.profile(u("resident"), "neighbor").occupation, "");
  assert.equal(social.feed(u("resident"), "neighbor").length, 0);
  db.close();
});
test("private contact remains hidden even from accepted friends", () => {
  const { db, social, u } = setup();
  edit(social, u("neighbor"), {
    contact: "private@example.invalid",
    contactVisibility: "private",
  });
  social.friend(u("resident"), "neighbor", "request");
  social.friend(u("neighbor"), "resident", "accept");
  assert.equal(social.profile(u("resident"), "neighbor").contact, "");
  assert.equal(
    social.profile(u("neighbor"), "neighbor").contact,
    "private@example.invalid",
  );
  db.close();
});
test("directory visibility is explicit and cross-project visibility can be revoked", () => {
  const { db, social, u } = setup();
  edit(social, u("sky-resident"), { networkVisible: false });
  assert.equal(
    social.directory(u("resident")).some((p) => p.id === "sky-resident"),
    false,
  );
  assert.equal(
    social.directory(u("sky-family")).some((p) => p.id === "sky-resident"),
    true,
  );
  edit(social, u("sky-resident"), { discoverable: false });
  assert.equal(
    social.directory(u("sky-family")).some((p) => p.id === "sky-resident"),
    false,
  );
  denied(() => social.profile(u("resident"), "sky-resident"), 404);
  db.close();
});
test("block removes discovery and connection access in both directions", () => {
  const { db, social, u } = setup();
  social.friend(u("resident"), "neighbor", "request");
  social.friend(u("neighbor"), "resident", "accept");
  social.block(u("resident"), "neighbor");
  denied(() => social.profile(u("resident"), "neighbor"), 404);
  denied(() => social.profile(u("neighbor"), "resident"), 404);
  assert.equal(social.connections(u("neighbor")).length, 0);
  denied(() => social.friend(u("neighbor"), "resident", "request"));
  db.close();
});
test("post likes and comments enforce the post audience", () => {
  const { db, social, u } = setup();
  const p = social.createPost(u("resident"), {
    body: "A private moment",
    visibility: "friends",
  });
  denied(() => social.postAction(u("neighbor"), p.id, { action: "like" }), 404);
  social.friend(u("neighbor"), "resident", "request");
  social.friend(u("resident"), "neighbor", "accept");
  social.postAction(u("neighbor"), p.id, { action: "like" });
  social.postAction(u("neighbor"), p.id, {
    action: "comment",
    body: "Good to see you!",
  });
  const visible = social.feed(u("neighbor")).find((r) => r.id === p.id)!;
  assert.equal(visible.likes, 1);
  assert.equal(visible.comments.length, 1);
  denied(
    () =>
      social.postAction(u("outsider"), p.id, {
        action: "comment",
        body: "Bypass",
      }),
    404,
  );
  db.close();
});
test("locking a profile revokes previously public social posts", () => {
  const { db, social, u } = setup();
  const p = social.createPost(u("resident"), {
    body: "Network update",
    visibility: "network",
  });
  assert.ok(social.feed(u("sky-family")).some((r) => r.id === p.id));
  edit(social, u("resident"), { locked: true });
  assert.equal(
    social.feed(u("sky-family")).some((r) => r.id === p.id),
    false,
  );
  db.close();
});
test("moved-out residents cannot use profiles or send friend requests", () => {
  const { db, s, social, u } = setup();
  s.membershipAction(
    u("admin"),
    s.one("SELECT id FROM memberships WHERE user_id='resident'")!.id,
    { status: "expired" },
  );
  denied(() => social.directory(u("resident")));
  denied(() => social.friend(u("resident"), "neighbor", "request"));
  assert.equal(
    social.directory(u("sky-family")).some((p) => p.id === "resident"),
    false,
  );
  db.close();
});
test("service requests can be created for an owned ongoing project but pending memberships cannot book", () => {
  const { db, social, u } = setup();
  const r = social.requestService(u("owner"), {
    flatId: "f4",
    categoryId: "tiles",
    description: "Demo tile finishing request",
    preferred: "Next week",
  });
  assert.ok(r.id);
  assert.equal(
    social.serviceRequests(u("owner"))[0].project,
    "My Dream Aurelia",
  );
  denied(() =>
    social.requestService(u("pending"), {
      flatId: "f1",
      categoryId: "plumbing",
      description: "Need a tap fixed",
      preferred: "Tomorrow",
    }),
  );
  db.close();
});
test("MDP service dispatch requires a matching trade and assigned-only technician access", () => {
  const { db, social, u } = setup();
  const r = social.requestService(u("resident"), {
    flatId: "f1",
    categoryId: "tiles",
    description: "Replace a broken tile",
    preferred: "Tomorrow afternoon",
  });
  denied(() =>
    social.serviceAction(u("neighbor"), r.id, {
      status: "assigned",
      technicianId: "t3",
    }),
  );
  denied(
    () =>
      social.serviceAction(u("service"), r.id, {
        status: "assigned",
        technicianId: "t1",
      }),
    400,
  );
  social.serviceAction(u("service"), r.id, {
    status: "assigned",
    technicianId: "t3",
  });
  assert.equal(social.serviceRequests(u("tech1")).length, 0);
  assert.equal(social.serviceRequests(u("tech3")).length, 1);
  denied(() => social.serviceAction(u("tech1"), r.id, { status: "en_route" }));
  social.serviceAction(u("tech3"), r.id, { status: "en_route" });
  social.serviceAction(u("tech3"), r.id, { status: "in_progress" });
  social.serviceAction(u("tech3"), r.id, { status: "completed" });
  assert.equal(social.serviceRequests(u("resident"))[0].status, "completed");
  assert.equal(social.serviceRequests(u("resident"))[0].history.length, 5);
  db.close();
});
test("a specialist cannot be double-booked and completed work cannot be cancelled", () => {
  const { db, social, u } = setup();
  const b = {
      flatId: "f1",
      categoryId: "plumbing",
      description: "Fix a tap",
      preferred: "Tomorrow",
    },
    a = social.requestService(u("resident"), b),
    c = social.requestService(u("resident"), b);
  social.serviceAction(u("service"), a.id, {
    status: "assigned",
    technicianId: "t1",
  });
  denied(
    () =>
      social.serviceAction(u("service"), c.id, {
        status: "assigned",
        technicianId: "t1",
      }),
    409,
  );
  social.serviceAction(u("tech1"), a.id, { status: "en_route" });
  social.serviceAction(u("tech1"), a.id, { status: "in_progress" });
  social.serviceAction(u("tech1"), a.id, { status: "completed" });
  denied(
    () => social.serviceAction(u("resident"), a.id, { status: "cancelled" }),
    409,
  );
  db.close();
});
test("image payloads reject SVG and unknown formats", () => {
  const { db, social, u } = setup();
  denied(
    () =>
      social.createPost(u("resident"), {
        body: "Photo",
        visibility: "project",
        image: "data:image/svg+xml;base64,PHN2Zy8+",
      }),
    400,
  );
  denied(
    () =>
      edit(social, u("resident"), {
        avatar: "data:image/jpeg;base64,aW52YWxpZA==",
      }),
    400,
  );
  db.close();
});
test("social moderation is project scoped and does not expose private profile fields", () => {
  const { db, social, u } = setup();
  social.report(u("resident"), {
    kind: "post",
    targetId: "social1",
    reason: "Demo moderation check",
  });
  assert.equal(social.moderation(u("admin")).length, 0);
  const q = social.moderation(u("platform"))[0];
  assert.ok(q);
  assert.equal(q.contact, undefined);
  denied(
    () => social.moderate(u("admin"), { reportId: q.id, action: "hide" }),
    404,
  );
  social.moderate(u("platform"), { reportId: q.id, action: "hide" });
  assert.equal(
    social.feed(u("resident")).some((p) => p.id === "social1"),
    false,
  );
  db.close();
});
