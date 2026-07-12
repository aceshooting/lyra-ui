import { expect } from '@open-wc/testing';
import { groupByRecency } from './group-by-recency.js';

// A fixed "now" (local time, noon on a Monday) so every test is deterministic
// regardless of when/where the suite actually runs.
const NOW = new Date(2024, 0, 15, 12, 0, 0); // Mon 2024-01-15 12:00 local

function at(daysAgo: number, hour = 9): Date {
  return new Date(2024, 0, 15 - daysAgo, hour, 0, 0);
}

it('buckets Today/Yesterday/Previous 7 Days/Older using calendar-day boundaries', () => {
  const items = [at(0), at(1), at(2), at(7), at(8), at(30)];
  const result = groupByRecency(items, { now: NOW });

  expect(result.map((b) => b.label)).to.deep.equal(['Today', 'Yesterday', 'Previous 7 Days', 'Older']);
  expect(result[0].items).to.deep.equal([at(0)]);
  expect(result[1].items).to.deep.equal([at(1)]);
  expect(result[2].items).to.deep.equal([at(2), at(7)]);
  expect(result[3].items).to.deep.equal([at(8), at(30)]);
});

it('treats "yesterday" as the previous calendar date, not a rolling 24-hour window', () => {
  // 11pm yesterday is only ~13 hours before `now` (noon today), but it's a
  // different calendar day, so it must land in Yesterday, not Today.
  const lateYesterday = new Date(2024, 0, 14, 23, 0, 0);
  const result = groupByRecency([lateYesterday], { now: NOW });
  expect(result).to.have.length(1);
  expect(result[0].label).to.equal('Yesterday');
});

it('treats an early-morning "today" item as Today even though it is >12h before `now`', () => {
  const earlyToday = new Date(2024, 0, 15, 0, 30, 0);
  const result = groupByRecency([earlyToday], { now: NOW });
  expect(result[0].label).to.equal('Today');
});

it('omits buckets that end up with no items', () => {
  const result = groupByRecency([at(0), at(0)], { now: NOW });
  expect(result).to.have.length(1);
  expect(result[0].label).to.equal('Today');
});

it('returns an empty array for an empty input', () => {
  expect(groupByRecency([], { now: NOW })).to.deep.equal([]);
});

it('preserves each bucket\'s original relative order (no re-sorting)', () => {
  const c = at(2, 8);
  const a = at(2, 20);
  const b = at(2, 12);
  const result = groupByRecency([c, a, b], { now: NOW });
  expect(result).to.have.length(1);
  expect(result[0].items).to.deep.equal([c, a, b]);
});

it('defaults getTimestamp to assuming the item itself is a Date', () => {
  const result = groupByRecency([at(0)], { now: NOW });
  expect(result[0].label).to.equal('Today');
});

it('uses a custom getTimestamp, accepting a Date/number/string return', () => {
  interface Item {
    id: string;
    ts: Date | number | string;
  }
  const items: Item[] = [
    { id: 'a', ts: at(0) },
    { id: 'b', ts: at(1).getTime() },
    { id: 'c', ts: at(2).toISOString() },
  ];
  const result = groupByRecency(items, { now: NOW, getTimestamp: (item) => item.ts });
  expect(result.map((b) => b.label)).to.deep.equal(['Today', 'Yesterday', 'Previous 7 Days']);
  expect(result[0].items[0].id).to.equal('a');
  expect(result[1].items[0].id).to.equal('b');
  expect(result[2].items[0].id).to.equal('c');
});

it('overrides one or more labels while leaving the rest at their English default', () => {
  const items = [at(0), at(1)];
  const result = groupByRecency(items, { now: NOW, labels: { today: 'Aujourd’hui' } });
  expect(result.map((b) => b.label)).to.deep.equal(['Aujourd’hui', 'Yesterday']);
});

it('buckets a future-dated item (relative to `now`) as Today', () => {
  const future = new Date(2024, 0, 20);
  const result = groupByRecency([future], { now: NOW });
  expect(result).to.have.length(1);
  expect(result[0].label).to.equal('Today');
});

it('buckets an unparseable timestamp as Older rather than throwing or dropping it', () => {
  const result = groupByRecency(['not-a-date'], { now: NOW, getTimestamp: (s) => s });
  expect(result).to.have.length(1);
  expect(result[0].label).to.equal('Older');
  expect(result[0].items).to.deep.equal(['not-a-date']);
});

it('defaults `now` to the real current time when unset', () => {
  const result = groupByRecency([new Date()]);
  expect(result).to.have.length(1);
  expect(result[0].label).to.equal('Today');
});
