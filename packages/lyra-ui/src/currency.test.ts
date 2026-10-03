import { expect } from '@open-wc/testing';
import {
  CURRENCY_CODES,
  convertCurrency,
  getCurrencyCatalog,
  loadCurrencyRates,
  normalizeCurrencyRates,
} from './currency.js';
import type { LyraCurrencyCode, LyraCurrencyRateSnapshot, LyraCurrencyRateSource } from './currency.js';

function snapshot(rates: Readonly<Partial<Record<string, number>>> = { USD: 1.25, GBP: 0.8 }): LyraCurrencyRateSnapshot {
  return { base: 'EUR', date: '2026-09-08', rates };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  let rejected = false;
  const reason = await promise.then(() => undefined, (error: unknown) => { rejected = true; return error; });
  expect(rejected).to.equal(true);
  return reason;
}

function trackAbortListeners(signal: AbortSignal): { readonly added: number; readonly removed: number; restore(): void } {
  const add = signal.addEventListener.bind(signal);
  const remove = signal.removeEventListener.bind(signal);
  let added = 0;
  let removed = 0;
  Object.defineProperty(signal, 'addEventListener', {
    configurable: true,
    value: (...args: Parameters<AbortSignal['addEventListener']>) => {
      if (args[0] === 'abort') added++;
      add(...args);
    },
  });
  Object.defineProperty(signal, 'removeEventListener', {
    configurable: true,
    value: (...args: Parameters<AbortSignal['removeEventListener']>) => {
      if (args[0] === 'abort') removed++;
      remove(...args);
    },
  });
  return {
    get added() { return added; },
    get removed() { return removed; },
    restore() {
      Reflect.deleteProperty(signal, 'addEventListener');
      Reflect.deleteProperty(signal, 'removeEventListener');
    },
  };
}

describe('public currency catalog', () => {
  it('exports all 178 pinned ISO codes including test and no-currency sentinels', () => {
    const code: LyraCurrencyCode = 'XTS';
    const closedType: string extends LyraCurrencyCode ? false : true = true;
    expect(code).to.equal('XTS');
    expect(closedType).to.equal(true);
    expect(CURRENCY_CODES).to.have.length(178);
    expect(new Set(CURRENCY_CODES).size).to.equal(178);
    expect(CURRENCY_CODES).to.deep.equal([...CURRENCY_CODES].sort());
    expect(CURRENCY_CODES).to.include('XTS').and.include('XXX').and.include('XAU');
    expect(Object.isFrozen(CURRENCY_CODES)).to.equal(true);
    expect(getCurrencyCatalog('en').map((entry) => entry.code)).to.deep.equal(CURRENCY_CODES);
  });

  it('localizes full catalogs and owns immutable ordered custom or empty catalogs', () => {
    const source = [{ code: ' gbp ', label: 'Custom pound', symbol: 'p', group: 'Common', disabled: true }, { code: 'EUR' }];
    const result = getCurrencyCatalog('fr', source);
    expect(result.map((entry) => entry.code)).to.deep.equal(['GBP', 'EUR']);
    expect(result[0]?.label).to.equal('Custom pound');
    expect(result[0]?.symbol).to.equal('p');
    expect(result[0]?.group).to.equal('Common');
    expect(result[0]?.disabled).to.equal(true);
    expect(result[1]?.label).to.equal(new Intl.DisplayNames('fr', { type: 'currency' }).of('EUR'));
    expect(result[0]?.narrowSymbol).to.equal(new Intl.NumberFormat('fr', {
      style: 'currency', currency: 'GBP', currencyDisplay: 'narrowSymbol',
    }).formatToParts(0).find((part) => part.type === 'currency')?.value);
    expect(Object.hasOwn(result[0]!, 'searchText')).to.equal(false);
    expect(Object.isFrozen(result)).to.equal(true);
    expect(result.every((entry) => Object.isFrozen(entry))).to.equal(true);
    source[0]!.group = 'Changed';
    expect(result[0]?.group).to.equal('Common');
    expect(getCurrencyCatalog('en', [])).to.deep.equal([]);
    expect(getCurrencyCatalog('en', ['ZZZ', 'USD', 'zzz']).map((entry) => entry.code)).to.deep.equal(['ZZZ', 'USD']);
  });
});

