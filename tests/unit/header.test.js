import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHeader } from '../../src/utils/header.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, '..', 'fixtures');

describe('parseHeader — canonical Python 5-field shape', () => {
  it('extracts the 5 ERMHDR fields plus raw', () => {
    const xer = 'ERMHDR\t24.12\t2024-01-15\tadmin\tdbxApiXmlExport\tUSD\n%T\tPROJECT';
    const h = parseHeader(xer);
    expect(h).toEqual({
      raw: ['ERMHDR', '24.12', '2024-01-15', 'admin', 'dbxApiXmlExport', 'USD'],
      version: '24.12',
      export_date: '2024-01-15',
      user: 'admin',
      database: 'dbxApiXmlExport',
      currency: 'USD'
    });
  });

  it('parses the real minimal-3-task.xer fixture', () => {
    const xer = readFileSync(join(FIX, 'minimal-3-task.xer'), 'utf-8');
    const h = parseHeader(xer);
    expect(h).not.toBeNull();
    expect(h.version).toBeTruthy();
    expect(h.export_date).toBeTruthy();
    // Verify NO invented fields
    expect(h.exportScope).toBeUndefined();
    expect(h.userFullName).toBeUndefined();
    expect(h.module).toBeUndefined();
    expect(h.language).toBeUndefined();
    expect(h.encoding).toBeUndefined();
  });

  it('returns null for non-ERMHDR input', () => {
    expect(parseHeader('%T\tPROJECT\n')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseHeader('')).toBeNull();
  });

  it('handles CRLF line endings', () => {
    const xer = 'ERMHDR\t24.12\t2024-01-15\tadmin\tdbx\tUSD\r\n%T\tPROJECT';
    expect(parseHeader(xer).version).toBe('24.12');
  });

  it('handles short ERMHDR (missing trailing fields)', () => {
    const xer = 'ERMHDR\t24.12\t2024-01-15\n%T\tPROJECT';
    expect(parseHeader(xer)).toEqual({
      raw: ['ERMHDR', '24.12', '2024-01-15'],
      version: '24.12',
      export_date: '2024-01-15',
      user: '',
      database: '',
      currency: ''
    });
  });
});
