/**
 * Get the records list for a table. Returns [] for unknown tables or
 * a missing model. Matches the Python get_table at xer_parser.py:355-358.
 *
 * @param {object | null | undefined} model
 * @param {string} tableName
 * @returns {Array<object>}
 */
export function getTable(model, tableName) {
  const t = model?.tables?.[tableName];
  return t?.records || [];
}

/**
 * Get the fields list for a table. Returns [] for unknown tables or
 * a missing model. Matches the Python get_fields at xer_parser.py:361-364.
 *
 * @param {object | null | undefined} model
 * @param {string} tableName
 * @returns {string[]}
 */
export function getFields(model, tableName) {
  const t = model?.tables?.[tableName];
  return t?.fields || [];
}

/**
 * Canonical alias map for common XER table-name variants. Borrowed verbatim
 * from AURORA's audit (2026-05-26). Lets consumers refer to logical groups
 * (WBS, REL, ASSIGN, CAL, COST) without knowing the exact P6 table name.
 */
export const TABLE_ALIASES = {
  PROJECT:  ['PROJECT'],
  WBS:      ['PROJWBS'],
  TASK:     ['TASK'],
  REL:      ['TASKPRED'],
  RSRC:     ['RSRC'],
  ASSIGN:   ['TASKRSRC'],
  CAL:      ['CALENDAR'],
  ACTVTYPE: ['ACTVTYPE'],
  ACTVCODE: ['ACTVCODE'],
  TASKACTV: ['TASKACTV'],
  UDFTYPE:  ['UDFTYPE'],
  UDFVALUE: ['UDFVALUE'],
  OBS:      ['OBS'],
  RSRCRATE: ['RSRCRATE'],
  ROLE:     ['ROLE', 'ROLES'],
  RSRCROLE: ['RSRCROLE'],
  COST:     ['COSTACT', 'COST_ACCOUNT', 'COSTTYPE'],
  PROJCOST: ['PROJCOST']
};

/**
 * Get records for a logical table name, resolving through TABLE_ALIASES.
 *
 * @param {object | null | undefined} model
 * @param {string} alias - logical name (e.g. 'WBS', 'REL', or a literal table name)
 * @returns {Array<object>}
 */
export function getTableAliased(model, alias) {
  if (!model || !model.tables) return [];
  const names = TABLE_ALIASES[alias] || [alias];
  for (const n of names) {
    const t = model.tables[n];
    if (t && t.records) return t.records;
  }
  return [];
}

/**
 * Pick the first non-empty value from a record across a list of key names.
 * Treats null and empty-string as missing; everything else is real.
 *
 * Used to normalize XER field-name variants (e.g. `task_id` vs `task_code`,
 * `wbs_name` vs `wbs_short_name`, `pred_type` vs `rel_type`).
 *
 * @param {object | null | undefined} record
 * @param {string[]} keys - tried in order
 * @returns {any}
 */
export function getFirstField(record, keys) {
  if (!record) return '';
  for (const k of keys) {
    const v = record[k];
    if (v != null && v !== '') return v;
  }
  return '';
}
