/**
 * Parse a Primavera P6 XML export into the canonical lens-parser model shape.
 *
 * P6 XML and XER carry the same logical data with different surface syntax:
 * XER is tab-delimited records grouped by `%T <TableName>` headers; P6 XML
 * nests records as elements under `<APIBusinessObjects>`. This module emits
 * the SAME model shape `parseXer` does — `{ ermhdr, tables, filepath, ... }`
 * — with field names mapped to XER conventions wherever the mapping is
 * unambiguous, so downstream consumers (`getTable`, `getTableAliased`,
 * `buildPredecessorMap`, the Lens viewer's section renderers) work on
 * XML inputs without source changes.
 *
 * Element → XER table map:
 *   <Project>               → PROJECT
 *   <WBS>                   → PROJWBS
 *   <Activity>              → TASK
 *   <Relationship>          → TASKPRED
 *   <Calendar>              → CALENDAR
 *   <Resource>              → RSRC
 *   <ResourceAssignment>    → TASKRSRC
 *   <ActivityCodeType>      → ACTVTYPE
 *   <ActivityCode>          → ACTVCODE
 *   <UDFType>               → UDFTYPE
 *   <UDFValue>              → UDFVALUE
 *
 * Field name mapping: a curated camelCase-XML → snake_case-XER table for the
 * fields the viewer's 29 sections read. Unmapped fields fall through with
 * snake_case-of-camelCase so nothing is dropped (Dana's never-truncate rule).
 *
 * ERMHDR shape (5 canonical fields per parseHeader): the XML root carries no
 * ERMHDR equivalent, so this synthesizes one from the file's top-level
 * APIBusinessObjects attributes when available; otherwise empty strings.
 *
 * Limitations of v0.3:
 *   - Calendar exception/holiday parsing is left as raw element strings under
 *     CALENDAR.clndr_data; consumers should still call parseCalendarData on
 *     the model output to extract structured calendars.
 *   - Activity codes are stored at the leaf level (ACTVCODE) without
 *     reconstructing the parent ACTVTYPE rollup; same coverage as parseXer.
 *   - Float values, dates, and durations are kept as raw element-text strings
 *     (passthrough — no coercion) to mirror the parseXer contract.
 */
import { createEmptyModel } from './lens-model.js';

// ── Element → table mapping ────────────────────────────────────────────────
const ELEMENT_TO_TABLE = {
  Project: 'PROJECT',
  WBS: 'PROJWBS',
  Activity: 'TASK',
  Relationship: 'TASKPRED',
  Calendar: 'CALENDAR',
  Resource: 'RSRC',
  ResourceAssignment: 'TASKRSRC',
  ActivityCodeType: 'ACTVTYPE',
  ActivityCode: 'ACTVCODE',
  UDFType: 'UDFTYPE',
  UDFValue: 'UDFVALUE',
};

