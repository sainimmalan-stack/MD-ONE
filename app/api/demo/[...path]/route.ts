import { NextRequest, NextResponse } from "next/server";
import { demoApi } from "@/lib/demo-api";
import { ShowcaseSessions } from "@/lib/showcase-session";
import { withSyntheticVault } from "@/lib/db";
import { Service } from "@/lib/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const sessions = new ShowcaseSessions();
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
  try {
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
    let token = req.cookies.get(visitCookie)?.value;
    if (path[0] === "demo-reset" && req.method === "POST") {
      sessions.remove(token);
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
    let session = sessions.get(token),
      created = false;
    if (!session) {
      if (path[0] !== "demo-login" || req.method !== "POST")
        return NextResponse.json(
          {
            error:
              "Your temporary demo session expired or restarted. Use Reset demo to start again.",
          },
          { status: path[0] === "bootstrap" ? 401 : 409, headers },
        );
      const fresh = sessions.create();
      token = fresh.token;
      session = fresh.session;
      created = true;
    }
    const s = session;
    const response = await withSyntheticVault(s.vaultKey, () =>
      demoApi(req, path, new Service(s.db), {
        cookieName: actorCookie,
        cookiePath,
        showcase: true,
        runId: s.runId,
      }),
    );
    for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
    if (created)
      response.cookies.set(visitCookie, token!, {
        path: cookiePath,
        maxAge: 7200,
        httpOnly: true,
        sameSite: "strict",
        secure: req.nextUrl.protocol === "https:",
      });
    return response;
  } catch {
    return NextResponse.json(
      { error: "The temporary demo is busy. Please wait or use Reset demo." },
      { status: 429, headers },
    );
  }
}
export const GET = handle,
  POST = handle,
  PATCH = handle,
  DELETE = handle;
