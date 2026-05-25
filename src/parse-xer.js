import { createEmptyModel } from './lens-model.js';
import { parseHeader } from './utils/header.js';

/**
 * Parse a P6 XER text into the canonical model shape.
 *
 * Mirrors the Python parse_xer at xer_parser.py:227-352. Output shape:
 * { ermhdr, tables, filepath, filename, parse_timestamp, encoding_used }.
 * Every record value is a string (passthrough; no type coercion).
 *
 * @param {string} text - Full XER file text (already decoded).
 * @param {object} [opts]
 * @param {string} [opts.filepath]
 * @param {string} [opts.filename]
 * @param {string} [opts.encoding_used]
 * @returns {object}
 */
export function parseXer(text, opts = {}) {
  const model = createEmptyModel();
  model.filepath = opts.filepath || '';
  model.filename = opts.filename || '';
  model.encoding_used = opts.encoding_used || '';
  model.parse_timestamp = nowTimestamp();

  if (!text) return model;

  const header = parseHeader(text);
  if (header) model.ermhdr = header;

  let currentTable = null;
  let currentFields = null;
  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    // Strip any residual CR (handles CRLF after split on \r?\n — defensive)
    const line = raw.replace(/\r$/, '');
    if (!line.trim()) continue;
    if (line.startsWith('ERMHDR')) continue;

    if (line.startsWith('%T\t')) {
      currentTable = line.slice(3).trim();
      currentFields = null;
      if (currentTable && !(currentTable in model.tables)) {
        model.tables[currentTable] = { fields: [], records: [] };
      }
      continue;
    }

    if (line.startsWith('%F\t')) {
      currentFields = line.slice(3).split('\t');
      if (currentTable && currentTable in model.tables) {
        model.tables[currentTable].fields = currentFields;
      }
      continue;
    }

    if (line.startsWith('%R\t')) {
      if (!currentTable || !currentFields) continue;
      const values = line.slice(3).split('\t');
      // Pad missing trailing values with empty strings (mirrors Python behaviour)
      while (values.length < currentFields.length) values.push('');
      const record = {};
      for (let i = 0; i < currentFields.length; i++) {
        record[currentFields[i]] = i < values.length ? values[i] : '';
      }
      model.tables[currentTable].records.push(record);
      continue;
    }

    // %E and anything else — no-op; falls through.
  }

  return model;
}

function nowTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
         `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