// ── Curated XML element → XER field name mapping ──────────────────────────
// Keyed by table name → { xmlElementLocalName: xerFieldName, ... }.
// The viewer reads these specific snake_case fields across its 29 sections;
// preserving the names lets the viewer treat XML uploads identically to XER.
const FIELD_MAP = {
  PROJECT: {
    ObjectId: 'proj_id',
    Id: 'proj_short_name',
    Name: 'proj_long_name',
    PlannedStartDate: 'plan_start_date',
    AnticipatedFinishDate: 'plan_end_date',
    DataDate: 'last_recalc_date',
    MustFinishByDate: 'scd_end_date',
    StartDate: 'plan_start_date',
    FinishDate: 'scd_end_date',
  },
  PROJWBS: {
    ObjectId: 'wbs_id',
    ProjectObjectId: 'proj_id',
    ParentObjectId: 'parent_wbs_id',
    Code: 'wbs_short_name',
    Name: 'wbs_name',
    SequenceNumber: 'seq_num',
  },
  TASK: {
    ObjectId: 'task_id',
    Id: 'task_code',
    Name: 'task_name',
    ProjectObjectId: 'proj_id',
    WBSObjectId: 'wbs_id',
    CalendarObjectId: 'clndr_id',
    Type: 'task_type',
    Status: 'status_code',
    PercentComplete: 'phys_complete_pct',
    DurationPercentComplete: 'duration_complete_pct',
    PlannedDuration: 'target_drtn_hr_cnt',
    RemainingDuration: 'remain_drtn_hr_cnt',
    ActualDuration: 'act_work_qty',
    PlannedStartDate: 'target_start_date',
    PlannedFinishDate: 'target_end_date',
    StartDate: 'early_start_date',
    FinishDate: 'early_end_date',
    EarlyStartDate: 'early_start_date',
    EarlyFinishDate: 'early_end_date',
    LateStartDate: 'late_start_date',
    LateFinishDate: 'late_end_date',
    ActualStartDate: 'act_start_date',
    ActualFinishDate: 'act_end_date',
    RemainingEarlyStartDate: 'restart_date',
    RemainingEarlyFinishDate: 'reend_date',
    TotalFloat: 'total_float_hr_cnt',
    FreeFloat: 'free_float_hr_cnt',
    ConstraintType: 'cstr_type',
    ConstraintDate: 'cstr_date',
    SecondaryConstraintType: 'cstr_type2',
    SecondaryConstraintDate: 'cstr_date2',
  },
  TASKPRED: {
    ObjectId: 'task_pred_id',
    PredecessorActivityObjectId: 'pred_task_id',
    SuccessorActivityObjectId: 'task_id',
    PredecessorProjectObjectId: 'pred_proj_id',
    SuccessorProjectObjectId: 'proj_id',
    Type: 'pred_type',
    Lag: 'lag_hr_cnt',
  },
  CALENDAR: {
    ObjectId: 'clndr_id',
    Name: 'clndr_name',
    Type: 'clndr_type',
    HoursPerDay: 'day_hr_cnt',
    HoursPerWeek: 'week_hr_cnt',
    HoursPerMonth: 'month_hr_cnt',
    HoursPerYear: 'year_hr_cnt',
    BaseCalendarObjectId: 'base_clndr_id',
    IsDefault: 'default_flag',
  },
  RSRC: {
    ObjectId: 'rsrc_id',
    Id: 'rsrc_short_name',
    Name: 'rsrc_name',
    ResourceType: 'rsrc_type',
    Title: 'rsrc_title_name',
    PrimaryRoleObjectId: 'role_id',
    DefaultUnitsPerTime: 'def_qty_per_hr',
  },
  TASKRSRC: {
    ObjectId: 'taskrsrc_id',
    ActivityObjectId: 'task_id',
    ResourceObjectId: 'rsrc_id',
    PlannedUnits: 'target_qty',
    RemainingUnits: 'remain_qty',
    ActualUnits: 'act_qty',
    PlannedCost: 'target_cost',
    ActualCost: 'act_cost',
    RemainingCost: 'remain_cost',
  },
  ACTVTYPE: {
    ObjectId: 'actv_code_type_id',
    Name: 'actv_code_type',
    SequenceNumber: 'seq_num',
    Length: 'max_length',
  },
  ACTVCODE: {
    ObjectId: 'actv_code_id',
    ActivityCodeTypeObjectId: 'actv_code_type_id',
    CodeValue: 'short_name',
    Description: 'actv_code_name',
    ParentObjectId: 'parent_actv_code_id',
  },
  UDFTYPE: {
    ObjectId: 'udf_type_id',
    Title: 'udf_type_label',
    SubjectArea: 'table_name',
    DataType: 'logical_data_type',
  },
  UDFVALUE: {
    UDFTypeObjectId: 'udf_type_id',
    ForeignObjectId: 'fk_id',
    Text: 'udf_text',
    Number: 'udf_number',
    Date: 'udf_date',
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function camelToSnake(s) {
  return String(s).replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
                  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
                  .toLowerCase();
}

function mapFieldName(table, xmlName) {
  const tableMap = FIELD_MAP[table];
  if (tableMap && tableMap[xmlName] !== undefined) return tableMap[xmlName];
  return camelToSnake(xmlName);
}

function getDomParser() {
  if (typeof DOMParser !== 'undefined') return new DOMParser();
  throw new Error(
    'parseP6Xml requires DOMParser. Browsers have it built-in. ' +
    'For Node tests, use happy-dom or jsdom @vitest-environment.'
  );
}

function pickTextFields(element) {
  // Return an object mapping local-name → text content, for each direct child
  // element that has no nested elements (leaf fields). Nested-element children
  // are surfaced via recursion in the outer reader (Calendar exceptions etc.).
  const out = {};
  for (const child of element.children) {
    if (child.children.length > 0) continue;
    const name = child.localName || child.tagName;
    // Use textContent rather than innerHTML so nested CDATA / entities resolve.
    out[name] = child.textContent || '';
  }
  return out;
}

function ensureTable(model, tableName, fieldsHint) {
  if (!model.tables[tableName]) {
    model.tables[tableName] = {
      fields: fieldsHint ? Array.from(fieldsHint) : [],
      records: [],
    };
  }
  return model.tables[tableName];
}

function mergeFields(table, record) {
  // Build the union of fields seen across this table's records (mirrors the
  // XER passthrough behavior — fields[] is the column list, records[] are
  // string-valued maps).
  for (const key of Object.keys(record)) {
    if (!table.fields.includes(key)) table.fields.push(key);
  }
}

function nowTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
  );
}

