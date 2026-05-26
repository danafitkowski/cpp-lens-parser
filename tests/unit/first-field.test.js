import { describe, it, expect } from 'vitest';
import { getFirstField } from '../../src/access.js';

describe('getFirstField', () => {
  it('returns first non-empty value', () => {
    const r = { task_id: '1001', task_code: 'A100' };
    expect(getFirstField(r, ['task_id', 'task_code'])).toBe('1001');
  });

  it('falls back when first key is empty', () => {
    const r = { task_id: '', task_code: 'A100' };
    expect(getFirstField(r, ['task_id', 'task_code'])).toBe('A100');
  });

  it('falls back when first key is missing', () => {
    const r = { task_code: 'A100' };
    expect(getFirstField(r, ['task_id', 'task_code'])).toBe('A100');
  });

  it('returns empty string when all keys absent', () => {
    expect(getFirstField({ x: '1' }, ['task_id', 'task_code'])).toBe('');
  });

  it('returns empty string for null record', () => {
    expect(getFirstField(null, ['task_id'])).toBe('');
    expect(getFirstField(undefined, ['task_id'])).toBe('');
  });

  it('treats null values as missing', () => {
    const r = { task_id: null, task_code: 'A100' };
    expect(getFirstField(r, ['task_id', 'task_code'])).toBe('A100');
  });

  it('preserves numeric zero (not treated as empty)', () => {
    // Records always carry string values from the parser, but be safe if a
    // caller passes a coerced model. Empty-string and null are "missing";
    // anything else (including '0' or 0) is a real value.
    expect(getFirstField({ x: 0 }, ['x'])).toBe(0);
    expect(getFirstField({ x: '0' }, ['x'])).toBe('0');
  });
});
