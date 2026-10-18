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
- Seven schema migrations have been applied. SQL transaction tests use temporary fixtures and roll back all data.

The hosted Daily page reuses the existing premium GroceryStorefront component, original photographic categories, desktop sidebar, mobile identity header and bottom navigation. It displays only connected grocery/account destinations.

## Validation

`supabase/tests/grocery_transactions.sql` passed in the hosted database: price calculation, stock decrement, idempotent receiving/checkout, changed-payload rejection, full-slot rejection, insufficient-stock rollback, membership/staff authorization, cancellation replay, status transitions and cross-user order RLS. Browser basket tests also pass. Production build and TypeScript pass. Phone (390px) dark/light screenshots and a tablet (820px) check were performed; the tablet sidebar transform regression was corrected.

The owner account was created by the user and the explicitly approved platform role was assigned and verified. The user reports successful Chrome sign-in; authenticated Daily, empty order history and owner management forms were verified in the in-app browser. Actual checkout still needs real stock, a verified delivery address and a delivery slot. This is not yet a verified operational grocery launch. Real prices, stock, supplier expiry dates, delivery slots and project coverage are entered in the Manage screen after owner setup.

## Remaining modules

Community, carpool, marketplace/homes, project committee finance, service dispatch, document storage/scan, personal finance and native hosted integration still require production request handlers and end-to-end checks. Existing local demo screens remain in the repository; they do not run as the hosted backend. Unmigrated production API routes fail closed.

Email delivery was not verified. The app now supports password sign-in for provisioned accounts so ordinary sign-in does not depend on SMTP. The sender previously inferred from the builder website is not the user's email and must not be used as the MD One sender. Password recovery and invitation emails require a separately approved sender configuration.
