import { test } from "node:test";
import assert from "node:assert/strict";
import { ShowcaseSessions } from "../lib/showcase-session.ts";
import { Service } from "../lib/service.ts";
import {
  openDatabase,
  withSyntheticVault,
  encrypt,
  decrypt,
} from "../lib/db.ts";
import {
  validateShowcaseInput,
  SAMPLE_DOCUMENT,
} from "../lib/showcase-policy.ts";
test("production local DB remains fail closed; explicitly synthetic sessions are private and resettable", () => {
  const before = process.env.MDP_MODE;
  process.env.MDP_MODE = "production";
  const sessions = new ShowcaseSessions(2, 1000, 2000);
  try {
    assert.throws(() => openDatabase(":memory:"), /cannot run in production/);
    const a = sessions.create(10000),
      b = sessions.create(10000);
    assert.notEqual(a.token, b.token);
    assert.notEqual(a.session.runId, b.session.runId);
    const s = new Service(a.session.db);
    s.run("UPDATE expenses SET amount=42 WHERE id='expense1'");
    assert.notEqual(
      new Service(b.session.db).one(
        "SELECT amount FROM expenses WHERE id='expense1'",
      )?.amount,
      42,
    );
    assert.throws(() => sessions.create(10001), /busy/);
    assert.equal(sessions.get("forged"), null);
    sessions.remove(a.token);
    assert.equal(sessions.get(a.token, 10002), null);
    assert.equal(sessions.get(b.token, 12001), null);
  } finally {
    sessions.close();
    if (before === undefined) delete process.env.MDP_MODE;
    else process.env.MDP_MODE = before;
  }
});
test("temporary vault keys remain isolated across overlapping requests", async () => {
  const a = Buffer.alloc(32, 1),
    b = Buffer.alloc(32, 2);
  const [x, y] = await Promise.all([
    withSyntheticVault(a, async () => {
      await Promise.resolve();
      return encrypt(Buffer.from("SYNTHETIC A"));
    }),
    withSyntheticVault(b, async () => {
      await Promise.resolve();
      return encrypt(Buffer.from("SYNTHETIC B"));
    }),
  ]);
  assert.equal(
    withSyntheticVault(a, () => decrypt(x).toString()),
    "SYNTHETIC A",
  );
  assert.equal(
    withSyntheticVault(b, () => decrypt(y).toString()),
    "SYNTHETIC B",
  );
  assert.throws(() => withSyntheticVault(b, () => decrypt(x)));
});
test("hosted demo accepts its safe sample and rejects real files/photos", () => {
  validateShowcaseInput(["documents"], "POST", {
    name: "Sample property record.txt",
    mime: "text/plain",
    data: Buffer.from(SAMPLE_DOCUMENT).toString("base64"),
  });
  assert.throws(
    () =>
      validateShowcaseInput(["documents"], "POST", {
        name: "private.pdf",
        mime: "application/pdf",
        data: "JVBERi0=",
      }),
    /built-in safe sample/,
  );
  assert.throws(
    () =>
      validateShowcaseInput(["my-profile"], "POST", {
        photo: "data:image/png;base64,aGVsbG8=",
      }),
    /built-in demo images/,
  );
  assert.throws(
    () =>
      validateShowcaseInput(["my-project", "p1", "attachments"], "POST", {}),
    /disabled/,
  );
});
