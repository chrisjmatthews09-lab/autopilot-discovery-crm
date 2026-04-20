import { describe, it, expect } from 'vitest';
import {
  normalizeEmail,
  normalizePhone,
  normalizeName,
  normalizeBusinessName,
  buildFullName,
} from '../normalize.js';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  John@Example.COM ')).toBe('john@example.com');
  });
  it('returns null for empty/nullish input', () => {
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});

describe('normalizePhone', () => {
  it('strips non-digits', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('5551234567');
    expect(normalizePhone('+1.555.123.4567')).toBe('15551234567');
  });
  it('returns null when no digits present', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
  });
});

describe('normalizeName', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normalizeName("John-O'Brien ")).toBe('johnobrien');
    expect(normalizeName('  Jane   Doe  ')).toBe('jane doe');
  });
  it('handles empty/nullish input', () => {
    expect(normalizeName('')).toBe('');
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});

describe('normalizeBusinessName', () => {
  it('strips common suffixes', () => {
    expect(normalizeBusinessName('Smith Consulting LLC')).toBe('smith consulting');
    expect(normalizeBusinessName('Acme Corporation')).toBe('acme');
    expect(normalizeBusinessName('Foo Inc.')).toBe('foo');
    expect(normalizeBusinessName('Bar PLLC')).toBe('bar');
    expect(normalizeBusinessName('Baz Ltd')).toBe('baz');
  });
  it('is case-insensitive for suffixes', () => {
    expect(normalizeBusinessName('Acme corp')).toBe('acme');
    expect(normalizeBusinessName('Acme CORP')).toBe('acme');
  });
  it('handles trailing whitespace and punctuation', () => {
    expect(normalizeBusinessName('  Acme,   Inc.  ')).toBe('acme');
  });
  it('handles stacked suffixes', () => {
    expect(normalizeBusinessName('Acme Inc LLC')).toBe('acme');
  });
  it('returns empty string for nullish', () => {
    expect(normalizeBusinessName(null)).toBe('');
    expect(normalizeBusinessName('')).toBe('');
  });
});

describe('buildFullName', () => {
  it('joins and normalizes first/last', () => {
    expect(buildFullName('John', 'Smith')).toBe('john smith');
    expect(buildFullName(' Jane ', ' Doe ')).toBe('jane doe');
  });
  it('handles missing parts', () => {
    expect(buildFullName('John', '')).toBe('john');
    expect(buildFullName('', 'Smith')).toBe('smith');
    expect(buildFullName(null, null)).toBe('');
  });
});
