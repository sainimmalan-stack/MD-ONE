# MD One hosted My Home

The authenticated web shell now opens a personal workspace from My Home, preserving the existing premium document and finance layouts. Account/residence setup remains available from the avatar and an Account & residence link. Personal records do not require a project membership and never inherit committee/platform privileges.

## Data and access

Migrations 021–022 add a JWT-authenticated, owner-scoped `personal_api` RPC and recoverable archive timestamps. Public metadata tables retain their own-user RLS. Raw finance writes are revoked; validated writes and downloads use the same owner check regardless of staff role. Private file bytes and request receipts have RLS enabled and no client table grants. Files use private PostgreSQL byte storage in Supabase for this bounded pilot, not public Storage objects or service-role credentials. The infrastructure account administrator still controls the underlying database; this is not end-to-end encryption.

The authenticated BFF uses the existing HttpOnly cookie session, same-origin mutation checks, private/no-store responses and bounded payloads. Mutations use per-user request UUIDs bound to a SHA-256 payload hash, serialized writes, and audit events without document contents or finance descriptions. Browser retry storage contains only opaque request IDs indexed by payload digests, not personal records.

## Documents

- Owner-only upload, search by name/folder, download, archive and restore.
- PDF/JPEG/PNG inputs, 2 MB per file, 100 retained documents and 20 MB total including Trash.
- Images uploaded through the app are decoded, metadata removed, bounded to 4096 pixels and re-encoded as JPEG. Original image bytes are not retained; users should keep originals separately.
- Files remain marked quarantined, never malware-scanned/clean. PDFs are explicitly labelled unscanned and are never rendered inline or shared. Downloads are owner-authenticated, attachment-only application/octet-stream, nosniff and sandboxed. There is no public/signed bearer link or sharing control.
- No fake vault-unlock, demo encryption, MFA or bank verification claims. Malware scanning, original-image archival, granular document sharing, permanent erasure, retention jobs and account-wide export/deletion remain separate work. Trash is reversible and does not free the pilot capacity.

## Personal ledger and loans

- Private income/expense entries, INR paise, category/date validation, current IST-month summaries, recoverable archive, CSV export with formula-prefix escaping. Capacity is 2,000 retained entries.
- Up to 200 retained loans, fixed annual-rate estimate, due day, EMI and reducing-balance schedule. The schedule is an estimate from original principal, not a bank balance.
- One manually entered monthly total per loan/month. Re-entering the month intentionally corrects its total; retries cannot double-record it. Future-month payments and payments to archived/other-user loans are denied. All payments remain `user_marked`.
- Calculator supports zero-interest loans and recurring extra payments reducing tenure; estimates exclude lender fees and rate changes.
- Archive/restore loans together with their payment histories. No bank transfer, lending application, bank verification, autopay or automatic reminder is performed.

## Verification

`tests/personal-home.test.ts`: format spoofing, size limits, corrupt images, image metadata removal and bounds, preserved unscanned PDF bytes, zero-rate EMI, reducing balance, prepayment and invalid inputs.

`supabase/tests/personal_home_flows.sql`: synthetic users and records in a rolled-back transaction; owner/platform isolation, anonymous denial, payload-bound replay, amount/date validation, monthly correction, future-month denial, archived-loan protection, quarantined state, owner-only download, archive/restore, RLS and raw ACL checks.

TypeScript and optimized Next webpack build passed. Hosted SQL regression returned PASS. Live deployment and browser verification are recorded in the task's final response; no signed native release is implied.
