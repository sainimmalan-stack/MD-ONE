import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { DatabaseSync, backup } from "node:sqlite";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { createShowcaseDatabase } from "./db.ts";
import type { ShowcaseSession } from "./showcase-session.ts";

export type SnapshotLease = {
  lease: string;
  revision: number;
  payload: string | null;
};
export interface ShowcaseSnapshotStore {
  acquire(hash: string, create: boolean): Promise<SnapshotLease | null>;
  commit(hash: string, lease: SnapshotLease, payload: string): Promise<void>;
  release(hash: string, lease: SnapshotLease): Promise<void>;
  reset(hash: string): Promise<void>;
}
export const previewTokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const validPreviewToken = (token?: string): token is string =>
  !!token && /^[a-f0-9]{64}$/.test(token);
const MAX_SNAPSHOT = 4_000_000;
const MAX_DATABASE = 12_000_000;
export class PreviewExpired extends Error {}

/** A fresh SQLite connection per request; only authenticated encrypted snapshots cross workers. */
export class DurableShowcaseSessions {
  private key: Buffer;
  constructor(
    private store: ShowcaseSnapshotStore,
    secret: string,
  ) {
    if (!/^[a-f0-9]{64}$/.test(secret))
      throw new Error("Durable demo storage is not configured.");
    this.key = createHash("sha256")
      .update("md-one-demo-snapshot-v1:" + secret)
      .digest();
  }
  private seal(hash: string, payload: Buffer) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(hash));
    return Buffer.concat([
      iv,
      cipher.update(payload),
      cipher.final(),
      cipher.getAuthTag(),
    ]).toString("base64");
  }
  private unseal(hash: string, value: string) {
    if (value.length > MAX_SNAPSHOT)
      throw new Error("Demo snapshot is too large.");
    const bytes = Buffer.from(value, "base64");
    if (bytes.length < 29) throw new Error("Invalid demo snapshot.");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      bytes.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(hash));
    decipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([
      decipher.update(bytes.subarray(12, -16)),
      decipher.final(),
    ]);
  }
  async run<T>(
    token: string | undefined,
    mayCreate: boolean,
    work: (session: ShowcaseSession) => Promise<T>,
  ) {
    const existing = validPreviewToken(token);
    let activeToken = existing ? token : undefined;
    let lease = activeToken
      ? await this.store.acquire(previewTokenHash(activeToken), false)
      : null;
    let created = false;
    if (!lease) {
      if (!mayCreate)
        throw new PreviewExpired("Your demo has expired. Start a new demo.");
      activeToken = randomBytes(32).toString("hex");
      created = true;
      lease = await this.store.acquire(previewTokenHash(activeToken), true);
      if (!lease) throw new Error("Could not start your demo. Please retry.");
    }
    const hash = previewTokenHash(activeToken!);
    const directory = await mkdtemp(join(tmpdir(), "md-one-demo-"));
    let session: ShowcaseSession | undefined;
    let committed = false;
    try {
      const file = join(directory, "snapshot.sqlite");
      if (lease.payload) {
        const decoded = JSON.parse(
          gunzipSync(this.unseal(hash, lease.payload), {
            maxOutputLength: 18_000_000,
          }).toString(),
        );
        if (
          decoded.version !== 1 ||
          !/^[a-f0-9]{64}$/.test(decoded.vaultKey) ||
          typeof decoded.database !== "string"
        )
          throw new Error("Invalid demo snapshot.");
        const bytes = Buffer.from(decoded.database, "base64");
        if (
          bytes.length > MAX_DATABASE ||
          bytes.subarray(0, 16).toString() !== "SQLite format 3\0"
        )
          throw new Error("Invalid demo database.");
        await writeFile(file, bytes, { mode: 0o600 });
        const db = new DatabaseSync(file, {
          enableDoubleQuotedStringLiterals: false,
        });
        db.exec(
          "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA trusted_schema=OFF;",
        );
        session = {
          ...decoded.meta,
          db,
          vaultKey: Buffer.from(decoded.vaultKey, "hex"),
        };
      } else {
        const at = Date.now();
        session = {
          db: createShowcaseDatabase(),
          vaultKey: randomBytes(32),
          runId: randomUUID(),
          created: at,
          touched: at,
          requests: 0,
          windowStart: at,
          windowCount: 0,
        };
      }
      const s = session!;
      const at = Date.now();
      if (at - s.created > 2 * 3600000 || at - s.touched > 30 * 60000)
        throw new PreviewExpired("Your demo has expired. Start a new demo.");
      if (at - s.windowStart > 60000) {
        s.windowStart = at;
        s.windowCount = 0;
      }
      if (++s.windowCount > 120 || ++s.requests > 3000)
        throw new Error("Preview request limit reached. Please wait.");
      s.touched = at;
      const result = await work(s);
      const snapshot = join(directory, "saved.sqlite");
      await backup(s.db, snapshot);
      const bytes = await readFile(snapshot);
      if (bytes.length > MAX_DATABASE)
        throw new Error("Demo capacity reached. Reset the demo to continue.");
      const { db: _db, vaultKey, ...meta } = s;
      const payload = this.seal(
        hash,
        gzipSync(
          Buffer.from(
            JSON.stringify({
              version: 1,
              vaultKey: vaultKey.toString("hex"),
              meta,
              database: bytes.toString("base64"),
            }),
          ),
        ),
      );
      if (payload.length > MAX_SNAPSHOT)
        throw new Error("Demo capacity reached. Reset the demo to continue.");
      await this.store.commit(hash, lease, payload);
      committed = true;
      return { result, token: activeToken!, created };
    } finally {
      session?.db.close();
      await rm(directory, { recursive: true, force: true });
      if (!committed) await this.store.release(hash, lease).catch(() => {});
    }
  }
  async reset(token?: string) {
    if (validPreviewToken(token))
      await this.store.reset(previewTokenHash(token));
  }
}
