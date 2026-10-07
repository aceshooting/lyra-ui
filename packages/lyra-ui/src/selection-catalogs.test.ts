import { expect } from '@open-wc/testing';
import { COUNTRY_CODES, resolveCountryNames } from './countries.js';
import { UNIT_CODES, resolveUnitNames } from './units.js';
import { getTimeZoneCodes } from './time-zones.js';

describe('public selection catalogs', () => {
  it('provides an immutable ISO country catalog and localized caller-ordered display rows', () => {
    expect(COUNTRY_CODES.length).to.equal(249);
    expect(new Set(COUNTRY_CODES).size).to.equal(249);
    expect(Object.isFrozen(COUNTRY_CODES)).to.equal(true);
    const rows = resolveCountryNames([
      { code: ' fr ', group: 'Nearby' },
      { code: 'DE', label: 'Our German office', disabled: true },
      { code: 'FR', label: 'Duplicate' },
    ], 'en');
    expect(rows.map((row) => row.code)).to.deep.equal(['FR', 'DE']);
    expect(rows[0]!.label).to.equal('France');
    expect(rows[0]!.group).to.equal('Nearby');
    expect(rows[1]!.label).to.equal('Our German office');
    expect(rows[1]!.searchText).to.include('Germany');
    expect(rows[1]!.disabled).to.equal(true);
    expect(Object.isFrozen(rows)).to.equal(true);
    expect(Object.isFrozen(rows[0])).to.equal(true);
    expect(resolveCountryNames(['DE'], 'fr')[0]!.label).to.equal('Allemagne');
    expect(resolveCountryNames([], 'en')).to.deep.equal([]);
  });

  it('does not invoke catalog getters at public helper boundaries', () => {
    let reads = 0;
    const entry = Object.defineProperty({}, 'code', {
      get() { reads++; throw new Error('Catalog getters must not execute.'); },
    });
    const hostile = [entry] as unknown as readonly string[];
    expect(resolveCountryNames(hostile, 'en').length).to.equal(0);
    expect(resolveUnitNames(hostile, 'en').length).to.equal(0);
    expect(reads).to.equal(0);
  });

  it('reuses resolved unit names across calls instead of rebuilding two formatters per unit', () => {
    const Original = Intl.NumberFormat;
    let constructed = 0;
    Intl.NumberFormat = new Proxy(Original, {
      construct(target, args, newTarget) {
        constructed++;
        return Reflect.construct(target, args, newTarget);
      },
    });
    try {
      resolveUnitNames(UNIT_CODES, 'sw');
      constructed = 0;
      for (let call = 0; call < 3; call++) resolveUnitNames(UNIT_CODES, 'sw');
      expect(constructed).to.equal(0);
    } finally {
      Intl.NumberFormat = Original;
    }
  });

  it('localizes standard units while retaining custom identifiers and supplied symbols', () => {
    expect(UNIT_CODES).to.include('kilometer');
    expect(UNIT_CODES).to.include('microsecond');
    expect(Object.isFrozen(UNIT_CODES)).to.equal(true);
    const entries = [
      { code: 'kilometer' },
      { code: 'kWh', label: 'Energy', symbol: 'kWh', group: 'Electricity' },
    ];
    const en = resolveUnitNames(entries, 'en');
    const fr = resolveUnitNames(entries, 'fr');
    expect(en[0]!.label).to.equal('kilometer');
    expect(fr[0]!.label).to.equal('kilomètre');
    expect(en[0]!.symbol).to.equal('km');
    expect(en[1]!.code).to.equal('kWh');
    expect(en[1]!.label).to.equal('Energy');
    expect(en[1]!.symbol).to.equal('kWh');
    expect(en[1]!.group).to.equal('Electricity');
    entries[1]!.label = 'Changed later';
    expect(en[1]!.label).to.equal('Energy');
    expect(Object.isFrozen(en[1])).to.equal(true);
    expect(resolveUnitNames([], 'en')).to.deep.equal([]);
  });

  it('returns UTC and runtime time zones without duplicates or current-zone inference', () => {
    const codes = getTimeZoneCodes();
    expect(codes[0]).to.equal('UTC');
    expect(new Set(codes).size).to.equal(codes.length);
    expect(codes.length).to.be.at.most(1024);
    expect(Object.isFrozen(codes)).to.equal(true);
  });

  it('retains UTC when the runtime cannot enumerate time zones', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'supportedValuesOf');
    try {
      Object.defineProperty(Intl, 'supportedValuesOf', { configurable: true, value: undefined });
      expect(getTimeZoneCodes()).to.deep.equal(['UTC']);
    } finally {
      if (descriptor) Object.defineProperty(Intl, 'supportedValuesOf', descriptor);
      else Reflect.deleteProperty(Intl, 'supportedValuesOf');
    }
  });
});
