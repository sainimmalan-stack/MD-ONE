import { createHash, randomBytes } from "node:crypto";

// Recovery credentials never share the regular sign-in session cookies.
export const recoveryVerifierCookie = "md_one_recovery_verifier";
export const recoveryTokenCookie = "md_one_recovery_access";
export const recoveryCooldownCookie = "md_one_recovery_sent";
export const recoveryCallback = "https://emd1.vercel.app/api/auth/callback";
export type AuthCall = (
  path: string,
  options?: RequestInit,
  token?: string,
) => Promise<any>;
const invalid = (message: string, status = 400) =>
  Object.assign(new Error(message), { status });
export function recoveryProof() {
  const verifier = randomBytes(32).toString("base64url");
  return {
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
  };
}
export async function requestRecovery(call: AuthCall, email: unknown) {
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^\S+@\S+\.\S+$/.test(email.trim())
  )
    throw invalid("Enter a valid email address.");
  const proof = recoveryProof();
  try {
    await call(
      "/auth/v1/recover?redirect_to=" + encodeURIComponent(recoveryCallback),
      {
        method: "POST",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code_challenge: proof.challenge,
          code_challenge_method: "s256",
        }),
      },
    );
  } catch (error: any) {
    if (error.status === 429)
      throw invalid(
        "Please wait a minute before requesting another reset email.",
        429,
      );
    // Do not expose whether an account exists, or pass provider errors to the page.
    if (![400, 404, 422].includes(error.status))
      throw invalid(
        "Reset email is unavailable right now. Please try again later.",
        503,
      );
  }
  return proof;
}
export async function exchangeRecovery(
  call: AuthCall,
  code: string | null,
  verifier?: string,
) {
  if (
    !code ||
    code.length > 2048 ||
    !verifier ||
    !/^[A-Za-z0-9_-]{43}$/.test(verifier)
  )
    throw invalid("This reset link has expired. Request a new one.", 401);
  const session = await call("/auth/v1/token?grant_type=pkce", {
    method: "POST",
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
  });
  if (!session.access_token)
    throw invalid("This reset link has expired. Request a new one.", 401);
  return session.access_token as string;
}
export async function updateRecoveredPassword(
  call: AuthCall,
  token: string | undefined,
  password: unknown,
  confirmation: unknown,
) {
  if (!token) throw invalid("Open the reset link from your email first.", 401);
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 200
  )
    throw invalid("Use a password between 12 and 200 characters.");
  if (password !== confirmation) throw invalid("The passwords do not match.");
  await call(
    "/auth/v1/user",
    { method: "PUT", body: JSON.stringify({ password }) },
    token,
  );
  // Password was changed even if the provider cannot revoke sessions immediately.
  await call("/auth/v1/logout?scope=global", { method: "POST" }, token).catch(
    () => {},
  );
}
