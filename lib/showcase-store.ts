import { randomUUID } from "node:crypto";
import type {
  ShowcaseSnapshotStore,
  SnapshotLease,
} from "./durable-showcase.ts";

/** Only the BFF knows p_key. The public Supabase publishable key alone cannot access snapshots. */
export class SupabaseShowcaseStore implements ShowcaseSnapshotStore {
  constructor(
    private url: string,
    private publicKey: string,
    private secret: string,
  ) {}
  private async call(
    action: string,
    hash: string,
    extra: Record<string, unknown> = {},
  ) {
    const response = await fetch(
      this.url.replace(/\/$/, "") + "/rest/v1/rpc/showcase_snapshot",
      {
        method: "POST",
        cache: "no-store",
        headers: { apikey: this.publicKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          p_action: action,
          p_key: this.secret,
          p_hash: hash,
          ...extra,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new Error("Demo storage is temporarily unavailable. Please retry.");
    return response.json();
  }
  async acquire(hash: string, create: boolean): Promise<SnapshotLease | null> {
    const until = Date.now() + 12000;
    while (true) {
      const result = await this.call(create ? "create" : "acquire", hash);
      if (result.status === "missing") return null;
      if (result.status === "ok")
        return {
          lease: result.lease,
          revision: result.revision,
          payload: result.payload,
        };
      if (result.status !== "busy" || Date.now() > until)
        throw new Error("Your demo is busy. Please retry in a moment.");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  async commit(hash: string, lease: SnapshotLease, payload: string) {
    const result = await this.call("commit", hash, {
      p_lease: lease.lease,
      p_revision: lease.revision,
      p_payload: payload,
    });
    if (result.status !== "ok")
      throw new Error(
        "Demo update was not confirmed. Please retry the same action.",
      );
  }
  async release(hash: string, lease: SnapshotLease) {
    await this.call("release", hash, {
      p_lease: lease.lease,
      p_revision: lease.revision,
    });
  }
  async reset(hash: string) {
    await this.call("reset", hash);
  }
}

/** Local-only reference implementation and multi-worker test double. */
export class MemoryShowcaseStore implements ShowcaseSnapshotStore {
  private rows = new Map<
    string,
    {
      revision: number;
      payload: string | null;
      lease: string | null;
      until: number;
      touched: number;
      created: number;
    }
  >();
  constructor(
    private clock = Date.now,
    private leaseMs = 90000,
  ) {}
  async acquire(hash: string, create: boolean) {
    const now = this.clock();
    for (const [key, row] of this.rows)
      if (now - row.touched > 30 * 60000 || now - row.created > 2 * 3600000)
        this.rows.delete(key);
    let row = this.rows.get(hash);
    if (!row && create) {
      if (this.rows.size >= 64) throw new Error("Demo capacity reached.");
      row = {
        revision: 0,
        payload: null,
        lease: null,
        until: 0,
        touched: now,
        created: now,
      };
      this.rows.set(hash, row);
    }
    if (!row) return null;
    if (row.lease && row.until > now)
      throw new Error("Your demo is busy. Please retry.");
    row.lease = randomUUID();
    row.until = now + this.leaseMs;
    return { lease: row.lease, revision: row.revision, payload: row.payload };
  }
  async commit(hash: string, lease: SnapshotLease, payload: string) {
    const row = this.rows.get(hash);
    if (
      !row ||
      row.lease !== lease.lease ||
      row.revision !== lease.revision ||
      row.until <= this.clock()
    )
      throw new Error("Stale demo update rejected.");
    row.payload = payload;
    row.revision++;
    row.lease = null;
    row.touched = this.clock();
  }
  async release(hash: string, lease: SnapshotLease) {
    const row = this.rows.get(hash);
    if (row?.lease === lease.lease && row.revision === lease.revision) {
      if (row.payload === null) this.rows.delete(hash);
      else row.lease = null;
    }
  }
  async reset(hash: string) {
    this.rows.delete(hash);
  }
}
