import { describe, it, expect } from 'vitest';
import {
  mergeEnrichment,
  appendEnrichmentEvent,
  historyForField,
} from '../enrichmentMerge.js';

const AT = '2026-04-19T10:00:00.000Z';

describe('mergeEnrichment', () => {
  it('fills empty fields from incoming and logs filled actions', () => {
    const out = mergeEnrichment(
      {},
      { industry: 'SaaS', revenue: '$1M/yr', revenueConfidence: 80 },
      'iv-1',
      { at: AT },
    );
    expect(out.merged.industry).toBe('SaaS');
    expect(out.merged.revenue).toBe('$1M/yr');
    expect(out.merged.revenueConfidence).toBe(80);
    expect(out.changedFields.sort()).toEqual(['industry', 'revenue']);
    expect(out.enrichmentEvent.changes.every((c) => c.action === 'filled')).toBe(true);
    expect(out.enrichmentEvent.interviewId).toBe('iv-1');
    expect(out.enrichmentEvent.at).toBe(AT);
  });

  it('does not log a change when existing equals incoming', () => {
    const out = mergeEnrichment(
      { industry: 'SaaS' },
      { industry: 'SaaS' },
      'iv-1',
      { at: AT },
    );
    expect(out.changedFields).toEqual([]);
    expect(out.enrichmentEvent).toBeNull();
  });

  it('overwrites when incoming differs and confidences are absent', () => {
    const out = mergeEnrichment(
      { industry: 'Retail' },
      { industry: 'SaaS' },
      'iv-2',
      { at: AT },
    );
    expect(out.merged.industry).toBe('SaaS');
    expect(out.enrichmentEvent.changes[0]).toMatchObject({
      field: 'industry',
      from: 'Retail',
      to: 'SaaS',
      action: 'overwrote',
    });
  });

  it('suppresses overwrite when incoming confidence is below floor', () => {
    const out = mergeEnrichment(
      { industry: 'Retail', industryConfidence: 90 },
      { industry: 'SaaS', industryConfidence: 30 },
      'iv-3',
      { at: AT },
    );
    expect(out.merged.industry).toBe('Retail');
    expect(out.merged.industryConfidence).toBe(90);
    expect(out.enrichmentEvent.changes[0]).toMatchObject({
      field: 'industry',
      action: 'suppressed_low_confidence',
      incomingConfidence: 30,
      existingConfidence: 90,
    });
  });

  it('suppresses overwrite when existing confidence exceeds incoming', () => {
    const out = mergeEnrichment(
      { revenue: '$500K/yr', revenueConfidence: 85 },
      { revenue: '$1M/yr', revenueConfidence: 70 },
      'iv-4',
      { at: AT },
    );
    expect(out.merged.revenue).toBe('$500K/yr');
    expect(out.merged.revenueConfidence).toBe(85);
    expect(out.enrichmentEvent.changes[0].action).toBe('suppressed_existing_higher');
  });

  it('overwrites when incoming confidence equals or beats existing and clears floor', () => {
    const out = mergeEnrichment(
      { revenue: '$500K/yr', revenueConfidence: 70 },
      { revenue: '$1M/yr', revenueConfidence: 85 },
      'iv-5',
      { at: AT },
    );
    expect(out.merged.revenue).toBe('$1M/yr');
    expect(out.merged.revenueConfidence).toBe(85);
    expect(out.enrichmentEvent.changes[0].action).toBe('overwrote');
  });

  it('unions array fields without duplicates (case-insensitive, trim)', () => {
    const out = mergeEnrichment(
      { painPoints: ['Slow close', 'Manual reconcile'] },
      { painPoints: ['slow close', '  MANUAL RECONCILE  ', 'No visibility'] },
      'iv-6',
      { at: AT },
    );
    expect(out.merged.painPoints).toEqual(['Slow close', 'Manual reconcile', 'No visibility']);
    expect(out.enrichmentEvent.changes[0].action).toBe('unioned');
  });

  it('reports filled on an array field when existing is absent/empty', () => {
    const out = mergeEnrichment(
      {},
      { techStack: ['QBO', 'Ramp'] },
      'iv-7',
      { at: AT },
    );
    expect(out.merged.techStack).toEqual(['QBO', 'Ramp']);
    expect(out.enrichmentEvent.changes[0].action).toBe('filled');
  });

  it('ignores incoming empty values entirely', () => {
    const out = mergeEnrichment(
      { industry: 'SaaS' },
      { industry: null, painPoints: [] },
      'iv-8',
      { at: AT },
    );
    expect(out.merged.industry).toBe('SaaS');
    expect(out.enrichmentEvent).toBeNull();
  });

  it('recursively merges nested plain objects and prefixes change keys', () => {
    const out = mergeEnrichment(
      { billing: { plan: 'Starter' } },
      { billing: { plan: 'Growth', seats: 5 } },
      'iv-9',
      { at: AT },
    );
    expect(out.merged.billing.plan).toBe('Growth');
    expect(out.merged.billing.seats).toBe(5);
    const keys = out.enrichmentEvent.changes.map((c) => c.field).sort();
    expect(keys).toEqual(['billing.plan', 'billing.seats']);
  });

  it('returns null enrichmentEvent when nothing changed', () => {
    const out = mergeEnrichment(
      { industry: 'SaaS', painPoints: ['A'] },
      { industry: 'SaaS', painPoints: ['a'] },
      'iv-10',
      { at: AT },
    );
    expect(out.enrichmentEvent).toBeNull();
    expect(out.changedFields).toEqual([]);
  });

  it('respects options.fields allow-list', () => {
    const out = mergeEnrichment(
      {},
      { industry: 'SaaS', revenue: '$1M/yr' },
      'iv-11',
      { at: AT, fields: ['industry'] },
    );
    expect(out.merged.industry).toBe('SaaS');
    expect(out.merged.revenue).toBeUndefined();
  });

  it('skips overallConfidence as a tracked field but keeps it on the event', () => {
    const out = mergeEnrichment(
      {},
      { industry: 'SaaS', overallConfidence: 72 },
      'iv-12',
      { at: AT },
    );
    expect(out.changedFields).toEqual(['industry']);
    expect(out.enrichmentEvent.overallConfidence).toBe(72);
  });
});

