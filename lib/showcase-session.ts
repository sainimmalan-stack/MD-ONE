import { randomBytes, randomUUID, createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { createShowcaseDatabase } from "./db.ts";
export type ShowcaseSession = {
  db: DatabaseSync;
  vaultKey: Buffer;
  runId: string;
  created: number;
  touched: number;
  requests: number;
  windowStart: number;
  windowCount: number;
};
/** Disposable, per-browser sandboxes; never shared fixture state or durable production records. */
export class ShowcaseSessions {
  private sessions = new Map<string, ShowcaseSession>();
  constructor(
    private max = 32,
    private idle = 30 * 60000,
    private lifetime = 2 * 3600000,
  ) {}
  private hash(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
  prune(at = Date.now()) {
    for (const [k, s] of this.sessions)
      if (at - s.touched > this.idle || at - s.created > this.lifetime) {
        s.db.close();
        this.sessions.delete(k);
      }
  }
  create(at = Date.now()) {
    this.prune(at);
    if (this.sessions.size >= this.max)
      throw new Error(
        "The demo is busy. Please try again after an inactive preview closes.",
      );
    const token = randomBytes(32).toString("hex");
    const session: ShowcaseSession = {
      db: createShowcaseDatabase(),
      vaultKey: randomBytes(32),
      runId: randomUUID(),
      created: at,
      touched: at,
      requests: 0,
      windowStart: at,
      windowCount: 0,
    };
    this.sessions.set(this.hash(token), session);
    return { token, session };
  }
  get(token: string | undefined, at = Date.now()) {
    this.prune(at);
    if (!token || !/^\w{64}$/.test(token)) return null;
    const s = this.sessions.get(this.hash(token));
    if (!s) return null;
    if (at - s.windowStart > 60000) {
      s.windowStart = at;
      s.windowCount = 0;
    }
    if (++s.windowCount > 120 || ++s.requests > 3000)
      throw new Error(
        "Preview request limit reached. Please wait or reset your demo.",
      );
    s.touched = at;
    return s;
  }
  remove(token: string | undefined) {
    if (!token) return;
    const k = this.hash(token),
      s = this.sessions.get(k);
    if (s) {
      s.db.close();
      this.sessions.delete(k);
    }
  }
  close() {
    for (const s of this.sessions.values()) s.db.close();
    this.sessions.clear();
  }
}
