import { expect } from '@open-wc/testing';
import { formatIsoDate, isValidIsoDate, localDate, parseIsoDate, utcDate } from './calendar-date.js';

describe('calendar-date ISO helpers', () => {
  it('parses real days', () => {
    expect(parseIsoDate('2024-02-29')).to.deep.equal({ y: 2024, m: 2, d: 29 });
    expect(parseIsoDate('0001-01-01')).to.deep.equal({ y: 1, m: 1, d: 1 });
    expect(parseIsoDate('2023-12-31')).to.deep.equal({ y: 2023, m: 12, d: 31 });
  });
  it('knows leap years including century rules', () => {
    expect(isValidIsoDate('2000-02-29')).to.equal(true);
    expect(isValidIsoDate('1900-02-29')).to.equal(false);
    expect(isValidIsoDate('2023-02-29')).to.equal(false);
  });
  it('checks month ends', () => {
    expect(isValidIsoDate('2024-04-30')).to.equal(true);
    expect(isValidIsoDate('2024-04-31')).to.equal(false);
    expect(isValidIsoDate('2024-01-31')).to.equal(true);
  });
  it('rejects malformed input', () => {
    for (const bad of ['', '2024-1-1', '2024-13-01', '2024-00-10', '2024-01-00', ' 2024-01-01', '2024-01-01 ', '24-01-01', '2024/01/01', '-001-01-01', '2024-01-01T00:00:00Z']) {
      expect(isValidIsoDate(bad), JSON.stringify(bad)).to.equal(false);
    }
  });
  it('formats with padding and round trips', () => {
    expect(formatIsoDate(5, 3, 9)).to.equal('0005-03-09');
    expect(parseIsoDate(formatIsoDate(2024, 12, 31))).to.deep.equal({ y: 2024, m: 12, d: 31 });
  });
  it('agrees with Date construction', () => {
    const p = parseIsoDate('2024-03-10')!;
    expect(localDate(p.y, p.m - 1, p.d).getDate()).to.equal(10);
    expect(utcDate(p.y, p.m - 1, p.d).getUTCMonth()).to.equal(2);
  });
});
