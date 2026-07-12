import { expect } from '@open-wc/testing';
import {
  monthMatrix,
  formatISO,
  parseISO,
  isSameDay,
  addMonths,
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

it('compares days and adds months', () => {
  expect(isSameDay(new Date(2026, 6, 7), new Date(2026, 6, 7, 23))).to.be.true;
  expect(isSameDay(new Date(2026, 6, 7), new Date(2026, 6, 8))).to.be.false;
  expect(formatISO(addMonths(new Date(2026, 11, 15), 1))).to.equal('2027-01-01');
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
