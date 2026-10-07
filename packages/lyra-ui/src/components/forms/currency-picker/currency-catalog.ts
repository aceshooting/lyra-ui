import type { LyraCurrencyEntry } from './currency-types.js';
import { snapshotSelectionCatalog } from '../../../internal/selection-catalog.js';

/**
 * ISO 4217 currency, fund and metal codes from SIX list one, published 2026-09-17.
 * Source: https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml
 * XML SHA-256: 33139b438657d1cee116ba737807ea71d19d6de4b90f799a09c56f0cc6a1b0ff.
 * The 178 unique source codes are sorted, including XTS (test) and XXX (no currency).
 * Names and symbols are resolved from Intl at runtime, never copied from the source.
 */
const ISO_CURRENCY_CODES = Object.freeze([
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
  'XSU', 'XTS', 'XUA', 'XXX', 'YER', 'ZAR', 'ZMW', 'ZWG',
] as const);

/** A code in the pinned ISO 4217 catalog, including funds, metals and reserved codes. */
export type LyraCurrencyCode = typeof ISO_CURRENCY_CODES[number];

/** Frozen full ISO 4217 catalog; membership does not imply exchange-rate provider support. */
export const CURRENCY_CODES: readonly LyraCurrencyCode[] = ISO_CURRENCY_CODES;

/** Picker defaults exclude the test and no-currency sentinels. */
export const DEFAULT_CURRENCY_CODES: readonly LyraCurrencyCode[] = Object.freeze(
  CURRENCY_CODES.filter((code) => code !== 'XTS' && code !== 'XXX'),
);

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
  return snapshotSelectionCatalog(value, normalizeCurrencyValue, (code) => /^[A-Z]{3}$/.test(code));
}
