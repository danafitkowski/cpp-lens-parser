import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseXer } from '../../src/parse-xer.js';
import { buildResourceMap } from '../../src/derived/resources.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, '..', 'fixtures');

function loadFixture(name) {
  return parseXer(readFileSync(join(FIX, name), 'utf-8'));
}

describe('buildResourceMap', () => {
  // ── with-resources.xer fixture ────────────────────────────────────────────
  // T1 has two resources (R1=John Smith, R2=Excavator)
  // T2 has one resource  (R1=John Smith)

  it('returns a non-empty map for with-resources fixture', () => {
    const model = loadFixture('with-resources.xer');
    const rmap = buildResourceMap(model);
    expect(Object.keys(rmap).length).toBeGreaterThan(0);
  });

  it('T1 has two resource assignments', () => {
    const model = loadFixture('with-resources.xer');
    const rmap = buildResourceMap(model);
    expect(Array.isArray(rmap['T1'])).toBe(true);
    expect(rmap['T1'].length).toBe(2);
  });

  it('T2 has one resource assignment', () => {
    const model = loadFixture('with-resources.xer');
    const rmap = buildResourceMap(model);
    expect(Array.isArray(rmap['T2'])).toBe(true);
    expect(rmap['T2'].length).toBe(1);
  });

  it('assignments include _rsrc_name joined from RSRC table', () => {
    const model = loadFixture('with-resources.xer');
    const rmap = buildResourceMap(model);
    const names = rmap['T1'].map(r => r._rsrc_name);
    expect(names).toContain('John Smith');
    expect(names).toContain('Excavator');
  });

  it('assignments include _rsrc_short_name joined from RSRC table', () => {
    const model = loadFixture('with-resources.xer');
    const rmap = buildResourceMap(model);
    const shorts = rmap['T1'].map(r => r._rsrc_short_name);
    expect(shorts).toContain('J.Smith');
    expect(shorts).toContain('Excav');
  });

  it('T2 assignment has correct _rsrc_name', () => {
    const model = loadFixture('with-resources.xer');
    const rmap = buildResourceMap(model);
    expect(rmap['T2'][0]._rsrc_name).toBe('John Smith');
  });

  it('assignment records preserve original TASKRSRC fields', () => {
    const model = loadFixture('with-resources.xer');
    const rmap = buildResourceMap(model);
    // The raw TASKRSRC record fields should still be present
    expect(rmap['T1'][0]).toHaveProperty('rsrc_id');
    expect(rmap['T1'][0]).toHaveProperty('task_id');
  });

  // ── rsrc_id not found in RSRC table → blank enrichment fields ─────────────

  it('sets _rsrc_name and _rsrc_short_name to empty string when rsrc_id is missing', () => {
    const model = {
      tables: {
        TASKRSRC: {
          fields: ['taskrsrc_id', 'task_id', 'rsrc_id'],
          records: [{ taskrsrc_id: '1', task_id: 'T1', rsrc_id: 'UNKNOWN' }],
        },
        RSRC: { fields: ['rsrc_id', 'rsrc_name', 'rsrc_short_name'], records: [] },
      },
    };
    const rmap = buildResourceMap(model);
    expect(rmap['T1'][0]._rsrc_name).toBe('');
    expect(rmap['T1'][0]._rsrc_short_name).toBe('');
  });

  // ── edge case: empty/absent tables ───────────────────────────────────────

  it('returns empty object when model has no TASKRSRC', () => {
    expect(buildResourceMap({ tables: {} })).toEqual({});
  });

  it('returns empty object for null model', () => {
    expect(buildResourceMap(null)).toEqual({});
  });

  it('returns empty object when TASKRSRC records array is empty', () => {
    const model = {
      tables: {
        TASKRSRC: { fields: ['taskrsrc_id', 'task_id', 'rsrc_id'], records: [] },
        RSRC: { fields: ['rsrc_id', 'rsrc_name'], records: [] },
      },
    };
    expect(buildResourceMap(model)).toEqual({});
  });
});
