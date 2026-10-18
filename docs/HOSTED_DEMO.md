# MD One reviewer demo

`/demo` reuses the full existing premium interface and local domain flows. The live sign-in/account page links to it through **Explore the demo**. It requires no resident account, email, password, real flat registration or staff permission changes.

The selector includes Ananya (tenant / Vice President), Kiran (owner / President), non-resident owner, pending resident, project manager, warehouse, two riders, Skylark residents, MDP service desk, trade specialists and platform operations. All identities, flat registers, prices, balances, dispatches, contacts and payment confirmations in this route are synthetic. The seeded project catalogue and official illustration assets are shared visual references, not a real resident directory or service promise.

## Isolation

- `/api/demo/*` is a separate Node route with a per-browser in-memory SQLite database. It does not import or call the Supabase runtime, accept production sessions, create Supabase Auth users or grant real staff roles.
- Synthetic browser/actor cookies are HttpOnly, SameSite Strict, Secure on HTTPS, scoped to `/api/demo`, and distinct from all hosted account cookies. Normal `/api/*` requests still use hosted auth in production; the original local database factory still refuses production mode and local API host checks remain intact.
- A bounded map holds at most 32 active previews per function instance. Sessions expire after 30 minutes idle or two hours total, and can disappear on a serverless restart/scale-out. The UI explicitly explains that temporary state can reset. This is an interface-review sandbox, not durable collaboration, testing storage or a deployment database.
- The **Reset demo** button discards only that visitor's disposable synthetic state. Actor changes within the same warm session share the simulated orders, resident conversations and service jobs, enabling cross-role walkthroughs.
- Each session has a separate temporary vault encryption key using AsyncLocalStorage. No production/local vault key is installed in the preview. The demo accepts only the built-in synthetic text document; actual document, property-proof and photo uploads are blocked in the UI and rejected on the server. No real payment/fulfilment operation is called.
- Basket keys include a random demo-run namespace to prevent an old preview basket from contaminating a new run or a real user's basket. Direct downloads also target `/api/demo`.
- Same-origin mutations, 128 KB payload limits, persona allowlist, per-session rate/lifetime bounds and existing domain authorization/validation apply. Errors after expiry direct reviewers to Reset demo.

For a presentation, open `/demo`, select a sample role, explore Daily / Services / Community / My Project / My Home, then switch to a second role to review the other side of a simulated journey. Keep suggestions in your review process; this change does not email anyone or publish reviewer feedback.

## Account layout fix

The shared logo image now has an intrinsic bounded CSS size, including standalone hosted login/account headers. The account page uses a compact mobile header, a clear return button and a demo link. Platform owners see their existing role without being prompted to invent a flat. Residence registration remains optional for them, starts with **Choose your project**, and counts only active verified non-test memberships via the existing operations-context RPC.

## Verification

- TypeScript and optimized Next webpack build passed.
- 84 domain tests passed, including new synthetic session isolation, lifetime/reset, production guard, overlapping vault-key isolation and media-input rejection tests.
- `scripts/showcase-smoke.mjs` tests the local **production-mode** build: two isolated reviewers, role switching, payload-bound checkout replay, simulated pick/pack/dispatch/delivery/COD confirmation, safe sample document, reset, and denial of demo credentials on the real personal API.
- Browser verification uses the built app on localhost; Vercel status must be checked separately before claiming `/demo` is live. No paid plan, credential or real resident data is created.
