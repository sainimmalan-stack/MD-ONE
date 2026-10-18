# Hosted backend integration status

Supabase: `dvhxdtrtyqrulxitjxab` (Mumbai). Vercel: `md-one/emd1`.
Production uses `MDP_MODE=production` and `NEXT_PUBLIC_HOSTED_AUTH=true`.

## Connected grocery release

- Email/password sign-in uses Supabase Auth; verified user tokens are held in Secure, HttpOnly cookies. New account passwords are set by the account owner in Supabase, never in source code.
- Authenticated catalogue, verified delivery addresses, delivery slots, order history and order item snapshots load from PostgreSQL.
- Checkout calculates current prices on the server, verifies approved residence and coverage, locks slot/product/batch rows, reserves fresh stock by earliest expiry, and commits the order atomically.
- A durable per-user/per-flat basket keeps a pending checkout key; retries return the same order. Payload changes with that key are rejected.
- Cancellation restores stock once. Warehouse status transitions enforce picking, packing, dispatch and delivery in order. Delivery completion explicitly confirms cash collection.
- Warehouse controls receive supplier stock, set selling prices and open delivery slots. Platform controls manage project coverage and review residence requests with the applicant identity.
- No live supplier stock, delivery capacity, resident membership, or staff role is invented. Operators must enter actual operating details.
- Twenty schema migrations have been applied. SQL transaction tests use temporary fixtures and roll back all data.

The hosted Daily page reuses the existing premium GroceryStorefront component, original photographic categories, desktop sidebar, mobile identity header and bottom navigation. It now also links to the original premium Community, Carpool and Marketplace components.

## Validation

`supabase/tests/grocery_transactions.sql` passed in the hosted database: price calculation, stock decrement, idempotent receiving/checkout, changed-payload rejection, full-slot rejection, insufficient-stock rollback, membership/staff authorization, cancellation replay, status transitions and cross-user order RLS. Browser basket tests also pass. Production build and TypeScript pass. Phone (390px) dark/light screenshots and a tablet (820px) check were performed; the tablet sidebar transform regression was corrected.

The owner account was created by the user and the explicitly approved platform role was assigned and verified. The user reports successful Chrome sign-in; authenticated Daily, empty order history and owner management forms were verified in the in-app browser. The isolated test checkout was completed through the live UI. Real fulfilment still requires real stock, approved selling prices, a verified residence and delivery capacity. This is not yet a verified operational grocery launch. Real prices, stock, supplier expiry dates, delivery slots and project coverage are entered in the Manage screen after owner setup.

## Remaining modules

Personal document vault/scan, personal finance and native hosted integration still require production request handlers and end-to-end checks. Hosted cultural-event management, push notifications, moderation dashboard and route/geospatial matching are separate follow-up work. Existing local demo screens remain in the repository; they do not run as the hosted backend. Unmigrated production API routes fail closed.

Email delivery was not verified. The app now supports password sign-in for provisioned accounts so ordinary sign-in does not depend on SMTP. The sender previously inferred from the builder website is not the user's email and must not be used as the MD One sender. Password recovery and invitation emails require a separately approved sender configuration.

## Completed hosted test on 2026-10-18

- Added 76 pilot catalogue products with the existing demand-plan prices; prices are explicitly labelled pilot values. These products have no simulated live stock and remain unavailable for live purchase until receiving confirms price and inventory.
- Added 10 operator-only test products with 20 simulated units each, a clearly marked test address and a test delivery slot. Test checkout is available through operator permissions and confers no real resident/community access.
- Live UI order `39849a0d` (prefix), ₹164: 2 × toned milk (₹30 each), 1 × eggs (₹54), 1 × whole wheat bread (₹50).
- Verified basket restoration after reload, placement, picking, packed, out for delivery, delivered, and order/timeline persistence after refresh.
- Stock after placement: milk 18, eggs 19, bread 19. Five order events persisted. Payment remains `test_no_payment`; no actual cash, gateway charge, rider journey or physical delivery occurred.
- SQL isolation/regression tests passed, including test/live mixing rejection, operator-only test visibility and test delivery without an approved real residence.

The retained test order is visible to operators in Order desk. Test records are labelled and segregated; they must be excluded from real sales and fulfilment reporting.

## Hosted community, carpool and marketplace

Migrations 011–013 connect the original premium web components through authenticated `community_api` SQL projections/actions. User JWTs authorize every request; no service role key is used. Real active residence gates social posting, friends, carpool and item trading. Platform ownership confers no invented residential identity. A non-resident verified property owner can list their registered home. Founder accounts can preview the premium screens without fabricating a flat.

