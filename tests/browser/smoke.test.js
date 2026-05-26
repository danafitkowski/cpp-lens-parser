import { describe, it, expect } from 'vitest';

describe('dist/ smoke', () => {
  it('imports parseXer from dist and parses a minimal XER', async () => {
    const lib = await import('../../dist/index.js');
    const xer = ['ERMHDR\t24.12\t2024-01-15\tx\ty\tz', '%T\tA', '%F\ta', '%R\t1', '%E'].join('\n');
    const m = lib.parseXer(xer);
    expect(m.tables.A.records[0].a).toBe('1');
  });

  it('public API surface available from dist', async () => {
    const lib = await import('../../dist/index.js');
    expect(typeof lib.parseXer).toBe('function');
    expect(typeof lib.writeXer).toBe('function');
    expect(typeof lib.getTable).toBe('function');
    expect(typeof lib.buildWbsMap).toBe('function');
  });
});
