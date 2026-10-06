import { expect } from '@open-wc/testing';
import { binValues } from './histogram-bin.js';
import { getLyraLocale, setLyraLocale } from '../../../internal/localization.js';

/** Restores the module-global active locale after each case -- shared by the whole file. */
function withActiveLocale(body: () => void): void {
  const previous = getLyraLocale();
  try {
    body();
  } finally {
    setLyraLocale(previous);
  }
}

it('splits values into equal-width buckets and counts membership', () => {
  const buckets = binValues([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
  expect(buckets.length).to.equal(5);
  expect(buckets.reduce((sum, b) => sum + b.count, 0)).to.equal(11);
});

it('places a value equal to the maximum in the last bucket', () => {
  const buckets = binValues([0, 10], 2);
  expect(buckets[1]!.count).to.equal(1);
});

it('labels each bucket with its numeric range', () => {
  const buckets = binValues([0, 10], 2);
  expect(buckets[0]!.label).to.match(/0.*5/);
  expect(buckets[0]!.label).to.not.contain('.0');
});

it('isolates numeric range labels so RTL layout cannot reverse their endpoints', () => {
  const [bucket] = binValues([0, 10], 2);
  expect(bucket!.label.startsWith('\u2066')).to.be.true;
  expect(bucket!.label.endsWith('\u2069')).to.be.true;
  expect(bucket!.label).to.contain('0–5');
});

it('returns an empty array for empty input', () => {
  expect(binValues([], 5)).to.deep.equal([]);
});

it('returns an empty array instead of throwing when binCount is 0', () => {
  expect(binValues([1, 2, 3], 0)).to.deep.equal([]);
});

it('returns an empty array instead of throwing when binCount is negative', () => {
  expect(binValues([1, 2, 3], -2)).to.deep.equal([]);
});

it('does not crash on a very large array (spreading it as call arguments would blow the call-stack size limit)', () => {
  const values = Array.from({ length: 150_000 }, (_, i) => i);
  const buckets = binValues(values, 10);
  expect(buckets.length).to.equal(10);
  expect(buckets.reduce((sum, b) => sum + b.count, 0)).to.equal(150_000);
});

it('returns an empty array instead of throwing when binCount is NaN', () => {
  expect(binValues([1, 2, 3], NaN)).to.deep.equal([]);
});

it('returns an empty array instead of throwing when binCount is Infinity', () => {
  expect(binValues([1, 2, 3], Infinity)).to.deep.equal([]);
});

it('floors a fractional binCount instead of producing a mismatched bucket array', () => {
  const buckets = binValues([0, 10], 3.9);
  expect(buckets.length).to.equal(3);
});

it('caps an enormous finite binCount before allocating the bucket array', () => {
  const buckets = binValues([0, 10], Number.MAX_SAFE_INTEGER);
  expect(buckets.length).to.equal(1_000);
  expect(buckets.reduce((sum, b) => sum + b.count, 0)).to.equal(2);
});

it('drops non-finite samples instead of throwing', () => {
  const buckets = binValues([1, 2, NaN, Infinity, -Infinity, 3], 2);
  expect(buckets.reduce((sum, b) => sum + b.count, 0)).to.equal(3);
});

it('represents a constant domain as one truthful bucket', () => {
  const buckets = binValues([5, 5, 5, 5], 4);
  expect(buckets).to.have.length(1);
  expect(buckets[0]!.count).to.equal(4);
  expect(buckets[0]!.label).to.contain('5');
  expect(buckets[0]!.label).to.not.contain('5.0');
});

it('does not fabricate repeated zero-width ranges for an extreme constant domain', () => {
  const buckets = binValues([Number.MAX_VALUE, Number.MAX_VALUE], 1_000);
  expect(buckets).to.have.length(1);
  expect(buckets[0]!.count).to.equal(2);
  expect(buckets[0]!.label).to.not.contain('–');
});

it('formats bucket ranges with the requested locale', () => {
  const buckets = binValues([1000, 2000], 2, 'de-DE');
  expect(buckets[0]!.label).to.contain('1.000');
  expect(buckets[0]!.label).to.not.contain('1000');
});

it('derives bound digits from the bin width so narrow bins stay distinct', () => {
  const narrow = binValues([0.011, 0.023, 0.049], 10, 'en');
  expect(new Set(narrow.map((bucket) => bucket.label)).size).to.equal(10);
  expect(narrow[0]!.label).to.contain('0.011');
  const wide = binValues([1_000_000, 2_000_000], 10, 'en');
  expect(wide[0]!.label).to.contain('1,000,000');
  expect(wide.some((bucket) => bucket.label.includes('.0'))).to.equal(false);
  const halves = binValues([0, 1, 2, 3, 4, 5], 10, 'en');
  expect(halves[1]!.label).to.contain('0.5');
});

describe('an omitted locale resolves to the active setLyraLocale() locale, not a hardcoded English default', () => {
  it('an app that never calls setLyraLocale() keeps exactly today\'s English default', () => {
    withActiveLocale(() => {
      setLyraLocale('');
      const buckets = binValues([1000, 2000], 2);
      expect(buckets[0]!.label).to.contain('1,000');
    });
  });

  it('an omitted locale follows setLyraLocale() once one is set', () => {
    withActiveLocale(() => {
      setLyraLocale('de-DE');
      const buckets = binValues([1000, 2000], 2);
      expect(buckets[0]!.label).to.contain('1.000');
      expect(buckets[0]!.label).to.not.contain('1,000');
    });
  });

  it('an explicit locale argument stays authoritative over the active locale', () => {
    withActiveLocale(() => {
      setLyraLocale('de-DE');
      const buckets = binValues([1000, 2000], 2, 'en-US');
      expect(buckets[0]!.label).to.contain('1,000');
    });
  });

  it("an explicit 'auto' opts into the active locale, same as an omitted argument", () => {
    withActiveLocale(() => {
      setLyraLocale('de-DE');
      const buckets = binValues([1000, 2000], 2, 'auto');
      expect(buckets[0]!.label).to.contain('1.000');
      expect(buckets[0]!.label).to.not.contain('1,000');
    });
  });
});

it('bins full-range and subnormal finite endpoints without overflowing derived boundaries', () => {
  let fullRange: ReturnType<typeof binValues> = [];
  expect(() => {
    fullRange = binValues([-Number.MAX_VALUE, 0, Number.MAX_VALUE], 2);
  }).to.not.throw();
  expect(fullRange.map((bucket) => bucket.count)).to.deep.equal([1, 2]);

  const subnormal = binValues([-Number.MIN_VALUE, 0, Number.MIN_VALUE], 2);
  expect(subnormal.map((bucket) => bucket.count)).to.deep.equal([1, 2]);
  expect(subnormal.every((bucket) => bucket.label.length > 0)).to.be.true;
});
