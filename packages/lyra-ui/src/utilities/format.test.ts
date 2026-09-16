import { expect } from '@open-wc/testing';
import { formatBytes, formatDate, formatNumber, formatRelativeTime } from './format.js';
import { getNumberFormat } from '../internal/intl-cache.js';
import { getLyraLocale, setLyraLocale } from '../internal/localization.js';

/** Restores the module-global active locale after each case -- shared by the whole file. */
function withActiveLocale(body: () => void): void {
  const previous = getLyraLocale();
  try {
    body();
  } finally {
    setLyraLocale(previous);
  }
}

it('formats plain numbers exactly like a direct Intl.NumberFormat call', () => {
  expect(formatNumber(1234.5, 'en-US')).to.equal('1,234.5');
  expect(formatNumber(0.25, 'en-US', { style: 'percent' })).to.equal('25%');
});

it('formatNumber shares the memoized Intl.NumberFormat instance across identical calls instead of constructing a new one', () => {
  const locale = 'en-US';
  const options = { style: 'decimal', maximumFractionDigits: 4 } as const;
  const OriginalNumberFormat = Intl.NumberFormat;
  let constructions = 0;
  class CountingNumberFormat extends OriginalNumberFormat {
    constructor(...args: ConstructorParameters<typeof Intl.NumberFormat>) {
      super(...args);
      constructions += 1;
    }
  }
  (Intl as unknown as { NumberFormat: typeof Intl.NumberFormat }).NumberFormat =
    CountingNumberFormat as unknown as typeof Intl.NumberFormat;
  try {
    const first = formatNumber(1234.5, locale, options);
    const constructionsAfterFirstCall = constructions;
    expect(constructionsAfterFirstCall, 'the first call must go through the shared cache too').to.be.greaterThan(0);

    const second = formatNumber(1234.5, locale, options);
    expect(
      constructions,
      'a second call with an identical locale/options pair must reuse the cached Intl.NumberFormat instance, not construct a new one',
    ).to.equal(constructionsAfterFirstCall);
    expect(second).to.equal(first);

    // The module's own cache accessor resolves to that same reused instance -- not merely
    // matching output, but the identical object identity check `intl-cache.test.ts` uses.
    expect(getNumberFormat(locale, options) === getNumberFormat(locale, options)).to.be.true;
    expect(constructions).to.equal(constructionsAfterFirstCall);
  } finally {
    Intl.NumberFormat = OriginalNumberFormat;
  }
});

it('formatNumber accepts a bigint or decimal string without first collapsing through a JS number', () => {
  // 2**53 + 1 -- one past Number.MAX_SAFE_INTEGER, not exactly representable as a float64.
  expect(formatNumber(9_007_199_254_740_993n, 'en-US')).to.equal('9,007,199,254,740,993');
  expect(Number(9_007_199_254_740_993n)).to.equal(9_007_199_254_740_992); // the float64 collapse this avoids
  expect(formatNumber('9007199254740993', 'en-US')).to.equal('9,007,199,254,740,993');
  expect(formatNumber('0.12345678901234567890', 'en-US', { maximumFractionDigits: 20 })).to.equal(
    '0.1234567890123456789',
  );
});

it('formats byte counts and picks a unit exactly like <lr-format-bytes>', () => {
  expect(formatBytes(1024, 'en-US')).to.match(/1\s?kB/i);
  expect(formatBytes(0, 'en-US')).to.match(/0\s?byte/i);
});

it('formatBytes accepts a bigint input and scales it to exact digits a JS number cannot represent', () => {
  // 30 significant digits: `Number(value)` only carries ~17 of them, so the naive float path and
  // the exact bigint path visibly diverge once formatted at high decimal precision.
  const value = 123_456_789_012_345_678_901_234_567_890n;
  const options = { decimals: 10 } as const;

  const exact = formatBytes(value, 'en-US', options);
  const naiveFloatEquivalent = formatBytes(Number(value), 'en-US', options);
  expect(exact, 'exact bigint scaling must preserve every digit up to the requested decimals').to.equal(
    '123,456,789,012,345.6789012346 PB',
  );
  expect(exact).to.not.equal(naiveFloatEquivalent);
});

it('formatBytes accepts a decimal string input and preserves its fractional digits exactly', () => {
  const value = '123456789012345678901234567890.25';
  const exact = formatBytes(value, 'en-US', { unitStep: 1e35, decimals: 2 });
  // unitStep is large enough that no unit scaling occurs (index 0): the exact source digits
  // reach the formatter completely unscaled.
  expect(exact).to.equal('123,456,789,012,345,678,901,234,567,890.25 byte');
});

it('formatBytes returns undefined for a non-finite or unparseable value instead of throwing', () => {
  // A NaN unit-ladder index would otherwise select `units[NaN] === undefined`, which
  // `Intl.NumberFormat` rejects outright for `style: 'unit'`.
  expect(formatBytes('not-a-number', 'en-US')).to.equal(undefined);
  expect(formatBytes(NaN, 'en-US')).to.equal(undefined);
  expect(formatBytes(Infinity, 'en-US')).to.equal(undefined);
});