- Community: editable name, profile privacy, occupation, contact visibility, text/photo posts, likes/comments, discovery, incoming/outgoing friend requests, blocks and private reports. Locked profiles hide their details, photos, flat and posts until accepted. Contact visibility remains separate.
- Carpool: area/date search, offers, pending/accepted connections, atomic seat allocation, rejection, cancellation, withdrawal and optional phone sharing after mutual acceptance. No ride chat, fares, payment processing, dispatch, route matching or live tracking.
- Items: drafts/publishing/editing/status, filters, explicit project or network audience, photo listings, saved items, private enquiries/messages and reporting. No grocery inventory or delivery coupling.
- Homes: verified-ownership rent/sale listings, photo galleries, filtering, own listings, interest acceptance/decline/withdrawal, optional phone consent/revocation, 30-day expiry/renewal and rented/sold/withdrawn status. Exact flat numbers remain private.
- Images: bounded JPEG/PNG uploads in a private database table for this small pilot, served through a no-cache, JWT-authorized image proxy. Raw media/contact tables have no client privileges. There are no permanent public image URLs. Object-storage migration/thumbnail processing is future scaling work. No government IDs belong in social/listing media.
- Data refresh: community refreshes every 30 seconds, manual refresh is available, private item messages refresh every 6 seconds while open. These are polling, not a claimed WebSocket/notification service.

`supabase/tests/community_flows.sql` passed against hosted PostgreSQL with rollback-only simulated identities: locked profile/media authorization (including foreign image-reference rejection), accepted friendship, feed interactions, seat replay and overbooking rejection, optional phone disclosure and withdrawal, listing/message deduplication, private enquiry isolation, home ownership, hidden home flat IDs, home phone consent/revocation and blocked/unverified access. No synthetic resident/community records are retained. Production TypeScript and build pass. Resident browser journeys cannot be claimed against the founder's account without a real verified residence; database multi-actor tests cover those contracts.

Reports persist in the private social/exchange/community report tables for review through the Supabase administration environment. The founder's existing account remains platform owner without an active real residence. The earlier expired grocery-test membership does not unlock community.

## Hosted My Project and Insta Services

Migrations 014–020 connect the existing premium MyProject, AppointmentDesk, InstaServices and ServiceDesk components. Navigation stays at five resident destinations: Daily, Services, Community, My Project and My Home; Marketplace and Carpool remain prominent inside Community. Operator Store desk and page-specific administration are separate.

Project finance is controlled only by an active, eligible President/VP for the particular project. Platform appointment authority does not confer project-finance or private-attachment access. Invitations require the nominee's acceptance before platform activation; self-appointment, duplicate live positions and expired/non-eligible committee actions are rejected. The founder remains platform owner without an invented residence or committee appointment.

Connected maintenance flows: approved fixed/verified-area policy, explicit flat-payer register, draft/review/published/closed monthly billing, itemized private dues, proof submission/rejection/re-submission, independent receipt verification, advance allocation, versioned invoice/vendor corrections, watchman/electricity/diesel/repair/vendor bills, independent bill review, partial/full settlement records, fund transfers, account summaries/CSV/annual export, immutable closed statements, private/project questions/replies/status/assignment, notices, meetings, assets/renewals, budgets, polls, FAQ consent/redaction and history. Financial requests serialize per project, critical writes preserve retry keys and reject changed payloads. These are records of actual off-app project transactions; MD One does not collect maintenance money or transfer it.

Bill/proof images are decoded, resized and stripped to bounded RGB pixels, held in a private database table and re-encoded as JPEG only after project/owner/publication checks. A separate redacted image is visible to residents only after bill approval and period publication. Original vendor files and other residents' proofs stay private to their committee. PDFs are accepted into quarantine and cannot be downloaded/published until a real file scanner is integrated. No malware-scanning success is fabricated. Pixel-backed storage is a bounded pilot implementation; object storage and operational retention are scaling work.

Insta Services: eight original specialist categories, explicit project/trade coverage, resident-flat eligibility, durable request keys, trade/on-shift availability, one active job per technician, assigned-technician-only sequential progress, cancellation before travel and persistent five-stage history. A moved-out resident cannot receive a new assignment at their old flat. Founder service setup registers an existing provisioned staff account as a technician, manages availability/trade and opens/pauses coverage. No actual staff, coverage, charges or dispatch has been seeded. Staff set their own sign-in credentials; the founder's platform role cannot be replaced through technician setup.

Validation: `supabase/tests/project_services_flows.sql` uses rollback-only simulated representatives, residents, projects/flat entries and a technician. It checks appointment consent/isolation, published/private bills, financial retries, independent verification, accounting identity, immutable close, rejected proof recovery, image/proof access, private questions, poll validation/votes, expired committee rights, service coverage/idempotency/double booking and assigned job stages/move-out. `tests/project-image.test.ts` verifies disguised SVG/type rejection, size limits, resizing and metadata-free raster output. Production build and dependency lockfile policy checks passed. Real resident/committee/technician browser workflows require those actual accounts and verified appointments; the founder preview is not represented as a resident simulation.
