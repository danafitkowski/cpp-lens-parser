import { describe, it, expect } from 'vitest';
import { parseP6Date, formatP6Date } from '../../src/utils/dates.js';

describe('parseP6Date', () => {
  it('parses standard P6 date "2024-01-15 08:00"', () => {
    const d = parseP6Date('2024-01-15 08:00');
    expect(d.toISOString()).toBe('2024-01-15T08:00:00.000Z');
  });

  it('parses date-only "2024-01-15"', () => {
    const d = parseP6Date('2024-01-15');
    expect(d.toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });

  it('returns null for empty/null/undefined', () => {
    expect(parseP6Date('')).toBeNull();
    expect(parseP6Date(null)).toBeNull();
    expect(parseP6Date(undefined)).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(parseP6Date('not-a-date')).toBeNull();
  });
});

describe('formatP6Date', () => {
  it('formats a Date back to "YYYY-MM-DD HH:MM"', () => {
    const d = new Date('2024-01-15T08:00:00.000Z');
    expect(formatP6Date(d)).toBe('2024-01-15 08:00');
  });

  it('formats null/undefined as empty string', () => {
    expect(formatP6Date(null)).toBe('');
    expect(formatP6Date(undefined)).toBe('');
  });
});
