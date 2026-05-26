import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseXer } from '../../src/parse-xer.js';
import { buildUdfMap } from '../../src/derived/udfs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, '..', 'fixtures');

function loadFixture(name) {
  return parseXer(readFileSync(join(FIX, name), 'utf-8'));
}

describe('buildUdfMap', () => {
  // ── with-udfs.xer fixture ─────────────────────────────────────────────────
  // UDFTYPE: U1 → table_name=TASK, label="Task Note", name=task_note
  //          U2 → table_name=PROJECT, label="Risk Score", name=risk_score
  // UDFVALUE: U1 fk_id=100 udf_text=task-note-value
  //           U2 fk_id=1   udf_text=project-note-value

  it('returns a Map instance', () => {
    const model = loadFixture('with-udfs.xer');
    const umap = buildUdfMap(model);
    expect(umap).toBeInstanceOf(Map);
  });

  it('contains the TASK::100 composite key', () => {
    const model = loadFixture('with-udfs.xer');
    const umap = buildUdfMap(model);
    expect(umap.has('TASK::100')).toBe(true);
  });

  it('contains the PROJECT::1 composite key', () => {
    const model = loadFixture('with-udfs.xer');
    const umap = buildUdfMap(model);
    expect(umap.has('PROJECT::1')).toBe(true);
  });

  it('TASK::100 entry has correct label, name, value', () => {
    const model = loadFixture('with-udfs.xer');
    const umap = buildUdfMap(model);
    const entries = umap.get('TASK::100');
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBe(1);
    expect(entries[0].label).toBe('Task Note');
    expect(entries[0].name).toBe('task_note');
    expect(entries[0].value).toBe('task-note-value');
  });

  it('PROJECT::1 entry has correct label, name, value', () => {
    const model = loadFixture('with-udfs.xer');
    const umap = buildUdfMap(model);
    const entries = umap.get('PROJECT::1');
    expect(Array.isArray(entries)).toBe(true);
    expect(entries[0].label).toBe('Risk Score');
    expect(entries[0].name).toBe('risk_score');
    expect(entries[0].value).toBe('project-note-value');
  });

  it('value falls back to udf_number when udf_text is empty', () => {
    const model = {
      tables: {
        UDFTYPE: {
          fields: ['udf_type_id', 'table_name', 'udf_type_label', 'udf_type_name'],
          records: [{ udf_type_id: 'U1', table_name: 'TASK', udf_type_label: 'Score', udf_type_name: 'score' }],
        },
        UDFVALUE: {
          fields: ['udf_type_id', 'fk_id', 'udf_text', 'udf_number', 'udf_date'],
          records: [{ udf_type_id: 'U1', fk_id: '42', udf_text: '', udf_number: '99', udf_date: '' }],
        },
      },
    };
    const umap = buildUdfMap(model);
    expect(umap.get('TASK::42')[0].value).toBe('99');
  });

  it('value falls back to udf_date when udf_text and udf_number are empty', () => {
    const model = {
      tables: {
        UDFTYPE: {
          fields: ['udf_type_id', 'table_name', 'udf_type_label', 'udf_type_name'],
          records: [{ udf_type_id: 'U1', table_name: 'RSRC', udf_type_label: 'Start', udf_type_name: 'start_date' }],
        },
        UDFVALUE: {
          fields: ['udf_type_id', 'fk_id', 'udf_text', 'udf_number', 'udf_date'],
          records: [{ udf_type_id: 'U1', fk_id: '7', udf_text: '', udf_number: '', udf_date: '2026-01-15' }],
        },
      },
    };
    const umap = buildUdfMap(model);
    expect(umap.get('RSRC::7')[0].value).toBe('2026-01-15');
  });

  it('multiple UDF values for the same (table, fk_id) are accumulated in one array', () => {
    const model = {
      tables: {
        UDFTYPE: {
          fields: ['udf_type_id', 'table_name', 'udf_type_label', 'udf_type_name'],
          records: [
            { udf_type_id: 'U1', table_name: 'TASK', udf_type_label: 'Note1', udf_type_name: 'n1' },
            { udf_type_id: 'U2', table_name: 'TASK', udf_type_label: 'Note2', udf_type_name: 'n2' },
          ],
        },
        UDFVALUE: {
          fields: ['udf_type_id', 'fk_id', 'udf_text', 'udf_number', 'udf_date'],
          records: [
            { udf_type_id: 'U1', fk_id: '10', udf_text: 'alpha', udf_number: '', udf_date: '' },
            { udf_type_id: 'U2', fk_id: '10', udf_text: 'beta',  udf_number: '', udf_date: '' },
          ],
        },
      },
    };
    const umap = buildUdfMap(model);
    expect(umap.get('TASK::10').length).toBe(2);
  });

  it('different fk_ids for the same table produce separate keys', () => {
    const model = {
      tables: {
        UDFTYPE: {
          fields: ['udf_type_id', 'table_name', 'udf_type_label', 'udf_type_name'],
          records: [{ udf_type_id: 'U1', table_name: 'TASK', udf_type_label: 'L', udf_type_name: 'n' }],
        },
        UDFVALUE: {
          fields: ['udf_type_id', 'fk_id', 'udf_text', 'udf_number', 'udf_date'],
          records: [
            { udf_type_id: 'U1', fk_id: '1', udf_text: 'v1', udf_number: '', udf_date: '' },
            { udf_type_id: 'U1', fk_id: '2', udf_text: 'v2', udf_number: '', udf_date: '' },
          ],
        },
      },
    };
    const umap = buildUdfMap(model);
    expect(umap.has('TASK::1')).toBe(true);
    expect(umap.has('TASK::2')).toBe(true);
    expect(umap.get('TASK::1')[0].value).toBe('v1');
    expect(umap.get('TASK::2')[0].value).toBe('v2');
  });

  // ── edge case: empty/absent tables ───────────────────────────────────────

  it('returns empty Map when model has no UDFVALUE', () => {
    const umap = buildUdfMap({ tables: {} });
    expect(umap).toBeInstanceOf(Map);
    expect(umap.size).toBe(0);
  });

  it('returns empty Map for null model', () => {
    const umap = buildUdfMap(null);
    expect(umap).toBeInstanceOf(Map);
    expect(umap.size).toBe(0);
  });

  it('returns empty Map when UDFVALUE records array is empty', () => {
    const model = {
      tables: {
        UDFTYPE:  { fields: ['udf_type_id'], records: [] },
        UDFVALUE: { fields: ['udf_type_id', 'fk_id'], records: [] },
      },
    };
    const umap = buildUdfMap(model);
    expect(umap.size).toBe(0);
  });

  // ── index.js re-export ────────────────────────────────────────────────────

  it('is re-exported from the package index', async () => {
    const pkg = await import('../../src/index.js');
    expect(typeof pkg.buildUdfMap).toBe('function');
  });
});
