import { describe, it, expect } from 'vitest';
import { parseHeader } from '../../src/utils/header.js';

describe('parseHeader', () => {
  it('extracts ERMHDR fields from XER text', () => {
    const xer = 'ERMHDR\t19.12\t2024-01-15\tProject\tdana\tDana Fitkowski\tdbxApiXmlExport\tUS\tEnglish\tUTF-8\n%T\tPROJECT';
    expect(parseHeader(xer)).toEqual({
      version: '19.12',
      exportDate: '2024-01-15',
      exportType: 'Project',
      userLogin: 'dana',
      userName: 'Dana Fitkowski',
      databaseName: 'dbxApiXmlExport',
      currencyCode: 'US',
      language: 'English',
      encoding: 'UTF-8'
    });
  });

  it('returns null when no ERMHDR is present', () => {
    expect(parseHeader('%T\tPROJECT\n')).toBeNull();
  });

  it('handles CRLF line endings', () => {
    const xer = 'ERMHDR\t19.12\t2024-01-15\tProject\tdana\tDana\tdbx\tUS\tEnglish\tUTF-8\r\n%T\tPROJECT';
    expect(parseHeader(xer).version).toBe('19.12');
  });

  it('returns null for empty input', () => {
    expect(parseHeader('')).toBeNull();
  });
});
