import { readOwnDataValue } from './data-descriptors.js';
import { isSafeNonArrayObject } from './object-guards.js';
import { sanitizeCssColor } from './safe-css.js';

export function boundedLegendText(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, Math.max(0, limit - 1))}…`;
}

/** The accepted `choropleth.noData` record. */
export interface CanonicalChoroplethNoData {
  readonly color: string | undefined;
  readonly strokeColor: string | undefined;
  readonly label: string | undefined;
}

/** Bound on a no-data caption, matching a legend label. */
const MAX_NO_DATA_LABEL = 256;

export function projectChoroplethNoData(value: unknown): CanonicalChoroplethNoData | undefined {
  try {
    if (!isSafeNonArrayObject(value)) return undefined;
    const label = readOwnDataValue(value, 'label');
    const trimmed = typeof label === 'string' ? label.trim() : '';
    return Object.freeze({
      color: sanitizeCssColor(readOwnDataValue(value, 'color')),
      strokeColor: sanitizeCssColor(readOwnDataValue(value, 'strokeColor')),
      label: trimmed.length > 0 ? boundedLegendText(trimmed, MAX_NO_DATA_LABEL) : undefined,
    });
  } catch {
    return undefined;
  }
}
