/**
 * Parse the ERMHDR (first) line of a P6 XER file.
 *
 * Returns the 8 canonical header fields (per P6 24.12 schema), or null if
 * the first line is not a recognizable ERMHDR.
 *
 * Schema source: ~/.claude/skills/xer-parser/scripts/xer_parser.py canonical
 * Python parser (writer at ~line 1987). Cross-checked against real fixtures.
 *
 * @param {string} xerText  Full XER file text
 * @returns {{version: string, exportDate: string, exportScope: string,
 *            user: string, userFullName: string, database: string,
 *            module: string, currency: string} | null}
 */
export function parseHeader(xerText) {
  if (!xerText) return null;
  const firstLine = xerText.split(/\r?\n/, 1)[0];
  if (!firstLine || !firstLine.startsWith('ERMHDR\t')) return null;
  const parts = firstLine.split('\t');
  return {
    version: parts[1] || '',
    exportDate: parts[2] || '',
    exportScope: parts[3] || '',
    user: parts[4] || '',
    userFullName: parts[5] || '',
    database: parts[6] || '',
    module: parts[7] || '',
    currency: parts[8] || ''
  };
}
