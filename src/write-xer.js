/**
 * Serialize a parsed Lens model back to XER text. Round-trip-safe: parsing
 * the output produces a model equivalent to the input (ermhdr + tables).
 *
 * ERMHDR emission strategy:
 *   - If model.ermhdr.raw is an array, use it verbatim (joined with tabs).
 *   - Otherwise synthesize from version, export_date, user, database, currency.
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
    lines.push([
      'ERMHDR',
      _cell(ermhdr.version),
      _cell(ermhdr.export_date),
      _cell(ermhdr.user),
      _cell(ermhdr.database),
      _cell(ermhdr.currency)
    ].join('\t'));
  } else {
    // No ermhdr at all — emit a placeholder so writers are always valid XER.
    lines.push(['ERMHDR', '24.12', new Date().toISOString().slice(0, 10), 'lens', 'dbx', 'USD'].join('\t'));
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
