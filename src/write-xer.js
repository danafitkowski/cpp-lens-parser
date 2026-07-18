/**
 * Serialize a parsed Lens model back to XER text. Round-trip-safe: parsing
 * the output produces a model equivalent to the input (ermhdr + tables).
 *
 * ERMHDR emission strategy:
 *   - If model.ermhdr.raw is an array, use it verbatim (joined with tabs).
 *   - Otherwise synthesize the canonical 9-field P6 ERMHDR layout (positional):
 *     version, export_date, export_flag, user(login), user_full_name, database,
 *     module, currency — matching parseHeader / xer_parser.py so an XER→model→XER
 *     round-trip lands every field in its correct slot. Tolerates the XML-shape
 *     aliases parseP6Xml emits (exportdate→export_date, db→database, project→
 *     export_flag) so an XML→XER conversion keeps its header instead of blanking it.
 *   - If ermhdr is fully empty, emit a minimal default ERMHDR.
 *
 * TSV integrity: XER is tab-delimited, newline-terminated. A field value that
 * itself contains a tab, CR, or LF would inject a phantom column or split the
 * row, silently corrupting the file (and scrambling later columns — e.g.
 * status_code reading as the tail of a task_name). Every emitted cell, field
 * name, and header part is therefore run through `_cell`, which collapses any
 * \t / \r / \n run to a single space. Real P6 exports don't carry raw
 * delimiters in values, so this never alters a genuine schedule; it only
 * neutralizes programmatically-built models (anonymizer tokens, half-step
 * output, multi-line memo text) that would otherwise emit a malformed XER.
 *
 * @param {object} model
 * @returns {string}
 */

/** Collapse embedded TSV delimiters so a cell can't break row/column framing. */
function _cell(v) {
  if (v == null) return '';
  const s = String(v);
  // Fast path: no delimiter, return as-is (avoids regex alloc on the common case).
  if (s.indexOf('\t') === -1 && s.indexOf('\n') === -1 && s.indexOf('\r') === -1) return s;
  return s.replace(/[\t\r\n]+/g, ' ');
}

export function writeXer(model) {
  const lines = [];

  // ERMHDR
  const ermhdr = model.ermhdr || {};
  if (Array.isArray(ermhdr.raw) && ermhdr.raw.length > 0) {
    lines.push(ermhdr.raw.map(_cell).join('\t'));
  } else if (Object.keys(ermhdr).length > 0) {
    // Canonical 9-field positional layout: parts[3]=export_flag, [4]=user(login),
    // [5]=user_full_name, [6]=database, [7]=module, [8]=currency.
    lines.push([
      'ERMHDR',
      _cell(ermhdr.version),
      _cell(ermhdr.export_date ?? ermhdr.exportdate),
      _cell(ermhdr.export_flag ?? ermhdr.project),
      _cell(ermhdr.user),
      _cell(ermhdr.user_full_name),
      _cell(ermhdr.database ?? ermhdr.db),
      _cell(ermhdr.module),
      _cell(ermhdr.currency)
    ].join('\t'));
  } else {
    // No ermhdr at all — emit a placeholder so writers are always valid XER.
    // Canonical 9-field layout (export_flag, login, full_name, db, module, currency).
    lines.push(['ERMHDR', '24.12', new Date().toISOString().slice(0, 10), 'Project', 'lens', '', 'dbx', 'Project Management', 'USD'].join('\t'));
  }

  // Tables in insertion order
  for (const [tableName, payload] of Object.entries(model.tables || {})) {
    lines.push(`%T\t${_cell(tableName)}`);
    const fields = payload.fields || [];
    lines.push(`%F\t${fields.map(_cell).join('\t')}`);
    for (const record of (payload.records || [])) {
      const cells = fields.map(f => _cell(record[f]));
      lines.push(`%R\t${cells.join('\t')}`);
    }
  }

  // Final %E
  lines.push('%E');

  return lines.join('\n') + '\n';
}
