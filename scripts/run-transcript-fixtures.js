#!/usr/bin/env node
// Sprint 10 — Runs every JSON fixture in scripts/test-transcripts/ through the
// dedup planResolution pipeline and prints what the engine decided plus the
// underlying confidence, along with a pass/fail vs `expectedDecision`.
//
// Stubs the extraction layer — fixtures are pre-extracted entities — so this
// is deterministic and zero-cost. Use scripts/test-extraction.js to exercise
// the Claude extraction path end-to-end against real transcripts.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { findBestMatch } from '../src/lib/dedup/matcher.js';
import { normalizeBusinessName, buildFullName } from '../src/lib/dedup/normalize.js';
import { similarityPercent } from '../src/lib/dedup/levenshtein.js';

// Kept in sync with src/services/ingestionService.planResolution. See
// scripts/test-dedup-matrix.js for the rationale on inlining.
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
  if (best.sim >= COMPANY_AUTO_MATCH_THRESHOLD) return { tier: 'tier2_name_business', match: best.company, confidence: best.sim };
  if (best.sim >= COMPANY_REVIEW_THRESHOLD) return { tier: 'tier3_review', match: best.company, confidence: best.sim };
  return { tier: 'new', match: null, confidence: best.sim };
}

function planResolution(extractedEntity, people, companies) {
  if (!extractedEntity) return { decision: 'error', reason: 'no_extracted_entity' };
  const candidate = candidateFromEntity(extractedEntity);
  const livePeople = (people || []).filter((p) => !p?.deletedAt);
  const liveCompanies = (companies || []).filter((c) => !c?.deletedAt);
  const personMatch = findBestMatch(candidate, livePeople, { appType: null });
  if (personMatch.tier === 'tier1_email' || personMatch.tier === 'tier2_name_business') {
    return { decision: 'attach_existing_person', personConfidence: personMatch.confidence, personTier: personMatch.tier };
  }
  if (personMatch.tier === 'tier3_review') {
    return { decision: 'review_person', personConfidence: personMatch.confidence };
  }
  const companyMatch = findBestCompanyMatch(extractedEntity.businessName, liveCompanies);
  if (companyMatch.tier === 'tier2_name_business') {
    return { decision: 'create_person_attach_company', companyConfidence: companyMatch.confidence };
  }
  if (companyMatch.tier === 'tier3_review') {
    return { decision: 'create_person_review_company', companyConfidence: companyMatch.confidence };
  }
  return { decision: 'create_both' };
}

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, 'test-transcripts');

const fixtureFiles = fs.readdirSync(fixturesDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

const pad = (s, n) => String(s).padEnd(n);

console.log('');
console.log(`Transcript fixtures — ${fixtureFiles.length} cases`);
console.log('─'.repeat(110));

let failed = 0;
for (const file of fixtureFiles) {
  const raw = fs.readFileSync(path.join(fixturesDir, file), 'utf8');
  const fixture = JSON.parse(raw);
  const plan = planResolution(
    fixture.extractedEntity,
    fixture.existing?.people || [],
    fixture.existing?.companies || [],
  );
  const conf = plan.personConfidence ?? plan.companyConfidence ?? '—';
  const ok = plan.decision === fixture.expectedDecision;
  if (!ok) failed += 1;
  console.log(
    `${pad(fixture.id, 32)} ${ok ? '✓' : '✗'}  ${pad(plan.decision, 34)} conf=${pad(conf, 4)} (expected ${fixture.expectedDecision})`,
  );
  if (!ok) {
    console.log(`   description: ${fixture.description}`);
    console.log(`   plan: ${JSON.stringify(plan)}`);
  }
}

console.log('─'.repeat(110));
console.log(`Summary: ${fixtureFiles.length - failed}/${fixtureFiles.length} pass, ${failed} fail`);
process.exit(failed);
