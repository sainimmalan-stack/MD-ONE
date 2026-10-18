import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  recoveryProof,
  recoveryCallback,
  requestRecovery,
  exchangeRecovery,
  updateRecoveredPassword,
  type AuthCall,
} from "../lib/password-recovery.ts";

test("recovery uses a fresh PKCE proof and the fixed existing production callback", async () => {
  let request: any;
  const call: AuthCall = async (path, options) => {
    request = { path, body: JSON.parse(options!.body as string) };
    return {};
  };
  const proof = await requestRecovery(call, " Owner@Example.invalid ");
  assert.equal(
    request.path,
    "/auth/v1/recover?redirect_to=" + encodeURIComponent(recoveryCallback),
  );
  assert.equal(request.body.email, "owner@example.invalid");
  assert.equal(request.body.code_challenge_method, "s256");
  assert.equal(
    request.body.code_challenge,
    createHash("sha256").update(proof.verifier).digest("base64url"),
  );
  assert.notEqual(proof.verifier, recoveryProof().verifier);
  assert.equal(request.body.password, undefined);
});
test("invalid emails never reach Supabase; unknown accounts do not enumerate", async () => {
  let calls = 0;
  const call: AuthCall = async () => {
    calls++;
    throw Object.assign(new Error("User not found"), { status: 404 });
  };
  await assert.rejects(requestRecovery(call, "invalid"), /valid email/);
  assert.equal(calls, 0);
  assert.ok((await requestRecovery(call, "unknown@example.invalid")).verifier);
  await assert.rejects(
    requestRecovery(async () => {
      throw Object.assign(new Error("SMTP secret detail"), { status: 500 });
    }, "owner@example.invalid"),
    /Reset email is unavailable/,
  );
  await assert.rejects(
    requestRecovery(async () => {
      throw Object.assign(new Error("rate"), { status: 429 });
    }, "owner@example.invalid"),
    /wait a minute/,
  );
});
test("missing recovery proof and bad codes cannot create a recovery session", async () => {
  let calls = 0;
  const call: AuthCall = async () => {
    calls++;
    return { access_token: "synthetic-recovery-token" };
  };
  await assert.rejects(exchangeRecovery(call, "code", undefined));
  await assert.rejects(exchangeRecovery(call, null, recoveryProof().verifier));
  assert.equal(calls, 0);
  const verifier = recoveryProof().verifier;
  assert.equal(
    await exchangeRecovery(
      async (path, options) => {
        assert.equal(path, "/auth/v1/token?grant_type=pkce");
        assert.deepEqual(JSON.parse(options!.body as string), {
          auth_code: "synthetic-code",
          code_verifier: verifier,
        });
        return { access_token: "synthetic-recovery-token" };
      },
      "synthetic-code",
      verifier,
    ),
    "synthetic-recovery-token",
  );
});
test("password update needs recovery credential, matching strong passwords and revokes sessions", async () => {
  const calls: any[] = [];
  const call: AuthCall = async (...args) => {
    calls.push(args);
    return {};
  };
  await assert.rejects(
    updateRecoveredPassword(
      call,
      undefined,
      "synthetic-long-password",
      "synthetic-long-password",
    ),
    /reset link/,
  );
  await assert.rejects(
    updateRecoveredPassword(call, "synthetic-token", "short", "short"),
    /12 and 200/,
  );
  await assert.rejects(
    updateRecoveredPassword(
      call,
      "synthetic-token",
      "synthetic-long-password",
      "different",
    ),
    /do not match/,
  );
  assert.equal(calls.length, 0);
  await updateRecoveredPassword(
    call,
    "synthetic-token",
    "synthetic-long-password",
    "synthetic-long-password",
  );
  assert.equal(calls[0][0], "/auth/v1/user");
  assert.equal(calls[0][1].method, "PUT");
  assert.equal(calls[0][2], "synthetic-token");
  assert.equal(calls[1][0], "/auth/v1/logout?scope=global");
});
test("failed password update does not claim success or revoke sessions", async () => {
  let count = 0;
  await assert.rejects(
    updateRecoveredPassword(
      async () => {
        count++;
        throw new Error("expired");
      },
      "synthetic-token",
      "synthetic-long-password",
      "synthetic-long-password",
    ),
    /expired/,
  );
  assert.equal(count, 1);
});
