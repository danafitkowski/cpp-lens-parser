/**
 * udfs.js — UDF (User-Defined Field) value builder
 *
 * Mirrors build_udf_map at xer_parser.py:957-980.
 *
 * P6 UDF values are keyed on (table_name, fk_id) — a two-part composite
 * key — because fk_id values are only unique within a given table (TASK,
 * PROJECT, PROJWBS, RSRC can all share the same fk_id integer).
 *
 * JS Maps do not support tuple keys by identity. This implementation uses
 * string composite keys of the form `'TABLE_NAME::fk_id'` so consumers
 * can do:
 *   const vals = udfMap.get('TASK::123');
 *
 * The Python returns a plain dict; we return a Map<string, object[]> to
 * preserve the typed-key intent and make the composite key design explicit.
 *
 * Each value object in the array has the shape:
 *   { label, name, value }
 * where:
 *   label — UDFTYPE.udf_type_label (human-readable field label)
 *   name  — UDFTYPE.udf_type_name  (internal field name / identifier)
 *   value — first non-empty of: UDFVALUE.udf_text | udf_number | udf_date
 */

import { getTable } from '../access.js';

/**
 * Build a composite-keyed UDF value lookup from a parsed XER model.
 *
 * Keys are strings of the form `'TABLE_NAME::fk_id'`.
 *
 * @param {object|null|undefined} model  Output of parseXer().
 * @returns {Map<string, Array<{label:string, name:string, value:string}>>}
 *   Empty Map when UDFVALUE is absent.
 */
export function buildUdfMap(model) {
  const udftype  = getTable(model, 'UDFTYPE');
  const udfvalue = getTable(model, 'UDFVALUE');

  // Type lookup: udf_type_id → type record
  /** @type {Record<string, object>} */
  const typeMap = {};
  for (const u of udftype) {
    const id = u.udf_type_id || '';
    if (id) typeMap[id] = u;
  }

  /** @type {Map<string, Array<{label:string, name:string, value:string}>>} */
  const udfLookup = new Map();

  for (const uv of udfvalue) {
    const fkId      = uv.fk_id       || '';
    const udfTypeId = uv.udf_type_id || '';
    const typeRec   = typeMap[udfTypeId] || {};
    const tableName = typeRec.table_name || '';

    const key = `${tableName}::${fkId}`;

    const entry = {
      label: typeRec.udf_type_label || '',
      name:  typeRec.udf_type_name  || '',
      // Mirror Python: first truthy wins — text, then number, then date
      value: uv.udf_text || uv.udf_number || uv.udf_date || '',
    };

    if (!udfLookup.has(key)) udfLookup.set(key, []);
    udfLookup.get(key).push(entry);
  }

  return udfLookup;
}
