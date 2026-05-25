import { describe, it, expect } from 'vitest';
import { createEmptyModel } from '../../src/lens-model.js';

describe('LensModel (passthrough shape mirroring Python parse_xer)', () => {
  it('createEmptyModel returns the canonical 6-key model', () => {
    const m = createEmptyModel();
    expect(Object.keys(m).sort()).toEqual([
      'encoding_used', 'ermhdr', 'filename', 'filepath', 'parse_timestamp', 'tables'
    ]);
    expect(m.ermhdr).toEqual({});
    expect(m.tables).toEqual({});
    expect(m.filepath).toBe('');
    expect(m.filename).toBe('');
    expect(m.parse_timestamp).toBe('');
    expect(m.encoding_used).toBe('');
  });

  it('returns a fresh object each call', () => {
    const a = createEmptyModel();
    const b = createEmptyModel();
    a.tables.X = { fields: [], records: [{ foo: 'bar' }] };
    expect(b.tables).toEqual({});
  });
});
