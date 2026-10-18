# Hosted backend integration status

Supabase project: `dvhxdtrtyqrulxitjxab`, Mumbai. Vercel project: `md-one/emd1`.

The hosted path is selected only with both `MDP_MODE=production` (server) and
`NEXT_PUBLIC_HOSTED_AUTH=true` (build). The localhost demo remains separate.
The production path does not use the SQLite database, persona switcher, demo users,
or service-role credentials.

Implemented:
- Supabase email-link sign-in with server-generated PKCE verifier and challenge.
- Server-side user verification, access/refresh tokens in Secure/HttpOnly/SameSite cookies.
- Exact-origin checks on state-changing auth requests, provider timeouts and no-store responses.
- Authenticated project index and private residence requests protected by RLS.
- New accounts receive private profiles/preferences; residence requests confer no membership/ownership rights.
- Five schema migrations applied in Supabase; only official project names/service categories seeded.

Not yet migrated to the hosted request handler:
- Verified-resident application bootstrap and all grocery inventory/order/dispatch transactions.
- Community, carpool, marketplace (including homes), project finance/committee mutations.
- Service dispatch, document storage/scan/step-up, personal finance and native hosted auth.
- Authorized staff onboarding and residence verification workflow.

These routes fail closed with 503. An approved residence currently sees an explicit
migration notice. Do not describe this release as a complete production app.

Email delivery requires the sender's custom SMTP configuration. Gmail App Password
creation/entry is a user-controlled credential step. No mailbox password is stored
in this repository or Vercel. End-to-end email verification is pending SMTP setup.

Validation: web production build and TypeScript pass; existing 66 domain tests pass.
Unauthenticated session, missing-origin POST, malformed email and invalid code return
401, 403, 400 and 400 respectively in the isolated hosted-mode server check.
