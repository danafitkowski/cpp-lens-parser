/**
 * Serialize a parsed Lens model back to XER text. Round-trip-safe: parsing
 * the output produces a model equivalent to the input (ermhdr + tables).
 *
 * ERMHDR emission strategy:
 *   - If model.ermhdr.raw is an array, use it verbatim (joined with tabs).
 *   - Otherwise synthesize from version, export_date, user, database, currency.
 *   - If ermhdr is fully empty, emit a minimal default ERMHDR.
 *
 * @param {object} model
 * @returns {string}
 */
export function writeXer(model) {
  const lines = [];

  // ERMHDR
  const ermhdr = model.ermhdr || {};
  if (Array.isArray(ermhdr.raw) && ermhdr.raw.length > 0) {
    lines.push(ermhdr.raw.join('\t'));
  } else if (Object.keys(ermhdr).length > 0) {
    lines.push([
      'ERMHDR',
      ermhdr.version || '',
      ermhdr.export_date || '',
      ermhdr.user || '',
      ermhdr.database || '',
      ermhdr.currency || ''
    ].join('\t'));
  } else {
    // No ermhdr at all — emit a placeholder so writers are always valid XER.
    lines.push(['ERMHDR', '24.12', new Date().toISOString().slice(0, 10), 'lens', 'dbx', 'USD'].join('\t'));
  }

  // Tables in insertion order
  for (const [tableName, payload] of Object.entries(model.tables || {})) {
    lines.push(`%T\t${tableName}`);
    const fields = payload.fields || [];
    lines.push(`%F\t${fields.join('\t')}`);
    for (const record of (payload.records || [])) {
      const cells = fields.map(f => {
        const v = record[f];
        return v == null ? '' : String(v);
      });
      lines.push(`%R\t${cells.join('\t')}`);
    }
  }

  // Final %E
  lines.push('%E');

  return lines.join('\n') + '\n';
}