it('formats dates like a direct Intl.DateTimeFormat call and resolves the same date sources <lr-format-date> accepts', () => {
  const date = new Date(2020, 0, 15);
  expect(formatDate(date, 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })).to.equal('January 15, 2020');
  expect(formatDate(date.getTime(), 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })).to.equal(
    'January 15, 2020',
  );
});

it('formatDate returns undefined for an unresolvable source instead of throwing', () => {
  expect(formatDate('not a real date', 'en-US')).to.equal(undefined);
  expect(formatDate({} as unknown as string, 'en-US')).to.equal(undefined);
});

it('formats relative time using the same auto-unit selection as <lr-relative-time>', () => {
  const now = Date.UTC(2024, 0, 15, 12, 0, 0);
  const threeDaysAgo = now - 3 * 86_400_000;
  expect(formatRelativeTime(threeDaysAgo, 'en-US', { now, numeric: 'always' })).to.equal('3 days ago');
  expect(formatRelativeTime(threeDaysAgo, 'en-US', { now, unit: 'hour', numeric: 'always' })).to.equal(
    '72 hours ago',
  );
});

it('formatRelativeTime returns undefined for an unresolvable source instead of throwing', () => {
  expect(formatRelativeTime('not a real date', 'en-US')).to.equal(undefined);
});

describe('omitted locale resolves to the active setLyraLocale() locale, not a hardcoded English default', () => {
  it('formatNumber: an app that never calls setLyraLocale() keeps exactly today\'s English default', () => {
    withActiveLocale(() => {
      setLyraLocale('');
      expect(getLyraLocale(), 'precondition: no active locale set').to.equal('');
      // Pinned against the still-unmodified `resolveIntlLocale(undefined)` path in
      // `internal/intl-cache.ts`, which this change does not touch -- proves byte-identical output.
      expect(formatNumber(1234.5)).to.equal(getNumberFormat(undefined).format(1234.5));
      expect(formatNumber(1234.5)).to.equal('1,234.5');
    });
  });

  it('formatNumber: an omitted locale follows setLyraLocale() once one is set', () => {
    withActiveLocale(() => {
      setLyraLocale('fr');
      const expected = new Intl.NumberFormat('fr').format(1234.5);
      expect(formatNumber(1234.5)).to.equal(expected);
      expect(formatNumber(1234.5)).to.not.equal('1,234.5');
    });
  });

  it('formatNumber: an explicit locale argument stays authoritative over the active locale', () => {
    withActiveLocale(() => {
      setLyraLocale('fr');
      expect(formatNumber(1234.5, 'en-US')).to.equal('1,234.5');
    });
  });

  it("formatNumber: an explicit 'auto' opts into the active locale, same as an omitted argument", () => {
    withActiveLocale(() => {
      setLyraLocale('fr');
      const expected = new Intl.NumberFormat('fr').format(1234.5);
      expect(formatNumber(1234.5, 'auto')).to.equal(expected);
    });
  });

  it('formatDate: unset stays English; an omitted locale follows setLyraLocale(); an explicit locale wins', () => {
    withActiveLocale(() => {
      const date = new Date(2020, 0, 15);
      const options = { year: 'numeric', month: 'long', day: 'numeric' } as const;

      setLyraLocale('');
      expect(formatDate(date, undefined, options)).to.equal('January 15, 2020');

      setLyraLocale('fr');
      expect(formatDate(date, undefined, options)).to.equal(new Intl.DateTimeFormat('fr', options).format(date));
      expect(formatDate(date, 'en-US', options)).to.equal('January 15, 2020');
    });
  });

  it('formatRelativeTime: unset stays English; an omitted locale follows setLyraLocale(); an explicit locale wins', () => {
    withActiveLocale(() => {
      const now = Date.UTC(2024, 0, 15, 12, 0, 0);
      const threeDaysAgo = now - 3 * 86_400_000;

      setLyraLocale('');
      expect(formatRelativeTime(threeDaysAgo, undefined, { now, numeric: 'always' })).to.equal('3 days ago');

      setLyraLocale('fr');
      const expected = new Intl.RelativeTimeFormat('fr', { numeric: 'always' }).format(-3, 'day');
      expect(formatRelativeTime(threeDaysAgo, undefined, { now, numeric: 'always' })).to.equal(expected);
      expect(formatRelativeTime(threeDaysAgo, 'en-US', { now, numeric: 'always' })).to.equal('3 days ago');
    });
  });

  it('formatBytes: an omitted locale follows setLyraLocale() (it delegates through formatNumber)', () => {
    withActiveLocale(() => {
      setLyraLocale('');
      const englishUnset = formatBytes(1234.5);

      setLyraLocale('fr');
      const french = formatBytes(1234.5);
      const englishExplicit = formatBytes(1234.5, 'en-US');

      expect(englishUnset, 'unset app keeps the deterministic English default').to.equal(englishExplicit);
      expect(french, 'French uses a comma decimal separator, unlike the English period').to.contain(',');
      expect(french).to.not.contain('.');
      expect(french).to.not.equal(englishExplicit);
    });
  });
});
