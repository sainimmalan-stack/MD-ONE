"use client";
import { useEffect, useState } from "react";
import { BrandLockup } from "@/components/brand-lockup";
import { ThemeToggle } from "@/components/theme-toggle";
import "@/components/hosted-access.css";

export default function ResetPassword() {
  const [state, setState] = useState<"loading" | "ready" | "expired" | "done">(
    "loading",
  );
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("expired")) {
      setState("expired");
      return;
    }
    fetch("/api/auth/recovery-session", { cache: "no-store" })
      .then((r) => setState(r.ok ? "ready" : "expired"))
      .catch(() => {
        setError("Could not check your reset link. Refresh to try again.");
        setState("expired");
      });
  }, []);
  return (
    <div className="hosted-shell">
      <header>
        <a href="/" aria-label="MD One home">
          <BrandLockup />
        </a>
        <ThemeToggle />
      </header>
      <main>
        <section className="hosted-auth-card">
          <span className="hosted-eyebrow">YOUR MD ONE ACCOUNT</span>
          <h1>{state === "done" ? "You’re all set." : "A fresh start."}</h1>
          {state === "loading" && (
            <p role="status">Checking your reset link…</p>
          )}
          {state === "expired" && (
            <>
              <p>
                This reset link is missing or has expired. Request a new link
                and open it in the same browser within an hour.
              </p>
              <a className="hosted-link" href="/">
                Back to sign in
              </a>
            </>
          )}
          {state === "done" && (
            <>
              <p role="status">
                Your password has been updated. Sign in with your new password.
              </p>
              <a className="hosted-link" href="/">
                Sign in to MD One →
              </a>
            </>
          )}
          {state === "ready" && (
            <>
              <p>
                Choose a new password with at least 12 characters. This screen
                expires after 10 minutes.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError("");
                  if (password !== confirmation) {
                    setError("The passwords do not match.");
                    return;
                  }
                  setBusy(true);
                  try {
                    const response = await fetch("/api/auth/reset-password", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ password, confirmation }),
                    });
                    const data = await response.json();
                    if (!response.ok) {
                      if (response.status === 401) setState("expired");
                      throw new Error(
                        data.error ||
                          "Could not update your password. Please try again.",
                      );
                    }
                    setPassword("");
                    setConfirmation("");
                    setState("done");
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Please try again.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  New password
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={200}
                    required
                    value={password}
                    disabled={busy}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label>
                  Confirm new password
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={200}
                    required
                    value={confirmation}
                    disabled={busy}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                </label>
                <button className="hosted-primary" disabled={busy}>
                  {busy ? "Updating…" : "Update password"}
                </button>
              </form>
            </>
          )}
          {error && (
            <div className="hosted-error" role="alert">
              {error}
            </div>
          )}
        </section>
      </main>
      <footer>One app. Everyday living.</footer>
    </div>
  );
}
