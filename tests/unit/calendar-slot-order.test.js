import { describe, it, expect } from 'vitest';
import { parseCalendarData, getCalendarMap, addWorkDays } from '../../src/derived/calendars.js';

// P6 writes a calendar time slot in BOTH field orders:
//
//   (s|08:00|f|16:00)   start-first
//   (f|12:00|s|08:00)   finish-first
//
// The order belongs to the individual calendar, not to the export or the P6
// version: one genuine P6 24.12 export carries its five-day calendar
// start-first and its six-day calendar finish-first. The decoder used to match
// start-first only, at all three places it looks for a slot (the DaysOfWeek
// day scanner, the balanced-paren exception walker and the per-segment
// exception fallback). So every finish-first calendar decoded to zero work
// days, set parse_incomplete and was replaced downstream by Mon-Fri, and every
// finish-first exception body was filed as a holiday: an invented day off in
// place of a forced working day.
//
// The canonical Python xer-parser fixed this in e42b693 (2026-08-25), where it
// measured 17 finish-first calendars of 535 in 14 of 175 real files. The
// FINISH_FIRST_SIX_DAY, START_FIRST_FIVE_DAY and FINISH_FIRST_SEVEN_DAY strings
// and the line-marker calendar below are the fixtures of its regression test
// tests/test_calendar_slot_order_2026_08_25.py, transcribed from real exports
// with project identifiers removed. Every calendar in this file, including the
// cases added here, decodes exactly as the canonical parse_calendar_data
// decodes it (checked 2026-09-29).

const SEP = '\x7f\x7f'; // the P6 line marker seen in the wild

// Real finish-first six-day calendar (P6 days 2..7 = Mon..Sat).
const FINISH_FIRST_SIX_DAY_DOW =
  '(0||DaysOfWeek()((0||1()())' +
  [2, 3, 4, 5, 6, 7]
    .map(d => `(0||${d}()((0||0(f|12:00|s|08:00)())(0||1(f|17:00|s|13:00)())))`)
    .join('') +
  '))';
const FINISH_FIRST_SIX_DAY =
  `(0||CalendarData()(${FINISH_FIRST_SIX_DAY_DOW}(0||Exceptions())(0||VIEW(ShowTotal|Y)())))`;

// Real start-first five-day calendar, for the same-file mixed case.
const START_FIRST_FIVE_DAY =
  '(0||CalendarData()((0||DaysOfWeek()((0||1()())' +
  [2, 3, 4, 5, 6]
    .map(d => `(0||${d}()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))`)
    .join('') +
  '(0||7()()))))(0||Exceptions())(0||VIEW(ShowTotal|Y)())))';

// Real finish-first 7-day continuous calendar with mixed exceptions: two
// empty-body exceptions (true holidays) and two finish-first work-hour
// exceptions (forced working days), in the layout the real export uses.
const FINISH_FIRST_SEVEN_DAY =
  '(0||CalendarData()((0||DaysOfWeek()(' +
  [1, 2, 3, 4, 5, 6, 7]
    .map(d => `(0||${d}()((0||0(f|12:00|s|01:00)())(0||1(f|00:00|s|13:00)())))`)
    .join('') +
  '))(0||Exceptions()(' +
  '(0||0(d|41155)())' +
  '(0||1(d|40910)())' +
  '(0||2(d|36992)((0||0(f|12:00|s|8:00)())(0||1(f|17:00|s|13:00)())))' +
  '(0||3(d|36993)((0||0(f|12:00|s|8:00)())(0||1(f|17:00|s|13:00)())))' +
  '))))';

function calendarModel(rows) {
  return {
    tables: {
      CALENDAR: {
        fields: ['clndr_id', 'clndr_name', 'day_hr_cnt', 'week_hr_cnt', 'clndr_data'],
        records: rows,
      },
    },
  };
}

