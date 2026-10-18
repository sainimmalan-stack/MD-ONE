import { hostedAuth, hostedEnabled } from "@/lib/hosted-auth";
import { NextRequest, NextResponse } from "next/server";
import { getDb, hash, now, id } from "@/lib/db";
import { communityApi } from "@/lib/community-api";
import { receiveStock } from "@/lib/retail-stock";
import { retailOverview } from "@/lib/retail";
import { Governance } from "@/lib/governance";
import { Social } from "@/lib/social";
import { Service, AppError, text, integer, fail } from "@/lib/service";
import { amortize } from "@/lib/finance";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const rate = new Map<string, { n: number; reset: number }>();
function local(req: NextRequest) {
  const host = req.nextUrl.hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host))
    fail(
      "Demo API is restricted to this computer. Production authentication is not configured.",
      403,
    );
  const origin = req.headers.get("origin");
  if (
    origin &&
    origin !== `${req.nextUrl.protocol}//${req.headers.get("host")}`
  )
    fail("Cross-origin requests are disabled.", 403);
}
async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  if (hostedEnabled()) return hostedAuth(req, (await ctx.params).path);
  try {
    local(req);
    const { path: p } = await ctx.params;
    const s = new Service(getDb());
    const token =
      req.cookies.get("mdp_session")?.value ||
      req.headers.get("authorization")?.replace(/^Bearer /, "") ||
      "";
    let b: Record<string, any> = {};
    if (!["GET", "DELETE"].includes(req.method)) {
      if (Number(req.headers.get("content-length") || 0) > 7_500_000)
        fail("Request too large.", 413);
      const raw = await req.text();
      if (raw.length > 7_500_000) fail("Request too large.", 413);
      try {
        b = raw ? JSON.parse(raw) : {};
      } catch {
        fail("Invalid JSON.");
      }
      if (!b || Array.isArray(b) || typeof b !== "object")
        fail("Expected a JSON object.");
    }
    const json = (data: unknown, status = 200) =>
      NextResponse.json(data, {
        status,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    if (p[0] === "demo-login" && req.method === "POST") {
      const stamp = rate.get("login") || { n: 0, reset: Date.now() + 60000 };
      if (stamp.reset < Date.now()) {
        stamp.n = 0;
        stamp.reset = Date.now() + 60000;
      }
      if (++stamp.n > 50)
        fail("Too many demo sign-ins. Try again shortly.", 429);
      rate.set("login", stamp);
      const result = s.login(text(b.actor));
      const res = json({
        user: result.user,
        mode: "demo",
        ...(b.native ? { token: result.token } : {}),
      });
      res.cookies.set("mdp_session", result.token, {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 43200,
        secure: req.nextUrl.protocol === "https:",
      });
      return res;
    }
    if (p[0] === "health") return json({ ok: true, mode: "demo" });
    const u = s.auth(token);
    if (p[0] === "logout" && req.method === "POST") {
      s.run("DELETE FROM sessions WHERE token=?", hash(token));
      const res = json({ ok: true });
      res.cookies.delete("mdp_session");
      return res;
    }
    if (
      p[0] === "my-project" &&
      p[2] === "attachments" &&
      p[3] &&
      req.method === "GET"
    ) {
      const a = new Governance(s).attachment(u, p[1], p[3]);
      return new NextResponse(new Uint8Array(a.data), {
        headers: {
          "Content-Type": a.mime,
          "Content-Disposition": `attachment; filename="${a.name.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (
      [
        "my-project",
        "appointments",
        "appointment-options",
        "exchange",
        "homes",
        "exchange-moderation",
      ].includes(p[0])
    ) {
      if (!["GET", "POST"].includes(req.method))
        fail("Method not allowed.", 405);
      return json(
        communityApi(
          s,
          u,
          p,
          req.method,
          b,
          Object.fromEntries(req.nextUrl.searchParams),
        ),
      );
    }
    if (p[0] === "retail-plan" && req.method === "GET")
      return json(retailOverview(s, u));
    const social = new Social(s);
    if (p[0] === "social-moderation" && req.method === "GET")
      return json(social.moderation(u));
    if (p[0] === "social-moderation" && req.method === "POST")
      return json(social.moderate(u, b));
    if (p[0] === "social" && req.method === "GET")
      return json(social.bootstrap(u));
    if (p[0] === "projects" && p[1] && req.method === "GET")
      return json(social.project(u, p[1]));
    if (p[0] === "profiles" && p[1] && req.method === "GET")
      return json({ ...social.profile(u, p[1]), posts: social.feed(u, p[1]) });
    if (p[0] === "my-profile" && req.method === "POST")
      return json(social.updateProfile(u, b));
    if (p[0] === "friends" && p[1] && req.method === "POST")
      return json(social.friend(u, p[1], text(b.action)));
    if (p[0] === "blocks" && p[1] && req.method === "POST")
      return json(social.block(u, p[1]));
    if (p[0] === "social-posts" && req.method === "POST" && !p[1])
      return json(social.createPost(u, b), 201);
    if (p[0] === "social-posts" && p[1] && req.method === "POST")
      return json(social.postAction(u, p[1], b));
    if (p[0] === "social-reports" && req.method === "POST")
      return json(social.report(u, b));
    if (p[0] === "insta-services" && req.method === "POST" && !p[1])
      return json(social.requestService(u, b), 201);
    if (p[0] === "insta-services" && req.method === "PATCH" && p[1])
      return json(social.serviceAction(u, p[1], b));
    if (p[0] === "service-ops" && req.method === "GET")
      return json(social.serviceOps(u));
    if (p[0] === "bootstrap" && req.method === "GET")
      return json({
        ...s.bootstrap(u),
        social:
          u.role === "resident" && social.active(u.id)
            ? social.bootstrap(u)
            : null,
      });
    if (p[0] === "operations" && req.method === "GET")
      return json(s.operations(u));
    if (p[0] === "emi" && req.method === "POST")
      return json(amortize(b.principal, b.rate, b.months, b.prepayment || 0));
    if (p[0] === "orders") {
      if (req.method === "GET") return json(s.orders(u));
      if (req.method === "POST" && !p[1]) return json(s.checkout(u, b), 201);
      if (req.method === "PATCH" && p[1])
        return json(s.updateOrder(u, p[1], b));
    }
    if (p[0] === "rides") {
      if (req.method === "POST" && !p[1]) return json(s.createRide(u, b), 201);
      if (req.method === "PATCH" && p[1]) return json(s.rideAction(u, p[1], b));
    }
    if (p[0] === "events" && p[1] && req.method === "POST")
      return json(s.rsvp(u, p[1], b));
    if (p[0] === "posts" && req.method === "POST") {
      const m = s.resident(u);
      const pid = id();
      s.run(
        "INSERT INTO posts(id,user_id,project_id,body,created,status) VALUES(?,?,?,?,?,?)",
        pid,
        u.id,
        m.project_id,
        text(b.body, 1500),
        now(),
        "published",
      );
      return json({ id: pid }, 201);
    }
    if (p[0] === "reports" && req.method === "POST") {
      s.resident(u);
      const post =
        s.one(
          "SELECT * FROM posts WHERE id=? AND project_id=?",
          b.targetId,
          s.membership(u).project_id,
        ) || fail("Post unavailable.", 404);
      s.run(
        "INSERT INTO reports VALUES(?,?,?,?,?,?)",
        id(),
        u.id,
        "post",
        post.id,
        text(b.reason, 500),
        "open",
      );
      return json({ ok: true });
    }
    if (p[0] === "preferences" && req.method === "POST")
      return json(s.preferences(u, b));
    if (
      ["expenses", "loans", "loan-payment", "tickets"].includes(p[0]) &&
      req.method === "POST"
    )
      return json(s.personal(u, p[0], b), 201);
    if (p[0] === "expenses" && p[1] && req.method === "DELETE") {
      s.run("DELETE FROM expenses WHERE id=? AND user_id=?", p[1], u.id);
      return json({ ok: true });
    }
    if (p[0] === "vault-unlock" && req.method === "POST") {
      s.role(u, ["resident"]);
      s.run(
        "UPDATE sessions SET stepup_until=? WHERE token=?",
        new Date(Date.now() + 300000).toISOString(),
        hash(token),
      );
      return json({ demo: true, expiresIn: 300 });
    }
    if (p[0] === "documents") {
      if (req.method === "POST" && !p[1]) return json(s.upload(u, b), 201);
      if (p[1] && req.method === "GET") {
        const d = s.document(
          u,
          p[1],
          req.nextUrl.searchParams.get("share") || undefined,
        );
        return new NextResponse(new Uint8Array(d.data), {
          headers: {
            "Content-Type": d.mime,
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(d.name)}`,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (p[1] && req.method === "DELETE") {
        s.run(
          "DELETE FROM shares WHERE document_id=? AND owner_id=?",
          p[1],
          u.id,
        );
        s.run("DELETE FROM documents WHERE id=? AND user_id=?", p[1], u.id);
        s.audit(u, "vault.delete", p[1]);
        return json({ ok: true });
      }
      if (p[1] && p[2] === "share" && req.method === "POST")
        return json(s.share(u, p[1], b), 201);
    }
    if (p[0] === "shares" && p[1] && req.method === "DELETE") {
      s.run(
        "UPDATE shares SET revoked=1 WHERE id=? AND owner_id=?",
        p[1],
        u.id,
      );
      return json({ ok: true });
    }
    if (p[0] === "memberships") {
      if (req.method === "GET")
        return json(
          s.all(
            "SELECT m.*,u.name,f.label FROM memberships m JOIN users u ON u.id=m.user_id JOIN flats f ON f.id=m.flat_id JOIN ownership o ON o.flat_id=f.id WHERE o.user_id=?",
            u.id,
          ),
        );
      if (req.method === "PATCH" && p[1])
        return json(s.membershipAction(u, p[1], b));
    }
    if (p[0] === "stock" && req.method === "POST")
      return json(receiveStock(s, u, b));
    if (p[0] === "riders" && p[1] && req.method === "PATCH") {
      s.role(u, ["warehouse", "platform"]);
      if (!["available", "off_shift"].includes(b.status))
        fail("Invalid shift.");
      if (
        s.one(
          "SELECT id FROM orders WHERE rider_id=? AND status='out_for_delivery'",
          p[1],
        )
      )
        fail("Complete active deliveries first.", 409);
      s.run(
        "UPDATE riders SET status=?,charging=?,range_km=? WHERE id=?",
        b.status,
        b.charging ? 1 : 0,
        integer(b.rangeKm, 0, 200),
        p[1],
      );
      s.audit(u, "rider.updated", p[1]);
      return json({ ok: true });
    }
    if (p[0] === "tickets" && p[1] && req.method === "PATCH") {
      s.role(u, ["association"]);
      if (!["in_progress", "resolved"].includes(b.status))
        fail("Invalid ticket status.");
      s.run(
        "UPDATE tickets SET status=? WHERE id=? AND project_id=?",
        b.status,
        p[1],
        u.project_id,
      );
      s.audit(u, "ticket.updated", p[1]);
      return json({ ok: true });
    }
    if (p[0] === "moderate" && req.method === "POST") {
      s.role(u, ["association"]);
      const post =
        s.one(
          "SELECT * FROM posts WHERE id=? AND project_id=?",
          b.postId,
          u.project_id,
        ) || fail("Post unavailable.", 404);
      s.run("UPDATE posts SET status='hidden' WHERE id=?", post.id);
      s.run("UPDATE reports SET status='resolved' WHERE target_id=?", post.id);
      s.audit(u, "post.hidden", post.id);
      return json({ ok: true });
    }
    if (p[0] === "export" && req.method === "GET") {
      const data = s.bootstrap(u);
      (data as any).social =
        u.role === "resident" && social.active(u.id)
          ? social.bootstrap(u)
          : null;
      delete (data as any).products;
      delete (data as any).projects;
      return json(data);
    }
    if (p[0] === "account" && req.method === "DELETE") {
      if (
        s.one(
          "SELECT id FROM orders WHERE user_id=? AND status NOT IN ('delivered','cancelled','returned')",
          u.id,
        )
      )
        fail(
          "Complete or cancel active orders before deleting your account.",
          409,
        );
      s.tx(() => {
        for (const table of [
          "shares",
          "documents",
          "expenses",
          "loan_payments",
          "loans",
          "preferences",
        ])
          s.run(
            `DELETE FROM ${table} WHERE ${table === "shares" ? "owner_id" : "user_id"}=?`,
            u.id,
          );
        s.run(
          "UPDATE memberships SET status='expired',move_out=? WHERE user_id=?",
          now(),
          u.id,
        );
        s.run("DELETE FROM social_profiles WHERE user_id=?", u.id);
        s.run("UPDATE posts SET status='hidden' WHERE user_id=?", u.id);
        s.run(
          "UPDATE friendships SET status='cancelled' WHERE sender_id=? OR recipient_id=?",
          u.id,
          u.id,
        );
        s.run(
          "UPDATE users SET deleted=1,name='Deleted demo resident' WHERE id=?",
          u.id,
        );
        s.run("DELETE FROM sessions WHERE user_id=?", u.id);
        s.audit(u, "account.deleted", u.id);
      });
      const res = json({ ok: true });
      res.cookies.delete("mdp_session");
      return res;
    }
    fail("Endpoint not found.", 404);
  } catch (e) {
    if (e instanceof AppError)
      return NextResponse.json(
        { error: e.message },
        { status: e.status, headers: { "Cache-Control": "no-store" } },
      );
    console.error("MDP API failure", e instanceof Error ? e.name : "unknown");
    return NextResponse.json(
      { error: "The request could not be completed. Please try again." },
      { status: 500 },
    );
  }
}
export const GET = handle,
  POST = handle,
  PATCH = handle,
  DELETE = handle;
