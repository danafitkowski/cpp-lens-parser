import { describe, it, expect } from 'vitest';
import { parseTables } from '../../src/utils/tables.js';

describe('parseTables', () => {
  it('extracts a single table with two rows', () => {
    const xer = [
      '%T\tTASK',
      '%F\ttask_id\ttask_name\tstatus_code',
      '%R\t1001\tFoundation\tTK_Complete',
      '%R\t1002\tFraming\tTK_Active',
      '%E'
    ].join('\n');
    const tables = parseTables(xer);
    expect(tables.TASK).toHaveLength(2);
    expect(tables.TASK[0]).toEqual({
      task_id: '1001',
      task_name: 'Foundation',
      status_code: 'TK_Complete'
    });
    expect(tables.TASK[1].task_name).toBe('Framing');
  });

  it('handles multiple tables in sequence', () => {
    const xer = [
      '%T\tPROJECT',
      '%F\tproj_id\tproj_short_name',
      '%R\t1\tDemo',
      '%T\tTASK',
      '%F\ttask_id\ttask_name',
      '%R\t100\tAlpha',
      '%E'
    ].join('\n');
    const tables = parseTables(xer);
    expect(Object.keys(tables)).toEqual(['PROJECT', 'TASK']);
    expect(tables.PROJECT[0].proj_short_name).toBe('Demo');
  });

  it('ignores ERMHDR and trailing whitespace', () => {
    const xer = [
      'ERMHDR\t19.12\t2024-01-15\tProject\tdana\tDana Fitkowski\tdbxApiXmlExport\tUS\tEnglish\tUTF-8',
      '%T\tPROJECT',
      '%F\tproj_id',
      '%R\t1',
      '',
      '   '
    ].join('\n');
    const tables = parseTables(xer);
    expect(tables.PROJECT).toHaveLength(1);
  });

  it('returns empty object for empty input', () => {
    expect(parseTables('')).toEqual({});
  });

  it('handles rows with embedded empty fields', () => {
    const xer = [
      '%T\tTASK',
      '%F\ttask_id\ttask_name\tnotes',
      '%R\t1\tAlpha\t',
      '%R\t2\t\tBravo'
    ].join('\n');
    const tables = parseTables(xer);
    expect(tables.TASK[0].notes).toBe('');
    expect(tables.TASK[1].task_name).toBe('');
  });

  it('handles CRLF line endings (Windows-style XER)', () => {
    const xer = '%T\tTASK\r\n%F\ttask_id\r\n%R\t1\r\n%E\r\n';
    expect(parseTables(xer).TASK).toEqual([{ task_id: '1' }]);
  });
});
