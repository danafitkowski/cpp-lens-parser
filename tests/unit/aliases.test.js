import { describe, it, expect } from 'vitest';
import { createEmptyModel } from '../../src/lens-model.js';
import { getTableAliased, TABLE_ALIASES } from '../../src/access.js';

function makeModel(tableName, records) {
  const m = createEmptyModel();
  m.tables[tableName] = { fields: Object.keys(records[0] || {}), records };
  return m;
}

describe('getTableAliased', () => {
  it('looks up canonical table name when alias matches', () => {
    const m = makeModel('PROJWBS', [{ wbs_id: '10', wbs_name: 'Root' }]);
    expect(getTableAliased(m, 'WBS')).toHaveLength(1);
    expect(getTableAliased(m, 'WBS')[0].wbs_name).toBe('Root');
  });

  it('looks up TASK directly', () => {
    const m = makeModel('TASK', [{ task_id: '1' }]);
    expect(getTableAliased(m, 'TASK')).toHaveLength(1);
  });

  it('REL alias maps to TASKPRED', () => {
    const m = makeModel('TASKPRED', [{ task_pred_id: '5001' }]);
    expect(getTableAliased(m, 'REL')).toHaveLength(1);
  });

  it('ASSIGN alias maps to TASKRSRC', () => {
    const m = makeModel('TASKRSRC', [{ taskrsrc_id: '1' }]);
    expect(getTableAliased(m, 'ASSIGN')).toHaveLength(1);
  });

  it('CAL alias maps to CALENDAR', () => {
    const m = makeModel('CALENDAR', [{ clndr_id: '1' }]);
    expect(getTableAliased(m, 'CAL')).toHaveLength(1);
  });

  it('returns [] for unknown alias', () => {
    expect(getTableAliased({ tables: {} }, 'NONEXISTENT')).toEqual([]);
  });

  it('returns [] for null/undefined model', () => {
    expect(getTableAliased(null, 'TASK')).toEqual([]);
    expect(getTableAliased(undefined, 'TASK')).toEqual([]);
  });

  it('non-aliased name acts as direct lookup', () => {
    const m = makeModel('CUSTOM_TABLE', [{ x: '1' }]);
    expect(getTableAliased(m, 'CUSTOM_TABLE')).toHaveLength(1);
  });

  it('TABLE_ALIASES map is exported', () => {
    expect(TABLE_ALIASES).toBeDefined();
    expect(TABLE_ALIASES.WBS).toEqual(['PROJWBS']);
    expect(TABLE_ALIASES.REL).toEqual(['TASKPRED']);
  });
});
