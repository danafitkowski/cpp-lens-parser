import { describe, it, expect } from 'vitest';
import { mapTasks } from '../../src/mappers/task.js';

describe('mapTasks', () => {
  it('maps raw TASK rows to Activity objects with coerced types', () => {
    const rows = [{
      task_id: '1001',
      task_code: 'A100',
      task_name: 'Foundation',
      proj_id: '1',
      wbs_id: '10',
      clndr_id: '1',
      status_code: 'TK_Complete',
      task_type: 'TT_Task',
      target_drtn_hr_cnt: '40',
      remain_drtn_hr_cnt: '0',
      act_start_date: '2024-01-15 08:00',
      act_end_date: '2024-01-19 17:00',
      target_start_date: '2024-01-15 08:00',
      target_end_date: '2024-01-19 17:00',
      early_start_date: '',
      early_end_date: '',
      late_start_date: '',
      late_end_date: '',
      total_float_hr_cnt: '0',
      free_float_hr_cnt: '0',
      phys_complete_pct: '100',
      complete_pct_type: 'CP_Drtn'
    }];

    const activities = mapTasks(rows);
    expect(activities).toHaveLength(1);
    const a = activities[0];
    expect(a.task_id).toBe(1001);
    expect(a.task_code).toBe('A100');
    expect(a.task_name).toBe('Foundation');
    expect(a.target_drtn_hr_cnt).toBe(40);
    expect(a.act_start_date.toISOString()).toBe('2024-01-15T08:00:00.000Z');
    expect(a.early_start_date).toBeNull();
    expect(a.total_float_hr_cnt).toBe(0);
    expect(a.phys_complete_pct).toBe(100);
  });

  it('preserves task_name verbatim (no rename, no trim, no escape)', () => {
    const rows = [{ task_id: '1', task_code: 'X', task_name: '  Foundation -  Block A  ', proj_id: '1', wbs_id: '1', clndr_id: '1', status_code: 'TK_NotStart', task_type: 'TT_Task', target_drtn_hr_cnt: '8', remain_drtn_hr_cnt: '8', act_start_date: '', act_end_date: '', target_start_date: '', target_end_date: '', early_start_date: '', early_end_date: '', late_start_date: '', late_end_date: '', total_float_hr_cnt: '0', free_float_hr_cnt: '0', phys_complete_pct: '0', complete_pct_type: 'CP_Drtn' }];
    expect(mapTasks(rows)[0].task_name).toBe('  Foundation -  Block A  ');
  });

  it('returns empty array for empty input', () => {
    expect(mapTasks([])).toEqual([]);
  });

  it('handles rows with missing fields by coercing absent values to null/empty', () => {
    const rows = [{ task_id: '1', task_code: 'X', task_name: 'A' }];
    const a = mapTasks(rows)[0];
    expect(a.task_id).toBe(1);
    expect(a.task_name).toBe('A');
    expect(a.target_drtn_hr_cnt).toBeNull();
    expect(a.act_start_date).toBeNull();
  });

  it('coerces driving_path_flag Y/N to boolean', () => {
    const rows = [
      { task_id: '1', task_code: 'A', task_name: 'X', driving_path_flag: 'Y' },
      { task_id: '2', task_code: 'B', task_name: 'Y', driving_path_flag: 'N' },
      { task_id: '3', task_code: 'C', task_name: 'Z' },
    ];
    const acts = mapTasks(rows);
    expect(acts[0].driving_path_flag).toBe(true);
    expect(acts[1].driving_path_flag).toBe(false);
    expect(acts[2].driving_path_flag).toBe(false);
  });

  it('preserves cstr_type string verbatim', () => {
    const rows = [{ task_id: '1', task_code: 'A', task_name: 'X', cstr_type: 'CS_MSO' }];
    expect(mapTasks(rows)[0].cstr_type).toBe('CS_MSO');
  });

  it('maps fixture-style row (only fields present in minimal-3-task.xer)', () => {
    // Mirrors the actual columns in tests/fixtures/minimal-3-task.xer TASK %F
    const rows = [{
      task_id: '1',
      task_code: 'A1',
      task_name: 'Activity One',
      proj_id: '1',
      wbs_id: 'W2',
      clndr_id: 'C1',
      status_code: 'TK_NotStart',
      task_type: 'TT_Task',
      phys_complete_pct: '0',
      target_drtn_hr_cnt: '40',
      remain_drtn_hr_cnt: '40',
      total_float_hr_cnt: '0',
      target_start_date: '2026-02-01 08:00',
      target_end_date: '2026-02-07 16:00',
      driving_path_flag: 'Y',
      cstr_type: 'CS_MSO',
    }];
    const a = mapTasks(rows)[0];
    expect(a.task_id).toBe(1);
    expect(a.task_code).toBe('A1');
    expect(a.task_name).toBe('Activity One');
    expect(a.phys_complete_pct).toBe(0);
    expect(a.target_drtn_hr_cnt).toBe(40);
    expect(a.total_float_hr_cnt).toBe(0);
    expect(a.target_start_date.toISOString()).toBe('2026-02-01T08:00:00.000Z');
    expect(a.target_end_date.toISOString()).toBe('2026-02-07T16:00:00.000Z');
    expect(a.driving_path_flag).toBe(true);
    expect(a.cstr_type).toBe('CS_MSO');
    // Fields absent from fixture → graceful null/empty
    expect(a.act_start_date).toBeNull();
    expect(a.act_end_date).toBeNull();
    expect(a.early_start_date).toBeNull();
    expect(a.free_float_hr_cnt).toBeNull();
    expect(a.complete_pct_type).toBe('');
  });
});
