import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseXer } from '../../src/parse-xer.js';
import { buildActivityCodeMap } from '../../src/derived/activity-codes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, '..', 'fixtures');

function loadFixture(name) {
  return parseXer(readFileSync(join(FIX, name), 'utf-8'));
}

describe('buildActivityCodeMap', () => {
  // ── with-activity-codes.xer fixture ──────────────────────────────────────
  // ACTVTYPE: AT1=Phase, AT2=Area
  // ACTVCODE: AC1=CIVIL (Phase), AC2=ELEC (Phase), AC3=NORTH (Area)
  // TASKACTV: T1→AC1(Phase/CIVIL), T1→AC3(Area/NORTH), T2→AC2(Phase/ELEC)

  it('returns a non-empty map for with-activity-codes fixture', () => {
    const model = loadFixture('with-activity-codes.xer');
    const cmap = buildActivityCodeMap(model);
    expect(Object.keys(cmap).length).toBeGreaterThan(0);
  });

  it('T1 has two code assignments', () => {
    const model = loadFixture('with-activity-codes.xer');
    const cmap = buildActivityCodeMap(model);
    expect(Array.isArray(cmap['T1'])).toBe(true);
    expect(cmap['T1'].length).toBe(2);
  });

  it('T2 has one code assignment', () => {
    const model = loadFixture('with-activity-codes.xer');
    const cmap = buildActivityCodeMap(model);
    expect(Array.isArray(cmap['T2'])).toBe(true);
    expect(cmap['T2'].length).toBe(1);
  });

  it('code entry shape has type_name, code_name, code_desc', () => {
    const model = loadFixture('with-activity-codes.xer');
    const cmap = buildActivityCodeMap(model);
    for (const entries of Object.values(cmap)) {
      for (const e of entries) {
        expect(e).toHaveProperty('type_name');
        expect(e).toHaveProperty('code_name');
        expect(e).toHaveProperty('code_desc');
      }
    }
  });

  it('T1 Phase code resolves to CIVIL / Civil Works', () => {
    const model = loadFixture('with-activity-codes.xer');
    const cmap = buildActivityCodeMap(model);
    const phase = cmap['T1'].find(e => e.type_name === 'Phase');
    expect(phase).toBeDefined();
    expect(phase.code_name).toBe('CIVIL');
    expect(phase.code_desc).toBe('Civil Works');
  });

  it('T1 Area code resolves to NORTH / North Zone', () => {
    const model = loadFixture('with-activity-codes.xer');
    const cmap = buildActivityCodeMap(model);
    const area = cmap['T1'].find(e => e.type_name === 'Area');
    expect(area).toBeDefined();
    expect(area.code_name).toBe('NORTH');
    expect(area.code_desc).toBe('North Zone');
  });

  it('T2 Phase code resolves to ELEC / Electrical', () => {
    const model = loadFixture('with-activity-codes.xer');
    const cmap = buildActivityCodeMap(model);
    expect(cmap['T2'][0].type_name).toBe('Phase');
    expect(cmap['T2'][0].code_name).toBe('ELEC');
    expect(cmap['T2'][0].code_desc).toBe('Electrical');
  });

  // ── missing lookup entries → empty strings ────────────────────────────────

  it('falls back to empty strings when code or type not found', () => {
    const model = {
      tables: {
        ACTVTYPE:  { fields: ['actv_code_type_id', 'actv_code_type'], records: [] },
        ACTVCODE:  { fields: ['actv_code_id', 'actv_code_type_id', 'short_name', 'actv_code_name'], records: [] },
        TASKACTV: {
          fields: ['task_id', 'actv_code_type_id', 'actv_code_id'],
          records: [{ task_id: 'T1', actv_code_type_id: 'MISSING', actv_code_id: 'MISSING' }],
        },
      },
    };
    const cmap = buildActivityCodeMap(model);
    expect(cmap['T1'][0].type_name).toBe('');
    expect(cmap['T1'][0].code_name).toBe('');
    expect(cmap['T1'][0].code_desc).toBe('');
  });

  // ── edge case: empty/absent tables ───────────────────────────────────────

  it('returns empty object when model has no TASKACTV', () => {
    expect(buildActivityCodeMap({ tables: {} })).toEqual({});
  });

  it('returns empty object for null model', () => {
    expect(buildActivityCodeMap(null)).toEqual({});
  });

  it('returns empty object when TASKACTV records array is empty', () => {
    const model = {
      tables: {
        ACTVTYPE:  { fields: ['actv_code_type_id'], records: [] },
        ACTVCODE:  { fields: ['actv_code_id'],      records: [] },
        TASKACTV:  { fields: ['task_id'],            records: [] },
      },
    };
    expect(buildActivityCodeMap(model)).toEqual({});
  });
});
