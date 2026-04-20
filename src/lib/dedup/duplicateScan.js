// Sprint 10 — Proactive health check: scans existing contacts pair-wise to
// surface duplicates that slipped past ingestion (e.g. imported before the
// dedup pipeline existed, or edited post-hoc into a near-duplicate).
//
// Pure function over a pre-loaded contact list. The caller owns fetching and
// filtering (e.g. `.filter((p) => !p.deletedAt)`). Ordered by confidence desc
// so the UI can slice the top N.

import { scoreMatch } from './matcher.js';
import { similarityPercent } from './levenshtein.js';
import { normalizeBusinessName } from './normalize.js';

const PAIR_THRESHOLD = 80;
const COMPANY_PAIR_THRESHOLD = 85;

/**
 * Find candidate duplicate person pairs.
 * - O(n²) — fine for current user scale (hundreds of contacts). Revisit with
 *   blocking by normalized last-name if this ever runs on >10k records.
 * - Only compares within the same appType so CRM and Deal Flow stay isolated.
 * - Skips the tier1 email case since ingestion already prevents that path
 *   from producing a duplicate; we want to surface name/business near-misses.
 *
 * @param {Array<Object>} contacts — already filtered for !deletedAt.
 * @returns {Array<{a, b, confidence, nameMatch, businessMatch, tier}>}
 */
export function findDuplicatePersonPairs(contacts) {
  const list = Array.isArray(contacts) ? contacts : [];
  const pairs = [];
  for (let i = 0; i < list.length; i += 1) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j += 1) {
      const b = list[j];
      if (a.appType && b.appType && a.appType !== b.appType) continue;
      const result = scoreMatch(a, b);
      if (result.tier === 'tier1_email') continue;
      if (result.confidence >= PAIR_THRESHOLD) {
        pairs.push({
          a,
          b,
          tier: result.tier,
          confidence: result.confidence,
          nameMatch: result.nameMatch,
          businessMatch: result.businessMatch,
        });
      }
    }
  }
  pairs.sort((x, y) => y.confidence - x.confidence);
  return pairs;
}

/**
 * Find candidate duplicate company pairs using the same normalized-business
 * similarity rule ingestion uses. Useful after a bulk import where two variants
 * of the same firm name both slipped through.
 */
export function findDuplicateCompanyPairs(companies) {
  const list = Array.isArray(companies) ? companies : [];
  const pairs = [];
  for (let i = 0; i < list.length; i += 1) {
    const a = list[i];
    const nameA = normalizeBusinessName(a.name || a.company || '');
    if (!nameA) continue;
    for (let j = i + 1; j < list.length; j += 1) {
      const b = list[j];
      if (a.appType && b.appType && a.appType !== b.appType) continue;
      const nameB = normalizeBusinessName(b.name || b.company || '');
      if (!nameB) continue;
      const sim = similarityPercent(nameA, nameB);
      if (sim >= COMPANY_PAIR_THRESHOLD) {
        pairs.push({ a, b, confidence: sim });
      }
    }
  }
  pairs.sort((x, y) => y.confidence - x.confidence);
  return pairs;
}
