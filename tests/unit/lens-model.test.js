import { describe, it, expect } from 'vitest';
import { createEmptyModel } from '../../src/lens-model.js';

describe('LensModel', () => {
  it('createEmptyModel returns a model with all top-level keys present', () => {
    const m = createEmptyModel();
    expect(m).toMatchObject({
      meta: { source: null, sha256: null, parsedAt: null, isHalfStep: false, fileSizeBytes: 0 },
      projects: [],
      calendars: [],
      wbs: null,
      activities: [],
      relationships: [],
      resources: [],
      assignments: [],
      codes: { types: [], values: [], taskLinks: [] },
      udfs: { types: [], values: [] },
      memoTypes: [],
      memos: [],
      derived: {}
    });
  });

  it('createEmptyModel returns a fresh object each call (no shared references)', () => {
    const a = createEmptyModel();
    const b = createEmptyModel();
    a.activities.push({ id: 1 });
    expect(b.activities).toEqual([]);
  });
});
