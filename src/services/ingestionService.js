// Sprint 4: Interview ingestion processor.
//
// Takes an interview doc that the Cloud Function wrote with dedupStatus: 'pending',
// runs Claude entity extraction, runs dedup matching against existing people +
// companies, and either auto-attaches the interview to an existing person, queues
// it for human review, or creates a new person + company.
//
// Design:
//   - `planResolution()` is pure — given an extracted entity + in-memory
//     people/companies, it returns a plan describing what should happen. Easy to
//     unit-test.
//   - `executePlan()` translates that plan into a Firestore batch write.
//   - `processInterview()` wires it together for the hook: extract → load
//     reference data → plan → execute.

import { doc as fbDoc, collection as fbCollection, serverTimestamp } from 'firebase/firestore';
import { extractEntity, enrichEntity } from './claudeService.js';
import {
  findBestMatch,
  normalizeBusinessName,
  normalizeEmail,
  normalizePhone,
  buildFullName,
  normalizeName,
  similarityPercent,
} from '../lib/dedup/index.js';
import { mergeEnrichment, appendEnrichmentEvent } from '../lib/dedup/enrichmentMerge.js';
import {
  BUSINESS_OWNER_FIELDS,
  PRACTITIONER_PERSON_FIELDS,
  PRACTITIONER_COMPANY_FIELDS,
} from '../prompts/enrichment.js';
import { listDocs, batchWrite, updateDoc, getDoc } from '../data/firestore.js';
import { db, auth } from '../config/firebase.js';

const COMPANY_AUTO_MATCH_THRESHOLD = 90;
const COMPANY_REVIEW_THRESHOLD = 85;

// ────────────────────────────────────────────────────────────────────────────
// Pure logic — matching + plan construction
// ────────────────────────────────────────────────────────────────────────────

