// Sprint 5 — Tests for the imperative side of ingestionService: executePlan
// (plan → Firestore batch) and resolveReview (user merges/creates from the
// dedup review queue). These stub out Firestore so we can assert on the
// batch ops that would have been written.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Firebase / Firestore mocks ─────────────────────────────────────────────
// genId inside the service calls fbDoc(fbCollection(db, ...)).id — we return a
// fresh id every call so generated person/company/review ids don't collide.
// Spread-pattern preserves every other real firebase/firestore export (collection,
// getDocs, query, etc.) so unrelated ingestionService imports don't blow up.
let idCounter = 0;
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    collection: () => ({ __mock: 'coll' }),
    doc: () => ({ id: `gen-${++idCounter}` }),
    serverTimestamp: () => '__SERVER_TS__',
  };
});

vi.mock('../../config/firebase.js', () => ({
  db: { __mock: 'db' },
  auth: { currentUser: { uid: 'test-uid' } },
}));

// ── Data-layer mocks ───────────────────────────────────────────────────────
const batchWriteMock = vi.fn(async () => {});
const getDocMock = vi.fn(async () => null);
const updateDocMock = vi.fn(async () => {});
const listDocsMock = vi.fn(async () => []);

vi.mock('../../data/firestore.js', () => ({
  batchWrite: (...args) => batchWriteMock(...args),
  getDoc: (...args) => getDocMock(...args),
  updateDoc: (...args) => updateDocMock(...args),
  listDocs: (...args) => listDocsMock(...args),
}));

// ── Claude mock (kept minimal; not exercised here but imported transitively) ─
vi.mock('../claudeService.js', () => ({
  extractEntity: vi.fn(),
  callClaude: vi.fn(),
}));

// Import *after* the mocks are registered so ESM module resolution sees them.
const { executePlan, resolveReview } = await import('../ingestionService.js');

function getOps() {
  expect(batchWriteMock).toHaveBeenCalledTimes(1);
  return batchWriteMock.mock.calls[0][0];
}

beforeEach(() => {
  idCounter = 0;
  batchWriteMock.mockClear();
  getDocMock.mockReset();
  getDocMock.mockResolvedValue(null);
  updateDocMock.mockClear();
  listDocsMock.mockClear();
});

