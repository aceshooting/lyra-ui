import type { LyraCurrencyDisplayEntry, LyraCurrencyEntry } from './currency-types.js';
import { getDisplayNames, getNumberFormat } from '../../../internal/intl-cache.js';

export interface ResolvedCurrencyEntry extends LyraCurrencyDisplayEntry {
  readonly searchText: string;
}

function resolveSymbol(code: string, locale: string, currencyDisplay: 'symbol' | 'narrowSymbol'): string {
  try {
    const part = getNumberFormat(locale, {
      style: 'currency', currency: code, currencyDisplay,
    }).formatToParts(0).find((candidate) => candidate.type === 'currency')?.value;
    return part?.trim() ? part : code;
  } catch {
    return code;
  }
}

/** Resolve display-only names and symbols without changing currency identity. */
export function resolveCurrencyPresentation(
  entries: readonly LyraCurrencyEntry[],
  locale: string,
): readonly ResolvedCurrencyEntry[] {
  const rows = entries.map((entry): ResolvedCurrencyEntry => {
    let localizedName: string;
    try {
      const name = getDisplayNames(locale, { type: 'currency', fallback: 'code' }).of(entry.code);
      localizedName = name?.trim() ? name : entry.code;
    } catch {
      localizedName = entry.code;
    }
    const regularSymbol = resolveSymbol(entry.code, locale, 'symbol');
    const narrowSymbol = resolveSymbol(entry.code, locale, 'narrowSymbol');
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
