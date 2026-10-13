/**
 * Calendars read the way P6 schedules on them (2026-10-13), each rule measured
 * on Primavera P6 Professional 23.12.1's own F9 and the one cpp-xer-parser
 * v0.4.0 and cpp-cpm-engine v2.10.1 apply.
 *
 * - Hours per day are the hours a calendar's shifts work when every working
 *   day of its week works the same hours H and day_hr_cnt says otherwise: a
 *   Monday-Saturday 07:00-17:00 calendar declaring 8 ran a 40 h activity over
 *   four days. The file's figure is kept as declared_hours_per_day.
 * - An EMPTY record (no clndr_data) is P6's internal Standard: Monday to
 *   Friday, 08:00-16:00, eight hours, no holidays, whatever day_hr_cnt
 *   declares (records declaring 10, 6 and 24 hours ran the same days). It has
 *   no shifts, so calendarShiftHours does not list it.
 *
 * Every calendar string is built here; no real export is copied. The tests
 * marked [discriminating] fail on v0.3.2.
 */
import { describe, it, expect } from 'vitest';
import {
  getCalendarMap, calendarShiftHours, durationHoursToDays, getWorkDaysBetween,
} from '../../src/derived/calendars.js';
import * as pkg from '../../src/index.js';

const TEN = '(0||0(s|07:00|f|17:00)())';
const TEN_FINISH_FIRST = '(0||0(f|17:00|s|07:00)())';
const EIGHT_SPLIT = '(0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())';
const FOUR = '(0||0(s|08:00|f|12:00)())';
const MIDNIGHT = '(0||0(s|00:00|f|00:00)())';

/** days: { P6 weekday 1=Sun..7=Sat: slot string } */
function blob(days) {
  let body = '';
  for (let d = 1; d <= 7; d++) body += `(0||${d}()(${days[d] || ''}))`;
  return `(0||CalendarData()((0||DaysOfWeek()(${body}))(0||Exceptions()())))`;
}
const monFri = (slot) => blob({ 2: slot, 3: slot, 4: slot, 5: slot, 6: slot });

function model(rows) {
  return {
    tables: {
      CALENDAR: {
        fields: ['clndr_id', 'clndr_name', 'day_hr_cnt', 'week_hr_cnt', 'clndr_data'],
        records: rows.map(([clndr_id, clndr_name, day_hr_cnt, week_hr_cnt, clndr_data]) =>
          ({ clndr_id, clndr_name, day_hr_cnt, week_hr_cnt, clndr_data })),
      },
    },
  };
}

describe('hours per day from the shifts', () => {
  it('[discriminating] a ten-hour week declaring 8 converts on its ten hours', () => {
    const cal = getCalendarMap(model([['S', 'Ten declared eight', '8', '40', monFri(TEN)]])).S;
    expect(cal.hours_per_day).toBe(10);
    expect(cal.declared_hours_per_day).toBe(8);
    expect(durationHoursToDays(40, cal)).toBe(4);
  });

  it('[discriminating] reads finish-first slots too', () => {
    const cal = getCalendarMap(model([['S', 'Finish first', '8', '40', monFri(TEN_FINISH_FIRST)]])).S;
    expect(cal.hours_per_day).toBe(10);
  });

  it('[discriminating] a 00:00 finish is midnight at the end of the day', () => {
    const all = blob({ 1: MIDNIGHT, 2: MIDNIGHT, 3: MIDNIGHT, 4: MIDNIGHT, 5: MIDNIGHT, 6: MIDNIGHT, 7: MIDNIGHT });
    const cal = getCalendarMap(model([['C', 'Continuous declared eight', '8', '56', all]])).C;
    expect(cal.hours_per_day).toBe(24);
    expect(cal.declared_hours_per_day).toBe(8);
  });

  it('keeps day_hr_cnt when the shifts work what it declares', () => {
    const cal = getCalendarMap(model([['S', 'Eight', '8', '40', monFri(EIGHT_SPLIT)]])).S;
    expect(cal.hours_per_day).toBe(8);
    expect(cal.declared_hours_per_day).toBeUndefined();
  });

  it('keeps day_hr_cnt for a week whose working days differ', () => {
    const uneven = blob({ 2: TEN, 3: TEN, 4: TEN, 5: TEN, 6: FOUR });
    const cal = getCalendarMap(model([['U', 'Uneven', '9', '44', uneven]])).U;
    expect(cal.hours_per_day).toBe(9);
    expect(cal.declared_hours_per_day).toBeUndefined();
  });

  it('keeps day_hr_cnt for an older bare-day encoding, which carries no hours', () => {
    const bare = '(0||CalendarData()((0||DaysOfWeek()((d|2)(d|3)(d|4)(d|5)(d|6)))(0||Exceptions()())))';
    const cal = getCalendarMap(model([['B', 'Bare days', '10', '50', bare]])).B;
    expect(cal.hours_per_day).toBe(10);
    expect(cal.declared_hours_per_day).toBeUndefined();
  });
});

describe('an empty calendar record', () => {
  it('[discriminating] is P6\'s internal Standard whatever it declares', () => {
    const cmap = getCalendarMap(model([
      ['E10', 'Empty ten', '10', '50', ''],
      ['E24', 'Empty twenty-four', '24', '168', ''],
      ['E8', 'Empty eight', '8', '40', ''],
    ]));
    for (const [id, declared] of [['E10', 10], ['E24', 24], ['E8', 8]]) {
      const cal = cmap[id];
      expect(cal.work_days).toEqual([1, 2, 3, 4, 5]);
      expect(cal.work_day_names).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
      expect(cal.holidays).toEqual([]);
      expect(cal.special_workdays).toEqual([]);
      expect(cal.parse_incomplete).toBe(false);
      expect(cal.hours_per_day).toBe(8);
      expect(cal.hours_per_week).toBe(40);
      expect(cal.empty_record).toBe(true);
      expect(cal.declared_hours_per_day).toBe(declared);
    }
  });

  it('[discriminating] converts hours at eight a day', () => {
    const cal = getCalendarMap(model([['E10', 'Empty ten', '10', '50', '']])).E10;
    expect(durationHoursToDays(40, cal)).toBe(5);
  });

  it('works Monday to Friday', () => {
    const cal = getCalendarMap(model([['E10', 'Empty ten', '10', '50', '']])).E10;
    // Friday 4 Sep to Monday 14 Sep 2026: the Standard has no holidays.
    expect(getWorkDaysBetween('2026-09-04', '2026-09-14', cal))
      .toBe(getWorkDaysBetween('2026-09-04', '2026-09-14', { work_days: [1, 2, 3, 4, 5], holidays: [] }));
  });
});

describe('calendarShiftHours', () => {
  it('[discriminating] lists the calendars converted on their shifts, not an empty record', () => {
    const cmap = getCalendarMap(model([
      ['E10', 'Empty ten', '10', '50', ''],
      ['S10', 'Ten declared eight', '8', '40', monFri(TEN)],
      ['S8', 'Eight', '8', '40', monFri(EIGHT_SPLIT)],
    ]));
    expect(calendarShiftHours(cmap)).toEqual([
      { clndr_id: 'S10', clndr_name: 'Ten declared eight', hours_per_day: 10, declared_hours_per_day: 8 },
    ]);
  });

  it('[discriminating] is exported from the package', () => {
    expect(typeof pkg.calendarShiftHours).toBe('function');
  });
});
