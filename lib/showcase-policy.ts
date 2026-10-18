import { AppError } from "./service.ts";
export const SHOWCASE_PERSONAS = new Set([
  "resident",
  "neighbor",
  "owner",
  "pending",
  "admin",
  "warehouse",
  "rider1",
  "rider2",
  "sky-resident",
  "sky-neighbor",
  "sky-family",
  "service",
  "tech1",
  "tech2",
  "tech3",
  "platform",
]);
/** Staff previews require the existing founder account and its current platform role. */
export const SHOWCASE_STAFF_PERSONAS = new Set(["admin","warehouse","rider1","rider2","service","tech1","tech2","tech3","platform"]);
export function canReviewStaffDemo(session: unknown, founderId: string | undefined): boolean {
  if (!session || typeof session !== "object" || !founderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(founderId)) return false;
  const value = session as {owner?:unknown;user?:{id?:unknown}};
  return value.owner === true && value.user?.id === founderId;
}
export const SAMPLE_DOCUMENT =
  "MD One synthetic sample document. No personal information.";
export function validateShowcaseInput(
  path: string[],
  method: string,
  body: Record<string, any>,
) {
  if (JSON.stringify(body).length > 128000)
    throw new AppError(
      413,
      "The preview accepts small synthetic entries only.",
    );
  const media = (v: any): boolean =>
    typeof v === "string"
      ? /^data:/.test(v)
      : !!v && typeof v === "object" && Object.values(v).some(media);
  if (media(body))
    throw new AppError(
      400,
      "Use built-in demo images only. Upload personal photos in your live account.",
    );
  if (path[0] === "documents" && method === "POST" && path.length === 1) {
    if (
      body.name !== "Sample property record.txt" ||
      body.mime !== "text/plain" ||
      body.data !== Buffer.from(SAMPLE_DOCUMENT).toString("base64")
    )
      throw new AppError(
        400,
        "This preview accepts only the built-in safe sample document. Never upload real IDs or property records.",
      );
  }
  if (
    path[0] === "my-project" &&
    path[2] === "attachments" &&
    method === "POST"
  )
    throw new AppError(
      400,
      "Real bill uploads are disabled in this demo. Use a live verified project account.",
    );
}