describe('normalizeCurrencyRates', () => {
  it('owns a frozen partial snapshot, normalizes codes and adds only the exact base identity', () => {
    const source = { base: ' eur ', date: '2026-09-08', rates: { ' usd ': 1.25, GBP: 0.8 } };
    const result = normalizeCurrencyRates(source);
    const absent: number | undefined = result.rates['JPY'];
    const partialType: undefined extends LyraCurrencyRateSnapshot['rates'][string] ? true : false = true;
    expect(partialType).to.equal(true);
    expect(absent).to.equal(undefined);
    expect(result.base).to.equal('EUR');
    expect(result.date).to.equal('2026-09-08');
    expect({ ...result.rates }).to.deep.equal({ USD: 1.25, GBP: 0.8, EUR: 1 });
    expect(Object.getPrototypeOf(result.rates)).to.equal(null);
    expect(Object.isFrozen(result)).to.equal(true);
    expect(Object.isFrozen(result.rates)).to.equal(true);
    source.rates.GBP = 9;
    source.base = 'USD';
    expect(result.rates['GBP']).to.equal(0.8);
    expect(result.base).to.equal('EUR');
  });

  it('accepts explicit unknown dates, custom codes, null-prototype records and base-only data', () => {
    const rates = Object.assign(Object.create(null), { ABC: 2 });
    const input = Object.assign(Object.create(null), { base: 'ZZZ', date: null, rates });
    expect({ ...normalizeCurrencyRates(input).rates }).to.deep.equal({ ABC: 2, ZZZ: 1 });
    expect({ ...normalizeCurrencyRates({ base: 'EUR', date: null, rates: {} }).rates }).to.deep.equal({ EUR: 1 });
    expect(normalizeCurrencyRates({ base: 'USD', date: ' provider day 42 ', rates: { USD: 1 } }).date)
      .to.equal(' provider day 42 ');
  });

  it('requires own base, date and rates data fields without invoking getters', () => {
    let calls = 0;
    for (const key of ['base', 'date', 'rates']) {
      const input = snapshot();
      Object.defineProperty(input, key, { get() { calls++; throw new Error('getter'); } });
      expect(() => normalizeCurrencyRates(input)).to.throw(TypeError);
      const missing: Record<string, unknown> = { ...snapshot() };
      Reflect.deleteProperty(missing, key);
      expect(() => normalizeCurrencyRates(missing)).to.throw(TypeError);
    }
    expect(calls).to.equal(0);
    expect(() => normalizeCurrencyRates(Object.create(snapshot()))).to.throw(TypeError);
  });

  it('rejects arrays, class instances and reflection failures as malformed snapshots', () => {
    class RateTable { USD = 1; }
    for (const input of [null, undefined, 1, [], new Date(), () => snapshot(), new RateTable()]) {
      expect(() => normalizeCurrencyRates(input)).to.throw(TypeError);
    }
    for (const rates of [[], Object.setPrototypeOf([], null), new RateTable(), Object.create({ USD: 1 }), null]) {
      expect(() => normalizeCurrencyRates({ base: 'EUR', date: null, rates })).to.throw(TypeError);
    }
    const prototypeTrap = new Proxy(snapshot(), { getPrototypeOf() { throw new Error('prototype trap'); } });
    const descriptorTrap = new Proxy(snapshot(), { getOwnPropertyDescriptor() { throw new Error('descriptor trap'); } });
    const keyTrap = new Proxy({}, { ownKeys() { throw new Error('keys trap'); } });
    expect(() => normalizeCurrencyRates(prototypeTrap)).to.throw(TypeError);
    expect(() => normalizeCurrencyRates(descriptorTrap)).to.throw(TypeError);
    expect(() => normalizeCurrencyRates({ base: 'EUR', date: null, rates: keyTrap })).to.throw(TypeError);
    const arrayRecord = Object.assign(Object.setPrototypeOf([], Object.prototype), snapshot());
    expect(() => normalizeCurrencyRates(arrayRecord)).to.throw(TypeError);
  });

  it('rejects malformed codes, duplicate normalized quotes and invalid quote values atomically', () => {
    for (const base of ['', 'EU', 'EURO', '€UR', 42]) {
      expect(() => normalizeCurrencyRates({ base, date: null, rates: {} })).to.throw(TypeError);
    }
    for (const rates of [{ US: 1 }, { '€UR': 1 }, { USD: 1, ' usd ': 2 }, { [Symbol('USD')]: 1 }]) {
      expect(() => normalizeCurrencyRates({ base: 'EUR', date: null, rates })).to.throw(TypeError);
    }
    for (const value of [0, -1, NaN, Infinity, -Infinity, '1', undefined, null]) {
      expect(() => normalizeCurrencyRates({ base: 'EUR', date: null, rates: { USD: 1, GBP: value } })).to.throw(TypeError);
    }
    expect(() => normalizeCurrencyRates(snapshot({ EUR: 0.99 }))).to.throw(TypeError);
    expect(normalizeCurrencyRates(snapshot({ EUR: 1 })).rates['EUR']).to.equal(1);
  });

  it('does not consume inherited or accessor quotes, including non-enumerable accessors', () => {
    let calls = 0;
    const rates = {};
    Object.defineProperty(rates, 'USD', { get() { calls++; return 1.2; } });
    expect(() => normalizeCurrencyRates({ base: 'EUR', date: null, rates })).to.throw(TypeError);
    const trap = new Proxy({ USD: 1 }, { getOwnPropertyDescriptor() { throw new Error('quote trap'); } });
    expect(() => normalizeCurrencyRates({ base: 'EUR', date: null, rates: trap })).to.throw(TypeError);
    expect(calls).to.equal(0);
  });

  it('requires bounded explicit as-of metadata without interpreting or replacing it', () => {
    for (const date of [undefined, '', '   ', 1, new Date(), 'x'.repeat(129)]) {
      expect(() => normalizeCurrencyRates({ base: 'EUR', date, rates: {} })).to.throw(TypeError);
    }
    expect(normalizeCurrencyRates({ base: 'EUR', date: 'x'.repeat(128), rates: {} }).date).to.have.length(128);
  });

  it('limits the full normalized table to 512 entries including an omitted base identity', () => {
    const rates = Object.fromEntries(Array.from({ length: 512 }, (_, index) => [
      `A${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + index % 26)}`, 2,
    ]));
    expect(() => normalizeCurrencyRates({ base: 'ZZZ', date: null, rates })).to.throw(RangeError);
    rates['AAA'] = 1;
    expect(Object.keys(normalizeCurrencyRates({ base: 'AAA', date: null, rates }).rates)).to.have.length(512);
    Reflect.deleteProperty(rates, 'AAA');
    expect(Object.keys(normalizeCurrencyRates({ base: 'ZZZ', date: null, rates }).rates)).to.have.length(512);
    rates['ZZZ'] = 1;
    rates['YYY'] = 1;
    expect(() => normalizeCurrencyRates({ base: 'ZZZ', date: null, rates })).to.throw(RangeError);
  });
});

