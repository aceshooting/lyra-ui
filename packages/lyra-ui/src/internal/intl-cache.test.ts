import { expect } from '@open-wc/testing';
import {
  getCollator,
  getDateTimeFormat,
  getDisplayNames,
  getListFormat,
  getNumberFormat,
  getPluralRules,
  getRelativeTimeFormat,
  getSegmenter,
  resolveIntlLocale,
} from './intl-cache.js';

it('canonicalizes underscore locale tags', () => {
  expect(resolveIntlLocale('EN_us')).to.equal('en-US');
});

it('uses a deterministic safe locale for browser auto and malformed or synthetic tags', () => {
  expect(resolveIntlLocale('auto')).to.equal('en');
  expect(resolveIntlLocale('not_a_locale@')).to.equal('en');
  expect(resolveIntlLocale('x-test')).to.equal('en');
});

it('routes every shared Intl formatter kind through the safe locale boundary', () => {
  const malformed = 'not_a_locale@';
  expect(() => getNumberFormat(malformed).format(1234)).not.to.throw();
  expect(() => getDateTimeFormat(malformed).format(new Date(2020, 0, 15))).not.to.throw();
  expect(() => getDisplayNames(malformed, { type: 'region' }).of('FR')).not.to.throw();
  expect(() => getListFormat(malformed).format(['Alpha', 'Beta'])).not.to.throw();
  expect(() => getRelativeTimeFormat(malformed).format(-1, 'day')).not.to.throw();
  expect(() => getPluralRules(malformed).select(2)).not.to.throw();
  expect(() => getCollator(malformed).compare('a', 'b')).not.to.throw();
  expect(() => [...getSegmenter(malformed).segment('text')]).not.to.throw();
});

it('shares cached formatter instances across equivalent canonical locale spellings', () => {
  expect(getNumberFormat('en_US') === getNumberFormat('en-US')).to.be.true;
});

it('memoizes Intl.NumberFormat per locale + options, insensitive to option key order', () => {
  const a = getNumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });
  const b = getNumberFormat('en-US', { maximumFractionDigits: 1, style: 'percent' });
  expect(a === b).to.be.true;
  expect(a.format(0.5)).to.equal('50%');
});

it('returns distinct Intl.NumberFormat instances for different locales or options', () => {
  const base = getNumberFormat('en-US');
  expect(base === getNumberFormat('de-DE')).to.be.false;
  expect(base === getNumberFormat('en-US', { style: 'percent' })).to.be.false;
  expect(base === getNumberFormat('en-US')).to.be.true;
});

it('memoizes Intl.DateTimeFormat and formats with the requested options', () => {
  const a = getDateTimeFormat('en-US', { year: 'numeric', month: 'long' });
  const b = getDateTimeFormat('en-US', { month: 'long', year: 'numeric' });
  expect(a === b).to.be.true;
  expect(a.format(new Date(2020, 0, 15))).to.equal('January 2020');
});

it('memoizes Intl.DisplayNames and resolves display names', () => {
  const a = getDisplayNames('en', { type: 'region' });
  const b = getDisplayNames('en', { type: 'region' });
  expect(a === b).to.be.true;
  expect(a.of('FR')).to.equal('France');
  expect(a === getDisplayNames('en', { type: 'language' })).to.be.false;
});

it('memoizes Intl.Collator and applies locale-aware numeric ordering', () => {
  const a = getCollator('en-US', { numeric: true });
  const b = getCollator('en-US', { numeric: true });
  expect(a === b).to.be.true;
  expect(['item10', 'item2'].sort(a.compare)).to.deep.equal(['item2', 'item10']);
  expect(a === getCollator('en-US', { numeric: false })).to.be.false;
});

it('memoizes Intl.ListFormat and formats locale-aware lists', () => {
  const a = getListFormat('en-US', { style: 'long', type: 'conjunction' });
  const b = getListFormat('en-US', { type: 'conjunction', style: 'long' });
  expect(a === b).to.be.true;
  expect(a.format(['Alpha', 'Beta', 'Gamma'])).to.equal('Alpha, Beta, and Gamma');
});

it('memoizes Intl.Segmenter and segments with the requested granularity', () => {
  const a = getSegmenter('en-US', { granularity: 'grapheme' });
  const b = getSegmenter('en-US', { granularity: 'grapheme' });
  expect(a === b).to.be.true;
  expect([...a.segment('A\u0301B')].map(({ segment }) => segment)).to.deep.equal(['A\u0301', 'B']);
  expect(a === getSegmenter('en-US', { granularity: 'word' })).to.be.false;
});

