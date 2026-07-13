import { expect } from '@open-wc/testing';
import {
  monthMatrix,
  formatISO,
  parseISO,
  isSameDay,
  addMonths,
  addMonthsClampingDay,
  clampDate,
  weekdayLabels,
  resolveFirstDayOfWeek,
} from './calendar-core.js';

it('builds a 6x7 month matrix', () => {
  const m = monthMatrix(2026, 6, 1); // July 2026, Monday-first
  expect(m.length).to.equal(6);
  expect(m[0].length).to.equal(7);
  expect(formatISO(new Date(2026, 6, 7))).to.equal('2026-07-07');
});

it('week-aligns to the first day of week', () => {
  const sun = monthMatrix(2026, 6, 0); // Sunday-first
  expect(sun[0][0].getDay()).to.equal(0);
  const mon = monthMatrix(2026, 6, 1); // Monday-first
  expect(mon[0][0].getDay()).to.equal(1);
});

it('round-trips ISO parse/format', () => {
  const d = parseISO('2026-02-28');
  expect(d).to.be.instanceOf(Date);
  expect(formatISO(d!)).to.equal('2026-02-28');
  expect(parseISO('nope')).to.equal(null);
  expect(parseISO('')).to.equal(null);
});

it('rejects calendar-invalid dates instead of letting them roll over to the next month', () => {
  // JS Date silently normalizes Feb 30 -> Mar 2, month 13 -> next January,
  // etc. -- parseISO must catch that instead of returning the rolled-over
  // date, per its own doc comment ("...or null if invalid").
  expect(parseISO('2026-02-30')).to.equal(null);
  expect(parseISO('2026-13-01')).to.equal(null);
  expect(parseISO('2026-04-31')).to.equal(null);
  expect(parseISO('2026-00-10')).to.equal(null);
  expect(parseISO('2026-01-00')).to.equal(null);
  // A genuine leap-day is still valid.
  expect(formatISO(parseISO('2024-02-29')!)).to.equal('2024-02-29');
});

it('compares days and adds months', () => {
  expect(isSameDay(new Date(2026, 6, 7), new Date(2026, 6, 7, 23))).to.be.true;
  expect(isSameDay(new Date(2026, 6, 7), new Date(2026, 6, 8))).to.be.false;
  expect(formatISO(addMonths(new Date(2026, 11, 15), 1))).to.equal('2027-01-01');
});

it('clamps the day-of-month instead of overflowing into the following month', () => {
  // Jan 31 + 1 month must land in February, clamped to Feb's last day (28 in
  // 2026, a non-leap year) -- plain Date-constructor month arithmetic would
  // instead roll this into March.
  const clamped = addMonthsClampingDay(new Date(2026, 0, 31), 1);
  expect(clamped.getFullYear()).to.equal(2026);
  expect(clamped.getMonth()).to.equal(1); // February
  expect(clamped.getDate()).to.equal(28);

  // A genuine leap-day February keeps day 29 reachable.
  const leap = addMonthsClampingDay(new Date(2024, 0, 31), 1);
  expect(leap.getMonth()).to.equal(1);
  expect(leap.getDate()).to.equal(29);

  // Going backwards clamps the same way (e.g. Mar 31 - 1 month -> Feb 28).
  const back = addMonthsClampingDay(new Date(2026, 2, 31), -1);
  expect(back.getMonth()).to.equal(1);
  expect(back.getDate()).to.equal(28);

  // A day that exists in the target month is left untouched.
  const untouched = addMonthsClampingDay(new Date(2026, 6, 15), 1);
  expect(untouched.getMonth()).to.equal(7);
  expect(untouched.getDate()).to.equal(15);
});

it('clamps to min/max', () => {
  const min = new Date(2026, 6, 1);
  const max = new Date(2026, 6, 31);
  expect(formatISO(clampDate(new Date(2026, 5, 1), min, max))).to.equal('2026-07-01');
  expect(formatISO(clampDate(new Date(2026, 7, 1), min, max))).to.equal('2026-07-31');
  expect(formatISO(clampDate(new Date(2026, 6, 15), min, max))).to.equal('2026-07-15');
});

it("resolves 'auto' to a locale-derived first day of week instead of hardcoding Sunday", () => {
  // en-GB and fr-FR are both Monday-first locales.
  expect(resolveFirstDayOfWeek('auto', 'en-GB')).to.equal(1);
  expect(resolveFirstDayOfWeek('auto', 'fr-FR')).to.equal(1);
  // en-US is Sunday-first.
  expect(resolveFirstDayOfWeek('auto', 'en-US')).to.equal(0);
});

it("falls back to Sunday for 'auto' when no locale is given", () => {
  expect(resolveFirstDayOfWeek('auto')).to.equal(0);
});

it('an explicit weekday name still wins over locale-derived auto resolution', () => {
  expect(resolveFirstDayOfWeek('mon', 'en-US')).to.equal(1);
});

it('produces seven weekday labels', () => {
  const labels = weekdayLabels(1, 'short', 'en-US');
  expect(labels.length).to.equal(7);
  expect(labels[0]).to.be.a('string').with.length.greaterThan(0);
});
