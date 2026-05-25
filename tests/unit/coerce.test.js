import { describe, it, expect } from 'vitest';
import { coerceInt, coerceFloat, coerceBool } from '../../src/utils/coerce.js';

describe('coerceInt', () => {
  it('parses "42" → 42', () => expect(coerceInt('42')).toBe(42));
  it('parses "-7" → -7', () => expect(coerceInt('-7')).toBe(-7));
  it('returns null for empty', () => expect(coerceInt('')).toBeNull());
  it('returns null for null', () => expect(coerceInt(null)).toBeNull());
  it('returns null for non-numeric', () => expect(coerceInt('abc')).toBeNull());
  it('rejects partial-match "42abc" → null', () => expect(coerceInt('42abc')).toBeNull());
  it('rejects float input "3.14" → null', () => expect(coerceInt('3.14')).toBeNull());
  it('handles whitespace "  42  " → 42', () => expect(coerceInt('  42  ')).toBe(42));
});

describe('coerceFloat', () => {
  it('parses "3.14" → 3.14', () => expect(coerceFloat('3.14')).toBeCloseTo(3.14));
  it('parses "-0.5" → -0.5', () => expect(coerceFloat('-0.5')).toBeCloseTo(-0.5));
  it('returns null for empty', () => expect(coerceFloat('')).toBeNull());
  it('returns null for non-numeric', () => expect(coerceFloat('xyz')).toBeNull());
  it('rejects partial-match "3.14xyz" → null', () => expect(coerceFloat('3.14xyz')).toBeNull());
  it('rejects "Infinity" → null', () => expect(coerceFloat('Infinity')).toBeNull());
  it('handles whitespace "  3.14  " → 3.14', () => expect(coerceFloat('  3.14  ')).toBeCloseTo(3.14));
  it('parses ".5" → 0.5', () => expect(coerceFloat('.5')).toBeCloseTo(0.5));
  it('parses "5." → 5', () => expect(coerceFloat('5.')).toBeCloseTo(5));
});

describe('coerceBool', () => {
  it('parses "Y" → true', () => expect(coerceBool('Y')).toBe(true));
  it('parses "N" → false', () => expect(coerceBool('N')).toBe(false));
  it('parses "" → false', () => expect(coerceBool('')).toBe(false));
  it('parses null → false', () => expect(coerceBool(null)).toBe(false));
  it('case-insensitive: "y" → true', () => expect(coerceBool('y')).toBe(true));
});
