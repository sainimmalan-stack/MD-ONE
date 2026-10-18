import { demoApi } from "@/lib/demo-api";
import { hostedAuth, hostedEnabled } from "@/lib/hosted-auth";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { Service, AppError, fail } from "@/lib/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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
  const path = (await ctx.params).path;
  if (hostedEnabled()) return hostedAuth(req, path);
  try {
    local(req);
    return await demoApi(req, path, new Service(getDb()), {
      cookieName: "mdp_session",
      cookiePath: "/",
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof AppError ? e.message : "Could not open the local demo.",
      },
      {
        status: e instanceof AppError ? e.status : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
export const GET = handle,
  POST = handle,
  PATCH = handle,
  DELETE = handle;
