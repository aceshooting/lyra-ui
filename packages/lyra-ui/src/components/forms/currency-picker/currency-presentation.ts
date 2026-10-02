import type { LyraCurrencyEntry } from './currency-types.js';
import { getDisplayNames, getNumberFormat } from '../../../internal/intl-cache.js';

export interface ResolvedCurrencyEntry {
  readonly code: string;
  readonly label: string;
  readonly symbol: string;
  readonly disabled: boolean;
}

/** Resolve display-only names and symbols without changing currency identity. */
export function resolveCurrencyPresentation(
  entries: readonly LyraCurrencyEntry[],
  locale: string,
): readonly ResolvedCurrencyEntry[] {
  const rows = entries.map((entry): ResolvedCurrencyEntry => {
    let label = entry.label;
    if (label === undefined) {
      try {
        const name = getDisplayNames(locale, { type: 'currency', fallback: 'code' }).of(entry.code);
        label = name?.trim() ? name : entry.code;
      } catch {
        label = entry.code;
      }
    }

    let symbol = entry.symbol;
    if (symbol === undefined) {
      try {
        const part = getNumberFormat(locale, {
          style: 'currency',
          currency: entry.code,
          currencyDisplay: 'symbol',
        }).formatToParts(0).find((candidate) => candidate.type === 'currency')?.value;
        symbol = part?.trim() ? part : entry.code;
      } catch {
        symbol = entry.code;
      }
    }

    return Object.freeze({ code: entry.code, label, symbol, disabled: entry.disabled === true });
  });
  return Object.freeze(rows);
}
