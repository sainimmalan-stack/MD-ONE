# Marketplace — Items and Homes

The Community exchange is now presented as Marketplace with two distinct sections. Items retain the existing categories, private enquiries, moderation and household inventory separation. Homes support owner-listed flats for rent or sale.

## Homes

Only authenticated resident accounts with a matching trusted ownership row can publish a flat. Choosing “owner” in a form never grants ownership. Active residents can discover listings across MDP; verified owners retain access even if they no longer occupy their flat. Ownership revocation, deletion and bilateral blocks are checked on every read/action. A transferred flat’s invalid old offer is withdrawn transactionally when its new verified owner lists it.

Listings include project, BHK, square feet, floor, furnishing, parking, availability date, owner-provided description/photos and monthly rent/deposit or sale asking price. Default expiry is 30 days; owners can renew available offers or mark rented/sold/withdrawn. Filters support purpose, project, bedroom count and search; discovery pages are bounded to 24. No real homes are seeded. Demo ownership checks do not imply verification of title documents, property condition or asking price.

Exact flat identifiers/numbers are excluded from public response fields. The owner’s private form offers only flats they own. Home photos accept bounded PNG/JPEG images; the web form resizes and re-encodes photos. No registration documents or government IDs are imported into listing records.

Residents send interest; the owner accepts or declines. Acceptance does not automatically reveal a phone number. Each party separately opts in to sharing a number on that listing. Owner numbers are visible only to accepted eligible residents; applicant numbers are visible only to the owner, never other applicants. Withdrawal, expiry, closure, move-out without ownership, blocks and revoked ownership prevent subsequent contact retrieval. Listing closure removes stored contacts. Removing access cannot retract a number someone has already saved.

Homes and their interest records are separate from item enquiries, grocery stock, delivery slots and maintenance funds. MDP does not collect rent, deposits, purchase payments, commissions or execute agreements. Visits and arrangements happen directly between parties.

## Implementation and verification

- SQLite schema: lib/homes-db.ts; server domain: lib/homes.ts.
- GET/POST /api/homes; GET /api/homes/:id; POST /api/homes/:id/action.
- Eight Homes tests cover verified owner scope, idempotent retries, privacy fields, mutual contact consent, block/move-out/ownership revocation, expiry and terminal statuses, sale/validation and ownership transfer.
- All 64 domain tests passed.
- Production Next.js build and native TypeScript checks passed.
- iOS and Android Hermes bundle exports passed.
- Browser verified tenant discovery without publication controls; owner-only flat options and the rent/sale form differences. No browser test property was published.

This is the localhost demo implementation. Production authentication, verified ownership onboarding, cloud/Postgres schema and audited RPCs, abuse reporting/moderation specific to Homes, retention and notification infrastructure require production work. Renewal is manual; no push reminder is claimed. Existing listing details are changed by withdrawing and publishing a replacement; inline editing is not included. Native bundles were compiled; physical-device UI/signing/store deployment were not verified.