describe('convertCurrency', () => {
  it('converts arbitrary base snapshots in both directions without rounding or mutation', () => {
    const input = { base: 'USD', date: '2026-09-08', rates: { EUR: 0.8, GBP: 0.64, JPY: 160 } };
    expect(convertCurrency(100, ' eur ', 'GBP', input)).to.be.closeTo(80, 1e-12);
    expect(convertCurrency(80, 'GBP', 'EUR', input)).to.be.closeTo(100, 1e-12);
    expect(convertCurrency(-100, 'EUR', 'JPY', input)).to.equal(-20000);
    expect(convertCurrency(0, 'EUR', 'JPY', input)).to.equal(0);
    expect(convertCurrency(1.23456789, 'EUR', 'EUR', input)).to.equal(1.23456789);
    expect(Object.hasOwn(input.rates, 'USD')).to.equal(false);
  });

  it('requires both quotes even for zero or identical requested codes', () => {
    for (const amount of [0, 1]) {
      expect(() => convertCurrency(amount, 'JPY', 'EUR', snapshot())).to.throw(RangeError);
      expect(() => convertCurrency(amount, 'EUR', 'JPY', snapshot())).to.throw(RangeError);
      expect(() => convertCurrency(amount, 'JPY', 'JPY', snapshot())).to.throw(RangeError);
    }
    expect(() => convertCurrency(1, 'EU', 'USD', snapshot())).to.throw(TypeError);
    for (const amount of [NaN, Infinity, -Infinity]) {
      expect(() => convertCurrency(amount, 'EUR', 'USD', snapshot())).to.throw(TypeError);
    }
    expect(() => convertCurrency(1, 'EUR', 'EUR', snapshot({ EUR: 2 }))).to.throw(TypeError);
  });

  it('avoids intermediate ratio overflow and underflow when the final value is representable', () => {
    const input = snapshot({ AAA: 1e-300, BBB: 1e300 });
    expect(convertCurrency(1e-300, 'AAA', 'BBB', input)).to.equal(1e300);
    expect(convertCurrency(1e300, 'BBB', 'AAA', input)).to.equal(1e-300);
    expect(convertCurrency(-1e-300, 'AAA', 'BBB', input)).to.equal(-1e300);
    expect(convertCurrency(0, 'AAA', 'BBB', input)).to.equal(0);
    expect(() => convertCurrency(1e300, 'AAA', 'BBB', input)).to.throw(RangeError);
    expect(() => convertCurrency(1e-300, 'BBB', 'AAA', input)).to.throw(RangeError);
  });

  it('avoids the loss of precision from a nonzero subnormal intermediate ratio', () => {
    const input = snapshot({ AAA: 1e308, BBB: 1e-15 });
    expect(convertCurrency(1e308, 'AAA', 'BBB', input)).to.equal(1e-15);
    expect(convertCurrency(-1e308, 'AAA', 'BBB', input)).to.equal(-1e-15);
  });
});

