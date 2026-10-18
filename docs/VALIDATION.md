# Validation — 18 October 2026

Passed on this computer:

- Web TypeScript check (`tsc --noEmit`).
- Native TypeScript check (`tsc --noEmit -p mobile/tsconfig.json`).
- 53 domain tests (`node --experimental-transform-types --test tests/*.test.ts`).
- Optimized Next.js web build (`next build --webpack`), including static pages and dynamic API.
- Expo/Hermes JavaScript exports for Android and iOS. These are bundles, not signed installs or device UI tests.
- Local SQLite online backup command completed, preserving the matching demo vault key.

## Browser journeys actually exercised

1. Resident added milk, selected a slot, placed a synthetic COD order. Warehouse picked, packed, dispatched to EV-01; assigned rider confirmed `123456`; resident order persisted as delivered/COD collected.
2. Completed/ongoing project explorer loaded all 19 official catalog records. Skylark opened with sourced G+5, 15 residences, 2023, 2/3 BHK and source/plan links.
3. Skylark → synthetic flat 102 → Aditya’s locked profile. Occupation/contact/posts hidden; resident sent a friend request. Aditya received and accepted. Returning as Ananya showed UX designer and bio while contact remained private.
4. Resident submitted a tile request. MDP service desk assigned the trade-matched specialist. Suresh's technician persona saw the assigned job and progressed it through en route, in progress, completed.
5. Final dark home visually inspected at desktop preview width. New screenshots are under `outputs/screenshots/`.

## Automated coverage

Sessions and role separation, stock transaction rollback, checkout idempotency, expiry/FEFO, cancellation freshness, two-bike capacity, correct rider and delivery confirmation, move-out revocation, project scope, opt-in events, seat allocation, real two-connection inventory/seat races, vault encryption/quarantine/sharing/revocation, EMI/prepayment, and fail-closed production mode.

Social/service coverage: private profile redaction, recipient-only friend acceptance, private contact even with friendship, unfriend access revocation, directory/network consent, mutual block visibility, post audience enforcement for likes/comments, lock revocation of old posts, moved-out resident denial, sourced counts vs synthetic register, owner requests for ongoing project, pending-member denial, trade matching, assigned-only technician access, double-book prevention, strict service state transitions, image format rejection and scoped moderation.

## Verification limits

No live Supabase/Postgres project, RLS execution, real OTP/MFA, gateway payment/refund/webhook, malware scanner, push provider, mapping, physical device, emulator UI, signed app build, store submission, operational pilot, or real resident import has been exercised. Full Telugu translation and an accessibility audit are still required. The UI marks demo data and unconfigured services explicitly.

## Build boundary correction

Local vault key initialization is in `scripts/init-demo.mjs`, outside bundled app code. The runtime reads an unexposed server environment key; generated `.env.local` and `.local` remain ignored. This avoids tracing local dependency caches and private key files into the server package. Build tracing excludes local state, mobile dependencies, scratch files, screenshots and environment files. No real credentials were supplied or printed.

## Governance / Exchange validation

16 new domain tests cover numeric collisions/ID preservation, cross-project committee read/write denial, appointment-admin financial denial, no self-elevation, acceptance and distinct positions, immediate revoke/expiry (including a revoked uploader’s linked bill originals), duplicate billing, immutable move-out liability, pending proof/independent verification, payment retry/reference deduplication, partial payments/advance allocation, opening cash/dues/reserve calculations, accrual versus cash, immutable closed statements, current-period signed vendor corrections, attachment ownership/project boundaries, ordinary-member redacted transparency, private Q&A and FAQ consent, independent expense approval, unique completed MDP-service expense linking, listing audiences/participant boundaries/profile locks, mutual blocks/expiry, grocery independence, payload-bound retries, image rejection and pagination, same-project reserve conservation, and verified multi-project owner selection. All existing 32 tests remain passing.

Browser QA exercised Nest draft → review → publish, own 101 bill, vendor bill entry with a synthetic utility invoice, pending approval state, Exchange catalogue, persisted listing enquiry, private committee question/reply and status-history screens. Screenshots are in `outputs/community/`. No real funds were moved and no real committee appointments were made.

Both TypeScript projects, optimized webpack build, and Android/iOS Hermes exports passed. Exports are in ignored `work/mobile-community-export`. PostgreSQL RLS migration has not been applied or integration-tested against a configured Supabase instance. Native device UI and signing are not tested.

## Grocery-first pilot validation

Five new tests check the 76-SKU plan totals exactly ₹3 lakh using unit price × monthly units; category totals; short-life opening cover; 130-family/75-buyer/basket arithmetic; gross margin, operating costs and break-even; idempotent zero-stock assortment migration; preserved existing pricing/batches/stock; privileged cost-confirmed receiving before a proposed product can be checked out; expiry-aware customer stock; and operator-only access with no fabricated sales.

Web and native TypeScript, optimized Next.js webpack build, and Android/iOS Hermes exports passed for the grocery-first version. Native exports are in ignored `work/mobile-daily-export`. The new storefront was visually checked in the local browser; physical-device validation remains outstanding. Production SQL migration 004 was not executed. No real procurement, delivery, payment, supplier price verification or cold-chain setup is claimed.
