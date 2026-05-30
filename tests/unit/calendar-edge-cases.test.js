import { describe, it, expect } from 'vitest';
import { addWorkDays, subtractWorkDays, getWorkDaysBetween, durationHoursToDays } from '../../src/index.js';

// All-blocking calendar: valid work_days, but holidays cover every weekday for
// years. Without the iteration cap, addWorkDays/subtractWorkDays loop forever.
function allHolidaysCal() {
  const holidays = [];
  const start = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 366 * 5; i++) { // 5 years of holidays, every single day
    const d = new Date(start + i * 86400000);
    holidays.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`);
  }
  return { work_days: [1,2,3,4,5], holidays, hours_per_day: 8 };
}

describe('calendar arithmetic edge cases — must terminate, never hang', () => {
  it('addWorkDays terminates on an all-holiday calendar (iteration cap)', () => {
    const t0 = Date.now();
    const d = addWorkDays('2026-01-01', 10, allHolidaysCal());
    expect(d).toBeInstanceOf(Date);              // returned, did not hang
    expect(Date.now() - t0).toBeLessThan(2000);  // bounded
  });

  it('subtractWorkDays terminates on an all-holiday calendar', () => {
    const t0 = Date.now();
    const d = subtractWorkDays('2026-12-31', 10, allHolidaysCal());
    expect(d).toBeInstanceOf(Date);
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('empty work_days falls back to Mon-Fri (canonical parity), terminates', () => {
    // _resolveCal treats an empty work_days list as "unspecified" and defaults
    // to Mon-Fri — matching the Python parser. 5 work days from Thu 2026-01-01
    // lands Thu 2026-01-08 (Fri, Mon, Tue, Wed, Thu).
    const d = addWorkDays('2026-01-01', 5, { work_days: [], holidays: [] });
    expect(`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`).toBe('2026-01-08');
  });

  it('getWorkDaysBetween bounds an absurd 0001→9999 span (no freeze)', () => {
    const t0 = Date.now();
    const n = getWorkDaysBetween('0001-01-01', '9999-12-31', null);
    expect(typeof n).toBe('number');
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('getWorkDaysBetween: start after end → 0', () => {
    expect(getWorkDaysBetween('2026-06-01', '2026-01-01', null)).toBe(0);
  });

  it('durationHoursToDays never returns Infinity/NaN; matches canonical parity', () => {
    // hours_per_day: 0 is falsy → treated as "missing" → default 8 → 40/8 = 5
    //   (byte-for-byte parity with the Python parser, which also skips falsy 0).
    expect(durationHoursToDays(40, { hours_per_day: 0 })).toBe(5);
    // explicit NEGATIVE is truthy → assigned → caught by the hpd<=0 guard → 0.
    expect(durationHoursToDays(40, { hours_per_day: -8 })).toBe(0);
    // The safety invariant: result is ALWAYS finite, never Infinity/NaN.
    for (const hpd of [0, -8, 8, '', null, undefined, 'abc', NaN]) {
      expect(Number.isFinite(durationHoursToDays(40, { hours_per_day: hpd }))).toBe(true);
    }
  });

  it('normal Mon-Fri arithmetic still correct (no regression)', () => {
    // 5 work days from Mon 2026-01-05 lands the following Mon 2026-01-12.
    const d = addWorkDays('2026-01-05', 5, { work_days: [1,2,3,4,5], holidays: [] });
    expect(`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`).toBe('2026-01-12');
  });
});
