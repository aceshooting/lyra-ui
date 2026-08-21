import { expect, fixture, html } from '@open-wc/testing';
import {
  dayPeriodLabels,
  hasTimeStepMismatch,
  isTimeInRange,
  localeTimePattern,
  normalizeTimeValue,
  parseTimeValue,
  timeValueFromMilliseconds,
  timeStepBaseMilliseconds,
  to24Hour,
  wrapTimeMilliseconds,
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

  it('treats a nullish value as the empty string', () => {
    expect(normalizeTimeValue(null)).to.equal('');
    expect(normalizeTimeValue(undefined)).to.equal('');
  });

  it('extracts a Date using local clock fields without elapsed-time or timezone arithmetic', () => {
    const date = new Date(2026, 6, 15, 23, 4, 5, 6);
    expect(normalizeTimeValue(date)).to.equal('23:04:05.006');
    const parsed = parseTimeValue('23:04:05.006');
    expect(parsed).to.deep.include({ hour: 23, minute: 4, second: 5, millisecond: 6 });
    expect(parsed?.milliseconds).to.equal(83_045_006);
  });

  it('accepts a branded Date from another realm and rejects a structural lookalike', async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const foreignDate = new frame.contentWindow!.Date(2026, 6, 15, 23, 4, 5, 6);
    const forgedDate = {
      getTime: () => foreignDate.getTime(),
      getHours: () => 23,
      getMinutes: () => 4,
      getSeconds: () => 5,
      getMilliseconds: () => 6,
      [Symbol.toStringTag]: 'Date',
    } as unknown as Date;

    expect(foreignDate instanceof Date).to.equal(false);
    expect(normalizeTimeValue(foreignDate)).to.equal('23:04:05.006');
    expect(normalizeTimeValue(forgedDate)).to.equal('');
  });

  it('treats an invalid Date as empty rather than propagating NaN clock fields', () => {
    expect(normalizeTimeValue(new Date(Number.NaN))).to.equal('');
  });

  it('formats a whole-minute Date (zero seconds, zero milliseconds) down to minute precision', () => {
    expect(normalizeTimeValue(new Date(2026, 0, 1, 10, 20, 0, 0))).to.equal('10:20');
  });

  it('formats a whole-second Date (nonzero seconds, zero milliseconds) down to second precision', () => {
    expect(normalizeTimeValue(new Date(2026, 0, 1, 10, 20, 30, 0))).to.equal('10:20:30');
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

  it('rejects an ordinary (non-reversed) value strictly after max', () => {
    expect(isTimeInRange('18:00', '09:00', '17:00')).to.equal(false);
  });

  it('treats an empty min or max bound as unconstrained on that side', () => {
    expect(isTimeInRange('12:00', '', '17:00')).to.equal(true);
    expect(isTimeInRange('12:00', '09:00', '')).to.equal(true);
    expect(isTimeInRange('12:00', '', '')).to.equal(true);
  });

  it('treats a malformed value string as out of range', () => {
    expect(isTimeInRange('not-a-time', '09:00', '17:00')).to.equal(false);
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

  it('uses valid min, then the default value, then midnight as the native step base', () => {
    expect(timeStepBaseMilliseconds('00:00:15', '00:00:30')).to.equal(15_000);
    expect(timeStepBaseMilliseconds('', '00:00:30')).to.equal(30_000);
    expect(timeStepBaseMilliseconds('invalid', 'also-invalid')).to.equal(0);
    expect(hasTimeStepMismatch('00:01:30', 60, '', '00:00:30')).to.equal(false);
    expect(hasTimeStepMismatch('00:01:30', 60, '00:00:15', '00:00:30')).to.equal(true);
    expect(hasTimeStepMismatch('00:01:00', 60, 'invalid', 'also-invalid')).to.equal(false);
  });

  it('treats a malformed value string as matching any step', () => {
    expect(hasTimeStepMismatch('not-a-time', 300, '')).to.equal(false);
  });

  it('defaults to a 60-second step grid when the step is non-positive or non-finite', () => {
    // stepBase 0, value 5s past midnight: on neither a 0/negative/NaN step (all fall back to
    // 60s) nor an exact 60s multiple, so every one of these is a mismatch...
    expect(hasTimeStepMismatch('00:00:05', 0, '')).to.equal(true);
    expect(hasTimeStepMismatch('00:00:05', -30, '')).to.equal(true);
    expect(hasTimeStepMismatch('00:00:05', Number.NaN, '')).to.equal(true);
    // ...while an exact 60s multiple lands on the fallback grid with no mismatch.
    expect(hasTimeStepMismatch('00:01:00', 0, '')).to.equal(false);
  });
});

describe('time-input millisecond wrap helper', () => {
  it('preserves nonzero whole seconds without adding fractional precision', () => {
    expect(timeValueFromMilliseconds(3_723_000)).to.equal('01:02:03');
  });

  it('wraps values at, within, and beyond a 24-hour day in both directions', () => {
    expect(wrapTimeMilliseconds(0)).to.equal(0);
    expect(wrapTimeMilliseconds(3_600_000)).to.equal(3_600_000);
    expect(wrapTimeMilliseconds(86_400_000)).to.equal(0);
    expect(wrapTimeMilliseconds(-1)).to.equal(86_399_999);
    expect(wrapTimeMilliseconds(90_000_000)).to.equal(3_600_000);
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

  it('auto-detects the hour cycle from the locale itself when hourFormat is "auto"', () => {
    const auto12 = localeTimePattern('en-US', 'auto', false);
    expect(auto12.some((part) => part.type === 'dayPeriod')).to.equal(true);

    const auto24 = localeTimePattern('en-GB', 'auto', false);
    expect(auto24.some((part) => part.type === 'dayPeriod')).to.equal(false);
  });

  it('derives distinct localized day-period labels', () => {
    const labels = dayPeriodLabels('en-US');
    expect(labels.am.length).to.be.greaterThan(0);
    expect(labels.pm.length).to.be.greaterThan(0);
    expect(labels.am).not.to.equal(labels.pm);
  });
});

describe('time-input locale helpers under a failing Intl.DateTimeFormat', () => {
  // These exercise the defensive try/catch guards that keep a hostile or unusual Intl
  // implementation from throwing out of a render path. Each stub is scoped to a single `it`
  // and restored in a `finally` so it can never leak into another test.

  it('falls back to a non-12-hour cycle when resolving hour12 itself throws', () => {
    const original = Intl.DateTimeFormat.prototype.resolvedOptions;
    Intl.DateTimeFormat.prototype.resolvedOptions = function () {
      throw new RangeError('forced failure for coverage');
    };
    try {
      const pattern = localeTimePattern('en-US', 'auto', false);
      expect(pattern.some((part) => part.type === 'dayPeriod')).to.equal(false);
      expect(pattern.find((part) => part.type === 'hour')?.value).to.equal('13');
    } finally {
      Intl.DateTimeFormat.prototype.resolvedOptions = original;
    }
  });

  it('defaults hour12 detection to false when resolvedOptions reports no hour12 at all', () => {
    // ECMA-402 marks `hour12` optional on ResolvedDateTimeFormatOptions -- some hourCycle-only
    // reporting paths omit it. The `?? false` in localeHour12 is the guard for that case.
    const original = Intl.DateTimeFormat.prototype.resolvedOptions;
    Intl.DateTimeFormat.prototype.resolvedOptions = function (...args: Parameters<typeof original>) {
      const { hour12: _omitted, ...rest } = original.apply(this, args);
      return rest as Intl.ResolvedDateTimeFormatOptions;
    };
    try {
      const pattern = localeTimePattern('en-US', 'auto', false);
      expect(pattern.some((part) => part.type === 'dayPeriod')).to.equal(false);
    } finally {
      Intl.DateTimeFormat.prototype.resolvedOptions = original;
    }
  });

  it('falls back to the hardcoded pattern when formatToParts throws while deriving segment order', () => {
    const original = Intl.DateTimeFormat.prototype.formatToParts;
    Intl.DateTimeFormat.prototype.formatToParts = function () {
      throw new RangeError('forced failure for coverage');
    };
    try {
      expect(localeTimePattern('en-US', '12', true)).to.deep.equal([
        { type: 'hour', value: '1' },
        { type: 'literal', value: ':' },
        { type: 'minute', value: '05' },
        { type: 'literal', value: ':' },
        { type: 'second', value: '09' },
        { type: 'literal', value: ' ' },
        { type: 'dayPeriod', value: 'PM' },
      ]);
      expect(localeTimePattern('en-GB', '24', false)).to.deep.equal([
        { type: 'hour', value: '13' },
        { type: 'literal', value: ':' },
        { type: 'minute', value: '05' },
      ]);
    } finally {
      Intl.DateTimeFormat.prototype.formatToParts = original;
    }
  });

  it('falls back to hardcoded AM/PM literals when formatToParts throws while deriving day-period labels', () => {
    const original = Intl.DateTimeFormat.prototype.formatToParts;
    Intl.DateTimeFormat.prototype.formatToParts = function () {
      throw new RangeError('forced failure for coverage');
    };
    try {
      expect(dayPeriodLabels('en-US')).to.deep.equal({ am: 'AM', pm: 'PM' });
    } finally {
      Intl.DateTimeFormat.prototype.formatToParts = original;
    }
  });

  it('drops a formatToParts entry outside the recognized hour/minute/second/dayPeriod/literal set', () => {
    // No real locale is known to emit this, but formatToParts's own type is a broad, open-ended
    // union (it even reserves an explicit "unknown" member) -- this locks in that localeTimePattern
    // silently discards anything it does not recognize instead of mis-rendering it as a segment.
    const original = Intl.DateTimeFormat.prototype.formatToParts;
    Intl.DateTimeFormat.prototype.formatToParts = function (...args: Parameters<typeof original>) {
      return [...original.apply(this, args), { type: 'unknown', value: '?' }];
    };
    try {
      const pattern = localeTimePattern('en-GB', '24', false);
      expect(pattern.some((part) => (part as { type: string }).type === 'unknown')).to.equal(false);
      expect(pattern.filter((part) => part.type !== 'literal').map((part) => part.type)).to.deep.equal([
        'hour',
        'minute',
      ]);
    } finally {
      Intl.DateTimeFormat.prototype.formatToParts = original;
    }
  });
});
