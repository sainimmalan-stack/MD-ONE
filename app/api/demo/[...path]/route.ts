import { NextRequest, NextResponse } from "next/server";
import { demoApi } from "@/lib/demo-api";
import { randomBytes } from "node:crypto";
import {
  DurableShowcaseSessions,
  PreviewExpired,
} from "@/lib/durable-showcase";
import {
  MemoryShowcaseStore,
  SupabaseShowcaseStore,
} from "@/lib/showcase-store";
import { withSyntheticVault } from "@/lib/db";
import { showcaseOwnerAccess } from "@/lib/showcase-owner";
import { Service } from "@/lib/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const localStore = new MemoryShowcaseStore();
const localKey = randomBytes(32).toString("hex");
function sessionStore(req: NextRequest) {
  if (
    !process.env.VERCEL &&
    ["localhost", "127.0.0.1", "[::1]"].includes(req.nextUrl.hostname)
  )
    return new DurableShowcaseSessions(localStore, localKey);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.MD_ONE_DEMO_STATE_KEY;
  if (!url?.startsWith("https://") || !publicKey || !secret)
    throw new Error("Durable demo storage is not configured.");
  return new DurableShowcaseSessions(
    new SupabaseShowcaseStore(url, publicKey, secret),
    secret,
  );
}
const visitCookie = "md_one_preview";
const actorCookie = "md_one_preview_actor";
const cookiePath = "/api/demo";
const headers = {
  "Cache-Control": "private, no-store",
  "X-MD-One-Mode": "synthetic-preview",
  "X-Content-Type-Options": "nosniff",
};
async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const path = (await ctx.params).path;
  let access: ReturnType<typeof showcaseOwnerAccess> | undefined;
  const ownerAccess = () => (access ??= showcaseOwnerAccess(req));
  const finish = async (response: NextResponse) => {
    if (access)
      for (const cookie of (await access).cookies) response.cookies.set(cookie);
    return response;
  };
  try {
    if (path[0] === "demo-access" && path.length === 1 && req.method === "GET")
      return finish(
        NextResponse.json(
          { staffAllowed: (await ownerAccess()).allowed },
          { headers },
        ),
      );
    if (!["GET", "POST", "PATCH", "DELETE"].includes(req.method))
      return NextResponse.json(
        { error: "Method not allowed." },
        { status: 405, headers },
      );
    if (req.method !== "GET") {
      if (
        req.headers.get("origin") !==
        `${req.nextUrl.protocol}//${req.headers.get("host")}`
      )
        return NextResponse.json(
          { error: "Cross-origin demo requests are disabled." },
          { status: 403, headers },
        );
      if (Number(req.headers.get("content-length") || 0) > 128000)
        return NextResponse.json(
          { error: "Use small synthetic entries only." },
          { status: 413, headers },
        );
    }
    const sessions = sessionStore(req);
    const token = req.cookies.get(visitCookie)?.value;
    if (path[0] === "demo-reset" && req.method === "POST") {
      await sessions.reset(token);
      const r = NextResponse.json({ ok: true }, { headers });
      for (const name of [visitCookie, actorCookie])
        r.cookies.set(name, "", {
          path: cookiePath,
          maxAge: 0,
          httpOnly: true,
          secure: req.nextUrl.protocol === "https:",
          sameSite: "strict",
        });
      return r;
    }
    const outcome = await sessions.run(
      token,
      path.length === 1 && path[0] === "demo-login" && req.method === "POST",
      async (s) =>
        withSyntheticVault(s.vaultKey, () =>
          demoApi(req, path, new Service(s.db), {
            cookieName: actorCookie,
            cookiePath,
            showcase: true,
            runId: s.runId,
            authorizeShowcaseStaff: async () => (await ownerAccess()).allowed,
          }),
        ),
    );
    const response = outcome.result;
    for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
    if (outcome.created)
      response.cookies.set(visitCookie, outcome.token, {
        path: cookiePath,
        maxAge: 7200,
        httpOnly: true,
        sameSite: "strict",
        secure: req.nextUrl.protocol === "https:",
      });
    return finish(response);
  } catch (error) {
    const expired = error instanceof PreviewExpired;
    return NextResponse.json(
      {
        error: expired
          ? "Your demo has expired. Use Reset demo to start again."
          : "Demo storage is temporarily busy. Please retry; your last confirmed changes are preserved.",
      },
      {
        status: expired ? (path[0] === "bootstrap" ? 401 : 409) : 503,
        headers,
      },
    );
  }
}
export const GET = handle,
  POST = handle,
  PATCH = handle,
  DELETE = handle;
