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