// ── Public entry point ─────────────────────────────────────────────────────
/**
 * Parse a P6 XML text into the canonical model shape.
 *
 * @param {string} text - Full P6 XML document.
 * @param {object} [opts]
 * @param {string} [opts.filepath]
 * @param {string} [opts.filename]
 * @param {string} [opts.encoding_used]
 * @param {boolean} [opts.keepRawText]
 * @returns {object} Same shape as parseXer.
 */
export function parseP6Xml(text, opts = {}) {
  const model = createEmptyModel();
  model.filepath = opts.filepath || '';
  model.filename = opts.filename || '';
  model.encoding_used = opts.encoding_used || 'utf-8';
  model.parse_timestamp = nowTimestamp();
  if (opts.keepRawText) model.rawText = text;

  if (!text) return model;

  const parser = getDomParser();
  const doc = parser.parseFromString(text, 'text/xml');

  // Detect parse errors (the DOMParser surfaces them as a <parsererror> node).
  const errNode = doc.getElementsByTagName('parsererror')[0];
  if (errNode) {
    const msg = errNode.textContent || 'XML parse error';
    throw new Error('parseP6Xml: ' + msg.split('\n')[0]);
  }

  const root = doc.documentElement;
  if (!root) return model;

  // Synthesize a 5-field ERMHDR-equivalent from the root attributes so the
  // model.ermhdr shape is non-empty and consumers that read ermhdr.exporter
  // or ermhdr.version don't see undefined.
  model.ermhdr = {
    version: root.getAttribute('Version') || root.getAttribute('xmlns') || '',
    exportdate: root.getAttribute('ExportDate') || '',
    project: root.getAttribute('Project') || '',
    user: root.getAttribute('User') || root.getAttribute('UserName') || '',
    db: root.getAttribute('Database') || '',
  };

  // Recursively visit every descendant element. When the local name matches
  // a known table, extract its leaf children as a record.
  const walker = doc.createTreeWalker
    ? doc.createTreeWalker(root, /* NodeFilter.SHOW_ELEMENT */ 0x1)
    : null;

  const visit = (el) => {
    const localName = el.localName || el.tagName;
    const tableName = ELEMENT_TO_TABLE[localName];
    if (tableName) {
      const rawFields = pickTextFields(el);
      const record = {};
      for (const xmlName of Object.keys(rawFields)) {
        const xerField = mapFieldName(tableName, xmlName);
        record[xerField] = rawFields[xmlName];
      }
      const table = ensureTable(model, tableName);
      table.records.push(record);
      mergeFields(table, record);
    }
    // Recurse — XML can nest table elements (e.g. <Activity> under <Project>
    // under <APIBusinessObjects>).
    for (const child of el.children) visit(child);
  };

  if (walker) {
    // TreeWalker path — faster than recursion on large XML.
    let node = walker.firstChild ? walker.currentNode : root;
    visit(root);
  } else {
    visit(root);
  }

  return model;
}
