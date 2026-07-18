/**
 * Parse the ERMHDR (first) line of a P6 XER file.
 *
 * Returns the canonical 9-field P6 ERMHDR fields plus a `raw` array of the
 * full split parts. Mirrors Python parse_xer at xer_parser.py:308-332.
 *
 * Canonical 9-field P6 ERMHDR layout (positional):
 *   parts[0] ERMHDR
 *   parts[1] version
 *   parts[2] export_date
 *   parts[3] export/project flag (e.g. 'Project')
 *   parts[4] user_login        (the export user — chain of custody)
 *   parts[5] user_full_name
 *   parts[6] database
 *   parts[7] module
 *   parts[8] currency          (the file's currency unit)
 *
 * Each field is index-guarded so shorter legacy headers do not get
 * mislabeled values from the wrong slot.
 *
 * @param {string} xerText
 * @returns {{raw: string[], version: string, export_date: string,
 *            export_flag: string, user: string, user_full_name: string,
 *            database: string, module: string, currency: string} | null}
 */
export function parseHeader(xerText) {
  if (!xerText) return null;
  const firstLine = xerText.split(/\r?\n/, 1)[0];
  if (!firstLine || !firstLine.startsWith('ERMHDR')) return null;
  const parts = firstLine.split('\t');
  return {
    raw: parts,
    version: parts.length > 1 ? parts[1] : '',
    export_date: parts.length > 2 ? parts[2] : '',
    export_flag: parts.length > 3 ? parts[3] : '',
    user: parts.length > 4 ? parts[4] : '',
    user_full_name: parts.length > 5 ? parts[5] : '',
    database: parts.length > 6 ? parts[6] : '',
    module: parts.length > 7 ? parts[7] : '',
    currency: parts.length > 8 ? parts[8] : ''
  };
}
