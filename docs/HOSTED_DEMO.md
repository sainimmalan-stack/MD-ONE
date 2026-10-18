# MD One reviewer demo

`/demo` reuses the full existing premium interface and local domain flows. The live sign-in/account page links to it through **Explore the demo**. It requires no resident account, email, password, real flat registration or staff permission changes.

The public selector includes Ananya (tenant / Vice President), Kiran (owner / President), non-resident owner, pending resident and Skylark residents. Additional project support, warehouse, two riders, service desk, specialists and platform personas are visible only to the verified founder. All identities, flat registers, prices, balances, dispatches, contacts and payment confirmations in this route are synthetic. The seeded project catalogue and official illustration assets are shared visual references, not a real resident directory or service promise.

## Isolation

- `/api/demo/*` is a separate Node route with a per-browser in-memory SQLite database. Demo operations run only against synthetic state. Real Supabase session verification is consulted solely to authorize founder-only staff previews; this does not create Auth users, grant staff roles or write real orders.
- Synthetic browser/actor cookies are HttpOnly, SameSite Strict, Secure on HTTPS, scoped to `/api/demo`, and distinct from all hosted account cookies. Normal `/api/*` requests still use hosted auth in production; the original local database factory still refuses production mode and local API host checks remain intact.
- A bounded map holds at most 32 active previews per function instance. Sessions expire after 30 minutes idle or two hours total, and can disappear on a serverless restart/scale-out. The UI explicitly explains that temporary state can reset. This is an interface-review sandbox, not durable collaboration, testing storage or a deployment database.
- The **Reset demo** button discards only that visitor's disposable synthetic state. Actor changes within the same warm session share the simulated orders, resident conversations and service jobs, enabling cross-role walkthroughs.
- Each session has a separate temporary vault encryption key using AsyncLocalStorage. No production/local vault key is installed in the preview. The demo accepts only the built-in synthetic text document; actual document, property-proof and photo uploads are blocked in the UI and rejected on the server. No real payment/fulfilment operation is called.
- Basket keys include a random demo-run namespace to prevent an old preview basket from contaminating a new run or a real user's basket. Direct downloads also target `/api/demo`.
- Same-origin mutations, 128 KB payload limits, persona allowlist, per-session rate/lifetime bounds and existing domain authorization/validation apply. Errors after expiry direct reviewers to Reset demo.

For a presentation, open `/demo`, select a sample role, explore Home shortcuts, Orders, Community and Account, then switch to a second role to review the other side of a simulated journey. Keep suggestions in your review process; this change does not email anyone or publish reviewer feedback.

## Account layout fix

The shared logo image now has an intrinsic bounded CSS size, including standalone hosted login/account headers. The account page uses a compact mobile header, a clear return button and a demo link. Platform owners see their existing role without being prompted to invent a flat. Residence registration remains optional for them, starts with **Choose your project**, and counts only active verified non-test memberships via the existing operations-context RPC.

## Verification

- TypeScript and optimized Next webpack build passed.
- 85 domain tests passed, including new synthetic session isolation, lifetime/reset, production guard, overlapping vault-key isolation and media-input rejection tests.
- `scripts/showcase-smoke.mjs` tests the local **production-mode** build: two isolated reviewers, resident role switching, checkout replay, denial of all nine staff personas without founder authentication (including forged owner flags), safe sample document, reset, and denial of demo credentials on the real personal API. Synthetic fulfilment remains covered by domain tests.
- Browser verification uses the built app on localhost; Vercel status must be checked separately before claiming `/demo` is live. No paid plan, credential or real resident data is created.

## Founder-only operations previews

Real staff access was audited on 19 October 2026: one platform staff account, belonging to the founder, and zero other staff accounts. No real role grants or revocations were needed.

The public demo picker exposes resident/owner/committee sample identities. Project support, warehouse/delivery, home service and platform sample identities require the existing founder UUID configured in the server-only `MD_ONE_FOUNDER_USER_ID` environment variable and a current `platform` role, verified through the real hosted session. Email strings, client flags and synthetic cookies do not authorize operations previews. The server checks both staff sign-in and subsequent requests, so a previous synthetic staff session does not retain access after real authentication expires or the role is revoked.

A local preview without hosted Supabase authentication intentionally cannot unlock founder-only staff views. The anonymous smoke script verifies denial of all nine staff personas and resident checkout/isolation. Domain tests continue to cover synthetic fulfilment. Deploy this complete revision after the Vercel limit resets, then explicitly remove the stable rollback/promote the verified release. Until that deployment, the existing public demo retains its previous sample-persona behavior; its operational records are synthetic.
