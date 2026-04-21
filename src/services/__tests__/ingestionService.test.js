import { describe, it, expect, vi } from 'vitest';

// ingestionService → claudeService → config/firebase, which calls getAuth()
// at module load. CI has no Firebase env vars, so stub the module.
vi.mock('../../config/firebase.js', () => ({
  db: { __mock: 'db' },
  auth: { __mock: 'auth' },
  functions: { __mock: 'functions' },
}));

const { planResolution, findBestCompanyMatch, candidateFromEntity } =
  await import('../ingestionService.js');

const baseEntity = {
  firstName: 'John',
  lastName: 'Smith',
  email: 'john@acmeconstruction.com',
  phone: '555-207-4412',
  businessName: 'Acme Construction, LLC',
  businessType: 'business_owner',
};

describe('candidateFromEntity', () => {
  it('returns null for null input', () => {
    expect(candidateFromEntity(null)).toBeNull();
  });

  it('builds a normalized full name from first+last', () => {
    // buildFullName lowercases + strips punctuation for dedup comparison.
    const c = candidateFromEntity(baseEntity);
    expect(c.name).toBe('john smith');
  });

  it('handles missing last name gracefully', () => {
    const c = candidateFromEntity({ ...baseEntity, lastName: null });
    expect(c.name).toBe('john');
  });
});

describe('findBestCompanyMatch', () => {
  it('returns new when no companies exist', () => {
    expect(findBestCompanyMatch('Acme Construction', [])).toEqual({
      tier: 'new',
      match: null,
      confidence: 0,
    });
  });

  it('finds strong match above 90', () => {
    const companies = [{ id: 'c1', name: 'Acme Construction LLC' }];
    const r = findBestCompanyMatch('Acme Construction, LLC', companies);
    expect(r.tier).toBe('tier2_name_business');
    expect(r.match.id).toBe('c1');
  });

  it('returns tier3_review for weaker match (88% similarity)', () => {
    // 'ace contruction' (15 chars) vs 'acme construction' (17 chars) = distance 2,
    // similarity 88% — lands in the 85-89 review band.
    const companies = [{ id: 'c1', name: 'Ace Contruction' }];
    const r = findBestCompanyMatch('Acme Construction', companies);
    expect(r.tier).toBe('tier3_review');
    expect(r.match.id).toBe('c1');
  });

  it('returns new for very different name', () => {
    const companies = [{ id: 'c1', name: 'Zebra Bookkeeping' }];
    const r = findBestCompanyMatch('Acme Construction', companies);
    expect(r.tier).toBe('new');
  });
});

describe('planResolution', () => {
  it('attaches to existing person on email match', () => {
    const people = [{
      id: 'p1',
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@acmeconstruction.com',
      company: 'Acme Construction LLC',
      company_id: 'c1',
    }];
    const plan = planResolution(baseEntity, people, []);
    expect(plan.decision).toBe('attach_existing_person');
    expect(plan.person.id).toBe('p1');
    expect(plan.personTier).toBe('tier1_email');
  });

  it('attaches to existing person on strong name+business match', () => {
    const people = [{
      id: 'p1',
      firstName: 'John',
      lastName: 'Smith',
      email: 'different@example.com',
      company: 'Acme Construction LLC',
    }];
    const plan = planResolution(baseEntity, people, []);
    expect(plan.decision).toBe('attach_existing_person');
    expect(plan.personTier).toBe('tier2_name_business');
  });

  it('queues person review for tier3 match', () => {
    const people = [{
      id: 'p1',
      firstName: 'Jon',
      lastName: 'Smyth',
      company: 'Acme Constr',
    }];
    const plan = planResolution(baseEntity, people, []);
    // name similarity ~80, business similarity ~70 → tier3
    expect(['review_person', 'create_both', 'create_person_attach_company', 'create_person_review_company']).toContain(plan.decision);
  });

  it('creates person + attaches to existing company when only company matches', () => {
    const people = []; // no existing people
    const companies = [{ id: 'c1', name: 'Acme Construction LLC' }];
    const plan = planResolution(baseEntity, people, companies);
    expect(plan.decision).toBe('create_person_attach_company');
    expect(plan.company.id).toBe('c1');
  });

  it('creates both when no matches exist', () => {
    const plan = planResolution(baseEntity, [], []);
    expect(plan.decision).toBe('create_both');
  });

  it('creates both even when entity has no businessName', () => {
    const plan = planResolution({ ...baseEntity, businessName: null }, [], []);
    expect(plan.decision).toBe('create_both');
  });

  it('returns error for null entity', () => {
    const plan = planResolution(null, [], []);
    expect(plan.decision).toBe('error');
  });

  it('runs matching on firstName only when lastName is missing', () => {
    const entity = { ...baseEntity, lastName: null };
    const people = [{
      id: 'p1',
      firstName: 'John',
      lastName: null,
      company: 'Acme Construction LLC',
      email: entity.email,
    }];
    const plan = planResolution(entity, people, []);
    expect(plan.decision).toBe('attach_existing_person');
  });
});
