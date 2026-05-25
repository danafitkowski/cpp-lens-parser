import { describe, it, expect } from 'vitest';
import {
  getCalendarMap, getWorkDaysBetween, addWorkDays, subtractWorkDays, durationHoursToDays,
} from '../../src/derived/calendars.js';
import { parseXer } from '../../src/parse-xer.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, '..', 'fixtures');

const MON_FRI_CAL = { work_days: [1, 2, 3, 4, 5], holidays: [], hours_per_day: 8 };
// Wed 2024-01-17 is a holiday
const M_F_WITH_HOLIDAY = { work_days: [1, 2, 3, 4, 5], holidays: ['2024-01-17'], hours_per_day: 8 };

/** Format a Date as YYYY-MM-DD using UTC fields. */
function formatYmd(d) {
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// ─── getCalendarMap ───────────────────────────────────────────────────────────

describe('getCalendarMap', () => {
  it('builds clndr_id → parsed calendar info for a fixture XER', () => {
    const text = readFileSync(join(FIX, 'minimal-3-task.xer'), 'utf-8');
    const m = parseXer(text);
    const cmap = getCalendarMap(m);
    expect(Object.keys(cmap).length).toBeGreaterThan(0);
    expect(cmap['C1']).toBeDefined();
    const cal = cmap['C1'];
    expect(cal).toHaveProperty('work_days');
    expect(cal).toHaveProperty('holidays');
    expect(cal).toHaveProperty('raw');
  });

  it('populates clndr_name from the CALENDAR row', () => {
    const text = readFileSync(join(FIX, 'minimal-3-task.xer'), 'utf-8');
    const m = parseXer(text);
    const cmap = getCalendarMap(m);
    expect(cmap['C1'].clndr_name).toBe('5-Day');
  });

  it('populates hours_per_day from day_hr_cnt as a number', () => {
    const text = readFileSync(join(FIX, 'minimal-3-task.xer'), 'utf-8');
    const m = parseXer(text);
    const cmap = getCalendarMap(m);
    expect(cmap['C1'].hours_per_day).toBe(8);
  });

  it('populates hours_per_week from week_hr_cnt as a number', () => {
    const text = readFileSync(join(FIX, 'minimal-3-task.xer'), 'utf-8');
    const m = parseXer(text);
    const cmap = getCalendarMap(m);
    expect(cmap['C1'].hours_per_week).toBe(40);
  });

  it('returns empty object when CALENDAR table is missing', () => {
    expect(getCalendarMap({ tables: {} })).toEqual({});
  });

  it('returns empty object when model is null', () => {
    expect(getCalendarMap(null)).toEqual({});
  });

  it('skips rows with no clndr_id', () => {
    const model = {
      tables: {
        CALENDAR: {
          fields: ['clndr_id', 'clndr_name', 'day_hr_cnt', 'week_hr_cnt', 'clndr_data'],
          records: [
            { clndr_id: '', clndr_name: 'Bad', day_hr_cnt: '8', week_hr_cnt: '40', clndr_data: '' },
            { clndr_id: 'C1', clndr_name: 'Good', day_hr_cnt: '8', week_hr_cnt: '40', clndr_data: '' },
          ],
        },
      },
    };
    const cmap = getCalendarMap(model);
    expect(Object.keys(cmap)).toEqual(['C1']);
  });

  it('falls back to 8 hrs/day when day_hr_cnt is non-numeric', () => {
    const model = {
      tables: {
        CALENDAR: {
          fields: ['clndr_id', 'day_hr_cnt', 'week_hr_cnt', 'clndr_data'],
          records: [
            { clndr_id: 'X1', day_hr_cnt: 'bad', week_hr_cnt: '40', clndr_data: '' },
          ],
        },
      },
    };
    const cmap = getCalendarMap(model);
    expect(cmap['X1'].hours_per_day).toBe(8);
  });
});

// ─── getWorkDaysBetween ───────────────────────────────────────────────────────

describe('getWorkDaysBetween', () => {
  it('Mon-Fri Mon→Fri (same week) = 5 work days inclusive', () => {
    // 2024-01-15 (Mon) → 2024-01-19 (Fri)
    expect(getWorkDaysBetween('2024-01-15', '2024-01-19', MON_FRI_CAL)).toBe(5);
  });

  it('Mon-Fri Mon→Sun (full week) = 5 (Sat/Sun excluded)', () => {
    // 2024-01-15 (Mon) → 2024-01-21 (Sun)
    expect(getWorkDaysBetween('2024-01-15', '2024-01-21', MON_FRI_CAL)).toBe(5);
  });

  it('Mon-Fri Mon→Mon (two weeks) = 6 work days', () => {
    // 2024-01-15 (Mon) → 2024-01-22 (Mon) = 5 + 1 = 6
    expect(getWorkDaysBetween('2024-01-15', '2024-01-22', MON_FRI_CAL)).toBe(6);
  });

  it('skips a holiday inside the range', () => {
    // 2024-01-17 (Wed) is a holiday → 4 work days instead of 5
    expect(getWorkDaysBetween('2024-01-15', '2024-01-19', M_F_WITH_HOLIDAY)).toBe(4);
  });

  it('defaults to Mon-Fri when calInfo is null', () => {
    expect(getWorkDaysBetween('2024-01-15', '2024-01-19', null)).toBe(5);
  });

  it('returns null for empty start date', () => {
    expect(getWorkDaysBetween('', '2024-01-19', MON_FRI_CAL)).toBeNull();
  });

  it('returns null for null end date', () => {
    expect(getWorkDaysBetween('2024-01-15', null, MON_FRI_CAL)).toBeNull();
  });

  it('returns null for both dates missing', () => {
    expect(getWorkDaysBetween(null, null, MON_FRI_CAL)).toBeNull();
  });

  it('same-day start and end = 1 if it is a work day', () => {
    // 2024-01-15 is Monday
    expect(getWorkDaysBetween('2024-01-15', '2024-01-15', MON_FRI_CAL)).toBe(1);
  });

  it('same-day start and end = 0 if it is a weekend', () => {
    // 2024-01-13 is Saturday
    expect(getWorkDaysBetween('2024-01-13', '2024-01-13', MON_FRI_CAL)).toBe(0);
  });

  it('end before start returns 0', () => {
    expect(getWorkDaysBetween('2024-01-19', '2024-01-15', MON_FRI_CAL)).toBe(0);
  });
});

// ─── addWorkDays ──────────────────────────────────────────────────────────────

describe('addWorkDays', () => {
  it('5 work days from Mon lands on the next Mon (day-walk semantics)', () => {
    // Mon 2024-01-15 + 5 wd: Tue/Wed/Thu/Fri=4, skip Sat+Sun, Mon 1/22=5
    const r = addWorkDays('2024-01-15', 5, MON_FRI_CAL);
    expect(formatYmd(r)).toBe('2024-01-22');
  });

  it('1 work day from Mon = Tue', () => {
    const r = addWorkDays('2024-01-15', 1, MON_FRI_CAL);
    expect(formatYmd(r)).toBe('2024-01-16');
  });

  it('0 work days returns start date unchanged', () => {
    const r = addWorkDays('2024-01-15', 0, MON_FRI_CAL);
    expect(formatYmd(r)).toBe('2024-01-15');
  });

  it('skips a holiday — takes an extra day to land', () => {
    // Mon 1/15 + 4 wd, holiday on Wed 1/17:
    // Tue 1/16(1), [skip Wed 1/17 holiday], Thu 1/18(2), Fri 1/19(3), [skip Sat+Sun], Mon 1/22(4)
    const r = addWorkDays('2024-01-15', 4, M_F_WITH_HOLIDAY);
    expect(formatYmd(r)).toBe('2024-01-22');
  });

  it('negative n delegates to subtractWorkDays', () => {
    // Fri 1/19 - 4 wd = Mon 1/15
    const r = addWorkDays('2024-01-19', -4, MON_FRI_CAL);
    expect(formatYmd(r)).toBe('2024-01-15');
  });

  it('defaults to Mon-Fri when calInfo is null', () => {
    const r = addWorkDays('2024-01-15', 1, null);
    expect(formatYmd(r)).toBe('2024-01-16');
  });

  it('null n_workdays treated as 0', () => {
    const r = addWorkDays('2024-01-15', null, MON_FRI_CAL);
    expect(formatYmd(r)).toBe('2024-01-15');
  });

  it('adds across a weekend boundary', () => {
    // Fri 1/19 + 1 wd = Mon 1/22 (skips Sat+Sun)
    const r = addWorkDays('2024-01-19', 1, MON_FRI_CAL);
    expect(formatYmd(r)).toBe('2024-01-22');
  });

  it('5 workday task starting Monday finishes Friday (P6 EF = ES + duration)', () => {
    // This is the canonical CPM EF=ES+dur check.
    // Note: result is Mon 1/22, not Fri 1/19, because we walk PAST start.
    // ES=Mon1/15 duration=5 → EF=Mon1/22 (day-walk: 5 steps away from start)
    const r = addWorkDays('2024-01-15', 5, MON_FRI_CAL);
    expect(formatYmd(r)).toBe('2024-01-22');
  });
});

// ─── subtractWorkDays ─────────────────────────────────────────────────────────

describe('subtractWorkDays', () => {
  it('4 work days back from Fri = Mon of same week', () => {
    // Fri 2024-01-19 - 4 wd: Thu(1), Wed(2), Tue(3), Mon(4) = 2024-01-15
    const r = subtractWorkDays('2024-01-19', 4, MON_FRI_CAL);
    expect(formatYmd(r)).toBe('2024-01-15');
  });

  it('1 work day back from Tue = Mon', () => {
    const r = subtractWorkDays('2024-01-16', 1, MON_FRI_CAL);
    expect(formatYmd(r)).toBe('2024-01-15');
  });

  it('0 work days returns end date unchanged', () => {
    const r = subtractWorkDays('2024-01-19', 0, MON_FRI_CAL);
    expect(formatYmd(r)).toBe('2024-01-19');
  });

  it('negative n delegates to addWorkDays', () => {
    // subtractWorkDays(Mon 1/15, -1) = addWorkDays(Mon 1/15, 1) = Tue 1/16
    const r = subtractWorkDays('2024-01-15', -1, MON_FRI_CAL);
    expect(formatYmd(r)).toBe('2024-01-16');
  });

  it('skips a holiday going backwards', () => {
    // Fri 1/19 - 4 wd, holiday on Wed 1/17:
    // Thu 1/18(1), [skip Wed 1/17 holiday], Tue 1/16(2), Mon 1/15(3), [skip Sat+Sun], Fri 1/12(4)
    const r = subtractWorkDays('2024-01-19', 4, M_F_WITH_HOLIDAY);
    expect(formatYmd(r)).toBe('2024-01-12');
  });

  it('defaults to Mon-Fri when calInfo is null', () => {
    const r = subtractWorkDays('2024-01-19', 4, null);
    expect(formatYmd(r)).toBe('2024-01-15');
  });

  it('crosses a weekend boundary going back', () => {
    // Mon 1/22 - 1 wd = Fri 1/19 (skips Sat+Sun going back)
    const r = subtractWorkDays('2024-01-22', 1, MON_FRI_CAL);
    expect(formatYmd(r)).toBe('2024-01-19');
  });

  it('addWorkDays and subtractWorkDays are inverses', () => {
    const start = '2024-03-11';
    const n = 7;
    const forward = addWorkDays(start, n, MON_FRI_CAL);
    const back = subtractWorkDays(formatYmd(forward), n, MON_FRI_CAL);
    expect(formatYmd(back)).toBe(start);
  });
});

// ─── durationHoursToDays ─────────────────────────────────────────────────────

describe('durationHoursToDays', () => {
  it('40 hr at 8 hr/day = 5 days', () => {
    expect(durationHoursToDays(40, { hours_per_day: 8 })).toBe(5);
  });

  it('defaults to 8 hr/day when calInfo is null', () => {
    expect(durationHoursToDays(40, null)).toBe(5);
  });

  it('null hours returns 0', () => {
    expect(durationHoursToDays(null, null)).toBe(0);
  });

  it('0 hours returns 0', () => {
    expect(durationHoursToDays(0, null)).toBe(0);
  });

  it('string hours are coerced to number', () => {
    expect(durationHoursToDays('40', { hours_per_day: 8 })).toBe(5);
  });

  it('non-numeric hours returns 0', () => {
    expect(durationHoursToDays('bad', null)).toBe(0);
  });

  it('rounds to ndigits when requested', () => {
    expect(durationHoursToDays(10, { hours_per_day: 8 }, 8, 2)).toBe(1.25);
  });

  it('ndigits=0 rounds to integer', () => {
    expect(durationHoursToDays(10, { hours_per_day: 8 }, 8, 0)).toBe(1);
  });

  it('respects calInfo.hours_per_day over defaultHrsPerDay', () => {
    // calInfo says 10 hr/day, default is 8; 40 hr / 10 = 4
    expect(durationHoursToDays(40, { hours_per_day: 10 }, 8)).toBe(4);
  });

  it('uses defaultHrsPerDay when calInfo has no hours_per_day', () => {
    expect(durationHoursToDays(40, {}, 10)).toBe(4);
  });

  it('zero hours_per_day is falsy — falls through to defaultHrsPerDay (matches Python semantics)', () => {
    // Python: `if calendar_info and calendar_info.get('hours_per_day')` is falsy when 0,
    // so defaultHrsPerDay=8 is used → 40/8=5. The guard `hrs_per_day <= 0` never fires.
    expect(durationHoursToDays(40, { hours_per_day: 0 })).toBe(5);
  });

  it('negative hours_per_day returns 0', () => {
    expect(durationHoursToDays(40, { hours_per_day: -8 })).toBe(0);
  });
});
