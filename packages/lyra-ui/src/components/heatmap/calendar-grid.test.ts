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
});
