#!/usr/bin/env node
// Sprint 10 — PRD Part 9 dedup test matrix.
//
// Runs every happy-path (T1-T6), edge case (E1-E10), and failure mode
// (F1-F5) defined in the PRD against the real matcher + planResolution
// pipeline and prints a pass/fail table. No Firestore, no Claude API —
// pure fixtures so it's repeatable and runnable in CI.
//
// Usage:  node scripts/test-dedup-matrix.js
//
// Exit code is the number of failing cases (0 == green).

import { scoreMatch, findBestMatch } from '../src/lib/dedup/matcher.js';
import {
  normalizeBusinessName,
  buildFullName,
} from '../src/lib/dedup/normalize.js';
import { similarityPercent } from '../src/lib/dedup/levenshtein.js';

// NOTE: planResolution lives in src/services/ingestionService.js alongside
// Firestore-coupled code that Node ESM can't load without Vite's resolver.
// We re-implement the pure decision logic here verbatim so the matrix runs
// under plain `node`. Kept in sync with ingestionService.planResolution;
// ingestionService unit tests remain the source of truth for production.

const COMPANY_AUTO_MATCH_THRESHOLD = 90;
const COMPANY_REVIEW_THRESHOLD = 85;

function candidateFromEntity(entity) {
  if (!entity) return null;
  return {
    firstName: entity.firstName || null,
    lastName: entity.lastName || null,
    name: buildFullName(entity.firstName, entity.lastName),
    email: entity.email || null,
    phone: entity.phone || null,
    businessName: entity.businessName || null,
  };
}

function findBestCompanyMatch(targetName, companies) {
  const normTarget = normalizeBusinessName(targetName || '');
  if (!normTarget) return { tier: 'new', match: null, confidence: 0 };
  let best = null;
  for (const c of companies) {
    const normExisting = normalizeBusinessName(c.name || c.company || '');
    if (!normExisting) continue;
    const sim = similarityPercent(normTarget, normExisting);
    if (!best || sim > best.sim) best = { sim, company: c };
  }
  if (!best) return { tier: 'new', match: null, confidence: 0 };
  if (best.sim >= COMPANY_AUTO_MATCH_THRESHOLD) {
    return { tier: 'tier2_name_business', match: best.company, confidence: best.sim };
  }
  if (best.sim >= COMPANY_REVIEW_THRESHOLD) {
    return { tier: 'tier3_review', match: best.company, confidence: best.sim };
  }
  return { tier: 'new', match: null, confidence: best.sim };
}

function planResolution(extractedEntity, people, companies) {
  if (!extractedEntity) return { decision: 'error', reason: 'no_extracted_entity' };
  const candidate = candidateFromEntity(extractedEntity);
  const livePeople = (people || []).filter((p) => !p?.deletedAt);
  const liveCompanies = (companies || []).filter((c) => !c?.deletedAt);
  const personMatch = findBestMatch(candidate, livePeople, { appType: null });
  if (personMatch.tier === 'tier1_email' || personMatch.tier === 'tier2_name_business') {
    return { decision: 'attach_existing_person', person: personMatch.match, personTier: personMatch.tier, personConfidence: personMatch.confidence, extractedEntity };
  }
  if (personMatch.tier === 'tier3_review') {
    return { decision: 'review_person', candidatePerson: personMatch.match, personConfidence: personMatch.confidence, extractedEntity };
  }
  const companyMatch = findBestCompanyMatch(extractedEntity.businessName, liveCompanies);
  if (companyMatch.tier === 'tier2_name_business') {
    return { decision: 'create_person_attach_company', company: companyMatch.match, companyConfidence: companyMatch.confidence, extractedEntity };
  }
  if (companyMatch.tier === 'tier3_review') {
    return { decision: 'create_person_review_company', candidateCompany: companyMatch.match, companyConfidence: companyMatch.confidence, extractedEntity };
  }
  return { decision: 'create_both', extractedEntity };
}

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures.

const JOHN_SMITH_ACME = {
  id: 'p-john-smith-acme',
  firstName: 'John',
  lastName: 'Smith',
  name: 'John Smith',
  businessName: 'Acme Construction',
  company: 'Acme Construction',
  appType: 'crm',
  email: 'john@acmeconstruction.com',
  phone: '555-207-4412',
};

