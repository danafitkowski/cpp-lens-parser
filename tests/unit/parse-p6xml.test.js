// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseP6Xml, getTable, getFields } from '../../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, '..', 'fixtures');

const XML = readFileSync(join(FIX, 'minimal-3-task.xml'), 'utf-8');

describe('parseP6Xml', () => {
  it('returns the canonical model shape', () => {
    const model = parseP6Xml(XML, { filename: 'minimal-3-task.xml' });
    expect(model).toHaveProperty('ermhdr');
    expect(model).toHaveProperty('tables');
    expect(model).toHaveProperty('filepath');
    expect(model).toHaveProperty('filename', 'minimal-3-task.xml');
    expect(model).toHaveProperty('parse_timestamp');
    expect(typeof model.parse_timestamp).toBe('string');
    expect(model.encoding_used).toBe('utf-8');
  });

  it('synthesizes ERMHDR from root attributes', () => {
    const model = parseP6Xml(XML);
    expect(model.ermhdr.version).toBe('19.12.0.0');
    expect(model.ermhdr.user).toBe('admin');
    expect(model.ermhdr.db).toBe('CPP_Demo');
    expect(model.ermhdr.exportdate).toBe('2026-02-13T10:00:00');
  });

  it('maps <Project> to PROJECT table with XER field names', () => {
    const model = parseP6Xml(XML);
    const proj = getTable(model, 'PROJECT');
    expect(proj.length).toBe(1);
    const p = proj[0];
    expect(p.proj_id).toBe('1');
    expect(p.proj_short_name).toBe('DEMO');
    expect(p.proj_long_name).toBe('Lens Demo Project');
    expect(p.plan_start_date).toBe('2026-01-01T08:00:00');
    expect(p.last_recalc_date).toBe('2026-02-13T08:00:00');
  });

  it('maps <Activity> to TASK with task_id, task_code, task_name', () => {
    const model = parseP6Xml(XML);
    const tasks = getTable(model, 'TASK');
    expect(tasks.length).toBe(3);
    const a = tasks[0];
    expect(a.task_id).toBe('1000');
    expect(a.task_code).toBe('A1000');
    expect(a.task_name).toBe('Mobilize');
    expect(a.proj_id).toBe('1');
    expect(a.wbs_id).toBe('101');
    expect(a.clndr_id).toBe('10');
    expect(a.target_drtn_hr_cnt).toBe('40');
    expect(a.total_float_hr_cnt).toBe('0');
  });

  it('maps <Relationship> to TASKPRED with pred_task_id + task_id', () => {
    const model = parseP6Xml(XML);
    const rels = getTable(model, 'TASKPRED');
    expect(rels.length).toBe(2);
    const r0 = rels[0];
    expect(r0.pred_task_id).toBe('1000');
    expect(r0.task_id).toBe('1001');
    expect(r0.pred_type).toBe('Finish to Start');
    expect(r0.lag_hr_cnt).toBe('0');
  });

  it('maps <WBS> with parent_wbs_id linkage', () => {
    const model = parseP6Xml(XML);
    const wbs = getTable(model, 'PROJWBS');
    expect(wbs.length).toBe(2);
    expect(wbs[0].wbs_id).toBe('100');
    expect(wbs[0].wbs_name).toBe('Root');
    expect(wbs[1].wbs_id).toBe('101');
    expect(wbs[1].parent_wbs_id).toBe('100');
    expect(wbs[1].wbs_short_name).toBe('CIVIL');
  });

  it('maps <Calendar> to CALENDAR with clndr_id', () => {
    const model = parseP6Xml(XML);
    const cal = getTable(model, 'CALENDAR');
    expect(cal.length).toBe(1);
    expect(cal[0].clndr_id).toBe('10');
    expect(cal[0].clndr_name).toBe('Standard 5-day');
    expect(cal[0].day_hr_cnt).toBe('8');
  });

  it('exposes union of fields per table (mirrors XER passthrough)', () => {
    const model = parseP6Xml(XML);
    const taskFields = getFields(model, 'TASK');
    expect(taskFields).toContain('task_id');
    expect(taskFields).toContain('task_code');
    expect(taskFields).toContain('task_name');
    expect(taskFields).toContain('total_float_hr_cnt');
  });

  it('returns empty model for empty input', () => {
    const model = parseP6Xml('');
    expect(model.tables).toEqual({});
    expect(model.ermhdr).toEqual({});
  });

  it('preserves raw XML when keepRawText set', () => {
    const model = parseP6Xml(XML, { keepRawText: true });
    expect(model.rawText).toBe(XML);
  });

  it('throws on malformed XML', () => {
    expect(() => parseP6Xml('<APIBusinessObjects><unclosed></APIBusinessObjects>'))
      .toThrow(/parseP6Xml/);
  });
});
