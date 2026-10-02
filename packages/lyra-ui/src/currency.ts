import {
  CURRENCY_CODES,
  normalizeCurrencyCatalog,
  normalizeCurrencyValue,
} from './components/forms/currency-picker/currency-catalog.js';
import { resolveCurrencyPresentation } from './components/forms/currency-picker/currency-presentation.js';
import type { LyraCurrencyCatalog, LyraCurrencyDisplayEntry } from './components/forms/currency-picker/currency-types.js';
import { getOwnDataDescriptor } from './internal/data-descriptors.js';

export { CURRENCY_CODES } from './components/forms/currency-picker/currency-catalog.js';
export type { LyraCurrencyCode } from './components/forms/currency-picker/currency-catalog.js';
export type {
  LyraCurrencyCatalog,
  LyraCurrencyDisplayEntry,
  LyraCurrencyEntry,
} from './components/forms/currency-picker/currency-types.js';

/**
 * Return immutable localized display data for the full ISO catalog, or a caller-ordered subset.
 * The full catalog includes XTS and XXX; the picker's omitted catalog excludes those sentinels.
 * Custom three-letter codes are supported. An explicit empty catalog remains empty.
 */
export function getCurrencyCatalog(
  locale: string,
  currencies?: LyraCurrencyCatalog,
): readonly LyraCurrencyDisplayEntry[] {
  const entries = normalizeCurrencyCatalog(currencies ?? CURRENCY_CODES) ?? [];
  const rows = resolveCurrencyPresentation(entries, locale).map((entry): LyraCurrencyDisplayEntry => Object.freeze({
    code: entry.code,
    label: entry.label,
    symbol: entry.symbol,
    narrowSymbol: entry.narrowSymbol,
    disabled: entry.disabled,
    ...(entry.group === undefined ? {} : { group: entry.group }),
  }));
  return Object.freeze(rows);
}

/** Quotes are units of each currency per one unit of base; absent quotes remain unavailable. */
export interface LyraCurrencyRateSnapshot {
  readonly base: string;
  /** Provider as-of metadata, or null when unknown; never the helper's fetch time. */
  readonly date: string | null;
  readonly rates: Readonly<Partial<Record<string, number>>>;
}

/** Cancellation for a single independent load; providers own transport, authentication and cache. */
export interface LyraCurrencyRateLoadOptions {
  readonly signal?: AbortSignal;
}

/** A caller-supplied provider mapping its response to the canonical snapshot shape. */
export type LyraCurrencyRateLoader = (context: { readonly signal: AbortSignal }) => Promise<unknown>;

/** Static data or an explicit provider; the library does not select an exchange-rate service. */
export type LyraCurrencyRateSource = LyraCurrencyRateSnapshot | LyraCurrencyRateLoader;

function requireRecord(value: unknown): object {
  if (value === null || typeof value !== 'object') throw new TypeError('Expected a currency data record.');
  let prototype: unknown;
  try {
    if (Array.isArray(value)) throw new TypeError('Currency data records cannot be arrays.');
    prototype = Object.getPrototypeOf(value);
  } catch {
    throw new TypeError('Cannot inspect the currency data record.');
  }
  if (prototype !== null && prototype !== Object.prototype) {
    throw new TypeError('Expected a plain currency data record.');
  }
  return value;
}

function requireOwnValue(record: object, key: PropertyKey): unknown {
  const descriptor = getOwnDataDescriptor(record, key);
  if (typeof descriptor === 'symbol') throw new TypeError('Currency data requires own data fields.');
  return descriptor.value;
}

function requireCode(value: unknown): string {
  const code = normalizeCurrencyValue(value);
  if (!/^[A-Z]{3}$/.test(code)) throw new TypeError('Currency codes must contain three ASCII letters.');
  return code;
}

/**
 * Validate, clone and freeze a partial rate table with at most 512 currencies, including base.
 * Accept only plain or null-prototype own-data records, positive finite numeric quotes and
 * an explicit null or nonblank date of at most 128 UTF-16 code units. Reject duplicate normalized
 * codes and conflicting base quotes; add only the exact base identity of 1 when absent.
 * Throws TypeError for malformed data or RangeError for an oversized table.
 */
