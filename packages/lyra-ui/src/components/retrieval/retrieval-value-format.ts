import { getListFormat, getNumberFormat } from '../../internal/intl-cache.js';
import { finiteNumber } from '../../internal/numbers.js';

export interface BoundedRetrievalValueFormatOptions {
  readonly locale: string;
  readonly invalid: string;
  readonly truncated: string;
  readonly maxDepth?: number;
  readonly maxEntries?: number;
  readonly maxValues?: number;
  readonly maxStringLength?: number;
}

/**
 * Formats consumer-supplied retrieval metadata within explicit traversal and output bounds.
 *
 * The localized sentinels are supplied by the component so this utility stays independent from a
 * particular element's string slice. The path-local seen set rejects cycles while still allowing
 * the same acyclic object to appear in two sibling positions.
 */
export function formatBoundedRetrievalValue(
  value: unknown,
  options: BoundedRetrievalValueFormatOptions
): string {
  const maxDepth = options.maxDepth ?? 6;
  const maxEntries = options.maxEntries ?? 32;
  const maxValues = options.maxValues ?? 128;
  const maxStringLength = options.maxStringLength ?? 256;
  const seen = new WeakSet<object>();
  let remaining = maxValues;

  const boundedText = (value: string): string =>
    value.length > maxStringLength
      ? `${value.slice(0, maxStringLength)}${options.truncated}`
      : value;

  const format = (current: unknown, depth: number): string => {
    if (remaining-- <= 0 || depth > maxDepth) return options.truncated;
    if (typeof current === 'string') return boundedText(current);
    if (typeof current === 'number')
      return getNumberFormat(options.locale).format(finiteNumber(current, 0));
    if (typeof current === 'boolean' || typeof current === 'bigint')
      return String(current);
    if (current == null) return '';
    if (typeof current !== 'object') return options.invalid;
    if (seen.has(current)) return options.invalid;
    seen.add(current);

    try {
      if (Array.isArray(current)) {
        const length = current.length;
        if (!Number.isSafeInteger(length) || length < 0) return options.invalid;
        const count = Math.min(length, maxEntries);
        const items: string[] = [];
        for (let index = 0; index < count; index++)
          items.push(format(current[index], depth + 1));
        if (length > count) items.push(options.truncated);
        return getListFormat(options.locale, { type: 'conjunction' }).format(
          items
        );
      }

      const entries: Array<readonly [string, unknown]> = [];
      let truncated = false;
      for (const key in current as Record<string, unknown>) {
        if (!Object.prototype.hasOwnProperty.call(current, key)) continue;
        if (entries.length >= maxEntries) {
          truncated = true;
          break;
        }
        entries.push([
          boundedText(key),
          (current as Record<string, unknown>)[key],
        ]);
      }
      const parts = entries.map(
        ([key, item]) => `${key}: ${format(item, depth + 1)}`
      );
      if (truncated) parts.push(options.truncated);
      return `{${parts.join(', ')}}`;
    } catch {
      return options.invalid;
    } finally {
      seen.delete(current);
    }
  };

  return format(value, 0);
}
