# Dedup Threshold Calibration

*Last reviewed: 2026-04-19 (Sprint 10)*

## Current thresholds

Defined in [`src/lib/dedup/matcher.js`](../src/lib/dedup/matcher.js) and
[`src/services/ingestionService.js`](../src/services/ingestionService.js).

| Tier                          | Trigger                                    | Outcome                     |
| ----------------------------- | ------------------------------------------ | --------------------------- |
| tier1_email                   | exact email (case-insensitive)             | auto-attach                 |
| tier2_name_business (person)  | nameMatch ≥ 90 AND businessMatch ≥ 85      | auto-attach                 |
| tier3_review (person)         | nameMatch ≥ 80 AND businessMatch ≥ 70      | manual review queue         |
| — (person)                    | anything below                             | create new                  |
| tier2_name_business (company) | businessMatch ≥ 90                         | auto-link interview/person  |
| tier3_review (company)        | businessMatch ≥ 85                         | review                      |

Weighting for the combined person confidence: `0.6 * nameMatch + 0.4 * businessMatch`.

## Why these values

These were chosen ahead of live data based on the PRD's qualitative
requirements: tight enough that a typo like "Jon" vs "John" at the same firm
doesn't create a duplicate, loose enough that a pure name collision (two
Johns at different firms) doesn't silently merge.

The 90/85 pair came from the Levenshtein similarity of one-letter diffs on
common short names + LLC-suffix-stripped business names:

- `"john smith" ↔ "jon smith"` → 89% similarity (one char in 10).
- `"acme construction" ↔ "acme construction llc"` after business-suffix
  stripping → 100%.

## How this was validated (Sprint 10)

Two check-in tools live in `scripts/`:

1. **`scripts/test-dedup-matrix.js`** — runs the PRD §9 test matrix
   (T1-T6, E1-E10, F1-F5). Pure. Must stay at 0 failures.
2. **`scripts/run-transcript-fixtures.js`** — runs ten pre-extracted
   transcript snapshots covering all regression scenarios from PRD §9.4.
   Must stay at 0 failures.

Both are safe to run in CI and have no Firestore/Claude dependencies.

At the time of writing, 21/21 matrix cases pass (6 are documented skips
that belong to the extraction or data layer) and 10/10 fixtures pass.

## When to recalibrate

Recalibrate if any of these become true:

- **Too aggressive (false auto-attach):** merges are showing up in
  Settings → Recently merged being undone. Raise to 95/90 for person
  tier2 and re-run the matrix.
- **Too conservative (too many dupes):** Settings → dedup health check
  surfaces genuine duplicate pairs that weren't caught. Lower person
  tier2 to 85/80 and re-run the matrix.
- **Review queue growing uncontrollably:** tier3 bands (80/70) are
  matching too much. Raise to 85/75 so more cases are routed to
  auto-create-new instead.

## How to recalibrate

1. Collect a month of live ingestion. Pull `confidence` distribution from
   Firestore `reviews` (manual review decisions) and `dedupResolution`
   on `interviews`.
2. Plot the histogram. Look for the gap between the true-match cluster
   (usually 90-100) and the ambiguous middle.
3. Move the tier2 threshold into the gap.
4. Re-run `node scripts/test-dedup-matrix.js` and
   `node scripts/run-transcript-fixtures.js` — both must remain at 0
   failures, or document any new deliberate regressions here.
5. Update this doc's "Last reviewed" header and the threshold table.

## Known gaps (accepted for v1)

- **Non-ASCII normalization.** `normalize.js` uses `\w` which strips
  accented letters (`é → ''`), so `"José García"` becomes `"jos garca"`.
  Two records with identical accented names still match (they normalize
  to the same thing), but a mixed pair (`"José"` vs `"Jose"`) will not
  hit tier2 reliably. PRD E7 test passes because both sides normalize
  identically; in practice the matcher is ASCII-biased.
  *Fix path:* replace `[^\w\s]` with `[^\p{L}\p{N}\s]` using the `u`
  flag once we confirm a real user hits this.

- **No nickname dictionary.** `"Bob"` vs `"Robert"` will not match.
  PRD E8 explicitly accepts this for v1 — the nickname table is v2.

- **Company acquisitions.** `"Acme Inc"` → `"AcmeCo"` relies entirely
  on Levenshtein similarity on the normalized business names. Short
  renames (`"Acme Inc" → "AcmeCo"`) usually land in tier3; dramatic
  renames (`"Acme Inc" → "Globex"`) will create a duplicate.

## Rollback

`matcher.js` owns the person thresholds; `ingestionService.js` owns the
company thresholds (`COMPANY_AUTO_MATCH_THRESHOLD`,
`COMPANY_REVIEW_THRESHOLD`). Reverting this doc's table + those two files
to Sprint 9 values is sufficient to restore the previous behavior.