export function normalizeCurrencyRates(input: unknown): LyraCurrencyRateSnapshot {
  const record = requireRecord(input);
  const base = requireCode(requireOwnValue(record, 'base'));
  const date = requireOwnValue(record, 'date');
  if (date !== null && (typeof date !== 'string' || date.length > 128 || !date.trim())) {
    throw new TypeError('Currency rate dates must be null or bounded nonblank provider metadata.');
  }
  const sourceRates = requireRecord(requireOwnValue(record, 'rates'));
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(sourceRates);
  } catch {
    throw new TypeError('Cannot inspect the currency rate keys.');
  }
  if (keys.length > 512) throw new RangeError('Currency rate tables are limited to 512 codes.');
  const rates: Partial<Record<string, number>> = Object.create(null);
  const seen = new Set<string>();
  for (const key of keys) {
    const code = requireCode(key);
    if (seen.has(code)) throw new TypeError('Currency rate codes must be unique after normalization.');
    const rate = requireOwnValue(sourceRates, key);
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      throw new TypeError('Currency rates must be positive finite numbers.');
    }
    if (code === base && rate !== 1) throw new TypeError('The base currency rate must equal 1.');
    seen.add(code);
    rates[code] = rate;
  }
  if (!seen.has(base)) {
    if (seen.size === 512) throw new RangeError('Currency rate tables are limited to 512 codes including base.');
    rates[base] = 1;
  }
  return Object.freeze({ base, date, rates: Object.freeze(rates) });
}

/**
 * Convert finite signed amounts using the snapshot's common base without rounding.
 * Require both quotes even for zero or same-currency requests. Throw RangeError for missing
 * quotes or results outside finite nonzero numeric range, and TypeError for malformed input.
 * Applications retain responsibility for monetary rounding and historical-rate policy.
 */
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  snapshot: LyraCurrencyRateSnapshot,
): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new TypeError('Currency amounts must be finite numbers.');
  const fromCode = requireCode(from);
  const toCode = requireCode(to);
  const normalized = normalizeCurrencyRates(snapshot);
  const fromRate = normalized.rates[fromCode];
  const toRate = normalized.rates[toCode];
  if (fromRate === undefined || toRate === undefined) throw new RangeError('A requested currency quote is unavailable.');
  if (fromCode === toCode || amount === 0) return amount;
  const ratio = toRate / fromRate;
  // A subnormal ratio loses precision before multiplication can restore its magnitude.
  const normalRatio = Number.isFinite(ratio) && ratio >= 2 ** -1022;
  let result = normalRatio ? amount * ratio : (amount / fromRate) * toRate;
  if (!Number.isFinite(result) || result === 0) {
    result = normalRatio ? (amount / fromRate) * toRate : amount * ratio;
  }
  if (!Number.isFinite(result) || result === 0) throw new RangeError('The converted amount is outside the numeric range.');
  return result;
}

/**
 * Normalize static data or invoke an explicit loader once with a cancellation signal.
 * Cancellation rejects promptly with the signal's reason, including when a provider ignores it;
 * late results are observed but discarded. Preserve provider errors and release abort listeners
 * on every outcome. Each call is independent; applications own latest-request assignment guards.
 */
export function loadCurrencyRates(
  source: LyraCurrencyRateSource,
  options: LyraCurrencyRateLoadOptions = {},
): Promise<LyraCurrencyRateSnapshot> {
  const signal = options.signal ?? new AbortController().signal;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => signal.removeEventListener('abort', onAbort);
    const fail = (reason: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(reason);
    };
    const onAbort = (): void => fail(signal.reason);
    const accept = (input: unknown): void => {
      if (settled) return;
      if (signal.aborted) { onAbort(); return; }
      try {
        const normalized = normalizeCurrencyRates(input);
        if (signal.aborted) { onAbort(); return; }
        settled = true;
        cleanup();
        resolve(normalized);
      } catch (error) {
        fail(signal.aborted ? signal.reason : error);
      }
    };
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) { onAbort(); return; }
    if (typeof source !== 'function') {
      accept(source);
      return;
    }
    try {
      Promise.resolve(source({ signal })).then(accept, (error: unknown) => fail(signal.aborted ? signal.reason : error));
    } catch (error) {
      fail(signal.aborted ? signal.reason : error);
    }
  });
}
