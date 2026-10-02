import { expect } from '@open-wc/testing';
import {
  DEFAULT_CURRENCY_CODES,
  DEFAULT_CURRENCY_ENTRIES,
  normalizeCurrencyCatalog,
  normalizeCurrencyValue,
} from './currency-catalog.js';
import { resolveCurrencyPresentation } from './currency-presentation.js';

describe('currency catalog and presentation', () => {
  it('keeps one ordered, immutable pinned default that excludes non-currency sentinels', () => {
    expect(DEFAULT_CURRENCY_CODES).to.have.length(176);
    expect(DEFAULT_CURRENCY_CODES).to.deep.equal([...DEFAULT_CURRENCY_CODES].sort());
    expect(new Set(DEFAULT_CURRENCY_CODES).size).to.equal(176);
    expect(DEFAULT_CURRENCY_CODES).to.include('EUR');
    expect(DEFAULT_CURRENCY_CODES).to.include('XAU');
    expect(DEFAULT_CURRENCY_CODES).not.to.include('XTS');
    expect(DEFAULT_CURRENCY_CODES).not.to.include('XXX');
    expect(DEFAULT_CURRENCY_ENTRIES.map((entry) => entry.code)).to.deep.equal(DEFAULT_CURRENCY_CODES);
    expect(Object.isFrozen(DEFAULT_CURRENCY_CODES)).to.equal(true);
    expect(Object.isFrozen(DEFAULT_CURRENCY_ENTRIES)).to.equal(true);
    expect(DEFAULT_CURRENCY_ENTRIES.every((entry) => Object.isFrozen(entry))).to.equal(true);
  });

  it('normalizes only valid three-letter values and retains malformed assigned text', () => {
    expect(normalizeCurrencyValue(' eur ')).to.equal('EUR');
    expect(normalizeCurrencyValue(' xTs ')).to.equal('XTS');
    expect(normalizeCurrencyValue(' 12$ ')).to.equal('12$');
    expect(normalizeCurrencyValue('eu')).to.equal('eu');
    expect(normalizeCurrencyValue('   ')).to.equal('');
    expect(normalizeCurrencyValue(17)).to.equal('');
  });

  it('distinguishes omitted catalog from an explicit empty catalog', () => {
    expect(normalizeCurrencyCatalog(undefined)).to.equal(undefined);
    expect(normalizeCurrencyCatalog(null)).to.equal(undefined);
    const empty = normalizeCurrencyCatalog([]);
    expect(empty).to.deep.equal([]);
    expect(Object.isFrozen(empty)).to.equal(true);
    expect(normalizeCurrencyCatalog({ code: 'EUR' })).to.deep.equal([]);
  });

  it('keeps caller order and first normalized duplicate while owning frozen primitive snapshots', () => {
    const first = { code: ' usd ', label: '', symbol: '', disabled: true };
    const source: unknown[] = [first, { code: 'EUR', label: 'Euro' }, 'Usd', ' XTS ', 'bad-code'];
    const rows = normalizeCurrencyCatalog(source)!;
    expect(rows.map((row) => row.code)).to.deep.equal(['USD', 'EUR', 'XTS']);
    expect(rows[0]).to.deep.equal({ code: 'USD', label: '', symbol: '', disabled: true });
    expect(rows[1]).to.deep.equal({ code: 'EUR', label: 'Euro' });
    expect(Object.isFrozen(rows)).to.equal(true);
    expect(rows.every((row) => Object.isFrozen(row))).to.equal(true);
    first.label = 'Changed';
    source.push('GBP');
    expect(rows[0]!.label).to.equal('');
    expect(rows).to.have.length(3);
  });

  it('ignores malformed rows and throwing getters without dropping later valid rows', () => {
    const badCode = { get code(): string { throw new Error('code getter'); } };
    const badLabel = { code: 'GBP', get label(): string { throw new Error('label getter'); } };
    const rows = normalizeCurrencyCatalog([
      badCode, badLabel, { code: 'AUD', disabled: 'yes' }, { code: 'CAD', label: 4 },
      { code: 'CHF', symbol: null }, { code: 'JPY' },
    ])!;
    expect(rows.map((row) => row.code)).to.deep.equal(['JPY']);
  });

  it('never invokes array or row accessors and ignores inherited and trap-only fields', () => {
    let getterCalls = 0;
    const inherited = Object.create({ code: 'JPY' }) as { code: string };
    const badDescriptor = new Proxy({ code: 'CHF' }, {
      getOwnPropertyDescriptor() { throw new Error('descriptor trap'); },
    });
    const source: unknown[] = [
      'EUR',
      { code: 'CAD', get label() { getterCalls++; return 'Bad first row'; } },
      { get code() { getterCalls++; return 'GBP'; } },
      inherited,
      { code: 'CAD', label: 'Valid later row' },
      badDescriptor,
      'USD',
    ];
    Object.defineProperty(source, '0', {
      configurable: true, enumerable: true,
      get() { getterCalls++; return 'EUR'; },
    });
    const rows = normalizeCurrencyCatalog(source)!;
    expect(getterCalls).to.equal(0);
    expect(rows.map((row) => row.code)).to.deep.equal(['CAD', 'USD']);
    expect(rows[0]?.label).to.equal('Valid later row');
  });

  it('examines no more than 512 input rows even when earlier rows are invalid', () => {
    const ignored = [...Array.from({ length: 512 }, () => 'invalid'), 'EUR'];
    expect(normalizeCurrencyCatalog(ignored)).to.deep.equal([]);
    ignored[511] = 'usd';
    expect(normalizeCurrencyCatalog(ignored)?.map((row) => row.code)).to.deep.equal(['USD']);
  });

  it('uses this engine\'s localized Intl currency name and symbol while preserving overrides', () => {
    const rows = normalizeCurrencyCatalog([
      { code: 'EUR' },
      { code: 'USD', label: '', symbol: '', disabled: true },
    ])!;
    const result = resolveCurrencyPresentation(rows, 'fr');
    const expectedName = new Intl.DisplayNames('fr', { type: 'currency', fallback: 'code' }).of('EUR');
    const expectedSymbol = new Intl.NumberFormat('fr', {
      style: 'currency', currency: 'EUR', currencyDisplay: 'symbol',
    }).formatToParts(0).find((part) => part.type === 'currency')?.value;
    expect(result[0]).to.deep.equal({ code: 'EUR', label: expectedName, symbol: expectedSymbol, disabled: false });
    expect(result[1]).to.deep.equal({ code: 'USD', label: '', symbol: '', disabled: true });
    expect(Object.isFrozen(result)).to.equal(true);
    expect(result.every((row) => Object.isFrozen(row))).to.equal(true);
    expect(rows[0]!.label).to.equal(undefined);
  });

  it('falls back to the code when Intl name and symbol construction fails', () => {
    const displayDescriptor = Object.getOwnPropertyDescriptor(Intl, 'DisplayNames')!;
    const numberDescriptor = Object.getOwnPropertyDescriptor(Intl, 'NumberFormat')!;
    let displayCalls = 0;
    let numberCalls = 0;
    try {
      Object.defineProperty(Intl, 'DisplayNames', {
        ...displayDescriptor,
        value: class { constructor() { displayCalls++; throw new Error('no display data'); } },
      });
      Object.defineProperty(Intl, 'NumberFormat', {
        ...numberDescriptor,
        value: class { constructor() { numberCalls++; throw new Error('no currency format'); } },
      });
      const result = resolveCurrencyPresentation([{ code: 'ZZZ' }], 'en-US-x-lr-currency-test');
      expect(result[0]).to.deep.equal({ code: 'ZZZ', label: 'ZZZ', symbol: 'ZZZ', disabled: false });
      expect(displayCalls).to.equal(1);
      expect(numberCalls).to.equal(1);
    } finally {
      Object.defineProperty(Intl, 'DisplayNames', displayDescriptor);
      Object.defineProperty(Intl, 'NumberFormat', numberDescriptor);
    }
  });

  it('falls back independently when Intl methods throw or return empty data', () => {
    const nameDescriptor = Object.getOwnPropertyDescriptor(Intl.DisplayNames.prototype, 'of')!;
    const partsDescriptor = Object.getOwnPropertyDescriptor(Intl.NumberFormat.prototype, 'formatToParts')!;
    try {
      Object.defineProperty(Intl.DisplayNames.prototype, 'of', {
        ...nameDescriptor, value() { throw new Error('name unavailable'); },
      });
      Object.defineProperty(Intl.NumberFormat.prototype, 'formatToParts', {
        ...partsDescriptor, value() { return []; },
      });
      expect(resolveCurrencyPresentation([{ code: 'EUR' }], 'fr')[0]).to.deep.equal({
        code: 'EUR', label: 'EUR', symbol: 'EUR', disabled: false,
      });
      Object.defineProperty(Intl.DisplayNames.prototype, 'of', {
        ...nameDescriptor, value() { return ''; },
      });
      Object.defineProperty(Intl.NumberFormat.prototype, 'formatToParts', {
        ...partsDescriptor, value() { throw new Error('parts unavailable'); },
      });
      expect(resolveCurrencyPresentation([{ code: 'USD' }], 'fr')[0]).to.deep.equal({
        code: 'USD', label: 'USD', symbol: 'USD', disabled: false,
      });
    } finally {
      Object.defineProperty(Intl.DisplayNames.prototype, 'of', nameDescriptor);
      Object.defineProperty(Intl.NumberFormat.prototype, 'formatToParts', partsDescriptor);
    }
  });

  it('keeps an unknown three-letter code and tolerates a malformed locale', () => {
    const entries = normalizeCurrencyCatalog(['ZZZ'])!;
    const result = resolveCurrencyPresentation(entries, 'bad_locale_@');
    expect(result[0]?.code).to.equal('ZZZ');
    expect(result[0]?.label).to.be.a('string').and.not.empty;
    expect(result[0]?.symbol).to.be.a('string').and.not.empty;
  });

  it('keeps caller text literal and never interprets it as markup', () => {
    const label = '<img src=x onerror=alert(1)>';
    const result = resolveCurrencyPresentation([{ code: 'EUR', label, symbol: '<b>€</b>' }], 'en');
    expect(result[0]).to.deep.equal({ code: 'EUR', label, symbol: '<b>€</b>', disabled: false });
  });
});
