/**
 * calendars.js — P6 clndr_data parser (port of xer_parser.py parse_calendar_data)
 *
 * The P6 clndr_data string uses a proprietary parenthesised encoding:
 *   DaysOfWeek block: day 1=Sunday … day 7=Saturday; work days contain time slots.
 *   Exceptions block: holiday (no time slot) or special workday (has time slot).
 */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Return the contents inside the balanced () block that follows `anchor` in `text`.
 * Mirrors the Python _balanced_block_after helper exactly.
 *
 * P6 uses `DaysOfWeek()(...)` and `Exceptions()(...)` — the anchor's own `()` is
 * the empty-paren pair; we want the second `(` that opens the real content block.
 *
 * @param {string} text
 * @param {string} anchor
 * @returns {string|null}
 */
function _balancedBlockAfter(text, anchor) {
  const idx = text.indexOf(anchor);
  if (idx < 0) return null;

  // Find the `(` that starts the block after the anchor keyword.
  let openIdx = text.indexOf('(', idx + anchor.length);
  if (openIdx < 0) return null;

  // Skip over a possible empty-paren pair `()` that comes immediately.
  if (text.slice(openIdx, openIdx + 2) === '()') {
    openIdx = text.indexOf('(', openIdx + 2);
  }
  if (openIdx < 0) return null;

  let depth = 0;
  for (let k = openIdx; k < text.length; k++) {
    const ch = text[k];
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) {
        return text.slice(openIdx + 1, k);
      }
    }
  }
  return null;
}

/**
 * Convert a P6 exception date serial (int Excel serial or YYYY-MM-DD string) to
 * an ISO date string. Returns '' if malformed or outside the 1990–2050 range.
 *
 * @param {string} serialRaw
 * @returns {string}
 */
function _xerExceptionSerialToIso(serialRaw) {
  const s = serialRaw.trim();

  // 5- or 6-digit integer Excel serial. Excel epoch = 1899-12-30.
  if (/^\d{5,6}$/.test(s)) {
    try {
      const serial = parseInt(s, 10);
      // 1899-12-30 in ms + serial days
      const epoch = Date.UTC(1899, 11, 30); // month is 0-based
      const ms = epoch + serial * 86400000;
      const dt = new Date(ms);
      const year = dt.getUTCFullYear();
      if (year >= 1990 && year <= 2050) {
        const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const dy = String(dt.getUTCDate()).padStart(2, '0');
        return `${year}-${mo}-${dy}`;
      }
    } catch (_) {
      // fall through
    }
  }

  // String date (legacy format YYYY-MM-DD)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) {
    try {
      const year = parseInt(m[1].slice(0, 4), 10);
      if (year >= 1990 && year <= 2050) {
        return m[1];
      }
    } catch (_) {
      // fall through
    }
  }

  return '';
}

