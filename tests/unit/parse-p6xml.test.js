// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseP6Xml, getTable, getFields } from '../../src/index.js';
import { parseXer } from '../../src/parse-xer.js';
import { writeXer } from '../../src/write-xer.js';

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

  it('round-trips through writeXer without blanking the header (export date + db survive)', () => {
    // Regression: writeXer's synthesize branch read export_date/database, but
    // parseP6Xml emits exportdate/db — so an XML→XER conversion silently blanked
    // the export date and database in the ERMHDR line.
    const reparsed = parseXer(writeXer(parseP6Xml(XML)));
    expect(reparsed.ermhdr.version).toBe('19.12.0.0');
    expect(reparsed.ermhdr.export_date).toBe('2026-02-13T10:00:00'); // from XML exportdate
    expect(reparsed.ermhdr.database).toBe('CPP_Demo');               // from XML db
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
    expect(r0.pred_type).toBe('PR_FS'); // translated from "Finish to Start"
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

  // ── enum value translation (XML English → XER codes) ──────────────────────
  // Without this, XML uploads render but silently miscount status / type /
  // relationship / constraint, because every downstream consumer keys off
  // XER enum codes.
  it('translates Activity Status to XER status_code', () => {
    const tasks = getTable(parseP6Xml(XML), 'TASK');
    // Fixture activities are all "Not Started".
    expect(tasks.every(t => t.status_code === 'TK_NotStart')).toBe(true);
  });

  it('translates Activity Type to XER task_type', () => {
    const tasks = getTable(parseP6Xml(XML), 'TASK');
    // Fixture activities are all "Task Dependent".
    expect(tasks.every(t => t.task_type === 'TT_Task')).toBe(true);
  });

  it('translates Relationship Type to XER pred_type', () => {
    const rels = getTable(parseP6Xml(XML), 'TASKPRED');
    // Fixture relationships are all "Finish to Start".
    expect(rels.every(r => r.pred_type === 'PR_FS')).toBe(true);
  });

  it('translates all status / type / relationship / constraint enums round-trip', () => {
    const xml = `<?xml version="1.0"?>
      <APIBusinessObjects Version="19.12" User="u" Database="d">
        <Project><ObjectId>1</ObjectId>
          <Activity><ObjectId>9</ObjectId><Id>M1</Id><Name>Done Task</Name>
            <Status>Completed</Status><Type>Finish Milestone</Type>
            <ConstraintType>Mandatory Finish</ConstraintType></Activity>
          <Activity><ObjectId>10</ObjectId><Id>L1</Id><Name>LOE</Name>
            <Status>In Progress</Status><Type>Level of Effort</Type>
            <ConstraintType>Start On or After</ConstraintType></Activity>
          <Relationship><ObjectId>20</ObjectId>
            <PredecessorActivityObjectId>9</PredecessorActivityObjectId>
            <SuccessorActivityObjectId>10</SuccessorActivityObjectId>
            <Type>Start to Start</Type></Relationship>
        </Project>
      </APIBusinessObjects>`;
    const m = parseP6Xml(xml);
    const tasks = getTable(m, 'TASK');
    const t9 = tasks.find(t => t.task_id === '9');
    const t10 = tasks.find(t => t.task_id === '10');
    expect(t9.status_code).toBe('TK_Complete');
    expect(t9.task_type).toBe('TT_FinMile');
    expect(t9.cstr_type).toBe('CS_MANDFIN');
    expect(t10.status_code).toBe('TK_Active');
    expect(t10.task_type).toBe('TT_LOE');
    expect(t10.cstr_type).toBe('CS_MSOA');
    expect(getTable(m, 'TASKPRED')[0].pred_type).toBe('PR_SS');
  });

  it('passes unrecognized enum values through unchanged (never blanks novel codes)', () => {
    const xml = `<?xml version="1.0"?>
      <APIBusinessObjects Version="19.12">
        <Project><ObjectId>1</ObjectId>
          <Activity><ObjectId>9</ObjectId><Id>X</Id><Name>X</Name>
            <Status>Some Future P6 Status</Status></Activity>
        </Project>
      </APIBusinessObjects>`;
    const t = getTable(parseP6Xml(xml), 'TASK')[0];
    expect(t.status_code).toBe('Some Future P6 Status');
  });

  it('Start/Finish columns win over Early/Planned variants for colliding XER fields (order-independent)', () => {
    // Both StartDate and EarlyStartDate map to early_start_date; both FinishDate
    // and EarlyFinishDate map to early_end_date. Per the "read the Start/Finish
    // columns at face value" rule, StartDate/FinishDate must win regardless of
    // the order the elements appear in the XML.
    const mk = (body) => `<?xml version="1.0"?>
      <APIBusinessObjects Version="19.12">
        <Project><ObjectId>1</ObjectId>
          <Activity><ObjectId>9</ObjectId><Id>A</Id><Name>A</Name>${body}</Activity>
        </Project>
      </APIBusinessObjects>`;
    const startCol = '<StartDate>2026-03-01T08:00:00</StartDate><FinishDate>2026-03-10T17:00:00</FinishDate>';
    const earlyCol = '<EarlyStartDate>2026-09-09T08:00:00</EarlyStartDate><EarlyFinishDate>2026-09-20T17:00:00</EarlyFinishDate>';
    for (const order of [startCol + earlyCol, earlyCol + startCol]) {
      const t = getTable(parseP6Xml(mk(order)), 'TASK')[0];
      expect(t.early_start_date).toBe('2026-03-01T08:00:00'); // StartDate wins
      expect(t.early_end_date).toBe('2026-03-10T17:00:00');   // FinishDate wins
    }
  });
});
