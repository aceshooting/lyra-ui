import { expect } from '@open-wc/testing';
import { buildCalendarGrid, parseIsoDate, quartileBucket } from './calendar-grid.js';

describe('parseIsoDate', () => {
  it('parses yyyy-mm-dd as UTC midnight', () => {
    const d = parseIsoDate('2026-03-05');
    expect(d.getUTCFullYear()).to.equal(2026);
    expect(d.getUTCMonth()).to.equal(2);
    expect(d.getUTCDate()).to.equal(5);
  });
});

describe('buildCalendarGrid', () => {
  it('places a single day at week 0, with weekday matching its day-of-week', () => {
    // 2026-03-05 is a Thursday.
    const { cells, weekCount } = buildCalendarGrid([{ date: '2026-03-05', value: 1 }]);
    expect(cells).to.have.length(1);
    expect(cells[0].week).to.equal(0);
    expect(cells[0].weekday).to.equal(4); // Sun=0 .. Thu=4
    expect(weekCount).to.equal(1);
  });

  it('advances week by exactly 1 for a date 7 days later, keeping the same weekday', () => {
    const { cells } = buildCalendarGrid([
      { date: '2026-03-05', value: 1 },
      { date: '2026-03-12', value: 2 },
    ]);
    expect(cells[0].week).to.equal(0);
    expect(cells[1].week).to.equal(1);
    expect(cells[1].weekday).to.equal(cells[0].weekday);
  });

  it('emits a month label at the Sunday nearest each month transition', () => {
    const days = [];
    for (let d = 25; d <= 28; d++) days.push({ date: `2026-02-${d}`, value: 1 });
    for (let d = 1; d <= 7; d++) days.push({ date: `2026-03-0${d}`, value: 1 });
    const { monthLabels } = buildCalendarGrid(days);
    expect(monthLabels.map((m) => m.label)).to.include('Mar');
  });

  it('returns an empty grid for zero days', () => {
    const result = buildCalendarGrid([]);
    expect(result.cells).to.deep.equal([]);
    expect(result.weekCount).to.equal(0);
    expect(result.monthLabels).to.deep.equal([]);
  });

  it('drops an entry with a malformed date instead of letting it poison every other cell', () => {
    const { cells, weekCount } = buildCalendarGrid([
      { date: '2026-03', value: 5 }, // malformed: missing day -> parseIsoDate gives an Invalid Date
      { date: '2026-03-05', value: 9 },
    ]);
    expect(cells).to.have.length(1);
    expect(cells[0].date).to.equal('2026-03-05');
    expect(cells[0].value).to.equal(9);
    expect(weekCount).to.equal(1);
    expect(Number.isNaN(weekCount)).to.equal(false);
  });

  it('returns an empty grid when every entry has a malformed date', () => {
    const result = buildCalendarGrid([
      { date: '', value: 1 },
      { date: '2026/03/05', value: 2 },
    ]);
    expect(result.cells).to.deep.equal([]);
    expect(result.weekCount).to.equal(0);
    expect(result.monthLabels).to.deep.equal([]);
  });

  it('does not throw a RangeError building a very large grid (spreading into Math.min/Math.max would blow the call stack)', () => {
    const days = Array.from({ length: 150_000 }, (_, i) => {
      const d = new Date(Date.UTC(2000, 0, 1) + i * 86_400_000);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return { date: `${y}-${m}-${day}`, value: i };
    });
    const { cells, weekCount } = buildCalendarGrid(days);
    expect(cells).to.have.length(150_000);
    expect(weekCount).to.be.greaterThan(0);
  });

  it('drops a calendar-invalid date (rolled-over day) instead of silently normalizing it', () => {
    const { cells } = buildCalendarGrid([{ date: '2026-02-30', value: 1 }]);
    expect(cells.length).to.equal(0);
  });

  it('labels every month that has data, even in a sparse calendar with no Sunday entries', () => {
    const { monthLabels } = buildCalendarGrid([
      { date: '2026-01-15', value: 1 },
      { date: '2026-02-10', value: 1 },
    ]);
    expect(monthLabels.length).to.equal(2);
  });

  it('defaults firstDayOfWeek to 0 (Sunday), anchoring the grid the same way as before', () => {
    // 2026-03-05 is a Thursday.
    const { cells } = buildCalendarGrid([{ date: '2026-03-05', value: 1 }]);
    expect(cells[0].weekday).to.equal(4); // Sun=0 .. Thu=4
  });

  it('anchors the grid at the given firstDayOfWeek instead of Sunday, shifting week/weekday assignment across a week boundary', () => {
    // 2026-03-01 is a Sunday, 2026-03-02 is a Monday: both fall in the same
    // Sunday-anchored week (week 0), but a Monday-anchored (firstDayOfWeek=1)
    // grid must treat 2026-03-01 (Sunday) as the *last* day of the previous
    // week, not the first day of the new one.
    const days = [
      { date: '2026-03-01', value: 1 }, // Sunday
      { date: '2026-03-02', value: 2 }, // Monday
    ];

    const sundayAnchored = buildCalendarGrid(days, 0);
    expect(sundayAnchored.cells[0].week).to.equal(0);
    expect(sundayAnchored.cells[0].weekday).to.equal(0); // Sunday is weekday 0
    expect(sundayAnchored.cells[1].week).to.equal(0);
    expect(sundayAnchored.cells[1].weekday).to.equal(1); // Monday is weekday 1

    const mondayAnchored = buildCalendarGrid(days, 1);
    // Monday (2026-03-02) is the anchor weekday, so it starts a fresh week
    // (week 1), while Sunday (2026-03-01) is weekday 6 of the *previous* week.
    expect(mondayAnchored.cells[0].week).to.equal(0);
    expect(mondayAnchored.cells[0].weekday).to.equal(6); // Sunday is 6 days after the Monday anchor
    expect(mondayAnchored.cells[1].week).to.equal(1);
    expect(mondayAnchored.cells[1].weekday).to.equal(0); // Monday is the anchor weekday
  });

  it('formats month labels using the runtime locale, not a hardcoded "en"', () => {
    const { monthLabels } = buildCalendarGrid([{ date: '2026-03-05', value: 1 }]);
    const expected = new Date(Date.UTC(2026, 2, 5)).toLocaleString(undefined, {
      month: 'short',
      timeZone: 'UTC',
    });
    expect(monthLabels[0].label).to.equal(expected);
  });

  it('calls monthLabelText with the real JS month index (0-based) and year, using its return value instead of the locale-derived label', () => {
    const seen: Array<[number, number]> = [];
    const { monthLabels } = buildCalendarGrid([{ date: '2026-03-05', value: 1 }], 0, (jsMonth, year) => {
      seen.push([jsMonth, year]);
      return `M${jsMonth}-${year}`;
    });
    expect(seen).to.deep.equal([[2, 2026]]);
    expect(monthLabels[0].label).to.equal('M2-2026');
  });

  it('falls back to the locale-derived label when monthLabelText returns undefined', () => {
    const { monthLabels } = buildCalendarGrid([{ date: '2026-03-05', value: 1 }], 0, () => undefined);
    const expected = new Date(Date.UTC(2026, 2, 5)).toLocaleString(undefined, {
      month: 'short',
      timeZone: 'UTC',
    });
    expect(monthLabels[0].label).to.equal(expected);
  });
});

describe('quartileBucket', () => {
  it('buckets the minimum value into bucket 0 and the maximum into the last bucket', () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(quartileBucket(1, sorted, 4)).to.equal(0);
    expect(quartileBucket(10, sorted, 4)).to.equal(3);
  });

  it('returns 0 for an empty sorted array', () => {
    expect(quartileBucket(5, [], 4)).to.equal(0);
  });

  it('counts duplicate values correctly when computing rank (binary search upper-bound)', () => {
    const sorted = [1, 1, 1, 5, 5, 9];
    // count(v <= 5) = 5, rank = 5/6, floor((5/6)*3) = 2.
    expect(quartileBucket(5, sorted, 3)).to.equal(2);
  });

  it('handles a value that falls between two entries of the sorted array', () => {
    const sorted = [1, 3, 5, 7, 9];
    // count(v <= 4) = 2 (1 and 3), rank = 2/5, floor((2/5)*5) = 2.
    expect(quartileBucket(4, sorted, 5)).to.equal(2);
  });
});
