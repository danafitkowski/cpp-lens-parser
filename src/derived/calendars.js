/**
 * calendars.js — P6 clndr_data parser + calendar arithmetic functions
 *
 * The P6 clndr_data string uses a proprietary parenthesised encoding:
 *   DaysOfWeek block: day 1=Sunday … day 7=Saturday; work days contain time slots.
 *   Exceptions block: holiday (no time slot) or special workday (has time slot).
 *
 * Calendar arithmetic functions mirror xer_parser.py:
 *   get_calendar_map (lines 617-647)
 *   get_work_days_between (lines 650-693)
 *   add_work_days (lines 708-778)
 *   subtract_work_days (lines 781-827)
 *   duration_hours_to_days (lines 830-846)
 */

import { getTable } from '../access.js';

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

// ─── Calendar map builder ─────────────────────────────────────────────────────

/**
 * Build a clndr_id → parsed-calendar-info lookup from a parsed XER model.
 * Mirrors get_calendar_map at xer_parser.py:617-647.
 *
 * Each value includes all fields from parseCalendarData plus:
 *   clndr_id, clndr_name, hours_per_day (number), hours_per_week (number).
 *
 * @param {object|null} model  Output of parseXer().
 * @returns {Record<string, object>}  Empty object if CALENDAR table is absent.
 */
export function getCalendarMap(model) {
  const calendars = getTable(model, 'CALENDAR');
  const cmap = {};

  for (const cal of calendars) {
    const clndrId = cal.clndr_id || '';
    if (!clndrId) continue;

    const parsed = parseCalendarData(cal.clndr_data || '');
    parsed.clndr_id = clndrId;
    parsed.clndr_name = cal.clndr_name || '';

    // Hours per day — store as number; fall back to 8 when missing/unparsable.
    const dayHr = cal.day_hr_cnt;
    const dayHrNum = parseFloat(dayHr);
    parsed.hours_per_day = Number.isFinite(dayHrNum) ? dayHrNum : 8;

    // Hours per week — store as number; fall back to 40 when missing/unparsable.
    const weekHr = cal.week_hr_cnt;
    const weekHrNum = parseFloat(weekHr);
    parsed.hours_per_week = Number.isFinite(weekHrNum) ? weekHrNum : 40;

    cmap[clndrId] = parsed;
  }

  return cmap;
}

// ─── Internal arithmetic helpers ──────────────────────────────────────────────

/**
 * Format a UTC Date as 'YYYY-MM-DD'.
 * @param {Date} dt
 * @returns {string}
 */
function _ymdString(dt) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/**
 * True if `dt` is a working day on the given calendar.
 *
 * P6 work_days list uses the same weekday numbering as JS Date.getUTCDay():
 *   0=Sunday, 1=Monday, … 6=Saturday.
 * (Python must convert from its own Mon=0 convention; JS does not need to.)
 *
 * @param {Date}   dt          UTC midnight Date.
 * @param {number[]} workDays  P6 weekday indices that are working.
 * @param {Set<string>} holidaySet  ISO date strings 'YYYY-MM-DD' of non-working exceptions.
 * @returns {boolean}
 */
function _isWorkDay(dt, workDays, holidaySet) {
  const idx = dt.getUTCDay(); // 0=Sun..6=Sat — same as P6 work_days indexing
  if (!workDays.includes(idx)) return false;
  if (holidaySet.has(_ymdString(dt))) return false;
  return true;
}

/**
 * Parse a 'YYYY-MM-DD' string (or Date object) into a UTC midnight Date.
 * Returns null on failure.
 *
 * @param {string|Date|null} input
 * @returns {Date|null}
 */