describe('executePlan', () => {
  const entity = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@acme.com',
    phone: '555-1000',
    businessName: 'Acme Co',
    appType: 'crm',
  };

  it('attach_existing_person: appends interview id + updates interview status', async () => {
    const plan = {
      decision: 'attach_existing_person',
      person: { id: 'p1', interviewIds: ['iv-old'], company_id: 'c1' },
      personTier: 'tier1_email',
      personConfidence: 100,
      extractedEntity: entity,
    };
    const result = await executePlan(plan, 'iv-new', 'job-1');
    const ops = getOps();

    const personUpdate = ops.find((o) => o.collection === 'people' && o.id === 'p1');
    expect(personUpdate.type).toBe('update');
    expect(personUpdate.data.interviewIds).toEqual(['iv-old', 'iv-new']);

    const interviewUpdate = ops.find((o) => o.collection === 'interviews' && o.id === 'iv-new');
    expect(interviewUpdate.data.dedupStatus).toBe('resolved');
    expect(interviewUpdate.data.dedupResolution.method).toBe('auto_merged');
    expect(interviewUpdate.data.dedupResolution.matchedContactId).toBe('p1');
    expect(interviewUpdate.data.dedupResolution.matchedBusinessId).toBe('c1');
    expect(result.method).toBe('auto_merged');
  });

  it('attach_existing_person: does not duplicate an already-attached interview id', async () => {
    const plan = {
      decision: 'attach_existing_person',
      person: { id: 'p1', interviewIds: ['iv-x'] },
      personTier: 'tier2_name_business',
      personConfidence: 92,
      extractedEntity: entity,
    };
    await executePlan(plan, 'iv-x', 'job-2');
    const ops = getOps();
    const personUpdate = ops.find((o) => o.collection === 'people');
    expect(personUpdate.data.interviewIds).toEqual(['iv-x']);
  });

  it('review_person: queues a dedupReviewQueue item and marks interview for review', async () => {
    const plan = {
      decision: 'review_person',
      candidatePerson: { id: 'p1' },
      personConfidence: 86,
      personNameMatch: 84,
      personBusinessMatch: 90,
      extractedEntity: entity,
    };
    await executePlan(plan, 'iv-1', 'job-3');
    const ops = getOps();

    const review = ops.find((o) => o.collection === 'dedupReviewQueue');
    expect(review.type).toBe('set');
    expect(review.data.entityType).toBe('contact');
    expect(review.data.appType).toBe('crm');
    expect(review.data.status).toBe('pending');
    expect(review.data.matchedEntityId).toBe('p1');
    expect(review.data.nameMatch).toBe(84);
    expect(review.data.businessMatch).toBe(90);
    expect(review.data.candidateData).toEqual(entity);

    const interviewUpdate = ops.find((o) => o.collection === 'interviews');
    expect(interviewUpdate.data.dedupStatus).toBe('review');
  });

  it('create_person_attach_company: creates person + appends to company contactIds', async () => {
    const plan = {
      decision: 'create_person_attach_company',
      company: { id: 'c1', contactIds: ['p-old'] },
      companyConfidence: 95,
      extractedEntity: entity,
    };
    await executePlan(plan, 'iv-9', 'job-4');
    const ops = getOps();

    const personSet = ops.find((o) => o.collection === 'people' && o.type === 'set');
    expect(personSet.data.firstName).toBe('Jane');
    expect(personSet.data.company_id).toBe('c1');
    expect(personSet.data.interviewIds).toEqual(['iv-9']);

    const companyUpdate = ops.find((o) => o.collection === 'companies');
    expect(companyUpdate.type).toBe('update');
    expect(companyUpdate.data.contactIds).toEqual(['p-old', personSet.id]);

    const interviewUpdate = ops.find((o) => o.collection === 'interviews');
    expect(interviewUpdate.data.dedupStatus).toBe('resolved');
  });

  it('create_person_review_company: flags company for review, no person/company created', async () => {
    const plan = {
      decision: 'create_person_review_company',
      candidateCompany: { id: 'c1' },
      companyConfidence: 87,
      extractedEntity: entity,
    };
    await executePlan(plan, 'iv-2', 'job-5');
    const ops = getOps();

    expect(ops.some((o) => o.collection === 'people')).toBe(false);
    expect(ops.some((o) => o.collection === 'companies' && o.type === 'set')).toBe(false);

    const review = ops.find((o) => o.collection === 'dedupReviewQueue');
    expect(review.data.entityType).toBe('business');
    expect(review.data.matchedEntityId).toBe('c1');

    const interviewUpdate = ops.find((o) => o.collection === 'interviews');
    expect(interviewUpdate.data.dedupStatus).toBe('review');
  });

  it('create_both: creates person and company, cross-links ids', async () => {
    const plan = { decision: 'create_both', extractedEntity: entity };
    await executePlan(plan, 'iv-3', 'job-6');
    const ops = getOps();

    const personSet = ops.find((o) => o.collection === 'people');
    const companySet = ops.find((o) => o.collection === 'companies');

    expect(personSet.type).toBe('set');
    expect(companySet.type).toBe('set');
    expect(personSet.data.company_id).toBe(companySet.id);
    expect(companySet.data.contactIds).toEqual([personSet.id]);
    expect(personSet.data.interviewIds).toEqual(['iv-3']);

    const interviewUpdate = ops.find((o) => o.collection === 'interviews');
    expect(interviewUpdate.data.dedupStatus).toBe('resolved');
    expect(interviewUpdate.data.dedupResolution.method).toBe('created_new');
  });

  it('create_both: skips company creation when extracted entity has no businessName', async () => {
    const plan = {
      decision: 'create_both',
      extractedEntity: { ...entity, businessName: null },
    };
    await executePlan(plan, 'iv-4', 'job-7');
    const ops = getOps();

    expect(ops.some((o) => o.collection === 'companies')).toBe(false);
    const personSet = ops.find((o) => o.collection === 'people');
    expect(personSet.data.company_id).toBeNull();
  });

  it('throws on error plan', async () => {
    await expect(executePlan({ decision: 'error', reason: 'bad' }, 'iv-5', 'job-8'))
      .rejects.toThrow(/error plan/);
    expect(batchWriteMock).not.toHaveBeenCalled();
  });

  it('throws on unknown decision', async () => {
    await expect(executePlan({ decision: 'totally_made_up' }, 'iv-6', 'job-9'))
      .rejects.toThrow(/Unknown plan decision/);
  });
});

