# Release preparation and blockers

The local demo is not safe to expose as a real residential/financial document service. Production startup is intentionally blocked. Do not disable that block to publish the demo. Complete the runtime adapter and verify it first.

## Required configuration and engineering

- Create an MDP-owned Supabase staging project; apply and verify migration in `supabase/migrations`. No production project has been created or modified here.
- Implement Supabase identity/session runtime and audited privileged operations; current Next APIs use SQLite and demo identities. SQL includes only initial seat-approval/RSVP RPCs; checkout, invitations, move-outs, staff operations, vault sharing and deletion still need production implementations.
- Verify row isolation with owner, tenant, association, warehouse, driver, support and platform JWTs. Test move-outs and expired shares at the database and storage boundaries. Do not trust claims from the client body.
- Add real OTP and MFA/challenge provider, resident invitation/register flow, recovery, throttling, authorized staff provisioning, household membership and actual address verification.
- Implement checkout payment provider and raw-body signature verification, deduplicated webhook processing and refund lifecycle; add tests for duplicate events, amount/order mismatch, replay and partial refund ceilings.
- Connect private cloud storage, quarantine scanner and server-signed short-lived downloads. Check ownership/recipient/expiry/MFA for every link issuance. Key rotation, TLS and cloud encryption need operational configuration.
- Wire jobs to an authenticated worker with leasing, retries, dead-letter queue, notification preferences, and redacted templates. Current `jobs` table records blocked scanning jobs only.
- Configure maps/service polygon, actual rider travel capacity, slots, battery and shift rules. Never infer coordinates from project names.
- Finish missing features and language/device accessibility gaps listed in FEATURE_STATUS.md. Full resident, admin and rider integration tests on staging are required.
- Finalize actual operator identity, privacy/support contacts, consent texts, retention policy, processor contracts, security review, incident response, backups/restore drill and operational prerequisites applicable to the business.

## Android / iOS

Official references verified for this work:

- https://docs.expo.dev/build/introduction/
- https://docs.expo.dev/deploy/submit-to-app-stores/

Native project uses Expo SDK 58, React Native 0.88 and platform identifiers `in.mydreamprojects.living`. Confirm MDP owns those identifiers before registering them. There is no EAS project ID or store account credential in this checkout.

Once the production adapter is ready:

1. Use an MDP-owned Expo account and initialize EAS project identity. Set a real HTTPS API URL and separate staging/production environments.
2. Verify every Expo dependency with `npx expo install --check`; use compatible development builds. Verify native behavior on actual Android and iOS devices.
3. Configure App Store Connect and Google Play developer accounts, signing, bundle/package identifiers, app icons, splash screens, versioning and secrets.
4. Build with `eas build --platform all --profile production`; test resulting signed builds through internal testing/TestFlight before submission.
5. Provide an actual privacy-policy URL, support URL, screenshots, content rating, App Privacy/Data Safety disclosures consistent with final providers, account-deletion flow and reviewer access for the private membership model.
6. Configure EAS Submit credentials through secure account tooling and submit reviewed builds. Store approval is external and has not happened.

EAS files here are templates only. They do not create accounts, upload builds, accept agreements or publish anything. Review export-encryption declarations against final dependencies and actual app behavior before submission.

## Draft store copy

Name: MDP Living
Short description: Everyday essentials and community life for My Dream Projects residents.

Description: MDP Living brings the everyday life of your My Dream Projects community into one private space. Connect with neighbours, discover resident events, organise household spending and home documents, and access services enabled for your residential project. Eligibility, grocery delivery, carpooling and maintenance availability vary by verified community. Membership approval is required.

Do not advertise a feature in final store copy until it works in the signed production build. Do not claim Hyderabad's first, guaranteed delivery speed, lender approval, government integration or guaranteed savings.

## Governance / Exchange release requirements

Apply all three schema migrations to isolated staging first. Verify JWT tests for each project, an appointment administrator with no membership, an ordinary member, each committee position, a revoked/expired representative and blocked/expired marketplace participants. The new SQL is a read-policy foundation with privileged writes denied; implement audited server transactions/RPCs before allowing production mutations. Production settings and raw period snapshots remain committee-only; residents consume dedicated published projections and their own published invoices.

Import only an authorized flat register. Review the numeric collision report and retain stable IDs. Do not resolve collisions by merging households. Back up SQLite and its matching vault key before local migration; `work/pre-exchange-governance-backup` was created during this extension. Production backups need a verified restore exercise.

Verify each owner/tenant relationship, frozen payer liability, committee invitation/acceptance/term, project policy and actual bank destination independently. Local synthetic committee examples must never become production appointments. Do not publish real balances/approvals from demo scenarios. Payment screenshots need manual project-record verification; configure gateway settlement to the individual project if added later.

Cloud bill/proof/exchange assets need private buckets, scanning, membership/participant checks before issuing short-lived URLs, retention and key rotation. Raw originals stay committee/owner-only; resident copies require explicit redaction. Notifications currently use published in-app notices and refresh; no push/email/SMS provider is configured. Native advanced administrative/export/attachment features are web-only, as listed in FEATURE_STATUS.

## Grocery-first pilot

The 76-product range and ₹3 lakh monthly volumes are a proposed sales mix. Source actual supplier SKUs, brands, labels, pack sizes, landed buying costs and selling prices before importing production catalog data. No real supplier terms or inventory have been purchased or confirmed. Validate 130-family demand and the proposed 75 regular buyers before treating the sales target as a forecast.

Migration `202610180004_daily_assortment.sql` keeps storefront assortment metadata separate from private operator demand targets. It seeds no products, prices, suppliers, stock or service coverage. Production receiving and checkout RPCs must validate stocked status, pricing, expiry, serviceability and capacity. Apply/test RLS on staging; it has not been executed on live Supabase.

Confirm food/non-food storage separation, supplier-specific chilled/fresh handling, real replenishment schedules and loss tracking before launch. Add actual product photography/labels to replace illustrative packs. The cost calculator is an explicitly assumed model, not accounts or a net-profit forecast. Existing local-only authentication, payments, notifications and store-release blockers remain.