/** Regex to identify the start of a day segment inside a DaysOfWeek block. */
const RE_DAY_SEGMENT = /^\(0\|\|(\d)\(\)/;
/** Regex to detect a P6 time slot `(s|HH:MM|f|HH:MM)`. */
const RE_TIME_SLOT = /\(s\|\d{1,2}:\d{2}\|f\|\d{1,2}:\d{2}\)/;
/** Regex to match the start of an exception segment `(0||0(d|<serial>)`. */
const RE_EXCEPTION_SEGMENT = /^\(0\|\|0\(d\|([^)]+)\)/;

/**
 * Parse the P6 clndr_data field from the CALENDAR table.
 *
 * @param {string} clndrDataStr  Raw clndr_data value (may be empty/null).
 * @returns {{
 *   work_days: number[],
 *   work_day_names: string[],
 *   holidays: string[],
 *   special_workdays: string[],
 *   exceptions: any[],
 *   hours_per_day: number|null,
 *   raw: string,
 * }}
 */
export function parseCalendarData(clndrDataStr) {
  const raw = clndrDataStr ?? '';
  const result = {
    work_days: [],
    work_day_names: [],
    holidays: [],
    special_workdays: [],
    exceptions: [],
    hours_per_day: null,
    raw,
  };

  if (!raw || !raw.trim()) {
    return result;
  }

  // ── DaysOfWeek block ────────────────────────────────────────────────────────

  const dowBlock = _balancedBlockAfter(raw, 'DaysOfWeek');
  if (dowBlock !== null) {
    let i = 0;
    while (i < dowBlock.length) {
      const m = dowBlock.slice(i).match(RE_DAY_SEGMENT);
      if (!m) {
        i++;
        continue;
      }
      const dayNum = parseInt(m[1], 10);
      const start = i;

      // Walk to the matching close paren of this day segment.
      let depth = 0;
      let j = i;
      while (j < dowBlock.length) {
        const ch = dowBlock[j];
        if (ch === '(') {
          depth++;
        } else if (ch === ')') {
          depth--;
          if (depth === 0) {
            j++;
            break;
          }
        }
        j++;
      }

      const dayBody = dowBlock.slice(start, j);
      if (RE_TIME_SLOT.test(dayBody)) {
        const dayIdx = dayNum - 1; // P6 day 1=Sun → JS idx 0=Sun
        if (dayIdx >= 0 && dayIdx <= 6) {
          result.work_days.push(dayIdx);
          result.work_day_names.push(DAY_NAMES[dayIdx]);
        }
      }
      i = j;
    }
  }

  // ── Fallback 1: legacy `(d|N)` bare-day patterns ──────────────────────────

  if (result.work_days.length === 0) {
    const bareDays = new Set(
      [...raw.matchAll(/\(d\|(\d)\)/g)].map(m => parseInt(m[1], 10))
    );
    for (let dayIdx = 0; dayIdx <= 6; dayIdx++) {
      const dayNum = dayIdx + 1;
      if (bareDays.has(dayNum)) {
        result.work_days.push(dayIdx);
        result.work_day_names.push(DAY_NAMES[dayIdx]);
      }
    }
  }

  // ── Fallback 2: very-legacy `d|N(s|` inline pattern ───────────────────────

  if (result.work_days.length === 0) {
    for (let dayIdx = 0; dayIdx <= 6; dayIdx++) {
      const dayNum = dayIdx + 1;
      if (raw.includes(`d|${dayNum}(s|`)) {
        result.work_days.push(dayIdx);
        result.work_day_names.push(DAY_NAMES[dayIdx]);
      }
    }
  }

  // ── Exceptions block ────────────────────────────────────────────────────────

  const excBlock = _balancedBlockAfter(raw, 'Exceptions');
  if (excBlock) {
    // Balanced-paren walker: primary pass
    let i = 0;
    while (i < excBlock.length) {
      const m = excBlock.slice(i).match(RE_EXCEPTION_SEGMENT);
      if (!m) {
        i++;
        continue;
      }
      const serialRaw = m[1];
      // Move past the `(d|...)` portion to where <body> begins
      let j = i + m[0].length;
      // Skip whitespace
      while (j < excBlock.length && /[ \t\r\n]/.test(excBlock[j])) j++;

      let bodyStart = j;
      let bodyEnd = bodyStart;
      if (j < excBlock.length && excBlock[j] === '(') {
        let depth = 0;
        let k = j;
        while (k < excBlock.length) {
          const ch = excBlock[k];
          if (ch === '(') {
            depth++;
          } else if (ch === ')') {
            depth--;
            if (depth === 0) {
              bodyEnd = k + 1;
              break;
            }
          }
          k++;
        }
      }
      const bodyText = bodyEnd > bodyStart ? excBlock.slice(bodyStart, bodyEnd) : '';
      const isSpecialWorkday = RE_TIME_SLOT.test(bodyText);
      const isoDate = _xerExceptionSerialToIso(serialRaw);
      if (isoDate) {
        if (isSpecialWorkday) {
          result.special_workdays.push(isoDate);
        } else {
          result.holidays.push(isoDate);
        }
      }
      // Advance past this segment; bodyEnd ends on body's closing paren
      i = Math.max(bodyEnd, i + 1);
    }

    // ── Fallback regex pass (mirrors Python's proven v1.0 fallback) ──────────
    // Union with the walker output to catch any P6-variant export formats.
    const walkerWorking = new Set(result.special_workdays);

    // Pre-scan serials that have a time-slot body → special workdays, not holidays.
    const specialSerials = new Set(
      [...excBlock.matchAll(/d\|(\d+)\)\(\(?\(?0?\|?\|?0?\(s\|\d{1,2}:\d{2}\|f\|/g)]
        .map(m => m[1])
    );

    // Integer Excel-serial exceptions: d|<int>
    for (const m of excBlock.matchAll(/d\|(\d+)\b/g)) {
      const serial = m[1];
      const iso = _xerExceptionSerialToIso(serial);
      if (!iso) continue;
      if (walkerWorking.has(iso)) continue;
      if (specialSerials.has(serial)) {
        if (!result.special_workdays.includes(iso)) {
          result.special_workdays.push(iso);
        }
      } else {
        result.holidays.push(iso);
      }
    }

    // Legacy string exceptions: d|YYYY-MM-DD
    for (const m of excBlock.matchAll(/d\|(\d{4}-\d{2}-\d{2})/g)) {
      const iso = m[1];
      try {
        const y = parseInt(iso.slice(0, 4), 10);
        if (y >= 1990 && y <= 2050 && !walkerWorking.has(iso)) {
          result.holidays.push(iso);
        }
      } catch (_) {
        // ignore
      }
    }
  }

  // Remove duplicates and sort
  result.holidays = [...new Set(result.holidays)].sort();
  result.special_workdays = [...new Set(result.special_workdays)].sort();

  return result;
}
