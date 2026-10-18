# MDP Living

A private everyday ecosystem for My Dream Projects residents, now led by **MDP Daily**, a grocery-first storefront, alongside resident Exchange, independently managed project accounts, social life and MDP Insta Services. This checkout contains a working **local demo**, a native Expo client, and a Supabase production schema foundation. It is not a launched grocery business or a production-ready identity/document service.

## Run the local app

Node.js 24 LTS is required (uses built-in `node:sqlite`). With Node and pnpm on your PATH:

```sh
pnpm install
pnpm dev
```

On this computer, Node is bundled with Codex. With dependencies already installed, simply run:

```sh
./scripts/dev.sh
```

Open http://localhost:3000. Data persists in `.local/mdp.sqlite`. `scripts/init-demo.mjs` preserves the local key in `.local/vault.key` and initializes the unexposed server variable in ignored `.env.local`. All are ignored by Git. Run the init script before direct `next dev` or `next start` commands. Keep this demo loopback-only. Do not use real personal information. `MDP_MODE=production` deliberately refuses to initialize the demo database.

## MDP Daily: the monetization pilot

Resident Home now leads with grocery discovery, stocked categories, search and cart controls. A balanced 76-SKU proposed range totals ₹3 lakh/month in planned merchandise sales. Warehouse/platform → Daily retail plan shows the product list, monthly unit targets, category mix, opening cover, CSV export and an editable cost scenario. The 130-family market, buying volumes and prices are assumptions—not actual customer spending or verified supplier quotes. 62 proposed items start with zero stock; receiving requires confirmed cost/selling price, supplier and expiry.

See outputs/grocery/MDP-Daily-plan.md and the full CSV for the product plan. Existing residents, project tools, groceries, rides, social profiles, Exchange, vault and personal finances remain separate.

## Try the complete grocery journey

1. Explore as **Ananya · Resident**. Add essentials and place a demo cash-on-delivery order.
2. Choose **Warehouse team** in the top demo selector. Start picking, mark packed, and dispatch to Arjun / EV-01 or Meera / EV-02.
3. Choose that delivery persona. Complete the order with demo confirmation code `123456`.
4. Return to the resident's My orders. Status and payment state persist across refreshes.

There is one synthetic warehouse, exactly two electric bikes and two delivery staff. Slot capacity is three orders per available rider; an active rider may carry at most three deliveries. Charging/off-shift/low-range bikes are unavailable. No location tracking or real delivery-time promise is fabricated.

## Other working journeys

- **Carpool:** Ananya requests Kiran's ride; switch to Kiran to accept. Seats update atomically. Offer individual rides from the web UI.
- **Community:** Join/leave a demo event; post a message; report a post; association manager can hide reported posts. Network-wide events require opt-in under Profile.
- **Documents:** Unlock demo vault for five minutes, add a synthetic sample, download, create expiring access for a demo neighbour, revoke shares, delete. PDF/JPG/PNG files are encrypted and quarantined; scanning is not connected. No real MFA.
- **Money:** Record private expenses/income, export CSV, add loans, record user-marked payments, calculate EMI/prepayment and inspect amortization.
- **Project committee:** Open My Project for policy-based monthly billing, own dues, project accounts, common bills, notices, meetings, assets and private questions. Nest’s Kiran/Ananya committee is synthetic; platform appointments confer no account access. Previous requests and dues remain in My Home history.
- **Exchange:** Create a listing, choose project or explicit MDP-wide audience, save a find and start a private persisted enquiry. Listings never use grocery stock or dispatch.
- **MDP Insta Services:** Request a specialist from Services; assigned technician tracks the work separately from committee help.
- **Membership:** Association manager approves/rejects pending residents or expires active residence. Non-resident owner can manage tenant memberships of owned flats without seeing tenant finance/documents.
- **Privacy:** Personal account export, document deletion, account deletion, notification preference and network consent. Draft `/privacy` and `/support` pages included.

Synthetic people and flat labels are separate from verified project names. Official project completion never automatically enables a service. Demo delivery is enabled only for Nest as a simulation, not as a claim about actual service coverage.

## Android and iOS source

```sh
cd mobile
pnpm install
pnpm start
```

Use a compatible development build / simulator. iOS simulator can reach `http://localhost:3000`. Android emulator needs `adb reverse tcp:3000 tcp:3000` so its localhost reaches this computer. Physical devices and public hosts need a real HTTPS production backend, not relaxed demo host checks.

The native app supports home, basket/checkout/orders, ride requests, event RSVPs, community posts, expenses, EMI, service tickets, document metadata and preferences. Web-only advanced controls are explicitly noted in the native UI. Native code has been typechecked and bundled for both platforms; no simulator UI or signed device build is claimed.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm build
cd mobile
pnpm typecheck
npx expo export --platform ios --platform android
```

Meaningful domain tests include real multi-connection inventory/seat races, order idempotency, role isolation, tenant revocation, expiry, quarantine, confirmation and EMI mathematics. See `docs/VALIDATION.md` for actual results.

## Architecture and release boundaries

- `app/`: responsive Next.js resident, admin, and rider UI and scoped API handlers.
- `lib/`: transactional domain service, demo data, finance logic, private encryption, provider interfaces.
- `mobile/`: Expo / React Native iOS and Android client with SecureStore session tokens.
- `supabase/migrations/`: PostgreSQL/RLS foundation; not yet connected to runtime.
- `docs/`: architecture, source ledger, operations, production gaps and release preparation.
- `outputs/screenshots/`: browser verification captures.

Read `docs/RELEASE.md` and `docs/FEATURE_STATUS.md` before considering deployment. OTP, gateway payments/refunds, malware scanning, push jobs, mapping, full Telugu localization, recurring automation, and production onboarding remain integration work. Missing providers never report success.

## Backup and restore

```sh
node --experimental-transform-types scripts/backup.ts /absolute/private/backup-directory
```

The backup uses SQLite's online backup API and includes the matching local encryption key. To restore: stop the server, preserve the current `.local` directory, copy the backup database to `.local/mdp.sqlite` and key to `.local/vault.key`, set key permissions to 600, remove stale WAL/SHM only after all database connections are closed, then restart. Test restoration on a copy before replacing useful data. A database without its key cannot recover vault contents.

## Explore the social experience

- Open **Our 19 addresses → My Dream Skylark → DEMO 102 → Aditya Varma**. Send a friend request. Switch to **Aditya · Skylark 102 → Your circle → My connections** to accept. A locked profile hides its photo, occupation, contact and posts until accepted; contact still obeys its separate visibility choice.
- In **My profile → Edit profile & privacy**, upload a picture, add occupation/bio/contact, choose directory/network discovery, and lock the profile. New profiles default to private; demo profiles have explicit synthetic visibility settings.
- In **Your circle**, share text/photo moments with your project, friends or the opted-in MDP network; like and comment on permitted posts. Profiles/post access is revoked after blocking, unfriend and move-out as appropriate.
- **Insta services → Tiles & stone**: submit a demo repair request. Switch to **MDP Service Desk** and assign Suresh. Switch to **Suresh · Tiles** and progress through journey, arrival/work, completion. Resident sees the same timeline. Actual dispatch, staffing, quotations and service coverage require MDP setup.
- **Association manager / Platform operations → Community moderation** reviews reports within scope without reading private contacts or locked profiles.

The native client includes dark social/project/service screens and Expo's photo picker. Native staff dispatch and some advanced moderation/comments remain web-only. All project metadata links back to official MDP sources; real flat registers and resident identities must come from authorized MDP data or the residents themselves.
