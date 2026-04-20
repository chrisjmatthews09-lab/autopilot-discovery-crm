# migrate-dedup-fields

**How to run:** open the app, go to **Settings → Dedup Fields**, click **Backfill dedup fields**.

## Why no CLI script?

This repo uses the Firebase **client SDK** only — there is no `firebase-admin`
dependency and no service-account key is provisioned. All Firestore data lives
under `users/{uid}/...`, so every write must be authenticated as the owner.

The existing migration pattern (see `src/data/migrate.js`) is to expose
idempotent `migrate*` functions and fire them from a Settings button while the
user is signed in. This file follows that pattern:

- Logic: [src/data/migrate.js](../src/data/migrate.js) → `migrateDedupFields()`
- Trigger: [src/pages/Settings.jsx](../src/pages/Settings.jsx) → `DedupBackfillSection`
- Normalization helpers: [src/lib/dedup/normalize.js](../src/lib/dedup/normalize.js)

## What it does

Reads every doc in `people`, `companies`, and `interviews`, then writes an
additive patch with the fields documented in
[src/data/schemas.js](../src/data/schemas.js):

- **people:** `emailNormalized`, `fullNameNormalized`, `phoneNormalized`,
  `sourceType`, `mergedFromContactIds`, `dedupReviewStatus`, `interviewIds`,
  `callIds`, `noteIds`, `enrichmentHistory`
- **companies:** `nameNormalized`, `sourceType`, `mergedFromBusinessIds`,
  `contactIds` (derived from `people.company_id` refs), `primaryContactId`,
  `enrichmentHistory`
- **interviews:** `extractedEntity`, `dedupResolution`, `sourceIngestionJobId`

No existing fields are renamed or deleted. Re-running is safe — rows whose
fields already match the computed patch are skipped.

Progress logs land in the browser console with the `[dedup-migration]` prefix.

## Rollback

The changes are additive. To undo, delete the new fields in the Firebase
console (or run a targeted unset via the Settings UI — not implemented) and
clear the localStorage key `autopilot-dedup-backfill-v1` to re-enable the flag.

## CLI alternative (if ever needed)

If a headless migration is ever required:

1. Add `firebase-admin` as a dev dependency.
2. Provision a service-account JSON key (restricted to this project).
3. Port `migrateDedupFields` to use `firebase-admin` — it accepts the same
   collection names and will hit the same physical docs under
   `users/{uid}/{collection}`.
4. Invoke from `node scripts/migrate-dedup-fields.js <uid>`.

Not implemented today — the in-browser path is the supported one.