describe('parseCalendarData: time slots in either P6 field order', () => {
  it('decodes a finish-first DaysOfWeek block to its six-day week', () => {
    // The bug: this decoded to [] and fell back to a fabricated Mon-Fri.
    const r = parseCalendarData(FINISH_FIRST_SIX_DAY);
    expect(r.work_days).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.work_day_names).toEqual([
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ]);
    expect(r.parse_incomplete).toBe(false);
  });

  it('still decodes a start-first DaysOfWeek block unchanged', () => {
    // Guard against widening the pattern into one that accepts anything: the
    // start-first majority must decode exactly as before.
    const r = parseCalendarData(START_FIRST_FIVE_DAY);
    expect(r.work_days).toEqual([1, 2, 3, 4, 5]);
    expect(r.parse_incomplete).toBe(false);
  });

  it('decodes both orders within one export, per calendar', () => {
    // Both orders occur in the same genuine P6 24.12 file, so the order cannot
    // be picked per file: each calendar is read in its own order.
    const cmap = getCalendarMap(calendarModel([
      { clndr_id: '1', clndr_name: 'Five day', day_hr_cnt: '8', week_hr_cnt: '40', clndr_data: START_FIRST_FIVE_DAY },
      { clndr_id: '2', clndr_name: 'Six day', day_hr_cnt: '8', week_hr_cnt: '48', clndr_data: FINISH_FIRST_SIX_DAY },
    ]));
    expect(cmap['1'].work_days).toEqual([1, 2, 3, 4, 5]);
    expect(cmap['2'].work_days).toEqual([1, 2, 3, 4, 5, 6]);
    expect(cmap['1'].parse_incomplete).toBe(false);
    expect(cmap['2'].parse_incomplete).toBe(false);
  });

  it('works Saturday on a finish-first six-day calendar instead of falling back to Mon-Fri', () => {
    // End to end: before the fix the calendar decoded to no work days, so the
    // arithmetic substituted Mon-Fri and one working day after Friday
    // 2026-09-25 landed on Monday 2026-09-28.
    const cal = parseCalendarData(FINISH_FIRST_SIX_DAY);
    const d = addWorkDays('2026-09-25', 1, cal);
    expect(d.toISOString().slice(0, 10)).toBe('2026-09-26');
  });

  it('files finish-first exception bodies as special workdays, not holidays', () => {
    // The worse half of the bug: a finish-first exception body was filed as a
    // holiday, inventing a day off on a continuous calendar.
    const r = parseCalendarData(FINISH_FIRST_SEVEN_DAY);
    expect(r.work_days).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(r.special_workdays).toContain('2001-04-11'); // serial 36992
    expect(r.special_workdays).toContain('2001-04-12'); // serial 36993
    expect(r.holidays).not.toContain('2001-04-11');
    expect(r.holidays).not.toContain('2001-04-12');
    // Empty-body exceptions must still be holidays.
    expect(r.holidays).toContain('2012-09-03'); // serial 41155
    expect(r.holidays).toContain('2012-01-02'); // serial 40910
  });

  it('decodes finish-first slots with line markers and a single-digit hour', () => {
    // P6 separates a serial from its body with \x7f\x7f markers and writes
    // single-digit hours; both must survive alongside the reversed order.
    const days = [2, 3, 4, 5, 6, 7]
      .map(d => `    (0||${d}()(${SEP}      (0||0(f|12:00|s|8:00)())))`)
      .join(SEP);
    const exc =
      `    (0||0(d|36982)(${SEP}      (0||0(f|17:00|s|13:00)())))` +
      `${SEP}    (0||1(d|40000)())`;
    const clndr =
      `(0||CalendarData()(${SEP}  (0||DaysOfWeek()(${SEP}${days}))${SEP}  ` +
      `(0||Exceptions()(${SEP}${exc})))`;
    const r = parseCalendarData(clndr);
    expect(r.work_days).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.parse_incomplete).toBe(false);
    expect(r.special_workdays).toContain('2001-04-01'); // serial 36982
    expect(r.holidays).toContain('2009-07-06');         // serial 40000, empty body
  });

  it('files a finish-first body on a YYYY-MM-DD exception as a special workday', () => {
    // A string-dated exception is classified by the balanced-paren walker
    // alone (the per-segment fallback reads integer serials only), so this
    // pins the walker's own slot test. Same result as canonical.
    const exc =
      '(0||Exceptions()(' +
      '(0||0(d|2026-07-01)((0||0(f|12:00|s|08:00)())(0||1(f|17:00|s|13:00)())))' +
      '(0||0(d|2026-07-02)())' +
      '))';
    const r = parseCalendarData(`(0||CalendarData()(${FINISH_FIRST_SIX_DAY_DOW}${exc}))`);
    expect(r.work_days).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.special_workdays).toEqual(['2026-07-01']);
    expect(r.holidays).toEqual(['2026-07-02']);
  });

  it('accepts a single-digit hour in any field of either order', () => {
    const slots = ['(s|8:00|f|16:00)', '(s|08:00|f|9:00)', '(f|9:00|s|8:00)', '(f|16:00|s|8:00)'];
    for (const slot of slots) {
      const days = `(0||1()())(0||2()((0||0${slot}())))(0||3()())`;
      const r = parseCalendarData(`(0||CalendarData()((0||DaysOfWeek()(${days}))))`);
      expect(r.work_days, slot).toEqual([1]);
    }
  });

  it('does not treat a slot with two finishes or two starts as a working time slot', () => {
    // Either order is accepted; a malformed pair is not.
    const bad = ['(f|12:00|f|16:00)', '(s|08:00|s|12:00)'];
    for (const slot of bad) {
      const days = [2, 3, 4, 5, 6].map(d => `(0||${d}()((0||0${slot}())))`).join('');
      const r = parseCalendarData(`(0||CalendarData()((0||DaysOfWeek()(${days}))))`);
      expect(r.work_days, slot).toEqual([]);
      expect(r.parse_incomplete, slot).toBe(true);
    }
  });
});
