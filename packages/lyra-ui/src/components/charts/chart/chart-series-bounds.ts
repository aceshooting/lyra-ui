import { getOwnDataDescriptor } from '../../../internal/data-descriptors.js';
import { devWarnOnce } from '../../../internal/dev-warning.js';

/** Values one series keeps: the shared collection snapshot's per-array bound. */
const MAX_CHART_SERIES_VALUES = 10_000;

/** Longest `data` that keeps `seriesCount` series, at `weight` snapshot nodes per value, inside the
 *  shared snapshot bounds (10,000 per array; 45,000 of its 50,000 nodes, leaving room for records). */
export function chartSeriesValueLimit(seriesCount: number, weight = 1): number {
  return Math.max(1, Math.min(MAX_CHART_SERIES_VALUES, Math.floor(45_000 / (Math.max(1, seriesCount) * weight))));
}

/** An own data property's value; accessors and failed reflection read as missing. */
function ownValue(source: object, key: string): unknown {
  const descriptor = getOwnDataDescriptor(source, key);
  return typeof descriptor === 'object' ? descriptor.value : undefined;
}

/**
 * Keeps each series' first `chartSeriesValueLimit()` values before the shared collection snapshot
 * sees `value`, which otherwise drops a series whose `data` outgrows it -- and every later series
 * with it. Returns `undefined` when nothing needed trimming. Reads own data properties only.
 */
export function boundChartSeriesValues(value: unknown, weight = 1): unknown[] | undefined {
  try {
    if (!Array.isArray(value)) return undefined;
    const count = Math.min(Number(ownValue(value, 'length')) || 0, MAX_CHART_SERIES_VALUES);
    const limit = chartSeriesValueLimit(count, weight);
    let bounded: unknown[] | undefined;
    for (let index = 0; index < count; index += 1) {
      const series = ownValue(value, String(index));
      if (typeof series !== 'object' || !series) continue;
      const data = ownValue(series, 'data');
      if (!Array.isArray(data) || (Number(ownValue(data, 'length')) || 0) <= limit) continue;
      bounded ??= Array.from({ length: count }, (_, entry) => ownValue(value, String(entry)));
      const copy = {};
      for (const key of Object.keys(series)) {
        const descriptor = getOwnDataDescriptor(series, key);
        if (typeof descriptor === 'object')
          Object.defineProperty(copy, key, {
            value: key === 'data'
              ? Array.from({ length: limit }, (_, entry) => ownValue(data, String(entry)))
              : descriptor.value,
            enumerable: true,
            writable: true,
            configurable: true,
          });
      }
      bounded[index] = copy;
    }
    if (bounded)
      devWarnOnce('lr-chart-series-cap', 'A chart series past the value bound kept only its first values.');
    return bounded;
  } catch {
    return undefined;
  }
}
