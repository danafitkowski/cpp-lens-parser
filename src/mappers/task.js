import { parseP6Date } from '../utils/dates.js';
import { coerceInt, coerceFloat, coerceBool } from '../utils/coerce.js';

// IDs stored as integers in the Python parser
const INT_FIELDS = ['task_id', 'proj_id', 'wbs_id', 'clndr_id'];

// Duration and float fields stored as floats (hours)
const FLOAT_FIELDS = [
  'target_drtn_hr_cnt', 'remain_drtn_hr_cnt',
  'total_float_hr_cnt', 'free_float_hr_cnt',
  'phys_complete_pct',
];

// All P6 date fields on the TASK table
const DATE_FIELDS = [
  'act_start_date', 'act_end_date',
  'target_start_date', 'target_end_date',
  'early_start_date', 'early_end_date',
  'late_start_date', 'late_end_date',
];

// String fields — preserved verbatim (no trim, no mutation)
const STRING_FIELDS = [
  'task_code', 'task_name', 'status_code', 'task_type',
  'complete_pct_type', 'cstr_type',
];

// Boolean fields — Y/N coercion (present in fixture and real P6 exports)
const BOOL_FIELDS = ['driving_path_flag'];

/**
 * Map raw TASK table rows (string-valued dicts from the XER parser) into
 * typed Activity objects.
 *
 * Field handling:
 *   - INT_FIELDS   → integer or null
 *   - FLOAT_FIELDS → float or null
 *   - DATE_FIELDS  → Date (UTC) or null  (empty string → null)
 *   - STRING_FIELDS → string verbatim, '' when absent
 *   - BOOL_FIELDS  → boolean (Y → true, anything else → false)
 *
 * Fields absent from a row are coerced to null (numbers/dates) or '' (strings)
 * rather than throwing, so partial rows from minimal fixture XERs work correctly.
 *
 * @param {Object[]} rows - Raw records from get_table(data, 'TASK')
 * @returns {Object[]} Typed Activity objects
 */
export function mapTasks(rows) {
  const out = [];
  for (const r of rows) {
    const a = {};
    for (const f of INT_FIELDS)    a[f] = coerceInt(r[f]);
    for (const f of FLOAT_FIELDS)  a[f] = coerceFloat(r[f]);
    for (const f of DATE_FIELDS)   a[f] = parseP6Date(r[f]);
    for (const f of STRING_FIELDS) a[f] = r[f] != null ? r[f] : '';
    for (const f of BOOL_FIELDS)   a[f] = coerceBool(r[f]);
    out.push(a);
  }
  return out;
}