it('evicts the least recently used entry once a kind exceeds its bound', () => {
  const first = getNumberFormat('en-US', { minimumIntegerDigits: 21 });
  // A cache hit refreshes recency rather than constructing anew.
  expect(first === getNumberFormat('en-US', { minimumIntegerDigits: 21 })).to.be.true;
  // Insert 64 distinct fresh entries. The cache holds at most 64 per kind and
  // evicts least-recently-used, so 64 fresh insertions purge every entry that
  // preceded them — including `first` — no matter how full the cache was.
  for (let digits = 1; digits <= 16; digits++) {
    for (const locale of ['en-US', 'de-DE', 'fr-FR', 'ja-JP']) {
      getNumberFormat(locale, { minimumIntegerDigits: digits });
    }
  }
  expect(first === getNumberFormat('en-US', { minimumIntegerDigits: 21 })).to.be.false;
  // The most recent entries survived untouched.
  const kept = getNumberFormat('ja-JP', { minimumIntegerDigits: 16 });
  expect(kept === getNumberFormat('ja-JP', { minimumIntegerDigits: 16 })).to.be.true;
});

it('serves a repeated lookup with equal options without re-serializing the options bag', () => {
  getNumberFormat('en', { maximumFractionDigits: 2, minimumFractionDigits: 1 });
  const stringify = JSON.stringify;
  let serializations = 0;
  JSON.stringify = ((...args: Parameters<typeof JSON.stringify>) => {
    serializations += 1;
    return stringify(...args);
  }) as typeof JSON.stringify;
  const formatters = new Set<Intl.NumberFormat>();
  try {
    // A per-row template loop: a fresh, equal options literal on every call.
    for (let row = 0; row < 200; row++) {
      formatters.add(getNumberFormat('en', { maximumFractionDigits: 2, minimumFractionDigits: 1 }));
    }
  } finally {
    JSON.stringify = stringify;
  }
  expect(formatters.size).to.equal(1);
  expect(serializations).to.equal(0);
});

it('never serves a stale formatter for a reused options object mutated between lookups', () => {
  const options: Intl.NumberFormatOptions = { maximumFractionDigits: 0 };
  expect(getNumberFormat('en', options).format(1.25)).to.equal('1');
  options.maximumFractionDigits = 2;
  expect(getNumberFormat('en', options).format(1.25)).to.equal('1.25');
  options.minimumFractionDigits = 3;
  options.maximumFractionDigits = 3;
  expect(getNumberFormat('en', options).format(1.25)).to.equal('1.250');
  expect(getNumberFormat('de', options).format(1.25)).to.equal('1,250');
  expect(getNumberFormat('de').format(1.25)).to.equal('1,25');
});

it('does not confuse inherited formatter options with an empty options bag', () => {
  const defaults = getNumberFormat('en-US', {});
  const inherited: Intl.NumberFormatOptions = Object.create({ style: 'percent' });
  expect(getNumberFormat('en-US', inherited).format(0.5)).to.equal('50%');
  expect(getNumberFormat('en-US', {}).format(0.5)).to.equal('0.5');
  expect(getNumberFormat('en-US', {}) === defaults).to.be.true;
});

it('reads formatter values exposed by a proxy instead of using its descriptors as values', () => {
  getNumberFormat('en-US', {});
  let style = 'percent';
  let styleReads = 0;
  const options = new Proxy({}, {
    get(target, key, receiver) {
      if (key === 'style') {
        styleReads += 1;
        return style;
      }
      return Reflect.get(target, key, receiver);
    },
  });
  expect(getNumberFormat('en-US', options).format(0.5)).to.equal('50%');
  expect(styleReads).to.equal(1);
  style = 'decimal';
  expect(getNumberFormat('en-US', options).format(0.5)).to.equal('0.5');
  expect(styleReads).to.equal(2);
  expect(getNumberFormat('en-US', { style: 'percent' }).format(0.5)).to.equal('50%');
});

it('includes formatter options inherited directly from Object.prototype', () => {
  getNumberFormat('en-US', {});
  const original = Object.getOwnPropertyDescriptor(Object.prototype, 'style');
  try {
    Object.defineProperty(Object.prototype, 'style', { value: 'percent', configurable: true });
    expect(getNumberFormat('en-US', {}).format(0.5)).to.equal('50%');
    expect(getNumberFormat('en-US', { style: 'decimal' }).format(0.5)).to.equal('0.5');
  } finally {
    if (original) Object.defineProperty(Object.prototype, 'style', original);
    else Reflect.deleteProperty(Object.prototype, 'style');
  }
  expect(getNumberFormat('en-US', {}).format(0.5)).to.equal('0.5');
});

it('coerces captured proxy values once without re-reading their getters', () => {
  let reads = 0;
  let coercions = 0;
  const options = new Proxy({}, {
    get(target, key, receiver) {
      if (key !== 'style') return Reflect.get(target, key, receiver);
      reads += 1;
      return { toString() { coercions += 1; return 'percent'; } };
    },
  });
  expect(getNumberFormat('en-US', options).format(0.5)).to.equal('50%');
  expect(reads).to.equal(1);
  expect(coercions).to.equal(1);
  expect(getNumberFormat('en-US', options).format(0.5)).to.equal('50%');
  expect(reads).to.equal(2);
  expect(coercions).to.equal(2);
});

it('keeps native coercion order when one ordinary option changes a later option', () => {
  let coercions = 0;
  const options = {
    style: { toString() { coercions += 1; options.currency = 'EUR'; return 'currency'; } },
    currency: 'USD',
  };
  const formatter = getNumberFormat('en-US', options as unknown as Intl.NumberFormatOptions);
  expect(formatter.resolvedOptions().currency).to.equal('EUR');
  expect(coercions).to.equal(1);
});

