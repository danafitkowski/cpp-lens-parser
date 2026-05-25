import { describe, it, expect } from 'vitest';
import { createEmptyModel } from '../../src/lens-model.js';
import { getTable, getFields } from '../../src/access.js';

describe('access helpers', () => {
  function makeModel() {
    const m = createEmptyModel();
    m.tables.TASK = {
      fields: ['task_id', 'task_name'],
      records: [
        { task_id: '1', task_name: 'Foundation' },
        { task_id: '2', task_name: 'Framing' }
      ]
    };
    return m;
  }

  it('getTable returns the records list for a known table', () => {
    const m = makeModel();
    expect(getTable(m, 'TASK')).toHaveLength(2);
    expect(getTable(m, 'TASK')[0].task_name).toBe('Foundation');
  });

  it('getTable returns [] for unknown table', () => {
    expect(getTable(makeModel(), 'NONEXISTENT')).toEqual([]);
  });

  it('getTable returns [] for null/undefined model', () => {
    expect(getTable(null, 'TASK')).toEqual([]);
    expect(getTable(undefined, 'TASK')).toEqual([]);
  });

  it('getTable returns [] when tables key missing', () => {
    expect(getTable({}, 'TASK')).toEqual([]);
  });

  it('getFields returns the fields list for a known table', () => {
    expect(getFields(makeModel(), 'TASK')).toEqual(['task_id', 'task_name']);
  });

  it('getFields returns [] for unknown table', () => {
    expect(getFields(makeModel(), 'NONEXISTENT')).toEqual([]);
  });

  it('getFields returns [] for null/undefined model', () => {
    expect(getFields(null, 'TASK')).toEqual([]);
    expect(getFields(undefined, 'TASK')).toEqual([]);
  });
});