describe('resolveReview', () => {
  const contactEntity = {
    firstName: 'Pat',
    lastName: 'Kline',
    email: 'pat@widget.co',
    businessName: 'Widget Co',
  };
  const businessEntity = {
    firstName: 'Alex',
    lastName: 'Rivera',
    email: 'alex@bluebird.co',
    businessName: 'Bluebird LLC',
  };

  it('rejects invalid choice', async () => {
    await expect(resolveReview({ id: 'r1', entityType: 'contact' }, 'nope'))
      .rejects.toThrow(/invalid choice/);
  });

  it('rejects items without an id', async () => {
    await expect(resolveReview({ entityType: 'contact' }, 'merge'))
      .rejects.toThrow(/reviewItem\.id/);
  });

  it('contact + merge: appends interview to matched person, flips review + interview state', async () => {
    getDocMock.mockImplementation(async (coll, id) => {
      if (coll === 'people' && id === 'p1') {
        return { id: 'p1', interviewIds: ['iv-old'], company_id: 'c1' };
      }
      return null;
    });
    const item = {
      id: 'r1',
      entityType: 'contact',
      matchedEntityId: 'p1',
      sourceInterviewId: 'iv-new',
      candidateData: contactEntity,
      confidenceScore: 86,
    };
    const result = await resolveReview(item, 'merge');
    const ops = getOps();

    const personUpdate = ops.find((o) => o.collection === 'people');
    expect(personUpdate.type).toBe('update');
    expect(personUpdate.data.interviewIds).toEqual(['iv-old', 'iv-new']);

    const reviewUpdate = ops.find((o) => o.collection === 'dedupReviewQueue');
    expect(reviewUpdate.data.status).toBe('resolved_attached');
    expect(reviewUpdate.data.resolvedBy).toBe('user');

    const interviewUpdate = ops.find((o) => o.collection === 'interviews' && o.id === 'iv-new');
    expect(interviewUpdate.data.dedupStatus).toBe('resolved');
    expect(interviewUpdate.data.dedupResolution.method).toBe('user_resolved');
    expect(interviewUpdate.data.dedupResolution.matchedContactId).toBe('p1');

    expect(result.resolvedStatus).toBe('resolved_attached');
    expect(result.matchedContactId).toBe('p1');
  });

  it('contact + merge: errors when matched person no longer exists', async () => {
    getDocMock.mockResolvedValue(null);
    const item = {
      id: 'r2', entityType: 'contact', matchedEntityId: 'p-gone',
      sourceInterviewId: 'iv-1', candidateData: contactEntity,
    };
    await expect(resolveReview(item, 'merge')).rejects.toThrow(/no longer exists/);
    expect(batchWriteMock).not.toHaveBeenCalled();
  });

  it('contact + create_new: creates person + company when businessName present', async () => {
    const item = {
      id: 'r3', entityType: 'contact', matchedEntityId: 'p1',
      sourceInterviewId: 'iv-7', candidateData: contactEntity,
      confidenceScore: 86,
    };
    const result = await resolveReview(item, 'create_new');
    const ops = getOps();

    const personSet = ops.find((o) => o.collection === 'people');
    const companySet = ops.find((o) => o.collection === 'companies');
    expect(personSet.type).toBe('set');
    expect(companySet.type).toBe('set');
    expect(personSet.data.company_id).toBe(companySet.id);
    expect(companySet.data.contactIds).toEqual([personSet.id]);
    expect(personSet.data.interviewIds).toEqual(['iv-7']);

    const reviewUpdate = ops.find((o) => o.collection === 'dedupReviewQueue');
    expect(reviewUpdate.data.status).toBe('resolved_created_new');

    expect(result.createdPerson).toBe(true);
    expect(result.createdCompany).toBe(true);
  });

  it('contact + create_new: skips company when businessName absent', async () => {
    const item = {
      id: 'r4', entityType: 'contact', matchedEntityId: 'p1',
      sourceInterviewId: 'iv-8',
      candidateData: { ...contactEntity, businessName: null },
    };
    const result = await resolveReview(item, 'create_new');
    const ops = getOps();
    expect(ops.some((o) => o.collection === 'companies')).toBe(false);
    expect(result.createdCompany).toBe(false);
    expect(result.createdPerson).toBe(true);
  });

  it('business + merge: creates person at matched company, appends to contactIds', async () => {
    getDocMock.mockImplementation(async (coll, id) => {
      if (coll === 'companies' && id === 'c9') {
        return { id: 'c9', contactIds: ['p-existing'] };
      }
      return null;
    });
    const item = {
      id: 'r5', entityType: 'business', matchedEntityId: 'c9',
      sourceInterviewId: 'iv-11', candidateData: businessEntity,
    };
    const result = await resolveReview(item, 'merge');
    const ops = getOps();

    const personSet = ops.find((o) => o.collection === 'people');
    expect(personSet.type).toBe('set');
    expect(personSet.data.company_id).toBe('c9');

    const companyUpdate = ops.find((o) => o.collection === 'companies');
    expect(companyUpdate.type).toBe('update');
    expect(companyUpdate.data.contactIds).toEqual(['p-existing', personSet.id]);

    const reviewUpdate = ops.find((o) => o.collection === 'dedupReviewQueue');
    expect(reviewUpdate.data.status).toBe('resolved_attached');

    expect(result.resolvedStatus).toBe('resolved_attached');
    expect(result.matchedBusinessId).toBe('c9');
  });

  it('business + create_new: creates both company and person', async () => {
    const item = {
      id: 'r6', entityType: 'business', matchedEntityId: 'c1',
      sourceInterviewId: 'iv-12', candidateData: businessEntity,
    };
    const result = await resolveReview(item, 'create_new');
    const ops = getOps();

    const personSet = ops.find((o) => o.collection === 'people');
    const companySet = ops.find((o) => o.collection === 'companies' && o.type === 'set');
    expect(personSet.data.company_id).toBe(companySet.id);
    expect(companySet.data.contactIds).toEqual([personSet.id]);

    const reviewUpdate = ops.find((o) => o.collection === 'dedupReviewQueue');
    expect(reviewUpdate.data.status).toBe('resolved_created_new');

    expect(result.createdPerson).toBe(true);
    expect(result.createdCompany).toBe(true);
  });

  it('skips interview update when sourceInterviewId is missing', async () => {
    const item = {
      id: 'r7', entityType: 'contact', matchedEntityId: 'p1',
      sourceInterviewId: null,
      candidateData: { ...contactEntity, businessName: null },
    };
    await resolveReview(item, 'create_new');
    const ops = getOps();
    expect(ops.some((o) => o.collection === 'interviews')).toBe(false);
  });

  it('throws on unknown entityType', async () => {
    await expect(resolveReview({ id: 'r8', entityType: 'alien' }, 'merge'))
      .rejects.toThrow(/unknown entityType/);
  });
});
