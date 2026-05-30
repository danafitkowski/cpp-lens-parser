import { describe, it, expect } from 'vitest';
import { parseXer, writeXer } from '../../src/index.js';

describe('writeXer TSV integrity — embedded delimiters never corrupt rows', () => {
  function rt(records) {
    const model = {
      ermhdr: { raw: ['ERMHDR', '24.12', '2026-01-01', 'u', 'db', 'USD'] },
      tables: { TASK: { fields: ['task_id', 'task_name', 'status_code'], records } },
    };
    return parseXer(writeXer(model)).tables.TASK.records;
  }

  it('embedded TAB does not shift columns (status_code survives)', () => {
    const back = rt([{ task_id: '1', task_name: 'Pour\tConcrete', status_code: 'TK_NotStart' }]);
    expect(back.length).toBe(1);
    expect(back[0].status_code).toBe('TK_NotStart');
    expect(back[0].task_name).toBe('Pour Concrete'); // tab collapsed to space
  });

  it('embedded NEWLINE does not split the row', () => {
    const back = rt([{ task_id: '2', task_name: 'Line one\nLine two', status_code: 'TK_Active' }]);
    expect(back.length).toBe(1);
    expect(back[0].status_code).toBe('TK_Active');
    expect(back[0].task_name).toBe('Line one Line two');
  });

  it('embedded CR / CRLF does not split the row', () => {
    const back = rt([{ task_id: '3', task_name: 'A\r\nB\rC', status_code: 'TK_Complete' }]);
    expect(back.length).toBe(1);
    expect(back[0].status_code).toBe('TK_Complete');
  });

  it('multi-row file stays aligned when one row has embedded delimiters', () => {
    const back = rt([
      { task_id: '1', task_name: 'normal', status_code: 'TK_NotStart' },
      { task_id: '2', task_name: 'has\ttab\nand newline', status_code: 'TK_Active' },
      { task_id: '3', task_name: 'also normal', status_code: 'TK_Complete' },
    ]);
    expect(back.length).toBe(3);
    expect(back.map(r => r.status_code)).toEqual(['TK_NotStart', 'TK_Active', 'TK_Complete']);
    expect(back.map(r => r.task_id)).toEqual(['1', '2', '3']);
  });

  it('clean values are emitted unchanged (no regression on normal schedules)', () => {
    const back = rt([{ task_id: '1', task_name: 'Mobilize Site', status_code: 'TK_NotStart' }]);
    expect(back[0].task_name).toBe('Mobilize Site');
  });
});