function _parseYmd(input) {
  if (input == null) return null;
  if (input instanceof Date) {
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  }
  const m = String(input).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

/**
 * Add `n` calendar days to a UTC Date, returning a new Date.
 * @param {Date} date
 * @param {number} n  May be negative.
 * @returns {Date}
 */
function _addDays(date, n) {
  return new Date(date.getTime() + n * 86400000);
}

/**
 * Resolve calInfo into normalised {workDays, holidaySet}.
 * When calInfo is null or lacks a work_days list, defaults to Mon-Fri.
 *
 * @param {object|null} calInfo
 * @returns {{ workDays: number[], holidaySet: Set<string> }}
 */
function _resolveCal(calInfo) {
  if (!calInfo) return { workDays: [1, 2, 3, 4, 5], holidaySet: new Set() };
  const workDays = (Array.isArray(calInfo.work_days) && calInfo.work_days.length > 0)
    ? calInfo.work_days
    : [1, 2, 3, 4, 5];
  const holidaySet = new Set(Array.isArray(calInfo.holidays) ? calInfo.holidays : []);
  return { workDays, holidaySet };
}

// ─── Public calendar arithmetic ───────────────────────────────────────────────

/**
 * Count working days between two dates, inclusive of both endpoints
 * when they fall on a working day.
 *
 * Mirrors get_work_days_between at xer_parser.py:650-693.
 *
 * @param {string|Date|null} start  'YYYY-MM-DD' or Date.
 * @param {string|Date|null} end    'YYYY-MM-DD' or Date.
 * @param {object|null} calInfo     Calendar info (from getCalendarMap). null → Mon-Fri.
 * @returns {number|null}  null when either date is missing or unparsable.
 */
export function getWorkDaysBetween(start, end, calInfo) {
  if (!start || !end) return null;
  const s = _parseYmd(start);
  const e = _parseYmd(end);
  if (!s || !e) return null;

  const { workDays, holidaySet } = _resolveCal(calInfo);

  // Bound the span. A pathological pair (e.g. 0001-01-01 → 9999-12-31) is ~3.6M
  // day-steps — a multi-second freeze. Cap at 100 years of days; no real
  // schedule window exceeds that, and a runaway just stops counting at the cap
  // rather than hanging.
  const MAX_SPAN_DAYS = 366 * 100;
  let count = 0;
  let cur = s;
  let steps = 0;
  while (cur <= e && steps < MAX_SPAN_DAYS) {
    if (_isWorkDay(cur, workDays, holidaySet)) count++;
    cur = _addDays(cur, 1);
    steps += 1;
  }
  return count;
}

/**
 * Advance start_date by n_workdays working days on the given calendar.
 *
 * Walks the calendar day-by-day from start_date, skipping non-work weekdays
 * and exception holidays, counting only actual work days. Returns the Date
 * on which the nth working day lands.
 *
 * P6 CPM convention: EF = ES + duration means the task occupies N work days.
 * A 5-workday task on a Mon-Fri calendar starting Monday "finishes" the
 * following Monday (5 steps of the walk land Mon→Tue→Wed→Thu→Fri→Mon).
 *
 * Negative n delegates to subtractWorkDays for symmetry.
 * n = 0 returns start_date unchanged.
 *
 * Mirrors add_work_days at xer_parser.py:708-778.
 *
 * @param {string|Date} start      'YYYY-MM-DD' or Date.
 * @param {number|null} n          Working days to add. Fractional values are rounded.
 * @param {object|null} calInfo    Calendar info. null → Mon-Fri, no holidays.
 * @returns {Date}
 * @throws {Error} If start cannot be parsed.
 */
export function addWorkDays(start, n, calInfo) {
  let nWd = (n == null) ? 0 : Math.round(Number(n));
  if (!Number.isFinite(nWd)) nWd = 0;
  if (nWd < 0) return subtractWorkDays(start, -nWd, calInfo);

  const startDate = _parseYmd(start);
  if (!startDate) throw new Error(`addWorkDays: cannot parse start=${JSON.stringify(start)}`);
  if (nWd === 0) return startDate;

  const { workDays, holidaySet } = _resolveCal(calInfo);
  if (workDays.length === 0) return startDate;

  // Iteration cap. work_days can be non-empty yet every reachable day blocked
  // by holidays (a pathological / malicious calendar whose exception list
  // covers all working weekdays) — without a cap the walk spins forever and
  // freezes the tab/thread. The bound is generous: 14 calendar days per
  // requested work-day (handles a once-a-fortnight calendar) plus a 100-year
  // floor, far beyond any real schedule. If hit, the calendar has no reachable
  // work day; we terminate and return the furthest date walked (best-effort,
  // finite) rather than hang.
  const maxSteps = Math.max(nWd * 14 + 366, 366 * 100);
  let cur = startDate;
  let remaining = nWd;
  let steps = 0;
  while (remaining > 0 && steps < maxSteps) {
    cur = _addDays(cur, 1);
    steps += 1;
    if (_isWorkDay(cur, workDays, holidaySet)) remaining -= 1;
  }
  return cur;
}

/**
 * Walk backwards n_workdays working days from end_date on the given calendar.
 *
 * Used by the CPM backward pass: LS = LF − duration on the activity's calendar.
 * A 5-workday task finishing Friday starts Monday (not the prior Sunday).
 *
 * Negative n delegates to addWorkDays for symmetry.
 * n = 0 returns end_date unchanged.
 *
 * Mirrors subtract_work_days at xer_parser.py:781-827.
 *
 * @param {string|Date} end        'YYYY-MM-DD' or Date.
 * @param {number|null} n          Working days to subtract. Fractional values are rounded.
 * @param {object|null} calInfo    Calendar info. null → Mon-Fri, no holidays.
 * @returns {Date}
 * @throws {Error} If end cannot be parsed.
 */
export function subtractWorkDays(end, n, calInfo) {
  let nWd = (n == null) ? 0 : Math.round(Number(n));
  if (!Number.isFinite(nWd)) nWd = 0;
  if (nWd < 0) return addWorkDays(end, -nWd, calInfo);

  const endDate = _parseYmd(end);
  if (!endDate) throw new Error(`subtractWorkDays: cannot parse end=${JSON.stringify(end)}`);
  if (nWd === 0) return endDate;

  const { workDays, holidaySet } = _resolveCal(calInfo);
  if (workDays.length === 0) return endDate;

  // Iteration cap — see addWorkDays. Guards against a calendar whose holidays
  // block every reachable working day, which would otherwise loop forever.
  const maxSteps = Math.max(nWd * 14 + 366, 366 * 100);
  let cur = endDate;
  let remaining = nWd;
  let steps = 0;
  while (remaining > 0 && steps < maxSteps) {
    cur = _addDays(cur, -1);
    steps += 1;
    if (_isWorkDay(cur, workDays, holidaySet)) remaining -= 1;
  }
  return cur;
}

/**
 * Convert a P6 duration in hours to working days.
 *
 * Divides hours by hours_per_day from calInfo (or defaultHrsPerDay when absent).
 * Returns 0 for null/0/non-numeric hours, or when hours_per_day ≤ 0.
 * Pass ndigits to round to a fixed number of decimal places.
 *
 * Mirrors duration_hours_to_days at xer_parser.py:830-846.
 *
 * @param {number|string|null} hours
 * @param {object|null} calInfo          { hours_per_day } — overrides defaultHrsPerDay.
 * @param {number} [defaultHrsPerDay=8]  Fallback hours/day when calInfo is absent.
 * @param {number|null} [ndigits=null]   Decimal places to round to; null = no rounding.
 * @returns {number}
 */
export function durationHoursToDays(hours, calInfo, defaultHrsPerDay = 8, ndigits = null) {
  if (!hours) return 0;
  const h = Number(hours);
  if (!Number.isFinite(h)) return 0;

  let hpd = defaultHrsPerDay;
  if (calInfo && calInfo.hours_per_day) {
    hpd = Number(calInfo.hours_per_day);
  }
  if (!Number.isFinite(hpd) || hpd <= 0) return 0;

  const result = h / hpd;
  if (ndigits == null) return result;
  const f = Math.pow(10, ndigits);
  return Math.round(result * f) / f;
}
