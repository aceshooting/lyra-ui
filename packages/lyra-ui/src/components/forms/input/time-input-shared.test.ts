import { expect } from '@open-wc/testing';
import {
  dayPeriodLabels,
  hasTimeStepMismatch,
  isTimeInRange,
  localeTimePattern,
  normalizeTimeValue,
  parseTimeValue,
  to24Hour,
} from './time-input-shared.js';

describe('time-input shared value helpers', () => {
  it('accepts only strict 24-hour wire values and preserves their precision', () => {
    expect(normalizeTimeValue('09:04')).to.equal('09:04');
    expect(normalizeTimeValue('09:04:05')).to.equal('09:04:05');
    expect(normalizeTimeValue('09:04:05.6')).to.equal('09:04:05.600');
    expect(normalizeTimeValue('24:00')).to.equal('');
    expect(normalizeTimeValue('12:60')).to.equal('');
    expect(normalizeTimeValue('9:04')).to.equal('');
  });

  it('extracts a Date using local clock fields without elapsed-time or timezone arithmetic', () => {
    const date = new Date(2026, 6, 15, 23, 4, 5, 6);
    expect(normalizeTimeValue(date)).to.equal('23:04:05.006');
    const parsed = parseTimeValue('23:04:05.006');
    expect(parsed).to.deep.include({ hour: 23, minute: 4, second: 5, millisecond: 6 });
    expect(parsed?.milliseconds).to.equal(83_045_006);
  });

  it('converts 12-hour display values at the noon and midnight boundaries', () => {
    expect(to24Hour(12, 'am')).to.equal(0);
    expect(to24Hour(12, 'pm')).to.equal(12);
    expect(to24Hour(2, 'pm')).to.equal(14);
  });

  it('supports ordinary and reversed overnight min/max ranges', () => {
    expect(isTimeInRange('12:00', '09:00', '17:00')).to.equal(true);
    expect(isTimeInRange('08:00', '09:00', '17:00')).to.equal(false);
    expect(isTimeInRange('23:00', '22:00', '06:00')).to.equal(true);
    expect(isTimeInRange('05:00', '22:00', '06:00')).to.equal(true);
    expect(isTimeInRange('12:00', '22:00', '06:00')).to.equal(false);
  });

  it('checks step grids in pure milliseconds since midnight without DST/date arithmetic', () => {
    expect(hasTimeStepMismatch('00:05', 300, '')).to.equal(false);
    expect(hasTimeStepMismatch('00:06', 300, '')).to.equal(true);
    expect(hasTimeStepMismatch('23:59:30', 30, '')).to.equal(false);
    expect(hasTimeStepMismatch('09:05', 300, '09:00')).to.equal(false);
    expect(hasTimeStepMismatch('09:04', 300, '09:00')).to.equal(true);
    expect(hasTimeStepMismatch('09:04', 'any', '09:00')).to.equal(false);
    expect(hasTimeStepMismatch('02:30', 1800, '')).to.equal(false);
  });
});

describe('time-input locale helpers', () => {
  it('derives 12-hour and 24-hour segment patterns from Intl', () => {
    const twelve = localeTimePattern('en-US', '12', true);
    expect(twelve.filter((part) => part.type !== 'literal').map((part) => part.type)).to.deep.equal([
      'hour',
      'minute',
      'second',
      'dayPeriod',
    ]);

    const twentyFour = localeTimePattern('en-GB', '24', false);
    expect(twentyFour.filter((part) => part.type !== 'literal').map((part) => part.type)).to.deep.equal([
      'hour',
      'minute',
    ]);
  });

  it('derives distinct localized day-period labels', () => {
    const labels = dayPeriodLabels('en-US');
    expect(labels.am.length).to.be.greaterThan(0);
    expect(labels.pm.length).to.be.greaterThan(0);
    expect(labels.am).not.to.equal(labels.pm);
  });
});
