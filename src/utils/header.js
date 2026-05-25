/**
 * Parse the ERMHDR (first) line of a P6 XER file.
 *
 * Returns the 5 canonical fields plus a `raw` array of the full split parts.
 * Matches Python parse_xer at xer_parser.py:301-312.
 *
 * @param {string} xerText
 * @returns {{raw: string[], version: string, export_date: string,
 *            user: string, database: string, currency: string} | null}
 */
export function parseHeader(xerText) {
  if (!xerText) return null;
  const firstLine = xerText.split(/\r?\n/, 1)[0];
  if (!firstLine || !firstLine.startsWith('ERMHDR')) return null;
  const parts = firstLine.split('\t');
  return {
    raw: parts,
    version: parts[1] || '',
    export_date: parts[2] || '',
    user: parts[3] || '',
    database: parts[4] || '',
    currency: parts[5] || ''
  };
}
