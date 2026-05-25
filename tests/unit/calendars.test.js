import { describe, it, expect } from 'vitest';
import { parseCalendarData } from '../../src/derived/calendars.js';

// ─── Representative clndr_data strings ────────────────────────────────────────

// Standard Mon-Fri 8hr work week (P6 24.12 format):
//   Day 1 = Sunday → empty body (non-work)
//   Day 2-6 = Mon-Fri → (s|08:00|f|16:00) time slot (work)
//   Day 7 = Saturday → empty body (non-work)
const MON_FRI_CLNDR =
  '(0||CalendarData()(0||DaysOfWeek()((0||1()())(0||2()((0||0(s|08:00|f|16:00)())))(0||3()((0||0(s|08:00|f|16:00)())))(0||4()((0||0(s|08:00|f|16:00)())))(0||5()((0||0(s|08:00|f|16:00)())))(0||6()((0||0(s|08:00|f|16:00)())))(0||7()())))(0||Exceptions()()))';

// Work-week block reused in exception tests
const DOW_BLOCK =
  '(0||DaysOfWeek()((0||1()())(0||2()((0||0(s|08:00|f|16:00)())))(0||3()((0||0(s|08:00|f|16:00)())))(0||4()((0||0(s|08:00|f|16:00)())))(0||5()((0||0(s|08:00|f|16:00)())))(0||6()((0||0(s|08:00|f|16:00)())))(0||7()())))';

