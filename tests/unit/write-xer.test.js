import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseXer } from '../../src/parse-xer.js';
import { writeXer } from '../../src/write-xer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, '..', 'fixtures');

describe('writeXer round-trip', () => {
  const fixtures = readdirSync(FIX).filter(f => f.endsWith('.xer'));

  for (const fixture of fixtures) {
    it(`round-trips ${fixture} (ermhdr + tables byte-identical after parse→write→parse)`, () => {
      const text = readFileSync(join(FIX, fixture), 'utf-8');
      const m1 = parseXer(text);
      const rewritten = writeXer(m1);
      const m2 = parseXer(rewritten);

      // Compare ermhdr and tables only (parse_timestamp and other meta diverge).
      expect(m2.ermhdr).toEqual(m1.ermhdr);
      expect(Object.keys(m2.tables)).toEqual(Object.keys(m1.tables));
      for (const name of Object.keys(m1.tables)) {
        expect(m2.tables[name].fields).toEqual(m1.tables[name].fields);
        expect(m2.tables[name].records).toEqual(m1.tables[name].records);
      }
    });
  }

  it('emits ERMHDR even when ermhdr.raw is absent (synthesizes from fields)', () => {
    const m = {
      ermhdr: { version: '24.12', export_date: '2024-01-15', user: 'admin', database: 'dbx', currency: 'USD' },
      tables: {}
    };
    const out = writeXer(m);
    expect(out).toMatch(/^ERMHDR\t24\.12\t2024-01-15\tadmin\tdbx\tUSD/);
  });

  it('synthesizes ERMHDR from XML-shape keys (exportdate/db) when canonical keys absent', () => {
    // parseP6Xml emits { version, exportdate, project, user, db } — no raw, and
    // no export_date/database. The synthesize branch must populate the header
    // from those aliases, not blank them (regression: writeXer(parseP6Xml(xml))
    // produced a header with empty export-date and database).
    const m = {
      ermhdr: { version: '19.12', exportdate: '2026-02-13', project: 'P1', user: 'admin', db: 'CPP_Demo' },
      tables: {}
    };
    const parts = writeXer(m).split('\n')[0].split('\t');
    expect(parts[0]).toBe('ERMHDR');
    expect(parts[1]).toBe('19.12');      // version
    expect(parts[2]).toBe('2026-02-13'); // export date (from .exportdate alias)
    expect(parts[3]).toBe('admin');      // user
    expect(parts[4]).toBe('CPP_Demo');   // database (from .db alias)
  });

  it('preserves ermhdr.raw verbatim when present', () => {
    const m = {
      ermhdr: { raw: ['ERMHDR', '24.12', '2024-01-15', 'admin', 'dbx', 'USD'], version: '24.12' },
      tables: {}
    };
    const out = writeXer(m);
    expect(out.split('\n')[0]).toBe('ERMHDR\t24.12\t2024-01-15\tadmin\tdbx\tUSD');
  });

  it('emits empty tables (with %T %F and zero %R lines)', () => {
    const m = {
      ermhdr: {},
      tables: { EMPTY: { fields: ['x', 'y'], records: [] } }
    };
    const out = writeXer(m);
    expect(out).toContain('%T\tEMPTY');
    expect(out).toContain('%F\tx\ty');
    expect(out).not.toContain('%R');
  });

  it('emits %E at end', () => {
    const m = { ermhdr: {}, tables: { A: { fields: ['x'], records: [{ x: '1' }] } } };
    const out = writeXer(m);
    expect(out.trimEnd().split('\n').pop()).toBe('%E');
  });

  it('emits tables in insertion order', () => {
    const m = {
      ermhdr: {},
      tables: {
        ZULU: { fields: ['x'], records: [{ x: '1' }] },
        ALPHA: { fields: ['y'], records: [{ y: '2' }] },
        MIKE: { fields: ['z'], records: [{ z: '3' }] }
      }
    };
    const out = writeXer(m);
    const tableLines = out.split('\n').filter(l => l.startsWith('%T\t'));
    expect(tableLines).toEqual(['%T\tZULU', '%T\tALPHA', '%T\tMIKE']);
  });

  it('uses empty string for missing fields in a record', () => {
    const m = { ermhdr: {}, tables: { T: { fields: ['a', 'b', 'c'], records: [{ a: '1', c: '3' }] } } };
    const out = writeXer(m);
    expect(out).toContain('%R\t1\t\t3');
  });
});