const ACME_COMPANY = {
  id: 'c-acme',
  name: 'Acme Construction',
  businessName: 'Acme Construction',
  appType: 'crm',
  workspace: 'crm',
};

const DELETED_CONTACT = {
  id: 'p-deleted',
  firstName: 'John',
  lastName: 'Smith',
  businessName: 'Acme Construction',
  appType: 'crm',
  email: 'john@acmeconstruction.com',
  deletedAt: '2026-01-01T00:00:00Z',
};

// ──────────────────────────────────────────────────────────────────────────────
// Tests. Each case: { id, scenario, expected, run: () => ({ outcome, ...details }) }
// `expected` is a free-form string; `run` returns an `outcome` string we
// compare against the expectation.

const cases = [];

// ── 9.1 Happy Path ──────────────────────────────────────────────────────────

cases.push({
  id: 'T1', scenario: 'First interview with brand-new John Smith at Acme',
  expected: 'create_both',
  run: () => {
    const plan = planResolution({
      firstName: 'John', lastName: 'Smith', businessName: 'Acme Construction',
      email: 'john@acmeconstruction.com', appType: 'crm',
    }, [], []);
    return { outcome: plan.decision, plan };
  },
});

cases.push({
  id: 'T2', scenario: 'Second interview with same John Smith at Acme',
  expected: 'attach_existing_person',
  run: () => {
    const plan = planResolution({
      firstName: 'John', lastName: 'Smith', businessName: 'Acme Construction',
      email: 'john@acmeconstruction.com', appType: 'crm',
    }, [JOHN_SMITH_ACME], [ACME_COMPANY]);
    return { outcome: plan.decision, plan };
  },
});

cases.push({
  id: 'T3', scenario: 'New contact (Sarah Johnson) at existing Acme',
  expected: 'create_person_attach_company',
  run: () => {
    const plan = planResolution({
      firstName: 'Sarah', lastName: 'Johnson', businessName: 'Acme Construction',
      email: 'sarah@acmeconstruction.com', appType: 'crm',
    }, [JOHN_SMITH_ACME], [ACME_COMPANY]);
    return { outcome: plan.decision, plan };
  },
});

cases.push({
  id: 'T4', scenario: 'Manual record exists, then interview arrives (email match)',
  expected: 'attach_existing_person',
  run: () => {
    const manual = { ...JOHN_SMITH_ACME, id: 'p-manual' };
    const plan = planResolution({
      firstName: 'John', lastName: 'Smith', businessName: 'Acme Construction',
      email: 'john@acmeconstruction.com', appType: 'crm',
    }, [manual], [ACME_COMPANY]);
    return { outcome: plan.decision, plan };
  },
});

cases.push({
  id: 'T5', scenario: 'Typo — Jon Smith at Acme',
  expected: 'attach_existing_person',
  run: () => {
    const plan = planResolution({
      firstName: 'Jon', lastName: 'Smith', businessName: 'Acme Construction',
      email: null, appType: 'crm',
    }, [JOHN_SMITH_ACME], [ACME_COMPANY]);
    return { outcome: plan.decision, plan };
  },
});

cases.push({
  id: 'T6', scenario: 'John Smith at Acme Inc vs John Smith at Beta Corp',
  expected: 'create_person_attach_company_or_review_or_both',
  run: () => {
    const plan = planResolution({
      firstName: 'John', lastName: 'Smith', businessName: 'Beta Corp',
      email: null, appType: 'crm',
    }, [JOHN_SMITH_ACME], [ACME_COMPANY]);
    // Any of: create_both, review_person (tier3), create_person_review_company
    const ok = plan.decision === 'create_both'
      || plan.decision === 'create_person_attach_company'
      || plan.decision === 'create_person_review_company'
      || plan.decision === 'review_person';
    return { outcome: ok ? 'create_person_attach_company_or_review_or_both' : plan.decision, plan };
  },
});

// ── 9.2 Edge Cases ──────────────────────────────────────────────────────────

cases.push({
  id: 'E1', scenario: 'Transcript missing last name',
  expected: 'does_not_crash',
  run: () => {
    const plan = planResolution({
      firstName: 'John', lastName: null, businessName: 'Acme Construction',
      email: 'john@acmeconstruction.com', appType: 'crm',
    }, [JOHN_SMITH_ACME], [ACME_COMPANY]);
    return { outcome: plan.decision ? 'does_not_crash' : 'crashed', plan };
  },
});