describe('loadCurrencyRates', () => {
  it('accepts immutable static data or a contextual-typed loader without using a provider by default', async () => {
    const savedFetch = globalThis.fetch;
    let calls = 0;
    try {
      globalThis.fetch = () => { throw new Error('unexpected fetch'); };
      const staticResult = await loadCurrencyRates(snapshot());
      const source: LyraCurrencyRateSource = async ({ signal }) => {
        const typedSignal: AbortSignal = signal;
        expect(typedSignal.aborted).to.equal(false);
        calls++;
        return snapshot();
      };
      const loaded = await loadCurrencyRates(source);
      expect(loaded).to.deep.equal(staticResult);
      expect(Object.isFrozen(loaded.rates)).to.equal(true);
      expect(calls).to.equal(1);
    } finally {
      globalThis.fetch = savedFetch;
    }
  });

  it('normalizes static snapshots without reading an unrelated then accessor', async () => {
    let calls = 0;
    const source = Object.defineProperty(snapshot(), 'then', { get() { calls++; throw new Error('then getter'); } });
    expect((await loadCurrencyRates(source)).base).to.equal('EUR');
    expect(calls).to.equal(0);
  });

  it('rejects already-aborted static and loader calls without invoking the loader', async () => {
    const controller = new AbortController();
    const reason = new Error('stopped');
    controller.abort(reason);
    let calls = 0;
    const source = async () => { calls++; return snapshot(); };
    expect(await rejection(loadCurrencyRates(source, { signal: controller.signal }))).to.equal(reason);
    expect(await rejection(loadCurrencyRates(snapshot(), { signal: controller.signal }))).to.equal(reason);
    expect(calls).to.equal(0);
  });

  it('preserves provider rejection, synchronous throw and validation failures while removing listeners', async () => {
    const controller = new AbortController();
    const tracking = trackAbortListeners(controller.signal);
    const reason = new Error('provider failure');
    try {
      expect(await rejection(loadCurrencyRates(() => Promise.reject(reason), { signal: controller.signal }))).to.equal(reason);
      expect(await rejection(loadCurrencyRates(() => { throw reason; }, { signal: controller.signal }))).to.equal(reason);
      expect(await rejection(loadCurrencyRates(async () => ({ base: 'EUR' }), { signal: controller.signal })))
        .to.be.instanceOf(TypeError);
      expect(tracking.added).to.equal(3);
      expect(tracking.removed).to.equal(3);
    } finally {
      tracking.restore();
    }
  });

  it('passes the caller signal once and removes its listener on success', async () => {
    const controller = new AbortController();
    const tracking = trackAbortListeners(controller.signal);
    let seen: AbortSignal | undefined;
    let calls = 0;
    try {
      const result = await loadCurrencyRates(async ({ signal }) => { seen = signal; calls++; return snapshot(); }, {
        signal: controller.signal,
      });
      expect(seen === controller.signal).to.equal(true);
      expect(calls).to.equal(1);
      expect(result.base).to.equal('EUR');
      expect(tracking.added).to.equal(1);
      expect(tracking.removed).to.equal(1);
      controller.abort();
      expect(result.rates['USD']).to.equal(1.25);
    } finally {
      tracking.restore();
    }
  });

  it('rejects immediately on abort even when a loader ignores cancellation and never settles', async () => {
    const controller = new AbortController();
    const tracking = trackAbortListeners(controller.signal);
    const reason = { stopped: true };
    try {
      const pending = loadCurrencyRates(() => new Promise(() => undefined), { signal: controller.signal });
      controller.abort(reason);
      expect(await rejection(pending)).to.equal(reason);
      expect(tracking.added).to.equal(1);
      expect(tracking.removed).to.equal(1);
    } finally {
      tracking.restore();
    }
  });

  it('observes late provider rejection and never normalizes a late success after cancellation', async () => {
    let resolve: ((value: unknown) => void) | undefined;
    let reject: ((reason: unknown) => void) | undefined;
    let reads = 0;
    const late = new Proxy(snapshot(), { getOwnPropertyDescriptor() { reads++; throw new Error('late read'); } });
    for (const outcome of ['resolve', 'reject']) {
      const controller = new AbortController();
      const provider = new Promise<unknown>((done, fail) => { resolve = done; reject = fail; });
      const pending = loadCurrencyRates(() => provider, { signal: controller.signal });
      controller.abort();
      expect(await rejection(pending)).to.equal(controller.signal.reason);
      if (outcome === 'resolve') resolve!(late);
      else reject!(new Error('late rejection'));
      await Promise.resolve();
      await Promise.resolve();
    }
    expect(reads).to.equal(0);
  });

  it('makes cancellation win when a provider aborts synchronously or normalization triggers it', async () => {
    const controller = new AbortController();
    const reason = new Error('synchronous cancellation');
    expect(await rejection(loadCurrencyRates(() => {
      controller.abort(reason);
      throw new Error('later provider throw');
    }, { signal: controller.signal }))).to.equal(reason);
    const during = new AbortController();
    const source = new Proxy(snapshot(), {
      getOwnPropertyDescriptor(target, key) {
        during.abort(reason);
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    expect(await rejection(loadCurrencyRates(source, { signal: during.signal }))).to.equal(reason);
  });

  it('keeps concurrent calls independent and creates distinct signals when omitted', async () => {
    const first = new AbortController();
    const second = new AbortController();
    const canceled = loadCurrencyRates(() => new Promise(() => undefined), { signal: first.signal });
    first.abort();
    const valid = await loadCurrencyRates(async () => snapshot(), { signal: second.signal });
    expect(await rejection(canceled)).to.equal(first.signal.reason);
    expect(valid.base).to.equal('EUR');
    const signals: AbortSignal[] = [];
    await Promise.all([1, 2].map(() => loadCurrencyRates(async ({ signal }) => { signals.push(signal); return snapshot(); })));
    expect(signals).to.have.length(2);
    expect(signals[0] === signals[1]).to.equal(false);
  });
});
