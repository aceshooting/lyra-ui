import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { buildCalendarGrid, quartileBucket } from './calendar-grid.js';

const day = fc
  .record({ offset: fc.integer({ min: 0, max: 900 }), value: fc.integer({ min: -50, max: 50 }) })
  .map(({ offset, value }) => ({
    date: new Date(Date.UTC(2023, 0, 1 + offset)).toISOString().slice(0, 10),
    value,
  }));
const days = fc.array(day, { maxLength: 60 });
const firstDay = fc.integer({ min: 0, max: 6 });

describe('calendar grid properties', () => {
  it('places every distinct date exactly once, in range, on the weekday the date has', () => {
    fc.assert(fc.property(days, firstDay, (input, first) => {
      const grid = buildCalendarGrid(input, first, undefined, 'en');
      const distinct = new Set(input.map((entry) => entry.date));
      expect(grid.cells.length, 'one cell per distinct date').to.equal(distinct.size);
      for (const cell of grid.cells) {
        expect(cell.weekday >= 0 && cell.weekday <= 6, 'weekday range').to.equal(true);
        expect(cell.week >= 0 && cell.week < grid.weekCount, 'week range').to.equal(true);
        const utcDay = new Date(`${cell.date}T00:00:00Z`).getUTCDay();
        expect(cell.weekday, 'weekday relative to the anchor').to.equal((utcDay - first + 7) % 7);
        const offset = (Date.parse(`${cell.date}T00:00:00Z`) - grid.firstWeekStart.getTime()) / 86_400_000;
        expect(cell.week * 7 + cell.weekday, 'position equals day offset').to.equal(offset);
      }
    }), propertyRuns());
  });

  it('keeps the first value for a repeated date and ignores input order', () => {
    fc.assert(fc.property(days, firstDay, (input, first) => {
      const forward = buildCalendarGrid(input, first, undefined, 'en');
      const firstValue = new Map<string, number>();
      for (const entry of input) if (!firstValue.has(entry.date)) firstValue.set(entry.date, entry.value);
      for (const cell of forward.cells) expect(cell.value, 'first occurrence owns the value').to.equal(firstValue.get(cell.date));
      const shuffled = buildCalendarGrid([...new Map(input.map((entry) => [entry.date, entry])).values()].reverse(), first, undefined, 'en');
      expect(shuffled.weekCount, 'week count independent of order').to.equal(forward.weekCount);
    }), propertyRuns());
  });

  it('labels each distinct month once, on a week that holds a cell of that month', () => {
    fc.assert(fc.property(days, firstDay, (input, first) => {
      const grid = buildCalendarGrid(input, first, (month, year) => `${year}-${month}`, 'en');
      const months = new Set(input.map((entry) => entry.date.slice(0, 7)));
      expect(grid.monthLabels.length, 'one label per month').to.equal(months.size);
      expect(new Set(grid.monthLabels.map((label) => label.label)).size, 'labels are distinct').to.equal(months.size);
    }), propertyRuns());
  });

  it('truncates deterministically when the cap is lower than the input', () => {
    fc.assert(fc.property(days, fc.integer({ min: 1, max: 20 }), (input, cap) => {
      const grid = buildCalendarGrid(input, 0, undefined, 'en', cap);
      expect(grid.cells.length <= cap, 'never more cells than the cap').to.equal(true);
      if (input.length > cap) expect(grid.truncated, 'flags truncation').to.equal(true);
    }), propertyRuns());
  });

  it('returns a rank bucket inside the bucket range and monotonic in the value', () => {
    fc.assert(fc.property(
      fc.array(fc.integer({ min: -100, max: 100 }), { maxLength: 50 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: -120, max: 120 }),
      fc.integer({ min: -120, max: 120 }),
      (values, buckets, a, b) => {
        const sorted = [...values].sort((x, y) => x - y);
        const low = quartileBucket(Math.min(a, b), sorted, buckets);
        const high = quartileBucket(Math.max(a, b), sorted, buckets);
        expect(low >= 0 && high < buckets, 'in range').to.equal(true);
        expect(low <= high, 'monotonic').to.equal(true);
      }), propertyRuns());
  });
});
