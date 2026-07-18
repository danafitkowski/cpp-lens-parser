import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHeader } from '../../src/utils/header.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, '..', 'fixtures');

describe('parseHeader — canonical 9-field Python ERMHDR shape', () => {
  it('extracts the 9 ERMHDR fields plus raw (mirrors xer_parser.py)', () => {
    // Canonical 9-field P6 ERMHDR layout:
    //   [3]=export_flag [4]=user(login) [5]=user_full_name
    //   [6]=database [7]=module [8]=currency
    const xer =
      'ERMHDR\t24.12\t2024-01-15\tProject\tadmin\tTest User\tdbxApiXmlExport\tProject Management\tUSD\n%T\tPROJECT';
    const h = parseHeader(xer);
    expect(h).toEqual({
      raw: ['ERMHDR', '24.12', '2024-01-15', 'Project', 'admin', 'Test User', 'dbxApiXmlExport', 'Project Management', 'USD'],
      version: '24.12',
      export_date: '2024-01-15',
      export_flag: 'Project',
      user: 'admin',
      user_full_name: 'Test User',
      database: 'dbxApiXmlExport',
      module: 'Project Management',
      currency: 'USD'
    });
  });

  it('parses the real minimal-3-task.xer fixture with correct field positions', () => {
    const xer = readFileSync(join(FIX, 'minimal-3-task.xer'), 'utf-8');
    const h = parseHeader(xer);
    expect(h).not.toBeNull();
    expect(h.version).toBeTruthy();
    expect(h.export_date).toBeTruthy();
    // Fixture header: ERMHDR 24.12 2026-01-01 Project admin Test User dbxDB Project Management USD
    expect(h.export_flag).toBe('Project');
    expect(h.user).toBe('admin');
    expect(h.user_full_name).toBe('Test User');
    expect(h.database).toBe('dbxDB');
    expect(h.module).toBe('Project Management');
    expect(h.currency).toBe('USD');
  });

  it('returns null for non-ERMHDR input', () => {
    expect(parseHeader('%T\tPROJECT\n')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseHeader('')).toBeNull();
  });

  it('handles CRLF line endings', () => {
    const xer =
      'ERMHDR\t24.12\t2024-01-15\tProject\tadmin\tTest User\tdbx\tProject Management\tUSD\r\n%T\tPROJECT';
    expect(parseHeader(xer).version).toBe('24.12');
    expect(parseHeader(xer).currency).toBe('USD');
  });

  it('handles short ERMHDR (missing trailing fields) without mislabeling slots', () => {
    const xer = 'ERMHDR\t24.12\t2024-01-15\n%T\tPROJECT';
    expect(parseHeader(xer)).toEqual({
      raw: ['ERMHDR', '24.12', '2024-01-15'],
      version: '24.12',
      export_date: '2024-01-15',
      export_flag: '',
      user: '',
      user_full_name: '',
      database: '',
      module: '',
      currency: ''
    });
  });
});
