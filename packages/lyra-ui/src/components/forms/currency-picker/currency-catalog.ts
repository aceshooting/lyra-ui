import type { LyraCurrencyEntry } from './currency-picker.class.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';

/**
 * ISO 4217 currency, fund and metal codes from SIX list one, published 2026-09-17.
 * Source: https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml
 * XML SHA-256: 33139b438657d1cee116ba737807ea71d19d6de4b90f799a09c56f0cc6a1b0ff.
 * The 178 unique source codes are sorted; XTS (test) and XXX (no currency) are excluded here.
 * Names and symbols are resolved from Intl at runtime, never copied from the source.
 */
export const DEFAULT_CURRENCY_CODES: readonly string[] = Object.freeze([
  'AED', 'AFN', 'ALL', 'AMD', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM',
  'BBD', 'BDT', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BOV', 'BRL', 'BSD',
  'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHE', 'CHF', 'CHW', 'CLF',
  'CLP', 'CNY', 'COP', 'COU', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK',
  'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL',
  'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF',
  'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES',
  'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP',
  'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT',
  'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MXV', 'MYR', 'MZN', 'NAD',
  'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP',
  'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD',
  'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN',
  'SVC', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD',
  'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'USN', 'UYI', 'UYU', 'UYW', 'UZS',
  'VED', 'VES', 'VND', 'VUV', 'WST', 'XAD', 'XAF', 'XAG', 'XAU', 'XBA',
  'XBB', 'XBC', 'XBD', 'XCD', 'XCG', 'XDR', 'XOF', 'XPD', 'XPF', 'XPT',
  'XSU', 'XUA', 'YER', 'ZAR', 'ZMW', 'ZWG',
]);

export const DEFAULT_CURRENCY_ENTRIES: readonly LyraCurrencyEntry[] = Object.freeze(
  DEFAULT_CURRENCY_CODES.map((code) => Object.freeze({ code })),
);

/** Normalize an assigned value without discarding malformed, nonempty caller data. */
export function normalizeCurrencyValue(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z]{3}$/.test(text) ? text.toUpperCase() : text;
}

/** Clone a bounded caller catalog; undefined means the pinned default catalog. */
export function normalizeCurrencyCatalog(value: unknown): readonly LyraCurrencyEntry[] | undefined {
  if (value == null) return undefined;
  let length: number;
  try {
    if (!Array.isArray(value)) return Object.freeze([]);
    const lengthDescriptor = getOwnDataDescriptor(value, 'length');
    const ownLength = typeof lengthDescriptor === 'symbol' ? undefined : lengthDescriptor.value;
    if (typeof ownLength !== 'number' || !Number.isSafeInteger(ownLength) || ownLength < 0) {
      return Object.freeze([]);
    }
    length = Math.min(ownLength, 512);
  } catch {
    return Object.freeze([]);
  }

  const rows: LyraCurrencyEntry[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < length; index++) {
    let code: unknown;
    let label: unknown;
    let symbol: unknown;
    let disabled: unknown;
    try {
      const indexDescriptor = getOwnDataDescriptor(value, String(index));
      if (typeof indexDescriptor === 'symbol') continue;
      const item = indexDescriptor.value;
      if (typeof item === 'string') {
        code = item;
      } else if (item && typeof item === 'object' && !Array.isArray(item)) {
        const codeDescriptor = getOwnDataDescriptor(item, 'code');
        if (codeDescriptor === MISSING_OWN_DATA_DESCRIPTOR || codeDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR) continue;
        const labelDescriptor = getOwnDataDescriptor(item, 'label');
        const symbolDescriptor = getOwnDataDescriptor(item, 'symbol');
        const disabledDescriptor = getOwnDataDescriptor(item, 'disabled');
        if (labelDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
            symbolDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
            disabledDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR) continue;
        code = codeDescriptor.value;
        label = labelDescriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : labelDescriptor.value;
        symbol = symbolDescriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : symbolDescriptor.value;
        disabled = disabledDescriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : disabledDescriptor.value;
      } else {
        continue;
      }
    } catch {
      continue;
    }
    const normalized = normalizeCurrencyValue(code);
    if (!/^[A-Z]{3}$/.test(normalized) || seen.has(normalized)) continue;
    if (label !== undefined && typeof label !== 'string') continue;
    if (symbol !== undefined && typeof symbol !== 'string') continue;
    if (disabled !== undefined && typeof disabled !== 'boolean') continue;

    const row: LyraCurrencyEntry = { code: normalized };
    if (label !== undefined) Object.assign(row, { label });
    if (symbol !== undefined) Object.assign(row, { symbol });
    if (disabled !== undefined) Object.assign(row, { disabled });
    rows.push(Object.freeze(row));
    seen.add(normalized);
  }
  return Object.freeze(rows);
}
