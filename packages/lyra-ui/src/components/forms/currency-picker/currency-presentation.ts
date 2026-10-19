import type { LyraCurrencyDisplayEntry, LyraCurrencyEntry } from './currency-types.js';
import { getDisplayNames, getNumberFormat } from '../../../internal/intl-cache.js';

export interface ResolvedCurrencyEntry extends LyraCurrencyDisplayEntry {
  readonly searchText: string;
}

function resolveSymbol(code: string, locale: string, currencyDisplay: 'symbol' | 'narrowSymbol'): string {
  try {
    // Memoized per locale and code below; 352 formatters per locale would flush the shared cache.
    const part = getNumberFormat(locale, {
      style: 'currency', currency: code, currencyDisplay,
    }, false).formatToParts(0).find((candidate) => candidate.type === 'currency')?.value;
    return part?.trim() ? part : code;
  } catch {
    return code;
  }
}

const presentations = new Map<string, readonly [string, string, string]>();
let nameImplementation = Intl.DisplayNames?.prototype?.of;
let partsImplementation = Intl.NumberFormat?.prototype?.formatToParts;
function presentationFor(code: string, locale: string): readonly [string, string, string] {
  if (nameImplementation !== Intl.DisplayNames?.prototype?.of || partsImplementation !== Intl.NumberFormat?.prototype?.formatToParts) {
    presentations.clear();
    nameImplementation = Intl.DisplayNames?.prototype?.of;
    partsImplementation = Intl.NumberFormat?.prototype?.formatToParts;
  }
  const key = `${locale}\u0000${code}`;
  const cached = presentations.get(key);
  if (cached) return cached;
  let name = code;
  try { name = getDisplayNames(locale, { type: 'currency', fallback: 'code' }).of(code)?.trim() || code; }
  catch { /* Custom codes retain their identifier. */ }
  const result = [name, resolveSymbol(code, locale, 'symbol'), resolveSymbol(code, locale, 'narrowSymbol')] as const;
  if (presentations.size >= 1024) presentations.delete(presentations.keys().next().value!);
  presentations.set(key, result);
  return result;
}

/** Resolve display-only names and symbols without changing currency identity. */
export function resolveCurrencyPresentation(
  entries: readonly LyraCurrencyEntry[],
  locale: string,
): readonly ResolvedCurrencyEntry[] {
  const rows = entries.map((entry): ResolvedCurrencyEntry => {
    const [localizedName, regularSymbol, narrowSymbol] = presentationFor(entry.code, locale);
    const label = entry.label ?? localizedName;
    const symbol = entry.symbol ?? regularSymbol;
    const searchText = [...new Set([entry.code, label, localizedName, symbol, regularSymbol, narrowSymbol])].join(' ');
    return Object.freeze({
      code: entry.code, label, symbol, narrowSymbol, disabled: entry.disabled === true,
      ...(entry.group === undefined ? {} : { group: entry.group }),
      searchText,
    });
  });
  return Object.freeze(rows);
}