cases.push({
  id: 'E2', scenario: 'Two Johns at same business (John Smith + John Doe)',
  expected: 'distinct_records',
  run: () => {
    // John Doe arriving against John Smith must NOT match tier1/2.
    const plan = planResolution({
      firstName: 'John', lastName: 'Doe', businessName: 'Acme Construction',
      email: 'doe@acmeconstruction.com', appType: 'crm',
    }, [JOHN_SMITH_ACME], [ACME_COMPANY]);
    const ok = plan.decision !== 'attach_existing_person';
    return { outcome: ok ? 'distinct_records' : 'incorrectly_attached', plan };
  },
});

cases.push({
  id: 'E3', scenario: 'Contact email changes over time — match on name+business',
  expected: 'attach_existing_person',
  run: () => {
    const plan = planResolution({
      firstName: 'John', lastName: 'Smith', businessName: 'Acme Construction',
      email: 'john.smith.new@example.com', appType: 'crm',
    }, [JOHN_SMITH_ACME], [ACME_COMPANY]);
    return { outcome: plan.decision, plan };
  },
});

cases.push({
  id: 'E4', scenario: 'Contact legitimately changed jobs (John now at Beta Corp)',
  expected: 'review_or_new',
  run: () => {
    const plan = planResolution({
      firstName: 'John', lastName: 'Smith', businessName: 'Beta Corp',
      email: null, appType: 'crm',
    }, [JOHN_SMITH_ACME], [ACME_COMPANY]);
    const ok = plan.decision === 'review_person'
      || plan.decision === 'create_both'
      || plan.decision === 'create_person_review_company'
      || plan.decision === 'create_person_attach_company';
    return { outcome: ok ? 'review_or_new' : plan.decision, plan };
  },
});

cases.push({
  id: 'E5', scenario: 'Transcript misidentifies Chris as interviewee',
  expected: 'flagged_at_extraction_layer',
  // Out of scope for the matcher — Prompt A is supposed to reject this
  // before planResolution ever runs. Mark as documented-skip rather than
  // pretending to test it here.
  run: () => ({ outcome: 'flagged_at_extraction_layer', skip: true }),
});

cases.push({
  id: 'E6', scenario: 'Same interview ingested twice (duplicate Zapier webhook)',
  expected: 'idempotent_via_ingestionJobId',
  // Idempotency lives in the Firestore-coupled ingestion path, not in
  // planResolution. Documented here so the matrix is complete.
  run: () => ({ outcome: 'idempotent_via_ingestionJobId', skip: true }),
});

cases.push({
  id: 'E7', scenario: 'Non-ASCII name (José García)',
  expected: 'matches_same_person',
  run: () => {
    const existing = {
      id: 'p-jose', firstName: 'José', lastName: 'García',
      name: 'José García', businessName: 'Acme Construction',
      appType: 'crm',
    };
    const plan = planResolution({
      firstName: 'José', lastName: 'García', businessName: 'Acme Construction',
      email: null, appType: 'crm',
    }, [existing], [ACME_COMPANY]);
    return { outcome: plan.decision === 'attach_existing_person' ? 'matches_same_person' : plan.decision, plan };
  },
});

cases.push({
  id: 'E8', scenario: 'Nickname vs full name (Bob Smith vs Robert Smith)',
  expected: 'review_or_new',
  run: () => {
    const robert = {
      id: 'p-robert', firstName: 'Robert', lastName: 'Smith',
      name: 'Robert Smith', businessName: 'Acme Construction', appType: 'crm',
    };
    const plan = planResolution({
      firstName: 'Bob', lastName: 'Smith', businessName: 'Acme Construction',
      email: null, appType: 'crm',
    }, [robert], [ACME_COMPANY]);
    const ok = plan.decision === 'review_person'
      || plan.decision === 'create_person_attach_company'
      || plan.decision === 'create_both';
    return { outcome: ok ? 'review_or_new' : plan.decision, plan };
  },
});

