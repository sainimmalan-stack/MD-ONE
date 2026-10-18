# MD One password recovery

The account screen includes Forgot password. The user enters their account email,
opens the reset link in the same browser, and personally enters and submits their
new password. No administrator needs to know their password.

The server sends Supabase `/recover` a fresh S256 PKCE challenge and the existing
allowlisted callback `https://emd1.vercel.app/api/auth/callback`. A separate
HttpOnly verifier distinguishes recovery from ordinary OTP login. Only a valid
code exchange creates a ten-minute HttpOnly recovery token; ordinary account
cookies do not authorize `/api/auth/reset-password`. Successful password updates
clear local authentication cookies and request global Supabase session logout.
Existing access JWTs may remain usable until their Supabase expiry.

The form requires matching passwords of 12–200 characters. Supabase password
policy also applies. Requests enforce same origin and provider rate limits; a
one-minute browser cooldown reduces accidental repeated email requests. Recovery
responses do not disclose whether the email exists. Expired links show a new-link
instruction. Tokens, passwords and codes are never printed to app logs.

## Deployment and verification (2026-10-19)

- Local preview uses hosted mode without Supabase credentials intentionally;
  real password login/recovery cannot work there. It now explains this and links
  to the production app. `/demo` remains isolated from production records.
- 90 unit/domain tests pass; optimized Next build passes, including reset page.
- Local HTTP checks: password update without recovery token → 401; foreign
  origin recovery request → 403. Missing/expired reset screen verified in browser.
- Supabase has the exact production callback allowlisted and its password-reset
  template uses `ConfirmationURL`. Custom Gmail SMTP is enabled. Actual email
  delivery and user-completed password change have NOT been verified.
- Vercel remains on the previously approved stable rollback while the daily
  deployment cap is active. These changes require deployment before live use.
  Deploy the complete main branch, verify, then promote/remove rollback.
