import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseXer } from '../../src/parse-xer.js';
import { buildWbsMap } from '../../src/derived/wbs-map.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, '..', 'fixtures');

// ─── helpers ─────────────────────────────────────────────────────────────────

function loadFixture(name) {
  return parseXer(readFileSync(join(FIX, name), 'utf-8'));
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('buildWbsMap', () => {
  // ── fixture: deep-wbs.xer (Root > Child > GrandChild) ────────────────────

  it('returns a non-empty map for deep-wbs fixture', () => {
    const model = loadFixture('deep-wbs.xer');
    const wmap = buildWbsMap(model);
    expect(Object.keys(wmap).length).toBeGreaterThan(0);
  });

  it('every record has wbs_id and _full_path', () => {
    const model = loadFixture('deep-wbs.xer');
    const wmap = buildWbsMap(model);
    for (const w of Object.values(wmap)) {
      expect(w).toHaveProperty('wbs_id');
      expect(w).toHaveProperty('_full_path');
      expect(typeof w._full_path).toBe('string');
    }
  });

  it('root node path equals its own name (no parent)', () => {
    const model = loadFixture('deep-wbs.xer');
    const wmap = buildWbsMap(model);
    // W1 has empty parent_wbs_id — path should just be "Root"
    expect(wmap['W1']._full_path).toBe('Root');
  });

  it('child path includes parent name separated by " > "', () => {
    const model = loadFixture('deep-wbs.xer');
    const wmap = buildWbsMap(model);
    // W2 parent=W1 → "Root > Child"
    expect(wmap['W2']._full_path).toBe('Root > Child');
  });

  it('grandchild path is full three-level breadcrumb', () => {
    const model = loadFixture('deep-wbs.xer');
    const wmap = buildWbsMap(model);
    // W3 parent=W2 parent=W1 → "Root > Child > GrandChild"
    expect(wmap['W3']._full_path).toBe('Root > Child > GrandChild');
  });

  it('keys of the returned map match wbs_id values', () => {
    const model = loadFixture('deep-wbs.xer');
    const wmap = buildWbsMap(model);
    for (const [key, record] of Object.entries(wmap)) {
      expect(key).toBe(record.wbs_id);
    }
  });

  // ── edge case: empty/absent PROJWBS ──────────────────────────────────────

  it('returns empty object when model has no PROJWBS table', () => {
    expect(buildWbsMap({ tables: {} })).toEqual({});
  });

  it('returns empty object for null model', () => {
    expect(buildWbsMap(null)).toEqual({});
  });

  it('returns empty object when PROJWBS records array is empty', () => {
    const model = {
      tables: {
        PROJWBS: { fields: ['wbs_id', 'parent_wbs_id', 'wbs_name'], records: [] },
      },
    };
    expect(buildWbsMap(model)).toEqual({});
  });

  // ── cycle detection ───────────────────────────────────────────────────────

  it('throws on circular WBS hierarchy (A → B → A)', () => {
    const model = {
      tables: {
        PROJWBS: {
          fields: ['wbs_id', 'parent_wbs_id', 'wbs_name'],
          records: [
            { wbs_id: 'A', parent_wbs_id: 'B', wbs_name: 'A' },
            { wbs_id: 'B', parent_wbs_id: 'A', wbs_name: 'B' },
          ],
        },
      },
    };
    expect(() => buildWbsMap(model)).toThrow(/[Cc]ircular/);
  });

  it('throws on a self-referencing node (A → A)', () => {
    const model = {
      tables: {
        PROJWBS: {
          fields: ['wbs_id', 'parent_wbs_id', 'wbs_name'],
          records: [{ wbs_id: 'A', parent_wbs_id: 'A', wbs_name: 'Loop' }],
        },
      },
    };
    expect(() => buildWbsMap(model)).toThrow(/[Cc]ircular/);
  });

  // ── minimal-3-task fixture (two-level WBS) ────────────────────────────────

  it('works on minimal-3-task fixture (two-level WBS)', () => {
    const model = loadFixture('minimal-3-task.xer');
    const wmap = buildWbsMap(model);
    expect(wmap['W1']._full_path).toBe('Root');
    expect(wmap['W2']._full_path).toBe('Root > Child');
  });
});
