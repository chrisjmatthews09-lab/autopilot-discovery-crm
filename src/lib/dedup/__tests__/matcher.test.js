import { describe, it, expect } from 'vitest';
import { scoreMatch, findBestMatch } from '../matcher.js';

describe('scoreMatch', () => {
  it('returns tier1_email on exact email match regardless of name', () => {
    const result = scoreMatch(
      { email: 'John@Example.com', firstName: 'John', lastName: 'Smith', businessName: 'Acme' },
      { email: 'john@example.com', firstName: 'Completely', lastName: 'Different', businessName: 'Other Co' },
    );
    expect(result.tier).toBe('tier1_email');
    expect(result.confidence).toBe(100);
  });

  it('returns tier2_name_business when both signals are strong', () => {
    const result = scoreMatch(
      { firstName: 'John', lastName: 'Smith', businessName: 'Acme Corp' },
      { firstName: 'John', lastName: 'Smith', businessName: 'Acme Corporation' },
    );
    expect(result.tier).toBe('tier2_name_business');
    expect(result.nameMatch).toBe(100);
    expect(result.businessMatch).toBe(100);
    expect(result.confidence).toBe(100);
  });

  it('returns tier3_review for near-match name with reasonable business match', () => {
    const result = scoreMatch(
      { firstName: 'Jon', lastName: 'Smith', businessName: 'Acme Consulting' },
      { firstName: 'John', lastName: 'Smith', businessName: 'Acme Consultants' },
    );
    expect(['tier2_name_business', 'tier3_review']).toContain(result.tier);
    expect(result.nameMatch).toBeGreaterThanOrEqual(80);
    expect(result.businessMatch).toBeGreaterThanOrEqual(70);
  });

  it('returns new when both signals are weak', () => {
    const result = scoreMatch(
      { firstName: 'Alice', lastName: 'Jones', businessName: 'Zed Systems' },
      { firstName: 'Bob', lastName: 'Williams', businessName: 'Omega Group' },
    );
    expect(result.tier).toBe('new');
  });

  it('handles missing business on one side (name-only signal)', () => {
    const result = scoreMatch(
      { firstName: 'John', lastName: 'Smith' },
      { firstName: 'John', lastName: 'Smith', businessName: 'Acme' },
    );
    expect(result.nameMatch).toBe(100);
    expect(result.businessMatch).toBe(0);
    expect(result.tier).toBe('new');
  });

  it('accepts legacy single-field name and company properties', () => {
    const result = scoreMatch(
      { name: 'John Smith', company: 'Acme Corp' },
      { name: 'John Smith', company: 'Acme Corporation' },
    );
    expect(result.tier).toBe('tier2_name_business');
  });

  it('returns a new tier for missing candidate or existing', () => {
    expect(scoreMatch(null, { email: 'a@b.com' }).tier).toBe('new');
    expect(scoreMatch({ email: 'a@b.com' }, null).tier).toBe('new');
  });

  it('uses confidence formula nameMatch*0.6 + businessMatch*0.4', () => {
    const result = scoreMatch(
      { firstName: 'John', lastName: 'Smith', businessName: 'Acme Corp' },
      { firstName: 'John', lastName: 'Smith', businessName: 'Zed Inc' },
    );
    const expected = Math.round(result.nameMatch * 0.6 + result.businessMatch * 0.4);
    expect(result.confidence).toBe(expected);
  });
});

describe('findBestMatch', () => {
  const existing = [
    { id: '1', firstName: 'John', lastName: 'Smith', businessName: 'Acme Corp', appType: 'crm' },
    { id: '2', firstName: 'Jane', lastName: 'Doe', email: 'jane@doe.com', businessName: 'Globex', appType: 'crm' },
    { id: '3', firstName: 'John', lastName: 'Smith', businessName: 'Acme Co', appType: 'deal_flow' },
  ];

  it('returns new when list is empty', () => {
    const result = findBestMatch({ firstName: 'X', lastName: 'Y' }, []);
    expect(result.tier).toBe('new');
    expect(result.match).toBeNull();
  });

  it('filters by appType when provided', () => {
    const result = findBestMatch(
      { firstName: 'John', lastName: 'Smith', businessName: 'Acme Corporation' },
      existing,
      { appType: 'crm' },
    );
    expect(result.match?.id).toBe('1');
  });

  it('filters by appType from candidate', () => {
    const result = findBestMatch(
      { firstName: 'John', lastName: 'Smith', businessName: 'Acme Corporation', appType: 'deal_flow' },
      existing,
    );
    expect(result.match?.id).toBe('3');
  });

  it('prioritizes exact email match over name/business', () => {
    const result = findBestMatch(
      { firstName: 'Different', lastName: 'Person', email: 'jane@doe.com', appType: 'crm' },
      existing,
    );
    expect(result.tier).toBe('tier1_email');
    expect(result.match?.id).toBe('2');
  });

  it('returns highest-confidence match among candidates', () => {
    const pool = [
      { id: 'a', firstName: 'John', lastName: 'Smithe', businessName: 'Acme' },
      { id: 'b', firstName: 'John', lastName: 'Smith', businessName: 'Acme Corp' },
      { id: 'c', firstName: 'Bob', lastName: 'Jones', businessName: 'Other' },
    ];
    const result = findBestMatch(
      { firstName: 'John', lastName: 'Smith', businessName: 'Acme Corp' },
      pool,
    );
    expect(result.match?.id).toBe('b');
    expect(result.result.confidence).toBe(100);
  });

  it('returns tier new with null match when nothing crosses thresholds', () => {
    const result = findBestMatch(
      { firstName: 'Unique', lastName: 'Person', businessName: 'Zebra LLC' },
      [{ firstName: 'Someone', lastName: 'Else', businessName: 'Unrelated Co' }],
    );
    expect(result.tier).toBe('new');
    expect(result.match).toBeNull();
  });
});