it('preserves native repeated DateTimeFormat accessor reads', () => {
  const directReads: string[] = [];
  const cachedReads: string[] = [];
  const options = (reads: string[]): Intl.DateTimeFormatOptions => ({
    get year(): 'numeric' { reads.push('year'); return 'numeric'; },
    get timeZone() { reads.push('timeZone'); return 'UTC'; },
  });
  const date = new Date('2020-01-15T12:00:00Z');
  const expected = new Intl.DateTimeFormat('en-US', options(directReads)).format(date);
  expect(getDateTimeFormat('en-US', options(cachedReads)).format(date)).to.equal(expected);
  expect(cachedReads).to.deep.equal(directReads);
});

it('honors non-enumerable formatter options before and after an ordinary cache hit', () => {
  const options = Object.defineProperty({}, 'style', { value: 'percent', configurable: true });
  expect(getNumberFormat('en-US', {}).format(0.5)).to.equal('0.5');
  expect(getNumberFormat('en-US', options).format(0.5)).to.equal('50%');
  Object.defineProperty(options, 'style', { value: 'decimal' });
  expect(getNumberFormat('en-US', options).format(0.5)).to.equal('0.5');
});

it('preserves native getter and coercion behavior without poisoning ordinary cache entries', () => {
  let reads = 0;
  const options: Intl.NumberFormatOptions = {
    get style() {
      reads += 1;
      return reads === 1 ? 'percent' : 'decimal';
    },
  };
  expect(getNumberFormat('en-US', options).format(0.5)).to.equal('50%');
  expect(reads).to.equal(1);
  expect(getNumberFormat('en-US', options).format(0.5)).to.equal('0.5');
  expect(reads).to.equal(2);
  expect(getNumberFormat('en-US', { style: 'percent' }).format(0.5)).to.equal('50%');
});

it('passes inherited and hidden options through each formatter family', () => {
  const date = Object.create({ year: 'numeric', timeZone: 'UTC' }) as Intl.DateTimeFormatOptions;
  getDateTimeFormat('en-US', {});
  expect(getDateTimeFormat('en-US', date).format(new Date('2020-01-15T12:00:00Z'))).to.equal('2020');

  const collator = Object.defineProperty({}, 'numeric', { value: true });
  getCollator('en-US', {});
  expect(getCollator('en-US', collator).compare('2', '10')).to.be.lessThan(0);

  const names = Object.create({ type: 'language' }) as Intl.DisplayNamesOptions;
  expect(getDisplayNames('en-US', names).of('en')).to.equal('English');
  const list = Object.create({ type: 'disjunction' }) as Intl.ListFormatOptions;
  getListFormat('en-US', {});
  expect(getListFormat('en-US', list).format(['a', 'b'])).to.equal('a or b');
  const relative = Object.create({ numeric: 'auto' }) as Intl.RelativeTimeFormatOptions;
  getRelativeTimeFormat('en-US', {});
  expect(getRelativeTimeFormat('en-US', relative).format(-1, 'day')).to.equal('yesterday');
  const plural = Object.create({ type: 'ordinal' }) as Intl.PluralRulesOptions;
  getPluralRules('en-US', {});
  expect(getPluralRules('en-US', plural).select(2)).to.equal('two');
  const segment = Object.create({ granularity: 'word' }) as Intl.SegmenterOptions;
  getSegmenter('en-US', {});
  expect([...getSegmenter('en-US', segment).segment('one two')].length).to.equal(3);
});

it('captures a null-prototype options bag by value and shares it with an ordinary equal bag', () => {
  const bag = Object.assign(Object.create(null) as Record<string, unknown>, { style: 'percent' }) as Intl.NumberFormatOptions;
  expect(getNumberFormat('en-US', bag).format(0.5)).to.equal('50%');
  expect(getNumberFormat('en-US', bag) === getNumberFormat('en-US', { style: 'percent' })).to.equal(true);
});

it('hands a primitive options argument straight to Intl and never caches the result', () => {
  const primitive = true as unknown as Intl.NumberFormatOptions;
  const formatter = getNumberFormat('en-US', primitive);
  expect(formatter.format(1234.5)).to.equal('1,234.5');
  expect(formatter === getNumberFormat('en-US', primitive)).to.equal(false);
  expect(() => getNumberFormat('en-US', null as unknown as Intl.NumberFormatOptions)).to.throw(TypeError);
});

it('hands an options proxy that rejects reflection straight to Intl', () => {
  let reads = 0;
  const options = new Proxy({ style: 'percent' }, {
    getPrototypeOf() { throw new Error('reflection rejected'); },
    get(target, key, receiver) { reads += 1; return Reflect.get(target, key, receiver); },
  }) as Intl.NumberFormatOptions;
  const formatter = getNumberFormat('en-US', options);
  expect(formatter.format(0.5)).to.equal('50%');
  expect(reads, 'the constructor itself read the options').to.be.greaterThan(0);
  expect(formatter === getNumberFormat('en-US', options)).to.equal(false);
});
