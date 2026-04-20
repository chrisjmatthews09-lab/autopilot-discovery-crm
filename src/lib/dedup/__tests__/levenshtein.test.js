import { describe, it, expect } from 'vitest';
import { levenshteinDistance, similarityPercent } from '../levenshtein.js';

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('abc', 'abc')).toBe(0);
    expect(levenshteinDistance('', '')).toBe(0);
  });
  it('returns length when one side is empty', () => {
    expect(levenshteinDistance('abc', '')).toBe(3);
    expect(levenshteinDistance('', 'abcd')).toBe(4);
  });
  it('counts single-char substitution as 1', () => {
    expect(levenshteinDistance('kitten', 'sitten')).toBe(1);
  });
  it('handles classic kitten/sitting = 3', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });
  it('counts insertion and deletion as 1 each', () => {
    expect(levenshteinDistance('abc', 'abcd')).toBe(1);
    expect(levenshteinDistance('abcd', 'abc')).toBe(1);
  });
  it('treats nullish as empty string', () => {
    expect(levenshteinDistance(null, 'abc')).toBe(3);
    expect(levenshteinDistance(undefined, '')).toBe(0);
  });
});

describe('similarityPercent', () => {
  it('returns 100 for identical strings', () => {
    expect(similarityPercent('john smith', 'john smith')).toBe(100);
  });
  it('returns 100 for empty/empty', () => {
    expect(similarityPercent('', '')).toBe(100);
  });
  it('returns 0 for completely different strings of equal length', () => {
    expect(similarityPercent('abcd', 'wxyz')).toBe(0);
  });
  it('returns higher similarity for near-matches', () => {
    const result = similarityPercent('john smith', 'jon smith');
    expect(result).toBeGreaterThanOrEqual(85);
    expect(result).toBeLessThan(100);
  });
  it('is symmetric', () => {
    expect(similarityPercent('acme co', 'acme corp')).toBe(
      similarityPercent('acme corp', 'acme co'),
    );
  });
  it('returns integer percentage (0-100)', () => {
    const result = similarityPercent('hello world', 'hallo world');
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});