// Single time-slot string for building a 7-day calendar
const SLOT = '(0||0(s|08:00|f|16:00)())';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('parseCalendarData', () => {
  // ── empty / null input ────────────────────────────────────────────────────

  it('returns empty shape for empty string input', () => {
    const r = parseCalendarData('');
    expect(r.work_days).toEqual([]);
    expect(r.holidays).toEqual([]);
    expect(r.special_workdays).toEqual([]);
    expect(r.exceptions).toEqual([]);
    expect(r.hours_per_day).toBeNull();
    expect(r.raw).toBe('');
  });

  it('returns empty shape for null input', () => {
    const r = parseCalendarData(null);
    expect(r.work_days).toEqual([]);
    expect(r.holidays).toEqual([]);
    expect(r.special_workdays).toEqual([]);
    expect(r.hours_per_day).toBeNull();
    expect(r.raw).toBe('');
  });

  it('returns empty shape for whitespace-only input', () => {
    const r = parseCalendarData('   ');
    expect(r.work_days).toEqual([]);
  });

  // ── work days (DaysOfWeek block) ──────────────────────────────────────────

  it('parses a Mon-Fri 8hr work week (P6 day numbering: 1=Sun..7=Sat)', () => {
    const r = parseCalendarData(MON_FRI_CLNDR);
    // P6 days 2-6 (Mon-Fri) → JS indices 1-5
    expect(r.work_days).toEqual([1, 2, 3, 4, 5]);
    expect(r.work_day_names).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  });

  it('parses a 7-day work week (all days have time slots)', () => {
    const days = [1, 2, 3, 4, 5, 6, 7].map(d => `(0||${d}()(${SLOT}))`).join('');
    const clndr = `(0||CalendarData()(0||DaysOfWeek()(${days})))`;
    const r = parseCalendarData(clndr);
    expect(r.work_days).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(r.work_day_names).toEqual([
      'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ]);
  });

  it('recognises a Sunday-only work week', () => {
    const days =
      `(0||1()(${SLOT}))` +
      '(0||2()())(0||3()())(0||4()())(0||5()())(0||6()())(0||7()())';
    const clndr = `(0||CalendarData()(0||DaysOfWeek()(${days})))`;
    const r = parseCalendarData(clndr);
    expect(r.work_days).toEqual([0]);
    expect(r.work_day_names).toEqual(['Sunday']);
  });

  it('recognises a Sat-Sun weekend work week', () => {
    const days =
      `(0||1()(${SLOT}))` +
      '(0||2()())(0||3()())(0||4()())(0||5()())(0||6()())' +
      `(0||7()(${SLOT}))`;
    const clndr = `(0||CalendarData()(0||DaysOfWeek()(${days})))`;
    const r = parseCalendarData(clndr);
    expect(r.work_days).toEqual([0, 6]);
  });

  it('accepts 1-digit hour in time slots (e.g. s|8:00)', () => {
    const shortSlot = '(0||0(s|8:00|f|16:00)())';
    const days = [1, 2, 3, 4, 5, 6, 7].map((d, i) =>
      i > 0 && i < 6 ? `(0||${d}()(${shortSlot}))` : `(0||${d}()())`
    ).join('');
    const clndr = `(0||CalendarData()(0||DaysOfWeek()(${days})))`;
    const r = parseCalendarData(clndr);
    expect(r.work_days).toEqual([1, 2, 3, 4, 5]);
  });

  // ── holidays (Exceptions block, no time slot) ─────────────────────────────

  it('extracts holiday dates from Exceptions block (YYYY-MM-DD serials)', () => {
    const exceptions = '(0||Exceptions()((0||0(d|2024-12-25)())(0||0(d|2024-12-26)())))';
    const clndr = `(0||CalendarData()${DOW_BLOCK}${exceptions})`;
    const r = parseCalendarData(clndr);
    expect(r.holidays).toContain('2024-12-25');
    expect(r.holidays).toContain('2024-12-26');
    expect(r.special_workdays).toEqual([]);
  });

  it('extracts a single holiday', () => {
    const exceptions = '(0||Exceptions()((0||0(d|2024-01-01)())))';
    const clndr = `(0||CalendarData()${DOW_BLOCK}${exceptions})`;
    const r = parseCalendarData(clndr);
    expect(r.holidays).toContain('2024-01-01');
  });

  it('holidays list is sorted ascending', () => {
    const exceptions = '(0||Exceptions()((0||0(d|2024-12-26)())(0||0(d|2024-12-25)())))';
    const clndr = `(0||CalendarData()${DOW_BLOCK}${exceptions})`;
    const r = parseCalendarData(clndr);
    expect(r.holidays).toEqual(['2024-12-25', '2024-12-26']);
  });

  it('deduplicates holidays that appear more than once', () => {
    const exceptions =
      '(0||Exceptions()((0||0(d|2024-12-25)())(0||0(d|2024-12-25)())))';
    const clndr = `(0||CalendarData()${DOW_BLOCK}${exceptions})`;
    const r = parseCalendarData(clndr);
    expect(r.holidays.filter(d => d === '2024-12-25').length).toBe(1);
  });

  // ── special workdays (Exceptions block, has time slot) ────────────────────

  it('extracts special workdays (exception with time slot = working day)', () => {
    const exceptions =
      '(0||Exceptions()((0||0(d|2024-12-21)((0||0(s|08:00|f|16:00)())))))';
    const clndr = `(0||CalendarData()${DOW_BLOCK}${exceptions})`;
    const r = parseCalendarData(clndr);
    expect(r.special_workdays).toContain('2024-12-21');
    expect(r.holidays).not.toContain('2024-12-21');
  });

  it('distinguishes holiday vs special workday in the same Exceptions block', () => {
    const exceptions =
      '(0||Exceptions()((0||0(d|2024-12-25)())(0||0(d|2024-12-21)((0||0(s|08:00|f|16:00)())))))';
    const clndr = `(0||CalendarData()${DOW_BLOCK}${exceptions})`;
    const r = parseCalendarData(clndr);
    expect(r.holidays).toContain('2024-12-25');
    expect(r.holidays).not.toContain('2024-12-21');
    expect(r.special_workdays).toContain('2024-12-21');
    expect(r.special_workdays).not.toContain('2024-12-25');
  });

  // ── raw field ─────────────────────────────────────────────────────────────

  it('preserves the raw input exactly', () => {
    expect(parseCalendarData(MON_FRI_CLNDR).raw).toBe(MON_FRI_CLNDR);
  });

  it('preserves raw even for minimal input', () => {
    const s = '(0||CalendarData())';
    expect(parseCalendarData(s).raw).toBe(s);
  });

  // ── output shape ──────────────────────────────────────────────────────────

  it('always returns all required keys even when parsing returns nothing', () => {
    const r = parseCalendarData('(0||CalendarData())');
    expect(r).toHaveProperty('work_days');
    expect(r).toHaveProperty('work_day_names');
    expect(r).toHaveProperty('holidays');
    expect(r).toHaveProperty('special_workdays');
    expect(r).toHaveProperty('exceptions');
    expect(r).toHaveProperty('hours_per_day');
    expect(r).toHaveProperty('raw');
  });

  it('hours_per_day is null (set by getCalendarMap, not parseCalendarData)', () => {
    const r = parseCalendarData(MON_FRI_CLNDR);
    expect(r.hours_per_day).toBeNull();
  });

  // ── fallback: legacy bare (d|N) patterns ─────────────────────────────────

  it('falls back to legacy (d|N) pattern when no DaysOfWeek block present', () => {
    // Older P6 format with bare work-day markers
    const clndr = '(CalendarData(d|2)(d|3)(d|4)(d|5)(d|6))';
    const r = parseCalendarData(clndr);
    // (d|2) = P6 day 2 = Mon = idx 1, etc.
    expect(r.work_days).toEqual([1, 2, 3, 4, 5]);
    expect(r.work_day_names).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  });

  // ── fallback: very-legacy d|N(s| inline ──────────────────────────────────

  it('falls back to very-legacy d|N(s| inline pattern', () => {
    // Oldest P6 format
    const clndr = 'CalendarData d|2(s|08:00|f|16:00) d|3(s|08:00|f|16:00)';
    const r = parseCalendarData(clndr);
    expect(r.work_days).toEqual([1, 2]);
  });
});
