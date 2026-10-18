# MD One reviewer demo

`/demo` reuses the full existing premium interface and local domain flows. The live sign-in/account page links to it through **Explore the demo**. It requires no resident account, email, password, real flat registration or staff permission changes.

The public selector includes Ananya (tenant / Vice President), Kiran (owner / President), non-resident owner, pending resident and Skylark residents. Additional project support, warehouse, two riders, service desk, specialists and platform personas are visible only to the verified founder. All identities, flat registers, prices, balances, dispatches, contacts and payment confirmations in this route are synthetic. The seeded project catalogue and official illustration assets are shared visual references, not a real resident directory or service promise.

## Isolation

- `/api/demo/*` is a separate Node route with a per-browser synthetic SQLite database restored from an encrypted snapshot for each request. Demo operations run only against synthetic state. Real Supabase session verification is consulted solely to authorize founder-only staff previews; this does not create Auth users, grant staff roles or write real orders.
- Synthetic browser/actor cookies are HttpOnly, SameSite Strict, Secure on HTTPS, scoped to `/api/demo`, and distinct from all hosted account cookies. Normal `/api/*` requests still use hosted auth in production; the original local database factory still refuses production mode and local API host checks remain intact.
- Production stores AES-256-GCM encrypted, compressed snapshots in dedicated private Supabase tables. Session state survives Vercel cold starts, different workers and redeployment with the same server key. A distributed lease and revision fence serialize updates and reject stale workers. At most 64 previews are retained, expiring after 30 minutes idle or two hours total. No production domain table stores demo orders, memberships or files.
- The **Reset demo** button discards only that visitor's disposable synthetic state. Actor changes within the same unexpired session share the simulated orders, resident conversations and service jobs, enabling cross-role walkthroughs.
- Each session has a separate temporary vault encryption key using AsyncLocalStorage. No production/local vault key is installed in the preview. The demo accepts only the built-in synthetic text document; actual document, property-proof and photo uploads are blocked in the UI and rejected on the server. No real payment/fulfilment operation is called.
- Basket keys include a random demo-run namespace to prevent an old preview basket from contaminating a new run or a real user's basket. Direct downloads also target `/api/demo`.
- Same-origin mutations, 128 KB payload limits, persona allowlist, per-session rate/lifetime bounds and existing domain authorization/validation apply. Errors after expiry direct reviewers to Reset demo.

For a presentation, open `/demo`, select a sample role, explore Home shortcuts, Orders, Community and Account, then switch to a second role to review the other side of a simulated journey. Keep suggestions in your review process; this change does not email anyone or publish reviewer feedback.

## Account layout fix

The shared logo image now has an intrinsic bounded CSS size, including standalone hosted login/account headers. The account page uses a compact mobile header, a clear return button and a demo link. Platform owners see their existing role without being prompted to invent a flat. Residence registration remains optional for them, starts with **Choose your project**, and counts only active verified non-test memberships via the existing operations-context RPC.

## Verification

- TypeScript and optimized Next webpack build passed.
- 98 domain tests passed, including new synthetic session isolation, lifetime/reset, production guard, overlapping vault-key isolation and media-input rejection tests.
- `scripts/showcase-smoke.mjs` tests the local **production-mode** build: two isolated reviewers, resident role switching, checkout replay, denial of all nine staff personas without founder authentication (including forged owner flags), safe sample document, reset, and denial of demo credentials on the real personal API. The expanded HTTP suite also verifies personal finance and downloads, community interactions, carpool acceptance, marketplace messages, rental interest, RSVP, service requests and billing. Cross-worker tests additionally carry groceries through delivery and specialists through completion.
- Browser verification uses the built app on localhost; Vercel status must be checked separately before claiming `/demo` is live. No paid plan or real resident identities are created. A dedicated server-only capability protects encrypted demo storage.

## Founder-only operations previews

Real staff access was audited on 19 October 2026: one platform staff account, belonging to the founder, and zero other staff accounts. No real role grants or revocations were needed.

The public demo picker exposes resident/owner/committee sample identities. Project support, warehouse/delivery, home service and platform sample identities require the existing founder UUID configured in the server-only `MD_ONE_FOUNDER_USER_ID` environment variable and a current `platform` role, verified through the real hosted session. Email strings, client flags and synthetic cookies do not authorize operations previews. The server checks both staff sign-in and subsequent requests, so a previous synthetic staff session does not retain access after real authentication expires or the role is revoked.

A local preview without hosted Supabase authentication intentionally cannot unlock founder-only staff views. Anonymous HTTP checks verify denial of all nine staff personas, checkout, isolated reviewers and sample files. Localhost uses a reference snapshot repository; public production requires the Supabase repository and never falls back to process memory.

## Durable storage deployment

Apply `supabase/migrations/202610190001_durable_showcase.sql`. Generate a random 32-byte hex `MD_ONE_DEMO_STATE_KEY`, store it as a server-only Vercel Production secret, and insert its SHA-256 into `private.showcase_config` using an administrator session. Never commit or expose the plaintext value. The public Supabase publishable key alone cannot use the storage RPC. Every action checks the dedicated capability before looking up a row; the tables have RLS and no direct client grants. No service-role key is needed in the app.

Run `supabase/tests/durable_showcase.sql` to verify capability rejection, table permissions, distributed leases, revision fencing, crash recovery, reset and expiry. Its temporary test key and rows roll back. `tests/durable-showcase.test.ts` verifies cross-worker restoration of state, actor sessions and vault keys, encryption/tamper rejection, isolation, reset and failed-work recovery. Failed snapshot commits never return a success response.

Temporary files use private random directories and are removed after every request. Snapshots are capped at 4 MB, restored databases at 12 MB, incoming requests at 128 KB, and previews at 120 requests/minute and 3,000 requests total. A server crash leaves a lease that can be reclaimed after 90 seconds. Rotating the storage key requires matching the database hash and intentionally resetting incompatible old snapshots.

After deployment, test actual `/demo` journeys and refresh/persona changes. A passing local memory test alone is insufficient to prove serverless persistence.