export function candidateFromEntity(entity) {
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

export function findBestCompanyMatch(targetName, companies) {
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

/**
 * Build a plan describing how this extracted entity should be reconciled against
 * existing people/companies. Pure — no I/O.
 *
 * Decision tree:
 *   1. Person matches tier1 (email) or tier2 (name+business) → attach interview to existing person
 *   2. Person matches tier3 → queue for review; don't create anything new yet
 *   3. No person match:
 *        a. Company matches strongly → create person, link to existing company
 *        b. Company matches weakly → queue company for review; create no person
 *        c. No company match → create both
 */
export function planResolution(extractedEntity, people, companies) {
  if (!extractedEntity) return { decision: 'error', reason: 'no_extracted_entity' };

  const candidate = candidateFromEntity(extractedEntity);
  // Sprint 9 (PRD F3) — soft-deleted contacts are kept in Firestore for undo,
  // but must never participate in dedup matching.
  const livePeople = (people || []).filter((p) => !p?.deletedAt);
  const liveCompanies = (companies || []).filter((c) => !c?.deletedAt);
  const personMatch = findBestMatch(candidate, livePeople, { appType: null });

  if (personMatch.tier === 'tier1_email' || personMatch.tier === 'tier2_name_business') {
    return {
      decision: 'attach_existing_person',
      person: personMatch.match,
      personTier: personMatch.tier,
      personConfidence: personMatch.confidence,
      personNameMatch: personMatch.result?.nameMatch ?? null,
      personBusinessMatch: personMatch.result?.businessMatch ?? null,
      extractedEntity,
    };
  }

  if (personMatch.tier === 'tier3_review') {
    return {
      decision: 'review_person',
      candidatePerson: personMatch.match,
      personConfidence: personMatch.confidence,
      personNameMatch: personMatch.result?.nameMatch ?? null,
      personBusinessMatch: personMatch.result?.businessMatch ?? null,
      extractedEntity,
    };
  }

  const companyMatch = findBestCompanyMatch(extractedEntity.businessName, liveCompanies);

  if (companyMatch.tier === 'tier2_name_business') {
    return {
      decision: 'create_person_attach_company',
      company: companyMatch.match,
      companyConfidence: companyMatch.confidence,
      extractedEntity,
    };
  }

  if (companyMatch.tier === 'tier3_review') {
    return {
      decision: 'create_person_review_company',
      candidateCompany: companyMatch.match,
      companyConfidence: companyMatch.confidence,
      extractedEntity,
    };
  }

  return { decision: 'create_both', extractedEntity };
}

// ────────────────────────────────────────────────────────────────────────────
// Plan execution — translates a plan into Firestore writes
// ────────────────────────────────────────────────────────────────────────────

function newPersonDocFromEntity(entity, companyId) {
  const fullName = buildFullName(entity.firstName, entity.lastName);
  return {
    firstName: entity.firstName || null,
    lastName: entity.lastName || null,
    name: fullName,
    email: entity.email || null,
    phone: entity.phone || null,
    company: entity.businessName || null,
    company_id: companyId || null,
    // Dedup scaffolding
    emailNormalized: normalizeEmail(entity.email),
    fullNameNormalized: fullName ? normalizeName(fullName) : '',
    phoneNormalized: normalizePhone(entity.phone),
    sourceType: 'interview_ingestion',
    mergedFromContactIds: [],
    dedupReviewStatus: 'none',
    interviewIds: [],
    callIds: [],
    noteIds: [],
    enrichmentHistory: [],
  };
}

function newCompanyDocFromEntity(entity) {
  return {
    name: entity.businessName || null,
    nameNormalized: normalizeBusinessName(entity.businessName || ''),
    sourceType: 'interview_ingestion',
    mergedFromBusinessIds: [],
    contactIds: [],
    primaryContactId: null,
    enrichmentHistory: [],
  };
}

function genId() {
  // Client-side generated ID — matches existing createDoc pattern where caller
  // can pre-allocate IDs for cross-reference before writing.
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  // Use Firestore's auto-ID via an in-memory doc ref.
  return fbDoc(fbCollection(db, `users/${uid}/_ids`)).id;
}

/**
 * Execute a plan as a single atomic batch. Returns metadata for logging /
 * writing the interview's dedupResolution.
 */
export async function executePlan(plan, interviewId, jobId, log = () => {}) {
  const ops = [];
  const result = {
    matchedContactId: null,
    matchedBusinessId: null,
    reviewItemId: null,
    method: null,
    confidenceScore: null,
    createdPerson: false,
    createdCompany: false,
  };

  switch (plan.decision) {
    case 'attach_existing_person': {
      const person = plan.person;
      const nextInterviewIds = Array.from(
        new Set([...(person.interviewIds || []), interviewId]),
      );
      ops.push({
        type: 'update',
        collection: 'people',
        id: person.id,
        data: { interviewIds: nextInterviewIds },
      });
      result.matchedContactId = person.id;
      result.matchedBusinessId = person.company_id || null;
      result.method = 'auto_merged';
      result.confidenceScore = plan.personConfidence;
      log(`attach_existing_person id=${person.id} (${plan.personTier}, conf=${plan.personConfidence})`);
      break;
    }

    case 'review_person': {
      const reviewItemId = genId();
      ops.push({
        type: 'set',
        collection: 'dedupReviewQueue',
        id: reviewItemId,
        data: {
          entityType: 'contact',
          appType: plan.extractedEntity?.appType || null,
          triggerReason: 'tier3_review',
          confidenceScore: plan.personConfidence,
          nameMatch: plan.personNameMatch ?? null,
          businessMatch: plan.personBusinessMatch ?? null,
          candidateData: plan.extractedEntity,
          matchedEntityId: plan.candidatePerson?.id || null,
          status: 'pending',
          resolvedBy: null,
          resolvedAt: null,
          sourceInterviewId: interviewId,
          sourceIngestionJobId: jobId,
          createdAt: serverTimestamp(),
        },
      });
      result.reviewItemId = reviewItemId;
      result.method = 'user_resolved';
      result.confidenceScore = plan.personConfidence;
      log(`review_person conf=${plan.personConfidence} candidateId=${plan.candidatePerson?.id}`);
      break;
    }

    case 'create_person_attach_company': {
      const personId = genId();
      const companyId = plan.company.id;
      const personDoc = newPersonDocFromEntity(plan.extractedEntity, companyId);
      personDoc.interviewIds = [interviewId];
      ops.push({ type: 'set', collection: 'people', id: personId, data: personDoc });
      const nextContactIds = Array.from(
        new Set([...(plan.company.contactIds || []), personId]),
      );
      ops.push({
        type: 'update',
        collection: 'companies',
        id: companyId,
        data: { contactIds: nextContactIds },
      });
      result.matchedContactId = personId;
      result.matchedBusinessId = companyId;
      result.method = 'created_new';
      result.confidenceScore = plan.companyConfidence;
      result.createdPerson = true;
      log(`create_person_attach_company personId=${personId} companyId=${companyId} (conf=${plan.companyConfidence})`);
      break;
    }

    case 'create_person_review_company': {
      const reviewItemId = genId();
      ops.push({
        type: 'set',
        collection: 'dedupReviewQueue',
        id: reviewItemId,
        data: {
          entityType: 'business',
          appType: plan.extractedEntity?.appType || null,
          triggerReason: 'tier3_review',
          confidenceScore: plan.companyConfidence,
          // Full extracted entity preserved so the card can show contact context too.
          candidateData: plan.extractedEntity,
          matchedEntityId: plan.candidateCompany?.id || null,
          status: 'pending',
          resolvedBy: null,
          resolvedAt: null,
          sourceInterviewId: interviewId,
          sourceIngestionJobId: jobId,
          createdAt: serverTimestamp(),
        },
      });
      result.reviewItemId = reviewItemId;
      result.method = 'user_resolved';
      result.confidenceScore = plan.companyConfidence;
      log(`create_person_review_company conf=${plan.companyConfidence} candidateCompanyId=${plan.candidateCompany?.id}`);
      break;
    }

    case 'create_both': {
      const personId = genId();
      const hasBusiness = Boolean(plan.extractedEntity.businessName);
      const companyId = hasBusiness ? genId() : null;

      if (hasBusiness) {
        const companyDoc = newCompanyDocFromEntity(plan.extractedEntity);
        companyDoc.contactIds = [personId];
        ops.push({ type: 'set', collection: 'companies', id: companyId, data: companyDoc });
      }

      const personDoc = newPersonDocFromEntity(plan.extractedEntity, companyId);
      personDoc.interviewIds = [interviewId];
      ops.push({ type: 'set', collection: 'people', id: personId, data: personDoc });

      result.matchedContactId = personId;
      result.matchedBusinessId = companyId;
      result.method = 'created_new';
      result.confidenceScore = 100;
      result.createdPerson = true;
      result.createdCompany = hasBusiness;
      log(`create_both personId=${personId} companyId=${companyId || 'none'}`);
      break;
    }

    case 'error':
      throw new Error(`Cannot execute error plan: ${plan.reason}`);

    default:
      throw new Error(`Unknown plan decision: ${plan.decision}`);
  }

  const interviewPatch = {
    extractedEntity: plan.extractedEntity || null,
    dedupResolution: {
      method: result.method,
      confidenceScore: result.confidenceScore,
      matchedContactId: result.matchedContactId,
      matchedBusinessId: result.matchedBusinessId,
      reviewItemId: result.reviewItemId,
    },
    dedupStatus: plan.decision.startsWith('review_') || plan.decision === 'create_person_review_company'
      ? 'review'
      : 'resolved',
    processingError: null,
  };
  ops.push({ type: 'update', collection: 'interviews', id: interviewId, data: interviewPatch });

  await batchWrite(ops);
  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Orchestration — the function the hook calls
// ────────────────────────────────────────────────────────────────────────────

/**
 * Process a single ingestion interview end-to-end.
 * - Extracts the entity with one retry on Claude failures.
 * - Loads all people + companies.
 * - Plans + executes the resolution.
 * - On failure, marks the interview with `dedupStatus: 'error'` + processingError.
 *
 * Idempotent: silently returns `{ skipped: 'already_processed' }` if the
 * interview's dedupStatus is no longer 'pending' when the function starts.
 *
 * @param {{id: string, transcript?: string, summary?: string, dedupStatus?: string,
 *          sourceIngestionJobId?: string, plaudRecordingId?: string}} interview
 * @returns {Promise<{ skipped?: string, decision?: string, result?: object, error?: string }>}
 */
export async function processInterview(interview) {
  const jobId = interview.sourceIngestionJobId || interview.plaudRecordingId || interview.id;
  const tag = `[ingest ${jobId}]`;
  const log = (msg) => { try { console.log(`${tag} ${msg}`); } catch { /* ignore */ } };

  if (!interview || !interview.id) {
    throw new Error('processInterview: interview must have an id');
  }
  if (interview.dedupStatus && interview.dedupStatus !== 'pending') {
    log(`skip — status is already ${interview.dedupStatus}`);
    return { skipped: 'already_processed' };
  }

  try {
    log('claim → processing');
    await updateDoc('interviews', interview.id, { dedupStatus: 'processing' });

    log('extract entity from transcript');
    let extractedEntity;
    try {
      extractedEntity = await extractEntity({
        transcript: interview.transcript || '',
        summary: interview.summary || '',
      });
    } catch (firstErr) {
      log(`extractEntity failed once: ${firstErr.message} — retrying`);
      extractedEntity = await extractEntity({
        transcript: interview.transcript || '',
        summary: interview.summary || '',
      });
    }
    log(`extracted: firstName=${extractedEntity.firstName} lastName=${extractedEntity.lastName} business=${extractedEntity.businessName}`);

    log('load existing people + companies');
    const [people, companies] = await Promise.all([
      listDocs('people'),
      listDocs('companies'),
    ]);
    log(`loaded ${people.length} people, ${companies.length} companies`);

    const plan = planResolution(extractedEntity, people, companies);
    log(`plan: ${plan.decision}`);

    const result = await executePlan(plan, interview.id, jobId, log);
    log(`done: ${JSON.stringify(result)}`);

    // Best-effort stage-2 enrichment — only when a person now exists. Review
    // states skip this; they'll enrich on resolveReview instead. Failures are
    // swallowed so they don't un-do the successful dedup resolution.
    if (result.matchedContactId) {
      try {
        await enrichAndMergeInterview(
          {
            ...interview,
            extractedEntity,
            dedupResolution: {
              method: result.method,
              confidenceScore: result.confidenceScore,
              matchedContactId: result.matchedContactId,
              matchedBusinessId: result.matchedBusinessId,
              reviewItemId: result.reviewItemId,
            },
          },
          { log },
        );
      } catch (enrichErr) {
        log(`enrichment error (non-fatal): ${enrichErr.message}`);
      }
    }

    return { decision: plan.decision, result };
  } catch (err) {
    const msg = err?.message || String(err);
    log(`ERROR: ${msg}`);
    try {
      await updateDoc('interviews', interview.id, {
        dedupStatus: 'error',
        processingError: msg.slice(0, 500),
      });
    } catch (writeErr) {
      log(`could not mark error: ${writeErr.message}`);
    }
    return { error: msg };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Sprint 5 — review queue resolution + retry
// ────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a dedupReviewQueue item. `choice` is 'merge' or 'create_new'.
 *
 * Contact-tier3 review:
 *   merge      → append interview id to existing person
 *   create_new → create new person (+ new company if businessName present)
 *
 * Business-tier3 review (person was never created at ingestion time):
 *   merge      → create person at the matched existing company; link interview
 *   create_new → create new company + person at that company; link interview
 *
 * In both paths, the review item flips to resolved_* and the interview's
 * dedupResolution + dedupStatus are updated in the same batch.
 */
export async function resolveReview(reviewItem, choice, options = {}) {
  const { resolvedBy = 'user' } = options;
  if (!reviewItem || !reviewItem.id) throw new Error('resolveReview: reviewItem.id required');
  if (choice !== 'merge' && choice !== 'create_new') {
    throw new Error(`resolveReview: invalid choice ${choice}`);
  }

  const entity = reviewItem.candidateData || {};
  const interviewId = reviewItem.sourceInterviewId || null;
  const ops = [];
  let resolvedStatus = null;
  let matchedContactId = null;
  let matchedBusinessId = null;
  const meta = { createdPerson: false, createdCompany: false };

  if (reviewItem.entityType === 'contact') {
    if (choice === 'merge') {
      if (!reviewItem.matchedEntityId) throw new Error('resolveReview: matchedEntityId required for merge');
      const matched = await getDoc('people', reviewItem.matchedEntityId);
      if (!matched) throw new Error('resolveReview: matched person no longer exists');
      const nextInterviewIds = interviewId
        ? Array.from(new Set([...(matched.interviewIds || []), interviewId]))
        : matched.interviewIds || [];
      ops.push({
        type: 'update',
        collection: 'people',
        id: matched.id,
        data: { interviewIds: nextInterviewIds },
      });
      resolvedStatus = 'resolved_attached';
      matchedContactId = matched.id;
      matchedBusinessId = matched.company_id || null;
    } else {
      const personId = genId();
      const hasBusiness = Boolean(entity.businessName);
      const companyId = hasBusiness ? genId() : null;
      if (hasBusiness) {
        const companyDoc = newCompanyDocFromEntity(entity);
        companyDoc.contactIds = [personId];
        ops.push({ type: 'set', collection: 'companies', id: companyId, data: companyDoc });
        meta.createdCompany = true;
      }
      const personDoc = newPersonDocFromEntity(entity, companyId);
      personDoc.interviewIds = interviewId ? [interviewId] : [];
      ops.push({ type: 'set', collection: 'people', id: personId, data: personDoc });
      meta.createdPerson = true;
      resolvedStatus = 'resolved_created_new';
      matchedContactId = personId;
      matchedBusinessId = companyId;
    }
  } else if (reviewItem.entityType === 'business') {
    if (choice === 'merge') {
      if (!reviewItem.matchedEntityId) throw new Error('resolveReview: matchedEntityId required for merge');
      const matchedCompany = await getDoc('companies', reviewItem.matchedEntityId);
      if (!matchedCompany) throw new Error('resolveReview: matched company no longer exists');
      const personId = genId();
      const personDoc = newPersonDocFromEntity(entity, matchedCompany.id);
      personDoc.interviewIds = interviewId ? [interviewId] : [];
      ops.push({ type: 'set', collection: 'people', id: personId, data: personDoc });
      const nextContactIds = Array.from(new Set([...(matchedCompany.contactIds || []), personId]));
      ops.push({
        type: 'update',
        collection: 'companies',
        id: matchedCompany.id,
        data: { contactIds: nextContactIds },
      });
      resolvedStatus = 'resolved_attached';
      meta.createdPerson = true;
      matchedContactId = personId;
      matchedBusinessId = matchedCompany.id;
    } else {
      const personId = genId();
      const companyId = genId();
      const companyDoc = newCompanyDocFromEntity(entity);
      companyDoc.contactIds = [personId];
      ops.push({ type: 'set', collection: 'companies', id: companyId, data: companyDoc });
      const personDoc = newPersonDocFromEntity(entity, companyId);
      personDoc.interviewIds = interviewId ? [interviewId] : [];
      ops.push({ type: 'set', collection: 'people', id: personId, data: personDoc });
      meta.createdPerson = true;
      meta.createdCompany = true;
      resolvedStatus = 'resolved_created_new';
      matchedContactId = personId;
      matchedBusinessId = companyId;
    }
  } else {
    throw new Error(`resolveReview: unknown entityType ${reviewItem.entityType}`);
  }

  ops.push({
    type: 'update',
    collection: 'dedupReviewQueue',
    id: reviewItem.id,
    data: {
      status: resolvedStatus,
      resolvedBy,
      resolvedAt: serverTimestamp(),
    },
  });

  if (interviewId) {
    ops.push({
      type: 'update',
      collection: 'interviews',
      id: interviewId,
      data: {
        dedupStatus: 'resolved',
        dedupResolution: {
          method: 'user_resolved',
          confidenceScore: reviewItem.confidenceScore ?? null,
          matchedContactId,
          matchedBusinessId,
          reviewItemId: reviewItem.id,
        },
      },
    });
  }

  await batchWrite(ops);

  // Best-effort stage-2 enrichment once the person is finally attached. We
  // rehydrate the interview so we have transcript/summary + the fresh
  // dedupResolution we just wrote.
  if (interviewId && matchedContactId) {
    try {
      const fresh = await getDoc('interviews', interviewId);
      if (fresh) {
        await enrichAndMergeInterview(fresh, {
          log: (msg) => { try { console.log(`[resolveReview ${interviewId}] ${msg}`); } catch { /* ignore */ } },
        });
      }
    } catch (err) {
      try { console.warn(`[resolveReview ${interviewId}] enrichment error (non-fatal): ${err.message}`); } catch { /* ignore */ }
    }
  }

  return { reviewItemId: reviewItem.id, resolvedStatus, matchedContactId, matchedBusinessId, ...meta };
}

/** Reset an errored interview back to `pending` so the processor picks it up again. */
export async function retryInterview(interviewId) {
  if (!interviewId) throw new Error('retryInterview: interviewId required');
  await updateDoc('interviews', interviewId, {
    dedupStatus: 'pending',
    processingError: null,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Sprint 6 — Stage-2 enrichment + intelligent merge
// ────────────────────────────────────────────────────────────────────────────

/**
 * Decide which enrichment fields go on the person vs. the company for a given
 * businessType. For business_owner the company absorbs the bulk of fields and
 * the person carries only the interview-wide narrative ones; for practitioner
 * role-level fields live on the person and firm-level fields on the company.
 */
function enrichmentTargets(businessType) {
  if (businessType === 'practitioner') {
    return {
      personFields: [...PRACTITIONER_PERSON_FIELDS],
      companyFields: [...PRACTITIONER_COMPANY_FIELDS],
    };
  }
  return {
    // For business_owner, the person record just gets the transcript summary
    // and shared quotable lines; everything else belongs to the company.
    personFields: ['summary', 'painPoints', 'quotableLines'],
    companyFields: [...BUSINESS_OWNER_FIELDS],
  };
}

/**
 * Run Claude enrichment for an interview and merge the result into the linked
 * person/company records. Idempotent: safe to re-run — each re-run adds a new
 * enrichmentHistory event, but unchanged fields produce no changes.
 *
 * @param {{id:string,transcript?:string,summary?:string,dedupResolution?:object,extractedEntity?:object,enrichmentEvents?:number}} interview
 *        The interview record. Must have dedupResolution.matchedContactId to know
 *        which person to enrich.
 * @param {object} [options]
 * @param {(msg:string)=>void} [options.log]
 * @returns {Promise<{ skipped?: string, changed?: {person?:string[], company?:string[]}, enrichedData?: object, error?: string }>}
 */
export async function enrichAndMergeInterview(interview, options = {}) {
  const log = options.log || (() => {});
  if (!interview || !interview.id) {
    throw new Error('enrichAndMergeInterview: interview.id required');
  }
  const resolution = interview.dedupResolution;
  const personId = resolution?.matchedContactId || null;
  if (!personId) {
    log('skip enrichment — no matchedContactId on interview');
    return { skipped: 'no_matched_contact' };
  }

  const [person, company] = await Promise.all([
    getDoc('people', personId),
    resolution.matchedBusinessId ? getDoc('companies', resolution.matchedBusinessId) : Promise.resolve(null),
  ]);
  if (!person) {
    log(`skip enrichment — person ${personId} no longer exists`);
    return { skipped: 'person_missing' };
  }

  const businessType = interview.extractedEntity?.businessType
    || (company ? 'business_owner' : 'practitioner');
  const prior = {};
  const { personFields, companyFields } = enrichmentTargets(businessType);
  for (const f of personFields) if (person[f] != null) prior[f] = person[f];
  for (const f of companyFields) if (company && company[f] != null) prior[f] = company[f];

  const interviewNumber = Array.isArray(person.interviewIds)
    ? Math.max(person.interviewIds.length, 1)
    : 1;

  log(`enrich start — businessType=${businessType} interviewNumber=${interviewNumber}`);
  let enriched;
  try {
    enriched = await enrichEntity({
      transcript: interview.transcript || '',
      summary: interview.summary || '',
      contact: {
        firstName: person.firstName || null,
        lastName: person.lastName || null,
        email: person.email || null,
        role: person.role || null,
      },
      business: {
        name: company?.name || person.company || interview.extractedEntity?.businessName || null,
        type: businessType,
      },
      interviewNumber,
      existingEnrichedData: Object.keys(prior).length ? prior : null,
    });
  } catch (err) {
    const msg = err?.message || String(err);
    log(`enrichEntity failed: ${msg}`);
    await updateDoc('interviews', interview.id, {
      enrichmentError: msg.slice(0, 500),
      enrichmentRanAt: serverTimestamp(),
    });
    return { error: msg };
  }

  const personMerge = mergeEnrichment(
    person,
    filterFields(enriched, personFields),
    interview.id,
  );
  const companyMerge = company
    ? mergeEnrichment(company, filterFields(enriched, companyFields), interview.id)
    : { merged: null, changedFields: [], enrichmentEvent: null };

  const ops = [];
  if (personMerge.enrichmentEvent) {
    const nextHistory = appendEnrichmentEvent(person.enrichmentHistory, personMerge.enrichmentEvent);
    const patch = pickChanged(personMerge.merged, personMerge.changedFields);
    patch.enrichmentHistory = nextHistory;
    patch.enrichedAt = new Date().toISOString();
    ops.push({ type: 'update', collection: 'people', id: person.id, data: patch });
  }
  if (companyMerge.enrichmentEvent && company) {
    const nextHistory = appendEnrichmentEvent(company.enrichmentHistory, companyMerge.enrichmentEvent);
    const patch = pickChanged(companyMerge.merged, companyMerge.changedFields);
    patch.enrichmentHistory = nextHistory;
    patch.enrichedAt = new Date().toISOString();
    ops.push({ type: 'update', collection: 'companies', id: company.id, data: patch });
  }

  // Always stamp the raw enrichment on the interview so we can audit and
  // re-merge later without calling Claude again.
  ops.push({
    type: 'update',
    collection: 'interviews',
    id: interview.id,
    data: {
      enrichedData: enriched,
      enrichmentRanAt: serverTimestamp(),
      enrichmentError: null,
    },
  });

  await batchWrite(ops);
  log(`enrich done — person changes=${personMerge.changedFields.length} company changes=${companyMerge.changedFields.length}`);
  return {
    enrichedData: enriched,
    changed: {
      person: personMerge.changedFields,
      company: companyMerge.changedFields,
    },
  };
}

function filterFields(obj, fields) {
  const out = { overallConfidence: typeof obj.overallConfidence === 'number' ? obj.overallConfidence : null };
  for (const f of fields) {
    if (obj[f] !== undefined) out[f] = obj[f];
    const confKey = `${f}Confidence`;
    if (obj[confKey] !== undefined) out[confKey] = obj[confKey];
  }
  return out;
}

function pickChanged(merged, changedFields) {
  const patch = {};
  for (const field of changedFields) {
    // Nested change keys arrive as "parent.child"; write the full parent.
    const root = field.split('.')[0];
    patch[root] = merged[root];
    const confKey = `${root}Confidence`;
    if (merged[confKey] !== undefined) patch[confKey] = merged[confKey];
  }
  return patch;
}