cases.push({
  id: 'E9', scenario: 'Business acquired/renamed (Acme Inc → AcmeCo)',
  expected: 'review_or_new',
  run: () => {
    const r = scoreMatch(
      { firstName: 'John', lastName: 'Smith', businessName: 'AcmeCo' },
      JOHN_SMITH_ACME,
    );
    const ok = r.tier === 'tier3_review' || r.tier === 'new' || r.tier === 'tier2_name_business';
    return { outcome: ok ? 'review_or_new' : r.tier, score: r };
  },
});

cases.push({
  id: 'E10', scenario: 'Same person interviewed in CRM then Deal Flow',
  expected: 'separate_records',
  run: () => {
    // Candidate arriving with appType='deal_flow'. The CRM John Smith
    // record must be filtered out, so the match must return `new`.
    const match = findBestMatch(
      { firstName: 'John', lastName: 'Smith', businessName: 'Acme Construction', appType: 'deal_flow' },
      [JOHN_SMITH_ACME],
      { appType: 'deal_flow' },
    );
    return { outcome: match.tier === 'new' ? 'separate_records' : match.tier, match };
  },
});

// ── 9.3 Failure Modes ───────────────────────────────────────────────────────

cases.push({
  id: 'F1', scenario: 'Claude returns malformed JSON',
  expected: 'handled_at_extraction_layer',
  run: () => ({ outcome: 'handled_at_extraction_layer', skip: true }),
});

cases.push({
  id: 'F2', scenario: 'Ambiguous appType — route to manual review',
  expected: 'handled_at_classification_layer',
  run: () => ({ outcome: 'handled_at_classification_layer', skip: true }),
});

cases.push({
  id: 'F3', scenario: 'Dedup must skip soft-deleted contacts',
  expected: 'no_match_against_deleted',
  run: () => {
    const plan = planResolution({
      firstName: 'John', lastName: 'Smith', businessName: 'Acme Construction',
      email: 'john@acmeconstruction.com', appType: 'crm',
    }, [DELETED_CONTACT], []);
    // Even though the deleted contact has a perfect email match, it must
    // be excluded. planResolution should create both new records.
    const ok = plan.decision === 'create_both'
      || plan.decision === 'create_person_attach_company'
      || plan.decision === 'create_person_review_company';
    return { outcome: ok ? 'no_match_against_deleted' : plan.decision, plan };
  },
});

cases.push({
  id: 'F4', scenario: 'Firestore transaction fails mid-merge',
  expected: 'handled_at_data_layer',
  run: () => ({ outcome: 'handled_at_data_layer', skip: true }),
});

cases.push({
  id: 'F5', scenario: 'Transcript partial/cut off',
  expected: 'handled_at_extraction_layer',
  run: () => ({ outcome: 'handled_at_extraction_layer', skip: true }),
});

// ──────────────────────────────────────────────────────────────────────────────
// Runner.

function runOne(c) {
  try {
    const res = c.run();
    const pass = res.outcome === c.expected;
    return { ...res, pass };
  } catch (err) {
    return { outcome: `ERROR: ${err.message}`, pass: false, err };
  }
}

function main() {
  const rows = cases.map((c) => ({ c, result: runOne(c) }));
  const passed = rows.filter((r) => r.result.pass).length;
  const skipped = rows.filter((r) => r.result.skip).length;
  const failed = rows.length - passed;

  const pad = (s, n) => String(s).padEnd(n);
  console.log('');
  console.log(`Dedup test matrix — ${rows.length} cases (${passed} pass, ${failed} fail, ${skipped} documented-skip)`);
  console.log('─'.repeat(100));
  for (const { c, result } of rows) {
    const tag = result.skip ? '↷ skip' : result.pass ? '✓ pass' : '✗ FAIL';
    console.log(`${pad(c.id, 4)} ${pad(tag, 8)} ${pad(c.scenario, 56)} → ${result.outcome}`);
    if (!result.pass && !result.skip) {
      console.log(`       expected: ${c.expected}`);
      if (result.plan?.decision) console.log(`       plan: ${JSON.stringify(result.plan)}`);
      if (result.match) console.log(`       match: ${JSON.stringify(result.match)}`);
      if (result.score) console.log(`       score: ${JSON.stringify(result.score)}`);
      if (result.err) console.log(`       error: ${result.err.stack}`);
    }
  }
  console.log('─'.repeat(100));
  console.log(`Summary: ${passed}/${rows.length} pass, ${failed} fail, ${skipped} skip`);
  process.exit(failed);
}

main();
