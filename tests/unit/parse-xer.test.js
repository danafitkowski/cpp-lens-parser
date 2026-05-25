import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseXer } from '../../src/parse-xer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, '..', 'fixtures');

describe('parseXer end-to-end', () => {
  it('parses minimal-3-task.xer into the canonical shape', () => {
    const text = readFileSync(join(FIX, 'minimal-3-task.xer'), 'utf-8');
    const m = parseXer(text, { filename: 'minimal-3-task.xer', filepath: join(FIX, 'minimal-3-task.xer') });
    expect(m.ermhdr.version).toBeTruthy();
    expect(m.ermhdr.raw).toBeInstanceOf(Array);
    expect(m.tables.PROJECT).toBeDefined();
    expect(m.tables.PROJECT.fields).toBeInstanceOf(Array);
    expect(m.tables.PROJECT.records).toBeInstanceOf(Array);
    expect(m.tables.PROJECT.records.length).toBeGreaterThan(0);
    expect(m.tables.TASK.records.length).toBeGreaterThan(0);

    // Every record value is a string (passthrough, no coercion)
    for (const r of m.tables.TASK.records) {
      for (const v of Object.values(r)) {
        expect(typeof v).toBe('string');
      }
    }

    // Meta fields
    expect(m.filename).toBe('minimal-3-task.xer');
    expect(m.filepath).toBeTruthy();
    expect(m.parse_timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('preserves table insertion order', () => {
    const xer = ['%T\tA', '%F\tx', '%R\t1',
                 '%T\tB', '%F\ty', '%R\t2',
                 '%T\tC', '%F\tz', '%R\t3'].join('\n');
    const m = parseXer(xer);
    expect(Object.keys(m.tables)).toEqual(['A', 'B', 'C']);
  });

  it('produces empty ermhdr/tables for empty input', () => {
    const m = parseXer('');
    expect(m.ermhdr).toEqual({});
    expect(m.tables).toEqual({});
    // meta fields still populated
    expect(m.parse_timestamp).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('pads missing trailing fields with empty strings', () => {
    const xer = ['%T\tT', '%F\ta\tb\tc', '%R\t1\t2'].join('\n');
    const m = parseXer(xer);
    expect(m.tables.T.records[0]).toEqual({ a: '1', b: '2', c: '' });
  });

  it('handles CRLF line endings', () => {
    const xer = 'ERMHDR\t24.12\t2024-01-15\tadmin\tdbx\tUSD\r\n%T\tT\r\n%F\tx\r\n%R\t1\r\n%E\r\n';
    const m = parseXer(xer);
    expect(m.ermhdr.version).toBe('24.12');
    expect(m.tables.T.records).toEqual([{ x: '1' }]);
  });

  it('parses each real fixture without crashing', () => {
    const fixtures = ['minimal-3-task.xer', 'progress-states.xer', 'negative-lag.xer',
                      'with-udfs.xer', 'constraint-types.xer', 'deep-wbs.xer'];
    for (const fname of fixtures) {
      const text = readFileSync(join(FIX, fname), 'utf-8');
      const m = parseXer(text, { filename: fname });
      expect(Object.keys(m.tables).length).toBeGreaterThan(0);
      // Spot-check that every record is an object of strings
      for (const tdef of Object.values(m.tables)) {
        for (const rec of tdef.records) {
          for (const v of Object.values(rec)) {
            expect(typeof v).toBe('string');
          }
        }
      }
    }
  });

  it('accepts opts.encoding_used and stores it', () => {
    const m = parseXer('%T\tA\n%F\tx\n%R\t1\n', { encoding_used: 'utf-8-sig' });
    expect(m.encoding_used).toBe('utf-8-sig');
  });
});
