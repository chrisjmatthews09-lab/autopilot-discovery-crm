import { describe, it, expect } from 'vitest';
import {
  getIntervieweeName,
  getIntervieweeBusinessName,
  getInterviewHeadline,
  getInterviewDate,
  getInterviewTranscript,
  getInterviewSummary,
  getInterviewTranscriptUrl,
  getInterviewSummaryUrl,
  getInterviewUpdatedAt,
  formatInterviewDate,
  hasTranscript,
  hasSummary,
} from '../interviewFields.js';

describe('getIntervieweeName', () => {
  it('prefers extractedEntity first + last name', () => {
    const iv = { title: 'Zapier Title', extractedEntity: { firstName: 'Jane', lastName: 'Doe' } };
    expect(getIntervieweeName(iv)).toBe('Jane Doe');
  });
  it('works with only a first name', () => {
    expect(getIntervieweeName({ extractedEntity: { firstName: 'Jane' } })).toBe('Jane');
  });
  it('works with only a last name', () => {
    expect(getIntervieweeName({ extractedEntity: { lastName: 'Doe' } })).toBe('Doe');
  });
  it('falls back to title when extraction is missing', () => {
    expect(getIntervieweeName({ title: 'Interview with Jane' })).toBe('Interview with Jane');
  });
  it('returns null when nothing is available', () => {
    expect(getIntervieweeName({})).toBeNull();
    expect(getIntervieweeName(null)).toBeNull();
  });
});

describe('getIntervieweeBusinessName', () => {
  it('returns the extracted business name', () => {
    expect(getIntervieweeBusinessName({ extractedEntity: { businessName: 'Acme Inc' } })).toBe('Acme Inc');
  });
  it('trims whitespace', () => {
    expect(getIntervieweeBusinessName({ extractedEntity: { businessName: '  Acme  ' } })).toBe('Acme');
  });
  it('returns null when missing', () => {
    expect(getIntervieweeBusinessName({})).toBeNull();
    expect(getIntervieweeBusinessName(null)).toBeNull();
  });
});

describe('getInterviewHeadline', () => {
  it('prefers person name over business name', () => {
    const iv = { extractedEntity: { firstName: 'Jane', businessName: 'Acme' } };
    expect(getInterviewHeadline(iv)).toBe('Jane');
  });
  it('falls back to business name then title', () => {
    expect(getInterviewHeadline({ extractedEntity: { businessName: 'Acme' } })).toBe('Acme');
    expect(getInterviewHeadline({ title: 'Raw Zapier title' })).toBe('Raw Zapier title');
  });
});

describe('getInterviewDate', () => {
  it('prefers recordedAt', () => {
    expect(getInterviewDate({ recordedAt: '2026-01-02', ingestedAt: '2026-01-03' })).toBe('2026-01-02');
  });
  it('falls back to ingestedAt', () => {
    expect(getInterviewDate({ ingestedAt: '2026-01-03' })).toBe('2026-01-03');
  });
});

describe('transcript + summary accessors', () => {
  it('read modern transcript/summary fields', () => {
    const iv = { transcript: 'T', summary: 'S', transcriptDriveUrl: 'tu', summaryDriveUrl: 'su' };
    expect(getInterviewTranscript(iv)).toBe('T');
    expect(getInterviewSummary(iv)).toBe('S');
    expect(getInterviewTranscriptUrl(iv)).toBe('tu');
    expect(getInterviewSummaryUrl(iv)).toBe('su');
  });
  it('hasTranscript/hasSummary reflect text or URL availability', () => {
    expect(hasTranscript({ transcript: 'hello' })).toBe(true);
    expect(hasTranscript({ transcriptDriveUrl: 'u' })).toBe(true);
    expect(hasTranscript({})).toBe(false);
    expect(hasSummary({ summary: 'x' })).toBe(true);
    expect(hasSummary({ summaryDriveUrl: 'u' })).toBe(true);
    expect(hasSummary({})).toBe(false);
  });
});

describe('getInterviewUpdatedAt', () => {
  it('prefers enrichmentRanAt, then ingestedAt, then recordedAt', () => {
    expect(getInterviewUpdatedAt({ enrichmentRanAt: 'e', ingestedAt: 'i', recordedAt: 'r' })).toBe('e');
    expect(getInterviewUpdatedAt({ ingestedAt: 'i', recordedAt: 'r' })).toBe('i');
    expect(getInterviewUpdatedAt({ recordedAt: 'r' })).toBe('r');
    expect(getInterviewUpdatedAt({})).toBeNull();
  });
});

describe('formatInterviewDate', () => {
  it('accepts an interview object', () => {
    const out = formatInterviewDate({ recordedAt: '2026-04-18T21:46:52Z' });
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
  it('accepts a raw ISO string', () => {
    const out = formatInterviewDate('2026-04-18T21:46:52Z');
    expect(typeof out).toBe('string');
  });
  it('returns null for empty input', () => {
    expect(formatInterviewDate({})).toBeNull();
    expect(formatInterviewDate(null)).toBeNull();
    expect(formatInterviewDate('')).toBeNull();
  });
  it('echoes the raw value back when it is not a parseable date', () => {
    expect(formatInterviewDate('not-a-date')).toBe('not-a-date');
  });
});
