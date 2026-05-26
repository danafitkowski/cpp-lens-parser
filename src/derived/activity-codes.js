/**
 * activity-codes.js — activity code assignment builder
 *
 * Mirrors build_activity_code_map at xer_parser.py:928-954.
 *
 * Joins TASKACTV → ACTVCODE → ACTVTYPE and groups by task_id.
 * Each entry in the returned list is a plain object:
 *   { type_name, code_name, code_desc }
 *
 * where:
 *   type_name — ACTVTYPE.actv_code_type  (the code-type label, e.g. "Phase")
 *   code_name — ACTVCODE.short_name      (the code value, e.g. "CIVIL")
 *   code_desc — ACTVCODE.actv_code_name  (the long description, e.g. "Civil Works")
 */

import { getTable } from '../access.js';

/**
 * Build a task_id → list-of-code-objects map.
 *
 * @param {object|null|undefined} model  Output of parseXer().
 * @returns {Record<string, Array<{type_name:string, code_name:string, code_desc:string}>>}
 *   Empty object when TASKACTV (or both lookup tables) are absent.
 */
export function buildActivityCodeMap(model) {
  const actvtype = getTable(model, 'ACTVTYPE');
  const actvcode = getTable(model, 'ACTVCODE');
  const taskactv = getTable(model, 'TASKACTV');

  // Type lookup: actv_code_type_id → type record
  /** @type {Record<string, object>} */
  const typeMap = {};
  for (const t of actvtype) {
    const id = t.actv_code_type_id || '';
    if (id) typeMap[id] = t;
  }

  // Code lookup: actv_code_id → code record
  /** @type {Record<string, object>} */
  const codeMap = {};
  for (const c of actvcode) {
    const id = c.actv_code_id || '';
    if (id) codeMap[id] = c;
  }

  /** @type {Record<string, Array<{type_name:string, code_name:string, code_desc:string}>>} */
  const taskCodes = {};

  for (const ta of taskactv) {
    const taskId = ta.task_id      || '';
    const codeId = ta.actv_code_id || '';
    const codeRec = codeMap[codeId] || {};
    const typeId  = codeRec.actv_code_type_id || '';
    const typeRec = typeMap[typeId] || {};

    if (!taskCodes[taskId]) taskCodes[taskId] = [];
    taskCodes[taskId].push({
      type_name: typeRec.actv_code_type  || '',
      code_name: codeRec.short_name      || '',
      code_desc: codeRec.actv_code_name  || '',
    });
  }

  return taskCodes;
}