describe('appendEnrichmentEvent', () => {
  it('appends the event and keeps history bounded', () => {
    const history = Array.from({ length: 40 }, (_, i) => ({ at: `t${i}` }));
    const event = { at: 'new' };
    const out = appendEnrichmentEvent(history, event, { max: 40 });
    expect(out).toHaveLength(40);
    expect(out[out.length - 1]).toBe(event);
    expect(out[0]).toEqual({ at: 't1' });
  });

  it('returns history unchanged when event is null', () => {
    expect(appendEnrichmentEvent(['x'], null)).toEqual(['x']);
  });

  it('initialises history when absent', () => {
    expect(appendEnrichmentEvent(undefined, { at: 'n' })).toEqual([{ at: 'n' }]);
  });
});

describe('historyForField', () => {
  it('extracts only entries for the requested field', () => {
    const history = [
      { at: 't1', interviewId: 'iv-1', overallConfidence: 80, changes: [
        { field: 'industry', from: null, to: 'SaaS', action: 'filled' },
        { field: 'revenue', from: null, to: '$1M', action: 'filled' },
      ] },
      { at: 't2', interviewId: 'iv-2', overallConfidence: 70, changes: [
        { field: 'industry', from: 'SaaS', to: 'Fintech', action: 'overwrote' },
      ] },
    ];
    const out = historyForField(history, 'industry');
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ at: 't1', action: 'filled', to: 'SaaS' });
    expect(out[1]).toMatchObject({ at: 't2', action: 'overwrote', to: 'Fintech' });
  });

  it('returns empty array for missing history', () => {
    expect(historyForField(null, 'industry')).toEqual([]);
  });
});
