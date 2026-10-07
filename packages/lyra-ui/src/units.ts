import { getNumberFormat } from './internal/intl-cache.js';
import { snapshotSelectionCatalog, type SelectionCatalogRow } from './internal/selection-catalog.js';

// ECMA-402, Table 2: single units sanctioned for use in ECMAScript.
// https://tc39.es/ecma402/#table-sanctioned-single-unit-identifiers
const unitCodes = [
  'acre', 'bit', 'byte', 'celsius', 'centimeter', 'day', 'degree', 'fahrenheit',
  'fluid-ounce', 'foot', 'gallon', 'gigabit', 'gigabyte', 'gram', 'hectare', 'hour',
  'inch', 'kilobit', 'kilobyte', 'kilogram', 'kilometer', 'liter', 'megabit',
  'megabyte', 'meter', 'microsecond', 'mile', 'mile-scandinavian', 'milliliter',
  'millimeter', 'millisecond', 'minute', 'month', 'nanosecond', 'ounce', 'percent',
  'petabyte', 'pound', 'second', 'stone', 'terabit', 'terabyte', 'week', 'yard', 'year',
] as const;

export type LyraUnitCode = typeof unitCodes[number];
/** Frozen standard simple-unit catalog. Custom and compound units may be supplied separately. */
export const UNIT_CODES: readonly LyraUnitCode[] = Object.freeze(unitCodes);
export interface LyraUnitEntry {
  readonly code: string;
  readonly label?: string;
  readonly symbol?: string;
  readonly group?: string;
  readonly disabled?: boolean;
}
export type LyraUnitCatalog = readonly string[] | readonly LyraUnitEntry[];

const unitNames = new Map<string, readonly [name: string, symbol: string]>();

/** One long and one short formatter per unit, resolved once per locale and unit: 45 units overflow the shared 64-entry cache. */
function unitNamesFor(locale: string, code: string): readonly [string, string] {
  const key = `${locale}\u0000${code}`;
  let names = unitNames.get(key);
  if (!names) {
    let name = code;
    let symbol = code;
    const part = (unitDisplay: 'long' | 'short') => getNumberFormat(locale, { style: 'unit', unit: code, unitDisplay })
      .formatToParts(1).filter((entry) => entry.type === 'unit').map((entry) => entry.value).join('') || code;
    try {
      name = part('long');
      symbol = part('short');
    } catch { /* Custom units use supplied display text or their stable identifier. */ }
    if (unitNames.size >= 1024) unitNames.clear();
    unitNames.set(key, (names = [name, symbol]));
  }
  return names;
}

/** Resolve localized singular names and symbols without converting a measurement. */
export function resolveUnitNames(units: LyraUnitCatalog, locale: string): readonly SelectionCatalogRow[] {
  const entries = snapshotSelectionCatalog(units, (code) => code.trim()) ?? [];
  return Object.freeze(entries.map((entry) => {
    const [name, symbol] = unitNamesFor(locale, entry.code);
    const label = entry.label ?? name;
    return Object.freeze({ ...entry, label, symbol: entry.symbol ?? symbol,
      searchText: [entry.code, name, label, symbol, entry.symbol ?? ''].join(' ') });
  }));
}
