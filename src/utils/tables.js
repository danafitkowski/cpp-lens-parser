/**
 * parseTables — generic XER table-row parser.
 *
 * Recognises four XER control records:
 *   %T\t<name>   — start of table
 *   %F\t<cols>   — tab-delimited column list
 *   %R\t<vals>   — tab-delimited row values
 *   %E           — end of table (resets state)
 *
 * ERMHDR and blank/whitespace-only lines are silently skipped.
 * Handles both LF and CRLF line endings.
 *
 * @param {string} xerText - raw XER file content
 * @returns {Record<string, Record<string, string>[]>} map of table name → row objects
 */
export function parseTables(xerText) {
  const tables = {};
  let currentTable = null;
  let currentFields = null;

  const lines = xerText.split(/\r?\n/);
  for (const line of lines) {
    if (line === '' || /^\s*$/.test(line)) continue;
    if (line.startsWith('ERMHDR')) continue;

    if (line.startsWith('%T\t')) {
      currentTable = line.slice(3);
      currentFields = null;
      tables[currentTable] = [];
      continue;
    }
    if (line.startsWith('%F\t') && currentTable) {
      currentFields = line.slice(3).split('\t');
      continue;
    }
    if (line.startsWith('%R\t') && currentTable && currentFields) {
      const cells = line.slice(3).split('\t');
      const row = {};
      for (let i = 0; i < currentFields.length; i++) {
        row[currentFields[i]] = cells[i] != null ? cells[i] : '';
      }
      tables[currentTable].push(row);
      continue;
    }
    if (line.startsWith('%E')) {
      currentTable = null;
      currentFields = null;
    }
  }
  return tables;
}
